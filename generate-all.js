const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
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

function formatDateEs(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateEn(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
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

function generateBibTeX(article) {
  const year = new Date(article.fecha).getFullYear();
  const firstAuthor = article.autores.split(';')[0].split(' ').pop().toLowerCase();
  const key = `${firstAuthor}${year}${article.numeroArticulo}`;
  return `@article{${key},
  author = {${article.autores.replace(/;/g, ' and ')}},
  title = {${article.titulo}},
  journal = {Revista Nacional de las Ciencias para Estudiantes},
  year = {${year}},
  volume = {${article.volumen}},
  number = {${article.numero}},
  pages = {${article.primeraPagina}-${article.ultimaPagina}},
  issn = {3087-2839},
  url = {${domain}/articles/article-${generateSlug(article.titulo)}-${article.numeroArticulo}.html}
}`.trim();
}

// SVG Open Access exacto (no modificar)
const oaSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 53" width="24" height="36" style="vertical-align:middle; margin-right:4px;">
  <path fill="#F48120" d="M18 21.3c-8.7 0-15.8 7.1-15.8 15.8S9.3 52.9 18 52.9s15.8-7.1 15.8-15.8S26.7 21.3 18 21.3zm0 25.1c-5.1 0-9.3-4.2-9.3-9.3s4.2-9.3 9.3-9.3 9.3 4.2 9.3 9.3-4.2 9.3-9.3 9.3z"/>
  <path fill="#F48120" d="M18 0c-7.5 0-13.6 6.1-13.6 13.6V23h6.5v-9.4c0-3.9 3.2-7.1 7.1-7.1s7.1 3.2 7.1 7.1V32h6.5V13.6C31.6 6.1 25.5 0 18 0z"/>
  <circle fill="#F48120" cx="18" cy="37.1" r="4.8"/>
</svg>`;

// SVG ORCID exacto (no modificar)
const orcidSvg = `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" width="16" height="16"> <circle cx="128" cy="128" r="120" fill="#A6CE39"/> <g fill="#FFFFFF"> <rect x="71" y="78" width="17" height="102"/> <circle cx="79.5" cy="56" r="11"/> <path d="M103 78 v102 h41.5 c28.2 0 51-22.8 51-51 s-22.8-51-51-51 H103 zm17 17 h24.5 c18.8 0 34 15.2 34 34 s-15.2 34-34 34 H120 V95 z" fill-rule="evenodd"/> </g> </svg>`;

(async () => {
  try {
    // Procesar equipo primero para obtener instituciones
    console.log('📥 Cargando team data...');
    const teamJsonUrl = 'https://www.revistacienciasestudiantes.com/team/Team.json';
    const teamRes = await fetch(teamJsonUrl);
    const teamData = await teamRes.json();
    console.log(`✅ Team data cargado: ${teamData.length} usuarios (incluye anónimos)`);

    const authorToInstitution = {};
    const authorToSlug = {};
    const authorToOrcid = {};
    const anonymousAuthors = {};

    teamData.forEach(user => {
      const name = user.displayName || `${user.firstName} ${user.lastName}`.trim();
      if (name) {
        authorToInstitution[name] = user.institution || '';
        authorToSlug[name] = user.slug;
        authorToOrcid[name] = user.orcid || '';
        if (user.isAnonymous) {
          anonymousAuthors[name] = true;
          console.log(` 📌 Autor anónimo encontrado: ${name} -> /team/${user.slug}.html`);
        }
      }
    });
    console.log(`📊 Autores anónimos en team: ${Object.keys(anonymousAuthors).length}`);

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
        tituloEnglish: data.tituloEnglish || '',
        autores: autoresStr,
        institutions,
        resumen: data.resumen || 'Resumen no disponible',
        abstract: data.abstract || 'English abstract not available',
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
        receivedDate: parseDateFlexible(data.receivedDate),
        acceptedDate: parseDateFlexible(data.acceptedDate),
        conflicts: data.conflicts || 'Los autores declaran no tener conflictos de interés.',
        conflictsEnglish: data.conflictsEnglish || 'The authors declare no conflicts of interest.',
        funding: data.funding || 'No declarada',
        fundingEnglish: data.fundingEnglish || 'Not declared',
        acknowledgments: data.acknowledgments || '',
        acknowledgmentsEnglish: data.acknowledgmentsEnglish || '',
        authorCredits: data.authorCredits || '',
        authorCreditsEnglish: data.authorCreditsEnglish || '',
        dataAvailability: data.dataAvailability || '',
        dataAvailabilityEnglish: data.dataAvailabilityEnglish || '',
        submissionId: data.submissionId || '',
        authorId: data.authorId || '',
        html_es: data.html_es || '',
        html_en: data.html_en || '',
        pdfUrl: data.pdfUrl || '',
        referencias: data.referencias || '' // Nuevo campo unificado para referencias
      };
    });

    fs.writeFileSync(outputJson, JSON.stringify(articles, null, 2), 'utf8');
    console.log(`✅ Archivo generado: ${outputJson} (${articles.length} artículos)`);

    let authorToArticles = {};
    articles.forEach(article => {
      const authors = article.autores.split(';').map(a => a.trim());
      authors.forEach(auth => {
        if (!authorToArticles[auth]) authorToArticles[auth] = [];
        authorToArticles[auth].push(article);
      });
    });

    for (const article of articles) {
      const authorsList = article.autores.split(';').map(a => formatAuthorForCitation(a));
      const authorMetaTags = authorsList.map(author => `<meta name="citation_author" content="${author}">`).join('\n');
      const articleSlug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
      article.pdf = article.pdfUrl;

      const authorsArray = article.autores.split(';').map(a => a.trim()).filter(Boolean);

      const authorToSlugMap = {};
      const authorToOrcidMap = {};
      teamData.forEach(user => {
        const name = user.displayName || `${user.firstName} ${user.lastName}`.trim();
        if (name) {
          authorToSlugMap[name] = user.slug;
          authorToOrcidMap[name] = user.orcid || '';
        }
      });

      const useTeamData = Object.keys(authorToSlugMap).length > 0;

      const authorsDisplay = authorsArray.map(auth => {
        const slug = authorToSlugMap[auth];
        const orcid = authorToOrcidMap[auth];
        let orcidHtml = '';
        if (orcid) {
          orcidHtml = `<a href="https://orcid.org/${orcid}" target="_blank" rel="noopener noreferrer" class="orcid-link" style="margin-left:4px; display:inline-block; vertical-align:middle;">${orcidSvg}</a>`;
        }
        if (slug && useTeamData) {
          return `<a href="/team/${slug}.html" class="author-link">${auth}</a>${orcidHtml}`;
        } else {
          if (!useTeamData && authorsArray.length > 0) {
            return auth;
          }
          console.log(`⚠️ Autor no encontrado en teamData: ${auth}`);
          return `<span class="author-name">${auth}</span>${orcidHtml}`;
        }
      }).join(', ');

      const finalAuthorsDisplay = useTeamData ? authorsDisplay : formatAuthorsDisplay(article.autores, 'es');

      const authorsAPA = formatAuthorsAPA(article.autores);
      const authorsChicagoEs = formatAuthorsChicagoOrMLA(article.autores, 'es');
      const authorsMLAEs = formatAuthorsChicagoOrMLA(article.autores, 'es');
      const authorsChicagoEn = formatAuthorsChicagoOrMLA(article.autores, 'en');
      const authorsMLAEn = formatAuthorsChicagoOrMLA(article.autores, 'en');
      const year = new Date(article.fecha).getFullYear();
      const tipoEs = article.tipo || 'Artículo de Investigación';
      const typeEn = article.type || 'Research Article';
      const bibtex = generateBibTeX(article);
      const resumenParagraphs = article.resumen.split('\n\n').map(p => `<p class="abstract-text">${p}</p>`).join('');
      const abstractParagraphs = article.abstract.split('\n\n').map(p => `<p class="abstract-text">${p}</p>`).join('');

      // Procesar referencias del campo unificado
      const referencesHtml = (() => {
        if (!article.referencias) return '<p>No hay referencias disponibles.</p>';
        
        // Si las referencias vienen como HTML completo
        if (article.referencias.includes('<div class="references-list">')) {
          return article.referencias;
        }
        
        // Si vienen como items separados, construir la estructura
        const refItems = article.referencias.split('\n').filter(line => line.trim());
        if (refItems.length) {
          const items = refItems.map(ref => {
            // Extraer ID si existe en formato #ref-nombre
            const idMatch = ref.match(/id="([^"]+)"/);
            const id = idMatch ? idMatch[1] : '';
            return `<div class="reference-item"${id ? ` id="${id}"` : ''}>${ref}</div>`;
          }).join('');
          return `<div class="references-list">${items}</div>`;
        }
        
        return '<p>No hay referencias disponibles.</p>';
      })();

      const htmlContentEs = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
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
  <meta name="citation_abstract" content="${article.resumen.replace(/"/g, '&quot;')}">
  <meta name="citation_abstract" xml:lang="en" content="${article.abstract.replace(/"/g, '&quot;')}">
  <meta name="citation_keywords" content="${article.palabras_clave.join('; ')}">
  <meta name="citation_language" content="es">
  <meta name="description" content="${article.resumen.substring(0, 160)}...">
  <meta name="keywords" content="${article.palabras_clave.join(', ')}">
  <title>${article.titulo} - Revista Nacional de las Ciencias para Estudiantes</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,700&family=JetBrains+Mono&family=Lora:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=es6"></script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  <style>
    :root {
      --nature-blue: #005a7d;
      --nature-blue-dark: #003e56;
      --nature-black: #111111;
      --text-main: #222222;
      --text-light: #595959;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
      --bg-soft: #f8f9fa;
      --bg-hover: #f3f4f6;
      --accent: #c2410c;
      --sidebar-width: 260px;
      --aside-width: 280px;
      --content-max-width: 800px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Lora', serif;
      line-height: 1.7;
      color: var(--text-main);
      background-color: #fff;
      margin: 0;
      overflow-x: hidden;
    }

    /* Top Navigation */
    .top-nav {
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 2rem;
      background: #fff;
      position: sticky;
      top: 0;
      z-index: 1000;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'Inter', sans-serif;
    }

    .journal-name {
      font-weight: 700;
      font-size: 1rem;
      color: var(--nature-black);
      text-decoration: none;
      letter-spacing: -0.02em;
    }

    .journal-name:hover {
      color: var(--nature-blue);
    }

    .issn-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      background: var(--bg-soft);
      padding: 4px 12px;
      border-radius: 20px;
      border: 1px solid var(--border-color);
      color: var(--text-light);
    }

    /* Main Layout */
    .main-wrapper {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: var(--sidebar-width) minmax(0, 1fr) var(--aside-width);
      gap: 3rem;
      padding: 2rem;
    }

    /* Left Sidebar - Table of Contents */
    .toc-sidebar {
      position: sticky;
      top: 100px;
      height: fit-content;
      font-family: 'Inter', sans-serif;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
      scrollbar-width: thin;
      padding-right: 0.5rem;
    }

    .toc-sidebar::-webkit-scrollbar {
      width: 4px;
    }

    .toc-sidebar::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 4px;
    }
/* === ESTILOS PARA TABLAS ACADÉMICAS ÉPICAS === */
.table-responsive {
  overflow-x: auto;
  margin: 1.5em 0;
  border-radius: 4px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background-color: #ffffff;
  font-size: 0.95em;
  box-shadow: 0 2px 3px rgba(0,0,0,0.05);
}

/* Borde superior e inferior para el encabezado */
thead tr {
  border-top: 2px solid #2c3e50; /* Azul oscuro/negro para la línea superior */
  border-bottom: 1px solid #7f8c8d; /* Gris para la línea inferior del encabezado */
}

/* Estilo para las celdas del encabezado */
th {
  background-color: #f8f9fa; /* Gris muy suave de fondo */
  color: #1a2634;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 0.9em;
  padding: 14px 10px;
  text-align: center; /* CENTRADO */
  vertical-align: middle;
}

/* Estilo para las celdas del cuerpo */
td {
  padding: 14px 10px;
  text-align: center; /* CENTRADO */
  vertical-align: middle;
  border-bottom: 1px solid #e0e0e0; /* Línea horizontal suave entre filas */
  word-break: break-word; /* ¡Evita desbordes! */
}

/* Eliminar el borde inferior de la última fila para que no quede uno extra */
tbody tr:last-child td {
  border-bottom: none;
}

/* Borde inferior final para la tabla */
tbody {
  border-bottom: 2px solid #2c3e50; /* Mismo color que el borde superior */
}

/* Estilo para las listas dentro de las celdas (que queden alineadas a la izquierda) */
td ol, td ul {
  text-align: left;
  margin: 0;
  padding-left: 1.2em;
}

/* Estilo para la fuente (caption) de la tabla */
caption {
  font-size: 1.1em;
  font-weight: 600;
  color: #1a2634;
  background-color: #f0f3f5;
  padding: 12px 10px;
  caption-side: top; /* La leyenda arriba */
  border: 1px solid #d0d7dd;
  border-bottom: none; /* Para que se fusione con la tabla */
  border-radius: 4px 4px 0 0;
  letter-spacing: 0.02em;
}
    .toc-title {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }

    .toc-list {
      list-style: none;
      border-left: 1px solid var(--border-color);
    }

    .toc-item {
      margin: 0;
    }

    .toc-item a {
      display: block;
      padding: 0.4rem 1rem;
      color: var(--text-light);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 400;
      transition: all 0.2s ease;
      border-left: 2px solid transparent;
      margin-left: -1px;
    }

    .toc-item a:hover {
      color: var(--nature-blue);
      border-left-color: var(--nature-blue);
      background: var(--bg-hover);
    }

    .toc-item a.active {
      color: var(--nature-blue);
      border-left-color: var(--nature-blue);
      font-weight: 500;
      background: linear-gradient(to right, var(--bg-soft), transparent);
    }

    /* Main Content */
    .article-container {
      max-width: var(--content-max-width);
      width: 100%;
    }

    .article-header {
      margin-bottom: 2.5rem;
    }

    .article-type {
      font-family: 'Inter', sans-serif;
      text-transform: uppercase;
      font-weight: 600;
      font-size: 0.7rem;
      letter-spacing: 0.1em;
      color: var(--accent);
      margin-bottom: 0.75rem;
    }

    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 2.4rem;
      line-height: 1.2;
      margin: 0.5rem 0 1rem 0;
      color: var(--nature-black);
      font-weight: 700;
    }

    .alt-title-container {
      margin-bottom: 1.5rem;
    }

    .alt-title {
      font-size: 1.1rem;
      color: var(--text-light);
      border-bottom: 1px dotted var(--text-light);
      display: inline-block;
      cursor: help;
      font-style: italic;
      transition: border-color 0.2s;
    }

    .alt-title:hover {
      border-bottom-color: var(--nature-blue);
      color: var(--nature-blue);
    }

    .authors {
      font-family: 'Inter', sans-serif;
      font-size: 1.1rem;
      font-weight: 500;
      margin-bottom: 1rem;
      line-height: 1.5;
    }

    .authors a {
      color: var(--nature-blue);
      text-decoration: none;
      border-bottom: 1px dotted transparent;
      transition: border-color 0.2s;
    }

    .authors a:hover {
      border-bottom-color: var(--nature-blue);
    }

    .orcid-link {
      display: inline-block;
      vertical-align: middle;
      margin-left: 4px;
      opacity: 0.8;
      transition: opacity 0.2s;
    }

    .orcid-link:hover {
      opacity: 1;
    }

    .meta-box {
      font-size: 0.9rem;
      color: var(--text-light);
      margin-top: 1rem;
      display: flex;
      gap: 1.5rem;
      align-items: center;
      flex-wrap: wrap;
      font-family: 'Inter', sans-serif;
    }

    .action-bar {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      margin: 1.5rem 0 2rem 0;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
    }

    .btn-pdf {
      background: var(--nature-blue);
      color: white !important;
      padding: 0.6rem 1.5rem;
      border-radius: 4px;
      text-decoration: none;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s;
      border: none;
      cursor: pointer;
    }

    .btn-pdf:hover {
      background: var(--nature-blue-dark);
    }

    .oa-label {
      display: inline-flex;
      align-items: center;
      color: #F48120;
      font-weight: 500;
      font-size: 0.9rem;
      font-family: 'Inter', sans-serif;
    }

    h2 {
      font-family: 'Inter', sans-serif;
      font-size: 1.3rem;
      font-weight: 600;
      border-bottom: 2px solid var(--nature-black);
      padding-bottom: 0.4rem;
      margin: 2.5rem 0 1.5rem 0;
      scroll-margin-top: 100px;
    }

    h3 {
      font-family: 'Inter', sans-serif;
      font-size: 1.1rem;
      font-weight: 600;
      margin: 1.8rem 0 1rem 0;
    }

    .abstract-container {
      margin-bottom: 2rem;
    }

    .abstract-text {
      font-size: 1.05rem;
      text-align: justify;
      color: var(--text-main);
      margin-bottom: 1rem;
    }

    .abstract-toggle {
      margin-top: 1rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-soft);
    }

    .abstract-toggle summary {
      font-family: 'Inter', sans-serif;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.75rem 1rem;
      cursor: pointer;
      color: var(--nature-blue);
      list-style: none;
    }

    .abstract-toggle summary::-webkit-details-marker {
      display: none;
    }

    .abstract-toggle summary::before {
      content: '▶';
      display: inline-block;
      width: 16px;
      margin-right: 8px;
      transition: transform 0.2s;
      color: var(--nature-blue);
    }

    .abstract-toggle[open] summary::before {
      transform: rotate(90deg);
    }

    .abstract-toggle-content {
      padding: 1rem;
      border-top: 1px solid var(--border-color);
      background: white;
      border-radius: 0 0 6px 6px;
      font-style: italic;
    }

    .article-content {
      font-size: 1.05rem;
      line-height: 1.7;
    }

    .article-content p {
      margin-bottom: 1.2rem;
    }

    .article-content img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1.5rem 0;
    }

    .citation-link {
      color: var(--nature-blue);
      text-decoration: none;
      border-bottom: 1px dotted var(--nature-blue);
      cursor: pointer;
      transition: all 0.2s;
    }

    .citation-link:hover {
      border-bottom-style: solid;
    }

    /* Estilos para las referencias (formato Chicago) */
    .references-list {
      margin-top: 2rem;
      font-size: 0.95rem;
    }

    .reference-item {
      margin-bottom: 1.2rem;
      padding-left: 2rem;
      text-indent: -2rem;  /* Sangría francesa */
      line-height: 1.6;
      word-wrap: break-word;
      scroll-margin-top: 100px;
    }

    .reference-item em {
      font-style: italic;
    }

    .reference-item a {
      color: #005a7d;
      text-decoration: none;
      word-break: break-all;
      border-bottom: 1px dotted #ccc;
    }

    .reference-item a:hover {
      border-bottom: 1px solid #005a7d;
    }

    /* Right Sidebar with Tabs */
    .right-sidebar {
      position: sticky;
      top: 100px;
      height: fit-content;
      font-family: 'Inter', sans-serif;
    }

    .info-tabs {
      background: white;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 1.5rem;
    }

    .tab-buttons {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-soft);
    }

    .tab-button {
      flex: 1;
      padding: 0.75rem;
      background: none;
      border: none;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text-light);
      transition: all 0.2s;
      border-bottom: 2px solid transparent;
    }

    .tab-button:hover {
      color: var(--nature-blue);
      background: white;
    }

    .tab-button.active {
      color: var(--nature-blue);
      border-bottom-color: var(--nature-blue);
      background: white;
    }

    .tab-panel {
      display: none;
      padding: 1.5rem;
    }

    .tab-panel.active {
      display: block;
    }

    .info-card {
      background: var(--bg-soft);
      border-radius: 8px;
    }

    .info-card h4 {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 1rem;
      font-weight: 600;
    }

    .keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .keyword-tag {
      font-size: 0.7rem;
      background: white;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      color: var(--text-light);
    }

    .metadata-item {
      font-size: 0.85rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
    }

    .metadata-item:last-child {
      border-bottom: none;
    }

    .metadata-label {
      color: var(--text-muted);
      font-weight: 500;
    }

    .metadata-value {
      font-weight: 400;
      text-align: right;
    }

    .citation-box {
      background: white;
      padding: 1rem;
      border-radius: 6px;
      border: 1px solid var(--border-color);
    }

    .citation-item {
      position: relative;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.8rem;
    }

    .citation-item:last-child {
      border-bottom: none;
    }

    .copy-btn {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      background: white;
      border: 1px solid var(--border-color);
      padding: 2px 8px;
      font-size: 0.65rem;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
      color: var(--text-light);
    }

    .copy-btn:hover {
      background: var(--nature-blue);
      border-color: var(--nature-blue);
      color: white;
    }

    .bibtex-download {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 1rem;
      color: var(--nature-blue);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.8rem;
      font-family: 'Inter', sans-serif;
    }

    .pdf-preview {
      width: 100%;
      height: 700px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      margin: 1.5rem 0;
    }

    /* Mobile info section */
    .mobile-info {
      display: none;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 2px solid var(--border-color);
    }

    /* Smooth scrolling for anchor links */
    html {
      scroll-behavior: smooth;
      scroll-padding-top: 100px;
    }

    /* Mobile Optimization */
    @media (max-width: 1100px) {
      .main-wrapper {
        grid-template-columns: 1fr;
        gap: 2rem;
        padding: 1.5rem;
      }
      .toc-sidebar, .right-sidebar {
        display: none;
      }
      .mobile-info {
        display: block;
      }
      h1 {
        font-size: 2rem;
      }
    }

    @media (max-width: 600px) {
      .top-nav {
        padding: 0.75rem 1rem;
      }
      .main-wrapper {
        padding: 1rem;
      }
      h1 {
        font-size: 1.6rem;
      }
      .action-bar {
        gap: 1rem;
      }
      .btn-pdf {
        padding: 0.5rem 1rem;
        font-size: 0.8rem;
      }
    }
  </style>
</head>
<body>
  <nav class="top-nav">
    <a href="/" class="journal-name">Revista Nacional de las Ciencias para Estudiantes</a>
    <div class="issn-badge">ISSN: 3087-2839 (Online)</div>
  </nav>

  <div class="main-wrapper">
    <!-- Left Sidebar - Table of Contents -->
    <nav class="toc-sidebar">
      <div class="toc-title">CONTENIDO</div>
      <ul class="toc-list" id="toc-list"></ul>
    </nav>

    <!-- Main Content -->
    <main class="article-container">
      <article>
        <header class="article-header">
          <div class="article-type">${tipoEs}</div>
          
          <!-- Gestión avanzada de títulos bilingües -->
          <h1 id="main-title">${article.titulo}</h1>
          ${article.tituloEnglish ? `
          <div class="alt-title-container">
            <span class="alt-title" title="Título en inglés / English title">${article.tituloEnglish}</span>
          </div>
          ` : ''}

          <div class="authors">
            ${useTeamData ? authorsDisplay : finalAuthorsDisplay}
          </div>

          <div class="meta-box">
            <span>Vol. ${article.volumen}, Núm. ${article.numero}</span>
            <span>pp. ${article.primeraPagina}-${article.ultimaPagina}</span>
            <span>${formatDateEs(article.fecha)}</span>
          </div>

          <!-- Action Bar with immediate PDF button -->
          <div class="action-bar">
            <a href="${article.pdf}" target="_blank" rel="noopener noreferrer" class="btn-pdf">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
              </svg>
              Abrir PDF
            </a>
            <span class="oa-label">
              ${oaSvg}
              Open Access
            </span>
          </div>
        </header>

        <!-- Abstract Section (bilingüe) -->
        <section id="abstract">
          <h2>Resumen</h2>
          <div class="abstract-container">
            <div class="abstract-text">
              ${resumenParagraphs}
            </div>
            
            ${article.abstract ? `
            <details class="abstract-toggle">
              <summary>Ver abstract en inglés / View English abstract</summary>
              <div class="abstract-toggle-content">
                ${abstractParagraphs}
              </div>
            </details>
            ` : ''}
          </div>
        </section>

        <!-- Full Article Content -->
        <section id="full-text" class="article-content">
          ${article.html_es || '<p>El texto completo estará disponible próximamente.</p>'}
        </section>

        <!-- References Section (usando el campo unificado) -->
        <section id="references">
          <h2>Referencias</h2>
          ${referencesHtml}
        </section>

        <!-- Acknowledgments, Conflicts, and Funding -->
        <section id="additional-info">
  <!-- 1. AGRADECIMIENTOS -->
  ${article.acknowledgments ? `
  <h2>Agradecimientos</h2>
  <p>${article.acknowledgments}</p>
  ` : ''}
  
  <!-- 2. FINANCIAMIENTO (solo si tiene contenido) -->
  ${article.funding && article.funding.trim() !== '' && article.funding !== 'No declarada' ? `
  <h2>Financiamiento</h2>
  <p>${article.funding}</p>
  ` : ''}
  
  <!-- 3. DISPONIBILIDAD DE DATOS (solo si tiene contenido) -->
  ${article.dataAvailability && article.dataAvailability.trim() !== '' ? `
  <h2>Disponibilidad de datos</h2>
  <p>${article.dataAvailability}</p>
  ` : ''}
  
  <!-- 4. CONTRIBUCIÓN DE AUTORES (CRÉDITOS) -->
  ${article.authorCredits && article.authorCredits.trim() !== '' ? `
  <h2>Contribución de autores</h2>
  <p>${article.authorCredits}</p>
  ` : ''}
  
  <!-- 5. CONFLICTO DE INTERESES (siempre visible) -->
  <h2>Conflicto de intereses</h2>
  <p>${article.conflicts || 'Los autores declaran no tener conflictos de interés.'}</p>
</section>

        <!-- PDF Preview Section -->
        ${article.pdf ? `
        <section id="pdf-preview">
          <h2>Visualización del PDF</h2>
          <embed src="${article.pdf}" type="application/pdf" class="pdf-preview" />
          <div style="display: flex; gap: 1rem; margin-top: 1rem;">
            <a href="${article.pdf}" target="_blank" class="btn-pdf">Ver en pantalla completa</a>
            <a href="${article.pdf}" download class="btn-pdf" style="background: var(--text-light);">Descargar PDF</a>
          </div>
        </section>
        ` : ''}
      </article>

      <!-- Mobile Info Section (visible solo en móvil) -->
      <div class="mobile-info">
        <div class="info-tabs">
          <div class="tab-buttons">
            <button class="tab-button active" onclick="switchTab('mobile', 'citations')">Cómo citar</button>
            <button class="tab-button" onclick="switchTab('mobile', 'metadata')">Información</button>
          </div>
          
          <!-- Citations Tab -->
          <div id="mobile-citations" class="tab-panel active">
            <h4>Citar este artículo</h4>
            <div class="citation-box">
              <div class="citation-item">
                <strong>APA</strong>
                <button class="copy-btn" onclick="copyRichText('apa-text-es-mobile', event)">Copiar</button>
                <div id="apa-text-es-mobile, event" style="margin-top: 0.25rem;">${authorsAPA}. (${year}). ${article.titulo}. <em>Revista Nacional de las Ciencias para Estudiantes</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</div>
              </div>
              <div class="citation-item">
                <strong>MLA</strong>
                <button class="copy-btn" onclick="copyRichText('mla-text-es-mobile', event)">Copiar</button>
                <div id="mla-text-es-mobile, event" style="margin-top: 0.25rem;">${authorsMLAEs}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em>, vol. ${article.volumen}, no. ${article.numero}, ${year}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</div>
              </div>
              <div class="citation-item">
                <strong>Chicago</strong>
                <button class="copy-btn" onclick="copyRichText('chi-text-es-mobile', event)">Copiar</button>
                <div id="chi-text-es-mobile, event" style="margin-top: 0.25rem;">${authorsChicagoEs}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em> ${article.volumen}, no. ${article.numero} (${year}): ${article.primeraPagina}-${article.ultimaPagina}.</div>
              </div>
              <a href="data:text/plain;charset=utf-8,${encodeURIComponent(bibtex)}" download="article-${article.numeroArticulo}.bib" class="bibtex-download">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                </svg>
                Descargar BibTeX
              </a>
            </div>
          </div>
          
          <!-- Metadata Tab -->
          <div id="mobile-metadata" class="tab-panel">
            <h4>Palabras clave</h4>
            <div class="keywords" style="margin-bottom: 1.5rem;">
              ${article.palabras_clave.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
            </div>
            
            <h4>Información del artículo</h4>
            <div class="metadata-item">
              <span class="metadata-label">Recibido</span>
              <span class="metadata-value">${formatDateEs(article.receivedDate)}</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Aceptado</span>
              <span class="metadata-value">${formatDateEs(article.acceptedDate)}</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Publicado</span>
              <span class="metadata-value">${formatDateEs(article.fecha)}</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Área</span>
              <span class="metadata-value">${article.area}</span>
            </div>
            ${article.funding && article.funding !== 'No declarada' ? `
            <div class="metadata-item">
              <span class="metadata-label">Financiación</span>
              <span class="metadata-value">${article.funding}</span>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    </main>

    <!-- Right Sidebar with Tabs -->
    <aside class="right-sidebar">
      <div class="info-tabs">
        <div class="tab-buttons">
          <button class="tab-button active" onclick="switchTab('desktop', 'citations')">Cómo citar</button>
          <button class="tab-button" onclick="switchTab('desktop', 'metadata')">Información</button>
        </div>
        
        <!-- Citations Tab -->
        <div id="desktop-citations" class="tab-panel active">
          <h4>Citar este artículo</h4>
          <div class="citation-box">
            <div class="citation-item">
              <strong>APA</strong>
              <button class="copy-btn" onclick="copyRichText('apa-text-es', event)">Copiar</button>
              <div id="apa-text-es, event" style="margin-top: 0.25rem;">${authorsAPA}. (${year}). ${article.titulo}. <em>Revista Nacional de las Ciencias para Estudiantes</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</div>
            </div>
            <div class="citation-item">
              <strong>MLA</strong>
              <button class="copy-btn" onclick="copyRichText('mla-text-es', event)">Copiar</button>
              <div id="mla-text-es, event" style="margin-top: 0.25rem;">${authorsMLAEs}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em>, vol. ${article.volumen}, no. ${article.numero}, ${year}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</div>
            </div>
            <div class="citation-item">
              <strong>Chicago</strong>
              <button class="copy-btn" onclick="copyRichText('chi-text-es', event)">Copiar</button>
              <div id="chi-text-es, event" style="margin-top: 0.25rem;">${authorsChicagoEs}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em> ${article.volumen}, no. ${article.numero} (${year}): ${article.primeraPagina}-${article.ultimaPagina}.</div>
            </div>
            <a href="data:text/plain;charset=utf-8,${encodeURIComponent(bibtex)}" download="article-${article.numeroArticulo}.bib" class="bibtex-download">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
              </svg>
              Descargar BibTeX
            </a>
          </div>
        </div>
        
        <!-- Metadata Tab -->
        <div id="desktop-metadata" class="tab-panel">
          <h4>Palabras clave</h4>
          <div class="keywords" style="margin-bottom: 1.5rem;">
            ${article.palabras_clave.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
          </div>
          
          <h4>Información del artículo</h4>
          <div class="metadata-item">
            <span class="metadata-label">Recibido</span>
            <span class="metadata-value">${formatDateEs(article.receivedDate)}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Aceptado</span>
            <span class="metadata-value">${formatDateEs(article.acceptedDate)}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Publicado</span>
            <span class="metadata-value">${formatDateEs(article.fecha)}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Área</span>
            <span class="metadata-value">${article.area}</span>
          </div>
          ${article.funding && article.funding !== 'No declarada' ? `
          <div class="metadata-item">
            <span class="metadata-label">Financiación</span>
            <span class="metadata-value">${article.funding}</span>
          </div>
          ` : ''}
        </div>
      </div>
    </aside>
  </div>

  <footer style="text-align: center; padding: 3rem 2rem; border-top: 1px solid var(--border-color); font-family: 'Inter', sans-serif; font-size: 0.8rem; color: var(--text-light);">
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes. ISSN 3087-2839</p>
    <p style="margin-top: 0.5rem;">
      <a href="/es/article" style="color: var(--nature-blue); text-decoration: none;">Volver al catálogo</a> 
      <span style="margin: 0 0.5rem;">|</span> 
      <a href="/" style="color: var(--nature-blue); text-decoration: none;">Volver al inicio</a>
      <span style="margin: 0 0.5rem;">|</span> 
      <a href="/articles/article-${articleSlug}EN.html" style="color: var(--nature-blue); text-decoration: none;">View in English</a>
    </p>
  </footer>

  <script>
    // Tab switching function
    function switchTab(device, tabName) {
      // Desktop tabs
      if (device === 'desktop') {
        // Hide all desktop panels
        document.querySelectorAll('#desktop-citations, #desktop-metadata').forEach(panel => {
          panel.classList.remove('active');
        });
        // Remove active class from all desktop buttons
        document.querySelectorAll('.right-sidebar .tab-button').forEach(btn => {
          btn.classList.remove('active');
        });
        // Show selected panel
        document.getElementById('desktop-' + tabName).classList.add('active');
        // Add active class to clicked button
        event.target.classList.add('active');
      } else {
        // Mobile tabs
        // Hide all mobile panels
        document.querySelectorAll('#mobile-citations, #mobile-metadata').forEach(panel => {
          panel.classList.remove('active');
        });
        // Remove active class from all mobile buttons
        document.querySelectorAll('.mobile-info .tab-button').forEach(btn => {
          btn.classList.remove('active');
        });
        // Show selected panel
        document.getElementById('mobile-' + tabName).classList.add('active');
        // Add active class to clicked button
        event.target.classList.add('active');
      }
    }

    // Generate table of contents from h2 headings
    document.addEventListener('DOMContentLoaded', () => {
      const tocList = document.getElementById('toc-list');
      const headings = document.querySelectorAll('.article-container h2');
      
      headings.forEach((heading, index) => {
        if (heading.id === 'citations' || heading.closest('.citation-box')) return;
        
        const id = heading.id || 'section-' + index;
        heading.id = id;
        
        const li = document.createElement('li');
        li.className = 'toc-item';
        const link = document.createElement('a');
        link.href = '#' + id;
        link.textContent = heading.textContent;
        link.addEventListener('click', (e) => {
          e.preventDefault();
          document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
        });
        li.appendChild(link);
        tocList.appendChild(li);
      });

      // Smooth scroll for all internal links
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
          const href = this.getAttribute('href');
          if (href === '#') return;
          
          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });

      // Handle citation links
      document.querySelectorAll('.citation-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const href = link.getAttribute('href');
          if (href && href.startsWith('#')) {
            const target = document.querySelector(href);
            if (target) {
              target.scrollIntoView({ behavior: 'smooth' });
            }
          }
        });
      });

      // Active section highlighting
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            document.querySelectorAll('.toc-item a').forEach(link => {
              link.classList.remove('active');
              if (link.getAttribute('href') === '#' + entry.target.id) {
                link.classList.add('active');
              }
            });
          }
        });
      }, { threshold: 0.3, rootMargin: '-80px 0px -80px 0px' });

      document.querySelectorAll('.article-container h2').forEach(h => observer.observe(h));
    });

    // Copy text function
    function copyRichText(id, event) {
  const element = document.getElementById(id);
  if (!element) return;
  
  // Obtener el texto con formato HTML
  const htmlContent = element.innerHTML;
  // Obtener el texto plano (sin formato)
  const plainText = element.innerText || element.textContent;
  
  // Crear un objeto con ambos formatos
  const clipboardItem = new ClipboardItem({
    'text/plain': new Blob([plainText], { type: 'text/plain' }),
    'text/html': new Blob([htmlContent], { type: 'text/html' })
  });
  
  // Copiar al portapapeles
  navigator.clipboard.write([clipboardItem]).then(() => {
    // Feedback visual
    const btn = event.target;
    const originalText = btn.innerText;
    const originalBg = btn.style.background;
    const originalColor = btn.style.color;
    
    btn.innerText = '✓ Copiado con formato';
    btn.style.background = '#22c55e';
    btn.style.color = 'white';
    btn.style.borderColor = '#22c55e';
    
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.background = originalBg;
      btn.style.color = originalColor;
      btn.style.borderColor = '';
    }, 2000);
  }).catch(err => {
    console.error('Error copying rich text: ', err);
    // Fallback: intentar copiar solo texto plano
    fallbackCopy(plainText, event.target);
  });
}
  function fallbackCopy(text, btn) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
    btn.innerText = '✓ Copiado (texto)';
    btn.style.background = '#22c55e';
    btn.style.color = 'white';
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.background = 'white';
      btn.style.color = '';
    }, 2000);
  } catch (err) {
    console.error('Fallback copy failed:', err);
    alert('No se pudo copiar. Por favor, selecciona el texto manualmente.');
  }
  
  document.body.removeChild(textarea);
}

    // Ensure MathJax processes any math content
    if (window.MathJax) {
      MathJax.typesetPromise();
    }
  </script>
</body>
</html>
`.trim();

      const filePathEs = path.join(outputHtmlDir, `article-${articleSlug}.html`);
      fs.writeFileSync(filePathEs, htmlContentEs, 'utf8');
      console.log(`Generado HTML de artículo en español: ${filePathEs}`);

      // HTML en inglés simétrico
      const htmlContentEn = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="citation_title" content="${article.tituloEnglish || article.titulo}">
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
  <meta name="citation_abstract" content="${article.abstract.replace(/"/g, '&quot;')}">
  <meta name="citation_keywords" content="${article.keywords_english.join('; ')}">
  <meta name="citation_language" content="en">
  <meta name="description" content="${article.abstract.substring(0, 160)}...">
  <meta name="keywords" content="${article.keywords_english.join(', ')}">
  <title>${article.tituloEnglish || article.titulo} - Revista Nacional de las Ciencias para Estudiantes</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,700&family=JetBrains+Mono&family=Lora:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=es6"></script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  <style>
    :root {
      --nature-blue: #005a7d;
      --nature-blue-dark: #003e56;
      --nature-black: #111111;
      --text-main: #222222;
      --text-light: #595959;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
      --bg-soft: #f8f9fa;
      --bg-hover: #f3f4f6;
      --accent: #c2410c;
      --sidebar-width: 260px;
      --aside-width: 280px;
      --content-max-width: 800px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Lora', serif;
      line-height: 1.7;
      color: var(--text-main);
      background-color: #fff;
      margin: 0;
      overflow-x: hidden;
    }

    .top-nav {
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 2rem;
      background: #fff;
      position: sticky;
      top: 0;
      z-index: 1000;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'Inter', sans-serif;
    }

    .journal-name {
      font-weight: 700;
      font-size: 1rem;
      color: var(--nature-black);
      text-decoration: none;
      letter-spacing: -0.02em;
    }

    .journal-name:hover {
      color: var(--nature-blue);
    }

    .issn-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      background: var(--bg-soft);
      padding: 4px 12px;
      border-radius: 20px;
      border: 1px solid var(--border-color);
      color: var(--text-light);
    }

    .main-wrapper {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: var(--sidebar-width) minmax(0, 1fr) var(--aside-width);
      gap: 3rem;
      padding: 2rem;
    }

    .toc-sidebar {
      position: sticky;
      top: 100px;
      height: fit-content;
      font-family: 'Inter', sans-serif;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
      scrollbar-width: thin;
      padding-right: 0.5rem;
    }

    .toc-sidebar::-webkit-scrollbar {
      width: 4px;
    }

    .toc-sidebar::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 4px;
    }

    .toc-title {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }

    .toc-list {
      list-style: none;
      border-left: 1px solid var(--border-color);
    }

    .toc-item {
      margin: 0;
    }

    .toc-item a {
      display: block;
      padding: 0.4rem 1rem;
      color: var(--text-light);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 400;
      transition: all 0.2s ease;
      border-left: 2px solid transparent;
      margin-left: -1px;
    }

    .toc-item a:hover {
      color: var(--nature-blue);
      border-left-color: var(--nature-blue);
      background: var(--bg-hover);
    }

    .toc-item a.active {
      color: var(--nature-blue);
      border-left-color: var(--nature-blue);
      font-weight: 500;
      background: linear-gradient(to right, var(--bg-soft), transparent);
    }

    .article-container {
      max-width: var(--content-max-width);
      width: 100%;
    }

    .article-header {
      margin-bottom: 2.5rem;
    }

    .article-type {
      font-family: 'Inter', sans-serif;
      text-transform: uppercase;
      font-weight: 600;
      font-size: 0.7rem;
      letter-spacing: 0.1em;
      color: var(--accent);
      margin-bottom: 0.75rem;
    }

    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 2.4rem;
      line-height: 1.2;
      margin: 0.5rem 0 1rem 0;
      color: var(--nature-black);
      font-weight: 700;
    }

    .alt-title-container {
      margin-bottom: 1.5rem;
    }

    .alt-title {
      font-size: 1.1rem;
      color: var(--text-light);
      border-bottom: 1px dotted var(--text-light);
      display: inline-block;
      cursor: help;
      font-style: italic;
      transition: border-color 0.2s;
    }

    .alt-title:hover {
      border-bottom-color: var(--nature-blue);
      color: var(--nature-blue);
    }

    .authors {
      font-family: 'Inter', sans-serif;
      font-size: 1.1rem;
      font-weight: 500;
      margin-bottom: 1rem;
      line-height: 1.5;
    }

    .authors a {
      color: var(--nature-blue);
      text-decoration: none;
      border-bottom: 1px dotted transparent;
      transition: border-color 0.2s;
    }

    .authors a:hover {
      border-bottom-color: var(--nature-blue);
    }

    .orcid-link {
      display: inline-block;
      vertical-align: middle;
      margin-left: 4px;
      opacity: 0.8;
      transition: opacity 0.2s;
    }

    .orcid-link:hover {
      opacity: 1;
    }

    .meta-box {
      font-size: 0.9rem;
      color: var(--text-light);
      margin-top: 1rem;
      display: flex;
      gap: 1.5rem;
      align-items: center;
      flex-wrap: wrap;
      font-family: 'Inter', sans-serif;
    }

    .action-bar {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      margin: 1.5rem 0 2rem 0;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
    }

    .btn-pdf {
      background: var(--nature-blue);
      color: white !important;
      padding: 0.6rem 1.5rem;
      border-radius: 4px;
      text-decoration: none;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s;
      border: none;
      cursor: pointer;
    }

    .btn-pdf:hover {
      background: var(--nature-blue-dark);
    }

    .oa-label {
      display: inline-flex;
      align-items: center;
      color: #F48120;
      font-weight: 500;
      font-size: 0.9rem;
      font-family: 'Inter', sans-serif;
    }

    h2 {
      font-family: 'Inter', sans-serif;
      font-size: 1.3rem;
      font-weight: 600;
      border-bottom: 2px solid var(--nature-black);
      padding-bottom: 0.4rem;
      margin: 2.5rem 0 1.5rem 0;
      scroll-margin-top: 100px;
    }

    h3 {
      font-family: 'Inter', sans-serif;
      font-size: 1.1rem;
      font-weight: 600;
      margin: 1.8rem 0 1rem 0;
    }

    .abstract-container {
      margin-bottom: 2rem;
    }

    .abstract-text {
      font-size: 1.05rem;
      text-align: justify;
      color: var(--text-main);
      margin-bottom: 1rem;
    }

    .abstract-toggle {
      margin-top: 1rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-soft);
    }

    .abstract-toggle summary {
      font-family: 'Inter', sans-serif;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.75rem 1rem;
      cursor: pointer;
      color: var(--nature-blue);
      list-style: none;
    }

    .abstract-toggle summary::-webkit-details-marker {
      display: none;
    }

    .abstract-toggle summary::before {
      content: '▶';
      display: inline-block;
      width: 16px;
      margin-right: 8px;
      transition: transform 0.2s;
      color: var(--nature-blue);
    }

    .abstract-toggle[open] summary::before {
      transform: rotate(90deg);
    }

    .abstract-toggle-content {
      padding: 1rem;
      border-top: 1px solid var(--border-color);
      background: white;
      border-radius: 0 0 6px 6px;
      font-style: italic;
    }

    .article-content {
      font-size: 1.05rem;
      line-height: 1.7;
    }

    .article-content p {
      margin-bottom: 1.2rem;
    }

    .article-content img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1.5rem 0;
    }

    .citation-link {
      color: var(--nature-blue);
      text-decoration: none;
      border-bottom: 1px dotted var(--nature-blue);
      cursor: pointer;
      transition: all 0.2s;
    }

    .citation-link:hover {
      border-bottom-style: solid;
    }

    /* Estilos para las referencias (formato Chicago) */
    .references-list {
      margin-top: 2rem;
      font-size: 0.95rem;
    }

    .reference-item {
      margin-bottom: 1.2rem;
      padding-left: 2rem;
      text-indent: -2rem;  /* Sangría francesa */
      line-height: 1.6;
      word-wrap: break-word;
      scroll-margin-top: 100px;
    }

    .reference-item em {
      font-style: italic;
    }

    .reference-item a {
      color: #005a7d;
      text-decoration: none;
      word-break: break-all;
      border-bottom: 1px dotted #ccc;
    }

    .reference-item a:hover {
      border-bottom: 1px solid #005a7d;
    }
/* === ESTILOS PARA TABLAS ACADÉMICAS ÉPICAS === */
.table-responsive {
  overflow-x: auto;
  margin: 1.5em 0;
  border-radius: 4px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background-color: #ffffff;
  font-size: 0.95em;
  box-shadow: 0 2px 3px rgba(0,0,0,0.05);
}

/* Borde superior e inferior para el encabezado */
thead tr {
  border-top: 2px solid #2c3e50; /* Azul oscuro/negro para la línea superior */
  border-bottom: 1px solid #7f8c8d; /* Gris para la línea inferior del encabezado */
}

/* Estilo para las celdas del encabezado */
th {
  background-color: #f8f9fa; /* Gris muy suave de fondo */
  color: #1a2634;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 0.9em;
  padding: 14px 10px;
  text-align: center; /* CENTRADO */
  vertical-align: middle;
}

/* Estilo para las celdas del cuerpo */
td {
  padding: 14px 10px;
  text-align: center; /* CENTRADO */
  vertical-align: middle;
  border-bottom: 1px solid #e0e0e0; /* Línea horizontal suave entre filas */
  word-break: break-word; /* ¡Evita desbordes! */
}

/* Eliminar el borde inferior de la última fila para que no quede uno extra */
tbody tr:last-child td {
  border-bottom: none;
}

/* Borde inferior final para la tabla */
tbody {
  border-bottom: 2px solid #2c3e50; /* Mismo color que el borde superior */
}

/* Estilo para las listas dentro de las celdas (que queden alineadas a la izquierda) */
td ol, td ul {
  text-align: left;
  margin: 0;
  padding-left: 1.2em;
}

/* Estilo para la fuente (caption) de la tabla */
caption {
  font-size: 1.1em;
  font-weight: 600;
  color: #1a2634;
  background-color: #f0f3f5;
  padding: 12px 10px;
  caption-side: top; /* La leyenda arriba */
  border: 1px solid #d0d7dd;
  border-bottom: none; /* Para que se fusione con la tabla */
  border-radius: 4px 4px 0 0;
  letter-spacing: 0.02em;
}
    /* Right Sidebar with Tabs */
    .right-sidebar {
      position: sticky;
      top: 100px;
      height: fit-content;
      font-family: 'Inter', sans-serif;
    }

    .info-tabs {
      background: white;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 1.5rem;
    }

    .tab-buttons {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-soft);
    }

    .tab-button {
      flex: 1;
      padding: 0.75rem;
      background: none;
      border: none;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text-light);
      transition: all 0.2s;
      border-bottom: 2px solid transparent;
    }

    .tab-button:hover {
      color: var(--nature-blue);
      background: white;
    }

    .tab-button.active {
      color: var(--nature-blue);
      border-bottom-color: var(--nature-blue);
      background: white;
    }

    .tab-panel {
      display: none;
      padding: 1.5rem;
    }

    .tab-panel.active {
      display: block;
    }

    .info-card {
      background: var(--bg-soft);
      border-radius: 8px;
    }

    .info-card h4 {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 1rem;
      font-weight: 600;
    }

    .keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .keyword-tag {
      font-size: 0.7rem;
      background: white;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      color: var(--text-light);
    }

    .metadata-item {
      font-size: 0.85rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
    }

    .metadata-item:last-child {
      border-bottom: none;
    }

    .metadata-label {
      color: var(--text-muted);
      font-weight: 500;
    }

    .metadata-value {
      font-weight: 400;
      text-align: right;
    }

    .citation-box {
      background: white;
      padding: 1rem;
      border-radius: 6px;
      border: 1px solid var(--border-color);
    }

    .citation-item {
      position: relative;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.8rem;
    }

    .citation-item:last-child {
      border-bottom: none;
    }

    .copy-btn {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      background: white;
      border: 1px solid var(--border-color);
      padding: 2px 8px;
      font-size: 0.65rem;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
      color: var(--text-light);
    }

    .copy-btn:hover {
      background: var(--nature-blue);
      border-color: var(--nature-blue);
      color: white;
    }

    .bibtex-download {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 1rem;
      color: var(--nature-blue);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.8rem;
      font-family: 'Inter', sans-serif;
    }

    .pdf-preview {
      width: 100%;
      height: 700px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      margin: 1.5rem 0;
    }

    /* Mobile info section */
    .mobile-info {
      display: none;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 2px solid var(--border-color);
    }

    html {
      scroll-behavior: smooth;
      scroll-padding-top: 100px;
    }

    @media (max-width: 1100px) {
      .main-wrapper {
        grid-template-columns: 1fr;
        gap: 2rem;
        padding: 1.5rem;
      }
      .toc-sidebar, .right-sidebar {
        display: none;
      }
      .mobile-info {
        display: block;
      }
      h1 {
        font-size: 2rem;
      }
    }

    @media (max-width: 600px) {
      .top-nav {
        padding: 0.75rem 1rem;
      }
      .main-wrapper {
        padding: 1rem;
      }
      h1 {
        font-size: 1.6rem;
      }
      .action-bar {
        gap: 1rem;
      }
      .btn-pdf {
        padding: 0.5rem 1rem;
        font-size: 0.8rem;
      }
    }
  </style>
</head>
<body>
  <nav class="top-nav">
    <a href="/" class="journal-name">Revista Nacional de las Ciencias para Estudiantes</a>
    <div class="issn-badge">ISSN: 3087-2839 (Online)</div>
  </nav>

  <div class="main-wrapper">
    <nav class="toc-sidebar">
      <div class="toc-title">CONTENTS</div>
      <ul class="toc-list" id="toc-list"></ul>
    </nav>

    <main class="article-container">
      <article>
        <header class="article-header">
          <div class="article-type">${typeEn}</div>
          
          <!-- Gestión avanzada de títulos bilingües para inglés -->
          <h1 id="main-title">${article.tituloEnglish || article.titulo}</h1>
          ${article.titulo && article.tituloEnglish ? `
          <div class="alt-title-container">
            <span class="alt-title" title="Título en español / Spanish title">${article.titulo}</span>
          </div>
          ` : ''}

          <div class="authors">
            ${useTeamData ? authorsDisplay : finalAuthorsDisplay}
          </div>

          <div class="meta-box">
            <span>Vol. ${article.volumen}, No. ${article.numero}</span>
            <span>pp. ${article.primeraPagina}-${article.ultimaPagina}</span>
            <span>${formatDateEn(article.fecha)}</span>
          </div>

          <div class="action-bar">
            <a href="${article.pdf}" target="_blank" rel="noopener noreferrer" class="btn-pdf">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
              </svg>
              Open PDF
            </a>
            <span class="oa-label">
              ${oaSvg}
              Open Access
            </span>
          </div>
        </header>

        <section id="abstract">
          <h2>Abstract</h2>
          <div class="abstract-container">
            <div class="abstract-text">
              ${abstractParagraphs}
            </div>
            
            ${article.resumen ? `
            <details class="abstract-toggle">
              <summary>Ver resumen en español / View Spanish abstract</summary>
              <div class="abstract-toggle-content">
                ${resumenParagraphs}
              </div>
            </details>
            ` : ''}
          </div>
        </section>

        <section id="full-text" class="article-content">
          ${article.html_en || '<p>The full text will be available soon.</p>'}
        </section>

        <section id="references">
          <h2>References</h2>
          ${referencesHtml}
        </section>

        <!-- Acknowledgments, Conflicts, and Funding (English versions) -->
        <section id="additional-info">
  <!-- 1. ACKNOWLEDGMENTS -->
  ${article.acknowledgmentsEnglish ? `
  <h2>Acknowledgments</h2>
  <p>${article.acknowledgmentsEnglish}</p>
  ` : ''}
  
  <!-- 2. FUNDING (only if has content) -->
  ${article.fundingEnglish && article.fundingEnglish.trim() !== '' && article.fundingEnglish !== 'Not declared' ? `
  <h2>Funding</h2>
  <p>${article.fundingEnglish}</p>
  ` : ''}
  
  <!-- 3. DATA AVAILABILITY (only if has content) -->
  ${article.dataAvailabilityEnglish && article.dataAvailabilityEnglish.trim() !== '' ? `
  <h2>Data availability</h2>
  <p>${article.dataAvailabilityEnglish}</p>
  ` : ''}
  
  <!-- 4. AUTHOR CONTRIBUTIONS (CREDIT) -->
  ${article.authorCreditsEnglish && article.authorCreditsEnglish.trim() !== '' ? `
  <h2>Author contributions</h2>
  <p>${article.authorCreditsEnglish}</p>
  ` : ''}
  
  <!-- 5. CONFLICT OF INTEREST (always visible) -->
  <h2>Conflict of interest</h2>
  <p>${article.conflictsEnglish || 'The authors declare no conflicts of interest.'}</p>
</section>

        ${article.pdf ? `
        <section id="pdf-preview">
          <h2>PDF Preview</h2>
          <embed src="${article.pdf}" type="application/pdf" class="pdf-preview" />
          <div style="display: flex; gap: 1rem; margin-top: 1rem;">
            <a href="${article.pdf}" target="_blank" class="btn-pdf">View Full Screen</a>
            <a href="${article.pdf}" download class="btn-pdf" style="background: var(--text-light);">Download PDF</a>
          </div>
        </section>
        ` : ''}
      </article>

      <!-- Mobile Info Section -->
      <div class="mobile-info">
        <div class="info-tabs">
          <div class="tab-buttons">
            <button class="tab-button active" onclick="switchTab('mobile', 'citations')">How to cite</button>
            <button class="tab-button" onclick="switchTab('mobile', 'metadata')">Information</button>
          </div>
          
          <!-- Citations Tab -->
          <div id="mobile-citations" class="tab-panel active">
            <h4>Cite this article</h4>
            <div class="citation-box">
              <div class="citation-item">
                <strong>APA</strong>
                <button class="copy-btn" onclick="copyRichText('apa-text-en-mobile', event)">Copy</button>
                <div id="apa-text-en-mobile, event" style="margin-top: 0.25rem;">${authorsAPA}. (${year}). ${article.tituloEnglish || article.titulo}. <em>Revista Nacional de las Ciencias para Estudiantes</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</div>
              </div>
              <div class="citation-item">
                <strong>MLA</strong>
                <button class="copy-btn" onclick="copyRichText('mla-text-en-mobile', event)">Copy</button>
                <div id="mla-text-en-mobile, event" style="margin-top: 0.25rem;">${authorsMLAEn}. "${article.tituloEnglish || article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em>, vol. ${article.volumen}, no. ${article.numero}, ${year}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</div>
              </div>
              <div class="citation-item">
                <strong>Chicago</strong>
                <button class="copy-btn" onclick="copyRichText('chi-text-en-mobile', event)">Copy</button>
                <div id="chi-text-en-mobile, event" style="margin-top: 0.25rem;">${authorsChicagoEn}. "${article.tituloEnglish || article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em> ${article.volumen}, no. ${article.numero} (${year}): ${article.primeraPagina}-${article.ultimaPagina}.</div>
              </div>
              <a href="data:text/plain;charset=utf-8,${encodeURIComponent(bibtex)}" download="article-${article.numeroArticulo}.bib" class="bibtex-download">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                </svg>
                Download BibTeX
              </a>
            </div>
          </div>
          
          <!-- Metadata Tab -->
          <div id="mobile-metadata" class="tab-panel">
            <h4>Keywords</h4>
            <div class="keywords" style="margin-bottom: 1.5rem;">
              ${article.keywords_english.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
            </div>
            
            <h4>Article Information</h4>
            <div class="metadata-item">
              <span class="metadata-label">Received</span>
              <span class="metadata-value">${formatDateEn(article.receivedDate)}</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Accepted</span>
              <span class="metadata-value">${formatDateEn(article.acceptedDate)}</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Published</span>
              <span class="metadata-value">${formatDateEn(article.fecha)}</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Area</span>
              <span class="metadata-value">${article.area}</span>
            </div>
            ${article.fundingEnglish && article.fundingEnglish !== 'Not declared' ? `
            <div class="metadata-item">
              <span class="metadata-label">Funding</span>
              <span class="metadata-value">${article.fundingEnglish}</span>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    </main>

    <aside class="right-sidebar">
      <div class="info-tabs">
        <div class="tab-buttons">
          <button class="tab-button active" onclick="switchTab('desktop', 'citations')">How to cite</button>
          <button class="tab-button" onclick="switchTab('desktop', 'metadata')">Information</button>
        </div>
        
        <!-- Citations Tab -->
        <div id="desktop-citations" class="tab-panel active">
          <h4>Cite this article</h4>
          <div class="citation-box">
            <div class="citation-item">
              <strong>APA</strong>
              <button class="copy-btn" onclick="copyRichText('apa-text-en', event)">Copy</button>
              <div id="apa-text-en, event" style="margin-top: 0.25rem;">${authorsAPA}. (${year}). ${article.tituloEnglish || article.titulo}. <em>Revista Nacional de las Ciencias para Estudiantes</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</div>
            </div>
            <div class="citation-item">
              <strong>MLA</strong>
              <button class="copy-btn" onclick="copyRichText('mla-text-en', event)">Copy</button>
              <div id="mla-text-en, event" style="margin-top: 0.25rem;">${authorsMLAEn}. "${article.tituloEnglish || article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em>, vol. ${article.volumen}, no. ${article.numero}, ${year}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</div>
            </div>
            <div class="citation-item">
              <strong>Chicago</strong>
              <button class="copy-btn" onclick="copyRichText('chi-text-en', event)">Copy</button>
              <div id="chi-text-en, event" style="margin-top: 0.25rem;">${authorsChicagoEn}. "${article.tituloEnglish || article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em> ${article.volumen}, no. ${article.numero} (${year}): ${article.primeraPagina}-${article.ultimaPagina}.</div>
            </div>
            <a href="data:text/plain;charset=utf-8,${encodeURIComponent(bibtex)}" download="article-${article.numeroArticulo}.bib" class="bibtex-download">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
              </svg>
              Download BibTeX
            </a>
          </div>
        </div>
        
        <!-- Metadata Tab -->
        <div id="desktop-metadata" class="tab-panel">
          <h4>Keywords</h4>
          <div class="keywords" style="margin-bottom: 1.5rem;">
            ${article.keywords_english.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
          </div>
          
          <h4>Article Information</h4>
          <div class="metadata-item">
            <span class="metadata-label">Received</span>
            <span class="metadata-value">${formatDateEn(article.receivedDate)}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Accepted</span>
            <span class="metadata-value">${formatDateEn(article.acceptedDate)}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Published</span>
            <span class="metadata-value">${formatDateEn(article.fecha)}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Area</span>
            <span class="metadata-value">${article.area}</span>
          </div>
          ${article.fundingEnglish && article.fundingEnglish !== 'Not declared' ? `
          <div class="metadata-item">
            <span class="metadata-label">Funding</span>
            <span class="metadata-value">${article.fundingEnglish}</span>
          </div>
          ` : ''}
        </div>
      </div>
    </aside>
  </div>

  <footer style="text-align: center; padding: 3rem 2rem; border-top: 1px solid var(--border-color); font-family: 'Inter', sans-serif; font-size: 0.8rem; color: var(--text-light);">
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes. ISSN 3087-2839</p>
    <p style="margin-top: 0.5rem;">
      <a href="/en/article" style="color: var(--nature-blue); text-decoration: none;">Back to catalog</a> 
      <span style="margin: 0 0.5rem;">|</span> 
      <a href="/" style="color: var(--nature-blue); text-decoration: none;">Back to home</a>
      <span style="margin: 0 0.5rem;">|</span> 
      <a href="/articles/article-${articleSlug}.html" style="color: var(--nature-blue); text-decoration: none;">Ver en español</a>
    </p>
  </footer>

  <script>
    function switchTab(device, tabName) {
      if (device === 'desktop') {
        document.querySelectorAll('#desktop-citations, #desktop-metadata').forEach(panel => {
          panel.classList.remove('active');
        });
        document.querySelectorAll('.right-sidebar .tab-button').forEach(btn => {
          btn.classList.remove('active');
        });
        document.getElementById('desktop-' + tabName).classList.add('active');
        event.target.classList.add('active');
      } else {
        document.querySelectorAll('#mobile-citations, #mobile-metadata').forEach(panel => {
          panel.classList.remove('active');
        });
        document.querySelectorAll('.mobile-info .tab-button').forEach(btn => {
          btn.classList.remove('active');
        });
        document.getElementById('mobile-' + tabName).classList.add('active');
        event.target.classList.add('active');
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      const tocList = document.getElementById('toc-list');
      const headings = document.querySelectorAll('.article-container h2');
      
      headings.forEach((heading, index) => {
        if (heading.id === 'citations' || heading.closest('.citation-box')) return;
        
        const id = heading.id || 'section-' + index;
        heading.id = id;
        
        const li = document.createElement('li');
        li.className = 'toc-item';
        const link = document.createElement('a');
        link.href = '#' + id;
        link.textContent = heading.textContent;
        link.addEventListener('click', (e) => {
          e.preventDefault();
          document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
        });
        li.appendChild(link);
        tocList.appendChild(li);
      });

      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
          const href = this.getAttribute('href');
          if (href === '#') return;
          
          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });

      document.querySelectorAll('.citation-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const href = link.getAttribute('href');
          if (href && href.startsWith('#')) {
            const target = document.querySelector(href);
            if (target) {
              target.scrollIntoView({ behavior: 'smooth' });
            }
          }
        });
      });

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            document.querySelectorAll('.toc-item a').forEach(link => {
              link.classList.remove('active');
              if (link.getAttribute('href') === '#' + entry.target.id) {
                link.classList.add('active');
              }
            });
          }
        });
      }, { threshold: 0.3, rootMargin: '-80px 0px -80px 0px' });

      document.querySelectorAll('.article-container h2').forEach(h => observer.observe(h));
    });

    function copyRichText(id, event) {
  const element = document.getElementById(id);
  if (!element) return;
  
  // Obtener el texto con formato HTML
  const htmlContent = element.innerHTML;
  // Obtener el texto plano (sin formato)
  const plainText = element.innerText || element.textContent;
  
  // Crear un objeto con ambos formatos
  const clipboardItem = new ClipboardItem({
    'text/plain': new Blob([plainText], { type: 'text/plain' }),
    'text/html': new Blob([htmlContent], { type: 'text/html' })
  });
  
  // Copiar al portapapeles
  navigator.clipboard.write([clipboardItem]).then(() => {
    // Feedback visual
    const btn = event.target;
    const originalText = btn.innerText;
    const originalBg = btn.style.background;
    const originalColor = btn.style.color;
    
    btn.innerText = '✓ Copied!';
    btn.style.background = '#22c55e';
    btn.style.color = 'white';
    btn.style.borderColor = '#22c55e';
    
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.background = originalBg;
      btn.style.color = originalColor;
      btn.style.borderColor = '';
    }, 2000);
  }).catch(err => {
    console.error('Error copying rich text: ', err);
    // Fallback: intentar copiar solo texto plano
    fallbackCopy(plainText, event.target);
  });
}
function fallbackCopy(text, btn) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
    btn.innerText = '✓ Copiado (texto)';
    btn.style.background = '#22c55e';
    btn.style.color = 'white';
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.background = 'white';
      btn.style.color = '';
    }, 2000);
  } catch (err) {
    console.error('Fallback copy failed:', err);
    alert('No se pudo copiar. Por favor, selecciona el texto manualmente.');
  }
  
  document.body.removeChild(textarea);
}
    if (window.MathJax) {
      MathJax.typesetPromise();
    }
  </script>
</body>
</html>
`.trim();

      const filePathEn = path.join(outputHtmlDir, `article-${articleSlug}EN.html`);
      fs.writeFileSync(filePathEn, htmlContentEn, 'utf8');
      console.log(`Generado HTML de artículo en inglés: ${filePathEn}`);
    }

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
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students. ISSN 3087-2839</p>
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
    <p style="font-size: 0.8rem; color: var(--text-light);">ISSN 3087-2839</p>
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
    <p style="font-size: 0.8rem; color: var(--text-light);">ISSN 3087-2839</p>
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
  const newsSnapshot = await db.collection('news').get();
  newsItems = newsSnapshot.docs.map(doc => doc.data()).map(item => ({
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
${teamData.map(member => {
  if (member.roles.includes('Institución Colaboradora')) return '';
  return `
<url>
  <loc>${domain}/team/${member.slug}.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>
<url>
  <loc>${domain}/team/${member.slug}.EN.html</loc>
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
