// migrate-reviews-rollback.js - Ejecutar LOCALMENTE con Node.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function rollback() {
  console.log('🧹 Iniciando reversión de migración...\n');

  const stats = {
    editorialTasks: 0,
    editorialReviews: 0,
    reviewerInvitations: 0,
    reviewerAssignments: 0,
    submissionsActualizadas: 0
  };

  // 1. Eliminar editorialTasks con flag legacy
  console.log('Eliminando editorialTasks legacy...');
  const tasksSnapshot = await db.collection('editorialTasks')
    .where('legacy', '==', true)
    .get();
  
  const taskBatch = db.batch();
  tasksSnapshot.forEach(doc => {
    taskBatch.delete(doc.ref);
    stats.editorialTasks++;
  });
  if (tasksSnapshot.size > 0) await taskBatch.commit();
  console.log(`  ✅ ${stats.editorialTasks} tasks eliminadas`);

  // 2. Eliminar editorialReviews con flag legacy
  console.log('\nEliminando editorialReviews legacy...');
  const reviewsSnapshot = await db.collection('editorialReviews')
    .where('legacy', '==', true)
    .get();
  
  const reviewBatch = db.batch();
  reviewsSnapshot.forEach(doc => {
    reviewBatch.delete(doc.ref);
    stats.editorialReviews++;
  });
  if (reviewsSnapshot.size > 0) await reviewBatch.commit();
  console.log(`  ✅ ${stats.editorialReviews} reviews eliminadas`);

  // 3. Eliminar reviewerInvitations con flag legacy
  console.log('\nEliminando reviewerInvitations legacy...');
  const invitesSnapshot = await db.collection('reviewerInvitations')
    .where('legacy', '==', true)
    .get();
  
  const inviteBatch = db.batch();
  invitesSnapshot.forEach(doc => {
    inviteBatch.delete(doc.ref);
    stats.reviewerInvitations++;
  });
  if (invitesSnapshot.size > 0) await inviteBatch.commit();
  console.log(`  ✅ ${stats.reviewerInvitations} invitaciones eliminadas`);

  // 4. Eliminar reviewerAssignments con flag legacy
  console.log('\nEliminando reviewerAssignments legacy...');
  const assignmentsSnapshot = await db.collection('reviewerAssignments')
    .where('legacy', '==', true)
    .get();
  
  const assignmentBatch = db.batch();
  assignmentsSnapshot.forEach(doc => {
    assignmentBatch.delete(doc.ref);
    stats.reviewerAssignments++;
  });
  if (assignmentsSnapshot.size > 0) await assignmentBatch.commit();
  console.log(`  ✅ ${stats.reviewerAssignments} assignments eliminados`);

  // 5. Limpiar flags en submissions
  console.log('\nLimpiando flags en submissions...');
  const submissionsSnapshot = await db.collection('submissions')
    .where('legacyReviewMigrated', '==', true)
    .get();
  
  const submissionBatch = db.batch();
  submissionsSnapshot.forEach(doc => {
    submissionBatch.update(doc.ref, {
      legacyReviewMigrated: admin.firestore.FieldValue.delete(),
      currentEditorialTaskId: admin.firestore.FieldValue.delete(),
      currentEditorialReviewId: admin.firestore.FieldValue.delete(),
      deskReviewDecision: admin.firestore.FieldValue.delete(),
      deskReviewFeedback: admin.firestore.FieldValue.delete(),
      deskReviewCompletedAt: admin.firestore.FieldValue.delete()
    });
    stats.submissionsActualizadas++;
  });
  if (submissionsSnapshot.size > 0) await submissionBatch.commit();
  console.log(`  ✅ ${stats.submissionsActualizadas} submissions limpiadas`);

  // Resumen
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE REVERSIÓN');
  console.log('='.repeat(50));
  console.log(`Editorial Tasks eliminadas: ${stats.editorialTasks}`);
  console.log(`Editorial Reviews eliminadas: ${stats.editorialReviews}`);
  console.log(`Reviewer Invitations eliminadas: ${stats.reviewerInvitations}`);
  console.log(`Reviewer Assignments eliminadas: ${stats.reviewerAssignments}`);
  console.log(`Submissions limpiadas: ${stats.submissionsActualizadas}`);
  console.log('\n✅ Reversión completada');
}

rollback().catch(console.error);