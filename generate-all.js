const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const admin = require('firebase-admin');
const cheerio = require('cheerio');
const sharp = require('sharp');
const crypto = require('crypto');

// --- Configuración Inicial ---
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

// Inicializar Firebase Admin (solo si existe la clave)
let db;
try {
  if (fs.existsSync('./serviceAccountKey.json')) {
    admin.initializeApp({
      credential: admin.credential.cert('./serviceAccountKey.json')
    });
    db = admin.firestore();
    console.log('✅ Firebase inicializado.');
  } else {
    console.log('⚠️ Archivo serviceAccountKey.json no encontrado. Funciones de Firebase deshabilitadas.');
    db = null;
  }
} catch (error) {
  console.log('⚠️ Error al inicializar Firebase:', error.message);
  db = null;
}

// --- Funciones de Utilidad (sin cambios, excepto las de autores) ---

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
  try {
    return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateEn(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// === FUNCIONES CORREGIDAS PARA EL NUEVO FORMATO DE AUTORES (array de objetos) ===

/**
 * Obtiene un string con los nombres de los autores para mostrar.
 * Ejemplo: "José Ignacio Carter, José Antonio Fuentes y Tomás Ramírez"
 */
function formatAuthorsDisplay(autoresArray, language = 'es') {
  if (!autoresArray || !Array.isArray(autoresArray) || autoresArray.length === 0) {
    return 'Autor desconocido';
  }
  
  // Extraer los nombres
  const names = autoresArray.map(a => a.name || '').filter(Boolean);
  if (names.length === 0) return 'Autor desconocido';
  
  const connector = language === 'es' ? 'y' : 'and';
  
  if (names.length === 1) {
    return names[0];
  } else if (names.length === 2) {
    return `${names[0]} ${connector} ${names[1]}`;
  } else {
    return names.slice(0, -1).join(', ') + `, ${connector} ` + names[names.length - 1];
  }
}

/**
 * Formato para citas (Ej: "Carter, José Ignacio")
 */
function formatAuthorForCitation(autorObj) {
  if (!autorObj || !autorObj.name) return '';
  const nameParts = autorObj.name.trim().split(/\s+/);
  if (nameParts.length >= 2) {
    const apellido = nameParts.pop();
    const nombre = nameParts.join(' ');
    return `${apellido}, ${nombre}`;
  }
  return autorObj.name;
}

/**
 * Formato APA corto (Ej: "Carter, J. I.")
 */
function getAPAAuthor(autorObj) {
  if (!autorObj || !autorObj.name) return '';
  const nameParts = autorObj.name.trim().split(/\s+/);
  if (nameParts.length < 2) return autorObj.name;
  const last = nameParts.pop();
  const initials = nameParts.map(n => n[0].toUpperCase() + '.').join(' ');
  return `${last}, ${initials}`;
}

/**
 * Formato APA completo para la lista de autores
 */
function formatAuthorsAPA(autoresArray) {
  if (!autoresArray || !Array.isArray(autoresArray) || autoresArray.length === 0) {
    return '';
  }
  
  const formatted = autoresArray.map(getAPAAuthor).filter(Boolean);
  
  if (formatted.length === 1) {
    return formatted[0];
  } else if (formatted.length === 2) {
    return formatted[0] + ' & ' + formatted[1];
  } else {
    return formatted.slice(0, -1).join(', ') + ' & ' + formatted[formatted.length - 1];
  }
}

/**
 * Formato Chicago/MLA
 */
function formatAuthorsChicagoOrMLA(autoresArray, language = 'es') {
  if (!autoresArray || !Array.isArray(autoresArray) || autoresArray.length === 0) {
    return '';
  }
  
  const formatted = autoresArray.map(formatAuthorForCitation).filter(Boolean);
  const connector = language === 'es' ? 'y' : 'and';
  const etal = 'et al.';
  
  if (formatted.length === 1) {
    return formatted[0];
  } else if (formatted.length === 2) {
    return `${formatted[0]} ${connector} ${formatted[1]}`;
  } else {
    return `${formatted[0]} ${etal}`;
  }
}

// --- Funciones de utilidad general (sin cambios) ---

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
  if (typeof image === 'string' && image.startsWith('http')) return image;
  return '';
}

const base64DecodeUnicode = (str) => {
  if (!str) return '';
  try {
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch (err) {
    console.error('Error decoding Base64:', err);
    return '';
  }
};

async function processImages(html, slug, lang) {
  if (!html) return '';
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

// SVG Open Access y ORCID (sin cambios)
const oaSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 53" width="24" height="36" style="vertical-align:middle; margin-right:4px;">...</svg>`;
const orcidSvg = `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" width="16" height="16">...</svg>`;

// --- FUNCIÓN PARA GENERAR HTML DE ARTÍCULO (NUEVA) ---
function generateArticleHtml(article, lang) {
  const isSpanish = lang === 'es';
  const title = isSpanish ? article.titulo : (article.tituloEnglish || article.titulo);
  const abstract = isSpanish ? article.resumen : article.abstract;
  const authorsDisplay = formatAuthorsDisplay(article.autores, lang);
  const authorsAPA = formatAuthorsAPA(article.autores);
  const authorsChicago = formatAuthorsChicagoOrMLA(article.autores, lang);
  const keywords = isSpanish ? article.palabras_clave : article.keywords_english;
  const slug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
  
  // Construir lista de autores con afiliaciones para el HTML
  const authorsList = article.autores.map(autor => {
    let html = `<span class="author-name">${autor.name}</span>`;
    if (autor.institution) {
      html += `<span class="author-institution">, ${autor.institution}</span>`;
    }
    if (autor.authorId) {
      html += ` <a href="https://orcid.org/${autor.authorId}" target="_blank" class="orcid-link">${orcidSvg}</a>`;
    }
    return `<li>${html}</li>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students'}</title>
  <!-- Metaetiquetas de citación -->
  <meta name="citation_title" content="${title}">
  <meta name="citation_author" content="${article.autores.map(a => a.name).join('; ')}">
  <meta name="citation_publication_date" content="${article.fecha}">
  <meta name="citation_journal_title" content="Revista Nacional de las Ciencias para Estudiantes">
  <meta name="citation_issn" content="3087-2839">
  <meta name="citation_volume" content="${article.volumen}">
  <meta name="citation_issue" content="${article.numero}">
  <meta name="citation_firstpage" content="${article.primeraPagina}">
  <meta name="citation_lastpage" content="${article.ultimaPagina}">
  <meta name="citation_pdf_url" content="${article.pdfUrl}">
  <meta name="citation_abstract_html_url" content="${domain}/articles/article-${slug}${isSpanish ? '' : 'EN'}.html">
  <meta name="citation_language" content="${lang}">
  <meta name="citation_keywords" content="${keywords ? keywords.join('; ') : ''}">
  <meta name="description" content="${abstract ? abstract.substring(0, 160) + '...' : ''}">
  <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
  <style>
    /* Estilos (simplificados - puedes copiar los de tu versión anterior) */
    body { font-family: 'Inter', sans-serif; line-height: 1.7; color: #222; margin: 0; }
    .article-header { background: #f8f9fa; padding: 4rem 2rem; border-bottom: 1px solid #dee2e6; }
    .article-container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { font-family: 'Libre Baskerville', serif; font-size: 2.5rem; margin-bottom: 1rem; }
    .authors-list { list-style: none; padding: 0; margin: 2rem 0; }
    .authors-list li { margin-bottom: 0.5rem; }
    .author-name { font-weight: 600; }
    .author-institution { color: #666; font-size: 0.9rem; }
    .orcid-link { display: inline-block; margin-left: 0.5rem; vertical-align: middle; }
    .keywords { margin: 2rem 0; padding: 1rem; background: #f1f3f5; border-radius: 4px; }
    .btn { display: inline-block; padding: 0.8rem 1.5rem; background: #005587; color: white; text-decoration: none; border-radius: 4px; font-weight: 500; }
    .btn:hover { background: #003d60; }
    footer { background: #222; color: #fff; padding: 3rem; text-align: center; }
  </style>
</head>
<body>
  <header class="article-header">
    <div class="article-container">
      <p class="kicker">${isSpanish ? 'Artículo' : 'Article'} · Vol. ${article.volumen} Núm. ${article.numero} (${article.fecha})</p>
      <h1>${title}</h1>
      <ul class="authors-list">
        ${authorsList}
      </ul>
      <div class="keywords">
        <strong>${isSpanish ? 'Palabras clave:' : 'Keywords:'}</strong> ${keywords ? keywords.join(', ') : ''}
      </div>
      <div style="margin-top: 2rem;">
        <a href="${article.pdfUrl}" class="btn" target="_blank">📥 ${isSpanish ? 'Descargar PDF' : 'Download PDF'}</a>
      </div>
    </div>
  </header>
  <main class="article-container">
    <section class="abstract">
      <h2>${isSpanish ? 'Resumen' : 'Abstract'}</h2>
      <p>${abstract || ''}</p>
    </section>
    
    ${article.html_es && isSpanish ? `<section class="content">${article.html_es}</section>` : ''}
    ${article.html_en && !isSpanish ? `<section class="content">${article.html_en}</section>` : ''}
    
    <section class="citations" style="margin-top: 3rem; border-top: 1px solid #dee2e6; padding-top: 2rem;">
      <h3>${isSpanish ? 'Cómo citar' : 'How to cite'}</h3>
      <p><strong>APA:</strong> ${authorsAPA} (${new Date(article.fecha).getFullYear()}). ${title}. <em>Revista Nacional de las Ciencias para Estudiantes</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</p>
      <p><strong>${isSpanish ? 'Chicago/MLA:' : 'Chicago/MLA:'}</strong> ${authorsChicago}. "${title}." <em>Revista Nacional de las Ciencias para Estudiantes</em> ${article.volumen}, no. ${article.numero} (${new Date(article.fecha).getFullYear()}): ${article.primeraPagina}-${article.ultimaPagina}.</p>
    </section>
  </main>
  <footer>
    <p>${isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students'} · ISSN 3087-2839</p>
    <p>© ${new Date().getFullYear()}</p>
  </footer>
</body>
</html>`;
}

// --- FUNCIÓN PRINCIPAL (async) ---
(async () => {
  try {
    // Crear directorios necesarios
    if (!fs.existsSync(volumesOutputHtmlDir)) fs.mkdirSync(volumesOutputHtmlDir, { recursive: true });
    if (!fs.existsSync(newsOutputHtmlDir)) fs.mkdirSync(newsOutputHtmlDir, { recursive: true });
    if (!fs.existsSync(teamOutputHtmlDir)) fs.mkdirSync(teamOutputHtmlDir, { recursive: true });
    if (!fs.existsSync(sectionsOutputDir)) fs.mkdirSync(sectionsOutputDir, { recursive: true });
    if (!fs.existsSync(outputHtmlDir)) fs.mkdirSync(outputHtmlDir, { recursive: true });
    if (!fs.existsSync(path.join(__dirname, 'dist', 'images', 'news'))) fs.mkdirSync(path.join(__dirname, 'dist', 'images', 'news'), { recursive: true });

    // ==================== EQUIPO (desde Team.json) ====================
    console.log('📥 Cargando team data...');
    let teamData = [];
    try {
      const teamJsonUrl = 'https://www.revistacienciasestudiantes.com/team/Team.json';
      const teamRes = await fetch(teamJsonUrl);
      teamData = await teamRes.json();
      console.log(`✅ Team data cargado: ${teamData.length} usuarios`);
    } catch (e) {
      console.log('⚠️ No se pudo cargar Team.json:', e.message);
      teamData = [];
    }

    const authorToInstitution = {};
    const authorToSlug = {};
    const authorToOrcid = {};
    const authorToEmail = {};
    const anonymousAuthors = {};

    teamData.forEach(user => {
      const name = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
      if (name) {
        authorToInstitution[name] = user.institution || '';
        authorToSlug[name] = user.slug;
        authorToOrcid[name] = user.orcid || '';
        authorToEmail[name] = user.publicEmail || '';
        if (user.isAnonymous) {
          anonymousAuthors[name] = true;
        }
      }
    });
    console.log(`📊 Autores anónimos en team: ${Object.keys(anonymousAuthors).length}`);

    // ==================== VOLÚMENES (desde Firebase) ====================
    console.log('📥 Procesando volúmenes...');
    let volumes = [];
    if (db) {
      try {
        const volumesSnapshot = await db.collection('volumes').get();
        volumes = volumesSnapshot.docs.map(doc => {
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
      } catch (e) {
        console.log('⚠️ Error cargando volúmenes de Firebase:', e.message);
      }
    }
    
    fs.writeFileSync(volumesOutputJson, JSON.stringify(volumes, null, 2), 'utf8');
    console.log(`✅ Archivo generado: ${volumesOutputJson} (${volumes.length} volúmenes)`);

    // ==================== ARTÍCULOS (desde articles.json) - URL CORREGIDA ====================
    console.log('📥 Cargando artículos desde la URL pública...');
    let articles = [];
    try {
      // ***** URL CORREGIDA *****
      const articlesRes = await fetch('https://www.revistacienciasestudiantes.com/articles.json');
      articles = await articlesRes.json();
      console.log(`✅ Artículos cargados: ${articles.length}`);
      
      // Guardar una copia local del JSON
      fs.writeFileSync(outputJson, JSON.stringify(articles, null, 2), 'utf8');
      console.log(`✅ Archivo local guardado: ${outputJson}`);
      
    } catch (e) {
      console.log('⚠️ No se pudo cargar articles.json desde la URL. Intentando con archivo local...', e.message);
      // Fallback: intentar cargar desde el archivo local
      try {
        if (fs.existsSync(outputJson)) {
          const localData = fs.readFileSync(outputJson, 'utf8');
          articles = JSON.parse(localData);
          console.log(`✅ Artículos cargados desde archivo local: ${articles.length}`);
        }
      } catch (localError) {
        console.log('❌ No se pudo cargar articles.json ni local ni remotamente');
      }
    }

    // ==================== GENERAR PÁGINAS DE ARTÍCULOS ====================
    console.log('📄 Generando páginas HTML de artículos...');
    let articleCounter = 0;
    for (const article of articles) {
      // Validar que el artículo tenga autores en el formato correcto
      if (!article.autores || !Array.isArray(article.autores)) {
        console.log(`⚠️ Artículo "${article.titulo}" no tiene autores en formato array. Se omitirá.`);
        continue;
      }
      
      const slug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
      
      // Versión en español
      const esHtml = generateArticleHtml(article, 'es');
      const esPath = path.join(outputHtmlDir, `article-${slug}.html`);
      fs.writeFileSync(esPath, esHtml, 'utf8');
      
      // Versión en inglés
      const enHtml = generateArticleHtml(article, 'en');
      const enPath = path.join(outputHtmlDir, `article-${slug}EN.html`);
      fs.writeFileSync(enPath, enHtml, 'utf8');
      
      articleCounter++;
      if (articleCounter % 10 === 0) {
        console.log(`  ... generados ${articleCounter} artículos`);
      }
    }
    console.log(`✅ Páginas de artículos generadas: ${articleCounter * 2} (${articleCounter} en cada idioma)`);

    // ==================== NOTICIAS (desde Firebase) ====================
    console.log('📥 Procesando noticias...');
    let newsItems = [];
    if (db) {
      try {
        const newsSnapshot = await db.collection('news').get();
        newsItems = newsSnapshot.docs.map(doc => doc.data()).map(item => ({
          titulo: item.title_es || '',
          cuerpo: item.body_es || '',
          fecha: parseDateFlexible(item.timestamp_es),
          title: item.title_en || '',
          content: item.body_en || '',
          photo: item.photo || ''
        }));
        
        for (const newsItem of newsItems) {
          if (!newsItem.titulo && !newsItem.title) continue;
          
          const slug = generateSlug(`${newsItem.titulo || newsItem.title} ${newsItem.fecha}`);
          const cuerpoDecoded = base64DecodeUnicode(newsItem.cuerpo);
          const contentDecoded = base64DecodeUnicode(newsItem.content);

          const processedCuerpo = await processImages(cuerpoDecoded, slug, 'es');
          const processedContent = await processImages(contentDecoded, slug, 'en');

          // Versión español
          const esContent = generateNewsHtml({
            lang: 'es',
            title: newsItem.titulo,
            content: processedCuerpo,
            fecha: newsItem.fecha,
            photo: newsItem.photo,
            slug
          });

          // Versión inglés
          const enContent = generateNewsHtml({
            lang: 'en',
            title: newsItem.title,
            content: processedContent,
            fecha: newsItem.fecha,
            photo: newsItem.photo,
            slug
          });

          fs.writeFileSync(path.join(newsOutputHtmlDir, `${slug}.html`), esContent, 'utf8');
          fs.writeFileSync(path.join(newsOutputHtmlDir, `${slug}.EN.html`), enContent, 'utf8');
        }
        
        // Generar news.json
        const newsForJson = newsItems.map(item => {
          const fechaIso = parseDateFlexible(item.fecha);
          const slug = generateSlug(`${item.titulo} ${fechaIso}`);
          return {
            ...item,
            fechaIso,
            timestamp: new Date(fechaIso).getTime(),
            slug
          };
        }).sort((a, b) => b.timestamp - a.timestamp);
        
        fs.writeFileSync(path.join(__dirname, 'dist', 'news.json'), JSON.stringify(newsForJson, null, 2), 'utf8');
        console.log(`✅ Noticias procesadas: ${newsItems.length}`);
        
      } catch (e) {
        console.log('⚠️ Error procesando noticias:', e.message);
      }
    }

    // ==================== VOLÚMENES HTML (TOCs) ====================
    console.log('📄 Generando páginas HTML de volúmenes...');
    for (const volume of volumes) {
      const volumeSlug = `${volume.volumen}-${volume.numero}`;
      volume.pdfUrl = volume.pdf;
      const year = new Date(volume.fecha).getFullYear();
      
      // Filtrar artículos de este volumen
      const volumeArticles = articles.filter(a => 
        String(a.volumen) === String(volume.volumen) && 
        String(a.numero) === String(volume.numero)
      ).sort((a, b) => parseInt(a.primeraPagina) - parseInt(b.primeraPagina));

      const tocEs = volumeArticles.map(a => {
        const slug = `${generateSlug(a.titulo)}-${a.numeroArticulo}`;
        const authorsDisplay = formatAuthorsDisplay(a.autores, 'es');
        return `
          <div class="article-item">
            <a href="/articles/article-${slug}.html" class="article-title">${a.titulo}</a>
            <span class="article-authors">${authorsDisplay} (pp. ${a.primeraPagina}-${a.ultimaPagina})</span>
          </div>
        `;
      }).join('');

      const tocEn = volumeArticles.map(a => {
        const slug = `${generateSlug(a.titulo)}-${a.numeroArticulo}`;
        const authorsDisplay = formatAuthorsDisplay(a.autores, 'en');
        return `
          <div class="article-item">
            <a href="/articles/article-${slug}EN.html" class="article-title">${a.titulo}</a>
            <span class="article-authors">${authorsDisplay} (pp. ${a.primeraPagina}-${a.ultimaPagina})</span>
          </div>
        `;
      }).join('');

      // Generar HTML español
      const htmlContentEs = generateVolumeHtml({
        lang: 'es',
        volume,
        volumeSlug,
        toc: tocEs,
        year,
        domain,
        oaSvg
      });
      fs.writeFileSync(path.join(volumesOutputHtmlDir, `volume-${volumeSlug}.html`), htmlContentEs, 'utf8');

      // Generar HTML inglés
      const htmlContentEn = generateVolumeHtml({
        lang: 'en',
        volume,
        volumeSlug,
        toc: tocEn,
        year,
        domain,
        oaSvg
      });
      fs.writeFileSync(path.join(volumesOutputHtmlDir, `volume-${volumeSlug}EN.html`), htmlContentEn, 'utf8');
    }
    
    // Generar índices de volúmenes
    if (volumes.length > 0) {
      generateVolumeIndexes(volumes);
    }

    // ==================== RUTAS SPA ====================
    console.log('🚀 Pre-renderizando rutas SPA...');
    const appShellPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(appShellPath)) {
      const appShellContent = fs.readFileSync(appShellPath, 'utf8');
      const spaRoutes = [
        '/es/about', '/es/guidelines', '/es/faq', '/es/article', '/es/submit', 
        '/es/team', '/es/new', '/es/login', '/es/admin', '/es/volume',
        '/en/about', '/en/guidelines', '/en/faq', '/en/article', '/en/submit', 
        '/en/team', '/en/new', '/en/login', '/en/admin', '/en/volume'
      ];
      spaRoutes.forEach(route => {
        const routePath = path.join(__dirname, 'dist', route);
        if (!fs.existsSync(routePath)) {
          fs.mkdirSync(routePath, { recursive: true });
        }
        fs.writeFileSync(path.join(routePath, 'index.html'), appShellContent, 'utf8');
      });
      console.log(`✅ ${spaRoutes.length} rutas SPA pre-renderizadas`);
    }

    // ==================== SITEMAP Y ROBOTS ====================
    console.log('🗺️ Generando sitemap y robots.txt...');
    await generateSitemap(articles, volumes, newsItems, teamData);
    generateRobotsTxt();

    console.log('🎉 ¡Proceso completado con éxito!');

  } catch (err) {
    console.error('❌ Error fatal:', err);
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
  <meta name="description" content="${editorial ? editorial.substring(0, 160) + '...' : ''}">
  <title>${title} - ${isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students'}</title>
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
    <a href="/" class="journal-name">${isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students'}</a>
    <div class="issue-meta">
      ${isSpanish ? 'Vol.' : 'Vol.'} ${volume.volumen}, ${isSpanish ? 'Núm.' : 'No.'} ${volume.numero} • ${fecha}
    </div>
  </header>
  <article class="hero-section">
    <h1>${title}</h1>
    <div class="hero-details">
      <span><strong>${isSpanish ? 'Publicado:' : 'Published:'}</strong> ${fecha}</span>
      <span><strong>ISSN:</strong> 3087-2839</span>
      <span><strong>${isSpanish ? 'Idioma:' : 'Language:'}</strong> ${isSpanish ? 'Español/Inglés' : 'Spanish/English'}</span>
    </div>
  </article>
  <div class="main-grid">
    <main>
      ${editorial ? `
        <section id="editorial">
          <h2>${isSpanish ? 'Nota Editorial' : 'Editorial Note'}</h2>
          <div class="editorial-box">
            ${editorial}
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
        <div style="display: flex; gap: 1.5rem; align-items: center; border-top: 1px solid var(--border-color); padding-top: 2rem;">
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
  <footer style="background: #f8f8f8; border-top: 1px solid var(--border-color); padding: 4rem 2rem; text-align: center;">
    <p style="font-family: 'Libre Baskerville', serif; margin-bottom: 1rem;">${isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students'}</p>
    <p style="font-size: 0.8rem; color: var(--text-light);">ISSN 3087-2839</p>
    <p style="font-size: 0.8rem; color: var(--text-light);">© ${new Date().getFullYear()} — ${isSpanish ? 'Una revista por y para estudiantes' : 'A journal by and for students'}</p>
  </footer>
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
  <loc>${article.pdf}</loc>
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
