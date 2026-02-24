// fix-submission.js
// Script para corregir el estado del submission SUB-1771901247823-E3FWE7COI
// Ejecutar con: node fix-submission.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Descarga esto de Firebase Console

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixSubmission() {
  const submissionId = 'SUB-1771901247823-E3FWE7COI';
  
  console.log(`🔧 Iniciando corrección para submission: ${submissionId}`);
  
  try {
    // 1. Obtener datos actuales
    const submissionRef = db.collection('submissions').doc(submissionId);
    const submissionSnap = await submissionRef.get();
    
    if (!submissionSnap.exists) {
      console.error('❌ Submission no encontrado');
      return;
    }
    
    const submission = submissionSnap.data();
    console.log('📄 Estado actual:', {
      currentRound: submission.currentRound,
      status: submission.status,
      currentEditorialTaskId: submission.currentEditorialTaskId,
      currentEditorialReviewId: submission.currentEditorialReviewId
    });

    // 2. Identificar la tarea correcta (Ronda 1, la que debería estar en awaiting-author-revision)
    const tasksSnapshot = await db.collection('editorialTasks')
      .where('submissionId', '==', submissionId)
      .orderBy('createdAt', 'asc')
      .get();

    let ronda1Task = null;
    let ronda3Task = null;

    tasksSnapshot.forEach(doc => {
      const task = { id: doc.id, ...doc.data() };
      if (task.round === 1) {
        ronda1Task = task;
        console.log('✅ Tarea Ronda 1 encontrada:', task.id);
      } else if (task.round === 3 && task.status === 'in-progress') {
        ronda3Task = { id: doc.id, ...doc.data() };
        console.log('⚠️ Tarea Ronda 3 huérfana encontrada:', task.id);
      }
    });

    if (!ronda1Task) {
      console.error('❌ No se encontró tarea de Ronda 1');
      return;
    }

    // 3. Identificar revisiones editoriales
    const reviewsSnapshot = await db.collection('editorialReviews')
      .where('submissionId', '==', submissionId)
      .orderBy('createdAt', 'asc')
      .get();

    let ronda1Review = null;
    let ronda3Review = null;

    reviewsSnapshot.forEach(doc => {
      const review = { id: doc.id, ...doc.data() };
      if (review.round === 1) {
        ronda1Review = review;
        console.log('✅ Review Ronda 1 encontrada:', review.id);
      } else if (review.round === 3) {
        ronda3Review = { id: doc.id, ...doc.data() };
        console.log('⚠️ Review Ronda 3 huérfana encontrada:', review.id);
      }
    });

    // 4. BACKUP - Guardar datos actuales antes de modificar
    const backupData = {
      submission: { id: submissionId, ...submission },
      tasks: tasksSnapshot.docs.map(d => ({ id: d.id, ...d.data() })),
      reviews: reviewsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    };
    
    const backupRef = db.collection('backups').doc(`fix-${Date.now()}`);
    await backupRef.set({
      ...backupData,
      fixedAt: admin.firestore.FieldValue.serverTimestamp(),
      fixedBy: 'script'
    });
    console.log('💾 Backup guardado en:', backupRef.id);

    // 5. USAR TRANSACCIÓN PARA APLICAR CAMBIOS
    await db.runTransaction(async (transaction) => {
      
      // 5.1 Restaurar tarea de Ronda 1
      const task1Ref = db.collection('editorialTasks').doc(ronda1Task.id);
      transaction.update(task1Ref, {
        status: 'awaiting-author-revision',  // Estado correcto
        round: 1,
        // Limpiar campos de ronda completada si existen
        deskReviewCompletedAt: admin.firestore.FieldValue.delete(),
        deskReviewDecision: admin.firestore.FieldValue.delete(),
        deskReviewFeedback: admin.firestore.FieldValue.delete(),
        deskReviewComments: admin.firestore.FieldValue.delete(),
        // Restaurar el editorialReviewId original si existe
        editorialReviewId: ronda1Review?.id || ronda1Task.editorialReviewId,
        // Asegurar que no apunte a la review equivocada
        currentReviewId: ronda1Review?.id || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 5.2 Si existe una review de Ronda 1, restaurarla a 'pending'
      if (ronda1Review) {
        const review1Ref = db.collection('editorialReviews').doc(ronda1Review.id);
        transaction.update(review1Ref, {
          status: 'pending',
          decision: null,
          feedbackToAuthor: null,
          commentsToEditorial: null,
          completedAt: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // 5.3 Si existe tarea de Ronda 3, eliminarla
      if (ronda3Task) {
        const task3Ref = db.collection('editorialTasks').doc(ronda3Task.id);
        transaction.delete(task3Ref);
        console.log('🗑️ Tarea Ronda 3 marcada para eliminación');
      }

      // 5.4 Si existe review de Ronda 3, eliminarla
      if (ronda3Review) {
        const review3Ref = db.collection('editorialReviews').doc(ronda3Review.id);
        transaction.delete(review3Ref);
        console.log('🗑️ Review Ronda 3 marcada para eliminación');
      }

      // 5.5 Restaurar el submission
      transaction.update(submissionRef, {
        currentRound: 1,
        status: 'revisions-requested',  // Estado en que estaba antes
        currentEditorialTaskId: ronda1Task.id,
        currentEditorialReviewId: ronda1Review?.id || null,
        // Eliminar campos de decisión de la Ronda 3 si existen
        deskReviewDecision: admin.firestore.FieldValue.delete(),
        deskReviewFeedback: admin.firestore.FieldValue.delete(),
        deskReviewCompletedAt: admin.firestore.FieldValue.delete(),
        finalDecision: admin.firestore.FieldValue.delete(),
        finalFeedback: admin.firestore.FieldValue.delete(),
        decisionMadeAt: admin.firestore.FieldValue.delete(),
        decisionMadeBy: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('✍️ Transacción preparada');
    });

    console.log('✅ ¡Corrección aplicada exitosamente!');

    // 6. Verificar estado final
    const finalSubmission = await submissionRef.get();
    const finalTasks = await db.collection('editorialTasks')
      .where('submissionId', '==', submissionId)
      .get();
    
    console.log('\n📊 Estado final:');
    console.log('Submission:', {
      round: finalSubmission.data().currentRound,
      status: finalSubmission.data().status,
      taskId: finalSubmission.data().currentEditorialTaskId
    });
    
    console.log('Tareas activas:');
    finalTasks.forEach(doc => {
      const task = doc.data();
      console.log(`  - ${doc.id}: Ronda ${task.round}, Estado: ${task.status}`);
    });

    console.log('\n🎉 El proceso está restaurado. El autor puede volver a subir la revisión.');

  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// Ejecutar
fixSubmission();