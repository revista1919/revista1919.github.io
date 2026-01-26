const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const teamCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const outputJson = path.join(__dirname, 'dist', 'articles.json');
const volumesOutputJson = path.join(__dirname, 'dist', 'volumes.json');
const outputHtmlDir = path.join(__dirname, 'dist', 'articles');
const volumesOutputHtmlDir = path.join(__dirname, 'dist', 'volumes');
const newsOutputHtmlDir = path.join(__dirname, 'dist', 'news');
const teamOutputHtmlDir = path.join(__dirname, 'dist', 'team');
const sectionsOutputDir = path.join(__dirname, 'dist', 'sections');
const sitemapPath = path.join(__dirname, 'dist', 'sitemap.xml');
const robotsPath = path.join(__dirname, 'dist', 'robots.txt');
const domain = 'https://www.revistacienciasestudiantes.com';
const admin = require('firebase-admin');
const cheerio = require('cheerio');
const sharp = require('sharp');
const crypto = require('crypto');

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

async function processImages(html, slug, lang) {
  const $ = cheerio.load(html);
  const images = $('img');
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const src = $(img).attr('src');
    if (src && src.startsWith('data:image/')) {
      const base64Data = src.split(';base64,').pop();
      const buffer = Buffer.from(base64Data, 'base64');
      const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
      const imgDir = path.join(__dirname, 'dist', 'images', 'news');
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
      const imgPath = path.join(imgDir, `${slug}-${hash}-${lang}.webp`);
      if (!fs.existsSync(imgPath)) {
        await sharp(buffer)
          .resize({ width: 800, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(imgPath);
      }
      $(img).attr('src', `/images/news/${slug}-${hash}-${lang}.webp`);
    }
  }
  return $.html();
}

if (!fs.existsSync(outputHtmlDir)) fs.mkdirSync(outputHtmlDir, { recursive: true });
if (!fs.existsSync(volumesOutputHtmlDir)) fs.mkdirSync(volumesOutputHtmlDir, { recursive: true });
if (!fs.existsSync(newsOutputHtmlDir)) fs.mkdirSync(newsOutputHtmlDir, { recursive: true });
if (!fs.existsSync(teamOutputHtmlDir)) fs.mkdirSync(teamOutputHtmlDir, { recursive: true });
if (!fs.existsSync(sectionsOutputDir)) fs.mkdirSync(sectionsOutputDir, { recursive: true });
if (!fs.existsSync(path.join(__dirname, 'dist', 'images', 'news'))) fs.mkdirSync(path.join(__dirname, 'dist', 'images', 'news'), { recursive: true });

(async () => {
  try {
    // Procesar equipo primero para obtener instituciones (sigue de CSV)
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

    // Procesar artículos desde Firestore
    const articlesSnapshot = await db.collection('articles').get();
    const articles = articlesSnapshot.docs.map(doc => {
      const data = doc.data();
      const autoresStr = data.autores || 'Autor desconocido';
      const institutions = autoresStr.split(';').map(a => {
        const name = a.trim();
        return authorToInstitution[name] || '';
      });
      return {
        titulo: data.titulo || 'Sin título',
        autores: autoresStr,
        institutions,
        resumen: data.resumen || 'Resumen no disponible',
        englishAbstract: data.abstract || 'English abstract not available',
        fecha: parseDateFlexible(data.fecha),
        volumen: data.volumen || '',
        numero: data.numero || '',
        primeraPagina: data.primeraPagina || '',
        ultimaPagina: data.ultimaPagina || '',
        area: data.area || '',
        numeroArticulo: data.numeroArticulo || doc.id.slice(0, 5),
        palabras_clave: data.palabras_clave || [],
        keywords_english: data.keywords_english || [],
        tipo: data.tipo || '',
        type: data.type || '',
        pdfUrl: data.pdfUrl || ''
      };
    });
    fs.writeFileSync(outputJson, JSON.stringify(articles, null, 2), 'utf8');
    console.log(`✅ Archivo generado: ${outputJson} (${articles.length} artículos)`);

    // Crear mapa de autores a artículos
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
      article.pdf = article.pdfUrl;
      const authorsArray = article.autores.split(';').map(a => a.trim()).filter(Boolean);
      const authorsDisplayEs = authorsArray.map(auth => `<a href="/team/${generateSlug(auth)}.html" class="author-link" style="color: var(--primary-blue); text-decoration: none; cursor: pointer; font-weight: 500;">${auth}</a>`).join(', ');
      const authorsDisplayEn = authorsArray.map(auth => `<a href="/team/${generateSlug(auth)}.EN.html" class="author-link" style="color: var(--primary-blue); text-decoration: none; cursor: pointer; font-weight: 500;">${auth}</a>`).join(', ');
      const authorsAPA = formatAuthorsAPA(article.autores);
      const authorsChicagoEs = formatAuthorsChicagoOrMLA(article.autores, 'es');
      const authorsMLAEs = formatAuthorsChicagoOrMLA(article.autores, 'es');
      const authorsChicagoEn = formatAuthorsChicagoOrMLA(article.autores, 'en');
      const authorsMLAEn = formatAuthorsChicagoOrMLA(article.autores, 'en');
      const year = new Date(article.fecha).getFullYear();
      const tipoEs = article.tipo || 'Artículo de Investigación';
      const typeEn = article.type || 'Research Article';
      // Generar HTML en español
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
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
      --bg-light: #fdfdfd;
    }
    body {
      font-family: 'Noto Sans', sans-serif;
      line-height: 1.6;
      color: var(--text-dark);
      background-color: #f0f0f0;
      margin: 0;
      padding: 0;
    }
    .top-bar {
      background: white;
      border-bottom: 1px solid var(--border);
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .journal-name {
      font-weight: bold;
      color: var(--primary-blue);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .main-wrapper {
      max-width: 1200px;
      margin: 20px auto;
      display: grid;
      grid-template-columns: 250px 1fr;
      gap: 30px;
      padding: 0 20px;
    }
    /* Sidebar */
    aside {
      font-size: 0.9rem;
    }
    .outline-box {
      position: sticky;
      top: 20px;
    }
    .outline-title {
      font-weight: bold;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
      margin-bottom: 15px;
      text-transform: uppercase;
      font-size: 0.8rem;
      letter-spacing: 1px;
    }
    .outline-list {
      list-style: none;
      padding: 0;
    }
    .outline-list li {
      margin-bottom: 10px;
    }
    .outline-list a {
      color: var(--primary-blue);
      text-decoration: none;
    }
    /* Main Content */
    .article-container {
      background: white;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      border-radius: 2px;
    }
    header {
      border-bottom: 1px solid var(--border);
      margin-bottom: 30px;
      padding-bottom: 20px;
    }
    .journal-meta {
      font-size: 0.85rem;
      color: var(--text-grey);
      margin-bottom: 15px;
    }
    h1 {
      font-family: 'Noto Serif', serif;
      font-size: 2.2rem;
      margin: 10px 0;
      line-height: 1.2;
      color: #000;
    }
    .authors {
      font-size: 1.1rem;
      color: var(--primary-blue);
      margin: 15px 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .authors a:hover {
      text-decoration: underline;
    }
    .article-info-row {
      font-size: 0.85rem;
      display: flex;
      gap: 20px;
      color: var(--text-grey);
      margin-top: 10px;
      flex-wrap: wrap;
    }
    h2 {
      font-family: 'Noto Sans', sans-serif;
      font-size: 1.4rem;
      color: var(--text-dark);
      margin-top: 40px;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    p {
      font-family: 'Noto Serif', serif;
      font-size: 1.05rem;
      text-align: justify;
    }
    .keywords-box {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .keyword-tag {
      display: inline-block;
      margin-right: 15px;
      font-size: 0.9rem;
      color: var(--primary-blue);
    }
    .pdf-viewer-section {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid var(--primary-blue);
    }
    .pdf-preview {
      width: 100%;
      height: 700px;
      border: 1px solid var(--border);
      margin-bottom: 20px;
    }
    .action-buttons {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      justify-content: flex-start;
    }
    .btn {
      padding: 12px 24px;
      border-radius: 2px;
      text-decoration: none;
      font-weight: bold;
      font-size: 0.9rem;
      display: inline-flex;
      align-items: center;
      transition: 0.2s;
    }
    .btn-primary {
      background: var(--primary-blue);
      color: white;
    }
    .btn-primary:hover { background: #005a77; }
    .btn-outline {
      border: 1px solid var(--primary-blue);
      color: var(--primary-blue);
    }
    .btn-outline:hover { background: #f0f7f9; }
    .citation-card {
      background: #f4f4f4;
      padding: 20px;
      font-size: 0.9rem;
      border-left: 4px solid var(--primary-blue);
    }
    footer {
      text-align: center;
      padding: 40px;
      color: var(--text-grey);
      font-size: 0.8rem;
    }
    @media (max-width: 900px) {
      .main-wrapper { grid-template-columns: 1fr; }
      aside { display: none; }
      .article-container { padding: 20px; }
      .journal-meta, .article-info-row, .authors, .keywords-box, .action-buttons {
        justify-content: flex-start;
        text-align: left;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
      .keywords-box {
        text-align: left;
      }
      .keyword-tag {
        margin: 0.25rem 0;
        display: inline-block;
      }
      p {
        text-align: justify;
      }
      h1, h2 {
        text-align: left;
      }
      .citation-card p {
        text-align: justify;
        word-break: break-word;
        overflow-wrap: break-word;
      }
      header {
        text-align: left;
      }
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">REVISTA NACIONAL DE LAS CIENCIAS PARA ESTUDIANTES</a>
    <div style="font-size: 0.8rem; color: #666;">Volume ${article.volumen}, Issue ${article.numero}</div>
  </div>
  <div class="main-wrapper">
    <aside>
      <div class="outline-box">
        <div class="outline-title">Contenido</div>
        <ul class="outline-list">
          <li><a href="#abstract">Resumen</a></li>
          <li><a href="#englishAbstract">Abstract (English)</a></li>
          <li><a href="#keywords">Palabras clave</a></li>
          <li><a href="#preview">Visualización PDF</a></li>
          <li><a href="#citations">Citas</a></li>
          <li><a href="#license">Licencia</a></li>
        </ul>
        <div class="outline-title" style="margin-top:30px">Acciones</div>
        <a href="${article.pdf}" download class="btn btn-primary" style="width:100%; box-sizing:border-box; justify-content:center;">Descargar PDF</a>
        <a href="/es/article" class="btn btn-outline" style="width:100%; box-sizing:border-box; justify-content:center; margin-top:10px;">Volver a Artículos</a>
      </div>
    </aside>
    <main class="article-container">
      <header>
        <div class="journal-meta">
          ${article.area} | ${tipoEs}
        </div>
        <h1>${article.titulo}</h1>
        <div class="authors">${authorsDisplayEs}</div>
        <div class="article-info-row">
          <span><strong>Publicado:</strong> ${article.fecha}</span>
          <span><strong>Páginas:</strong> ${article.primeraPagina}-${article.ultimaPagina}</span>
        </div>
      </header>
      <section id="abstract">
        <h2>Resumen</h2>
        <p>${article.resumen}</p>
      </section>
      <section id="englishAbstract">
        <h2>Abstract (English)</h2>
        <p style="font-style: italic; color: #444;">${article.englishAbstract}</p>
      </section>
      <section id="keywords" class="keywords-box">
        <strong style="font-size:0.9rem; display:block; margin-bottom:10px;">Palabras clave:</strong>
        ${article.palabras_clave.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
      </section>
      <section id="preview" class="pdf-viewer-section">
        <h2>Visualización del PDF</h2>
        <embed src="${article.pdf}" type="application/pdf" class="pdf-preview" />
        <div class="action-buttons">
          <a href="${article.pdf}" target="_blank" class="btn btn-outline">Ver en pantalla completa</a>
          <a href="${article.pdf}" download class="btn btn-primary">Descargar artículo (PDF)</a>
        </div>
      </section>
      <section id="citations" style="margin-top:50px;">
        <h2>Cómo citar este artículo</h2>
        <div class="citation-card">
          <p style="margin:0 0 10px 0"><strong>APA:</strong> ${authorsAPA}. (${year}). ${article.titulo}. <em>Revista Nacional de las Ciencias para Estudiantes</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</p>
          <p style="margin:0 0 10px 0"><strong>MLA:</strong> ${authorsMLAEs}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em>, vol. ${article.volumen}, no. ${article.numero}, ${year}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</p>
          <p style="margin:0"><strong>Chicago:</strong> ${authorsChicagoEs}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em> ${article.volumen}, no. ${article.numero} (${year}): ${article.primeraPagina}-${article.ultimaPagina}.</p>
        </div>
      </section>
      <section id="license" style="margin-top:40px; font-size: 0.85rem; border-top: 1px solid #eee; padding-top:20px;">
        <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by.png" alt="CC BY 4.0" style="float:left; margin-right:15px; width:70px;">
        <p style="font-family: sans-serif; font-size: 0.8rem; color: #666;">
          Este artículo se publica bajo licencia <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Atribución 4.0 (CC BY 4.0)</a>.
          Usted es libre de compartir y adaptar el material siempre que se otorgue el crédito apropiado.
        </p>
      </section>
    </main>
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes.</p>
    <p><a href="/es/article" style="color:var(--primary-blue)">Volver al catálogo</a> | <a href="/" style="color:var(--primary-blue)">Volver al inicio</a></p>
  </footer>
</body>
</html>
`.trim();
      const filePathEs = path.join(outputHtmlDir, `article-${articleSlug}.html`);
      fs.writeFileSync(filePathEs, htmlContentEs, 'utf8');
      console.log(`Generado HTML de artículo en español: ${filePathEs}`);

      // Generar HTML en inglés
      const htmlContentEn = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="citation_title" content="${article.titulo}">
  ${authorMetaTags}
  <meta name="citation_publication_date" content="${article.fecha}">
  <meta name="citation_journal_title" content="The National Review of Sciences for Students">
  <meta name="citation_volume" content="${article.volumen}">
  <meta name="citation_issue" content="${article.numero}">
  <meta name="citation_firstpage" content="${article.primeraPagina}">
  <meta name="citation_lastpage" content="${article.ultimaPagina}">
  <meta name="citation_pdf_url" content="${article.pdf}">
  <meta name="citation_abstract_html_url" content="${domain}/articles/article-${articleSlug}EN.html">
  <meta name="citation_abstract" content="${article.englishAbstract}">
  <meta name="citation_keywords" content="${article.keywords_english.join('; ')}">
  <meta name="citation_language" content="en">
  <title>${article.titulo} - The National Review of Sciences for Students</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
    }
    body { font-family: 'Noto Sans', sans-serif; line-height: 1.6; color: var(--text-dark); background-color: #f0f0f0; margin: 0; padding: 0; }
    .top-bar { background: white; border-bottom: 1px solid var(--border); padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; }
    .journal-name { font-weight: bold; color: var(--primary-blue); text-decoration: none; font-size: 0.9rem; }
    .main-wrapper { max-width: 1200px; margin: 20px auto; display: grid; grid-template-columns: 250px 1fr; gap: 30px; padding: 0 20px; }
    aside { font-size: 0.9rem; }
    .outline-box { position: sticky; top: 20px; }
    .outline-title { font-weight: bold; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 15px; text-transform: uppercase; font-size: 0.8rem; }
    .outline-list { list-style: none; padding: 0; }
    .outline-list a { color: var(--primary-blue); text-decoration: none; }
    .article-container { background: white; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    header { border-bottom: 1px solid var(--border); margin-bottom: 30px; padding-bottom: 20px; }
    h1 { font-family: 'Noto Serif', serif; font-size: 2.2rem; margin: 10px 0; color: #000; }
    .authors { font-size: 1.1rem; color: var(--primary-blue); margin: 15px 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .authors a:hover { text-decoration: underline; }
    h2 { font-family: 'Noto Sans', sans-serif; font-size: 1.4rem; color: var(--text-dark); margin-top: 40px; border-bottom: 1px solid #eee; }
    p { font-family: 'Noto Serif', serif; font-size: 1.05rem; text-align: justify; }
    .pdf-preview { width: 100%; height: 700px; border: 1px solid var(--border); margin-bottom: 20px; }
    .btn { padding: 12px 24px; border-radius: 2px; text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; }
    .btn-primary { background: var(--primary-blue); color: white; }
    .btn-primary:hover { background: #005a77; }
    .btn-outline {
      border: 1px solid var(--primary-blue);
      color: var(--primary-blue);
    }
    .btn-outline:hover { background: #f0f7f9; }
    .citation-card { background: #f4f4f4; padding: 20px; border-left: 4px solid var(--primary-blue); font-size: 0.9rem; }
    footer { text-align: center; padding: 40px; color: var(--text-grey); font-size: 0.8rem; }
    .action-buttons { display: flex; gap: 15px; flex-wrap: wrap; justify-content: flex-start; }
    @media (max-width: 900px) {
      .main-wrapper { grid-template-columns: 1fr; }
      aside { display: none; }
      .article-container { padding: 20px; }
      .journal-meta, .article-info-row, .authors, .keywords-box, .action-buttons {
        justify-content: flex-start;
        text-align: left;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
      .keywords-box { text-align: left; }
      .keyword-tag { margin: 0.25rem 0; display: inline-block; }
      p {
        text-align: justify;
      }
      h1, h2 { text-align: left; }
      .citation-card p { text-align: justify; word-break: break-word; overflow-wrap: break-word; }
      header { text-align: left; }
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">THE NATIONAL REVIEW OF SCIENCES FOR STUDENTS</a>
    <div style="font-size: 0.8rem; color: #666;">Vol ${article.volumen}, Issue ${article.numero}</div>
  </div>
  <div class="main-wrapper">
    <aside>
      <div class="outline-box">
        <div class="outline-title">Outline</div>
        <ul class="outline-list">
          <li><a href="#abstract">Abstract</a></li>
          <li><a href="#keywords">Keywords</a></li>
          <li><a href="#preview">PDF Preview</a></li>
          <li><a href="#citations">Citations</a></li>
          <li><a href="#license">License</a></li>
        </ul>
        <a href="${article.pdf}" download class="btn btn-primary" style="margin-top:20px; width:100%; box-sizing:border-box; justify-content:center;">Download PDF</a>
        <a href="/en/article" class="btn btn-outline" style="width:100%; box-sizing:border-box; justify-content:center; margin-top:10px;">Back to Articles</a>
      </div>
    </aside>
    <main class="article-container">
      <header>
        <div class="journal-meta">${article.area} | ${typeEn}</div>
        <h1>${article.titulo}</h1>
        <div class="authors">${authorsDisplayEn}</div>
        <div style="font-size: 0.85rem; color: #666;">
          <strong>Published:</strong> ${article.fecha} | <strong>Pages:</strong> ${article.primeraPagina}-${article.ultimaPagina}
        </div>
      </header>
      <section id="abstract">
        <h2>Abstract</h2>
        <p>${article.englishAbstract}</p>
      </section>
      <section id="keywords" style="background: #f9f9f9; padding: 15px; margin: 20px 0;">
        <strong style="font-size:0.9rem;">Keywords:</strong><br>
        ${article.keywords_english.map(kw => `<span style="color:var(--primary-blue); margin-right:15px; font-size:0.9rem;">${kw}</span>`).join('')}
      </section>
      <section id="preview" style="margin-top:50px;">
        <h2>PDF Preview</h2>
        <embed src="${article.pdf}" type="application/pdf" class="pdf-preview" />
        <div class="action-buttons">
          <a href="${article.pdf}" target="_blank" class="btn btn-outline">View Full Screen</a>
          <a href="${article.pdf}" download class="btn btn-primary">Download Full Article</a>
        </div>
      </section>
      <section id="citations" style="margin-top:50px;">
        <h2>Cite this article</h2>
        <div class="citation-card">
          <p style="margin:0 0 10px 0"><strong>APA:</strong> ${authorsAPA}. (${year}). ${article.titulo}. <em>The National Review of Sciences for Students</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</p>
          <p style="margin:0 0 10px 0"><strong>MLA:</strong> ${authorsMLAEn}. "${article.titulo}." <em>The National Review of Sciences for Students</em>, vol. ${article.volumen}, no. ${article.numero}, ${year}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</p>
          <p style="margin:0"><strong>Chicago:</strong> ${authorsChicagoEn}. "${article.titulo}." <em>The National Review of Sciences for Students</em> ${article.volumen}, no. ${article.numero} (${year}): ${article.primeraPagina}-${article.ultimaPagina}.</p>
        </div>
      </section>
      <section id="license" style="margin-top:40px; font-size: 0.85rem; border-top: 1px solid #eee; padding-top:20px;">
        <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by.png" alt="CC BY 4.0" style="float:left; margin-right:15px; width:70px;">
        <p style="font-family: sans-serif; font-size: 0.8rem; color: #666;">
          This article is published under a <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 (CC BY 4.0)</a> license.
          You are free to share and adapt the material as long as appropriate credit is given.
        </p>
      </section>
    </main>
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students.</p>
    <p><a href="/en/article" style="color:var(--primary-blue)">Back to catalog</a> | <a href="/" style="color:var(--primary-blue)">Back to home</a></p>
  </footer>
</body>
</html>
`.trim();
      const filePathEn = path.join(outputHtmlDir, `article-${articleSlug}EN.html`);
      fs.writeFileSync(filePathEn, htmlContentEn, 'utf8');
      console.log(`Generado HTML de artículo en inglés: ${filePathEn}`);
    });

    // Generar índice de artículos
    const articlesByYear = articles.reduce((acc, article) => {
      const year = new Date(article.fecha).getFullYear() || 'Sin fecha';
      if (!acc[year]) acc[year] = [];
      acc[year].push(article);
      return acc;
    }, {});
    const indexContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Índice de Artículos - Revista Nacional de las Ciencias para Estudiantes</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
      --bg-light: #fdfdfd;
    }
    body {
      font-family: 'Noto Sans', sans-serif;
      line-height: 1.6;
      color: var(--text-dark);
      background-color: #f0f0f0;
      margin: 0;
      padding: 0;
    }
    .top-bar {
      background: white;
      border-bottom: 1px solid var(--border);
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .journal-name {
      font-weight: bold;
      color: var(--primary-blue);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .main-wrapper {
      max-width: 1200px;
      margin: 20px auto;
      padding: 0 20px;
    }
    .article-container {
      background: white;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      border-radius: 2px;
    }
    h1 {
      font-family: 'Noto Serif', serif;
      font-size: 2.2rem;
      margin: 10px 0;
      line-height: 1.2;
      color: #000;
    }
    h2 {
      font-family: 'Noto Sans', sans-serif;
      font-size: 1.4rem;
      color: var(--text-dark);
      margin-top: 40px;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      margin-bottom: 10px;
    }
    a {
      color: var(--primary-blue);
      text-decoration: none;
    }
    footer {
      text-align: center;
      padding: 40px;
      color: var(--text-grey);
      font-size: 0.8rem;
    }
    @media (max-width: 900px) {
      .article-container { padding: 20px; }
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">REVISTA NACIONAL DE LAS CIENCIAS PARA ESTUDIANTES</a>
  </div>
  <div class="main-wrapper">
    <main class="article-container">
      <h1>Índice de Artículos por Año</h1>
      <p>Accede a los artículos por año de publicación. Cada enlace lleva a la página del artículo con resumen y PDF.</p>
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
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes.</p>
    <p><a href="/" style="color:var(--primary-blue)">Volver al inicio</a></p>
  </footer>
</body>
</html>
    `.trim();
    const indexPath = path.join(outputHtmlDir, 'index.html');
    fs.writeFileSync(indexPath, indexContent, 'utf8');
    console.log(`Generado índice HTML de artículos: ${indexPath}`);

    // Generar índice de artículos en inglés
    let indexContentEn = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Index of Articles - The National Review of Sciences for Students</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
    }
    body { font-family: 'Noto Sans', sans-serif; line-height: 1.6; color: var(--text-dark); background-color: #f0f0f0; margin: 0; padding: 0; }
    .top-bar { background: white; border-bottom: 1px solid var(--border); padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; }
    .journal-name { font-weight: bold; color: var(--primary-blue); text-decoration: none; font-size: 0.9rem; }
    .main-wrapper { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
    .article-container { background: white; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    h1 { font-family: 'Noto Serif', serif; font-size: 2.2rem; margin: 10px 0; color: #000; }
    h2 { font-family: 'Noto Sans', sans-serif; font-size: 1.4rem; color: var(--text-dark); margin-top: 40px; border-bottom: 1px solid #eee; }
    ul { list-style: none; padding: 0; }
    a { color: var(--primary-blue); text-decoration: none; }
    footer { text-align: center; padding: 40px; color: var(--text-grey); font-size: 0.8rem; }
    @media (max-width: 900px) { .article-container { padding: 20px; } 
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">THE NATIONAL REVIEW OF SCIENCES FOR STUDENTS</a>
  </div>
  <div class="main-wrapper">
    <main class="article-container">
      <h1>Index of Articles by Year</h1>
      <p>Access articles by year of publication. Each link leads to the article page with abstract and PDF.</p>
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
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students.</p>
    <p><a href="/" style="color:var(--primary-blue)">Back to home</a></p>
  </footer>
</body>
</html>
    `.trim();
    const indexPathEn = path.join(outputHtmlDir, 'index.EN.html');
    fs.writeFileSync(indexPathEn, indexContentEn, 'utf8');
    console.log(`Generado índice HTML de artículos (EN): ${indexPathEn}`);

    // Procesar volúmenes desde Firestore
    const volumesSnapshot = await db.collection('volumes').get();
    const volumes = volumesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        volumen: data.volumen || '',
        numero: data.numero || '',
        fecha: parseDateFlexible(data.fecha),
        titulo: data.titulo || 'Sin título',
        resumen: data.resumen || 'Resumen no disponible',
        abstract: data.abstract || 'Abstract not available',
        portada: getImageSrc(data.portada),
        pdf: data.pdf || '',
        area: data.area || '',
        palabras_clave: data.palabras_clave || [],
        keywords: data.keywords || []
      };
    });
    fs.writeFileSync(volumesOutputJson, JSON.stringify(volumes, null, 2), 'utf8');
    console.log(`✅ Archivo generado: ${volumesOutputJson} (${volumes.length} volúmenes)`);

    volumes.forEach(volume => {
      const volumeSlug = `${volume.volumen}-${volume.numero}`;
      volume.pdfUrl = volume.pdf;
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
  <meta name="citation_pdf_url" content="${volume.pdfUrl}">
  <meta name="citation_abstract_html_url" content="${domain}/volumes/volume-${volumeSlug}.html">
  <meta name="citation_abstract" content="${volume.resumen}">
  <meta name="citation_abstract" xml:lang="en" content="${volume.abstract}">
  <meta name="citation_keywords" content="${volume.palabras_clave.join('; ')}">
  <meta name="citation_language" content="es">
  <meta name="description" content="${volume.resumen.substring(0, 160)}...">
  <meta name="keywords" content="${volume.palabras_clave.join(', ')}">
  <title>Volumen ${volume.volumen} Número ${volume.numero} - Revista Nacional de las Ciencias para Estudiantes</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
      --bg-light: #fdfdfd;
    }
    body {
      font-family: 'Noto Sans', sans-serif;
      line-height: 1.6;
      color: var(--text-dark);
      background-color: #f0f0f0;
      margin: 0;
      padding: 0;
    }
    .top-bar {
      background: white;
      border-bottom: 1px solid var(--border);
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .journal-name {
      font-weight: bold;
      color: var(--primary-blue);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .main-wrapper {
      max-width: 1200px;
      margin: 20px auto;
      display: grid;
      grid-template-columns: 250px 1fr;
      gap: 30px;
      padding: 0 20px;
    }
    /* Sidebar */
    aside {
      font-size: 0.9rem;
    }
    .outline-box {
      position: sticky;
      top: 20px;
    }
    .outline-title {
      font-weight: bold;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
      margin-bottom: 15px;
      text-transform: uppercase;
      font-size: 0.8rem;
      letter-spacing: 1px;
    }
    .outline-list {
      list-style: none;
      padding: 0;
    }
    .outline-list li {
      margin-bottom: 10px;
    }
    .outline-list a {
      color: var(--primary-blue);
      text-decoration: none;
    }
    /* Main Content */
    .article-container {
      background: white;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      border-radius: 2px;
    }
    header {
      border-bottom: 1px solid var(--border);
      margin-bottom: 30px;
      padding-bottom: 20px;
    }
    .journal-meta {
      font-size: 0.85rem;
      color: var(--text-grey);
      margin-bottom: 15px;
    }
    h1 {
      font-family: 'Noto Serif', serif;
      font-size: 2.2rem;
      margin: 10px 0;
      line-height: 1.2;
      color: #000;
    }
    .article-info-row {
      font-size: 0.85rem;
      display: flex;
      gap: 20px;
      color: var(--text-grey);
      margin-top: 10px;
    }
    h2 {
      font-family: 'Noto Sans', sans-serif;
      font-size: 1.4rem;
      color: var(--text-dark);
      margin-top: 40px;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    p {
      font-family: 'Noto Serif', serif;
      font-size: 1.05rem;
      text-align: justify;
    }
    .keywords-box {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .keyword-tag {
      display: inline-block;
      margin-right: 15px;
      font-size: 0.9rem;
      color: var(--primary-blue);
    }
    .pdf-viewer-section {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid var(--primary-blue);
    }
    .pdf-preview {
      width: 100%;
      height: 700px;
      border: 1px solid var(--border);
      margin-bottom: 20px;
    }
    .action-buttons {
      display: flex;
      gap: 15px;
    }
    .btn {
      padding: 12px 24px;
      border-radius: 2px;
      text-decoration: none;
      font-weight: bold;
      font-size: 0.9rem;
      display: inline-flex;
      align-items: center;
      transition: 0.2s;
    }
    .btn-primary {
      background: var(--primary-blue);
      color: white;
    }
    .btn-primary:hover { background: #005a77; }
    .btn-outline {
      border: 1px solid var(--primary-blue);
      color: var(--primary-blue);
    }
    .btn-outline:hover { background: #f0f7f9; }
    footer {
      text-align: center;
      padding: 40px;
      color: var(--text-grey);
      font-size: 0.8rem;
    }
    @media (max-width: 900px) {
      .main-wrapper { grid-template-columns: 1fr; }
      aside { display: none; }
      .article-container { padding: 20px; }
      .journal-meta, .article-info-row, .action-buttons {
        justify-content: flex-start;
        text-align: left;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
      .keywords-box {
        text-align: left;
      }
      .keyword-tag {
        margin: 0.25rem 0;
        display: inline-block;
      }
      p {
        text-align: justify;
      }
      h1, h2 {
        text-align: left;
      }
      header {
        text-align: left;
      }
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">REVISTA NACIONAL DE LAS CIENCIAS PARA ESTUDIANTES</a>
    <div style="font-size: 0.8rem; color: #666;">Volume ${volume.volumen}, Issue ${volume.numero}</div>
  </div>
  <div class="main-wrapper">
    <aside>
      <div class="outline-box">
        <div class="outline-title">Contenido</div>
        <ul class="outline-list">
          <li><a href="#resumen">Resumen</a></li>
          <li><a href="#abstract">Abstract (English)</a></li>
          <li><a href="#palabras_clave">Palabras clave</a></li>
          <li><a href="#preview">Visualización PDF</a></li>
          <li><a href="#license">Licencia</a></li>
        </ul>
        <div class="outline-title" style="margin-top:30px">Acciones</div>
        <a href="${volume.pdfUrl}" download class="btn btn-primary" style="width:100%; box-sizing:border-box; justify-content:center;">Descargar PDF</a>
        <a href="/es/volume" class="btn btn-outline" style="width:100%; box-sizing:border-box; justify-content:center; margin-top:10px;">Volver a Volúmenes</a>
      </div>
    </aside>
    <main class="article-container">
      <header>
        <div class="journal-meta">
          ${volume.area} | Volumen de Investigación
        </div>
        <h1>Volumen ${volume.volumen} - Número ${volume.numero}</h1>
        <div class="article-info-row">
          <span><strong>Publicado:</strong> ${volume.fecha}</span>
        </div>
      </header>
      <section id="resumen">
        <h2>Resumen</h2>
        <p>${volume.resumen}</p>
      </section>
      <section id="abstract">
        <h2>Abstract (English)</h2>
        <p style="font-style: italic; color: #444;">${volume.abstract}</p>
      </section>
      <section id="palabras_clave" class="keywords-box">
        <strong style="font-size:0.9rem; display:block; margin-bottom:10px;">Palabras clave:</strong>
        ${volume.palabras_clave.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
      </section>
      <section id="preview" class="pdf-viewer-section">
        <h2>Visualización del PDF</h2>
        <embed src="${volume.pdfUrl}" type="application/pdf" class="pdf-preview" />
        <div class="action-buttons">
          <a href="${volume.pdfUrl}" target="_blank" class="btn btn-outline">Ver en pantalla completa</a>
          <a href="${volume.pdfUrl}" download class="btn btn-primary">Descargar volumen (PDF)</a>
        </div>
      </section>
      <section id="license" style="margin-top:40px; font-size: 0.85rem; border-top: 1px solid #eee; padding-top:20px;">
        <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by.png" alt="CC BY 4.0" style="float:left; margin-right:15px; width:70px;">
        <p style="font-family: sans-serif; font-size: 0.8rem; color: #666;">
          Este volumen se publica bajo licencia <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Atribución 4.0 (CC BY 4.0)</a>.
          Usted es libre de compartir y adaptar el material siempre que se otorgue el crédito apropiado.
        </p>
      </section>
    </main>
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes.</p>
    <p><a href="/es/volume" style="color:var(--primary-blue)">Volver al catálogo</a> | <a href="/" style="color:var(--primary-blue)">Volver al inicio</a></p>
  </footer>
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
  <meta name="citation_journal_title" content="The National Review of Sciences for Students">
  <meta name="citation_volume" content="${volume.volumen}">
  <meta name="citation_issue" content="${volume.numero}">
  <meta name="citation_pdf_url" content="${volume.pdfUrl}">
  <meta name="citation_abstract_html_url" content="${domain}/volumes/volume-${volumeSlug}EN.html">
  <meta name="citation_abstract" content="${volume.abstract}">
  <meta name="citation_keywords" content="${volume.keywords.join('; ')}">
  <meta name="citation_language" content="en">
  <meta name="description" content="${volume.abstract.substring(0, 160)}...">
  <meta name="keywords" content="${volume.keywords.join(', ')}">
  <title>Volume ${volume.volumen} Issue ${volume.numero} - The National Review of Sciences for Students</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
    }
    body { font-family: 'Noto Sans', sans-serif; line-height: 1.6; color: var(--text-dark); background-color: #f0f0f0; margin: 0; padding: 0; }
    .top-bar { background: white; border-bottom: 1px solid var(--border); padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; }
    .journal-name { font-weight: bold; color: var(--primary-blue); text-decoration: none; font-size: 0.9rem; }
    .main-wrapper { max-width: 1200px; margin: 20px auto; display: grid; grid-template-columns: 250px 1fr; gap: 30px; padding: 0 20px; }
    aside { font-size: 0.9rem; }
    .outline-box { position: sticky; top: 20px; }
    .outline-title { font-weight: bold; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 15px; text-transform: uppercase; font-size: 0.8rem; }
    .outline-list { list-style: none; padding: 0; }
    .outline-list a { color: var(--primary-blue); text-decoration: none; }
    .article-container { background: white; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    header { border-bottom: 1px solid var(--border); margin-bottom: 30px; padding-bottom: 20px; }
    h1 { font-family: 'Noto Serif', serif; font-size: 2.2rem; margin: 10px 0; color: #000; }
    h2 { font-family: 'Noto Sans', sans-serif; font-size: 1.4rem; color: var(--text-dark); margin-top: 40px; border-bottom: 1px solid #eee; }
    p { font-family: 'Noto Serif', serif; font-size: 1.05rem; text-align: justify; }
    .pdf-preview { width: 100%; height: 700px; border: 1px solid var(--border); margin-bottom: 20px; }
    .btn { padding: 12px 24px; border-radius: 2px; text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; }
    .btn-primary { background: var(--primary-blue); color: white; }
    .btn-primary:hover { background: #005a77; }
    .btn-outline {
      border: 1px solid var(--primary-blue);
      color: var(--primary-blue);
    }
    .btn-outline:hover { background: #f0f7f9; }
    footer { text-align: center; padding: 40px; color: var(--text-grey); font-size: 0.8rem; }
    @media (max-width: 900px) { .main-wrapper { grid-template-columns: 1fr; } aside { display: none; } .article-container { padding: 20px; }
      .journal-meta, .action-buttons { justify-content: flex-start; text-align: left; flex-direction: column; align-items: flex-start; gap: 0.5rem; }
      .keywords-box { text-align: left; }
      .keyword-tag { margin: 0.25rem 0; display: inline-block; }
      p { text-align: justify; }
      h1, h2 { text-align: left; }
      header { text-align: left; } 
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">THE NATIONAL REVIEW OF SCIENCES FOR STUDENTS</a>
    <div style="font-size: 0.8rem; color: #666;">Vol ${volume.volumen}, Issue ${volume.numero}</div>
  </div>
  <div class="main-wrapper">
    <aside>
      <div class="outline-box">
        <div class="outline-title">Outline</div>
        <ul class="outline-list">
          <li><a href="#abstract">Abstract</a></li>
          <li><a href="#resumen">Resumen (Spanish)</a></li>
          <li><a href="#keywords">Keywords</a></li>
          <li><a href="#preview">PDF Preview</a></li>
          <li><a href="#license">License</a></li>
        </ul>
        <a href="${volume.pdfUrl}" download class="btn btn-primary" style="margin-top:20px; width:100%; box-sizing:border-box; justify-content:center;">Download PDF</a>
        <a href="/en/volume" class="btn btn-outline" style="width:100%; box-sizing:border-box; justify-content:center; margin-top:10px;">Back to Volumes</a>
      </div>
    </aside>
    <main class="article-container">
      <header>
        <div class="journal-meta">${volume.area} | Research Volume</div>
        <h1>Volume ${volume.volumen} - Issue ${volume.numero}</h1>
        <div style="font-size: 0.85rem; color: #666;">
          <strong>Published:</strong> ${volume.fecha}
        </div>
      </header>
      <section id="abstract">
        <h2>Abstract</h2>
        <p>${volume.abstract}</p>
      </section>
      <section id="resumen">
        <h2>Resumen (Spanish)</h2>
        <p style="font-style: italic; color: #444;">${volume.resumen}</p>
      </section>
      <section id="keywords" style="background: #f9f9f9; padding: 15px; margin: 20px 0;">
        <strong style="font-size:0.9rem;">Keywords:</strong><br>
        ${volume.keywords.map(kw => `<span style="color:var(--primary-blue); margin-right:15px; font-size:0.9rem;">${kw}</span>`).join('')}
      </section>
      <section id="preview" style="margin-top:50px;">
        <h2>PDF Preview</h2>
        <embed src="${volume.pdfUrl}" type="application/pdf" class="pdf-preview" />
        <div style="display:flex; gap:15px;">
          <a href="${volume.pdfUrl}" target="_blank" class="btn btn-outline">View Full Screen</a>
          <a href="${volume.pdfUrl}" download class="btn btn-primary">Download Volume (PDF)</a>
        </div>
      </section>
      <section id="license" style="margin-top:40px; font-size: 0.85rem; border-top: 1px solid #eee; padding-top:20px;">
        <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by.png" alt="CC BY 4.0" style="float:left; margin-right:15px; width:70px;">
        <p style="font-family: sans-serif; font-size: 0.8rem; color: #666;">
          This volume is published under a <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 (CC BY 4.0)</a> license.
          You are free to share and adapt the material as long as appropriate credit is given.
        </p>
      </section>
    </main>
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students.</p>
    <p><a href="/en/volume" style="color:var(--primary-blue)">Back to catalog</a> | <a href="/" style="color:var(--primary-blue)">Back to home</a></p>
  </footer>
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
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
      --bg-light: #fdfdfd;
    }
    body {
      font-family: 'Noto Sans', sans-serif;
      line-height: 1.6;
      color: var(--text-dark);
      background-color: #f0f0f0;
      margin: 0;
      padding: 0;
    }
    .top-bar {
      background: white;
      border-bottom: 1px solid var(--border);
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .journal-name {
      font-weight: bold;
      color: var(--primary-blue);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .main-wrapper {
      max-width: 1200px;
      margin: 20px auto;
      padding: 0 20px;
    }
    .article-container {
      background: white;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      border-radius: 2px;
    }
    h1 {
      font-family: 'Noto Serif', serif;
      font-size: 2.2rem;
      margin: 10px 0;
      line-height: 1.2;
      color: #000;
    }
    h2 {
      font-family: 'Noto Sans', sans-serif;
      font-size: 1.4rem;
      color: var(--text-dark);
      margin-top: 40px;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      margin-bottom: 10px;
    }
    a {
      color: var(--primary-blue);
      text-decoration: none;
    }
    footer {
      text-align: center;
      padding: 40px;
      color: var(--text-grey);
      font-size: 0.8rem;
    }
    @media (max-width: 900px) {
      .article-container { padding: 20px; }
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">REVISTA NACIONAL DE LAS CIENCIAS PARA ESTUDIANTES</a>
  </div>
  <div class="main-wrapper">
    <main class="article-container">
      <h1>Índice de Volúmenes por Año</h1>
      <p>Accede a los volúmenes por año de publicación. Cada enlace lleva a la página del volumen con resumen y PDF.</p>
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
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes.</p>
    <p><a href="/" style="color:var(--primary-blue)">Volver al inicio</a></p>
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
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
    }
    body { font-family: 'Noto Sans', sans-serif; line-height: 1.6; color: var(--text-dark); background-color: #f0f0f0; margin: 0; padding: 0; }
    .top-bar { background: white; border-bottom: 1px solid var(--border); padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; }
    .journal-name { font-weight: bold; color: var(--primary-blue); text-decoration: none; font-size: 0.9rem; }
    .main-wrapper { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
    .article-container { background: white; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    h1 { font-family: 'Noto Serif', serif; font-size: 2.2rem; margin: 10px 0; color: #000; }
    h2 { font-family: 'Noto Sans', sans-serif; font-size: 1.4rem; color: var(--text-dark); margin-top: 40px; border-bottom: 1px solid #eee; }
    ul { list-style: none; padding: 0; }
    a { color: var(--primary-blue); text-decoration: none; }
    footer { text-align: center; padding: 40px; color: var(--text-grey); font-size: 0.8rem; }
    @media (max-width: 900px) { .article-container { padding: 20px; } 
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">THE NATIONAL REVIEW OF SCIENCES FOR STUDENTS</a>
  </div>
  <div class="main-wrapper">
    <main class="article-container">
      <h1>Index of Volumes by Year</h1>
      <p>Access volumes by year of publication. Each link leads to the volume page with abstract and PDF.</p>
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
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students.</p>
    <p><a href="/" style="color:var(--primary-blue)">Back to home</a></p>
  </footer>
</body>
</html>
    `.trim();
    const volumesIndexPathEn = path.join(volumesOutputHtmlDir, 'index.EN.html');
    fs.writeFileSync(volumesIndexPathEn, volumesIndexContentEn, 'utf8');
    console.log(`Generado índice HTML de volúmenes (EN): ${volumesIndexPathEn}`);

    // Procesar noticias desde Firestore
    async function generateNews() {
      
  // Procesar noticias desde Firestore
  const newsSnapshot = await db.collection('news').get();
let newsItems = newsSnapshot.docs.map(doc => doc.data()).map(item => ({
    titulo: item.title_es || '',
    cuerpo: item.body_es || '', // base64
    fecha: parseDateFlexible(item.timestamp_es),
    title: item.title_en || '',
    content: item.body_en || '', // base64
    photo: item.photo || '' // ahora URL como string
  }));
  for (const newsItem of newsItems) {
    const slug = generateSlug(`${newsItem.titulo} ${newsItem.fecha}`);
    const cuerpoDecoded = base64DecodeUnicode(newsItem.cuerpo);
    const contentDecoded = base64DecodeUnicode(newsItem.content);
    // No procesar imágenes: usar directamente (asumiendo URLs externas)
    const esContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${newsItem.titulo.substring(0, 160)}...">
  <meta name="keywords" content="noticias, revista ciencias estudiantes, ${newsItem.titulo.replace(/[^a-zA-Z0-9]/g, ' ').substring(0, 100)}">
  <title>${newsItem.titulo} - Noticias - Revista Nacional de las Ciencias para Estudiantes</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
    }
    body {
      font-family: 'Noto Sans', sans-serif;
      line-height: 1.6;
      color: var(--text-dark);
      background-color: #f0f0f0;
      margin: 0;
      padding: 0;
    }
    .top-bar {
      background: white;
      border-bottom: 1px solid var(--border);
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .journal-name {
      font-weight: bold;
      color: var(--primary-blue);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .main-wrapper {
      max-width: 1200px;
      margin: 20px auto;
      display: grid;
      grid-template-columns: 250px 1fr;
      gap: 30px;
      padding: 0 20px;
    }
    aside {
      font-size: 0.9rem;
    }
    .outline-box {
      position: sticky;
      top: 20px;
    }
    .outline-title {
      font-weight: bold;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
      margin-bottom: 15px;
      text-transform: uppercase;
      font-size: 0.8rem;
      letter-spacing: 1px;
    }
    .outline-list {
      list-style: none;
      padding: 0;
    }
    .outline-list li {
      margin-bottom: 10px;
    }
    .outline-list a {
      color: var(--primary-blue);
      text-decoration: none;
    }
    .article-container {
      background: white;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      border-radius: 2px;
    }
    header {
      border-bottom: 1px solid var(--border);
      margin-bottom: 30px;
      padding-bottom: 20px;
    }
    h1 {
      font-family: 'Noto Serif', serif;
      font-size: 2.2rem;
      margin: 10px 0;
      line-height: 1.2;
      color: #000;
    }
    .date {
      font-size: 0.85rem;
      color: var(--text-grey);
      margin: 10px 0;
    }
    .content {
      font-family: 'Noto Serif', serif;
      font-size: 1.05rem;
      text-align: justify;
    }
    .content p {
      margin-bottom: 1.5rem;
    }
    .content h2, .content h3 {
      font-family: 'Noto Sans', sans-serif;
      color: var(--text-dark);
      margin-top: 40px;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    .content strong {
      color: var(--primary-blue);
    }
    .content a {
      color: var(--primary-blue);
      text-decoration: none;
    }
    .content a:hover {
      text-decoration: underline;
    }
    .content img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1rem 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    footer {
      text-align: center;
      padding: 40px;
      color: var(--text-grey);
      font-size: 0.8rem;
    }
    @media (max-width: 900px) {
      .main-wrapper { grid-template-columns: 1fr; }
      aside { display: none; }
      .article-container { padding: 20px; }
      .content, .content p, .date { text-align: justify; }
      h1, .content h2, .content h3 { text-align: left; }
      header { text-align: left; }
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">REVISTA NACIONAL DE LAS CIENCIAS PARA ESTUDIANTES</a>
  </div>
  <div class="main-wrapper">
    <aside>
      <div class="outline-box">
        <div class="outline-title">Acciones</div>
        <a href="/es/new" class="btn btn-outline" style="width:100%; box-sizing:border-box; justify-content:center;">Volver a Noticias</a>
      </div>
    </aside>
    <main class="article-container">
      <header>
        <h1>${newsItem.titulo}</h1>
        <p class="date">Publicado el ${newsItem.fecha}</p>
      </header>
      <div class="content ql-editor">
        ${cuerpoDecoded}
      </div>
    </main>
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes.</p>
    <p><a href="/es/new" style="color:var(--primary-blue)">Volver a Noticias</a> | <a href="/" style="color:var(--primary-blue)">Volver al inicio</a></p>
  </footer>
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
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
    }
    body { font-family: 'Noto Sans', sans-serif; line-height: 1.6; color: var(--text-dark); background-color: #f0f0f0; margin: 0; padding: 0; }
    .top-bar { background: white; border-bottom: 1px solid var(--border); padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; }
    .journal-name { font-weight: bold; color: var(--primary-blue); text-decoration: none; font-size: 0.9rem; }
    .main-wrapper { max-width: 1200px; margin: 20px auto; display: grid; grid-template-columns: 250px 1fr; gap: 30px; padding: 0 20px; }
    aside { font-size: 0.9rem; }
    .outline-box { position: sticky; top: 20px; }
    .outline-title { font-weight: bold; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 15px; text-transform: uppercase; font-size: 0.8rem; }
    .outline-list { list-style: none; padding: 0; }
    .outline-list a { color: var(--primary-blue); text-decoration: none; }
    .article-container { background: white; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    header { border-bottom: 1px solid var(--border); margin-bottom: 30px; padding-bottom: 20px; }
    h1 { font-family: 'Noto Serif', serif; font-size: 2.2rem; margin: 10px 0; color: #000; }
    .date { font-size: 0.85rem; color: var(--text-grey); margin: 10px 0; }
    .content { font-family: 'Noto Serif', serif; font-size: 1.05rem; text-align: justify; }
    .content p { margin-bottom: 1.5rem; }
    .content h2, .content h3 { font-family: 'Noto Sans', sans-serif; color: var(--text-dark); margin-top: 40px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    .content strong { color: var(--primary-blue); }
    .content a { color: var(--primary-blue); text-decoration: none; }
    .content a:hover { text-decoration: underline; }
    .content img { max-width: 100%; height: auto; border-radius: 4px; margin: 1rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    footer { text-align: center; padding: 40px; color: var(--text-grey); font-size: 0.8rem; }
    .btn-outline { border: 1px solid var(--primary-blue); color: var(--primary-blue); padding: 12px 24px; border-radius: 2px; text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; transition: 0.2s; }
    .btn-outline:hover { background: #f0f7f9; }
    @media (max-width: 900px) { .main-wrapper { grid-template-columns: 1fr; } aside { display: none; } .article-container { padding: 20px; }
      .content, .content p, .date { text-align: justify; }
      h1, .content h2, .content h3 { text-align: left; }
      header { text-align: left; }
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">THE NATIONAL REVIEW OF SCIENCES FOR STUDENTS</a>
  </div>
  <div class="main-wrapper">
    <aside>
      <div class="outline-box">
        <div class="outline-title">Actions</div>
        <a href="/en/new" class="btn-outline" style="width:100%; box-sizing:border-box; justify-content:center;">Back to News</a>
      </div>
    </aside>
    <main class="article-container">
      <header>
        <h1>${newsItem.title}</h1>
        <p class="date">Published on ${newsItem.fecha}</p>
      </header>
      <div class="content ql-editor">
        ${contentDecoded}
      </div>
    </main>
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students.</p>
    <p><a href="/en/new" style="color:var(--primary-blue)">Back to News</a> | <a href="/" style="color:var(--primary-blue)">Back to home</a></p>
  </footer>
</body>
</html>`;
    const esPath = path.join(newsOutputHtmlDir, `${slug}.html`);
    fs.writeFileSync(esPath, esContent, 'utf8');
    console.log(`Generado HTML de noticia (ES): ${esPath}`);
    const enPath = path.join(newsOutputHtmlDir, `${slug}.EN.html`);
    fs.writeFileSync(enPath, enContent, 'utf8');
    console.log(`Generado HTML de noticia (EN): ${enPath}`);
  }
  // Generar news.json
  const newsJsonPath = path.join(__dirname, 'dist', 'news.json');
  const newsForJson = newsItems.map(item => {
    const fechaIso = parseDateFlexible(item.fecha); // Ajusta a tu función parseDateIso si es diferente
    const slug = generateSlug(`${item.titulo} ${fechaIso}`);
    return {
      titulo: item.titulo,
      cuerpo: item.cuerpo,
      title: item.title,
      content: item.content,
      fecha: formatDate(item.fecha), // Ajusta a tu función formatDate
      fechaIso: fechaIso,
      photo: item.photo,
      timestamp: new Date(fechaIso).getTime(),
      slug: slug
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
  fs.writeFileSync(newsJsonPath, JSON.stringify(newsForJson, null, 2), 'utf8');
  console.log(`✅ Archivo generado: ${newsJsonPath} (${newsForJson.length} noticias)`);
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
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
      --bg-light: #fdfdfd;
    }
    body {
      font-family: 'Noto Sans', sans-serif;
      line-height: 1.6;
      color: var(--text-dark);
      background-color: #f0f0f0;
      margin: 0;
      padding: 0;
    }
    .top-bar {
      background: white;
      border-bottom: 1px solid var(--border);
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .journal-name {
      font-weight: bold;
      color: var(--primary-blue);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .main-wrapper {
      max-width: 1200px;
      margin: 20px auto;
      padding: 0 20px;
    }
    .article-container {
      background: white;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      border-radius: 2px;
    }
    h1 {
      font-family: 'Noto Serif', serif;
      font-size: 2.2rem;
      margin: 10px 0;
      line-height: 1.2;
      color: #000;
    }
    h2 {
      font-family: 'Noto Sans', sans-serif;
      font-size: 1.4rem;
      color: var(--text-dark);
      margin-top: 40px;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      margin-bottom: 10px;
    }
    a {
      color: var(--primary-blue);
      text-decoration: none;
    }
    footer {
      text-align: center;
      padding: 40px;
      color: var(--text-grey);
      font-size: 0.8rem;
    }
    @media (max-width: 900px) {
      .article-container { padding: 20px; }
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">REVISTA NACIONAL DE LAS CIENCIAS PARA ESTUDIANTES</a>
  </div>
  <div class="main-wrapper">
    <main class="article-container">
      <h1>Índice de Noticias por Año</h1>
      <p>Accede a las noticias por año de publicación.</p>
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
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes.</p>
    <p><a href="/" style="color:var(--primary-blue)">Volver al inicio</a></p>
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
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
    }
    body { font-family: 'Noto Sans', sans-serif; line-height: 1.6; color: var(--text-dark); background-color: #f0f0f0; margin: 0; padding: 0; }
    .top-bar { background: white; border-bottom: 1px solid var(--border); padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; }
    .journal-name { font-weight: bold; color: var(--primary-blue); text-decoration: none; font-size: 0.9rem; }
    .main-wrapper { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
    .article-container { background: white; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    h1 { font-family: 'Noto Serif', serif; font-size: 2.2rem; margin: 10px 0; color: #000; }
    h2 { font-family: 'Noto Sans', sans-serif; font-size: 1.4rem; color: var(--text-dark); margin-top: 40px; border-bottom: 1px solid #eee; }
    ul { list-style: none; padding: 0; }
    a { color: var(--primary-blue); text-decoration: none; }
    footer { text-align: center; padding: 40px; color: var(--text-grey); font-size: 0.8rem; }
    @media (max-width: 900px) { .article-container { padding: 20px; }
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">THE NATIONAL REVIEW OF SCIENCES FOR STUDENTS</a>
  </div>
  <div class="main-wrapper">
    <main class="article-container">
      <h1>News Index by Year</h1>
      <p>Access news by year of publication.</p>
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
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students.</p>
    <p><a href="/" style="color:var(--primary-blue)">Back to home</a></p>
  </footer>
</body>
</html>
    `.trim();
  const newsIndexPathEn = path.join(newsOutputHtmlDir, 'index.EN.html');
  fs.writeFileSync(newsIndexPathEn, newsIndexContentEn, 'utf8');
  console.log(`Generado índice HTML de noticias (EN): ${newsIndexPathEn}`);
}
 // Procesar equipo (sigue de CSV)
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
      const areasTagsHtml = areasList.length ? areasList.map(area => `<span class="keyword-tag">${area}</span>`).join('') : '<p>No especificadas</p>';
      const areasTagsHtmlEn = areasListEn.length ? areasListEn.map(area => `<span class="keyword-tag">${area}</span>`).join('') : '<p>Not specified</p>';
      const articlesSectionEs = isAuthor ? `
      <section id="articles" style="margin-top:50px;">
        <h2>Artículos Publicados</h2>
        <div>
          ${publishedArticles.map(article => {
            const articleSlug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
            return `
            <div style="margin-bottom:20px; padding:15px; background:#f9f9f9; border-radius:4px;">
              <h3 style="font-size:1.2rem; margin:0 0 5px 0;"><a href="/articles/article-${articleSlug}.html" style="color:var(--primary-blue); text-decoration:none;">${article.titulo}</a></h3>
              <p style="font-size:0.9rem; color:var(--text-grey); margin:0;">${article.autores} (Vol. ${article.volumen}, Núm. ${article.numero}, ${article.fecha})</p>
            </div>
            `;
          }).join('')}
        </div>
      </section>` : '';
      const articlesSectionEn = isAuthor ? `
      <section id="articles" style="margin-top:50px;">
        <h2>Published Articles</h2>
        <div>
          ${publishedArticles.map(article => {
            const articleSlug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
            return `
            <div style="margin-bottom:20px; padding:15px; background:#f9f9f9; border-radius:4px;">
              <h3 style="font-size:1.2rem; margin:0 0 5px 0;"><a href="/articles/article-${articleSlug}EN.html" style="color:var(--primary-blue); text-decoration:none;">${article.titulo}</a></h3>
              <p style="font-size:0.9rem; color:var(--text-grey); margin:0;">${article.autores} (Vol. ${article.volumen}, Issue ${article.numero}, ${article.fecha})</p>
            </div>
            `;
          }).join('')}
        </div>
      </section>` : '';
      const institutionHtmlEs = institution ? `<div style="font-size: 0.9rem; color: var(--text-grey); margin-top:10px;">${institution}</div>` : '';
      const institutionHtmlEn = institution ? `<div style="font-size: 0.9rem; color: var(--text-grey); margin-top:10px;">${institution}</div>` : '';
      const esContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${descripcion.substring(0, 160)}...">
  <meta name="keywords" content="${areas}, ${rolesStr}, Revista Nacional de las Ciencias para Estudiantes">
  <meta name="author" content="${nombre}">
  <title>${nombre} - Equipo de Revista Nacional de las Ciencias para Estudiantes</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
      --bg-light: #fdfdfd;
    }
    body {
      font-family: 'Noto Sans', sans-serif;
      line-height: 1.6;
      color: var(--text-dark);
      background-color: #f0f0f0;
      margin: 0;
      padding: 0;
    }
    .top-bar {
      background: white;
      border-bottom: 1px solid var(--border);
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .journal-name {
      font-weight: bold;
      color: var(--primary-blue);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .main-wrapper {
      max-width: 1200px;
      margin: 20px auto;
      display: grid;
      grid-template-columns: 250px 1fr;
      gap: 30px;
      padding: 0 20px;
    }
    aside {
      font-size: 0.9rem;
    }
    .outline-box {
      position: sticky;
      top: 20px;
    }
    .outline-title {
      font-weight: bold;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
      margin-bottom: 15px;
      text-transform: uppercase;
      font-size: 0.8rem;
      letter-spacing: 1px;
    }
    .outline-list {
      list-style: none;
      padding: 0;
    }
    .outline-list li {
      margin-bottom: 10px;
    }
    .outline-list a {
      color: var(--primary-blue);
      text-decoration: none;
    }
    .article-container {
      background: white;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      border-radius: 2px;
    }
    header {
      border-bottom: 1px solid var(--border);
      margin-bottom: 30px;
      padding-bottom: 20px;
    }
    .profile-header {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .profile-img {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid var(--border);
    }
    .profile-img-fallback {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: #f9f9f9;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      color: var(--text-grey);
    }
    h1 {
      font-family: 'Noto Serif', serif;
      font-size: 2.2rem;
      margin: 0;
      line-height: 1.2;
      color: #000;
    }
    .role {
      font-size: 1.1rem;
      color: var(--primary-blue);
      margin: 5px 0;
    }
    h2 {
      font-family: 'Noto Sans', sans-serif;
      font-size: 1.4rem;
      color: var(--text-dark);
      margin-top: 40px;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    p {
      font-family: 'Noto Serif', serif;
      font-size: 1.05rem;
      text-align: justify;
    }
    .keywords-box {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .keyword-tag {
      display: inline-block;
      margin-right: 15px;
      font-size: 0.9rem;
      color: var(--primary-blue);
    }
    footer {
      text-align: center;
      padding: 40px;
      color: var(--text-grey);
      font-size: 0.8rem;
    }
    @media (max-width: 900px) {
      .main-wrapper { grid-template-columns: 1fr; }
      aside { display: none; }
      .article-container { padding: 20px; }
      .profile-header { flex-direction: column; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">REVISTA NACIONAL DE LAS CIENCIAS PARA ESTUDIANTES</a>
  </div>
  <div class="main-wrapper">
    <aside>
      <div class="outline-box">
        <div class="outline-title">Contenido</div>
        <ul class="outline-list">
          <li><a href="#descripcion">Descripción</a></li>
          <li><a href="#areas">Áreas de interés</a></li>
          ${isAuthor ? '<li><a href="#articles">Artículos Publicados</a></li>' : ''}
        </ul>
        <div class="outline-title" style="margin-top:30px">Acciones</div>
        <a href="/es/team" class="btn btn-outline" style="width:100%; box-sizing:border-box; justify-content:center;">Volver a Equipo</a>
      </div>
    </aside>
    <main class="article-container">
      <header>
        <div class="profile-header">
          <div>
            ${imagen ? `<img src="${imagen}" alt="Foto de ${nombre}" class="profile-img">` : `<div class="profile-img-fallback">Sin Imagen</div>`}
          </div>
          <div>
            <h1>${nombre}</h1>
            <div class="role">${rolesStr}</div>
            ${institutionHtmlEs}
          </div>
        </div>
      </header>
      <section id="descripcion">
        <h2>Descripción</h2>
        <p>${descripcion}</p>
      </section>
      <section id="areas" class="keywords-box">
        <h2>Áreas de interés</h2>
        ${areasTagsHtml}
      </section>
      ${articlesSectionEs}
    </main>
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes.</p>
    <p><a href="/es/team" style="color:var(--primary-blue)">Volver a Equipo</a> | <a href="/" style="color:var(--primary-blue)">Volver al inicio</a></p>
  </footer>
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
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --text-dark: #333333;
      --text-grey: #666666;
      --border: #e4e4e4;
    }
    body { font-family: 'Noto Sans', sans-serif; line-height: 1.6; color: var(--text-dark); background-color: #f0f0f0; margin: 0; }
    .top-bar { background: white; border-bottom: 1px solid var(--border); padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; }
    .journal-name { font-weight: bold; color: var(--primary-blue); text-decoration: none; font-size: 0.9rem; }
    .main-wrapper { max-width: 1200px; margin: 20px auto; display: grid; grid-template-columns: 250px 1fr; gap: 30px; padding: 0 20px; }
    aside { font-size: 0.9rem; }
    .outline-box { position: sticky; top: 20px; }
    .outline-title { font-weight: bold; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 15px; text-transform: uppercase; font-size: 0.8rem; }
    .outline-list { list-style: none; padding: 0; }
    .outline-list a { color: var(--primary-blue); text-decoration: none; }
    .article-container { background: white; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    header { border-bottom: 1px solid var(--border); margin-bottom: 30px; padding-bottom: 20px; }
    .profile-header { display: flex; align-items: center; gap: 20px; }
    .profile-img { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); }
    .profile-img-fallback { width: 100px; height: 100px; border-radius: 50%; background: #f9f9f9; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; color: var(--text-grey); }
    h1 { font-family: 'Noto Serif', serif; font-size: 2.2rem; margin: 0; color: #000; }
    .role { font-size: 1.1rem; color: var(--primary-blue); margin: 5px 0; }
    h2 { font-family: 'Noto Sans', sans-serif; font-size: 1.4rem; color: var(--text-dark); margin-top: 40px; border-bottom: 1px solid #eee; }
    p { font-family: 'Noto Serif', serif; font-size: 1.05rem; text-align: justify; }
    .keywords-box { background: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0; }
    .keyword-tag { display: inline-block; margin-right: 15px; font-size: 0.9rem; color: var(--primary-blue); }
    footer { text-align: center; padding: 40px; color: var(--text-grey); font-size: 0.8rem; }
    .btn-outline { border: 1px solid var(--primary-blue); color: var(--primary-blue); padding: 12px 24px; border-radius: 2px; text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; transition: 0.2s; }
    .btn-outline:hover { background: #f0f7f9; }
    @media (max-width: 900px) { .main-wrapper { grid-template-columns: 1fr; } aside { display: none; } .article-container { padding: 20px; } .profile-header { flex-direction: column; text-align: center; } }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="journal-name">THE NATIONAL REVIEW OF SCIENCES FOR STUDENTS</a>
  </div>
  <div class="main-wrapper">
    <aside>
      <div class="outline-box">
        <div class="outline-title">Outline</div>
        <ul class="outline-list">
          <li><a href="#description">Description</a></li>
          <li><a href="#areas">Areas of Interest</a></li>
          ${isAuthor ? '<li><a href="#articles">Published Articles</a></li>' : ''}
        </ul>
        <div class="outline-title" style="margin-top:30px">Actions</div>
        <a href="/en/team" class="btn-outline" style="width:100%; box-sizing:border-box; justify-content:center;">Back to Team</a>
      </div>
    </aside>
    <main class="article-container">
      <header>
        <div class="profile-header">
          <div>
            ${imagen ? `<img src="${imagen}" alt="Photo of ${nombre}" class="profile-img">` : `<div class="profile-img-fallback">No Image</div>`}
          </div>
          <div>
            <h1>${nombre}</h1>
            <div class="role">${rolesEn}</div>
            ${institutionHtmlEn}
          </div>
        </div>
      </header>
      <section id="description">
        <h2>Description</h2>
        <p>${description}</p>
      </section>
      <section id="areas" class="keywords-box">
        <h2>Areas of Interest</h2>
        ${areasTagsHtmlEn}
      </section>
      ${articlesSectionEn}
    </main>
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students.</p>
    <p><a href="/en/team" style="color:var(--primary-blue)">Back to Team</a> | <a href="/" style="color:var(--primary-blue)">Back to home</a></p>
  </footer>
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