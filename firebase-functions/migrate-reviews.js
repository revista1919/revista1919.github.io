// migrate-reviews-final-v2.js - Ejecutar LOCALMENTE con Node.js
const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Configurar Firestore para ignorar undefined
db.settings({ ignoreUndefinedProperties: true });

// ==================== FUNCIONES UTILITARIAS ====================

function normalizeTitle(title) {
  if (!title) return '';
  return title
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Decodificar base64 con validación
function decodeBase64(base64String) {
  if (!base64String) return '';
  try {
    const clean = base64String.replace(/\s/g, '');
    const buffer = Buffer.from(clean, 'base64');
    const decoded = buffer.toString('utf-8');
    
    // Verificar si es texto válido (contiene letras/palabras)
    if (decoded && /[a-zA-Z\u00C0-\u00FF]{3,}/.test(decoded)) {
      return decoded;
    }
    return '';
  } catch (e) {
    return '';
  }
}

function mapVotoToRecommendation(voto) {
  if (!voto) return null;
  const votoStr = voto.toString().toLowerCase().trim();
  if (votoStr === 'si' || votoStr === 'aceptar' || votoStr === 'accept') return 'accept';
  if (votoStr === 'no' || votoStr === 'rechazar' || votoStr === 'reject') return 'reject';
  if (votoStr === 'revision' || votoStr === 'revisions') return 'major-revisions';
  return null;
}

function mapEstadoToSubmissionStatus(estado) {
  if (!estado) return 'submitted';
  const estadoLower = estado.toString().toLowerCase();
  if (estadoLower.includes('aceptado')) return 'accepted';
  if (estadoLower.includes('rechaz')) return 'rejected';
  if (estadoLower.includes('revis')) return 'in-review';
  return 'submitted';
}

function getDefaultScores() {
  return {
    relevance: 1,
    methodology: 1,
    clarity: 1,
    originality: 1
  };
}

function generateInviteHash() {
  const array = new Uint8Array(20);
  require('crypto').randomFillSync(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== FUNCIONES DE BÚSQUEDA ====================

async function findUserByName(name) {
  if (!name || name.trim() === '') return null;
  
  try {
    const searchName = name.trim().toLowerCase();
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    let foundUser = null;
    let bestMatch = 0;
    
    snapshot.forEach(doc => {
      const userData = doc.data();
      const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim().toLowerCase();
      const displayName = (userData.displayName || '').toLowerCase();
      
      if (fullName === searchName || displayName === searchName) {
        foundUser = { id: doc.id, ...userData };
        bestMatch = 100;
        return;
      }
      
      if (fullName.includes(searchName) || searchName.includes(fullName)) {
        const matchLength = Math.min(fullName.length, searchName.length);
        if (matchLength > bestMatch) {
          bestMatch = matchLength;
          foundUser = { id: doc.id, ...userData };
        }
      }
    });
    
    return foundUser;
  } catch (error) {
    return null;
  }
}

async function findSubmissionByTitle(title) {
  if (!title || title.trim() === '') return null;
  
  try {
    const normalizedTitle = normalizeTitle(title);
    const submissionsRef = db.collection('submissions');
    const snapshot = await submissionsRef.get();
    
    let foundSubmission = null;
    let bestMatch = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const submissionTitle = data.title || '';
      const normalizedSubmission = normalizeTitle(submissionTitle);
      
      if (normalizedSubmission === normalizedTitle) {
        foundSubmission = { id: doc.id, ...data };
        bestMatch = 100;
        return;
      }
      
      if (normalizedSubmission.includes(normalizedTitle) || normalizedTitle.includes(normalizedSubmission)) {
        const matchLength = Math.min(normalizedSubmission.length, normalizedTitle.length);
        if (matchLength > bestMatch) {
          bestMatch = matchLength;
          foundSubmission = { id: doc.id, ...data };
        }
      }
    });
    
    return foundSubmission;
  } catch (error) {
    return null;
  }
}

// ==================== MIGRACIÓN PRINCIPAL ====================

async function migrate() {
  console.log('🚀 Iniciando migración COMPLETA (v2)...\n');
  
  const stats = {
    total: 0,
    submissionsEncontradas: 0,
    editorialTasksCreadas: 0,
    editorialReviewsCreadas: 0,
    reviewerInvitationsCreadas: 0,
    reviewerAssignmentsCreadas: 0,
    completos: 0,
    incompletos: 0
  };
  
  const errors = [];
  const results = [];
  
  // Leer CSV
  const csvData = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream('revisiones.csv')
      .pipe(csv({ separator: ',' }))
      .on('data', (row) => csvData.push(row))
      .on('end', resolve)
      .on('error', reject);
  });
  
  console.log(`📊 CSV cargado: ${csvData.length} filas\n`);
  
  for (let i = 0; i < csvData.length; i++) {
    const row = csvData[i];
    const title = row['Nombre Artículo'] || row['nombreArticulo'] || '';
    
    if (!title || title.trim() === '') {
      console.log(`\n[${i + 1}/${csvData.length}] ⏭️ Saltando fila sin título`);
      continue;
    }
    
    console.log(`\n[${i + 1}/${csvData.length}] Procesando: "${title.substring(0, 60)}..."`);
    stats.total++;
    
    try {
      // 1. Buscar submission
      const submission = await findSubmissionByTitle(title);
      if (!submission) {
        errors.push({ title, error: 'Submission no encontrado' });
        continue;
      }
      stats.submissionsEncontradas++;
      
      // 2. Buscar usuarios
      const reviewer1User = await findUserByName(row['Revisor 1']);
      const reviewer2User = await findUserByName(row['Revisor 2']);
      const editorUser = await findUserByName(row['Editor']);
      
      // 3. Decodificar feedbacks
      const feedback1 = decodeBase64(row['Feedback 1']);
      const feedback2 = decodeBase64(row['Feedback 2']);
      const feedback3 = decodeBase64(row['Feedback 3']);
      
      const informe1 = decodeBase64(row['Informe 1']);
      const informe2 = decodeBase64(row['Informe 2']);
      const informe3 = decodeBase64(row['Informe 3']);
      
      // 4. Verificar si hay feedback válido
      const hasFeedback1 = feedback1 && feedback1.length > 20;
      const hasFeedback2 = feedback2 && feedback2.length > 20;
      const hasFeedback3 = feedback3 && feedback3.length > 20;
      
      const hasInforme1 = informe1 && informe1.length > 20;
      const hasInforme2 = informe2 && informe2.length > 20;
      const hasInforme3 = informe3 && informe3.length > 20;
      
      // 5. Obtener votos (pueden estar vacíos)
      const voto1 = row['Voto 1'] || null;
      const voto2 = row['Voto 2'] || null;
      const voto3 = row['Voto 3'] || null;
      const estado = row['estado'] || null;
      
      // 6. Determinar si está completo (tiene feedback del editor)
      const isComplete = hasFeedback3 || hasInforme3;
      if (isComplete) {
        stats.completos++;
      } else {
        stats.incompletos++;
      }
      
      // 7. Preparar batch
      const batch = db.batch();
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      
      // Variables para referencias cruzadas
      let editorialTaskId = null;
      let editorialReviewId = null;
      
      // ===== CREAR EDITORIAL TASK (siempre) =====
      if (editorUser) {
        editorialTaskId = `LEGACY-${submission.id}-TASK-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const taskRef = db.collection('editorialTasks').doc(editorialTaskId);
        
        // Determinar estado de la tarea
        let taskStatus = 'pending';
        if (isComplete) {
          taskStatus = 'completed';
        } else if (hasFeedback1 || hasFeedback2) {
          taskStatus = 'awaiting-decision';
        }
        
        const taskData = {
          submissionId: submission.id,
          submissionTitle: submission.title,
          round: 1,
          assignedTo: editorUser.id,
          assignedToEmail: editorUser.email || '',
          assignedToName: `${editorUser.firstName || ''} ${editorUser.lastName || ''}`.trim() || row['Editor'],
          assignedBy: 'system-migration',
          assignedByName: 'Sistema de Migración',
          status: taskStatus,
          requiredReviewers: 2,
          reviewsSubmitted: (hasFeedback1 ? 1 : 0) + (hasFeedback2 ? 1 : 0),
          createdAt: timestamp,
          updatedAt: timestamp,
          legacy: true
        };
        
        // Solo añadir legacyData si hay datos
        if (voto3 || estado) {
          taskData.legacyData = {};
          if (voto3) taskData.legacyData.voto3 = voto3;
          if (estado) taskData.legacyData.estadoOriginal = estado;
        }
        
        batch.set(taskRef, taskData);
        stats.editorialTasksCreadas++;
        
        // ===== CREAR EDITORIAL REVIEW (si hay decisión) =====
        if (isComplete) {
          editorialReviewId = `LEGACY-${submission.id}-REVIEW-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const reviewRef = db.collection('editorialReviews').doc(editorialReviewId);
          
          // Determinar decisión
          let decision = 'revision-required';
          if (voto3 === 'si' || estado?.toLowerCase().includes('aceptado')) {
            decision = 'accept';
          } else if (voto3 === 'no' || estado?.toLowerCase().includes('rechaz')) {
            decision = 'reject';
          }
          
          const reviewData = {
            submissionId: submission.id,
            submissionTitle: submission.title,
            editorialTaskId: editorialTaskId,
            editorUid: editorUser.id,
            editorEmail: editorUser.email || '',
            editorName: `${editorUser.firstName || ''} ${editorUser.lastName || ''}`.trim() || row['Editor'],
            round: 1,
            decision: decision,
            feedbackToAuthor: hasFeedback3 ? feedback3 : '',
            commentsToEditorial: hasInforme3 ? informe3 : '',
            status: 'completed',
            createdAt: timestamp,
            completedAt: timestamp,
            legacy: true
          };
          
          batch.set(reviewRef, reviewData);
          stats.editorialReviewsCreadas++;
        }
      }
      
      // ===== CREAR REVIEWER INVITATIONS Y ASSIGNMENTS =====
      const createReviewerRecords = async (reviewerUser, reviewerNum, voto, feedback, informe, hasFeedback, hasInforme) => {
        if (!reviewerUser) return null;
        
        // Solo crear si hay algún dato
        if (!hasFeedback && !hasInforme && !voto) return null;
        
        const inviteHash = generateInviteHash();
        const invitationId = `LEGACY-${submission.id}-INV-${reviewerNum}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const invitationRef = db.collection('reviewerInvitations').doc(invitationId);
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        const invitationData = {
          editorialTaskId: editorialTaskId,
          submissionId: submission.id,
          round: 1,
          reviewerEmail: reviewerUser.email || '',
          reviewerName: `${reviewerUser.firstName || ''} ${reviewerUser.lastName || ''}`.trim() || row[`Revisor ${reviewerNum}`],
          reviewerUid: reviewerUser.id,
          inviteHash: inviteHash,
          status: hasFeedback || hasInforme ? 'accepted' : 'pending',
          conflictOfInterest: null,
          expiresAt: expiresAt,
          createdAt: timestamp,
          invitedBy: editorUser?.id || 'system-migration',
          invitedByEmail: editorUser?.email || 'system@migration',
          legacy: true
        };
        
        batch.set(invitationRef, invitationData);
        stats.reviewerInvitationsCreadas++;
        
        // Crear assignment (solo si hay feedback)
        if (hasFeedback || hasInforme) {
          const assignmentId = `LEGACY-${submission.id}-ASSIGN-${reviewerNum}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const assignmentRef = db.collection('reviewerAssignments').doc(assignmentId);
          
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 21);
          
          const assignmentData = {
            submissionId: submission.id,
            submissionTitle: submission.title,
            editorialTaskId: editorialTaskId,
            editorialReviewId: editorialReviewId,
            round: 1,
            reviewerUid: reviewerUser.id,
            reviewerEmail: reviewerUser.email || '',
            reviewerName: `${reviewerUser.firstName || ''} ${reviewerUser.lastName || ''}`.trim() || row[`Revisor ${reviewerNum}`],
            invitationId: invitationId,
            status: 'submitted',
            scores: getDefaultScores(),
            recommendation: mapVotoToRecommendation(voto) || 'major-revisions',
            commentsToAuthor: hasFeedback ? feedback : '',
            commentsToEditor: hasInforme ? informe : '',
            assignedAt: timestamp,
            dueDate: dueDate,
            submittedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
            legacy: true
          };
          
          // Solo añadir legacyData si hay voto
          if (voto) {
            assignmentData.legacyData = { voto };
          }
          
          batch.set(assignmentRef, assignmentData);
          stats.reviewerAssignmentsCreadas++;
        }
      };
      
      if (reviewer1User) {
        await createReviewerRecords(reviewer1User, 1, voto1, feedback1, informe1, hasFeedback1, hasInforme1);
      }
      
      if (reviewer2User) {
        await createReviewerRecords(reviewer2User, 2, voto2, feedback2, informe2, hasFeedback2, hasInforme2);
      }
      
      // ===== ACTUALIZAR SUBMISSION =====
      const submissionRef = db.collection('submissions').doc(submission.id);
      const submissionUpdate = {
        legacyReviewMigrated: true,
        updatedAt: timestamp
      };
      
      if (editorialTaskId) {
        submissionUpdate.currentEditorialTaskId = editorialTaskId;
        
        if (isComplete && editorialReviewId) {
          submissionUpdate.status = mapEstadoToSubmissionStatus(estado);
          submissionUpdate.deskReviewDecision = mapVotoToRecommendation(voto3) || 'revision-required';
          submissionUpdate.deskReviewFeedback = hasFeedback3 ? feedback3 : '';
          submissionUpdate.deskReviewCompletedAt = timestamp;
          submissionUpdate.currentEditorialReviewId = editorialReviewId;
        }
      }
      
      batch.update(submissionRef, submissionUpdate);
      
      // ===== EJECUTAR BATCH =====
      await batch.commit();
      
      results.push({
        title: title.substring(0, 50),
        submissionId: submission.id,
        editorialTaskId,
        editorialReviewId,
        reviewer1: !!reviewer1User && (hasFeedback1 || hasInforme1),
        reviewer2: !!reviewer2User && (hasFeedback2 || hasInforme2),
        complete: isComplete
      });
      
      console.log(`  ✅ OK | Task:✓ Review:${editorialReviewId ? '✓' : '✗'} | R1:${hasFeedback1 ? '✓' : '✗'} R2:${hasFeedback2 ? '✓' : '✗'}`);
      
      // Pequeña pausa
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
      errors.push({ title, error: error.message });
    }
  }
  
  // ===== RESUMEN FINAL =====
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('='.repeat(60));
  console.log(`Total filas en CSV: ${csvData.length}`);
  console.log(`Submissions encontradas: ${stats.submissionsEncontradas}`);
  console.log(`\n📋 ESTRUCTURA CREADA:`);
  console.log(`  Editorial Tasks: ${stats.editorialTasksCreadas}`);
  console.log(`  Editorial Reviews: ${stats.editorialReviewsCreadas}`);
  console.log(`  Reviewer Invitations: ${stats.reviewerInvitationsCreadas}`);
  console.log(`  Reviewer Assignments: ${stats.reviewerAssignmentsCreadas}`);
  console.log(`\n✅ Artículos completos (con decisión): ${stats.completos}`);
  console.log(`🔄 Artículos en proceso: ${stats.incompletos}`);
  console.log(`❌ Errores: ${errors.length}`);
  
  // Guardar resultados
  fs.writeFileSync(
    'migration-results-final-v2.json', 
    JSON.stringify({ results, errors, stats, timestamp: new Date().toISOString() }, null, 2)
  );
  
  console.log('\n✅ Resultados guardados en migration-results-final-v2.json');
}

// Ejecutar
migrate().catch(console.error);