// test-consolidation.js
const admin = require('firebase-admin');

// Inicializa Firebase Admin con tu service account
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testConsolidation() {
  const submissionId = 'SUB-1784244582084-SBO9045G4';
  
  console.log(`🔄 Iniciando prueba de consolidación para ${submissionId}...`);
  
  try {
    const submissionRef = db.collection('submissions').doc(submissionId);
    const submissionDoc = await submissionRef.get();
    
    if (!submissionDoc.exists) {
      console.error('❌ Documento no encontrado');
      return;
    }
    
    const submissionData = submissionDoc.data();
    
    // Mostrar estado actual
    console.log('\n📄 Estado actual del documento:');
    console.log('Título:', submissionData.title);
    console.log('Title EN:', submissionData.titleEn);
    console.log('Conflict of Interest:', submissionData.conflictOfInterest);
    console.log('Keywords:', submissionData.keywords);
    console.log('Current Metadata:', submissionData.currentMetadata ? 'Existe' : 'No existe');
    console.log('Metadata Before Consolidation:', submissionData.metadataBeforeConsolidation ? 'Existe' : 'No existe');
    
    // Obtener propuestas aprobadas
    const proposalsSnapshot = await db.collection('submissions')
      .doc(submissionId)
      .collection('metadataProposals')
      .where('status', '==', 'approved')
      .get();
    
    console.log(`\n📋 Propuestas aprobadas encontradas: ${proposalsSnapshot.size}`);
    
    if (proposalsSnapshot.empty) {
      console.log('⚠️ No hay propuestas aprobadas para consolidar.');
      
      // Simular: marcar como publicationReady para disparar la función
      console.log('\n🔄 Marcando manualmente como publicationReady...');
      await submissionRef.update({
        publicationReady: false // Primero lo ponemos en false
      });
      
      // Pequeña pausa
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Ahora lo ponemos en true para disparar el trigger
      await submissionRef.update({
        publicationReady: true,
        publicationReadyAt: admin.firestore.FieldValue.serverTimestamp(),
        publicationReadyBy: 'test-script'
      });
      
      console.log('✅ Documento actualizado. La función debería ejecutarse automáticamente.');
      
    } else {
      // Mostrar las propuestas aprobadas
      proposalsSnapshot.forEach(doc => {
        const proposal = doc.data();
        console.log(`\n📝 Propuesta ${doc.id}:`);
        console.log('  Fecha:', proposal.proposedAt?.toDate());
        console.log('  Propuesto por:', proposal.proposedByEmail);
        
        if (proposal.changes) {
          proposal.changes.forEach(change => {
            console.log(`  🔄 Cambio en "${change.field}":`);
            console.log(`     De: ${JSON.stringify(change.currentValue).substring(0, 50)}...`);
            console.log(`     A: ${JSON.stringify(change.proposedValue).substring(0, 50)}...`);
          });
        }
      });
      
      // Ejecutar la lógica de consolidación manualmente
      console.log('\n🔧 Ejecutando consolidación manual...');
      
      const baseMetadata = submissionData.currentMetadata || submissionData.originalSubmission || { ...submissionData };
      
      const approvedProposals = proposalsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(proposal => proposal.changes)
        .sort((a, b) => {
          const dateA = a.proposedAt?.toDate() || new Date(0);
          const dateB = b.proposedAt?.toDate() || new Date(0);
          return dateB - dateA;
        });
      
      const finalMetadata = { ...baseMetadata };
      
      for (const proposal of approvedProposals) {
        for (const change of proposal.changes) {
          if (!(change.field in finalMetadata)) {
            finalMetadata[change.field] = change.proposedValue;
            console.log(`  ✅ Campo "${change.field}" actualizado`);
          } else {
            console.log(`  ⚠️ Campo "${change.field}" ya existe, se mantiene valor más reciente`);
          }
        }
      }
      
      // Aplicar los cambios
      await submissionRef.update({
        metadataBeforeConsolidation: baseMetadata,
        currentMetadata: finalMetadata,
        ...finalMetadata,
        publicationReady: true,
        publicationReadyAt: admin.firestore.FieldValue.serverTimestamp(),
        publicationReadyBy: 'test-script'
      });
      
      console.log('✅ Consolidación completada manualmente');
      
      // Verificar el resultado
      const updatedDoc = await submissionRef.get();
      const updatedData = updatedDoc.data();
      
      console.log('\n📊 Resultado final:');
      console.log('Título:', updatedData.title);
      console.log('Title EN:', updatedData.titleEn);
      console.log('Conflict of Interest:', updatedData.conflictOfInterest);
      console.log('Keywords:', updatedData.keywords);
      console.log('Current Metadata existe:', !!updatedData.currentMetadata);
      console.log('Metadata Before Consolidation existe:', !!updatedData.metadataBeforeConsolidation);
    }
    
    console.log('\n✨ Prueba completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  } finally {
    process.exit(0);
  }
}

testConsolidation();