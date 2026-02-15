const fs = require('fs');
const Papa = require('papaparse');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

admin.initializeApp({
  credential: admin.credential.cert('./serviceAccountKey.json')
});

const db = admin.firestore();

const TARGET_EMAIL = 'lgvm3011@gmail.com';

// ===================== helpers =====================
function parseInterests(interestsStr) {
  if (!interestsStr) return [];
  return interestsStr.split(/[;,]/).map(i => i.trim()).filter(Boolean);
}

function parseRoles(rolesStr) {
  if (!rolesStr) return [];
  return rolesStr.split(/[;,]/).map(r => r.trim()).filter(Boolean);
}

// ===================== main =====================
async function migrateSingleUser() {
  try {
    const csvData = fs.readFileSync('users.csv', 'utf8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true }).data;

    // Buscar SOLO la persona
    const row = parsed.find(r => (r['Correo'] || '').trim().toLowerCase() === TARGET_EMAIL);

    if (!row) {
      console.log('User not found in CSV');
      return;
    }

    // Buscar en Auth (mucho más rápido que listar todos)
    let uid;
    try {
      const userRecord = await admin.auth().getUserByEmail(TARGET_EMAIL);
      uid = userRecord.uid;
      console.log('Found existing Auth user:', uid);
    } catch (e) {
      uid = uuidv4();
      console.log('User not in Auth, generating uid:', uid);
    }

    const now = new Date().toISOString();

    const data = {
      uid,
      createdAt: now,
      updatedAt: now,
      displayName: row['Nombre'] || '',
      firstName: row['Nombre'] ? row['Nombre'].split(' ')[0] : '',
      lastName: row['Nombre'] ? row['Nombre'].split(' ').slice(1).join(' ') : '',
      email: row['Correo'] || '',
      publicEmail: '',
      imageUrl: row['Imagen'] || '',
      institution: row['Institution'] || '',
      description: {
        es: row['Descripción'] || '',
        en: row['Description'] || ''
      },
      interests: {
        es: parseInterests(row['Áreas de interés']),
        en: parseInterests(row['Areas of interest'])
      },
      roles: parseRoles(row['Rol en la Revista'] || row['Role in the Journal']),
      social: {}
    };

    await db.collection('users').doc(uid).set(data, { merge: true });

    console.log(`✅ Migrated: ${data.displayName} (${uid})`);
  } catch (err) {
    console.error('Error:', err);
  }
}

(async () => {
  await migrateSingleUser();
  process.exit(0);
})();
