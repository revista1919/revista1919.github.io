/**
 * Script MEJORADO para reprocesar estadísticas de revisores
 * Maneja mejor documentos legacy sin dueDate
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ===== CONFIGURACIÓN =====
const CONFIG = {
  dryRun: false,
  batchSize: 450,
  // Plazo típico para revisiones (días) - usado para legacy sin dueDate
  defaultReviewDeadlineDays: 21,
  // Plazo típico para responder invitación (días)
  defaultResponseDeadlineDays: 7,
  testMode: false,
  testReviewerUids: [
    'ofxyom4jFkbdSaNh6gTzEKy3DTK2',  // Francisco Correa
    'WB1xkKUAsnTVo4vj2CeaLUprDaB3',  // Emanuel Cereceda
    'PUfEv6PN9mZ9tEkEfn8ZRdpb5WW2'   // Marina Soto
  ]
};

// ===== FUNCIONES AUXILIARES =====

/**
 * Intenta obtener un dueDate para documentos legacy
 */
function inferDueDate(assignment) {
  // Si ya tiene dueDate, usarlo
  if (assignment.dueDate) {
    return assignment.dueDate.toDate ? assignment.dueDate.toDate() : new Date(assignment.dueDate);
  }
  
  // Inferir desde la fecha de creación/asignación + plazo típico
  const baseDate = assignment.assignedAt || assignment.createdAt || assignment.updatedAt;
  
  if (baseDate) {
    const date = baseDate.toDate ? baseDate.toDate() : new Date(baseDate);
    const dueDate = new Date(date);
    dueDate.setDate(dueDate.getDate() + CONFIG.defaultReviewDeadlineDays);
    return dueDate;
  }
  
  return null;
}

/**
 * Intenta obtener un submittedAt para documentos legacy
 */
function inferSubmittedAt(assignment) {
  // Si ya tiene submittedAt, usarlo
  if (assignment.submittedAt) {
    return assignment.submittedAt.toDate ? assignment.submittedAt.toDate() : new Date(assignment.submittedAt);
  }
  
  // Si tiene updatedAt y está submitted, usar updatedAt
  if (assignment.status === 'submitted' && assignment.updatedAt) {
    return assignment.updatedAt.toDate ? assignment.updatedAt.toDate() : new Date(assignment.updatedAt);
  }
  
  // Último recurso: usar createdAt (aunque no es ideal)
  if (assignment.createdAt) {
    return assignment.createdAt.toDate ? assignment.createdAt.toDate() : new Date(assignment.createdAt);
  }
  
  return null;
}

/**
 * Normaliza los datos de un assignment
 */
function normalizeAssignment(ass) {
  const hasComments = !!(ass.commentsToAuthor || ass.commentsToEditor);
  const hasScores = ass.scores && typeof ass.scores === 'object' && Object.keys(ass.scores).length > 0;
  const hasRecommendation = !!ass.recommendation;
  
  // Determinar si está entregado
  const isSubmitted = ass.status === 'submitted' || 
                      !!ass.submittedAt || 
                      (hasComments && hasScores) ||
                      (hasComments && hasRecommendation);
  
  // Fechas inferidas
  const effectiveSubmittedAt = inferSubmittedAt(ass);
  const effectiveDueDate = inferDueDate(ass);
  
  // ¿A tiempo?
  let onTime = null;
  if (effectiveSubmittedAt && effectiveDueDate) {
    onTime = effectiveSubmittedAt <= effectiveDueDate;
  }
  
  // Días de anticipación/retraso
  let daysOffset = null;
  if (effectiveSubmittedAt && effectiveDueDate) {
    daysOffset = (effectiveDueDate - effectiveSubmittedAt) / (1000 * 60 * 60 * 24);
    daysOffset = parseFloat(daysOffset.toFixed(1));
    // Positivo = entregado antes del plazo, Negativo = entregado tarde
  }
  
  return {
    id: ass.id,
    status: ass.status || 'unknown',
    submittedAt: ass.submittedAt || null,
    dueDate: ass.dueDate || null,
    createdAt: ass.createdAt || ass.assignedAt || null,
    updatedAt: ass.updatedAt || null,
    effectiveSubmittedAt,
    effectiveDueDate,
    onTime,
    daysOffset,
    reviewerUid: ass.reviewerUid || null,
    reviewerEmail: ass.reviewerEmail || null,
    round: ass.round || 1,
    scores: ass.scores || {},
    recommendation: ass.recommendation || null,
    isSubmitted,
    hasComments,
    hasScores,
    hasRecommendation,
    isLegacy: ass.migrated === true || ass.submissionId?.startsWith('LEGACY-') || !ass.dueDate,
    hasRealDueDate: !!ass.dueDate,
    hasRealSubmittedAt: !!ass.submittedAt
  };
}

/**
 * Calcula el promedio de scores
 */
function calculateAverageScore(scores) {
  if (!scores || typeof scores !== 'object') return null;
  
  const values = Object.values(scores).filter(v => typeof v === 'number' && !isNaN(v));
  if (values.length === 0) return null;
  
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return parseFloat(avg.toFixed(1));
}

// ===== FUNCIÓN PRINCIPAL DE CÁLCULO =====

async function calculateReviewerStats(reviewerUid, reviewerEmail) {
  console.log(`\n📊 Calculando estadísticas para: ${reviewerUid || reviewerEmail}`);
  
  // ===== 1. OBTENER INVITACIONES =====
  const invitations = [];
  
  if (reviewerUid) {
    const byUid = await db.collection('reviewerInvitations')
      .where('reviewerUid', '==', reviewerUid)
      .get();
    byUid.forEach(doc => invitations.push({ id: doc.id, ...doc.data() }));
  }
  
  if (reviewerEmail) {
    const byEmail = await db.collection('reviewerInvitations')
      .where('reviewerEmail', '==', reviewerEmail)
      .get();
    byEmail.forEach(doc => {
      if (!invitations.find(inv => inv.id === doc.id)) {
        invitations.push({ id: doc.id, ...doc.data() });
      }
    });
  }
  
  // ===== 2. OBTENER ASSIGNMENTS =====
  const assignments = [];
  
  if (reviewerUid) {
    const byUid = await db.collection('reviewerAssignments')
      .where('reviewerUid', '==', reviewerUid)
      .get();
    byUid.forEach(doc => assignments.push({ id: doc.id, ...doc.data() }));
  }
  
  if (reviewerEmail) {
    const byEmail = await db.collection('reviewerAssignments')
      .where('reviewerEmail', '==', reviewerEmail)
      .get();
    byEmail.forEach(doc => {
      if (!assignments.find(ass => ass.id === doc.id)) {
        assignments.push({ id: doc.id, ...doc.data() });
      }
    });
  }
  
  const normalizedAssignments = assignments.map(normalizeAssignment);
  
  // ===== 3. ESTADÍSTICAS DE INVITACIONES =====
  const totalInvitations = invitations.length;
  const acceptedInvitations = invitations.filter(inv => inv.status === 'accepted').length;
  const declinedInvitations = invitations.filter(inv => inv.status === 'declined').length;
  const expiredInvitations = invitations.filter(inv => 
    inv.status === 'expired' && !inv.respondedAt
  ).length;
  
  const acceptanceRate = totalInvitations > 0
    ? Math.round((acceptedInvitations / totalInvitations) * 100)
    : 0;
  
  // Tiempo promedio de respuesta
  const responseTimes = invitations
    .filter(inv => inv.respondedAt && inv.createdAt)
    .map(inv => {
      const created = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      const responded = inv.respondedAt.toDate ? inv.respondedAt.toDate() : new Date(inv.respondedAt);
      return (responded - created) / (1000 * 60 * 60 * 24);
    })
    .filter(time => time !== null && !isNaN(time));
  
  const responseTimeAvg = responseTimes.length > 0
    ? parseFloat((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1))
    : null;
  
  // ===== 4. ESTADÍSTICAS DE REVISIONES =====
  const completedAssignments = normalizedAssignments.filter(ass => ass.isSubmitted);
  const totalReviewsCompleted = completedAssignments.length;
  
  const pendingReviews = normalizedAssignments.filter(ass => 
    ['accepted', 'in_progress', 'pending'].includes(ass.status)
  ).length;
  
  // A tiempo vs tarde (con inferencia para legacy)
  let onTimeReviews = 0;
  let lateReviews = 0;
  let unknownTimeReviews = 0;
  let inferredOnTime = 0;
  let inferredLate = 0;
  
  completedAssignments.forEach(ass => {
    if (ass.onTime === true) {
      onTimeReviews++;
      if (!ass.hasRealDueDate || !ass.hasRealSubmittedAt) {
        inferredOnTime++;
      }
    } else if (ass.onTime === false) {
      lateReviews++;
      if (!ass.hasRealDueDate || !ass.hasRealSubmittedAt) {
        inferredLate++;
      }
    } else {
      unknownTimeReviews++;
    }
  });
  
  const onTimeRate = (onTimeReviews + lateReviews) > 0
    ? Math.round((onTimeReviews / (onTimeReviews + lateReviews)) * 100)
    : 100;
  
  // Promedio de puntuaciones
  const allScores = [];
  completedAssignments
    .filter(ass => ass.scores && Object.keys(ass.scores).length > 0)
    .forEach(ass => {
      const avg = calculateAverageScore(ass.scores);
      if (avg !== null) allScores.push(avg);
    });
  
  const averageReviewScore = allScores.length > 0
    ? parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1))
    : null;
  
  // Revisiones por ronda
  const reviewsByRound = {};
  normalizedAssignments.forEach(ass => {
    const round = ass.round || 1;
    reviewsByRound[round] = (reviewsByRound[round] || 0) + 1;
  });
  
  // Recomendaciones
  const recommendations = completedAssignments
    .filter(ass => ass.recommendation)
    .map(ass => ass.recommendation);
  
  const recommendationsCount = {};
  recommendations.forEach(rec => {
    recommendationsCount[rec] = (recommendationsCount[rec] || 0) + 1;
  });
  
  // Última actividad
  const lastInvitation = invitations
    .filter(inv => inv.createdAt)
    .sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return bTime - aTime;
    })[0];
  
  const lastReview = completedAssignments
    .sort((a, b) => {
      const aTime = a.effectiveSubmittedAt || new Date(0);
      const bTime = b.effectiveSubmittedAt || new Date(0);
      return bTime - aTime;
    })[0];
  
  // ===== 5. CONSOLIDAR =====
  const stats = {
    // Invitaciones
    totalInvitations,
    acceptedInvitations,
    declinedInvitations,
    expiredInvitations,
    acceptanceRate,
    responseTimeAvgDays: responseTimeAvg,
    
    // Revisiones
    totalReviewsCompleted,
    pendingReviews,
    onTimeReviews,
    lateReviews,
    unknownTimeReviews,
    inferredOnTime,
    inferredLate,
    onTimeRate,
    averageReviewScore,
    maxScore: 5,
    
    // Recomendaciones
    recommendations: recommendationsCount,
    
    // Experiencia
    reviewsByRound,
    totalRoundsParticipated: Object.keys(reviewsByRound).length,
    
    // Actividad
    lastInvitationAt: lastInvitation?.createdAt?.toDate?.()?.toISOString() || null,
    lastReviewSubmittedAt: lastReview?.effectiveSubmittedAt?.toISOString() || null,
    
    // Metadata
    calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
    totalLegacyInvitations: invitations.filter(inv => inv.migrated || inv.submissionId?.startsWith('LEGACY-')).length,
    totalLegacyAssignments: normalizedAssignments.filter(ass => ass.isLegacy).length,
    assignmentsWithInferredDates: normalizedAssignments.filter(ass => 
      ass.isSubmitted && (!ass.hasRealDueDate || !ass.hasRealSubmittedAt)
    ).length,
    
    // Debug: breakdown de cada revisión
    reviewBreakdown: completedAssignments.map(ass => ({
      id: ass.id,
      isLegacy: ass.isLegacy,
      hasRealDueDate: ass.hasRealDueDate,
      hasRealSubmittedAt: ass.hasRealSubmittedAt,
      onTime: ass.onTime,
      daysOffset: ass.daysOffset,
      recommendation: ass.recommendation,
      scores: ass.scores
    }))
  };
  
  // Mostrar breakdown detallado
  console.log(`   📧 Invitaciones: ${stats.totalInvitations} total | ${stats.acceptedInvitations} aceptadas | ${stats.acceptanceRate}% aceptación`);
  console.log(`   📝 Revisiones completadas: ${stats.totalReviewsCompleted}`);
  
  if (stats.totalReviewsCompleted > 0) {
    console.log(`      ✅ A tiempo: ${stats.onTimeReviews} (${stats.inferredOnTime > 0 ? stats.inferredOnTime + ' inferidas' : 'fechas reales'})`);
    console.log(`      ❌ Tardías: ${stats.lateReviews} (${stats.inferredLate > 0 ? stats.inferredLate + ' inferidas' : 'fechas reales'})`);
    console.log(`      ❓ Sin datos: ${stats.unknownTimeReviews}`);
    console.log(`      📊 % A tiempo: ${stats.onTimeRate}%`);
    console.log(`      ⭐ Score prom: ${stats.averageReviewScore || 'N/A'}`);
    
    // Mostrar breakdown individual
    console.log(`      Breakdown:`);
    stats.reviewBreakdown.forEach((rev, i) => {
      const status = rev.onTime === true ? '✅' : rev.onTime === false ? '❌' : '❓';
      const offset = rev.daysOffset !== null ? `(${rev.daysOffset > 0 ? '+' : ''}${rev.daysOffset}d)` : '';
      const legacy = rev.isLegacy ? '📦' : '🆕';
      const score = rev.scores && Object.keys(rev.scores).length > 0 
        ? `⭐${calculateAverageScore(rev.scores)}` 
        : 'sin score';
      console.log(`         ${i+1}. ${status} ${legacy} ${rev.recommendation || 'sin rec'} | ${score} ${offset}`);
    });
  }
  
  console.log(`   ⏱️  Tiempo resp: ${stats.responseTimeAvgDays ? stats.responseTimeAvgDays + ' días' : 'N/A'}`);
  
  if (stats.totalLegacyInvitations > 0 || stats.totalLegacyAssignments > 0) {
    console.log(`   📦 Legacy: ${stats.totalLegacyInvitations} invitaciones, ${stats.totalLegacyAssignments} assignments`);
  }
  if (stats.assignmentsWithInferredDates > 0) {
    console.log(`   🔍 Fechas inferidas para ${stats.assignmentsWithInferredDates} revisiones`);
  }
  
  return stats;
}

// ===== FUNCIÓN PARA ACTUALIZAR PERFIL =====

async function updateReviewerProfile(reviewerId, stats, reviewerData) {
  const reviewerRef = db.collection('reviewers').doc(reviewerId);
  const reviewerDoc = await reviewerRef.get();
  
  const updateData = {
    stats,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    statsRecalculatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  if (!reviewerDoc.exists) {
    updateData.uid = reviewerId;
    updateData.email = reviewerData.email || '';
    updateData.displayName = reviewerData.displayName || '';
    updateData.status = 'active';
    updateData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    console.log(`   ℹ️  Creando nuevo perfil`);
  }
  
  if (!CONFIG.dryRun) {
    await reviewerRef.set(updateData, { merge: true });
  }
}

// ===== FUNCIÓN PRINCIPAL =====

async function recalculateAllReviewers() {
  console.log('🔧 REPROCESANDO ESTADÍSTICAS DE REVISORES (v2 - con inferencia de fechas)');
  console.log('═'.repeat(60));
  console.log(`Modo: ${CONFIG.dryRun ? 'DRY RUN' : 'REAL'}`);
  console.log(`Plazo típico inferido: ${CONFIG.defaultReviewDeadlineDays} días`);
  console.log(`Inicio: ${new Date().toISOString()}`);
  
  // ===== 1. OBTENER REVISORES =====
  const reviewersMap = new Map();
  
  const reviewersSnapshot = await db.collection('reviewers').get();
  reviewersSnapshot.forEach(doc => {
    const data = doc.data();
    const uid = data.uid || doc.id;
    if (!reviewersMap.has(uid)) {
      reviewersMap.set(uid, {
        id: doc.id,
        uid,
        email: data.email || '',
        displayName: data.displayName || data.firstName || '',
        exists: true
      });
    }
  });
  
  // Buscar en invitations
  const invitationsUids = await db.collection('reviewerInvitations')
    .select('reviewerUid', 'reviewerEmail', 'reviewerName')
    .get();
  
  invitationsUids.forEach(doc => {
    const data = doc.data();
    const uid = data.reviewerUid;
    if (uid && !reviewersMap.has(uid)) {
      reviewersMap.set(uid, {
        id: uid,
        uid,
        email: data.reviewerEmail || '',
        displayName: data.reviewerName || '',
        exists: false
      });
    }
  });
  
  // Buscar en assignments
  const assignmentsUids = await db.collection('reviewerAssignments')
    .select('reviewerUid', 'reviewerEmail', 'reviewerName')
    .get();
  
  assignmentsUids.forEach(doc => {
    const data = doc.data();
    const uid = data.reviewerUid;
    if (uid && !reviewersMap.has(uid)) {
      reviewersMap.set(uid, {
        id: uid,
        uid,
        email: data.reviewerEmail || '',
        displayName: data.reviewerName || '',
        exists: false
      });
    }
  });
  
  console.log(`\n📊 Total revisores: ${reviewersMap.size}`);
  
  // ===== 2. FILTRAR SI TEST =====
  let reviewersToProcess = Array.from(reviewersMap.values());
  
  if (CONFIG.testMode) {
    reviewersToProcess = reviewersToProcess.filter(r => 
      CONFIG.testReviewerUids.includes(r.uid)
    );
    console.log(`⚠️  MODO TEST: ${reviewersToProcess.length} revisores`);
  }
  
  // ===== 3. PROCESAR =====
  const results = { processed: 0, updated: 0, created: 0, skipped: 0, errors: [] };
  
  for (const reviewer of reviewersToProcess) {
    try {
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`👤 ${reviewer.displayName || reviewer.uid}`);
      
      const stats = await calculateReviewerStats(reviewer.uid, reviewer.email);
      
      if (!CONFIG.dryRun) {
        await updateReviewerProfile(reviewer.id, stats, reviewer);
        if (reviewer.exists) results.updated++;
        else results.created++;
      }
      
      results.processed++;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.errors.push({ reviewer: reviewer.uid, error: error.message });
      results.skipped++;
    }
  }
  
  // ===== 4. RESULTADOS =====
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESULTADOS');
  console.log('═'.repeat(60));
  console.log(`Procesados: ${results.processed}`);
  console.log(`Actualizados: ${results.updated}`);
  console.log(`Creados: ${results.created}`);
  console.log(`Errores: ${results.skipped}`);
  
  if (CONFIG.dryRun) {
    console.log('\n⚠️  DRY RUN');
  }
}

// ===== EJECUTAR =====
recalculateAllReviewers()
  .then(() => {
    console.log('\n✨ Completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });