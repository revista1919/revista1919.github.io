// force-create-copy.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function forceTrigger() {
  const submissionId = 'SUB-1771885288041-X06FVT25L';
  const versionId = 'Phl5vitYhM02j7v1ai0j';
  
  console.log('🔍 Buscando documento original...');
  const versionRef = db.collection('submissions').doc(submissionId)
                       .collection('versions').doc(versionId);
  
  // 1. Leer datos originales
  const doc = await versionRef.get();
  
  if (!doc.exists) {
    console.error('❌ Documento no encontrado');
    process.exit(1);
  }
  
  const data = doc.data();
  console.log('📄 Datos originales:', data);
  
  // 2. PREPARAR COPIA EXACTA (sin el ID original)
  // Eliminamos cualquier campo interno que pueda causar problemas
  const cleanData = { ...data };
  
  // Aseguramos que el tipo sea 'revision' para que el trigger lo procese
  if (cleanData.type !== 'revision') {
    console.log('⚠️ El tipo original no es "revision". Forzando a "revision"');
    cleanData.type = 'revision';
  }
  
  // Agregamos un campo para identificar que es una copia forzada
  cleanData._forcedCopy = true;
  cleanData._originalVersionId = versionId;
  cleanData._forcedAt = admin.firestore.FieldValue.serverTimestamp();
  
  console.log('📝 Creando copia exacta...');
  
  // 3. Crear NUEVO documento con los mismos datos
  const newVersionRef = await db.collection('submissions').doc(submissionId)
                                .collection('versions').add(cleanData);
  
  console.log('✅ NUEVO DOCUMENTO CREADO CON ID:', newVersionRef.id);
  console.log('⏳ Esperando 5 segundos para que el trigger se ejecute...');
  
  // 4. Esperar para asegurar que el trigger se ejecute
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 5. Verificar que el trigger se ejecutó (opcional)
  // Podemos buscar el nuevo documento y ver si se actualizó
  const newDoc = await newVersionRef.get();
  console.log('📊 Estado del nuevo documento:', newDoc.data());
  
  // 6. PREGUNTAR antes de eliminar el original
  console.log('\n⚠️  ACCIÓN REQUERIDA:');
  console.log(`📌 Se creó una copia exacta con ID: ${newVersionRef.id}`);
  console.log('📌 El documento original (Phl5vitYhM02j7v1ai0j) aún existe.');
  console.log('📌 ¿Quieres eliminar el documento original? (responde en 10 segundos)');
  
  // Timeout para respuesta automática
  const timeout = setTimeout(async () => {
    console.log('⏰ Tiempo agotado. CONSERVANDO el documento original.');
    console.log('✅ Proceso completado. La copia nueva debería haber disparado el trigger.');
    console.log(`🔗 URL de la copia: https://console.firebase.google.com/project/usuarios-rnce/firestore/data/submissions/${submissionId}/versions/${newVersionRef.id}`);
    process.exit(0);
  }, 10000);
  
  // Esperar respuesta del usuario
  process.stdin.once('data', async (data) => {
    clearTimeout(timeout);
    const respuesta = data.toString().trim().toLowerCase();
    
    if (respuesta === 'si' || respuesta === 's' || respuesta === 'y' || respuesta === 'yes') {
      try {
        await versionRef.delete();
        console.log('🗑️ Documento original eliminado correctamente');
      } catch (error) {
        console.error('❌ Error eliminando original:', error.message);
      }
    } else {
      console.log('🔵 Documento original CONSERVADO');
    }
    
    console.log('✅ Proceso completado.');
    console.log(`🔗 URL de la copia nueva: https://console.firebase.google.com/project/usuarios-rnce/firestore/data/submissions/${submissionId}/versions/${newVersionRef.id}`);
    process.exit(0);
  });
  
  console.log('❓ ¿Eliminar documento original? (si/no) [no por defecto en 10s]:');
}

forceTrigger().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});