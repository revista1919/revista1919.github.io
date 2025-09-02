// generate-all.js
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');

const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const outputJson = './articles.json';
const outputHtmlDir = path.join(__dirname, 'articles');

// ---------- Función robusta para parsear fechas ----------
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

// ---------- Crear carpeta HTML si no existe ----------
if (!fs.existsSync(outputHtmlDir)) fs.mkdirSync(outputHtmlDir);

// ---------- Flujo principal ----------
(async () => {
  try {
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Error descargando CSV: ${res.statusText}`);
    const csvData = await res.text();

    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    const articles = parsed.data.map(row => ({
      titulo: row['Título'] || 'Sin título',
      autores: row['Autor(es)'] || 'Autor desconocido',
      resumen: row['Resumen'] || 'Resumen no disponible',
      pdf: `/Articles/Articulo${row['Número de artículo']}.pdf`,
      fecha: parseDateFlexible(row['Fecha']),
      volumen: row['Volumen'] || '',
      numero: row['Número'] || '',
      primeraPagina: row['Primera página'] || '',
      ultimaPagina: row['Última página'] || '',
      area: row['Área temática'] || '',
      numeroArticulo: row['Número de artículo'] || '',
      palabras_clave: row['Palabras clave']
        ? row['Palabras clave'].split(/[;,]/).map(k => k.trim())
        : []
    }));

    // ---------- Guardar JSON ----------
    fs.writeFileSync(outputJson, JSON.stringify(articles, null, 2));
    console.log(`✅ Archivo generado: ${outputJson} (${articles.length} artículos)`);

    // ---------- Generar HTML ----------
    articles.forEach(article => {
      const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="citation_title" content="${article.titulo}">
  <meta name="citation_author" content="${article.autores}">
  <meta name="citation_journal_title" content="Revista Nacional de las Ciencias para Estudiantes">
  <meta name="citation_publication_date" content="${article.fecha}">
  <meta name="citation_abstract" content="${article.resumen}">
  <meta name="citation_pdf_url" content="${article.pdf}">
  <meta name="citation_language" content="es">
  <meta name="citation_keywords" content="${article.palabras_clave.join(', ')}">
  <title>${article.titulo} - Revista Nacional de las Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>${article.titulo}</h1>
    <h3>${article.autores}</h3>
    <p><strong>Fecha de publicación:</strong> ${article.fecha}</p>
    <p><strong>Área temática:</strong> ${article.area}</p>
  </header>
  <main>
    <section>
      <h2>Resumen</h2>
      <p>${article.resumen}</p>
    </section>
    <section>
      <h2>Descargar PDF</h2>
      <a href="${article.pdf}" target="_blank" download>Descargar PDF</a>
    </section>
    <section>
      <h2>Citas</h2>
      <p><strong>APA:</strong> ${article.autores}. (${new Date(article.fecha).getFullYear()}). ${article.titulo}. <em>Revista Nacional de las Ciencias para Estudiantes</em>.</p>
      <p><strong>MLA:</strong> ${article.autores}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em>, ${new Date(article.fecha).getFullYear()}.</p>
      <p><strong>Chicago:</strong> ${article.autores}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em>, ${new Date(article.fecha).getFullYear()}.</p>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>
      `;

      const filePath = path.join(outputHtmlDir, `articulo${article.numeroArticulo}.html`);
      fs.writeFileSync(filePath, htmlContent);
      console.log(`Generado HTML: ${filePath}`);
    });

  } catch (err) {
    console.error('❌ Error:', err);
  }
})();
