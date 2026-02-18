// migrate.js - Ejecutar LOCALMENTE con Node.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function migrate() {
  const db = admin.firestore();
  const articlesRef = db.collection('articles');
  const statsRef = db.collection('stats').doc('articles');
  
  // Obtener artículos ordenados por fecha
  const snapshot = await articlesRef
    .orderBy('fecha', 'asc')
    .get();
  
  console.log(`📊 Encontrados ${snapshot.size} artículos`);
  
  let counter = 1;
  const batch = db.batch();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`${counter}. ${data.titulo} (${data.createdAt?.toDate()?.toLocaleDateString()})`);
    batch.update(doc.ref, { articleNumber: counter });
    counter++;
  });
  
  await batch.commit();
  await statsRef.set({ count: counter - 1 }, { merge: true });
  
  console.log(`✅ Migrados ${counter - 1} artículos`);
}

migrate().catch(console.error);