const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'usuarios-rnce'
});
const firestore = admin.firestore();

const DOCUMENT_ID = 'SUB-1782524181781-VFJFN0Y5V';
const COLLECTION_NAME = 'submissions';
const SUBCOLLECTIONS = ['auditLogs', 'reviews', 'versions', 'metadataProposals'];

async function restoreAnyVersion() {
  try {
    const docRef = firestore.collection(COLLECTION_NAME).doc(DOCUMENT_ID);
    
    console.log(`🚀 RESTAURACIÓN CON READTIME CORRECTO`);
    console.log(`📅 Buscando versión de: 2026-07-08T17:00:00.000Z\n`);
    
    const targetDate = new Date('2026-07-08T17:00:00.000Z');
    const readTimestamp = admin.firestore.Timestamp.fromDate(targetDate);
    
    // 1. LEER TODO EN UNA SOLA TRANSACCIÓN (Documento + Subcolecciones)
    console.log(`📄 Leyendo estado completo del documento y subcolecciones...`);
    
    let mainDocData = null;
    let mainDocExists = false;
    const subcollectionsData = {};

    try {
      await firestore.runTransaction(
        async (transaction) => {
          // Leer documento principal
          const docSnap = await transaction.get(docRef);
          if (docSnap.exists) {
            mainDocData = docSnap.data();
            mainDocExists = true;
            console.log(`   ✅ Documento principal encontrado`);
          }

          // Leer TODAS las subcolecciones en la misma transacción
          for (const subcollectionName of SUBCOLLECTIONS) {
            const subcollectionRef = docRef.collection(subcollectionName);
            const subSnap = await transaction.get(subcollectionRef);
            
            subcollectionsData[subcollectionName] = [];
            subSnap.forEach(doc => {
              subcollectionsData[subcollectionName].push({
                id: doc.id,
                data: doc.data()
              });
            });
            
            if (!subSnap.empty) {
              console.log(`   ✅ ${subcollectionName}: ${subSnap.size} documentos encontrados`);
            } else {
              console.log(`   ⚠️ ${subcollectionName}: vacío`);
            }
          }
        },
        { 
          readOnly: true, 
          readTime: readTimestamp 
        }
      );
      
      if (!mainDocExists) {
        console.log('❌ No se encontró el documento en esa fecha. Saliendo...');
        return;
      }
      
      console.log(`\n✅ Datos históricos cargados correctamente`);
      
    } catch (error) {
      console.log(`❌ Error al leer datos históricos:`, error.message);
      
      // Manejar errores específicos de PITR
      if (error.message?.includes('PITR') || error.message?.includes('not enabled')) {
        console.log(`\n⚠️ IMPORTANTE: El PITR (Point-in-Time Recovery) no está habilitado.`);
        console.log(`   Para usar readTime, activa PITR en: GCP Console > Firestore > Settings`);
      }
      return;
    }
    
    // 2. RESTAURAR USANDO WRITE BATCH (MUCHO MÁS RÁPIDO)
    console.log(`\n📂 Restaurando datos en la base de datos activa...`);
    
    const batch = firestore.batch();
    let totalRestored = 0;
    const subcollectionsFound = [];
    
    // Añadir documento principal al batch
    batch.set(docRef, mainDocData);
    console.log(`   📄 Documento principal añadido al batch`);
    
    // Añadir todas las subcolecciones al batch
    for (const subcollectionName of SUBCOLLECTIONS) {
      const docsToRestore = subcollectionsData[subcollectionName] || [];
      
      if (docsToRestore.length === 0) continue;
      
      console.log(`   📂 ${subcollectionName}: ${docsToRestore.length} documentos añadidos`);
      subcollectionsFound.push(subcollectionName);
      
      const subcollectionRef = docRef.collection(subcollectionName);
      
      for (const subDoc of docsToRestore) {
        const subDocRef = subcollectionRef.doc(subDoc.id);
        batch.set(subDocRef, subDoc.data);
        totalRestored++;
      }
    }
    
    // EJECUTAR EL BATCH (TODO DE UNA VEZ)
    console.log(`\n💾 Ejecutando batch con ${totalRestored + 1} operaciones...`);
    await batch.commit();
    console.log(`✅ ¡BATCH COMPLETADO!`);
    
    // 3. RESUMEN FINAL
    console.log(`\n✅ ¡RESTAURACIÓN COMPLETA!`);
    console.log(`📄 Documento: ${DOCUMENT_ID}`);
    console.log(`🕐 Versión usada: ${targetDate.toISOString()}`);
    console.log(`📂 Subcolecciones restauradas: ${subcollectionsFound.join(', ') || 'NINGUNA'}`);
    console.log(`📊 Total documentos restaurados: ${totalRestored}`);
    
    // 4. VERIFICACIÓN FINAL
    console.log('\n🔍 Verificando restauración...');
    const verifyDoc = await docRef.get();
    if (verifyDoc.exists) {
      console.log(`✅ Documento principal: OK (${Object.keys(verifyDoc.data()).length} campos)`);
    }
    
    for (const subcollectionName of SUBCOLLECTIONS) {
      const snapshot = await docRef.collection(subcollectionName).get();
      if (!snapshot.empty) {
        console.log(`✅ ${subcollectionName}: ${snapshot.size} documentos`);
      } else {
        console.log(`⚠️ ${subcollectionName}: 0 documentos`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// EJECUTAR
restoreAnyVersion();