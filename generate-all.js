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
  <meta name="citation_issn" content="3087-2839">
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
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes. ISSN 3087-2839</p>
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
  <meta name="citation_journal_title" content="Revista Nacional de las Ciencias para Estudiantes">
  <meta name="citation_issn" content="3087-2839">
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
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students. ISSN 3087-2839</p>
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
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes. ISSN 3087-2839</p>
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
  <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students. ISSN 3087-2839</p>
    .</p>
    <p><a href="/" style="color:var(--primary-blue)">Back to home</a></p>
  </footer>
</body>
</html>
    `.trim();
    const indexPathEn = path.join(outputHtmlDir, 'index.EN.html');
    fs.writeFileSync(indexPathEn, indexContentEn, 'utf8');
    console.log(`Generado índice HTML de artículos (EN): ${indexPathEn}`);

    // Procesar volúmenes desde Firestore
    // Bloque completo de volúmenes en generate_all (del (async () => { try { ... } } ))
    // Procesar volúmenes desde Firestore
    // Procesar volúmenes desde Firestore
// Procesar volúmenes desde Firestore
const volumesSnapshot = await db.collection('volumes').get();
const volumes = volumesSnapshot.docs.map(doc => {
  const data = doc.data();
  return {
    volumen: data.volumen || '',
    numero: data.numero || '',
    fecha: parseDateFlexible(data.fecha),
    titulo: data.titulo || 'Sin título',
    englishTitulo: data.englishTitulo || data.titulo || 'No title',
    editorial: data.editorial || '',
    englishEditorial: data.englishEditorial || '',
    portada: getImageSrc(data.portada),
    pdf: data.pdf || '',
  };
});
fs.writeFileSync(volumesOutputJson, JSON.stringify(volumes, null, 2), 'utf8');
console.log(`✅ Archivo generado: ${volumesOutputJson} (${volumes.length} volúmenes)`);
volumes.forEach(volume => {
  const volumeSlug = `${volume.volumen}-${volume.numero}`;
  volume.pdfUrl = volume.pdf;
  const year = new Date(volume.fecha).getFullYear();
  const volumeArticles = articles.filter(a => a.volumen === volume.volumen && a.numero === volume.numero)
    .sort((a, b) => parseInt(a.primeraPagina) - parseInt(b.primeraPagina));
  const tocEs = volumeArticles.map(a => {
    const slug = `${generateSlug(a.titulo)}-${a.numeroArticulo}`;
    return `
      <div class="article-item">
        <a href="/articles/article-${slug}.html" class="article-title">${a.titulo}</a>
        <span class="article-authors">${formatAuthorsDisplay(a.autores, 'es')} (pp. ${a.primeraPagina}-${a.ultimaPagina})</span>
      </div>
    `;
  }).join('');
  const tocEn = volumeArticles.map(a => {
    const slug = `${generateSlug(a.titulo)}-${a.numeroArticulo}`;
    return `
      <div class="article-item">
        <a href="/articles/article-${slug}EN.html" class="article-title">${a.titulo}</a>
        <span class="article-authors">${formatAuthorsDisplay(a.autores, 'en')} (pp. ${a.primeraPagina}-${a.ultimaPagina})</span>
      </div>
    `;
  }).join('');
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
  <meta name="citation_issn" content="3087-2839">
  <meta name="citation_volume" content="${volume.volumen}">
  <meta name="citation_issue" content="${volume.numero}">
  <meta name="citation_pdf_url" content="${volume.pdfUrl}">
  <meta name="citation_abstract_html_url" content="${domain}/volumes/volume-${volumeSlug}.html">
  <meta name="citation_language" content="es">
  <meta name="description" content="${volume.editorial ? volume.editorial.substring(0, 160) + '...' : ''}">
  <title>${volume.titulo} - Revista Nacional de las Ciencias para Estudiantes</title>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --journal-blue: #005587;
      --text-dark: #222222;
      --text-light: #555555;
      --border-color: #e0e0e0;
      --bg-soft: #fcfcfc;
      --accent-gold: #a68966;
    }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      line-height: 1.7;
      color: var(--text-dark);
      background-color: #fff;
      margin: 0;
    }
    .masthead {
      border-bottom: 4px solid var(--text-dark);
      padding: 1.5rem 2rem;
      text-align: center;
      background: white;
    }
    .journal-name {
      font-family: 'Libre Baskerville', serif;
      font-size: 1.8rem;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      margin: 0;
      color: var(--text-dark);
      text-decoration: none;
    }
    .issue-meta {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-light);
      text-transform: uppercase;
      margin-top: 0.5rem;
      letter-spacing: 1px;
    }
    .hero-section {
      max-width: 1200px;
      margin: 3rem auto;
      padding: 4rem 2rem;
      text-align: left;
      background-image: url('https://images.unsplash.com/photo-1614850523011-8f49ffc73908');
      background-size: cover;
      background-position: center;
      color: white;
    }
    .hero-section h1 {
      font-family: 'Libre Baskerville', serif;
      font-size: 2.8rem;
      line-height: 1.2;
      margin-bottom: 1rem;
      color: white;
    }
    .hero-details {
      font-size: 0.95rem;
      color: #eeeeee;
      border-top: 1px solid rgba(255,255,255,0.3);
      border-bottom: 1px solid rgba(255,255,255,0.3);
      padding: 1rem 0;
      display: flex;
      gap: 2rem;
    }
    .main-grid {
      max-width: 1200px;
      margin: 0 auto 5rem;
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 4rem;
      padding: 0 2rem;
    }
    section { margin-bottom: 4rem; }
    h2 {
      font-family: 'Inter', sans-serif;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--journal-blue);
      border-bottom: 1px solid var(--journal-blue);
      padding-bottom: 0.5rem;
      margin-bottom: 2rem;
    }
    .editorial-box {
      font-family: 'Libre Baskerville', serif;
      font-size: 1.15rem;
      color: #333;
      padding-right: 2rem;
      border-left: 2px solid var(--accent-gold);
      padding-left: 2rem;
      font-style: italic;
    }
    .article-item {
      padding: 1.5rem 0;
      border-bottom: 1px solid var(--border-color);
    }
    .article-item:last-child { border: none; }
    .article-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--journal-blue);
      display: block;
      margin-bottom: 0.5rem;
      text-decoration: none;
    }
    .article-title:hover { text-decoration: underline; }
    .article-authors {
      font-size: 0.9rem;
      color: var(--text-light);
      font-style: italic;
    }
    .sidebar {
      position: sticky;
      top: 2rem;
      height: fit-content;
    }
    .card {
      background: var(--bg-soft);
      border: 1px solid var(--border-color);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card-title {
      font-weight: 700;
      font-size: 0.75rem;
      text-transform: uppercase;
      margin-bottom: 1rem;
      display: block;
    }
    .btn-primary {
      background: var(--journal-blue);
      color: white;
      text-align: center;
      display: block;
      padding: 0.8rem;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
      transition: background 0.2s;
    }
    .btn-primary:hover { background: #003d60; }
    .btn-outline {
      border: 1px solid var(--border-color);
      color: var(--text-dark);
      text-align: center;
      display: block;
      padding: 0.8rem;
      text-decoration: none;
      font-size: 0.9rem;
    }
    .pdf-container {
      background: #eee;
      border: 1px solid var(--border-color);
      padding: 10px;
    }
    .action-buttons {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
      justify-content: flex-start;
    }
    @media (max-width: 900px) {
      .main-grid { grid-template-columns: 1fr; }
      .sidebar { display: none; }
      .hero-section h1 { font-size: 2rem; }
    }
  </style>
</head>
<body>
  <header class="masthead">
    <a href="/" class="journal-name">Revista Nacional de las Ciencias para Estudiantes</a>
    <div class="issue-meta">
      Vol. ${volume.volumen}, No. ${volume.numero} • ${volume.fecha}
    </div>
  </header>
  <article class="hero-section">
    <h1>${volume.titulo}</h1>
    <div class="hero-details">
      <span><strong>Publicado:</strong> ${volume.fecha}</span>
      <span><strong>ISSN:</strong> 3087-2839</span>
      <span><strong>Idioma:</strong> Español/Inglés</span>
    </div>
  </article>
  <div class="main-grid">
    <main>
      ${volume.editorial ? `
        <section id="editorial">
          <h2>Nota Editorial</h2>
          <div class="editorial-box">
            ${volume.editorial}
          </div>
        </section>
      ` : ''}
      ${volume.englishEditorial ? `
        <section id="englishEditorial">
          <h2>Editorial Note</h2>
          <div class="editorial-box">
            ${volume.englishEditorial}
          </div>
        </section>
      ` : ''}
      <section id="toc">
        <h2>Contenido del Volumen</h2>
        <div class="toc-wrapper">
          ${tocEs || '<p style="color: var(--text-light);">No hay artículos disponibles.</p>'}
        </div>
      </section>
      <section id="preview">
        <h2>Visualización Completa</h2>
        <div class="pdf-container">
          <embed src="${volume.pdfUrl}" type="application/pdf" width="100%" height="800px" />
        </div>
        <div class="action-buttons">
          <a href="${volume.pdfUrl}" target="_blank" class="btn-outline">Ver en pantalla completa</a>
          <a href="${volume.pdfUrl}" download class="btn-primary">Descargar volumen (PDF)</a>
        </div>
      </section>
      <section id="license">
        <div style="display: flex; gap: 1.5rem; align-items: center; border-top: 1px solid var(--border-color); padding-top: 2rem;">
          <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by.png" width="88" alt="CC BY">
          <p style="font-size: 0.85rem; color: var(--text-light); margin: 0;">
            Este trabajo está bajo una licencia <a href="https://creativecommons.org/licenses/by/4.0/" style="color: var(--journal-blue);">Creative Commons Atribución 4.0 Internacional</a>.
            Permite la copia y redistribución del material en cualquier medio o formato.
          </p>
        </div>
      </section>
    </main>
    <aside class="sidebar">
      <div class="card">
        <span class="card-title">Acceso Rápido</span>
        <a href="${volume.pdfUrl}" download class="btn-primary">Descargar PDF Completo</a>
        <a href="#toc" class="btn-outline">Explorar Artículos</a>
      </div>
      <div class="card">
        <span class="card-title">Navegación</span>
        <nav style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem;">
          <a href="/es/volume" style="color: var(--journal-blue); text-decoration: none;">← Volver al Archivo</a>
          <a href="#editorial" style="color: var(--text-dark); text-decoration: none;">Nota Editorial</a>
          <a href="#preview" style="color: var(--text-dark); text-decoration: none;">Vista Previa</a>
        </nav>
      </div>
    </aside>
  </div>
  <footer style="background: #f8f8f8; border-top: 1px solid var(--border-color); padding: 4rem 2rem; text-align: center;">
    <p style="font-family: 'Libre Baskerville', serif; margin-bottom: 1rem;">Revista Nacional de las Ciencias para Estudiantes</p>
    p style="font-size: 0.8rem; color: var(--text-light);">ISSN 3087-2839</p>
    <p style="font-size: 0.8rem; color: var(--text-light);">© ${new Date().getFullYear()} — Una revista por y para estudiantes</p>
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
  <meta name="citation_title" content="${volume.englishTitulo}">
  <meta name="citation_publication_date" content="${volume.fecha}">
  <meta name="citation_journal_title" content="Revista Nacional de las Ciencias para Estudiantes">
  <meta name="citation_issn" content="3087-2839">
  <meta name="citation_volume" content="${volume.volumen}">
  <meta name="citation_issue" content="${volume.numero}">
  <meta name="citation_pdf_url" content="${volume.pdfUrl}">
  <meta name="citation_abstract_html_url" content="${domain}/volumes/volume-${volumeSlug}EN.html">
  <meta name="citation_language" content="en">
  <meta name="description" content="${volume.englishEditorial ? volume.englishEditorial.substring(0, 160) + '...' : ''}">
  <title>${volume.englishTitulo} - The National Review of Sciences for Students</title>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --journal-blue: #005587;
      --text-dark: #222222;
      --text-light: #555555;
      --border-color: #e0e0e0;
      --bg-soft: #fcfcfc;
      --accent-gold: #a68966;
    }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      line-height: 1.7;
      color: var(--text-dark);
      background-color: #fff;
      margin: 0;
    }
    .masthead {
      border-bottom: 4px solid var(--text-dark);
      padding: 1.5rem 2rem;
      text-align: center;
      background: white;
    }
    .journal-name {
      font-family: 'Libre Baskerville', serif;
      font-size: 1.8rem;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      margin: 0;
      color: var(--text-dark);
      text-decoration: none;
    }
    .issue-meta {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-light);
      text-transform: uppercase;
      margin-top: 0.5rem;
      letter-spacing: 1px;
    }
    .hero-section {
      max-width: 1200px;
      margin: 3rem auto;
      padding: 4rem 2rem;
      text-align: left;
      background-image: url('https://images.unsplash.com/photo-1614850523011-8f49ffc73908');
      background-size: cover;
      background-position: center;
      color: white;
    }
    .hero-section h1 {
      font-family: 'Libre Baskerville', serif;
      font-size: 2.8rem;
      line-height: 1.2;
      margin-bottom: 1rem;
      color: white;
    }
    .hero-details {
      font-size: 0.95rem;
      color: #eeeeee;
      border-top: 1px solid rgba(255,255,255,0.3);
      border-bottom: 1px solid rgba(255,255,255,0.3);
      padding: 1rem 0;
      display: flex;
      gap: 2rem;
    }
    .main-grid {
      max-width: 1200px;
      margin: 0 auto 5rem;
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 4rem;
      padding: 0 2rem;
    }
    section { margin-bottom: 4rem; }
    h2 {
      font-family: 'Inter', sans-serif;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--journal-blue);
      border-bottom: 1px solid var(--journal-blue);
      padding-bottom: 0.5rem;
      margin-bottom: 2rem;
    }
    .editorial-box {
      font-family: 'Libre Baskerville', serif;
      font-size: 1.15rem;
      color: #333;
      padding-right: 2rem;
      border-left: 2px solid var(--accent-gold);
      padding-left: 2rem;
      font-style: italic;
    }
    .article-item {
      padding: 1.5rem 0;
      border-bottom: 1px solid var(--border-color);
    }
    .article-item:last-child { border: none; }
    .article-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--journal-blue);
      display: block;
      margin-bottom: 0.5rem;
      text-decoration: none;
    }
    .article-title:hover { text-decoration: underline; }
    .article-authors {
      font-size: 0.9rem;
      color: var(--text-light);
      font-style: italic;
    }
    .sidebar {
      position: sticky;
      top: 2rem;
      height: fit-content;
    }
    .card {
      background: var(--bg-soft);
      border: 1px solid var(--border-color);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card-title {
      font-weight: 700;
      font-size: 0.75rem;
      text-transform: uppercase;
      margin-bottom: 1rem;
      display: block;
    }
    .btn-primary {
      background: var(--journal-blue);
      color: white;
      text-align: center;
      display: block;
      padding: 0.8rem;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
      transition: background 0.2s;
    }
    .btn-primary:hover { background: #003d60; }
    .btn-outline {
      border: 1px solid var(--border-color);
      color: var(--text-dark);
      text-align: center;
      display: block;
      padding: 0.8rem;
      text-decoration: none;
      font-size: 0.9rem;
    }
    .pdf-container {
      background: #eee;
      border: 1px solid var(--border-color);
      padding: 10px;
    }
    .action-buttons {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
      justify-content: flex-start;
    }
    @media (max-width: 900px) {
      .main-grid { grid-template-columns: 1fr; }
      .sidebar { display: none; }
      .hero-section h1 { font-size: 2rem; }
    }
  </style>
</head>
<body>
  <header class="masthead">
    <a href="/" class="journal-name">The National Review of Sciences for Students</a>
    <div class="issue-meta">
      Vol. ${volume.volumen}, No. ${volume.numero} • ${volume.fecha}
    </div>
  </header>
  <article class="hero-section">
    <h1>${volume.englishTitulo}</h1>
    <div class="hero-details">
      <span><strong>Published:</strong> ${volume.fecha}</span>
      <span><strong>ISSN:</strong> 3087-2839</span>
      <span><strong>Language:</strong> Spanish/English</span>
    </div>
  </article>
  <div class="main-grid">
    <main>
      ${volume.englishEditorial ? `
        <section id="englishEditorial">
          <h2>Editorial Note</h2>
          <div class="editorial-box">
            ${volume.englishEditorial}
          </div>
        </section>
      ` : ''}
      ${volume.editorial ? `
        <section id="editorial">
          <h2>Nota Editorial (Spanish)</h2>
          <div class="editorial-box">
            ${volume.editorial}
          </div>
        </section>
      ` : ''}
      <section id="toc">
        <h2>Table of Contents</h2>
        <div class="toc-wrapper">
          ${tocEn || '<p style="color: var(--text-light);">No articles available.</p>'}
        </div>
      </section>
      <section id="preview">
        <h2>Full Preview</h2>
        <div class="pdf-container">
          <embed src="${volume.pdfUrl}" type="application/pdf" width="100%" height="800px" />
        </div>
        <div class="action-buttons">
          <a href="${volume.pdfUrl}" target="_blank" class="btn-outline">View Full Screen</a>
          <a href="${volume.pdfUrl}" download class="btn-primary">Download Volume (PDF)</a>
        </div>
      </section>
      <section id="license">
        <div style="display: flex; gap: 1.5rem; align-items: center; border-top: 1px solid var(--border-color); padding-top: 2rem;">
          <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by.png" width="88" alt="CC BY">
          <p style="font-size: 0.85rem; color: var(--text-light); margin: 0;">
            This work is licensed under a <a href="https://creativecommons.org/licenses/by/4.0/" style="color: var(--journal-blue);">Creative Commons Attribution 4.0 International</a> License.
            It allows copying and redistribution of the material in any medium or format.
          </p>
        </div>
      </section>
    </main>
    <aside class="sidebar">
      <div class="card">
        <span class="card-title">Quick Access</span>
        <a href="${volume.pdfUrl}" download class="btn-primary">Download Full PDF</a>
        <a href="#toc" class="btn-outline">Explore Articles</a>
      </div>
      <div class="card">
        <span class="card-title">Navigation</span>
        <nav style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem;">
          <a href="/en/volume" style="color: var(--journal-blue); text-decoration: none;">← Back to Archive</a>
          <a href="#editorial" style="color: var(--text-dark); text-decoration: none;">Editorial Note</a>
          <a href="#preview" style="color: var(--text-dark); text-decoration: none;">Preview</a>
        </nav>
      </div>
    </aside>
  </div>
  <footer style="background: #f8f8f8; border-top: 1px solid var(--border-color); padding: 4rem 2rem; text-align: center;">
    <p style="font-family: 'Libre Baskerville', serif; margin-bottom: 1rem;">The National Review of Sciences for Students</p>
    p style="font-size: 0.8rem; color: var(--text-light);">ISSN 3087-2839</p>
    <p style="font-size: 0.8rem; color: var(--text-light);">© ${new Date().getFullYear()} — A journal by and for students</p>
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Índice de Volúmenes - Revista Nacional de las Ciencias para Estudiantes</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --deep-navy: #0a2540;
      --text-main: #1a1a1a;
      --text-muted: #64748b;
      --bg-body: #f8fafc;
      --accent: #e2e8f0;
    }
    body {
      font-family: 'Inter', sans-serif;
      line-height: 1.6;
      color: var(--text-main);
      background-color: var(--bg-body);
      margin: 0;
      padding: 0;
    }
    .nav-header {
      background: white;
      padding: 0.75rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--accent);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav-logo {
      font-weight: 700;
      color: var(--primary-blue);
      text-decoration: none;
      font-size: 0.8rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .content-grid {
      max-width: 1100px;
      margin: 2rem auto 3rem auto;
      display: grid;
      grid-template-columns: 1fr;
      gap: 2.5rem;
      padding: 0 1.5rem;
    }
    .main-content {
      background: white;
      border-radius: 8px;
      padding: 3rem;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      border: 1px solid var(--accent);
    }
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 3rem;
      max-width: 900px;
      margin: 0 auto 1.5rem auto;
      line-height: 1.1;
    }
    h2 {
      font-family: 'Playfair Display', serif;
      font-size: 1.8rem;
      color: var(--deep-navy);
      border-left: 4px solid var(--primary-blue);
      padding-left: 1rem;
      margin-bottom: 1.5rem;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      padding: 1.5rem 0;
      border-bottom: 1px solid #f1f5f9;
    }
    li:last-child {
      border: none;
    }
    a {
      color: var(--primary-blue);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.2s;
    }
    a:hover {
      color: #005a77;
    }
    footer {
      background: var(--deep-navy);
      color: #94a3b8;
      padding: 3rem 1.5rem;
      text-align: center;
      font-size: 0.9rem;
    }
    footer a { color: white; text-decoration: none; margin: 0 10px; }
    @media (max-width: 900px) {
      .main-content { padding: 1.5rem; }
      h1 { font-size: 2rem; }
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <nav class="nav-header">
    <a href="/" class="nav-logo">Revista Nacional de las Ciencias para Estudiantes</a>
  </nav>
  <div class="content-grid">
    <main class="main-content">
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
              <a href="/volumes/volume-${volumeSlug}.html">${volume.titulo}</a> (${volume.fecha})
            </li>
          `;
          }).join('')}
        </ul>
      </section>
`).join('')}
    </main>
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes. ISSN 3087-2839</p>
    <div style="margin-top: 1.5rem;">
      <a href="/" >Volver al inicio</a>
    </div>
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Index of Volumes - The National Review of Sciences for Students</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-blue: #007398;
      --deep-navy: #0a2540;
      --text-main: #1a1a1a;
      --text-muted: #64748b;
      --bg-body: #f8fafc;
      --accent: #e2e8f0;
    }
    body {
      font-family: 'Inter', sans-serif;
      line-height: 1.6;
      color: var(--text-main);
      background-color: var(--bg-body);
      margin: 0;
      padding: 0;
    }
    .nav-header {
      background: white;
      padding: 0.75rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--accent);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav-logo {
      font-weight: 700;
      color: var(--primary-blue);
      text-decoration: none;
      font-size: 0.8rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .content-grid {
      max-width: 1100px;
      margin: 2rem auto 3rem auto;
      display: grid;
      grid-template-columns: 1fr;
      gap: 2.5rem;
      padding: 0 1.5rem;
    }
    .main-content {
      background: white;
      border-radius: 8px;
      padding: 3rem;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      border: 1px solid var(--accent);
    }
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 3rem;
      max-width: 900px;
      margin: 0 auto 1.5rem auto;
      line-height: 1.1;
    }
    h2 {
      font-family: 'Playfair Display', serif;
      font-size: 1.8rem;
      color: var(--deep-navy);
      border-left: 4px solid var(--primary-blue);
      padding-left: 1rem;
      margin-bottom: 1.5rem;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      padding: 1.5rem 0;
      border-bottom: 1px solid #f1f5f9;
    }
    li:last-child {
      border: none;
    }
    a {
      color: var(--primary-blue);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.2s;
    }
    a:hover {
      color: #005a77;
    }
    footer {
      background: var(--deep-navy);
      color: #94a3b8;
      padding: 3rem 1.5rem;
      text-align: center;
      font-size: 0.9rem;
    }
    footer a { color: white; text-decoration: none; margin: 0 10px; }
    @media (max-width: 900px) {
      .main-content { padding: 1.5rem; }
      h1 { font-size: 2rem; }
      h1, h2, p, .content {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <nav class="nav-header">
    <a href="/" class="nav-logo">The National Review of Sciences for Students</a>
  </nav>
  <div class="content-grid">
    <main class="main-content">
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
              <a href="/volumes/volume-${volumeSlug}EN.html">${volume.englishTitulo}</a> (${volume.fecha})
            </li>
          `;
          }).join('')}
        </ul>
      </section>
`).join('')}
    </main>
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students. ISSN 3087-2839</p>
    <div style="margin-top: 1.5rem;">
      <a href="/" >Back to home</a>
    </div>
  </footer>
</body>
</html>
  `.trim();
const volumesIndexPathEn = path.join(volumesOutputHtmlDir, 'index.EN.html');
fs.writeFileSync(volumesIndexPathEn, volumesIndexContentEn, 'utf8');
console.log(`Generado índice HTML de volúmenes (EN): ${volumesIndexPathEn}`);
let newsItems = [];  // Declarar fuera para acceso en sitemap

async function generateNews() {
  // Procesar noticias desde Firestore
  const newsSnapshot = await db.collection('news').get();  // PRIMERO obtener el snapshot
  newsItems = newsSnapshot.docs.map(doc => doc.data()).map(item => ({  // Asignar a la outer newsItems (sin let)
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
    const headerImageHtml = newsItem.photo
      ? `<div class="hero-header" style="background-image: url('${newsItem.photo}')">
            <div class="hero-overlay">
              <div class="hero-content">
                <span class="kicker">Noticias Académicas</span>
                <h1>${newsItem.titulo}</h1>
                <div class="hero-meta">
                  <span class="author">Redacción Editorial</span> •
                  <span class="date">${newsItem.fecha}</span>
                </div>
              </div>
            </div>
         </div>`
      : `<div class="standard-header">
            <span class="kicker">Noticias Académicas</span>
            <h1>${newsItem.titulo}</h1>
            <div class="hero-meta" style="color: #666">
              <span class="author">Redacción Editorial</span> •
              <span class="date">${newsItem.fecha}</span>
            </div>
         </div>`;
    const esContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${newsItem.titulo.substring(0, 160)}...">
  <meta name="keywords" content="noticias, revista ciencias estudiantes, ${newsItem.titulo.replace(/[^a-zA-Z0-9]/g, ' ').substring(0, 100)}">
  <title>${newsItem.titulo} - Noticias - Revista Nacional de las Ciencias para Estudiantes</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Lora:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #007398;
      --nyt-black: #121212;
      --nyt-grey: #666666;
      --bg: #ffffff;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Lora', serif;
      color: var(--nyt-black);
      background-color: var(--bg);
      line-height: 1.8;
      -webkit-font-smoothing: antialiased;
    }
    /* --- TOP BAR --- */
    .nav-minimal {
      border-bottom: 1px solid #eee;
      padding: 15px 20px;
      text-align: center;
      background: white;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav-minimal a {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      letter-spacing: 2px;
      font-size: 11px;
      text-decoration: none;
      color: var(--nyt-black);
      text-transform: uppercase;
    }
      .article blockquote {
  border-left: 4px solid #5a3e36;
  background: #fdfaf9;
  padding: 20px 30px;
  margin: 2rem 0;
  font-style: italic;
}

    /* --- HERO HEADER (NYT STYLE) --- */
    .hero-header {
      height: 70vh;
      min-height: 400px;
      background-size: cover;
      background-position: center;
      background-attachment: scroll;
      position: relative;
      display: flex;
      align-items: flex-end;
      color: white;
    }
    .hero-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.8) 100%);
      display: flex;
      align-items: flex-end;
      padding: 60px 20px;
    }
    .hero-content, .standard-header {
      max-width: 800px;
      margin: 0 auto;
      width: 100%;
    }
    .standard-header {
      padding: 80px 20px 40px;
      text-align: center;
    }
    .kicker {
      display: block;
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 3px;
      color: var(--primary);
      margin-bottom: 15px;
    }
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2.5rem, 5vw, 4rem);
      line-height: 1.1;
      margin: 0 0 20px 0;
      font-weight: 900;
    }
    .hero-meta {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      opacity: 0.9;
    }
    /* --- CONTENT AREA --- */
    .article-body {
      max-width: 700px; /* Ancho de lectura perfecto */
      margin: 60px auto;
      padding: 0 20px;
      font-size: 1.2rem;
    }
    .article-body p {
      margin-bottom: 2rem;
    }
    /* Capitular (Drop Cap) - Muy New York Times */
    .article-body > p:first-of-type::first-letter {
      float: left;
      font-size: 5rem;
      line-height: 4rem;
      padding-top: 4px;
      padding-right: 8px;
      padding-left: 3px;
      font-family: 'Playfair Display', serif;
      font-weight: 700;
    }
    .article-body h2, .article-body h3 {
      font-family: 'Playfair Display', serif;
      font-size: 2rem;
      margin-top: 50px;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }
    .article-body strong {
      color: var(--primary);
    }
    .article-body a {
      color: var(--primary);
      text-decoration: none;
    }
    .article-body a:hover {
      text-decoration: underline;
    }
    .article-body img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1rem 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    /* --- ASIDE / ACTIONS --- */
    .back-nav {
      max-width: 700px;
      margin: 40px auto;
      border-top: 1px solid var(--nyt-black);
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
    }
    .back-nav a {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--nyt-black);
      text-decoration: none;
      transition: color 0.2s;
    }
    .back-nav a:hover { color: var(--primary); }
    /* --- RESPONSIVE --- */
    @media (max-width: 768px) {
      .hero-header { height: 60vh; }
      h1 { font-size: 2.2rem; }
      .article-body { font-size: 1.1rem; }
      .article-body > p:first-of-type::first-letter { font-size: 4rem; line-height: 3.2rem; }
    }
    @media (max-width: 900px) {
      h1, h2, p, .article-body {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <nav class="nav-minimal">
    <a href="/">Revista Nacional de las Ciencias para Estudiantes</a>
  </nav>
  <header>
    ${headerImageHtml}
  </header>
  <main class="article-body">
    <article class="ql-editor">
      ${cuerpoDecoded}
    </article>
    <div class="back-nav">
      <a href="/es/new">← Volver a Noticias</a>
      <a href="/">Ir al inicio</a>
    </div>
  </main>
  <footer style="padding: 60px 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; font-family: 'Inter', sans-serif;">
    &copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes.
    <br>Excelencia en Divulgación Científica Estudiantil.
  </footer>
</body>
</html>`;
    const headerImageHtmlEn = newsItem.photo
      ? `<div class="hero-header" style="background-image: url('${newsItem.photo}')">
            <div class="hero-overlay">
              <div class="hero-content">
                <span class="kicker">Academic News</span>
                <h1>${newsItem.title}</h1>
                <div class="hero-meta">
                  <span class="author">Editorial Staff</span> •
                  <span class="date">${newsItem.fecha}</span>
                </div>
              </div>
            </div>
         </div>`
      : `<div class="standard-header">
            <span class="kicker">Academic News</span>
            <h1>${newsItem.title}</h1>
            <div class="hero-meta" style="color: #666">
              <span class="author">Editorial Staff</span> •
              <span class="date">${newsItem.fecha}</span>
            </div>
         </div>`;
    const enContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${newsItem.title.substring(0, 160)}...">
  <meta name="keywords" content="news, student science journal, ${newsItem.title.replace(/[^a-zA-Z0-9]/g, ' ').substring(0, 100)}">
  <title>${newsItem.title} - News - The National Review of Sciences for Students</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Lora:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #007398;
      --nyt-black: #121212;
      --nyt-grey: #666666;
      --bg: #ffffff;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Lora', serif;
      color: var(--nyt-black);
      background-color: var(--bg);
      line-height: 1.8;
      -webkit-font-smoothing: antialiased;
    }
    /* --- TOP BAR --- */
    .nav-minimal {
      border-bottom: 1px solid #eee;
      padding: 15px 20px;
      text-align: center;
      background: white;
      position: sticky;
      top: 0;
      z-index: 100;
    }
      .article blockquote {
  border-left: 4px solid #5a3e36;
  background: #fdfaf9;
  padding: 20px 30px;
  margin: 2rem 0;
  font-style: italic;
}

    .nav-minimal a {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      letter-spacing: 2px;
      font-size: 11px;
      text-decoration: none;
      color: var(--nyt-black);
      text-transform: uppercase;
    }
    /* --- HERO HEADER (NYT STYLE) --- */
    .hero-header {
      height: 70vh;
      min-height: 400px;
      background-size: cover;
      background-position: center;
      background-attachment: scroll;
      position: relative;
      display: flex;
      align-items: flex-end;
      color: white;
    }
    .hero-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.8) 100%);
      display: flex;
      align-items: flex-end;
      padding: 60px 20px;
    }
    .hero-content, .standard-header {
      max-width: 800px;
      margin: 0 auto;
      width: 100%;
    }
    .standard-header {
      padding: 80px 20px 40px;
      text-align: center;
    }
    .kicker {
      display: block;
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 3px;
      color: var(--primary);
      margin-bottom: 15px;
    }
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2.5rem, 5vw, 4rem);
      line-height: 1.1;
      margin: 0 0 20px 0;
      font-weight: 900;
    }
    .hero-meta {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      opacity: 0.9;
    }
    /* --- CONTENT AREA --- */
    .article-body {
      max-width: 700px; /* Ancho de lectura perfecto */
      margin: 60px auto;
      padding: 0 20px;
      font-size: 1.2rem;
    }
    .article-body p {
      margin-bottom: 2rem;
    }
    /* Capitular (Drop Cap) - Muy New York Times */
    .article-body > p:first-of-type::first-letter {
      float: left;
      font-size: 5rem;
      line-height: 4rem;
      padding-top: 4px;
      padding-right: 8px;
      padding-left: 3px;
      font-family: 'Playfair Display', serif;
      font-weight: 700;
    }
    .article-body h2, .article-body h3 {
      font-family: 'Playfair Display', serif;
      font-size: 2rem;
      margin-top: 50px;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }
    .article-body strong {
      color: var(--primary);
    }
    .article-body a {
      color: var(--primary);
      text-decoration: none;
    }
    .article-body a:hover {
      text-decoration: underline;
    }
    .article-body img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1rem 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    /* --- ASIDE / ACTIONS --- */
    .back-nav {
      max-width: 700px;
      margin: 40px auto;
      border-top: 1px solid var(--nyt-black);
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
    }
    .back-nav a {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--nyt-black);
      text-decoration: none;
      transition: color 0.2s;
    }
    .back-nav a:hover { color: var(--primary); }
    /* --- RESPONSIVE --- */
    @media (max-width: 768px) {
      .hero-header { height: 60vh; }
      h1 { font-size: 2.2rem; }
      .article-body { font-size: 1.1rem; }
      .article-body > p:first-of-type::first-letter { font-size: 4rem; line-height: 3.2rem; }
    }
    @media (max-width: 900px) {
      h1, h2, p, .article-body {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <nav class="nav-minimal">
    <a href="/">The National Review of Sciences for Students</a>
  </nav>
  <header>
    ${headerImageHtmlEn}
  </header>
  <main class="article-body">
    <article class="ql-editor">
      ${contentDecoded}
    </article>
    <div class="back-nav">
      <a href="/en/new">← Back to News</a>
      <a href="/">Go to home</a>
    </div>
  </main>
  <footer style="padding: 60px 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; font-family: 'Inter', sans-serif;">
    &copy; ${new Date().getFullYear()} The National Review of Sciences for Students.
    <br>Excellence in Student Scientific Outreach.
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
      fecha: parseDateFlexible(item.fecha), // Ajusta a tu función formatDate
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Índice de Noticias - Revista Nacional de las Ciencias para Estudiantes</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Lora:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #007398;
      --nyt-black: #121212;
      --nyt-grey: #666666;
      --bg: #ffffff;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Lora', serif;
      color: var(--nyt-black);
      background-color: var(--bg);
      line-height: 1.8;
      -webkit-font-smoothing: antialiased;
    }
    /* --- TOP BAR --- */
    .nav-minimal {
      border-bottom: 1px solid #eee;
      padding: 15px 20px;
      text-align: center;
      background: white;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav-minimal a {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      letter-spacing: 2px;
      font-size: 11px;
      text-decoration: none;
      color: var(--nyt-black);
      text-transform: uppercase;
    }
    /* --- STANDARD HEADER --- */
    .standard-header {
      padding: 80px 20px 40px;
      text-align: center;
      max-width: 800px;
      margin: 0 auto;
    }
    .kicker {
      display: block;
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 3px;
      color: var(--primary);
      margin-bottom: 15px;
    }
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2.5rem, 5vw, 4rem);
      line-height: 1.1;
      margin: 0 0 20px 0;
      font-weight: 900;
    }
    /* --- CONTENT AREA --- */
    .article-body {
      max-width: 700px;
      margin: 60px auto;
      padding: 0 20px;
      font-size: 1.2rem;
    }
    .article-body p {
      margin-bottom: 2rem;
    }
    .article-body h2 {
      font-family: 'Playfair Display', serif;
      font-size: 2rem;
      margin-top: 50px;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      margin-bottom: 1.5rem;
      font-size: 1.1rem;
      border-bottom: 1px solid #eee;
      padding-bottom: 1rem;
    }
    li a {
      color: var(--nyt-black);
      text-decoration: none;
      font-weight: bold;
      font-family: 'Inter', sans-serif;
    }
    li a:hover {
      color: var(--primary);
    }
    li span {
      display: block;
      font-size: 0.9rem;
      color: var(--nyt-grey);
    }
    /* --- RESPONSIVE --- */
    @media (max-width: 768px) {
      h1 { font-size: 2.2rem; }
      .article-body { font-size: 1.1rem; }
    }
    @media (max-width: 900px) {
      h1, h2, p, .article-body {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <nav class="nav-minimal">
    <a href="/">Revista Nacional de las Ciencias para Estudiantes</a>
  </nav>
  <header class="standard-header">
    <span class="kicker">Archivo</span>
    <h1>Índice de Noticias por Año</h1>
  </header>
  <main class="article-body">
    <p>Accede a las noticias por año de publicación.</p>
${Object.keys(newsByYear).sort().reverse().map(year => `
    <section>
      <h2>Año ${year}</h2>
      <ul>
        ${newsByYear[year].map(item => {
          const slug = generateSlug(item.titulo + ' ' + item.fecha);
          return `
          <li>
            <a href="/news/${slug}.html">${item.titulo}</a>
            <span>${item.fecha}</span>
          </li>
        `;
        }).join('')}
      </ul>
    </section>
`).join('')}
  </main>
  <footer style="padding: 60px 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; font-family: 'Inter', sans-serif;">
    &copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes.
    <br>Excelencia en Divulgación Científica Estudiantil.
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>News Index - The National Review of Sciences for Students</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Lora:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #007398;
      --nyt-black: #121212;
      --nyt-grey: #666666;
      --bg: #ffffff;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Lora', serif;
      color: var(--nyt-black);
      background-color: var(--bg);
      line-height: 1.8;
      -webkit-font-smoothing: antialiased;
    }
    /* --- TOP BAR --- */
    .nav-minimal {
      border-bottom: 1px solid #eee;
      padding: 15px 20px;
      text-align: center;
      background: white;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav-minimal a {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      letter-spacing: 2px;
      font-size: 11px;
      text-decoration: none;
      color: var(--nyt-black);
      text-transform: uppercase;
    }
    /* --- STANDARD HEADER --- */
    .standard-header {
      padding: 80px 20px 40px;
      text-align: center;
      max-width: 800px;
      margin: 0 auto;
    }
    .kicker {
      display: block;
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 3px;
      color: var(--primary);
      margin-bottom: 15px;
    }
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2.5rem, 5vw, 4rem);
      line-height: 1.1;
      margin: 0 0 20px 0;
      font-weight: 900;
    }
    /* --- CONTENT AREA --- */
    .article-body {
      max-width: 700px;
      margin: 60px auto;
      padding: 0 20px;
      font-size: 1.2rem;
    }
    .article-body p {
      margin-bottom: 2rem;
    }
    .article-body h2 {
      font-family: 'Playfair Display', serif;
      font-size: 2rem;
      margin-top: 50px;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      margin-bottom: 1.5rem;
      font-size: 1.1rem;
      border-bottom: 1px solid #eee;
      padding-bottom: 1rem;
    }
    li a {
      color: var(--nyt-black);
      text-decoration: none;
      font-weight: bold;
      font-family: 'Inter', sans-serif;
    }
    li a:hover {
      color: var(--primary);
    }
    li span {
      display: block;
      font-size: 0.9rem;
      color: var(--nyt-grey);
    }
    /* --- RESPONSIVE --- */
    @media (max-width: 768px) {
      h1 { font-size: 2.2rem; }
      .article-body { font-size: 1.1rem; }
    }
    @media (max-width: 900px) {
      h1, h2, p, .article-body {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <nav class="nav-minimal">
    <a href="/">The National Review of Sciences for Students</a>
  </nav>
  <header class="standard-header">
    <span class="kicker">Archive</span>
    <h1>News Index by Year</h1>
  </header>
  <main class="article-body">
    <p>Access news by year of publication.</p>
${Object.keys(newsByYear).sort().reverse().map(year => `
    <section>
      <h2>Year ${year}</h2>
      <ul>
        ${newsByYear[year].map(item => {
          const slug = generateSlug(item.titulo + ' ' + item.fecha);
          return `
          <li>
            <a href="/news/${slug}.EN.html">${item.title}</a>
            <span>${item.fecha}</span>
          </li>
        `;
        }).join('')}
      </ul>
    </section>
`).join('')}
  </main>
  <footer style="padding: 60px 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; font-family: 'Inter', sans-serif;">
    &copy; ${new Date().getFullYear()} The National Review of Sciences for Students.
    <br>Excellence in Student Scientific Outreach.
  </footer>
</body>
</html>
    `.trim();
  const newsIndexPathEn = path.join(newsOutputHtmlDir, 'index.EN.html');
  fs.writeFileSync(newsIndexPathEn, newsIndexContentEn, 'utf8');
  console.log(`Generado índice HTML de noticias (EN): ${newsIndexPathEn}`);
}
await generateNews();
 // Procesar equipo (sigue de CSV)
   const normalizeForEmail = str =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/\s+/g, ".");

const POSTAL_ADDRESS = "San Felipe, Valparaíso, Chile";

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
  const isOnlyAuthorEs = rolesEs.length === 1 && rolesEs[0].toLowerCase() === 'autor';
  const isOnlyAuthorEn = rolesEnList.length === 1 && rolesEnList[0].toLowerCase() === 'author';
  const bioTitleEs = isOnlyAuthorEs ? 'Sobre el autor' : 'Perfil';
  const areasTitleEs = isOnlyAuthorEs ? 'Líneas de Investigación' : 'Áreas de Interés';
  const bioTitleEn = isOnlyAuthorEn ? 'About the Author' : 'Profile';
  const areasTitleEn = isOnlyAuthorEn ? 'Research Areas' : 'Areas of Interest';
  const areasTagsHtml = areasList.length ? areasList.map(area => `<span class="keyword-tag">${area}</span>`).join('') : '<p>No especificadas</p>';
  const areasTagsHtmlEn = areasListEn.length ? areasListEn.map(area => `<span class="keyword-tag">${area}</span>`).join('') : '<p>Not specified</p>';
  const isEditorEnJefe =
  rolesEs.some(r => r.toLowerCase() === "editor en jefe") ||
  rolesEnList.some(r => r.toLowerCase() === "editor-in-chief");

const institutionalEmail = isEditorEnJefe
  ? `${normalizeForEmail(nombre)}@revistacienciasestudiantes.com`
  : "";

  const articlesSectionEs = isAuthor ? `
<section id="articles">
  <h2 class="section-title">Publicaciones en la Revista</h2>
  <div>
    ${publishedArticles.map(article => {
      const articleSlug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
      return `
      <div class="article-item">
        <a href="/articles/article-${articleSlug}.html" class="article-link">${article.titulo}</a>
        <div class="article-meta">
          Vol. ${article.volumen}, Núm. ${article.numero} • ${article.fecha}
        </div>
      </div>
      `;
    }).join('')}
  </div>
</section>` : '';
  const articlesSectionEn = isAuthor ? `
<section id="articles">
  <h2 class="section-title">Publications in the Journal</h2>
  <div>
    ${publishedArticles.map(article => {
      const articleSlug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
      return `
      <div class="article-item">
        <a href="/articles/article-${articleSlug}EN.html" class="article-link">${article.title || article.titulo}</a>
        <div class="article-meta">
          Vol. ${article.volumen}, Issue ${article.numero} • ${article.fecha}
        </div>
      </div>
      `;
    }).join('')}
  </div>
</section>` : '';
  const editorExtras = isEditorEnJefe
  ? `
    <div class="profile-inst">
      <a href="mailto:${institutionalEmail}" style="color:inherit;text-decoration:none;">
        ${institutionalEmail}
      </a>
    </div>
    <div class="profile-inst">${POSTAL_ADDRESS}</div>
  `
  : "";


const institutionHtmlEs = `
  ${institution ? `<div class="profile-inst">${institution}</div>` : ""}
  ${editorExtras}
`;

const institutionHtmlEn = `
  ${institution ? `<div class="profile-inst">${institution}</div>` : ""}
  ${editorExtras}
`;


  const esContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${descripcion.substring(0, 160)}...">
  <meta name="keywords" content="${areas}, ${rolesStr}, Revista Nacional de las Ciencias para Estudiantes">
  <meta name="author" content="${nombre}">
  <title>${nombre} - Equipo de Revista Nacional de las Ciencias para Estudiantes</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Lora:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #007398;
      --text: #1a1a1a;
      --grey: #555555;
      --light-grey: #f5f5f5;
      --border: #e0e0e0;
    }
    body {
      margin: 0;
      font-family: 'Lora', serif;
      color: var(--text);
      background-color: #fff;
      line-height: 1.7;
    }
    /* Navegación Minimalista */
    .top-nav {
      padding: 20px;
      text-align: center;
      border-bottom: 1px solid var(--border);
      font-family: 'Inter', sans-serif;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-size: 11px;
    }
    .top-nav a { text-decoration: none; color: var(--text); font-weight: 700; }
    /* Cabecera de Perfil */
    .profile-hero {
      max-width: 900px;
      margin: 60px auto;
      padding: 0 20px;
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 50px;
      align-items: center;
    }
    .img-container {
      position: relative;
    }
    .profile-img {
      width: 220px;
      height: 220px;
      object-fit: cover;
      filter: grayscale(20%);
      border-radius: 2px; /* Cuadrado editorial, no circular */
      box-shadow: 20px 20px 0px var(--light-grey);
    }
    .no-img {
      width: 220px;
      height: 220px;
      background: var(--light-grey);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', sans-serif;
      color: #999;
      font-size: 12px;
      text-transform: uppercase;
    }
    .profile-info h1 {
      font-family: 'Playfair Display', serif;
      font-size: 3.5rem;
      margin: 0;
      line-height: 1;
      font-weight: 900;
    }
    .profile-role {
      font-family: 'Inter', sans-serif;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 3px;
      font-size: 13px;
      font-weight: 700;
      margin-top: 15px;
      display: block;
    }
    .profile-inst {
      font-family: 'Inter', sans-serif;
      color: var(--grey);
      font-size: 14px;
      margin-top: 5px;
    }
    /* Secciones de Contenido */
    .container {
      max-width: 800px;
      margin: 0 auto 100px;
      padding: 0 20px;
    }
    .section-title {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 3px;
      border-bottom: 1px solid var(--text);
      padding-bottom: 10px;
      margin: 60px 0 30px;
      color: var(--text);
    }
    .bio-text { font-size: 1.15rem; }
    /* Tags de Áreas */
    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .keyword-tag {
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      background: var(--light-grey);
      padding: 6px 15px;
      border-radius: 20px;
      color: var(--text);
      font-weight: 600;
    }
    /* Lista de Artículos Estilo Bibliográfico */
    .article-item {
      margin-bottom: 25px;
      padding-left: 20px;
      border-left: 2px solid var(--light-grey);
      transition: border-color 0.3s;
    }
    .article-item:hover { border-left-color: var(--primary); }
   
    .article-link {
      font-family: 'Playfair Display', serif;
      font-size: 1.3rem;
      color: var(--text);
      text-decoration: none;
      display: block;
      line-height: 1.3;
    }
    .article-meta {
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      color: var(--grey);
      margin-top: 5px;
    }
    .footer-nav {
      text-align: center;
      padding: 60px 20px;
      background: var(--light-grey);
      margin-top: 100px;
    }
    .footer-nav a {
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      text-decoration: none;
      color: var(--primary);
      font-weight: 700;
      margin: 0 15px;
      text-transform: uppercase;
    }
    @media (max-width: 768px) {
      .profile-hero {
        grid-template-columns: 1fr;
        text-align: center;
        margin-top: 30px;
      }
      .profile-img, .no-img { margin: 0 auto; width: 180px; height: 180px; }
      .profile-info h1 { font-size: 2.5rem; }
      .section-title { text-align: center; }
    }
    @media (max-width: 900px) {
      h1, h2, p, .bio-text {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <nav class="top-nav">
    <a href="/">Revista Nacional de las Ciencias para Estudiantes</a>
  </nav>
  <header class="profile-hero">
    <div class="img-container">
      ${imagen ? `<img src="${imagen}" alt="${nombre}" class="profile-img">` : `<div class="no-img">Sin Imagen</div>`}
    </div>
    <div class="profile-info">
      <span class="profile-role">${rolesStr}</span>
      <h1>${nombre}</h1>
      ${institutionHtmlEs}
    </div>
  </header>
  <main class="container">
    <section id="descripcion">
      <h2 class="section-title">${bioTitleEs}</h2>
      <div class="bio-text">${descripcion}</div>
    </section>
    <section id="areas">
      <h2 class="section-title">${areasTitleEs}</h2>
      <div class="tags-container">
        ${areasTagsHtml}
      </div>
    </section>
    ${articlesSectionEs}
  </main>
  <footer class="footer-nav">
    <a href="/es/team">← Equipo Editorial</a>
    <a href="/">Inicio</a>
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
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Lora:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #007398;
      --text: #1a1a1a;
      --grey: #555555;
      --light-grey: #f5f5f5;
      --border: #e0e0e0;
    }
    body {
      margin: 0;
      font-family: 'Lora', serif;
      color: var(--text);
      background-color: #fff;
      line-height: 1.7;
    }
    /* Navegación Minimalista */
    .top-nav {
      padding: 20px;
      text-align: center;
      border-bottom: 1px solid var(--border);
      font-family: 'Inter', sans-serif;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-size: 11px;
    }
    .top-nav a { text-decoration: none; color: var(--text); font-weight: 700; }
    /* Cabecera de Perfil */
    .profile-hero {
      max-width: 900px;
      margin: 60px auto;
      padding: 0 20px;
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 50px;
      align-items: center;
    }
    .img-container {
      position: relative;
    }
    .profile-img {
      width: 220px;
      height: 220px;
      object-fit: cover;
      filter: grayscale(20%);
      border-radius: 2px; /* Cuadrado editorial, no circular */
      box-shadow: 20px 20px 0px var(--light-grey);
    }
    .no-img {
      width: 220px;
      height: 220px;
      background: var(--light-grey);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', sans-serif;
      color: #999;
      font-size: 12px;
      text-transform: uppercase;
    }
    .profile-info h1 {
      font-family: 'Playfair Display', serif;
      font-size: 3.5rem;
      margin: 0;
      line-height: 1;
      font-weight: 900;
    }
    .profile-role {
      font-family: 'Inter', sans-serif;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 3px;
      font-size: 13px;
      font-weight: 700;
      margin-top: 15px;
      display: block;
    }
    .profile-inst {
      font-family: 'Inter', sans-serif;
      color: var(--grey);
      font-size: 14px;
      margin-top: 5px;
    }
    /* Secciones de Contenido */
    .container {
      max-width: 800px;
      margin: 0 auto 100px;
      padding: 0 20px;
    }
    .section-title {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 3px;
      border-bottom: 1px solid var(--text);
      padding-bottom: 10px;
      margin: 60px 0 30px;
      color: var(--text);
    }
    .bio-text { font-size: 1.15rem; }
    /* Tags de Áreas */
    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .keyword-tag {
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      background: var(--light-grey);
      padding: 6px 15px;
      border-radius: 20px;
      color: var(--text);
      font-weight: 600;
    }
    /* Lista de Artículos Estilo Bibliográfico */
    .article-item {
      margin-bottom: 25px;
      padding-left: 20px;
      border-left: 2px solid var(--light-grey);
      transition: border-color 0.3s;
    }
    .article-item:hover { border-left-color: var(--primary); }
   
    .article-link {
      font-family: 'Playfair Display', serif;
      font-size: 1.3rem;
      color: var(--text);
      text-decoration: none;
      display: block;
      line-height: 1.3;
    }
    .article-meta {
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      color: var(--grey);
      margin-top: 5px;
    }
    .footer-nav {
      text-align: center;
      padding: 60px 20px;
      background: var(--light-grey);
      margin-top: 100px;
    }
    .footer-nav a {
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      text-decoration: none;
      color: var(--primary);
      font-weight: 700;
      margin: 0 15px;
      text-transform: uppercase;
    }
    @media (max-width: 768px) {
      .profile-hero {
        grid-template-columns: 1fr;
        text-align: center;
        margin-top: 30px;
      }
      .profile-img, .no-img { margin: 0 auto; width: 180px; height: 180px; }
      .profile-info h1 { font-size: 2.5rem; }
      .section-title { text-align: center; }
    }
    @media (max-width: 900px) {
      h1, h2, p, .bio-text {
        word-break: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }
    }
  </style>
</head>
<body>
  <nav class="top-nav">
    <a href="/">The National Review of Sciences for Students</a>
  </nav>
  <header class="profile-hero">
    <div class="img-container">
      ${imagen ? `<img src="${imagen}" alt="${nombre}" class="profile-img">` : `<div class="no-img">No Image</div>`}
    </div>
    <div class="profile-info">
      <span class="profile-role">${rolesEn}</span>
      <h1>${nombre}</h1>
      ${institutionHtmlEn}
    </div>
  </header>
  <main class="container">
    <section id="description">
      <h2 class="section-title">${bioTitleEn}</h2>
      <div class="bio-text">${description}</div>
    </section>
    <section id="areas">
      <h2 class="section-title">${areasTitleEn}</h2>
      <div class="tags-container">
        ${areasTagsHtmlEn}
      </div>
    </section>
    ${articlesSectionEn}
  </main>
  <footer class="footer-nav">
    <a href="/en/team">← Editorial Team</a>
    <a href="/">Home</a>
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