
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
const DOMAIN = 'https://www.revistacienciasestudiantes.com';
const JOURNAL_NAME_ES = 'Revista Nacional de las Ciencias para Estudiantes';
const JOURNAL_NAME_EN = 'The National Review of Sciences for Students';
const LOGO_ES = 'https://www.revistacienciasestudiantes.com/assets/logo.png';
const LOGO_EN = 'https://www.revistacienciasestudiantes.com/logoEN.png';
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

// FUNCIONES CORREGIDAS PARA MANEJAR EL ARRAY DE AUTORES

function getAuthorNamesArray(authors) {
  if (!authors) return [];
  if (Array.isArray(authors)) {
    return authors.map(a => typeof a === 'string' ? a : (a.name || '')).filter(Boolean);
  }
  if (typeof authors === 'string') {
    return authors.split(';').map(a => a.trim()).filter(Boolean);
  }
  return [];
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

function formatAuthorsAPA(authors) {
  const authorNames = getAuthorNamesArray(authors);
  if (!authorNames.length) return '';
  
  const formatted = authorNames.map(getAPAAuthor);
  if (formatted.length === 1) {
    return formatted[0];
  } else if (formatted.length === 2) {
    return formatted[0] + ', & ' + formatted[1];
  } else {
    return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
  }
}

function formatAuthorsChicagoOrMLA(authors, language = 'es') {
  const authorNames = getAuthorNamesArray(authors);
  if (!authorNames.length) return '';
  
  const formatted = authorNames.map(formatAuthorForCitation);
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

function formatAuthorsDisplay(authors, language = 'es') {
  const authorNames = getAuthorNamesArray(authors);
  if (!authorNames.length) return 'Autor desconocido';
  
  const connector = language === 'es' ? 'y' : 'and';
  if (authorNames.length === 1) {
    return authorNames[0];
  } else if (authorNames.length === 2) {
    return `${authorNames[0]} ${connector} ${authorNames[1]}`;
  } else {
    return authorNames.slice(0, -1).join(', ') + `, ${connector} ` + authorNames[authorNames.length - 1];
  }
}

// Reemplaza la función generateSlug actual con esta versión (IDÉNTICA a la de React)
function generateSlug(name) {
  if (!name) return '';
  
  // 1. Convertir a minúsculas
  let slug = name.toLowerCase();
  
  // 2. Eliminar tildes
  slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // 3. Reemplazar puntos seguidos de letras o espacios por un guión
  slug = slug.replace(/\.(?=[a-z]|\s)/g, '-');
  
  // 4. Reemplazar cualquier otro carácter no deseado por guiones
  slug = slug.replace(/[^a-z0-9]+/g, '-');
  
  // 5. Eliminar guiones múltiples y guiones al principio o final
  slug = slug.replace(/-+/g, '-');
  slug = slug.replace(/^-+|-+$/g, '');
  
  return slug;
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

// Crear directorios necesarios
if (!fs.existsSync(volumesOutputHtmlDir)) fs.mkdirSync(volumesOutputHtmlDir, { recursive: true });
if (!fs.existsSync(newsOutputHtmlDir)) fs.mkdirSync(newsOutputHtmlDir, { recursive: true });
if (!fs.existsSync(teamOutputHtmlDir)) fs.mkdirSync(teamOutputHtmlDir, { recursive: true });
if (!fs.existsSync(sectionsOutputDir)) fs.mkdirSync(sectionsOutputDir, { recursive: true });
if (!fs.existsSync(path.join(__dirname, 'dist', 'images', 'news'))) fs.mkdirSync(path.join(__dirname, 'dist', 'images', 'news'), { recursive: true });

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
    // ==================== EQUIPO ====================
    console.log('📥 Cargando team data...');
    const teamJsonUrl = 'https://www.revistacienciasestudiantes.com/team/Team.json';
    const teamRes = await fetch(teamJsonUrl);
    const teamData = await teamRes.json();
    console.log(`✅ Team data cargado: ${teamData.length} usuarios (incluye anónimos)`);

    const authorToInstitution = {};
    const authorToSlug = {};
    const authorToOrcid = {};
    const authorToEmail = {};
    const anonymousAuthors = {};

    teamData.forEach(user => {
      const name = user.displayName || `${user.firstName} ${user.lastName}`.trim();
      if (name) {
        authorToInstitution[name] = user.institution || '';
        authorToSlug[name] = user.slug;
        authorToOrcid[name] = user.orcid || '';
        authorToEmail[name] = user.publicEmail || '';
        if (user.isAnonymous) {
          anonymousAuthors[name] = true;
          console.log(` 📌 Autor anónimo encontrado: ${name} -> /team/${user.slug}.html`);
        }
      }
    });
    console.log(`📊 Autores anónimos en team: ${Object.keys(anonymousAuthors).length}`);

    // ==================== VOLÚMENES ====================
    console.log('📥 Procesando volúmenes...');
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

    // ==================== ARTÍCULOS ====================
    // CORREGIDO: Usar la URL correcta para articles.json
    console.log('📥 Cargando artículos desde la URL pública...');
    let articles = [];
    try {
      const articlesRes = await fetch('https://www.revistacienciasestudiantes.com/articles.json');
      articles = await articlesRes.json();
      console.log(`📚 Artículos cargados: ${articles.length}`);
      
      // Guardar articles.json en dist para respaldo
      fs.writeFileSync(outputJson, JSON.stringify(articles, null, 2), 'utf8');
      console.log(`✅ Archivo guardado: ${outputJson}`);
    } catch (e) {
      console.log('⚠️ No se pudo cargar articles.json desde la URL pública, usando archivo local si existe...');
      try {
        // Intentar cargar desde archivo local como respaldo
        if (fs.existsSync(outputJson)) {
          articles = JSON.parse(fs.readFileSync(outputJson, 'utf8'));
          console.log(`📚 Artículos cargados desde archivo local: ${articles.length}`);
        }
      } catch (localError) {
        console.log('❌ No se pudo cargar articles.json desde ninguna fuente');
        articles = [];
      }
    }

    // Generar HTMLs de volúmenes
    console.log('📥 Generando páginas de volúmenes...');
    for (const volume of volumes) {
      const volumeSlug = `${volume.volumen}-${volume.numero}`;
      volume.pdfUrl = volume.pdf;
      const year = new Date(volume.fecha).getFullYear();
      
      // Filtrar artículos de este volumen
      const volumeArticles = articles.filter(a => 
        String(a.volumen) === String(volume.volumen) && 
        String(a.numero) === String(volume.numero)
      ).sort((a, b) => parseInt(a.primeraPagina) - parseInt(b.primeraPagina));

      // Busca esta sección en tu código donde generas tocEs y tocEn
const tocEs = volumeArticles.map(a => {
  // IMPORTANTE: El slug debe construirse IGUAL que en ArticleCard
  const articleSlug = a.permalink || `${generateSlug(a.titulo)}-${a.numeroArticulo}`;
  const authorsDisplay = formatAuthorsDisplay(a.autores, 'es');
  return `
    <div class="article-item">
      <a href="/articles/article-${articleSlug}.html" class="article-title">${a.titulo}</a>
      <span class="article-authors">${authorsDisplay} (pp. ${a.primeraPagina}-${a.ultimaPagina})</span>
    </div>
  `;
}).join('');

const tocEn = volumeArticles.map(a => {
  // IGUAL para inglés
  const articleSlug = a.permalink || `${generateSlug(a.titulo)}-${a.numeroArticulo}`;
  const authorsDisplay = formatAuthorsDisplay(a.autores, 'en');
  return `
    <div class="article-item">
      <a href="/articles/article-${articleSlug}EN.html" class="article-title">${a.titulo}</a>
      <span class="article-authors">${authorsDisplay} (pp. ${a.primeraPagina}-${a.ultimaPagina})</span>
    </div>
  `;
}).join('');
      // Generar HTML en español para volumen
      const htmlContentEs = generateVolumeHtml({
        lang: 'es',
        volume,
        volumeSlug,
        toc: tocEs,
        year,
        domain,
        oaSvg
      });

      const filePathEs = path.join(volumesOutputHtmlDir, `volume-${volumeSlug}.html`);
      fs.writeFileSync(filePathEs, htmlContentEs, 'utf8');
      console.log(`✅ Volumen español: volume-${volumeSlug}.html`);

      // Generar HTML en inglés para volumen
      const htmlContentEn = generateVolumeHtml({
        lang: 'en',
        volume,
        volumeSlug,
        toc: tocEn,
        year,
        domain,
        oaSvg
      });

      const filePathEn = path.join(volumesOutputHtmlDir, `volume-${volumeSlug}EN.html`);
      fs.writeFileSync(filePathEn, htmlContentEn, 'utf8');
      console.log(`✅ Volumen inglés: volume-${volumeSlug}EN.html`);
    }

    // Generar índices de volúmenes
    generateVolumeIndexes(volumes);

    // ==================== NOTICIAS ====================
    let newsItems = [];
    await generateNews();

    // ==================== RUTAS SPA ====================
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

    // ==================== SITEMAP Y ROBOTS ====================
    await generateSitemap(articles, volumes, newsItems, teamData, spaRoutes);
    generateRobotsTxt();

    console.log('🎉 ¡Proceso completado con éxito!');

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();

// ==================== FUNCIONES PARA VOLÚMENES ====================
function generateVolumeHtml({ lang, volume, volumeSlug, toc, year, domain, oaSvg }) {
  const isSpanish = lang === 'es';
  
  const title = isSpanish ? volume.titulo : volume.englishTitulo;
  const editorial = isSpanish ? volume.editorial : volume.englishEditorial;
  const fecha = isSpanish ? formatDateEs(volume.fecha) : formatDateEn(volume.fecha);

return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="citation_title" content="${title}">
  <meta name="citation_publication_date" content="${volume.fecha}">
  <meta name="citation_journal_title" content="Revista Nacional de las Ciencias para Estudiantes">
  <meta name="citation_issn" content="3087-2839">
  <meta name="citation_volume" content="${volume.volumen}">
  <meta name="citation_issue" content="${volume.numero}">
  <meta name="citation_pdf_url" content="${volume.pdfUrl}">
  <meta name="citation_abstract_html_url" content="${domain}/volumes/volume-${volumeSlug}${isSpanish ? '' : 'EN'}.html">
  <meta name="citation_language" content="${lang}">
  <meta name="description" content="${editorial ? editorial.replace(/<[^>]*>/g, '').substring(0, 160) + '...' : ''}">
  <title>${title} - ${isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students'}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,700&family=JetBrains+Mono&family=Lora:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono&family=Lora:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
  <style>
    :root {
      --journal-blue: #005587;
      --nature-blue: #005a7d;
      --nature-blue-dark: #003e56;
      --nature-black: #111111;
      --text-dark: #222222;
      --text-light: #555555;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
      --bg-soft: #f8f9fa;
      --bg-hover: #f3f4f6;
      --accent-gold: #a68966;
      --accent: #c2410c;
    }
    * {
      max-width: 100vw;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', sans-serif;
      line-height: 1.7;
      color: var(--text-dark);
      background-color: #fff;
      margin: 0;
      overflow-x: hidden;
    }

    /* ===== HEADER UNIFICADO (EL MISMO EN TODAS LAS PÁGINAS) ===== */
    .sd-header {
      background: #fff;
      border-bottom: 1px solid var(--border-color);
      font-family: 'Inter', sans-serif;
      position: sticky;
      top: 0;
      z-index: 1000;
      width: 100%;
    }

    .sd-header-top {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0.75rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2rem;
    }

    .sd-journal-logo {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--nature-black);
    }

    .sd-logo-img {
      height: 42px;
      width: auto;
      display: block;
      object-fit: contain;
    }

    .sd-journal-titles {
      display: flex;
      flex-direction: column;
      border-left: 1px solid #e0e0e0;
      padding-left: 15px;
    }

    .sd-journal-name {
      font-weight: 600;
      font-size: 0.95rem;
      line-height: 1.2;
    }

    .sd-issn {
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .sd-search-wrapper {
      flex: 1;
      max-width: 500px;
    }

    .sd-search-bar {
      display: flex;
      align-items: center;
      background: #f0f2f4;
      border-radius: 4px;
      padding: 6px 12px;
      border: 1px solid transparent;
      transition: all 0.2s;
    }

    .sd-search-bar:focus-within {
      background: #fff;
      border-color: var(--nature-blue);
      box-shadow: 0 0 0 3px rgba(0, 90, 125, 0.1);
    }

    .sd-search-icon {
      color: var(--text-muted);
      margin-right: 8px;
    }

    .sd-search-bar input {
      border: none;
      background: transparent;
      width: 100%;
      font-family: 'Inter', sans-serif;
      font-size: 0.85rem;
      outline: none;
      color: var(--text-main);
    }

    .sd-user-nav {
      display: flex;
      gap: 1.5rem;
      align-items: center;
    }

    .sd-nav-link {
      text-decoration: none;
      color: var(--text-main);
      font-size: 0.85rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: color 0.2s;
    }

    .sd-nav-link:hover {
      color: var(--nature-blue);
    }

    /* ===== MENÚ HAMBURGUESA PARA MÓVIL ===== */
    .sd-mobile-controls {
      display: none;
      align-items: center;
      gap: 0.5rem;
    }

    .sd-mobile-search-btn {
      display: none;
      background: none;
      border: none;
      padding: 8px;
      cursor: pointer;
      color: var(--text-main);
    }

    .sd-mobile-search-btn svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .sd-mobile-menu-btn {
      display: none;
      background: none;
      border: none;
      padding: 8px;
      cursor: pointer;
      color: var(--text-main);
    }

    .sd-mobile-menu-btn svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }

    .sd-mobile-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .sd-mobile-overlay.active {
      display: block;
      opacity: 1;
    }

    .sd-mobile-menu {
      position: fixed;
      top: 0;
      right: -100%;
      width: 85%;
      max-width: 350px;
      height: 100vh;
      background: white;
      z-index: 1000;
      overflow-y: auto;
      transition: right 0.3s ease;
      box-shadow: -2px 0 10px rgba(0,0,0,0.1);
      font-family: 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
    }

    .sd-mobile-menu.active {
      right: 0;
    }

    .sd-mobile-menu-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .sd-mobile-menu-title {
      font-weight: 600;
      color: var(--nature-blue);
      font-size: 0.9rem;
    }

    .sd-mobile-close-btn {
      background: none;
      border: none;
      padding: 8px;
      cursor: pointer;
      color: var(--text-main);
    }

    .sd-mobile-search {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .sd-mobile-search-bar {
      display: flex;
      align-items: center;
      background: #f0f2f4;
      border-radius: 4px;
      padding: 8px 12px;
      border: 1px solid transparent;
    }

    .sd-mobile-search-bar:focus-within {
      border-color: var(--nature-blue);
      background: #fff;
    }

    .sd-mobile-search-bar input {
      border: none;
      background: transparent;
      width: 100%;
      font-family: 'Inter', sans-serif;
      font-size: 0.9rem;
      outline: none;
      margin-left: 8px;
    }

    .sd-mobile-nav {
      flex: 1;
      padding: 1rem 0;
    }

    .sd-mobile-nav-section {
      margin-bottom: 1.5rem;
    }

    .sd-mobile-nav-section-title {
      padding: 0.5rem 1rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      background: var(--bg-soft);
    }

    .sd-mobile-nav-items {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .sd-mobile-nav-item {
      border-bottom: 1px solid var(--border-color);
    }

    .sd-mobile-nav-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 1rem;
      text-decoration: none;
      color: var(--text-main);
      font-size: 0.95rem;
      transition: background 0.2s;
    }

    .sd-mobile-nav-link:hover {
      background: var(--bg-hover);
    }

    .sd-mobile-nav-link svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
      color: var(--text-muted);
    }

    .sd-mobile-menu-footer {
      padding: 1rem;
      border-top: 1px solid var(--border-color);
      font-size: 0.8rem;
      color: var(--text-muted);
      text-align: center;
    }

    /* ===== HERO SECTION - IMAGEN A BORDE COMPLETO ===== */
    .hero-section {
      width: 100vw;
      margin-left: calc(-50vw + 50%);
      margin-right: calc(-50vw + 50%);
      padding: 6rem 2rem;
      background-image: url('https://images.unsplash.com/photo-1614850523011-8f49ffc73908');
      background-size: cover;
      background-position: center;
      color: white;
      position: relative;
    }

    .hero-section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(to right, rgba(0,0,0,0.7), rgba(0,0,0,0.3));
      z-index: 1;
    }

    .hero-content {
      max-width: 1200px;
      margin: 0 auto;
      position: relative;
      z-index: 2;
    }

    .hero-section h1 {
      font-family: 'Libre Baskerville', serif;
      font-size: 3.2rem;
      line-height: 1.2;
      margin-bottom: 1.5rem;
      color: white;
      max-width: 900px;
    }

    .hero-details {
      font-size: 0.95rem;
      color: #eeeeee;
      border-top: 1px solid rgba(255,255,255,0.3);
      border-bottom: 1px solid rgba(255,255,255,0.3);
      padding: 1rem 0;
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
    }

    /* ===== MAIN CONTENT ===== */
    .main-grid {
      max-width: 1200px;
      margin: 0 auto 5rem;
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 4rem;
      padding: 0 2rem;
    }

    section { 
      margin-bottom: 4rem; 
    }

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

    /* ===== NOTA EDITORIAL CON PÁRRAFOS ===== */
    .editorial-content {
      font-family: 'Lora', serif;
      font-size: 1.15rem;
      color: #333;
      padding-right: 2rem;
      border-left: 2px solid var(--accent-gold);
      padding-left: 2rem;
    }

    .editorial-content p {
      margin-bottom: 1.5rem;
      line-height: 1.8;
    }

    .editorial-content p:last-child {
      margin-bottom: 0;
    }

    .editorial-content em {
      font-style: italic;
    }

    .editorial-content strong {
      font-weight: 700;
    }

    .article-item {
      padding: 1.5rem 0;
      border-bottom: 1px solid var(--border-color);
    }

    .article-item:last-child { 
      border: none; 
    }

    .article-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--journal-blue);
      display: block;
      margin-bottom: 0.5rem;
      text-decoration: none;
    }

    .article-title:hover { 
      text-decoration: underline; 
    }

    .article-authors {
      font-size: 0.9rem;
      color: var(--text-light);
      font-style: italic;
    }

    .sidebar {
      position: sticky;
      top: 100px;
      height: fit-content;
    }

    .card {
      background: var(--bg-soft);
      border: 1px solid var(--border-color);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border-radius: 8px;
    }

    .card-title {
      font-weight: 700;
      font-size: 0.75rem;
      text-transform: uppercase;
      margin-bottom: 1rem;
      display: block;
      color: var(--text-muted);
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
      border-radius: 4px;
    }

    .btn-primary:hover { 
      background: #003d60; 
    }

    .btn-outline {
      border: 1px solid var(--border-color);
      color: var(--text-dark);
      text-align: center;
      display: block;
      padding: 0.8rem;
      text-decoration: none;
      font-size: 0.9rem;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .btn-outline:hover {
      background: var(--bg-soft);
      border-color: var(--journal-blue);
    }

    .pdf-container {
      background: #eee;
      border: 1px solid var(--border-color);
      padding: 10px;
      border-radius: 4px;
    }

    .action-buttons {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
      justify-content: flex-start;
    }

    footer {
      background: #f8f8f8;
      border-top: 1px solid var(--border-color);
      padding: 4rem 2rem;
      text-align: center;
      font-family: 'Libre Baskerville', serif;
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .sd-header-top {
        padding: 0.6rem 1.5rem;
      }
      
      .sd-logo-img {
        height: 36px;
      }
      
      .sd-search-wrapper,
      .sd-user-nav {
        display: none;
      }
      
      .sd-mobile-controls {
        display: flex;
      }
      
      .sd-mobile-search-btn,
      .sd-mobile-menu-btn {
        display: block;
      }

      .main-grid { 
        grid-template-columns: 1fr; 
      }
      
      .sidebar { 
        display: none; 
      }
      
      .hero-section h1 { 
        font-size: 2.4rem; 
      }
      
      .hero-section {
        padding: 4rem 1.5rem;
      }
    }

    @media (max-width: 600px) {
      .sd-header-top {
        padding: 0.4rem 1rem;
      }
      
      .sd-logo-img {
        display: none;
      }
      
      .sd-journal-titles {
        border-left: none;
        padding-left: 0;
      }
      
      .sd-journal-name {
        font-size: 0.75rem;
        font-weight: 600;
        max-width: 180px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .sd-issn {
        font-size: 0.6rem;
      }
      
      .sd-mobile-controls {
        gap: 0.25rem;
      }

      .hero-section h1 { 
        font-size: 1.8rem; 
      }

      .hero-section {
        padding: 3rem 1rem;
      }

      .hero-details {
        flex-direction: column;
        gap: 0.5rem;
      }

      .main-grid {
        padding: 0 1rem;
      }

      .editorial-content {
        padding-left: 1rem;
        font-size: 1rem;
      }

      .article-title {
        font-size: 1.1rem;
      }
    }

    @media (max-width: 400px) {
      .sd-header-top {
        padding: 0.3rem 0.75rem;
      }
      
      .sd-journal-name {
        font-size: 0.7rem;
        max-width: 140px;
      }
      
      .sd-issn {
        display: none;
      }
    }
  </style>
</head>
<body>
  <!-- HEADER UNIFICADO -->
  <header class="sd-header">
    <div class="sd-header-top">
      <div class="sd-brand-container">
        <a href="/" class="sd-journal-logo">
          <img src="${isSpanish ? LOGO_ES : LOGO_EN}" alt="Logo" class="sd-logo-img">
          <div class="sd-journal-titles">
            <span class="sd-journal-name">${isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students'}</span>
            <span class="sd-issn">ISSN: 3087-2839</span>
          </div>
        </a>
      </div>
      
      <div class="sd-search-wrapper">
        <form id="search-form" class="sd-search-bar" onsubmit="handleSearch(event)">
          <svg class="sd-search-icon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input type="text" id="search-input" placeholder="${isSpanish ? 'Buscar artículos, autores...' : 'Search articles, authors...'}" aria-label="Buscar">
        </form>
      </div>
      
      <div class="sd-user-nav">
        <a href="${isSpanish ? '/submit' : '/en/submit'}" class="sd-nav-link">${isSpanish ? 'Envíos' : 'Submissions'}</a>
        <a href="${isSpanish ? '/faq' : '/en/faq'}" class="sd-nav-link">${isSpanish ? 'Ayuda' : 'Help'}</a>
        <a href="${isSpanish ? '/login' : '/en/login'}" class="sd-nav-link">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
          ${isSpanish ? 'Mi cuenta' : 'My account'}
        </a>
      </div>
      
      <div class="sd-mobile-controls">
        <button class="sd-mobile-search-btn" onclick="toggleMobileSearch()" aria-label="Buscar">
          <svg viewBox="0 0 24 24">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>
        <button class="sd-mobile-menu-btn" onclick="toggleMobileMenu()" aria-label="Menú">
          <svg viewBox="0 0 24 24">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>
      </div>
    </div>
  </header>

  <!-- Overlay y menú móvil -->
  <div class="sd-mobile-overlay" id="mobileOverlay" onclick="closeMobileMenu()"></div>
  
  <div class="sd-mobile-menu" id="mobileMenu">
    <div class="sd-mobile-menu-header">
      <span class="sd-mobile-menu-title">${isSpanish ? 'MENÚ' : 'MENU'}</span>
      <button class="sd-mobile-close-btn" onclick="closeMobileMenu()">
        <svg viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
    
    <div class="sd-mobile-search">
      <form id="mobile-search-form" class="sd-mobile-search-bar" onsubmit="handleMobileSearch(event)">
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input type="text" id="mobile-search-input" placeholder="${isSpanish ? 'Buscar artículos, autores...' : 'Search articles, authors...'}" aria-label="Buscar">
      </form>
    </div>
    
    <div class="sd-mobile-nav">
      <div class="sd-mobile-nav-section">
        <div class="sd-mobile-nav-section-title">${isSpanish ? 'NAVEGACIÓN' : 'NAVIGATION'}</div>
        <ul class="sd-mobile-nav-items">
          <li class="sd-mobile-nav-item">
            <a href="#editorial" class="sd-mobile-nav-link" onclick="closeMobileMenu()">
              <svg viewBox="0 0 24 24">
                <path d="M4 6H20v2H4zM4 12H20v2H4zM4 18H20v2H4z"/>
              </svg>
              ${isSpanish ? 'Nota Editorial' : 'Editorial Note'}
            </a>
          </li>
          <li class="sd-mobile-nav-item">
            <a href="#toc" class="sd-mobile-nav-link" onclick="closeMobileMenu()">
              <svg viewBox="0 0 24 24">
                <path d="M4 6H20v2H4zM4 12H20v2H4zM4 18H20v2H4z"/>
              </svg>
              ${isSpanish ? 'Contenido' : 'Contents'}
            </a>
          </li>
          <li class="sd-mobile-nav-item">
            <a href="#preview" class="sd-mobile-nav-link" onclick="closeMobileMenu()">
              <svg viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2z"/>
              </svg>
              ${isSpanish ? 'Vista Previa' : 'Preview'}
            </a>
          </li>
        </ul>
      </div>
      
      <div class="sd-mobile-nav-section">
        <div class="sd-mobile-nav-section-title">${isSpanish ? 'MI CUENTA' : 'MY ACCOUNT'}</div>
        <ul class="sd-mobile-nav-items">
          <li class="sd-mobile-nav-item">
            <a href="${isSpanish ? '/submit' : '/en/submit'}" class="sd-mobile-nav-link">
              <svg viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              ${isSpanish ? 'Envíos' : 'Submissions'}
            </a>
          </li>
          <li class="sd-mobile-nav-item">
            <a href="${isSpanish ? '/faq' : '/en/faq'}" class="sd-mobile-nav-link">
              <svg viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2-7h-2v-2h2v2zm-4 0h-2v-2h2v2zm0-4h-2V6h2v2z"/>
              </svg>
              ${isSpanish ? 'Ayuda' : 'Help'}
            </a>
          </li>
        </ul>
      </div>
    </div>
    
    <div class="sd-mobile-menu-footer">
      <div>ISSN: 3087-2839</div>
      <div style="margin-top: 0.5rem; font-size: 0.7rem;">
        &copy; ${new Date().getFullYear()} ${isSpanish ? 'RNCE' : 'TNRSFS'}
      </div>
    </div>
  </div>

  <!-- HERO SECTION - IMAGEN A BORDE COMPLETO -->
  <div class="hero-section">
    <div class="hero-content">
      <h1>${title}</h1>
      <div class="hero-details">
        <span><strong>${isSpanish ? 'Publicado:' : 'Published:'}</strong> ${fecha}</span>
        <span><strong>ISSN:</strong> 3087-2839</span>
        <span><strong>${isSpanish ? 'Volumen:' : 'Volume:'}</strong> ${volume.volumen} • ${isSpanish ? 'Número:' : 'Issue:'} ${volume.numero}</span>
        <span><strong>${isSpanish ? 'Idioma:' : 'Language:'}</strong> ${isSpanish ? 'Español/Inglés' : 'Spanish/English'}</span>
      </div>
    </div>
  </div>

  <!-- CONTENIDO PRINCIPAL -->
  <div class="main-grid">
    <main>
      ${editorial ? `
        <section id="editorial">
          <h2>${isSpanish ? 'Nota Editorial' : 'Editorial Note'}</h2>
          <div class="editorial-content">
            ${editorial.split('\\n\\n').map(p => `<p>${p}</p>`).join('')}
          </div>
        </section>
      ` : ''}
      
      <section id="toc">
        <h2>${isSpanish ? 'Contenido del Volumen' : 'Table of Contents'}</h2>
        <div class="toc-wrapper">
          ${toc || `<p style="color: var(--text-light);">${isSpanish ? 'No hay artículos disponibles.' : 'No articles available.'}</p>`}
        </div>
      </section>
      
      <section id="preview">
        <h2>${isSpanish ? 'Visualización Completa' : 'Full Preview'}</h2>
        <div class="pdf-container">
          <embed src="${volume.pdfUrl}" type="application/pdf" width="100%" height="800px" />
        </div>
        <div class="action-buttons">
          <a href="${volume.pdfUrl}" target="_blank" class="btn-outline">${isSpanish ? 'Ver en pantalla completa' : 'View Full Screen'}</a>
          <a href="${volume.pdfUrl}" download class="btn-primary">${isSpanish ? 'Descargar volumen (PDF)' : 'Download Volume (PDF)'}</a>
        </div>
      </section>
      
      <section id="license">
        <div style="display: flex; gap: 1.5rem; align-items: center; border-top: 1px solid var(--border-color); padding-top: 2rem; flex-wrap: wrap;">
          <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by.png" width="88" alt="CC BY">
          <p style="font-size: 0.85rem; color: var(--text-light); margin: 0;">
            ${isSpanish 
              ? 'Este trabajo está bajo una licencia <a href="https://creativecommons.org/licenses/by/4.0/" style="color: var(--journal-blue);">Creative Commons Atribución 4.0 Internacional</a>.'
              : 'This work is licensed under a <a href="https://creativecommons.org/licenses/by/4.0/" style="color: var(--journal-blue);">Creative Commons Attribution 4.0 International</a> License.'}
          </p>
        </div>
      </section>
    </main>
    
    <aside class="sidebar">
      <div class="card">
        <span class="card-title">${isSpanish ? 'Acceso Rápido' : 'Quick Access'}</span>
        <a href="${volume.pdfUrl}" download class="btn-primary">${isSpanish ? 'Descargar PDF Completo' : 'Download Full PDF'}</a>
        <a href="#toc" class="btn-outline">${isSpanish ? 'Explorar Artículos' : 'Explore Articles'}</a>
      </div>
      
      <div class="card">
        <span class="card-title">${isSpanish ? 'Navegación' : 'Navigation'}</span>
        <nav style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem;">
          <a href="${isSpanish ? '/es/volume' : '/en/volume'}" style="color: var(--journal-blue); text-decoration: none;">← ${isSpanish ? 'Volver al Archivo' : 'Back to Archive'}</a>
          ${editorial ? `<a href="#editorial" style="color: var(--text-dark); text-decoration: none;">${isSpanish ? 'Nota Editorial' : 'Editorial Note'}</a>` : ''}
          <a href="#preview" style="color: var(--text-dark); text-decoration: none;">${isSpanish ? 'Vista Previa' : 'Preview'}</a>
        </nav>
      </div>
    </aside>
  </div>

  <footer>
    <p style="font-family: 'Playfair Display', serif; margin-bottom: 1rem;">${isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students'}</p>
    <p style="font-size: 0.8rem; color: var(--text-light);">ISSN 3087-2839</p>
    <p style="font-size: 0.8rem; color: var(--text-light);">© ${new Date().getFullYear()} — ${isSpanish ? 'Una revista por y para estudiantes' : 'A journal by and for students'}</p>
  </footer>

  <script>
    // Funciones del header unificado
    function toggleMobileMenu() {
      const menu = document.getElementById('mobileMenu');
      const overlay = document.getElementById('mobileOverlay');
      
      menu.classList.toggle('active');
      overlay.classList.toggle('active');
      
      if (menu.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }

    function closeMobileMenu() {
      const menu = document.getElementById('mobileMenu');
      const overlay = document.getElementById('mobileOverlay');
      
      menu.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    function toggleMobileSearch() {
      const menu = document.getElementById('mobileMenu');
      const overlay = document.getElementById('mobileOverlay');
      
      menu.classList.add('active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      
      setTimeout(() => {
        const mobileSearchInput = document.getElementById('mobile-search-input');
        if (mobileSearchInput) {
          mobileSearchInput.focus();
        }
      }, 300);
    }

    function handleSearch(e) {
      e.preventDefault();
      const query = document.getElementById('search-input').value.trim();
      if (query) {
        const encodedQuery = encodeURIComponent(query).replace(/%20/g, '+');
        window.location.href = '/article?article_search=' + encodedQuery;
      }
    }

    function handleMobileSearch(e) {
      e.preventDefault();
      const query = document.getElementById('mobile-search-input').value.trim();
      if (query) {
        const encodedQuery = encodeURIComponent(query).replace(/%20/g, '+');
        window.location.href = '/article?article_search=' + encodedQuery;
      }
    }

    // Smooth scroll para enlaces internos
    document.addEventListener('DOMContentLoaded', () => {
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
    });

    // Cerrar menú con tecla Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMobileMenu();
      }
    });
  </script>
</body>
</html>`;
}

function generateVolumeIndexes(volumes) {
  const volumesByYear = volumes.reduce((acc, volume) => {
    const year = new Date(volume.fecha).getFullYear() || 'Sin fecha';
    if (!acc[year]) acc[year] = [];
    acc[year].push(volume);
    return acc;
  }, {});

  // Índice español
  const indexContent = `<!DOCTYPE html>
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
      font-size: 1.1rem;
      font-weight: 600;
      transition: color 0.2s;
    }
    a:hover {
      color: #005a77;
      text-decoration: underline;
    }
    .volume-meta {
      display: block;
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-top: 0.3rem;
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
    }
  </style>
</head>
<body>
  <nav class="nav-header">
    <a href="/" class="nav-logo">Revista Nacional de las Ciencias para Estudiantes</a>
  </nav>
  <div class="content-grid">
    <main class="main-content">
      <h1>Índice de Volúmenes</h1>
      <p>Accede a los volúmenes por año de publicación. Cada enlace lleva a la página del volumen con su contenido completo.</p>
${Object.keys(volumesByYear).sort().reverse().map(year => `
      <section>
        <h2>Año ${year}</h2>
        <ul>
          ${volumesByYear[year].map(volume => {
            const volumeSlug = `${volume.volumen}-${volume.numero}`;
            return `
            <li>
              <a href="/volumes/volume-${volumeSlug}.html">${volume.titulo}</a>
              <span class="volume-meta">Vol. ${volume.volumen}, Núm. ${volume.numero} • ${formatDateEs(volume.fecha)}</span>
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
</html>`;

  const volumesIndexPath = path.join(volumesOutputHtmlDir, 'index.html');
  fs.writeFileSync(volumesIndexPath, indexContent, 'utf8');
  console.log(`✅ Índice volúmenes español: ${volumesIndexPath}`);

  // Índice inglés
  const indexContentEn = `<!DOCTYPE html>
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
      font-size: 1.1rem;
      font-weight: 600;
      transition: color 0.2s;
    }
    a:hover {
      color: #005a77;
      text-decoration: underline;
    }
    .volume-meta {
      display: block;
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-top: 0.3rem;
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
    }
  </style>
</head>
<body>
  <nav class="nav-header">
    <a href="/" class="nav-logo">The National Review of Sciences for Students</a>
  </nav>
  <div class="content-grid">
    <main class="main-content">
      <h1>Index of Volumes</h1>
      <p>Access volumes by year of publication. Each link leads to the volume page with its complete content.</p>
${Object.keys(volumesByYear).sort().reverse().map(year => `
      <section>
        <h2>Year ${year}</h2>
        <ul>
          ${volumesByYear[year].map(volume => {
            const volumeSlug = `${volume.volumen}-${volume.numero}`;
            return `
            <li>
              <a href="/volumes/volume-${volumeSlug}EN.html">${volume.englishTitulo}</a>
              <span class="volume-meta">Vol. ${volume.volumen}, No. ${volume.numero} • ${formatDateEn(volume.fecha)}</span>
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
</html>`;

  const volumesIndexPathEn = path.join(volumesOutputHtmlDir, 'index.EN.html');
  fs.writeFileSync(volumesIndexPathEn, indexContentEn, 'utf8');
  console.log(`✅ Índice volúmenes inglés: ${volumesIndexPathEn}`);
}

// ==================== FUNCIONES PARA NOTICIAS ====================
async function generateNews() {
  console.log('📥 Procesando noticias...');
  const newsSnapshot = await db.collection('news').get();
  const newsItems = newsSnapshot.docs.map(doc => doc.data()).map(item => ({
    titulo: item.title_es || '',
    cuerpo: item.body_es || '',
    fecha: parseDateFlexible(item.timestamp_es),
    title: item.title_en || '',
    content: item.body_en || '',
    photo: item.photo || ''
  }));
  
  for (const newsItem of newsItems) {
    const slug = generateSlug(`${newsItem.titulo} ${newsItem.fecha}`);
    const cuerpoDecoded = base64DecodeUnicode(newsItem.cuerpo);
    const contentDecoded = base64DecodeUnicode(newsItem.content);

    // Procesar imágenes en el contenido
    const processedCuerpo = await processImages(cuerpoDecoded, slug, 'es');
    const processedContent = await processImages(contentDecoded, slug, 'en');

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

    const esContent = generateNewsHtml({
      lang: 'es',
      title: newsItem.titulo,
      content: processedCuerpo,
      fecha: newsItem.fecha,
      photo: newsItem.photo,
      slug,
      headerImageHtml
    });

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

    const enContent = generateNewsHtml({
      lang: 'en',
      title: newsItem.title,
      content: processedContent,
      fecha: newsItem.fecha,
      photo: newsItem.photo,
      slug,
      headerImageHtml: headerImageHtmlEn
    });

    const esPath = path.join(newsOutputHtmlDir, `${slug}.html`);
    fs.writeFileSync(esPath, esContent, 'utf8');
    
    const enPath = path.join(newsOutputHtmlDir, `${slug}.EN.html`);
    fs.writeFileSync(enPath, enContent, 'utf8');
    
    console.log(`✅ Noticia: ${slug}`);
  }

  // Generar news.json
  const newsJsonPath = path.join(__dirname, 'dist', 'news.json');
  const newsForJson = newsItems.map(item => {
    const fechaIso = parseDateFlexible(item.fecha);
    const slug = generateSlug(`${item.titulo} ${fechaIso}`);
    return {
      titulo: item.titulo,
      cuerpo: item.cuerpo,
      title: item.title,
      content: item.content,
      fecha: parseDateFlexible(item.fecha),
      fechaIso: fechaIso,
      photo: item.photo,
      timestamp: new Date(fechaIso).getTime(),
      slug: slug
    };
  }).sort((a, b) => b.timestamp - a.timestamp);

  fs.writeFileSync(newsJsonPath, JSON.stringify(newsForJson, null, 2), 'utf8');
  console.log(`✅ news.json generado (${newsForJson.length} noticias)`);

  // Generar índices de noticias
  generateNewsIndexes(newsItems);
}

function generateNewsHtml({ lang, title, content, fecha, photo, slug, headerImageHtml }) {
  const isSpanish = lang === 'es';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${title.substring(0, 160)}...">
  <meta name="keywords" content="${isSpanish ? 'noticias, revista ciencias estudiantes' : 'news, student science journal'}, ${title.replace(/[^a-zA-Z0-9]/g, ' ').substring(0, 100)}">
  <title>${title} - ${isSpanish ? 'Noticias' : 'News'} - ${isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students'}</title>
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
    .article-body {
      max-width: 700px;
      margin: 60px auto;
      padding: 0 20px;
      font-size: 1.2rem;
    }
    .article-body p {
      margin-bottom: 2rem;
    }
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
    @media (max-width: 768px) {
      .hero-header { height: 60vh; }
      h1 { font-size: 2.2rem; }
      .article-body { font-size: 1.1rem; }
      .article-body > p:first-of-type::first-letter { font-size: 4rem; line-height: 3.2rem; }
    }
  </style>
</head>
<body>
  <nav class="nav-minimal">
    <a href="/">${isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students'}</a>
  </nav>
  <header>
    ${headerImageHtml}
  </header>
  <main class="article-body">
    <article class="ql-editor">
      ${content}
    </article>
    <div class="back-nav">
      <a href="${isSpanish ? '/es/new' : '/en/new'}">← ${isSpanish ? 'Volver a Noticias' : 'Back to News'}</a>
      <a href="/">${isSpanish ? 'Ir al inicio' : 'Go to home'}</a>
    </div>
  </main>
  <footer style="padding: 60px 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; font-family: 'Inter', sans-serif;">
    &copy; ${new Date().getFullYear()} ${isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students'}.
    <br>${isSpanish ? 'Excelencia en Divulgación Científica Estudiantil' : 'Excellence in Student Scientific Outreach'}.
  </footer>
</body>
</html>`;
}

function generateNewsIndexes(newsItems) {
  const newsByYear = newsItems.reduce((acc, item) => {
    const year = new Date(item.fecha).getFullYear() || 'Sin fecha';
    if (!acc[year]) acc[year] = [];
    acc[year].push(item);
    return acc;
  }, {});

  // Índice español
  const indexContent = `<!DOCTYPE html>
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
    .article-body {
      max-width: 700px;
      margin: 60px auto;
      padding: 0 20px;
      font-size: 1.2rem;
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
      font-size: 1.2rem;
    }
    li a:hover {
      color: var(--primary);
    }
    li span {
      display: block;
      font-size: 0.9rem;
      color: var(--nyt-grey);
      margin-top: 0.3rem;
    }
    @media (max-width: 768px) {
      h1 { font-size: 2.2rem; }
      .article-body { font-size: 1.1rem; }
    }
  </style>
</head>
<body>
  <nav class="nav-minimal">
    <a href="/">Revista Nacional de las Ciencias para Estudiantes</a>
  </nav>
  <header class="standard-header">
    <span class="kicker">Archivo</span>
    <h1>Noticias</h1>
  </header>
  <main class="article-body">
    <p>Todas las noticias de la revista, ordenadas por año de publicación.</p>
${Object.keys(newsByYear).sort().reverse().map(year => `
    <section>
      <h2>Año ${year}</h2>
      <ul>
        ${newsByYear[year].map(item => {
          const slug = generateSlug(item.titulo + ' ' + item.fecha);
          return `
          <li>
            <a href="/news/${slug}.html">${item.titulo}</a>
            <span>${formatDateEs(item.fecha)}</span>
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
</html>`;

  const newsIndexPath = path.join(newsOutputHtmlDir, 'index.html');
  fs.writeFileSync(newsIndexPath, indexContent, 'utf8');

  // Índice inglés
  const indexContentEn = `<!DOCTYPE html>
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
    .article-body {
      max-width: 700px;
      margin: 60px auto;
      padding: 0 20px;
      font-size: 1.2rem;
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
      font-size: 1.2rem;
    }
    li a:hover {
      color: var(--primary);
    }
    li span {
      display: block;
      font-size: 0.9rem;
      color: var(--nyt-grey);
      margin-top: 0.3rem;
    }
    @media (max-width: 768px) {
      h1 { font-size: 2.2rem; }
      .article-body { font-size: 1.1rem; }
    }
  </style>
</head>
<body>
  <nav class="nav-minimal">
    <a href="/">The National Review of Sciences for Students</a>
  </nav>
  <header class="standard-header">
    <span class="kicker">Archive</span>
    <h1>News</h1>
  </header>
  <main class="article-body">
    <p>All news from the journal, sorted by year of publication.</p>
${Object.keys(newsByYear).sort().reverse().map(year => `
    <section>
      <h2>Year ${year}</h2>
      <ul>
        ${newsByYear[year].map(item => {
          const slug = generateSlug(item.titulo + ' ' + item.fecha);
          return `
          <li>
            <a href="/news/${slug}.EN.html">${item.title}</a>
            <span>${formatDateEn(item.fecha)}</span>
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
</html>`;

  const newsIndexPathEn = path.join(newsOutputHtmlDir, 'index.EN.html');
  fs.writeFileSync(newsIndexPathEn, indexContentEn, 'utf8');
  
  console.log(`✅ Índices de noticias generados`);
}

// ==================== FUNCIONES PARA SITEMAP ====================
async function generateSitemap(articles, volumes, newsItems, teamData, spaRoutes) {
  const sitemapPath = path.join(__dirname, 'dist', 'sitemap.xml');
  
  const articleUrls = articles.map(article => {
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
  <loc>${article.pdfUrl || article.pdf}</loc>
  <lastmod>${article.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>`;
  }).join('');

  const volumeUrls = volumes.map(volume => {
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
  }).join('');

  const newsUrls = newsItems.map(item => {
    const slug = generateSlug(item.titulo + ' ' + item.fecha);
    return `
<url>
  <loc>${domain}/news/${slug}.html</loc>
  <lastmod>${item.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>
<url>
  <loc>${domain}/news/${slug}.EN.html</loc>
  <lastmod>${item.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>`;
  }).join('');

  const teamUrls = teamData.map(member => {
    if (member.roles && member.roles.includes('Institución Colaboradora')) return '';
    return `
<url>
  <loc>${domain}/team/${member.slug}.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.6</priority>
</url>
<url>
  <loc>${domain}/team/${member.slug}.EN.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.6</priority>
</url>`;
  }).join('');

  const spaUrls = spaRoutes.map(route => `
<url>
  <loc>${domain}${route}/</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>`).join('');

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
${articleUrls}
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
${volumeUrls}
<url>
  <loc>${domain}/news/index.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
<url>
  <loc>${domain}/news/index.EN.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
${newsUrls}
${teamUrls}
${spaUrls}
</urlset>`.replace(/^\s*\n/gm, '');

  fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
  console.log(`✅ Sitemap generado: ${sitemapPath}`);
}

function generateRobotsTxt() {
  const robotsPath = path.join(__dirname, 'dist', 'robots.txt');
  const robotsContent = `User-agent: *
Allow: /
Disallow: /search
Disallow: /login
Disallow: /admin
Disallow: /submit
Disallow: /api/
Sitemap: ${domain}/sitemap.xml
  `.trim();
  
  fs.writeFileSync(robotsPath, robotsContent, 'utf8');
  console.log(`✅ robots.txt generado`);
      }
