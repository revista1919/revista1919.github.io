const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');
const articlesCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const teamCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const newsCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQKnN8qMJcBN8im9Q61o-qElx1jQp5NdS80_B-FakCHrPLXHlQ_FXZWT0o5GVVHAM26l9sjLxsTCNO8/pub?output=csv';
const volumesCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTTs7eHa-_bbWkSzOxaM26oi79ioBYFyTcNB0EaEBt0VYWZeCZq2S4FUnaHXcB8lf2T78XhET9v5WTh/pub?output=csv'; // Nuevo
const outputJson = path.join(__dirname, 'dist', 'articles.json');
const volumesOutputJson = path.join(__dirname, 'dist', 'volumes.json'); // Nuevo
const outputHtmlDir = path.join(__dirname, 'dist', 'articles');
const volumesOutputHtmlDir = path.join(__dirname, 'dist', 'volumes'); // Nuevo
const newsOutputHtmlDir = path.join(__dirname, 'dist', 'news');
const teamOutputHtmlDir = path.join(__dirname, 'dist', 'team');
const sectionsOutputDir = path.join(__dirname, 'dist', 'sections');
const sitemapPath = path.join(__dirname, 'dist', 'sitemap.xml');
const robotsPath = path.join(__dirname, 'dist', 'robots.txt');
const domain = 'https://www.revistacienciasestudiantes.com';
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
function formatAuthorForCitation(author) {
  const parts = author.trim().split(' ');
  if (parts.length >= 2) {
    const apellido = parts.pop();
    const nombre = parts.join(' ');
    return `${apellido}, ${nombre}`;
  }
  return author;
}
function getAPAAuthor(author) {
  const parts = author.trim().split(/\s+/);
  if (parts.length < 2) return author;
  const last = parts.pop();
  const initials = parts.map(n => n[0].toUpperCase() + '.').join(' ');
  return `${last}, ${initials}`;
}
function formatAuthorsAPA(authorsStr) {
  const authors = authorsStr.split(';').map(a => a.trim()).filter(Boolean);
  if (!authors.length) return '';
  const formatted = authors.map(getAPAAuthor);
  if (formatted.length === 1) {
    return formatted[0];
  } else if (formatted.length === 2) {
    return formatted[0] + ', & ' + formatted[1];
  } else {
    return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
  }
}
function formatAuthorsChicagoOrMLA(authorsStr, language = 'es') {
  const authors = authorsStr.split(';').map(a => a.trim()).filter(Boolean);
  if (!authors.length) return '';
  const formatted = authors.map(formatAuthorForCitation);
  const connector = language === 'es' ? 'y' : 'and';
  const etal = 'et al.';
  if (formatted.length === 1) {
    return formatted[0];
  } else if (formatted.length === 2) {
    return `${formatted[0]}, ${connector} ${formatted[1]}`;
  } else {
    return `${formatted[0]}, ${etal}`;
  }
}
function formatAuthorsDisplay(authorsStr, language = 'es') {
  const authors = authorsStr.split(';').map(a => a.trim()).filter(Boolean);
  if (!authors.length) return 'Autor desconocido';
  const connector = language === 'es' ? 'y' : 'and';
  if (authors.length === 1) {
    return authors[0];
  } else if (authors.length === 2) {
    return `${authors[0]} ${connector} ${authors[1]}`;
  } else {
    return authors.slice(0, -1).join(', ') + `, ${connector} ` + authors[authors.length - 1];
  }
}
function generateSlug(name) {
  if (!name) return '';
  name = name.toLowerCase();
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  name = name.replace(/\s+/g, '-');
  name = name.replace(/[^a-z0-9-]/g, '');
  name = name.replace(/-+/g, '-');
  name = name.replace(/^-+|-+$/g, '');
  return name;
}
function isBase64(str) {
  if (!str) return false;
  const base64Regex = /^data:image\/(png|jpe?g|gif);base64,/;
  return base64Regex.test(str);
}
function getImageSrc(image) {
  if (!image) return '';
  if (isBase64(image)) return image;
  if (image.startsWith('http')) return image;
  return '';
}
const base64DecodeUnicode = (str) => {
  try {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch (err) {
    console.error('Error decoding Base64:', err);
    return '';
  }
};
if (!fs.existsSync(outputHtmlDir)) fs.mkdirSync(outputHtmlDir, { recursive: true });
if (!fs.existsSync(volumesOutputHtmlDir)) fs.mkdirSync(volumesOutputHtmlDir, { recursive: true }); // Nuevo
if (!fs.existsSync(newsOutputHtmlDir)) fs.mkdirSync(newsOutputHtmlDir, { recursive: true });
if (!fs.existsSync(teamOutputHtmlDir)) fs.mkdirSync(teamOutputHtmlDir, { recursive: true });
if (!fs.existsSync(sectionsOutputDir)) fs.mkdirSync(sectionsOutputDir, { recursive: true });
(async () => {
  try {
    // Procesar equipo primero para obtener instituciones
    const teamRes = await fetch(teamCsvUrl);
    if (!teamRes.ok) throw new Error(`Error descargando CSV de equipo: ${teamRes.statusText}`);
    const teamCsvData = await teamRes.text();
    const teamParsed = Papa.parse(teamCsvData, { header: true, skipEmptyLines: true });
    const authorToInstitution = {};
    teamParsed.data.forEach(row => {
      const name = (row['Nombre'] || '').trim();
      const inst = (row['Institution'] || '').trim();
      if (name) authorToInstitution[name] = inst;
    });
    // Procesar artículos
    const articlesRes = await fetch(articlesCsvUrl);
    if (!articlesRes.ok) throw new Error(`Error descargando CSV de artículos: ${articlesRes.statusText}`);
    const articlesCsvData = await articlesRes.text();
    const articlesParsed = Papa.parse(articlesCsvData, { header: true, skipEmptyLines: true });
    const articles = articlesParsed.data.map(row => {
      const autoresStr = row['Autor(es)'] || 'Autor desconocido';
      const institutions = autoresStr.split(';').map(a => {
        const name = a.trim();
        return authorToInstitution[name] || '';
      });
      return {
      titulo: row['Título'] || 'Sin título',
      autores: autoresStr,
      institutions,
      resumen: row['Resumen'] || 'Resumen no disponible',
      englishAbstract: row['Abstract'] || 'English abstract not available',
      fecha: parseDateFlexible(row['Fecha']),
      volumen: row['Volumen'] || '',
      numero: row['Número'] || '',
      primeraPagina: row['Primera página'] || '',
      ultimaPagina: row['Última página'] || '',
      area: row['Área temática'] || '',
      numeroArticulo: row['Número de artículo'] || '',
      palabras_clave: row['Palabras clave']
        ? row['Palabras clave'].split(/[;,]/).map(k => k.trim())
        : [],
      keywords_english: row['Keywords']
        ? row['Keywords'].split(';').map(k => k.trim())
        : []
    }});
    fs.writeFileSync(outputJson, JSON.stringify(articles, null, 2), 'utf8');
    console.log(`✅ Archivo generado: ${outputJson} (${articles.length} artículos)`);
    // Crear mapa de autores a artículos (mismo)
    let authorToArticles = {};
    articles.forEach(article => {
      const authors = article.autores.split(';').map(a => a.trim());
      authors.forEach(auth => {
        if (!authorToArticles[auth]) authorToArticles[auth] = [];
        authorToArticles[auth].push(article);
      });
    });
    articles.forEach(article => {
  const authorsList = article.autores.split(';').map(a => formatAuthorForCitation(a));
  const authorMetaTags = authorsList.map(author => `<meta name="citation_author" content="${author}">`).join('\n');
  const articleSlug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
  const pdfFileName = `Article-${articleSlug}.pdf`;
  article.pdf = `${domain}/Articles/${pdfFileName}`;
  const authorsDisplayEs = formatAuthorsDisplay(article.autores, 'es');
  const authorsDisplayEn = formatAuthorsDisplay(article.autores, 'en');
  const authorsAPA = formatAuthorsAPA(article.autores);
  const authorsChicagoEs = formatAuthorsChicagoOrMLA(article.autores, 'es');
  const authorsMLAEs = formatAuthorsChicagoOrMLA(article.autores, 'es');
  const authorsChicagoEn = formatAuthorsChicagoOrMLA(article.autores, 'en');
  const authorsMLAEn = formatAuthorsChicagoOrMLA(article.autores, 'en');
  const year = new Date(article.fecha).getFullYear();
  // Generar HTML en español (mismo)
  const htmlContentEs = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="citation_title" content="${article.titulo}">
  ${authorMetaTags}
  <meta name="citation_publication_date" content="${article.fecha}">
  <meta name="citation_journal_title" content="Revista Nacional de las Ciencias para Estudiantes">
  <meta name="citation_volume" content="${article.volumen}">
  <meta name="citation_issue" content="${article.numero}">
  <meta name="citation_firstpage" content="${article.primeraPagina}">
  <meta name="citation_lastpage" content="${article.ultimaPagina}">
  <meta name="citation_pdf_url" content="${article.pdf}">
  <meta name="citation_abstract_html_url" content="${domain}/articles/article-${articleSlug}.html">
  <meta name="citation_abstract" content="${article.resumen}">
  <meta name="citation_abstract" xml:lang="en" content="${article.englishAbstract}">
  <meta name="citation_keywords" content="${article.palabras_clave.join('; ')}">
  <meta name="citation_language" content="es">
  <meta name="description" content="${article.resumen.substring(0, 160)}...">
  <meta name="keywords" content="${article.palabras_clave.join(', ')}">
  <title>${article.titulo} - Revista Nacional de las Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
  <style>
    body {
      font-family: 'Merriweather', serif;
      line-height: 1.8;
      color: #333;
      background-color: #f9f9f9;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1rem;
      background: white;
      box-shadow: 0 0 20px rgba(0,0,0,0.05);
      border-radius: 8px;
      box-sizing: border-box;
    }
    header {
      text-align: center;
      border-bottom: 1px solid #eee;
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }
    h1 {
      font-size: 1.8rem;
      color: #2c3e50;
      margin-bottom: 0.5rem;
    }
    .authors {
      font-size: 1.1rem;
      color: #555;
      margin-bottom: 1rem;
    }
    .meta {
      font-size: 0.9rem;
      color: #777;
      margin-bottom: 0.5rem;
    }
    section {
      margin-bottom: 2rem;
    }
    h2 {
      font-size: 1.3rem;
      color: #34495e;
      border-bottom: 1px solid #ddd;
      padding-bottom: 0.5rem;
      margin-bottom: 1rem;
    }
    p {
      text-align: justify;
    }
    .keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .keyword {
      background: #e8f4fd;
      color: #2980b9;
      padding: 0.3rem 0.8rem;
      border-radius: 20px;
      font-size: 0.85rem;
    }
    .pdf-preview {
      width: 100%;
      height: 600px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-top: 1rem;
      box-sizing: border-box;
    }
    .buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-top: 1rem;
      max-width: 100%;
      box-sizing: border-box;
    }
    .button {
      padding: 0.7rem 1.5rem;
      border-radius: 4px;
      text-decoration: none;
      font-weight: bold;
      transition: background 0.3s;
      flex: 1 1 100%;
      text-align: center;
      box-sizing: border-box;
    }
    .open-pdf {
      background: #3498db;
      color: white;
    }
    .open-pdf:hover {
      background: #2980b9;
    }
    .download-pdf {
      background: #27ae60;
      color: white;
    }
    .download-pdf:hover {
      background: #219a52;
    }
    .citations p {
      background: #f8f8f8;
      padding: 1rem;
      border-left: 4px solid #ddd;
      margin-bottom: 1rem;
      font-size: 0.95rem;
    }
    footer {
      text-align: center;
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
      font-size: 0.85rem;
      color: #777;
    }
    @media (max-width: 768px) {
      .container {
        padding: 1.5rem 1rem;
      }
      h1 {
        font-size: 1.5rem;
      }
      .pdf-preview {
        height: 60vh;
        min-height: 300px;
      }
      .buttons {
        flex-direction: column;
        gap: 0.5rem;
      }
      .button {
        width: 100%;
        max-width: 100%;
      }
    }
    @media (max-width: 480px) {
      h1 {
        font-size: 1.3rem;
      }
      .authors {
        font-size: 1rem;
      }
      .pdf-preview {
        height: 50vh;
        min-height: 250px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${article.titulo}</h1>
      <p class="authors">${authorsDisplayEs}</p>
      <p class="meta"><strong>Fecha de publicación:</strong> ${article.fecha}</p>
      <p class="meta"><strong>Volumen:</strong> ${article.volumen}, <strong>Número:</strong> ${article.numero}, <strong>Páginas:</strong> ${article.primeraPagina}-${article.ultimaPagina}</p>
      <p class="meta"><strong>Área temática:</strong> ${article.area}</p>
    </header>
    <main>
      <section>
        <h2>Palabras clave</h2>
        <div class="keywords">
          ${article.palabras_clave.map(kw => `<span class="keyword">${kw}</span>`).join('')}
        </div>
      </section>
      <section>
        <h2>Resumen</h2>
        <p>${article.resumen}</p>
      </section>
      <section>
        <h2>Abstract (English)</h2>
        <p>${article.englishAbstract}</p>
      </section>
      <section>
        <h2>Visualización del PDF</h2>
        <embed src="${article.pdf}" type="application/pdf" class="pdf-preview" />
        <div class="buttons">
          <a href="${article.pdf}" target="_blank" rel="noopener noreferrer" class="button open-pdf">Abrir PDF en nueva pestaña</a>
          <a href="${article.pdf}" download class="button download-pdf">Descargar PDF</a>
        </div>
      </section>
      <section class="citations">
        <h2>Citas</h2>
        <p><strong>APA:</strong> ${authorsAPA}. (${year}). ${article.titulo}. <em>Revista Nacional de las Ciencias para Estudiantes</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</p>
        <p><strong>MLA:</strong> ${authorsMLAEs}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em>, vol. ${article.volumen}, no. ${article.numero}, ${year}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</p>
        <p><strong>Chicago:</strong> ${authorsChicagoEs}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em> ${article.volumen}, no. ${article.numero} (${year}): ${article.primeraPagina}-${article.ultimaPagina}.</p>
      </section>
      <section class="license">
        <h2>Licencia</h2>
        <p>Este artículo se publica bajo licencia <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Atribución 4.0 Internacional (CC BY 4.0)</a>.</p>
        <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by.png" alt="CC BY 4.0" style="width:88px; height:31px;">
      </section>
    </main>
    <footer>
      <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
      <a href="/es/article">Volver a Artículos</a> | <a href="/">Volver al inicio</a>
    </footer>
  </div>
</body>
</html>
  `.trim();
  const filePathEs = path.join(outputHtmlDir, `article-${articleSlug}.html`);
  fs.writeFileSync(filePathEs, htmlContentEs, 'utf8');
  console.log(`Generado HTML de artículo en español: ${filePathEs}`);
  // Generar HTML en inglés (mismo)
  const htmlContentEn = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="citation_title" content="${article.titulo}">
  ${authorMetaTags}
  <meta name="citation_publication_date" content="${article.fecha}">
  <meta name="citation_journal_title" content="Revista Nacional de las Ciencias para Estudiantes">
  <meta name="citation_volume" content="${article.volumen}">
  <meta name="citation_issue" content="${article.numero}">
  <meta name="citation_firstpage" content="${article.primeraPagina}">
  <meta name="citation_lastpage" content="${article.ultimaPagina}">
  <meta name="citation_pdf_url" content="${article.pdf}">
  <meta name="citation_abstract_html_url" content="${domain}/articles/article-${articleSlug}EN.html">
  <meta name="citation_abstract" content="${article.englishAbstract}">
  <meta name="citation_keywords" content="${article.keywords_english.join('; ')}">
  <meta name="citation_language" content="en">
  <meta name="description" content="${article.englishAbstract.substring(0, 160)}...">
  <meta name="keywords" content="${article.keywords_english.join(', ')}">
  <title>${article.titulo} - The National Review of Sciences for Students</title>
  <link rel="stylesheet" href="/index.css">
  <style>
    body {
      font-family: 'Merriweather', serif;
      line-height: 1.8;
      color: #333;
      background-color: #f9f9f9;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1rem;
      background: white;
      box-shadow: 0 0 20px rgba(0,0,0,0.05);
      border-radius: 8px;
      box-sizing: border-box;
    }
    header {
      text-align: center;
      border-bottom: 1px solid #eee;
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }
    h1 {
      font-size: 1.8rem;
      color: #2c3e50;
      margin-bottom: 0.5rem;
    }
    .authors {
      font-size: 1.1rem;
      color: #555;
      margin-bottom: 1rem;
    }
    .meta {
      font-size: 0.9rem;
      color: #777;
      margin-bottom: 0.5rem;
    }
    section {
      margin-bottom: 2rem;
    }
    h2 {
      font-size: 1.3rem;
      color: #34495e;
      border-bottom: 1px solid #ddd;
      padding-bottom: 0.5rem;
      margin-bottom: 1rem;
    }
    p {
      text-align: justify;
    }
    .keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .keyword {
      background: #e8f4fd;
      color: #2980b9;
      padding: 0.3rem 0.8rem;
      border-radius: 20px;
      font-size: 0.85rem;
    }
    .pdf-preview {
      width: 100%;
      height: 600px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-top: 1rem;
      box-sizing: border-box;
    }
    .buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-top: 1rem;
      max-width: 100%;
      box-sizing: border-box;
    }
    .button {
      padding: 0.7rem 1.5rem;
      border-radius: 4px;
      text-decoration: none;
      font-weight: bold;
      transition: background 0.3s;
      flex: 1 1 100%;
      text-align: center;
      box-sizing: border-box;
    }
    .open-pdf {
      background: #3498db;
      color: white;
    }
    .open-pdf:hover {
      background: #2980b9;
    }
    .download-pdf {
      background: #27ae60;
      color: white;
    }
    .download-pdf:hover {
      background: #219a52;
    }
    .citations p {
      background: #f8f8f8;
      padding: 1rem;
      border-left: 4px solid #ddd;
      margin-bottom: 1rem;
      font-size: 0.95rem;
    }
    footer {
      text-align: center;
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
      font-size: 0.85rem;
      color: #777;
    }
    @media (max-width: 768px) {
      .container {
        padding: 1.5rem 1rem;
      }
      h1 {
        font-size: 1.5rem;
      }
      .pdf-preview {
        height: 60vh;
        min-height: 300px;
      }
      .buttons {
        flex-direction: column;
        gap: 0.5rem;
      }
      .button {
        width: 100%;
        max-width: 100%;
      }
    }
    @media (max-width: 480px) {
      h1 {
        font-size: 1.3rem;
      }
      .authors {
        font-size: 1rem;
      }
      .pdf-preview {
        height: 50vh;
        min-height: 250px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${article.titulo}</h1>
      <p class="authors">${authorsDisplayEn}</p>
      <p class="meta"><strong>Publication Date:</strong> ${article.fecha}</p>
      <p class="meta"><strong>Volume:</strong> ${article.volumen}, <strong>Issue:</strong> ${article.numero}, <strong>Pages:</strong> ${article.primeraPagina}-${article.ultimaPagina}</p>
      <p class="meta"><strong>Thematic Area:</strong> ${article.area}</p>
    </header>
    <main>
      <section>
        <h2>Keywords</h2>
        <div class="keywords">
          ${article.keywords_english.map(kw => `<span class="keyword">${kw}</span>`).join('')}
        </div>
      </section>
      <section>
        <h2>Abstract</h2>
        <p>${article.englishAbstract}</p>
      </section>
      <section>
        <h2>PDF Preview</h2>
        <embed src="${article.pdf}" type="application/pdf" class="pdf-preview" />
        <div class="buttons">
          <a href="${article.pdf}" target="_blank" rel="noopener noreferrer" class="button open-pdf">Open PDF in New Tab</a>
          <a href="${article.pdf}" download class="button download-pdf">Download PDF</a>
        </div>
      </section>
      <section class="citations">
        <h2>Citations</h2>
        <p><strong>APA:</strong> ${authorsAPA}. (${year}). ${article.titulo}. <em>Revista Nacional de las Ciencias para Estudiantes</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</p>
        <p><strong>MLA:</strong> ${authorsMLAEn}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em>, vol. ${article.volumen}, no. ${article.numero}, ${year}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</p>
        <p><strong>Chicago:</strong> ${authorsChicagoEn}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em> ${article.volumen}, no. ${article.numero} (${year}): ${article.primeraPagina}-${article.ultimaPagina}.</p>
      </section>
      <section class="license">
        <h2>License</h2>
        <p>This article is published under a <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International (CC BY 4.0)</a> license.</p>
        <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by.png" alt="CC BY 4.0" style="width:88px; height:31px;">
      </section>
    </main>
    <footer>
      <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students</p>
      <a href="/en/article">Back to Articles</a> | <a href="/">Back to home</a>
    </footer>
  </div>
</body>
</html>
  `.trim();
  const filePathEn = path.join(outputHtmlDir, `article-${articleSlug}EN.html`);
  fs.writeFileSync(filePathEn, htmlContentEn, 'utf8');
  console.log(`Generado HTML de artículo en inglés: ${filePathEn}`);
});
    // Generar índice de artículos (mismo)
    const articlesByYear = articles.reduce((acc, article) => {
      const year = new Date(article.fecha).getFullYear() || 'Sin fecha';
      if (!acc[year]) acc[year] = [];
      acc[year].push(article);
      return acc;
    }, {});
    let indexContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Índice de Artículos - Revista Nacional de las Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>Índice de Artículos por Año</h1>
    <p>Accede a los artículos por año de publicación. Cada enlace lleva a la página del artículo con resumen y PDF.</p>
  </header>
  <main>
${Object.keys(articlesByYear).sort().reverse().map(year => `
    <section>
      <h2>Año ${year}</h2>
      <ul>
        ${articlesByYear[year].map(article => {
          const articleSlug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
          return `
          <li>
            <a href="/articles/article-${articleSlug}.html">${article.titulo}</a> - ${article.autores} (Vol. ${article.volumen}, Núm. ${article.numero})
          </li>
        `;
        }).join('')}
      </ul>
    </section>
`).join('')}
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>
    `.trim();
    const indexPath = path.join(outputHtmlDir, 'index.html');
    fs.writeFileSync(indexPath, indexContent, 'utf8');
    console.log(`Generado índice HTML de artículos: ${indexPath}`);
    // Generar índice de artículos en inglés (mismo)
    let indexContentEn = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Index of Articles - The National Review of Sciences for Students</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>Index of Articles by Year</h1>
    <p>Access articles by year of publication. Each link leads to the article page with abstract and PDF.</p>
  </header>
  <main>
${Object.keys(articlesByYear).sort().reverse().map(year => `
    <section>
      <h2>Year ${year}</h2>
      <ul>
        ${articlesByYear[year].map(article => {
          const articleSlug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
          return `
          <li>
            <a href="/articles/article-${articleSlug}EN.html">${article.titulo}</a> - ${article.autores} (Vol. ${article.volumen}, No. ${article.numero})
          </li>
        `;
        }).join('')}
      </ul>
    </section>
`).join('')}
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students</p>
    <a href="/">Back to home</a>
  </footer>
</body>
</html>
    `.trim();
    const indexPathEn = path.join(outputHtmlDir, 'index.EN.html');
    fs.writeFileSync(indexPathEn, indexContentEn, 'utf8');
    console.log(`Generado índice HTML de artículos (EN): ${indexPathEn}`);
    // Nuevo: Procesar volúmenes
    const volumesRes = await fetch(volumesCsvUrl);
    if (!volumesRes.ok) throw new Error(`Error descargando CSV de volúmenes: ${volumesRes.statusText}`);
    const volumesCsvData = await volumesRes.text();
    const volumesParsed = Papa.parse(volumesCsvData, { header: true, skipEmptyLines: true });
    const volumes = volumesParsed.data.map(row => ({
      volumen: row['Volumen'] || '',
      numero: row['Número'] || '',
      fecha: parseDateFlexible(row['Fecha']),
      titulo: row['Título'] || 'Sin título',
      resumen: row['Resumen'] || 'Resumen no disponible',
      abstract: row['Abstract'] || 'Abstract not available',
      portada: getImageSrc(row['Portada']),
      pdf: row['PDF'] || '',
      area: row['Área temática'] || '',
      palabras_clave: row['Palabras clave']
        ? row['Palabras clave'].split(/[;,]/).map(k => k.trim())
        : [],
      keywords: row['Keywords']
        ? row['Keywords'].split(';').map(k => k.trim())
        : []
    }));
    fs.writeFileSync(volumesOutputJson, JSON.stringify(volumes, null, 2), 'utf8');
    console.log(`✅ Archivo generado: ${volumesOutputJson} (${volumes.length} volúmenes)`);
    volumes.forEach(volume => {
      const volumeSlug = `${volume.volumen}-${volume.numero}`;
      const pdfTitleSlug = generateSlug(volume.titulo);
      const pdfFileName = `Volume-${pdfTitleSlug}-${volume.numero}.pdf`;
      volume.pdf = `${domain}/Volumes/${pdfFileName}`;
      const year = new Date(volume.fecha).getFullYear();
      // Generar HTML en español para volumen
      const htmlContentEs = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="citation_title" content="${volume.titulo}">
  <meta name="citation_publication_date" content="${volume.fecha}">
  <meta name="citation_journal_title" content="Revista Nacional de las Ciencias para Estudiantes">
  <meta name="citation_volume" content="${volume.volumen}">
  <meta name="citation_issue" content="${volume.numero}">
  <meta name="citation_pdf_url" content="${volume.pdf}">
  <meta name="citation_abstract_html_url" content="${domain}/volumes/volume-${volumeSlug}.html">
  <meta name="citation_abstract" content="${volume.resumen}">
  <meta name="citation_abstract" xml:lang="en" content="${volume.abstract}">
  <meta name="citation_keywords" content="${volume.palabras_clave.join('; ')}">
  <meta name="citation_language" content="es">
  <meta name="description" content="${volume.resumen.substring(0, 160)}...">
  <meta name="keywords" content="${volume.palabras_clave.join(', ')}">
  <title>Volumen ${volume.volumen} Número ${volume.numero} - Revista Nacional de las Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
  <style>
    /* Estilo profesional: fondos gradient, bordes azules, tipografía elegante */
    body {
      font-family: 'Merriweather', serif;
      line-height: 1.8;
      color: #333;
      background: linear-gradient(to bottom, #f9f9f9, #fff);
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 3rem 2rem;
      background: white;
      box-shadow: 0 0 30px rgba(0,0,0,0.1);
      border-radius: 12px;
      border: 1px solid #3498db; /* Azul */
      box-sizing: border-box;
    }
    header {
      text-align: center;
      border-bottom: 2px solid #3498db;
      padding-bottom: 1.5rem;
      margin-bottom: 3rem;
    }
    h1 {
      font-size: 2.2rem;
      color: #2980b9; /* Azul oscuro */
      margin-bottom: 0.5rem;
      font-weight: bold;
    }
    .meta {
      font-size: 1rem;
      color: #555;
      margin-bottom: 0.5rem;
    }
    section {
      margin-bottom: 2.5rem;
    }
    h2 {
      font-size: 1.5rem;
      color: #2980b9;
      border-bottom: 1px solid #3498db;
      padding-bottom: 0.5rem;
      margin-bottom: 1.5rem;
    }
    p {
      text-align: justify;
    }
    .keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .keyword {
      background: #e8f4fd;
      color: #2980b9;
      padding: 0.4rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      border: 1px solid #3498db;
    }
    .pdf-preview {
      width: 100%;
      height: 700px;
      border: 1px solid #3498db;
      border-radius: 8px;
      margin-top: 1.5rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .buttons {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      margin-top: 2rem;
    }
    .button {
      padding: 0.8rem 2rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: bold;
      transition: all 0.3s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .open-pdf {
      background: #3498db;
      color: white;
    }
    .open-pdf:hover {
      background: #2980b9;
    }
    .download-pdf {
      background: #27ae60;
      color: white;
    }
    .download-pdf:hover {
      background: #219a52;
    }
    footer {
      text-align: center;
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid #3498db;
      font-size: 0.9rem;
      color: #777;
    }
    @media (max-width: 768px) {
      .container {
        padding: 2rem 1rem;
      }
      h1 {
        font-size: 1.8rem;
      }
      .pdf-preview {
        height: 500px;
      }
      .buttons {
        flex-direction: column;
        gap: 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Volumen ${volume.volumen} - Número ${volume.numero}</h1>
      <p class="meta"><strong>Fecha de publicación:</strong> ${volume.fecha}</p>
      <p class="meta"><strong>Área temática:</strong> ${volume.area}</p>
    </header>
    <main>
      <section>
        <h2>Palabras clave</h2>
        <div class="keywords">
          ${volume.palabras_clave.map(kw => `<span class="keyword">${kw}</span>`).join('')}
        </div>
      </section>
      <section>
        <h2>Resumen</h2>
        <p>${volume.resumen}</p>
      </section>
      <section>
        <h2>Abstract (English)</h2>
        <p>${volume.abstract}</p>
      </section>
      <section>
        <h2>Visualización del PDF</h2>
        <embed src="${volume.pdf}" type="application/pdf" class="pdf-preview" />
        <div class="buttons">
          <a href="${volume.pdf}" target="_blank" rel="noopener noreferrer" class="button open-pdf">Abrir PDF en nueva pestaña</a>
          <a href="${volume.pdf}" download class="button download-pdf">Descargar PDF</a>
        </div>
      </section>
      <section class="license">
        <h2>Licencia</h2>
        <p>Este volumen se publica bajo licencia <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Atribución 4.0 Internacional (CC BY 4.0)</a>.</p>
        <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by.png" alt="CC BY 4.0" style="width:88px; height:31px;">
      </section>
    </main>
    <footer>
      <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
      <a href="/es/volume">Volver a Volúmenes</a> | <a href="/">Volver al inicio</a>
    </footer>
  </div>
</body>
</html>
  `.trim();
  const filePathEs = path.join(volumesOutputHtmlDir, `volume-${volumeSlug}.html`);
  fs.writeFileSync(filePathEs, htmlContentEs, 'utf8');
  console.log(`Generado HTML de volumen en español: ${filePathEs}`);
      // Generar HTML en inglés para volumen
      const htmlContentEn = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="citation_title" content="${volume.titulo}">
  <meta name="citation_publication_date" content="${volume.fecha}">
  <meta name="citation_journal_title" content="Revista Nacional de las Ciencias para Estudiantes">
  <meta name="citation_volume" content="${volume.volumen}">
  <meta name="citation_issue" content="${volume.numero}">
  <meta name="citation_pdf_url" content="${volume.pdf}">
  <meta name="citation_abstract_html_url" content="${domain}/volumes/volume-${volumeSlug}EN.html">
  <meta name="citation_abstract" content="${volume.abstract}">
  <meta name="citation_keywords" content="${volume.keywords.join('; ')}">
  <meta name="citation_language" content="en">
  <meta name="description" content="${volume.abstract.substring(0, 160)}...">
  <meta name="keywords" content="${volume.keywords.join(', ')}">
  <title>Volume ${volume.volumen} Issue ${volume.numero} - The National Review of Sciences for Students</title>
  <link rel="stylesheet" href="/index.css">
  <style>
    /* Estilo profesional: fondos gradient, bordes azules, tipografía elegante */
    body {
      font-family: 'Merriweather', serif;
      line-height: 1.8;
      color: #333;
      background: linear-gradient(to bottom, #f9f9f9, #fff);
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 3rem 2rem;
      background: white;
      box-shadow: 0 0 30px rgba(0,0,0,0.1);
      border-radius: 12px;
      border: 1px solid #3498db; /* Blue */
      box-sizing: border-box;
    }
    header {
      text-align: center;
      border-bottom: 2px solid #3498db;
      padding-bottom: 1.5rem;
      margin-bottom: 3rem;
    }
    h1 {
      font-size: 2.2rem;
      color: #2980b9; /* Dark blue */
      margin-bottom: 0.5rem;
      font-weight: bold;
    }
    .meta {
      font-size: 1rem;
      color: #555;
      margin-bottom: 0.5rem;
    }
    section {
      margin-bottom: 2.5rem;
    }
    h2 {
      font-size: 1.5rem;
      color: #2980b9;
      border-bottom: 1px solid #3498db;
      padding-bottom: 0.5rem;
      margin-bottom: 1.5rem;
    }
    p {
      text-align: justify;
    }
    .keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .keyword {
      background: #e8f4fd;
      color: #2980b9;
      padding: 0.4rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      border: 1px solid #3498db;
    }
    .pdf-preview {
      width: 100%;
      height: 700px;
      border: 1px solid #3498db;
      border-radius: 8px;
      margin-top: 1.5rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .buttons {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      margin-top: 2rem;
    }
    .button {
      padding: 0.8rem 2rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: bold;
      transition: all 0.3s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .open-pdf {
      background: #3498db;
      color: white;
    }
    .open-pdf:hover {
      background: #2980b9;
    }
    .download-pdf {
      background: #27ae60;
      color: white;
    }
    .download-pdf:hover {
      background: #219a52;
    }
    footer {
      text-align: center;
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid #3498db;
      font-size: 0.9rem;
      color: #777;
    }
    @media (max-width: 768px) {
      .container {
        padding: 2rem 1rem;
      }
      h1 {
        font-size: 1.8rem;
      }
      .pdf-preview {
        height: 500px;
      }
      .buttons {
        flex-direction: column;
        gap: 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Volume ${volume.volumen} - Issue ${volume.numero}</h1>
      <p class="meta"><strong>Publication Date:</strong> ${volume.fecha}</p>
      <p class="meta"><strong>Thematic Area:</strong> ${volume.area}</p>
    </header>
    <main>
      <section>
        <h2>Keywords</h2>
        <div class="keywords">
          ${volume.keywords.map(kw => `<span class="keyword">${kw}</span>`).join('')}
        </div>
      </section>
      <section>
        <h2>Abstract</h2>
        <p>${volume.abstract}</p>
      </section>
      <section>
        <h2>PDF Preview</h2>
        <embed src="${volume.pdf}" type="application/pdf" class="pdf-preview" />
        <div class="buttons">
          <a href="${volume.pdf}" target="_blank" rel="noopener noreferrer" class="button open-pdf">Open PDF in New Tab</a>
          <a href="${volume.pdf}" download class="button download-pdf">Download PDF</a>
        </div>
      </section>
      <section class="license">
        <h2>License</h2>
        <p>This volume is published under a <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International (CC BY 4.0)</a> license.</p>
        <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by.png" alt="CC BY 4.0" style="width:88px; height:31px;">
      </section>
    </main>
    <footer>
      <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students</p>
      <a href="/en/volume">Back to Volumes</a> | <a href="/">Back to home</a>
    </footer>
  </div>
</body>
</html>
  `.trim();
      const filePathEn = path.join(volumesOutputHtmlDir, `volume-${volumeSlug}EN.html`);
      fs.writeFileSync(filePathEn, htmlContentEn, 'utf8');
      console.log(`Generado HTML de volumen en inglés: ${filePathEn}`);
    });
    // Generar índice de volúmenes
    const volumesByYear = volumes.reduce((acc, volume) => {
      const year = new Date(volume.fecha).getFullYear() || 'Sin fecha';
      if (!acc[year]) acc[year] = [];
      acc[year].push(volume);
      return acc;
    }, {});
    let volumesIndexContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Índice de Volúmenes - Revista Nacional de las Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>Índice de Volúmenes por Año</h1>
    <p>Accede a los volúmenes por año de publicación. Cada enlace lleva a la página del volumen con resumen y PDF.</p>
  </header>
  <main>
${Object.keys(volumesByYear).sort().reverse().map(year => `
    <section>
      <h2>Año ${year}</h2>
      <ul>
        ${volumesByYear[year].map(volume => {
          const volumeSlug = `${volume.volumen}-${volume.numero}`;
          return `
          <li>
            <a href="/volumes/volume-${volumeSlug}.html">Volumen ${volume.volumen}, Número ${volume.numero}</a> - ${volume.titulo} (${volume.fecha})
          </li>
        `;
        }).join('')}
      </ul>
    </section>
`).join('')}
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>
    `.trim();
    const volumesIndexPath = path.join(volumesOutputHtmlDir, 'index.html');
    fs.writeFileSync(volumesIndexPath, volumesIndexContent, 'utf8');
    console.log(`Generado índice HTML de volúmenes: ${volumesIndexPath}`);
    let volumesIndexContentEn = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Index of Volumes - The National Review of Sciences for Students</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>Index of Volumes by Year</h1>
    <p>Access volumes by year of publication. Each link leads to the volume page with abstract and PDF.</p>
  </header>
  <main>
${Object.keys(volumesByYear).sort().reverse().map(year => `
    <section>
      <h2>Year ${year}</h2>
      <ul>
        ${volumesByYear[year].map(volume => {
          const volumeSlug = `${volume.volumen}-${volume.numero}`;
          return `
          <li>
            <a href="/volumes/volume-${volumeSlug}EN.html">Volume ${volume.volumen}, Issue ${volume.numero}</a> - ${volume.titulo} (${volume.fecha})
          </li>
        `;
        }).join('')}
      </ul>
    </section>
`).join('')}
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students</p>
    <a href="/">Back to home</a>
  </footer>
</body>
</html>
    `.trim();
    const volumesIndexPathEn = path.join(volumesOutputHtmlDir, 'index.EN.html');
    fs.writeFileSync(volumesIndexPathEn, volumesIndexContentEn, 'utf8');
    console.log(`Generado índice HTML de volúmenes (EN): ${volumesIndexPathEn}`);
    // Procesar noticias
    const newsRes = await fetch(newsCsvUrl);
    if (!newsRes.ok) throw new Error(`Error descargando CSV de noticias: ${newsRes.statusText}`);
    const newsCsvData = await newsRes.text();
    const newsParsed = Papa.parse(newsCsvData, { header: true, skipEmptyLines: true });
    const newsItems = newsParsed.data
      .filter(
        (row) =>
          (row["Título"] || "").trim() !== "" &&
          (row["Contenido de la noticia"] || "").trim() !== ""
      )
      .map((row) => ({
        titulo: String(row["Título"] ?? ""),
        cuerpo: base64DecodeUnicode(String(row["Contenido de la noticia"] ?? "")),
        fecha: parseDateFlexible(String(row["Fecha"] ?? "")),
        title: String(row["Title"] ?? ""),
        content: base64DecodeUnicode(String(row["Content of the new"] ?? "")),
      }));
    for (const newsItem of newsItems) {
      const slug = generateSlug(`${newsItem.titulo} ${newsItem.fecha}`);
      const esContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${newsItem.titulo.substring(0, 160)}...">
  <meta name="keywords" content="noticias, revista ciencias estudiantes, ${newsItem.titulo.replace(/[^a-zA-Z0-9]/g, ' ').substring(0, 100)}">
  <title>${newsItem.titulo} - Noticias - Revista Nacional de las Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
  <style>
    body {
      font-family: 'Merriweather', serif;
      line-height: 1.8;
      color: #333;
      background-color: #f9f9f9;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1rem;
      background: white;
      box-shadow: 0 0 20px rgba(0,0,0,0.05);
      border-radius: 8px;
      box-sizing: border-box;
    }
    header {
      text-align: center;
      border-bottom: 1px solid #eee;
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }
    .logo {
      width: 80px;
      height: auto;
      margin-bottom: 1rem;
      transition: transform 0.3s ease;
    }
    .logo:hover {
      transform: scale(1.05);
    }
    h1 {
      font-size: 1.8rem;
      color: #2c3e50;
      margin-bottom: 0.5rem;
    }
    .date {
      font-size: 0.9rem;
      color: #777;
      margin-bottom: 1rem;
    }
    main {
      margin-bottom: 2rem;
    }
    .content {
      text-align: justify;
    }
    .content p {
      margin-bottom: 1.5rem;
    }
    .content h2, .content h3 {
      color: #34495e;
      margin-top: 2rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid #ddd;
      padding-bottom: 0.5rem;
    }
    .content strong {
      color: #2980b9;
    }
    .content a {
      color: #3498db;
      text-decoration: none;
    }
    .content a:hover {
      text-decoration: underline;
      color: #2980b9;
    }
    .content img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1rem 0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    footer {
      text-align: center;
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
      font-size: 0.85rem;
      color: #777;
    }
    footer a {
      color: #3498db;
      text-decoration: none;
      margin: 0 1rem;
    }
    footer a:hover {
      color: #2980b9;
      text-decoration: underline;
    }
    @media (max-width: 768px) {
      .container {
        padding: 1.5rem 1rem;
      }
      h1 {
        font-size: 1.5rem;
      }
      .logo {
        width: 60px;
      }
    }
    @media (max-width: 480px) {
      h1 {
        font-size: 1.3rem;
      }
    }
    .content {
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <a href="/">
        <img src="/logo.png" alt="Logo de Revista Nacional de las Ciencias para Estudiantes" class="logo">
      </a>
      <h1>${newsItem.titulo}</h1>
      <p class="date">Publicado el ${newsItem.fecha}</p>
    </header>
    <main>
      <div class="content ql-editor">
        ${newsItem.cuerpo}
      </div>
    </main>
    <footer>
      <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
      <a href="/es/new">Volver a Noticias</a> | <a href="/">Volver al inicio</a>
    </footer>
  </div>
</body>
</html>`;
      const enContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${newsItem.title.substring(0, 160)}...">
  <meta name="keywords" content="news, student science journal, ${newsItem.title.replace(/[^a-zA-Z0-9]/g, ' ').substring(0, 100)}">
  <title>${newsItem.title} - News - The National Review of Sciences for Students</title>
  <link rel="stylesheet" href="/index.css">
  <style>
    body {
      font-family: 'Merriweather', serif;
      line-height: 1.8;
      color: #333;
      background-color: #f9f9f9;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1rem;
      background: white;
      box-shadow: 0 0 20px rgba(0,0,0,0.05);
      border-radius: 8px;
      box-sizing: border-box;
    }
    header {
      text-align: center;
      border-bottom: 1px solid #eee;
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }
    .logo {
      width: 80px;
      height: auto;
      margin-bottom: 1rem;
      transition: transform 0.3s ease;
    }
    .logo:hover {
      transform: scale(1.05);
    }
    h1 {
      font-size: 1.8rem;
      color: #2c3e50;
      margin-bottom: 0.5rem;
    }
    .date {
      font-size: 0.9rem;
      color: #777;
      margin-bottom: 1rem;
    }
    main {
      margin-bottom: 2rem;
    }
    .content {
      text-align: justify;
    }
    .content p {
      margin-bottom: 1.5rem;
    }
    .content h2, .content h3 {
      color: #34495e;
      margin-top: 2rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid #ddd;
      padding-bottom: 0.5rem;
    }
    .content strong {
      color: #2980b9;
    }
    .content a {
      color: #3498db;
      text-decoration: none;
    }
    .content a:hover {
      text-decoration: underline;
      color: #2980b9;
    }
    .content img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1rem 0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    footer {
      text-align: center;
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
      font-size: 0.85rem;
      color: #777;
    }
    footer a {
      color: #3498db;
      text-decoration: none;
      margin: 0 1rem;
    }
    footer a:hover {
      color: #2980b9;
      text-decoration: underline;
    }
    @media (max-width: 768px) {
      .container {
        padding: 1.5rem 1rem;
      }
      h1 {
        font-size: 1.5rem;
      }
      .logo {
        width: 60px;
      }
    }
    @media (max-width: 480px) {
      h1 {
        font-size: 1.3rem;
      }
    }
    .content {
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <a href="/">
        <img src="/logoEN.png" alt="Logo of The National Review of Sciences for Students" class="logo">
      </a>
      <h1>${newsItem.title}</h1>
      <p class="date">Published on ${newsItem.fecha}</p>
    </header>
    <main>
      <div class="content ql-editor">
        ${newsItem.content}
      </div>
    </main>
    <footer>
      <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students</p>
      <a href="/en/new">Back to News</a> | <a href="/">Back to home</a>
    </footer>
  </div>
</body>
</html>`;
      const esPath = path.join(newsOutputHtmlDir, `${slug}.html`);
      fs.writeFileSync(esPath, esContent, 'utf8');
      console.log(`Generado HTML de noticia (ES): ${esPath}`);
      const enPath = path.join(newsOutputHtmlDir, `${slug}.EN.html`);
      fs.writeFileSync(enPath, enContent, 'utf8');
      console.log(`Generado HTML de noticia (EN): ${enPath}`);
    }
    // Generar índice de noticias
    const newsByYear = newsItems.reduce((acc, item) => {
      const year = new Date(item.fecha).getFullYear() || 'Sin fecha';
      if (!acc[year]) acc[year] = [];
      acc[year].push(item);
      return acc;
    }, {});
    let newsIndexContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Índice de Noticias - Revista Nacional de las Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>Índice de Noticias por Año</h1>
    <p>Accede a las noticias por año de publicación.</p>
  </header>
  <main>
${Object.keys(newsByYear).sort().reverse().map(year => `
    <section>
      <h2>Año ${year}</h2>
      <ul>
        ${newsByYear[year].map(item => {
          const slug = generateSlug(item.titulo + ' ' + item.fecha);
          return `
          <li>
            <a href="/news/${slug}.html">${item.titulo}</a> (${item.fecha})
          </li>
        `;
        }).join('')}
      </ul>
    </section>
`).join('')}
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>
    `.trim();
    const newsIndexPath = path.join(newsOutputHtmlDir, 'index.html');
    fs.writeFileSync(newsIndexPath, newsIndexContent, 'utf8');
    console.log(`Generado índice HTML de noticias: ${newsIndexPath}`);
    let newsIndexContentEn = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>News Index - The National Review of Sciences for Students</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>News Index by Year</h1>
    <p>Access news by year of publication.</p>
  </header>
  <main>
${Object.keys(newsByYear).sort().reverse().map(year => `
    <section>
      <h2>Year ${year}</h2>
      <ul>
        ${newsByYear[year].map(item => {
          const slug = generateSlug(item.titulo + ' ' + item.fecha);
          return `
          <li>
            <a href="/news/${slug}.EN.html">${item.title}</a> (${item.fecha})
          </li>
        `;
        }).join('')}
      </ul>
    </section>
`).join('')}
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students</p>
    <a href="/">Back to home</a>
  </footer>
</body>
</html>
    `.trim();
    const newsIndexPathEn = path.join(newsOutputHtmlDir, 'index.EN.html');
    fs.writeFileSync(newsIndexPathEn, newsIndexContentEn, 'utf8');
    console.log(`Generado índice HTML de noticias (EN): ${newsIndexPathEn}`);
    // Procesar equipo
    const allMembers = teamParsed.data.filter(row => (row['Nombre'] || '').trim() !== '');
    for (const member of allMembers) {
      const rolesEs = (member['Rol en la Revista'] || '').split(';').map(r => r.trim()).filter(r => r);
      const rolesEnList = (member['Role in the Journal'] || '').split(';').map(r => r.trim()).filter(r => r);
      const nombre = member['Nombre'] || 'Miembro desconocido';
      const publishedArticles = authorToArticles[nombre] || [];
      const isAuthor = publishedArticles.length > 0;
      let filteredRolesEs = rolesEs;
      let filteredRolesEn = rolesEnList;
      if (rolesEs.length > 1) {
        filteredRolesEs = rolesEs.filter(r => r.toLowerCase() !== 'autor');
      }
      if (rolesEnList.length > 1) {
        filteredRolesEn = rolesEnList.filter(r => r.toLowerCase() !== 'author');
      }
      const rolesStr = filteredRolesEs.join(', ') || 'No especificado';
      const rolesEn = filteredRolesEn.join(', ') || 'Not specified';
      const slug = generateSlug(nombre);
      const descripcion = member['Descripción'] || 'Información no disponible';
      const description = member['Description'] || 'Information not available';
      const areas = member['Áreas de interés'] || 'No especificadas';
      const areasEn = member['Areas of interest'] || 'Not specified';
      const areasList = areas.split(';').map(a => a.trim()).filter(a => a);
      const areasListEn = areasEn.split(';').map(a => a.trim()).filter(a => a);
      const imagen = getImageSrc(member['Imagen'] || '');
      const institution = member['Institution'] || '';
      const areasTagsHtml = areasList.length ? areasList.map(area => `<span class="area-tag">${area}</span>`).join('') : '<p>No especificadas</p>';
      const areasTagsHtmlEn = areasListEn.length ? areasListEn.map(area => `<span class="area-tag">${area}</span>`).join('') : '<p>Not specified</p>';
      const articlesSectionEs = isAuthor ? `
      <div class="section">
        <h2>Artículos Publicados</h2>
        <div class="articles-container">
          ${publishedArticles.map(article => {
            const articleSlug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
            return `
            <div class="article-card">
              <h3><a href="/articles/article-${articleSlug}.html">${article.titulo}</a></h3>
              <p class="authors">${article.autores}</p>
              <p class="meta">Fecha: ${article.fecha} | Volumen: ${article.volumen}, Número: ${article.numero}, Páginas: ${article.primeraPagina}-${article.ultimaPagina}</p>
            </div>
            `;
          }).join('')}
        </div>
      </div>` : '';
      const articlesSectionEn = isAuthor ? `
      <div class="section">
        <h2>Published Articles</h2>
        <div class="articles-container">
          ${publishedArticles.map(article => {
            const articleSlug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
            return `
            <div class="article-card">
              <h3><a href="/articles/article-${articleSlug}EN.html">${article.titulo}</a></h3>
              <p class="authors">${article.autores}</p>
              <p class="meta">Date: ${article.fecha} | Volume: ${article.volumen}, Issue: ${article.numero}, Pages: ${article.primeraPagina}-${article.ultimaPagina}</p>
            </div>
            `;
          }).join('')}
        </div>
      </div>` : '';
      const institutionHtmlEs = institution ? `<p class="institution">${institution}</p>` : '';
      const institutionHtmlEn = institution ? `<p class="institution">${institution}</p>` : '';
      const esContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${descripcion.substring(0, 160)}...">
  <meta name="keywords" content="${areas}, ${rolesStr}, Revista Nacional de las Ciencias para Estudiantes">
  <meta name="author" content="${nombre}">
  <title>${nombre} - Equipo de Revista Nacional de las Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
  <style>
    body {
      background-color: #f8f9fa;
      font-family: 'Merriweather', 'Georgia', serif;
      color: #2d3748;
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    .profile-container {
      max-width: 900px;
      margin: 3rem auto;
      padding: 2rem;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      text-align: center;
    }
    .profile-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    @media (min-width: 768px) {
      .profile-header {
        flex-direction: row;
        align-items: flex-start;
        text-align: left;
      }
    }
    .profile-img {
      width: 180px;
      height: 180px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center;
      border: 3px solid #2b6cb0;
      transition: transform 0.3s ease;
      display: block;
    }
    .profile-img:hover {
      transform: scale(1.05);
    }
    .profile-img-fallback {
      width: 180px;
      height: 180px;
      border-radius: 50%;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      color: #4a5568;
      border: 3px solid #2b6cb0;
    }
    .profile-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
    @media (min-width: 768px) {
      .profile-info {
        align-items: flex-start;
      }
    }
    .section {
      margin-top: 2rem;
      text-align: justify;
    }
    .areas-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
    }
    @media (min-width: 768px) {
      .areas-tags {
        justify-content: flex-start;
      }
    }
    .area-tag {
      background: #2d3748;
      color: #ffffff;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 500;
      display: inline-block;
    }
    .articles-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .article-card {
      background: #f9fafb;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .article-card h3 {
      margin-bottom: 0.5rem;
      font-size: 1.2rem;
    }
    .article-card h3 a {
      color: #2b6cb0;
      text-decoration: none;
    }
    .article-card h3 a:hover {
      text-decoration: underline;
    }
    .article-card .authors {
      font-style: italic;
      color: #4a5568;
      margin-bottom: 0.5rem;
    }
    .article-card .meta {
      font-size: 0.9rem;
      color: #718096;
    }
    h1 {
      color: #2b6cb0;
      font-size: 2.25rem;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }
    h2 {
      color: #2d3748;
      font-size: 1.5rem;
      margin-bottom: 1rem;
      font-weight: 600;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.5rem;
    }
    .role {
      font-size: 1.1rem;
      color: #4a5568;
      font-weight: 500;
      background: #edf2f7;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      display: inline-block;
    }
    .institution {
      font-size: 1rem;
      color: #4a5568;
      font-weight: 500;
      background: #e2e8f0;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      display: inline-block;
    }
    p {
      margin-bottom: 1rem;
      color: #4a5568;
      font-size: 1rem;
    }
    footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 0.9rem;
      color: #718096;
    }
    a {
      color: #2b6cb0;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s ease;
    }
    a:hover {
      color: #1a4971;
      text-decoration: underline;
    }
    @media (max-width: 640px) {
      .profile-container {
        padding: 1.5rem;
      }
      .profile-img, .profile-img-fallback {
        width: 150px;
        height: 150px;
      }
      h1 {
        font-size: 1.75rem;
      }
      h2 {
        font-size: 1.25rem;
      }
      .area-tag {
        font-size: 0.8rem;
        padding: 0.4rem 0.8rem;
      }
    }
  </style>
</head>
<body>
  <div class="profile-container">
    <div class="profile-header">
      <div class="profile-img-container">
        ${imagen ? `<img src="${imagen}" alt="Foto de ${nombre}" class="profile-img">` : `<div class="profile-img-fallback">Sin Imagen</div>`}
      </div>
      <div class="profile-info">
        <h1>${nombre}</h1>
        <p class="role">${rolesStr}</p>
        ${institutionHtmlEs}
      </div>
    </div>
    <div class="section">
      <h2>Descripción</h2>
      <p>${descripcion}</p>
    </div>
    <div class="section">
      <h2>Áreas de interés</h2>
      <div class="areas-tags">
        ${areasTagsHtml}
      </div>
    </div>
    ${articlesSectionEs}
    <footer>
      <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
      <a href="/">Volver al inicio</a>
    </footer>
  </div>
</body>
</html>`;
      const enContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${description.substring(0, 160)}...">
  <meta name="keywords" content="${areasEn}, ${rolesEn}, The National Review of Sciences for Students">
  <meta name="author" content="${nombre}">
  <title>${nombre} - Team of The National Review of Sciences for Students</title>
  <link rel="stylesheet" href="/index.css">
  <style>
    body {
      background-color: #f8f9fa;
      font-family: 'Merriweather', 'Georgia', serif;
      color: #2d3748;
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    .profile-container {
      max-width: 900px;
      margin: 3rem auto;
      padding: 2rem;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      text-align: center;
    }
    .profile-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    @media (min-width: 768px) {
      .profile-header {
        flex-direction: row;
        align-items: flex-start;
        text-align: left;
      }
    }
    .profile-img {
      width: 180px;
      height: 180px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center;
      border: 3px solid #2b6cb0;
      transition: transform 0.3s ease;
      display: block;
    }
    .profile-img:hover {
      transform: scale(1.05);
    }
    .profile-img-fallback {
      width: 180px;
      height: 180px;
      border-radius: 50%;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      color: #4a5568;
      border: 3px solid #2b6cb0;
    }
    .profile-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
    @media (min-width: 768px) {
      .profile-info {
        align-items: flex-start;
      }
    }
    .section {
      margin-top: 2rem;
      text-align: justify;
    }
    .areas-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
    }
    @media (min-width: 768px) {
      .areas-tags {
        justify-content: flex-start;
      }
    }
    .area-tag {
      background: #2d3748;
      color: #ffffff;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 500;
      display: inline-block;
    }
    .articles-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .article-card {
      background: #f9fafb;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .article-card h3 {
      margin-bottom: 0.5rem;
      font-size: 1.2rem;
    }
    .article-card h3 a {
      color: #2b6cb0;
      text-decoration: none;
    }
    .article-card h3 a:hover {
      text-decoration: underline;
    }
    .article-card .authors {
      font-style: italic;
      color: #4a5568;
      margin-bottom: 0.5rem;
    }
    .article-card .meta {
      font-size: 0.9rem;
      color: #718096;
    }
    h1 {
      color: #2b6cb0;
      font-size: 2.25rem;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }
    h2 {
      color: #2d3748;
      font-size: 1.5rem;
      margin-bottom: 1rem;
      font-weight: 600;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.5rem;
    }
    .role {
      font-size: 1.1rem;
      color: #4a5568;
      font-weight: 500;
      background: #edf2f7;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      display: inline-block;
    }
    .institution {
      font-size: 1rem;
      color: #4a5568;
      font-weight: 500;
      background: #e2e8f0;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      display: inline-block;
    }
    p {
      margin-bottom: 1rem;
      color: #4a5568;
      font-size: 1rem;
    }
    footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 0.9rem;
      color: #718096;
    }
    a {
      color: #2b6cb0;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s ease;
    }
    a:hover {
      color: #1a4971;
      text-decoration: underline;
    }
    @media (max-width: 640px) {
      .profile-container {
        padding: 1.5rem;
      }
      .profile-img, .profile-img-fallback {
        width: 150px;
        height: 150px;
      }
      h1 {
        font-size: 1.75rem;
      }
      h2 {
        font-size: 1.25rem;
      }
      .area-tag {
        font-size: 0.8rem;
        padding: 0.4rem 0.8rem;
      }
    }
  </style>
</head>
<body>
  <div class="profile-container">
    <div class="profile-header">
      <div class="profile-img-container">
        ${imagen ? `<img src="${imagen}" alt="Photo of ${nombre}" class="profile-img">` : `<div class="profile-img-fallback">No Image</div>`}
      </div>
      <div class="profile-info">
        <h1>${nombre}</h1>
        <p class="role">${rolesEn}</p>
        ${institutionHtmlEn}
      </div>
    </div>
    <div class="section">
      <h2>Description</h2>
      <p>${description}</p>
    </div>
    <div class="section">
      <h2>Areas of Interest</h2>
      <div class="areas-tags">
        ${areasTagsHtmlEn}
      </div>
    </div>
    ${articlesSectionEn}
    <footer>
      <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students</p>
      <a href="/">Back to home</a>
    </footer>
  </div>
</body>
</html>`;
      const esPath = path.join(teamOutputHtmlDir, `${slug}.html`);
      fs.writeFileSync(esPath, esContent, 'utf8');
      console.log(`Generado HTML de miembro (ES): ${esPath}`);
      const enPath = path.join(teamOutputHtmlDir, `${slug}.EN.html`);
      fs.writeFileSync(enPath, enContent, 'utf8');
      console.log(`Generado HTML de miembro (EN): ${enPath}`);
    }
    // Pre-renderizar rutas de la SPA
    console.log('🚀 Pre-renderizando las rutas de la aplicación...');
    const appShellPath = path.join(__dirname, 'dist', 'index.html');
    if (!fs.existsSync(appShellPath)) {
      throw new Error('El archivo principal dist/index.html no se encontró. Asegúrate de compilar la aplicación primero.');
    }
    const appShellContent = fs.readFileSync(appShellPath, 'utf8');
    const spaRoutes = [
      '/es/about', '/es/guidelines', '/es/faq', '/es/article', '/es/submit', '/es/team', '/es/new', '/es/login', '/es/admin', '/es/volume',
      '/en/about', '/en/guidelines', '/en/faq', '/en/article', '/en/submit', '/en/team', '/en/new', '/en/login', '/en/admin', '/en/volume'
    ];
    spaRoutes.forEach(route => {
      const routePath = path.join(__dirname, 'dist', route);
      if (!fs.existsSync(routePath)) {
        fs.mkdirSync(routePath, { recursive: true });
      }
      const indexPath = path.join(routePath, 'index.html');
      fs.writeFileSync(indexPath, appShellContent, 'utf8');
    });
    console.log(`✅ ${spaRoutes.length} rutas de la aplicación pre-renderizadas.`);
    // Generar sitemap
    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
<!-- Created for Revista Nacional de las Ciencias para Estudiantes -->
<url>
  <loc>${domain}/</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>1.0</priority>
</url>
<url>
  <loc>${domain}/articles/index.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
<url>
  <loc>${domain}/articles/index.EN.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
${articles.map(article => {
  const articleSlug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
  return `
<url>
  <loc>${domain}/articles/article-${articleSlug}.html</loc>
  <lastmod>${article.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
<url>
  <loc>${domain}/articles/article-${articleSlug}EN.html</loc>
  <lastmod>${article.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
<url>
  <loc>${article.pdf}</loc>
  <lastmod>${article.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>`;
}).join('')}
<url>
  <loc>${domain}/volumes/index.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
<url>
  <loc>${domain}/volumes/index.EN.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
${volumes.map(volume => {
  const volumeSlug = `${volume.volumen}-${volume.numero}`;
  return `
<url>
  <loc>${domain}/volumes/volume-${volumeSlug}.html</loc>
  <lastmod>${volume.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
<url>
  <loc>${domain}/volumes/volume-${volumeSlug}EN.html</loc>
  <lastmod>${volume.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
<url>
  <loc>${volume.pdf}</loc>
  <lastmod>${volume.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>`;
}).join('')}
<url>
  <loc>${domain}/news/index.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
<url>
  <loc>${domain}/news/index.EN.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
${newsItems.map(item => {
      const slug = generateSlug(item.titulo + ' ' + item.fecha);
      return `
<url>
  <loc>${domain}/news/${slug}.html</loc>
  <lastmod>${item.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
<url>
  <loc>${domain}/news/${slug}.EN.html</loc>
  <lastmod>${item.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>`;
    }).join('')}
${allMembers.map(member => {
      const roles = (member['Rol en la Revista'] || '').split(';').map(r => r.trim());
      if (roles.includes('Institución Colaboradora')) return '';
      const slug = generateSlug(member['Nombre']);
      return `
<url>
  <loc>${domain}/team/${slug}.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>
<url>
  <loc>${domain}/team/${slug}.EN.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>`;
    }).join('')}
${spaRoutes.map(route => `
<url>
  <loc>${domain}${route}/</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>`).join('')}
</urlset>`.replace(/^\s*\n/gm, '');
    fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
    console.log(`Generado sitemap: ${sitemapPath}`);
    // Generar robots.txt
    const robotsContent = `User-agent: *
Allow: /
Disallow: /search
Disallow: /login
Disallow: /admin
Disallow: /submit
Disallow: /cart
Disallow: /api/
Sitemap: ${domain}/sitemap.xml
    `.trim();
    fs.writeFileSync(robotsPath, robotsContent, 'utf8');
    console.log(`Generado robots.txt: ${robotsPath}`);
    console.log('🎉 ¡Proceso completado con éxito!');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
