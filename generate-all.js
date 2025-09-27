const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');

// URLs de los CSVs
const articlesCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const teamCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const newsCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQKnN8qMJcBN8im9Q61o-qElx1jQp5NdS80_B-FakCHrPLXHlQ_FXZWT0o5GVVHAM26l9sjLxsTCNO8/pub?output=csv';

// Rutas de salida
const outputJson = path.join(__dirname, 'dist', 'articles.json');
const outputHtmlDir = path.join(__dirname, 'dist', 'articles');
const newsOutputHtmlDir = path.join(__dirname, 'dist', 'news');
const teamOutputHtmlDir = path.join(__dirname, 'dist', 'team');
const sectionsOutputDir = path.join(__dirname, 'dist', 'sections');
const sitemapPath = path.join(__dirname, 'dist', 'sitemap.xml');
const robotsPath = path.join(__dirname, 'dist', 'robots.txt');
const domain = 'https://www.revistacienciasestudiantes.com';

// --- Funciones de Ayuda ---
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

function generateSlug(name) {
  if (!name) return '';
  return name.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-').replace(/^-+|-+$/g, '');
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

// Asegurarse de que los directorios existan
if (!fs.existsSync(outputHtmlDir)) fs.mkdirSync(outputHtmlDir, { recursive: true });
if (!fs.existsSync(newsOutputHtmlDir)) fs.mkdirSync(newsOutputHtmlDir, { recursive: true });
if (!fs.existsSync(teamOutputHtmlDir)) fs.mkdirSync(teamOutputHtmlDir, { recursive: true });
if (!fs.existsSync(sectionsOutputDir)) fs.mkdirSync(sectionsOutputDir, { recursive: true });

(async () => {
  try {
    console.log('🔥 Empezando el proceso de generación de contenido...');

    // --- 1. Procesar Artículos ---
    console.log('📚 Procesando artículos...');
    const articlesRes = await fetch(articlesCsvUrl);
    if (!articlesRes.ok) throw new Error(`Error descargando CSV de artículos: ${articlesRes.statusText}`);
    const articlesCsvData = await articlesRes.text();
    const articlesParsed = Papa.parse(articlesCsvData, { header: true, skipEmptyLines: true });
    const articles = articlesParsed.data.map(row => ({
      titulo: row['Título'] || 'Sin título',
      autores: row['Autor(es)'] || 'Autor desconocido',
      resumen: row['Resumen'] || 'Resumen no disponible',
      englishAbstract: row['Abstract'] || 'English abstract not available',
      pdf: `${domain}/Articles/Articulo${row['Número de artículo']}.pdf`,
      fecha: parseDateFlexible(row['Fecha']),
      volumen: row['Volumen'] || '',
      numero: row['Número'] || '',
      primeraPagina: row['Primera página'] || '',
      ultimaPagina: row['Última página'] || '',
      area: row['Área temática'] || '',
      numeroArticulo: row['Número de artículo'] || '',
      palabras_clave: row['Palabras clave'] ? row['Palabras clave'].split(/[;,]/).map(k => k.trim()) : []
    }));
    fs.writeFileSync(outputJson, JSON.stringify(articles, null, 2), 'utf8');
    console.log(`✅ ${articles.length} artículos guardados en ${outputJson}`);

    // Generar HTML para cada artículo
    articles.forEach(article => {
      const authorsList = article.autores.split(';').map(a => formatAuthorForCitation(a));
      const authorMetaTags = authorsList.map(author => `<meta name="citation_author" content="${author}">`).join('\n');
      const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="citation_title" content="${article.titulo}">
  ${authorMetaTags}
  <meta name="citation_publication_date" content="${article.fecha}">
  <meta name="citation_journal_title" content="La Revista Nacional de Ciencias para Estudiantes">
  <meta name="citation_issn" content="1234-5678">
  <meta name="citation_volume" content="${article.volumen}">
  <meta name="citation_issue" content="${article.numero}">
  <meta name="citation_firstpage" content="${article.primeraPagina}">
  <meta name="citation_lastpage" content="${article.ultimaPagina}">
  <meta name="citation_pdf_url" content="${article.pdf}">
  <meta name="citation_abstract_html_url" content="${domain}/articles/articulo${article.numeroArticulo}.html">
  <meta name="citation_abstract" content="${article.resumen}">
  <meta name="citation_abstract" xml:lang="en" content="${article.englishAbstract}">
  <meta name="citation_keywords" content="${article.palabras_clave.join('; ')}">
  <meta name="citation_language" content="es">
  <title>${article.titulo} - La Revista Nacional de Ciencias para Estudiantes</title>
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
      <h2>Abstract (English)</h2>
      <p>${article.englishAbstract}</p>
    </section>
    <section>
      <h2>Descargar PDF</h2>
      <a href="${article.pdf}" target="_blank" download>Descargar PDF</a>
    </section>
    <section>
      <h2>Citas</h2>
      <p><strong>APA:</strong> ${article.autores}. (${new Date(article.fecha).getFullYear()}). ${article.titulo}. <em>La Revista Nacional de Ciencias para Estudiantes</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</p>
      <p><strong>MLA:</strong> ${article.autores}. "${article.titulo}." <em>La Revista Nacional de Ciencias para Estudiantes</em>, vol. ${article.volumen}, no. ${article.numero}, ${new Date(article.fecha).getFullYear()}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</p>
      <p><strong>Chicago:</strong> ${article.autores}. "${article.titulo}." <em>La Revista Nacional de Ciencias para Estudiantes</em> ${article.volumen}, no. ${article.numero} (${new Date(article.fecha).getFullYear()}): ${article.primeraPagina}-${article.ultimaPagina}.</p>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} La Revista Nacional de Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>
      `.trim();
      const filePath = path.join(outputHtmlDir, `articulo${article.numeroArticulo}.html`);
      fs.writeFileSync(filePath, htmlContent, 'utf8');
      console.log(`✅ Generado HTML de artículo: ${filePath}`);
    });

    // Generar índice de artículos
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
  <title>Índice de Artículos - La Revista Nacional de Ciencias para Estudiantes</title>
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
        ${articlesByYear[year].map(article => `
          <li>
            <a href="/articles/articulo${article.numeroArticulo}.html">${article.titulo}</a> - ${article.autores} (Vol. ${article.volumen}, Núm. ${article.numero})
          </li>
        `).join('')}
      </ul>
    </section>
`).join('')}
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} La Revista Nacional de Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>
    `.trim();
    const indexPath = path.join(outputHtmlDir, 'index.html');
    fs.writeFileSync(indexPath, indexContent, 'utf8');
    console.log(`✅ Generado índice HTML de artículos: ${indexPath}`);

    // Generar índice de artículos en inglés
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
        ${articlesByYear[year].map(article => `
          <li>
            <a href="/articles/articulo${article.numeroArticulo}.html">${article.titulo}</a> - ${article.autores} (Vol. ${article.volumen}, No. ${article.numero})
          </li>
        `).join('')}
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
    console.log(`✅ Generado índice HTML de artículos (EN): ${indexPathEn}`);

    // --- 2. Procesar Noticias ---
    console.log('📰 Procesando noticias...');
    const newsRes = await fetch(newsCsvUrl);
    if (!newsRes.ok) throw new Error(`Error descargando CSV de noticias: ${newsRes.statusText}`);
    const newsCsvData = await newsRes.text();
    const newsParsed = Papa.parse(newsCsvData, { header: true, skipEmptyLines: true });
    const newsItems = newsParsed.data
      .filter(row => (row['Título'] || '').trim() !== '' && (row['Contenido de la noticia'] || '').trim() !== '')
      .map(row => ({
        titulo: String(row['Título'] ?? ''),
        cuerpo: base64DecodeUnicode(String(row['Contenido de la noticia'] ?? '')),
        fecha: parseDateFlexible(String(row['Fecha'] ?? '')),
        title: String(row['Title'] ?? ''),
        content: base64DecodeUnicode(String(row['Content of the new'] ?? '')),
      }));

    for (const newsItem of newsItems) {
      const slug = generateSlug(`${newsItem.titulo} ${newsItem.fecha}`);
      const esContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${newsItem.titulo.substring(0, 160)}...">
  <meta name="keywords" content="noticias, revista ciencias estudiantes, ${newsItem.titulo.replace(/[^a-zA-Z0-9]/g, ' ').substring(0, 100)}">
  <title>${newsItem.titulo} - Noticias - La Revista Nacional de Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>${newsItem.titulo}</h1>
    <p>Publicado el ${newsItem.fecha}</p>
  </header>
  <main>
    <section>
      <div class="content">${newsItem.cuerpo}</div>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} La Revista Nacional de Ciencias para Estudiantes</p>
    <a href="/news/index.html">Volver a Noticias</a>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>`;

      const enContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${newsItem.title.substring(0, 160)}...">
  <meta name="keywords" content="news, student science journal, ${newsItem.title.replace(/[^a-zA-Z0-9]/g, ' ').substring(0, 100)}">
  <title>${newsItem.title} - News - The National Review of Sciences for Students</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>${newsItem.title}</h1>
    <p>Published on ${newsItem.fecha}</p>
  </header>
  <main>
    <section>
      <div class="content">${newsItem.content}</div>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students</p>
    <a href="/news/index.EN.html">Back to News</a>
    <a href="/">Back to home</a>
  </footer>
</body>
</html>`;

      const esPath = path.join(newsOutputHtmlDir, `${slug}.html`);
      fs.writeFileSync(esPath, esContent, 'utf8');
      console.log(`✅ Generado HTML de noticia (ES): ${esPath}`);
      const enPath = path.join(newsOutputHtmlDir, `${slug}.EN.html`);
      fs.writeFileSync(enPath, enContent, 'utf8');
      console.log(`✅ Generado HTML de noticia (EN): ${enPath}`);
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
  <title>Índice de Noticias - La Revista Nacional de Ciencias para Estudiantes</title>
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
    <p>&copy; ${new Date().getFullYear()} La Revista Nacional de Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>`;

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
</html>`;

    const newsEsIndexPath = path.join(newsOutputHtmlDir, 'index.html');
    fs.writeFileSync(newsEsIndexPath, newsIndexContent, 'utf8');
    console.log(`✅ Generado índice HTML de noticias (ES): ${newsEsIndexPath}`);
    const newsEnIndexPath = path.join(newsOutputHtmlDir, 'index.EN.html');
    fs.writeFileSync(newsEnIndexPath, newsIndexContentEn, 'utf8');
    console.log(`✅ Generado índice HTML de noticias (EN): ${newsEnIndexPath}`);

    // --- 3. Procesar Equipo ---
    console.log('👥 Procesando miembros del equipo...');
    const teamRes = await fetch(teamCsvUrl);
    if (!teamRes.ok) throw new Error(`Error descargando CSV de equipo: ${teamRes.statusText}`);
    const teamCsvData = await teamRes.text();
    const teamParsed = Papa.parse(teamCsvData, { header: true, skipEmptyLines: true });
    const allMembers = teamParsed.data.filter(row => (row['Nombre'] || '').trim() !== '');

    for (const member of allMembers) {
      const nombre = member['Nombre'] || 'Miembro desconocido';
      const slug = generateSlug(nombre);
      const roles = (member['Rol en la Revista'] || 'No especificado')
        .split(';')
        .map(r => r.trim())
        .filter(r => r)
        .join(', ') || 'No especificado';
      const rolesEn = (member['Role in the Journal'] || 'Not specified')
        .split(';')
        .map(r => r.trim())
        .filter(r => r)
        .join(', ') || 'Not specified';
      const descripcion = member['Descripción'] || 'Información no disponible';
      const description = member['Description'] || 'Information not available';
      const areas = member['Áreas de interés'] || 'No especificadas';
      const areasEn = member['Areas of interest'] || 'Not specified';
      const imagen = getImageSrc(member['Imagen'] || '');
      const areasList = areas.split(';').map(a => a.trim()).filter(a => a);
      const areasListEn = areasEn.split(';').map(a => a.trim()).filter(a => a);
      const areasTagsHtml = areasList.length ? areasList.map(area => `<span class="tag">${area}</span>`).join('') : '<p>No especificadas</p>';
      const areasTagsHtmlEn = areasListEn.length ? areasListEn.map(area => `<span class="tag">${area}</span>`).join('') : '<p>Not specified</p>';
      const esContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${descripcion.substring(0, 160)}...">
  <meta name="keywords" content="${areas}, ${roles}, La Revista Nacional de Ciencias para Estudiantes">
  <meta name="author" content="${nombre}">
  <title>${nombre} - Equipo de La Revista Nacional de Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>${nombre}</h1>
    <p><strong>Rol:</strong> ${roles}</p>
  </header>
  <main>
    <section>
      ${imagen ? `<img src="${imagen}" alt="Foto de ${nombre}" class="member-img">` : `<p>Sin imagen disponible</p>`}
      <h2>Descripción</h2>
      <p>${descripcion}</p>
      <h2>Áreas de interés</h2>
      <div class="areas-tags">${areasTagsHtml}</div>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} La Revista Nacional de Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>`;

      const enContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${description.substring(0, 160)}...">
  <meta name="keywords" content="${areasEn}, ${rolesEn}, The National Review of Sciences for Students">
  <meta name="author" content="${nombre}">
  <title>${nombre} - Team of The National Review of Sciences for Students</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>${nombre}</h1>
    <p><strong>Role:</strong> ${rolesEn}</p>
  </header>
  <main>
    <section>
      ${imagen ? `<img src="${imagen}" alt="Photo of ${nombre}" class="member-img">` : `<p>No image available</p>`}
      <h2>Description</h2>
      <p>${description}</p>
      <h2>Areas of Interest</h2>
      <div class="areas-tags">${areasTagsHtmlEn}</div>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students</p>
    <a href="/">Back to home</a>
  </footer>
</body>
</html>`;

      const esPath = path.join(teamOutputHtmlDir, `${slug}.html`);
      fs.writeFileSync(esPath, esContent, 'utf8');
      console.log(`✅ Generado HTML de miembro (ES): ${esPath}`);
      const enPath = path.join(teamOutputHtmlDir, `${slug}.EN.html`);
      fs.writeFileSync(enPath, enContent, 'utf8');
      console.log(`✅ Generado HTML de miembro (EN): ${enPath}`);
    }

    // --- 4. Pre-renderizar Rutas de la SPA ---
    console.log('🚀 Pre-renderizando las rutas de la aplicación...');
    const appShellPath = path.join(__dirname, 'dist', 'index.html');
    let appShellContent = '';
    if (fs.existsSync(appShellPath)) {
      appShellContent = fs.readFileSync(appShellPath, 'utf8');
    } else {
      console.warn('⚠️ El archivo dist/index.html no se encontró. Se generarán páginas estáticas sin app-shell.');
    }

    const spaRoutes = [
      '/es/about', '/es/guidelines', '/es/faq', '/es/contact', '/es/archive', '/es/team', '/es/news', '/es/login', '/es/admin',
      '/en/about', '/en/guidelines', '/en/faq', '/en/contact', '/en/archive', '/en/team', '/en/news', '/en/login', '/en/admin'
    ];

    spaRoutes.forEach(route => {
      const routePath = path.join(__dirname, 'dist', route);
      if (!fs.existsSync(routePath)) {
        fs.mkdirSync(routePath, { recursive: true });
      }
      const indexPath = path.join(routePath, 'index.html');
      fs.writeFileSync(indexPath, appShellContent || '<html><body><h1>Placeholder for SPA route</h1></body></html>', 'utf8');
      console.log(`✅ Generado HTML para ruta SPA: ${indexPath}`);
    });

    // --- 5. Generar Páginas Estáticas para Secciones ---
    console.log('📄 Generando páginas estáticas para secciones...');
    const sections = [
      { name: 'about', label: 'Acerca de', labelEn: 'About', content: 'La Revista Nacional de Ciencias para Estudiantes es una publicación dedicada a promover la investigación científica entre estudiantes.', contentEn: 'The National Review of Sciences for Students is a publication dedicated to promoting scientific research among students.' },
      { name: 'guidelines', label: 'Guías', labelEn: 'Guidelines', content: 'Guías para autores y revisores de La Revista Nacional de Ciencias para Estudiantes.', contentEn: 'Guidelines for authors and reviewers of The National Review of Sciences for Students.' },
      { name: 'faq', label: 'Preguntas Frecuentes', labelEn: 'Frequently Asked Questions', content: 'Preguntas frecuentes sobre La Revista Nacional de Ciencias para Estudiantes.', contentEn: 'Frequently asked questions about The National Review of Sciences for Students.' },
      { name: 'news', label: 'Noticias', labelEn: 'News', content: 'Últimas noticias de La Revista Nacional de Ciencias para Estudiantes.', contentEn: 'Latest news from The National Review of Sciences for Students.' },
    ];

    sections.forEach(section => {
      const htmlContentEs = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${section.label} - La Revista Nacional de Ciencias para Estudiantes">
  <meta name="keywords" content="${section.label}, La Revista Nacional de Ciencias para Estudiantes">
  <title>${section.label} - La Revista Nacional de Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>${section.label}</h1>
  </header>
  <main>
    <section class="py-8 max-w-7xl mx-auto">
      <p>${section.content}</p>
      <p>Para más información, visita nuestra página principal.</p>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} La Revista Nacional de Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>`;

      const htmlContentEn = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${section.labelEn} - The National Review of Sciences for Students">
  <meta name="keywords" content="${section.labelEn}, The National Review of Sciences for Students">
  <title>${section.labelEn} - The National Review of Sciences for Students</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>${section.labelEn}</h1>
  </header>
  <main>
    <section class="py-8 max-w-7xl mx-auto">
      <p>${section.contentEn}</p>
      <p>For more information, visit our main page.</p>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} The National Review of Sciences for Students</p>
    <a href="/">Back to home</a>
  </footer>
</body>
</html>`;

      const filePathEs = path.join(sectionsOutputDir, `${section.name}.html`);
      fs.writeFileSync(filePathEs, htmlContentEs, 'utf8');
      console.log(`✅ Generado HTML de sección (ES): ${filePathEs}`);
      const filePathEn = path.join(sectionsOutputDir, `${section.name}.EN.html`);
      fs.writeFileSync(filePathEn, htmlContentEn, 'utf8');
      console.log(`✅ Generado HTML de sección (EN): ${filePathEn}`);
    });

    // --- 6. Generar Sitemap ---
    console.log('🗺️ Generando sitemap.xml...');
    const sitemapContent = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
<!-- Created for La Revista Nacional de Ciencias para Estudiantes -->
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
${articles.map(article => `
<url>
  <loc>${domain}/articles/articulo${article.numeroArticulo}.html</loc>
  <lastmod>${article.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
<url>
  <loc>${article.pdf}</loc>
  <lastmod>${article.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>`).join('')}
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
${sections.map(section => `
<url>
  <loc>${domain}/sections/${section.name}.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>
<url>
  <loc>${domain}/sections/${section.name}.EN.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>`).join('')}
${spaRoutes.map(route => `
<url>
  <loc>${domain}${route}/</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>`).join('')}
</urlset>`.replace(/^\s*\n/gm, '');
    fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
    console.log(`✅ Generado sitemap: ${sitemapPath}`);

    // --- 7. Generar robots.txt ---
    console.log('🤖 Generando robots.txt...');
    const robotsContent = `
User-agent: *
Allow: /articles/
Allow: /Articles/
Allow: /news/
Allow: /team/
Allow: /sections/
Allow: /index.css
Disallow: /search
Disallow: /login
Disallow: /admin
Disallow: /submit
Disallow: /cart
Disallow: /api/
Sitemap: ${domain}/sitemap.xml
    `.trim();
    fs.writeFileSync(robotsPath, robotsContent, 'utf8');
    console.log(`✅ Generado robots.txt: ${robotsPath}`);

    console.log('🎉 ¡Proceso completado con éxito!');

  } catch (err) {
    console.error('❌ Error durante la generación:', err);
    process.exit(1);
  }
})();