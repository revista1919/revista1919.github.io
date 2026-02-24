const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parse/sync'); // npm install csv-parse

// Inicializar Firebase Admin
const serviceAccount = require('./serviceAccountKey.json'); // Reemplaza con la ruta
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Configuración
const INPUT_JSON_FILE = './old_articles.json';
const NAME_EMAIL_CSV = './name_email_map.csv'; // Opcional

// Función principal
async function main() {
  console.log('🚀 Iniciando migración de artículos antiguos...');

  // Cargar mapeo nombre-email si existe
  let nameToEmail = {};
  if (fs.existsSync(NAME_EMAIL_CSV)) {
    const csvData = fs.readFileSync(NAME_EMAIL_CSV, 'utf-8');
    const records = csv.parse(csvData, { columns: true, skip_empty_lines: true });
    records.forEach(row => {
      nameToEmail[row.Nombre.trim()] = row.Correo.trim();
    });
    console.log(`Cargados ${Object.keys(nameToEmail).length} mapeos nombre-email.`);
  }

  // Función para buscar un usuario por nombre
  async function findUserByName(name) {
    if (!name || name.trim() === '') return null;
    const trimmed = name.trim();

    // Primero intentar por email si tenemos mapeo
    const email = nameToEmail[trimmed];
    if (email) {
      const userQuery = await db.collection('users').where('email', '==', email).get();
      if (!userQuery.empty) {
        return userQuery.docs[0];
      }
    }

    // Buscar por displayName (case-insensitive)
    const displayNameQuery = await db.collection('users')
      .where('displayName', '==', trimmed)
      .get();
    if (!displayNameQuery.empty) {
      return displayNameQuery.docs[0];
    }

    // Buscar combinando firstName y lastName
    const names = trimmed.split(' ');
    if (names.length >= 2) {
      const firstName = names[0];
      const lastName = names.slice(1).join(' ');
      const combinedQuery = await db.collection('users')
        .where('firstName', '==', firstName)
        .where('lastName', '==', lastName)
        .get();
      if (!combinedQuery.empty) {
        return combinedQuery.docs[0];
      }
    }

    // Búsqueda más amplia: contiene el nombre en displayName (peligroso, pero como último recurso)
    const allUsers = await db.collection('users').get();
    for (const doc of allUsers.docs) {
      const data = doc.data();
      const fullName = data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim();
      if (fullName.toLowerCase().includes(trimmed.toLowerCase())) {
        console.warn(`⚠️ Usuario encontrado por coincidencia parcial: ${fullName} para "${trimmed}"`);
        return doc;
      }
    }

    console.error(`❌ Usuario no encontrado: ${trimmed}`);
    return null;
  }

  // Función para determinar si una celda está "completada"
  function isCompleted(value) {
    return value && value.trim() !== '';
  }

  // Función para parsear voto a booleano/recomendación
  function votoToRecommendation(voto) {
    if (!voto) return null;
    const v = voto.trim().toLowerCase();
    if (v === 'si' || v === 'sí') return 'accept';
    if (v === 'no') return 'reject';
    return null;
  }

  // Cargar datos de entrada
  const rawData = JSON.parse(fs.readFileSync(INPUT_JSON_FILE, 'utf-8'));
  const articles = Array.isArray(rawData) ? rawData : rawData.articles || [];

  console.log(`📄 Procesando ${articles.length} artículos...`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const [index, row] of articles.entries()) {
    console.log(`\n🔍 Procesando fila ${index + 1}: ${row['Nombre Artículo'] || 'Sin título'}`);

    try {
      // 1. Buscar submission
      let submissionQuery;
      if (row['Link Artículo']) {
        submissionQuery = await db.collection('submissions')
          .where('originalFileUrl', '==', row['Link Artículo'])
          .get();
      }
      if (!submissionQuery || submissionQuery.empty) {
        // Fallback por título
        submissionQuery = await db.collection('submissions')
          .where('title', '==', row['Nombre Artículo'])
          .get();
      }
      if (submissionQuery.empty) {
        throw new Error(`No se encontró submission para el artículo: ${row['Nombre Artículo']}`);
      }
      const submissionDoc = submissionQuery.docs[0];
      const submissionId = submissionDoc.id;

      // Verificar si ya fue migrado
      const submissionData = submissionDoc.data();
      if (submissionData.migrated) {
        console.log(`⏭️ Submission ${submissionId} ya fue migrado, saltando.`);
        successCount++; // lo contamos como exitoso para no repetir
        continue;
      }

      console.log(`✅ Submission encontrado: ${submissionId}`);

      // 2. Obtener usuarios
      const editorName = row['Editor'];
      const reviewer1Name = row['Revisor 1'];
      const reviewer2Name = row['Revisor 2'];

      const editorUser = editorName ? await findUserByName(editorName) : null;
      const reviewer1User = reviewer1Name ? await findUserByName(reviewer1Name) : null;
      const reviewer2User = reviewer2Name ? await findUserByName(reviewer2Name) : null;

      if (editorName && !editorUser) {
        throw new Error(`Editor no encontrado: ${editorName}`);
      }
      // Si un revisor no se encuentra, se omite pero se continúa (solo se migrarán los que sí existan)

      // 3. Determinar completitud
      const editorCompleted = isCompleted(row['Feedback 3']) || isCompleted(row['Informe 3']);
      const reviewer1Completed = reviewer1User && (isCompleted(row['Feedback 1']) || isCompleted(row['Informe 1']));
      const reviewer2Completed = reviewer2User && (isCompleted(row['Feedback 2']) || isCompleted(row['Informe 2']));

      // Votos
      const voto3 = row['Voto 3'];
      const voto1 = row['Voto 1'];
      const voto2 = row['Voto 2'];
      const estado = row['Estado'];

      // 4. Calcular estados
      let taskStatus;
      let submissionStatus;
      let requiredReviewers = 2;
      const reviewersSubmitted = [reviewer1Completed, reviewer2Completed].filter(Boolean).length;

      if (editorCompleted) {
        taskStatus = 'completed';
        const rec = votoToRecommendation(voto3) || (estado === 'Aceptado' ? 'accept' : null);
        if (rec === 'accept') submissionStatus = 'accepted';
        else if (rec === 'reject') submissionStatus = 'rejected';
        else submissionStatus = 'accepted'; // por defecto aceptado si no hay info
      } else if (reviewersSubmitted > 0) {
        taskStatus = 'awaiting-decision';
        submissionStatus = 'awaiting-editor-decision';
        requiredReviewers = reviewersSubmitted;
      } else {
        taskStatus = 'pending';
        submissionStatus = 'submitted';
      }

      // 5. Iniciar batch
      const batch = db.batch();

      // 6. Crear editorialTask (si no existe ya, pero asumimos que no)
      const taskRef = db.collection('editorialTasks').doc();
      const taskData = {
        submissionId,
        round: 1,
        assignedTo: editorUser ? editorUser.id : null,
        assignedToEmail: editorUser ? editorUser.data().email : '',
        assignedToName: editorUser ? (editorUser.data().displayName || editorName) : editorName,
        assignedBy: editorUser ? editorUser.id : null, // o system
        assignmentNotes: 'Migrado desde sistema antiguo',
        status: taskStatus,
        requiredReviewers,
        acceptedReviewers: reviewersSubmitted,
        reviewsSubmitted: reviewersSubmitted,
        reviewerIds: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        migrated: true
      };
      batch.set(taskRef, taskData);
      console.log(`📌 Tarea creada: ${taskRef.id}`);

      // 7. Si editor completó, crear editorialReview
      if (editorCompleted) {
        const decision = votoToRecommendation(voto3) || (estado === 'Aceptado' ? 'accept' : 'reject');
        const reviewRef = db.collection('editorialReviews').doc();
        batch.set(reviewRef, {
          submissionId,
          editorialTaskId: taskRef.id,
          round: 1,
          editorUid: editorUser.id,
          decision,
          feedbackToAuthor: row['Feedback 3'] || '',
          commentsToEditorial: row['Informe 3'] || '',
          status: 'completed',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          migrated: true
        });
        console.log(`📝 EditorialReview creada: ${reviewRef.id}`);
      }

      // 8. Para cada revisor que completó, crear reviewerAssignment y anonymous review
      const reviewerAssignments = [];

      if (reviewer1Completed) {
        const assignmentRef = db.collection('reviewerAssignments').doc();
        const recommendation = votoToRecommendation(voto1) || 'accept';
        const assignmentData = {
          editorialTaskId: taskRef.id,
          submissionId,
          round: 1,
          reviewerUid: reviewer1User.id,
          reviewerEmail: reviewer1User.data().email,
          reviewerName: reviewer1User.data().displayName || reviewer1Name,
          status: 'submitted',
          scores: {},
          recommendation,
          commentsToAuthor: row['Feedback 1'] || '',
          commentsToEditor: row['Informe 1'] || '',
          submittedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          migrated: true
        };
        batch.set(assignmentRef, assignmentData);
        reviewerAssignments.push(assignmentRef.id);
        console.log(`👤 ReviewerAssignment 1 creada: ${assignmentRef.id}`);

        // Anonymous review
        const reviewRef = db.collection('submissions').doc(submissionId).collection('reviews').doc();
        batch.set(reviewRef, {
          commentsToAuthor: assignmentData.commentsToAuthor,
          recommendation: assignmentData.recommendation,
          scores: {},
          submittedAt: admin.firestore.FieldValue.serverTimestamp(),
          round: 1,
          migrated: true
        });
      }

      if (reviewer2Completed) {
        const assignmentRef = db.collection('reviewerAssignments').doc();
        const recommendation = votoToRecommendation(voto2) || 'accept';
        const assignmentData = {
          editorialTaskId: taskRef.id,
          submissionId,
          round: 1,
          reviewerUid: reviewer2User.id,
          reviewerEmail: reviewer2User.data().email,
          reviewerName: reviewer2User.data().displayName || reviewer2Name,
          status: 'submitted',
          scores: {},
          recommendation,
          commentsToAuthor: row['Feedback 2'] || '',
          commentsToEditor: row['Informe 2'] || '',
          submittedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          migrated: true
        };
        batch.set(assignmentRef, assignmentData);
        reviewerAssignments.push(assignmentRef.id);
        console.log(`👤 ReviewerAssignment 2 creada: ${assignmentRef.id}`);

        const reviewRef = db.collection('submissions').doc(submissionId).collection('reviews').doc();
        batch.set(reviewRef, {
          commentsToAuthor: assignmentData.commentsToAuthor,
          recommendation: assignmentData.recommendation,
          scores: {},
          submittedAt: admin.firestore.FieldValue.serverTimestamp(),
          round: 1,
          migrated: true
        });
      }

      // 9. Actualizar tarea con reviewerIds
      batch.update(taskRef, { reviewerIds: reviewerAssignments });

      // 10. Actualizar submission
      const submissionUpdate = {
        status: submissionStatus,
        migrated: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (editorCompleted) {
        submissionUpdate.finalDecision = votoToRecommendation(voto3) || (estado === 'Aceptado' ? 'accept' : 'reject');
        submissionUpdate.finalFeedback = row['Feedback 3'] || '';
        submissionUpdate.decisionMadeAt = admin.firestore.FieldValue.serverTimestamp();
        submissionUpdate.decisionMadeBy = editorUser.id;
      }
      batch.update(submissionDoc.ref, submissionUpdate);

      // 11. Ejecutar batch
      await batch.commit();
      console.log(`✅ Artículo migrado correctamente: ${row['Nombre Artículo']}`);
      successCount++;

    } catch (err) {
      console.error(`❌ Error en fila ${index + 1}: ${err.message}`);
      errors.push({ row: index + 1, title: row['Nombre Artículo'], error: err.message });
      errorCount++;
    }
  }

  // Resumen final
  console.log('\n========== RESUMEN DE MIGRACIÓN ==========');
  console.log(`Total procesados: ${articles.length}`);
  console.log(`Exitosos: ${successCount}`);
  console.log(`Errores: ${errorCount}`);
  if (errors.length > 0) {
    console.log('\nDetalle de errores:');
    errors.forEach(e => console.log(`  Fila ${e.row}: ${e.title} - ${e.error}`));
  }
  console.log('==========================================');
}

// Ejecutar la función principal
main().catch(console.error);