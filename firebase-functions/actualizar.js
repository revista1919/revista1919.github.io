// fix-submissions-status-accepted.js
const admin = require('firebase-admin');

// Inicializa Firebase Admin con tu service account
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Lista de exclusiones
const EXCLUDED_SUBMISSIONS = [
  'LEGACY-1771278766444-U2VJ64E1Z',
  'LEGACY-1771278761416-G0OEX97YY',
  'LEGACY-1771278766063-1HPE7HW2Y'
];

async function fixSubmissionsStatus() {
  console.log('🚀 Iniciando actualización de status en submissions...');
  console.log('============================================================');
  console.log(`📌 Submissions EXCLUIDOS: ${EXCLUDED_SUBMISSIONS.join(', ')}`);
  
  try {
    // Obtener todos los submissions migrados
    const submissionsRef = db.collection('submissions');
    const snapshot = await submissionsRef
      .where('migrated', '==', true)
      .get();
    
    console.log(`\n📋 Total submissions migradas encontradas: ${snapshot.size}`);
    
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalExcluded = 0;
    let totalAlreadyAccepted = 0;
    let totalSkippedNoSubmissionId = 0;
    let totalErrors = 0;
    
    // Para el resumen final
    const updatedList = [];
    const excludedList = [];
    const alreadyAcceptedList = [];
    const errorList = [];
    
    for (const doc of snapshot.docs) {
      totalProcessed++;
      const data = doc.data();
      const docId = doc.id;
      const submissionId = data.submissionId || docId;
      
      // Verificar si está en la lista de exclusiones
      if (EXCLUDED_SUBMISSIONS.includes(submissionId) || EXCLUDED_SUBMISSIONS.includes(docId)) {
        totalExcluded++;
        excludedList.push({
          docId,
          submissionId,
          currentStatus: data.status || 'unknown',
          reason: 'En lista de exclusión'
        });
        console.log(`⏭️ EXCLUIDO: ${submissionId} (doc: ${docId}) - status actual: ${data.status || 'unknown'}`);
        continue;
      }
      
      // Verificar si no tiene submissionId
      if (!data.submissionId) {
        totalSkippedNoSubmissionId++;
        console.log(`⚠️ SIN submissionId: ${docId} - saltando...`);
        continue;
      }
      
      // Verificar si ya está en "accepted"
      if (data.status === 'accepted') {
        totalAlreadyAccepted++;
        alreadyAcceptedList.push({
          docId,
          submissionId,
          currentStatus: data.status
        });
        console.log(`✅ Ya aceptado: ${submissionId} (doc: ${docId})`);
        continue;
      }
      
      // Actualizar a "accepted"
      try {
        const updateData = {
          status: 'accepted',
          acceptedAt: data.decisionMadeAt || data.publicationReadyAt || admin.firestore.FieldValue.serverTimestamp(),
          acceptedBy: 'migration-script',
          previousStatus: data.status || 'unknown',
          statusFixedAt: admin.firestore.FieldValue.serverTimestamp(),
          statusFixedBy: 'migration-script'
        };
        
        // Si ya tiene finalDecision, mantenerlo; si no, establecer "accept"
        if (!data.finalDecision) {
          updateData.finalDecision = 'accept';
        }
        
        await doc.ref.update(updateData);
        
        totalUpdated++;
        updatedList.push({
          docId,
          submissionId,
          title: data.title?.substring(0, 50) || 'Sin título',
          previousStatus: data.status || 'unknown',
          newStatus: 'accepted'
        });
        
        console.log(`🔄 ACTUALIZADO: ${submissionId} | "${data.title?.substring(0, 40) || 'Sin título'}..." | ${data.status || 'unknown'} → accepted`);
        
      } catch (error) {
        totalErrors++;
        errorList.push({
          docId,
          submissionId,
          error: error.message
        });
        console.error(`❌ ERROR: ${submissionId} - ${error.message}`);
      }
    }
    
    // ============================================================
    // RESUMEN DETALLADO
    // ============================================================
    console.log('\n\n📊 RESUMEN FINAL');
    console.log('============================================================');
    console.log(`📄 Total submissions procesadas: ${totalProcessed}`);
    console.log(`✅ Actualizadas a "accepted": ${totalUpdated}`);
    console.log(`⏭️ Excluidas (no modificadas): ${totalExcluded}`);
    console.log(`✔️ Ya estaban en "accepted": ${totalAlreadyAccepted}`);
    console.log(`⚠️ Sin submissionId: ${totalSkippedNoSubmissionId}`);
    console.log(`❌ Errores: ${totalErrors}`);
    
    // Mostrar lista de actualizadas
    if (updatedList.length > 0) {
      console.log('\n📝 SUBMISSIONS ACTUALIZADAS:');
      console.log('─'.repeat(70));
      updatedList.forEach((item, index) => {
        console.log(`${index + 1}. ${item.submissionId}`);
        console.log(`   Título: "${item.title}"`);
        console.log(`   Status: ${item.previousStatus} → ${item.newStatus}`);
      });
    }
    
    // Mostrar lista de excluidas
    if (excludedList.length > 0) {
      console.log('\n🚫 SUBMISSIONS EXCLUIDAS (NO MODIFICADAS):');
      console.log('─'.repeat(70));
      excludedList.forEach((item, index) => {
        console.log(`${index + 1}. ${item.submissionId}`);
        console.log(`   Doc ID: ${item.docId}`);
        console.log(`   Status actual: ${item.currentStatus}`);
        console.log(`   Razón: ${item.reason}`);
      });
    }
    
    // Mostrar errores si hubo
    if (errorList.length > 0) {
      console.log('\n❌ ERRORES:');
      console.log('─'.repeat(70));
      errorList.forEach((item, index) => {
        console.log(`${index + 1}. ${item.submissionId} - ${item.error}`);
      });
    }
    
    // ============================================================
    // VERIFICACIÓN FINAL
    // ============================================================
    console.log('\n\n🔍 VERIFICACIÓN FINAL:');
    console.log('============================================================');
    
    // Contar submissions migradas que NO están en "accepted"
    const notAcceptedSnapshot = await submissionsRef
      .where('migrated', '==', true)
      .where('status', '!=', 'accepted')
      .get();
    
    if (!notAcceptedSnapshot.empty) {
      console.log(`\n⚠️ ${notAcceptedSnapshot.size} submissions migradas aún NO están en "accepted":`);
      
      for (const doc of notAcceptedSnapshot.docs) {
        const data = doc.data();
        const submissionId = data.submissionId || doc.id;
        
        // Verificar si está en exclusiones
        const isExcluded = EXCLUDED_SUBMISSIONS.includes(submissionId) || 
                          EXCLUDED_SUBMISSIONS.includes(doc.id);
        
        console.log(`   - ${submissionId}: status="${data.status}" ${isExcluded ? '(EXCLUIDO - CORRECTO)' : '(⚠️ REVISAR)'}`);
      }
    } else {
      console.log('✅ Todas las submissions migradas (no excluidas) están en "accepted"');
    }
    
    // Estadísticas adicionales
    const statsSnapshot = await submissionsRef
      .where('migrated', '==', true)
      .get();
    
    const statusCount = {};
    statsSnapshot.forEach(doc => {
      const status = doc.data().status || 'unknown';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    
    console.log('\n📊 DISTRIBUCIÓN DE STATUS EN MIGRADAS:');
    Object.entries(statusCount).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    
    console.log('\n✨ SCRIPT COMPLETADO EXITOSAMENTE');
    
  } catch (error) {
    console.error('\n❌ ERROR GENERAL:', error);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Ejecutar
fixSubmissionsStatus();