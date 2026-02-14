const fs = require('fs');
const Papa = require('papaparse');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

admin.initializeApp({
  credential: admin.credential.cert('./serviceAccountKey.json')
});

const db = admin.firestore();

// Funciones para parsear intereses y roles
function parseInterests(interestsStr) {
  if (!interestsStr) return [];
  return interestsStr.split(/[;,]/).map(i => i.trim()).filter(i => i);
}

function parseRoles(rolesStr) {
  if (!rolesStr) return [];
  return rolesStr.split(/[;,]/).map(r => r.trim()).filter(r => r);
}

// Función para listar todos los usuarios de Auth
async function listAllAuthUsers() {
  let users = [];
  let result = await admin.auth().listUsers(1000);
  users = users.concat(result.users);

  while (result.pageToken) {
    result = await admin.auth().listUsers(1000, result.pageToken);
    users = users.concat(result.users);
  }

  return users;
}

async function migrateUsers() {
  try {
    // Leer CSV
    const csvData = fs.readFileSync('users.csv', 'utf8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true }).data;
    console.log(`Found ${parsed.length} users to migrate.`);

    // Obtener todos los usuarios de Auth
    const authUsers = await listAllAuthUsers();

    for (const row of parsed) {
      // Buscar usuario en Auth por email
      const userRecord = authUsers.find(u => u.email === row['Correo']);
      const uid = userRecord ? userRecord.uid : uuidv4(); // Usar UID real o generar uno

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

      await db.collection('users').doc(uid).set(data);
      console.log(`Migrated user: ${data.displayName} (${uid})`);
    }

    console.log('Users migration complete.');
  } catch (err) {
    console.error('Error migrating users:', err);
  }
}

(async () => {
  await migrateUsers();
  process.exit(0);
})();
