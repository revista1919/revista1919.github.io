const fs = require('fs');
const Papa = require('papaparse');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid'); // Para generar UIDs si no vienen

admin.initializeApp({
  credential: admin.credential.cert('./serviceAccountKey.json')
});

const db = admin.firestore();

function parseInterests(interestsStr) {
  if (!interestsStr) return [];
  return interestsStr.split(/[;,]/).map(i => i.trim()).filter(i => i);
}

function parseRoles(rolesStr) {
  if (!rolesStr) return [];
  return rolesStr.split(/[;,]/).map(r => r.trim()).filter(r => r);
}

async function migrateUsers() {
  try {
    const csvData = fs.readFileSync('users.csv', 'utf8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true }).data;
    console.log(`Found ${parsed.length} users to migrate.`);

    for (const row of parsed) {
      const uid = row['Correo'] ? undefined : uuidv4(); // Genera UID si quieres, o usa el correo
      const now = new Date().toISOString();

      const data = {
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
          es: row['Áreas de interés'] || '',
          en: row['Areas of interest'] || ''
        },
        roles: parseRoles(row['Rol en la Revista'] || row['Role in the Journal']),
        social: {}, // Puedes agregar info si tienes links de redes
        uid: uid || row['Correo'] || uuidv4()
      };

      await db.collection('users').doc(data.uid).set(data);
      console.log(`Migrated user: ${data.displayName}`);
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
