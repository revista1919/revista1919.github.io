const fs = require('fs');
const Papa = require('papaparse');
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert('./serviceAccountKey.json')
});
const db = admin.firestore();

function parseDateFlexible(dateStr) {
  if (!dateStr) return '';
  let date = new Date(dateStr);
  if (!isNaN(date)) return date.toISOString().split('T')[0];
  const parts = dateStr.split(/[\/.-]/);
  if (parts.length === 3) {
    let [day, month, year] = parts.map(p => p.padStart(2, '0'));
    if (year.length === 2) year = '20' + year;
    date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date)) return date.toISOString().split('T')[0];
  }
  return dateStr;
}

async function migrateArticles() {
  try {
    const csvData = fs.readFileSync('articles.csv', 'utf8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true }).data;
    console.log(`Found ${parsed.length} articles to migrate.`);
    for (const row of parsed) {
      const data = {
        titulo: row['Título'] || 'Sin título',
        autores: row['Autor(es)'] || 'Autor desconocido',
        resumen: row['Resumen'] || 'Resumen no disponible',
        abstract: row['Abstract'] || 'English abstract not available',
        fecha: parseDateFlexible(row['Fecha']),
        volumen: row['Volumen'] || '',
        numero: row['Número'] || '',
        primeraPagina: row['Primera página'] || '',
        ultimaPagina: row['Última página'] || '',
        area: row['Área temática'] || '',
        numeroArticulo: row['Número de artículo'] || '',
        palabras_clave: row['Palabras clave'] ? row['Palabras clave'].split(/[;,]/).map(k => k.trim()).filter(k => k) : [],
        keywords_english: row['Keywords'] ? row['Keywords'].split(';').map(k => k.trim()).filter(k => k) : [],
        tipo: row['Tipo'] || '',
        type: row['Type'] || '',
        pdfUrl: row['PDF'] || '',
        role: 'Director General'  // Default for security
      };
      await db.collection('articles').add(data);
      console.log(`Migrated article: ${data.titulo}`);
    }
    console.log('Articles migration complete.');
  } catch (err) {
    console.error('Error migrating articles:', err);
  }
}

async function migrateVolumes() {
  try {
    const csvData = fs.readFileSync('volumes.csv', 'utf8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true }).data;
    console.log(`Found ${parsed.length} volumes to migrate.`);
    for (const row of parsed) {
      const data = {
        volumen: row['Volumen'] || '',
        numero: row['Número'] || '',
        fecha: parseDateFlexible(row['Fecha']),
        titulo: row['Título'] || 'Sin título',
        resumen: row['Resumen'] || 'Resumen no disponible',
        abstract: row['Abstract'] || 'Abstract not available',
        portada: row['Portada'] || '',  // URL or base64, as is
        pdf: row['PDF'] || '',
        area: row['Área temática'] || '',
        palabras_clave: row['Palabras clave'] ? row['Palabras clave'].split(/[;,]/).map(k => k.trim()).filter(k => k) : [],
        keywords: row['Keywords'] ? row['Keywords'].split(';').map(k => k.trim()).filter(k => k) : [],
        role: 'Director General'  // Default for security
      };
      await db.collection('volumes').add(data);
      console.log(`Migrated volume: ${data.titulo}`);
    }
    console.log('Volumes migration complete.');
  } catch (err) {
    console.error('Error migrating volumes:', err);
  }
}

(async () => {
  await migrateArticles();
  await migrateVolumes();
  process.exit(0);
})();