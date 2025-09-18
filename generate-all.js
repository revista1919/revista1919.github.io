const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');

const articlesCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const teamCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const newsCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQKnN8qMJcBN8im9Q61o-qElx1jQp5NdS80_B-FakCHrPLXHlQ_FXZWT0o5GVVHAM26l9sjLxsTCNO8/pub?output=csv';
const outputJson = path.join(__dirname, 'dist', 'articles.json');
const outputHtmlDir = path.join(__dirname, 'dist', 'articles');
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

function generateSlug(name) {
  if (!name) return '';
  // Convert to lowercase
  name = name.toLowerCase();
  // Normalize accents
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Replace spaces with hyphens
  name = name.replace(/\s+/g, '-');
  // Remove non-alphanumeric except hyphens
  name = name.replace(/[^a-z0-9-]/g, '');
  // Remove multiple hyphens
  name = name.replace(/-+/g, '-');
  // Trim hyphens
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
if (!fs.existsSync(newsOutputHtmlDir)) fs.mkdirSync(newsOutputHtmlDir, { recursive: true });
if (!fs.existsSync(teamOutputHtmlDir)) fs.mkdirSync(teamOutputHtmlDir, { recursive: true });
if (!fs.existsSync(sectionsOutputDir)) fs.mkdirSync(sectionsOutputDir, { recursive: true });

(async () => {
  try {
    // Procesar artículos
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
      palabras_clave: row['Palabras clave']
        ? row['Palabras clave'].split(/[;,]/).map(k => k.trim())
        : []
    }));
    fs.writeFileSync(outputJson, JSON.stringify(articles, null, 2), 'utf8');
    console.log(`✅ Archivo generado: ${outputJson} (${articles.length} artículos)`);

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
  <meta name="citation_journal_title" content="Revista Nacional de las Ciencias para Estudiantes">
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
      <h2>Abstract (English)</h2>
      <p>${article.englishAbstract}</p>
    </section>
    <section>
      <h2>Descargar PDF</h2>
      <a href="${article.pdf}" target="_blank" download>Descargar PDF</a>
    </section>
    <section>
      <h2>Citas</h2>
      <p><strong>APA:</strong> ${article.autores}. (${new Date(article.fecha).getFullYear()}). ${article.titulo}. <em>Revista Nacional de las Ciencias para Estudiantes</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</p>
      <p><strong>MLA:</strong> ${article.autores}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em>, vol. ${article.volumen}, no. ${article.numero}, ${new Date(article.fecha).getFullYear()}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</p>
      <p><strong>Chicago:</strong> ${article.autores}. "${article.titulo}." <em>Revista Nacional de las Ciencias para Estudiantes</em> ${article.volumen}, no. ${article.numero} (${new Date(article.fecha).getFullYear()}): ${article.primeraPagina}-${article.ultimaPagina}.</p>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>
      `.trim();
      const filePath = path.join(outputHtmlDir, `articulo${article.numeroArticulo}.html`);
      fs.writeFileSync(filePath, htmlContent, 'utf8');
      console.log(`Generado HTML de artículo: ${filePath}`);
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
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>
    `.trim();
    const indexPath = path.join(outputHtmlDir, 'index.html');
    fs.writeFileSync(indexPath, indexContent, 'utf8');
    console.log(`Generado índice HTML de artículos: ${indexPath}`);

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
      }));

    newsItems.forEach((newsItem) => {
      const slug = generateSlug(`${newsItem.titulo} ${newsItem.fecha}`);
      const htmlContent = `<!DOCTYPE html>
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
      background: linear-gradient(135deg, #f4ece7 0%, #e8d9c6 100%);
      font-family: 'Merriweather', 'Georgia', serif;
      color: #2d3748;
      margin: 0;
      padding: 0;
      line-height: 1.7;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }
    header {
      text-align: center;
      margin-bottom: 3rem;
      background: rgba(255, 255, 255, 0.9);
      padding: 1.5rem;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .logo {
      width: 80px;
      height: auto;
      margin-bottom: 1rem;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
      transition: transform 0.3s ease;
    }
    .logo:hover {
      transform: scale(1.05);
    }
    h1 {
      color: #5a3e36;
      font-size: 2rem;
      margin: 0 0 0.5rem 0;
      font-weight: 600;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.05);
      line-height: 1.3;
    }
    .date {
      color: #8b6f47;
      font-size: 0.95rem;
      font-style: italic;
      margin: 0;
      letter-spacing: 0.5px;
    }
    main {
      background: rgba(255, 255, 255, 0.95);
      padding: 2rem;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      margin-bottom: 2rem;
    }
    .content {
      font-size: 1.05rem;
      color: #2d3748;
      line-height: 1.8;
    }
    .content p {
      margin-bottom: 1.5rem;
      text-align: justify;
      hyphens: auto;
    }
    .content h2, .content h3 {
      color: #5a3e36;
      margin-top: 2rem;
      margin-bottom: 1rem;
      font-weight: 600;
      border-bottom: 2px solid #f4ece7;
      padding-bottom: 0.5rem;
    }
    .content ol, .content ul {
      margin: 1rem 0;
      padding-left: 2rem;
    }
    .content li {
      margin-bottom: 0.5rem;
    }
    .content strong {
      color: #800020;
    }
    .content a {
      color: #800020;
      text-decoration: underline;
      font-weight: 500;
    }
    .content a:hover {
      color: #5a0015;
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
      margin-top: 2rem;
      padding: 1.5rem;
      color: #8b6f47;
      font-size: 0.9rem;
      background: rgba(255, 255, 255, 0.7);
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
    }
    footer a {
      color: #800020;
      text-decoration: none;
      font-weight: 500;
      margin: 0 1rem;
      transition: color 0.3s ease;
    }
    footer a:hover {
      color: #5a0015;
      text-decoration: underline;
    }
    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }
      h1 {
        font-size: 1.6rem;
      }
      main {
        padding: 1.5rem;
      }
      .logo {
        width: 60px;
      }
    }
    /* Mejoras de legibilidad */
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
        <img src="/logo.png" alt="Logo de la Revista Nacional de las Ciencias para Estudiantes" class="logo">
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
      <a href="/sections/news.html">Volver a Noticias</a> | <a href="/">Volver al inicio</a>
    </footer>
  </div>
</body>
</html>`;
      const filePath = path.join(newsOutputHtmlDir, `${slug}.html`);
      fs.writeFileSync(filePath, htmlContent, 'utf8');
      console.log(`Generado HTML de noticia: ${filePath}`);
    });

    // Generar índice de noticias
    const newsByYear = newsItems.reduce((acc, item) => {
      const year = new Date(item.fecha).getFullYear() || 'Sin fecha';
      if (!acc[year]) acc[year] = [];
      acc[year].push(item);
      return acc;
    }, {});
    let newsIndexContent = `<!DOCTYPE html>
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
</html>`;
    const newsIndexPath = path.join(newsOutputHtmlDir, 'index.html');
    fs.writeFileSync(newsIndexPath, newsIndexContent, 'utf8');
    console.log(`Generado índice HTML de noticias: ${newsIndexPath}`);

    // Procesar equipo (generar HTML para TODOS los miembros)
    const teamRes = await fetch(teamCsvUrl);
    if (!teamRes.ok) throw new Error(`Error descargando CSV de equipo: ${teamRes.statusText}`);
    const teamCsvData = await teamRes.text();
    const teamParsed = Papa.parse(teamCsvData, { header: true, skipEmptyLines: true });
    const allMembers = teamParsed.data; // No filtrar aquí, incluir todos los miembros

    allMembers.forEach(member => {
      const nombre = member['Nombre'] || 'Miembro desconocido';
      const slug = generateSlug(nombre);
      const roles = (member['Rol en la Revista'] || 'No especificado')
        .split(';')
        .map(r => r.trim())
        .filter(r => r)
        .join(', ') || 'No especificado';
      const descripcion = member['Descripción'] || 'Información no disponible';
      const areas = member['Áreas de interés'] || 'No especificadas';
      const areasList = areas.split(';').map(a => a.trim()).filter(a => a);
      const imagen = getImageSrc(member['Imagen'] || '');
      const areasTagsHtml = areasList.length ? areasList.map(area => `<span class="area-tag">${area}</span>`).join('') : '<p>No especificadas</p>';
      const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${descripcion.substring(0, 160)}...">
  <meta name="keywords" content="${areas}, ${roles}, Revista Nacional de las Ciencias para Estudiantes">
  <meta name="author" content="${nombre}">
  <title>${nombre} - Equipo de la Revista Nacional de las Ciencias para Estudiantes</title>
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
        <p class="role">${roles}</p>
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
    <footer>
      <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
      <a href="/">Volver al inicio</a>
    </footer>
  </div>
</body>
</html>`;
      const filePath = path.join(teamOutputHtmlDir, `${slug}.html`);
      fs.writeFileSync(filePath, htmlContent, 'utf8');
      console.log(`Generado HTML de miembro: ${filePath}`);
    });

    // Generar páginas estáticas para las secciones de la SPA
    const sections = [
      { name: 'about', label: 'Acerca de', content: 'La Revista Nacional de las Ciencias para Estudiantes es una publicación dedicada a promover la investigación científica entre estudiantes.' },
      { name: 'guidelines', label: 'Guías', content: 'Guías para autores y revisores de la Revista Nacional de las Ciencias para Estudiantes.' },
      { name: 'faq', label: 'Preguntas Frecuentes', content: 'Preguntas frecuentes sobre la Revista Nacional de las Ciencias para Estudiantes.' },
      { name: 'news', label: 'Noticias', content: 'Últimas noticias de la Revista Nacional de las Ciencias para Estudiantes.' },
    ];

    sections.forEach(section => {
      const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${section.label} - Revista Nacional de las Ciencias para Estudiantes">
  <meta name="keywords" content="${section.label}, Revista Nacional de las Ciencias para Estudiantes">
  <title>${section.label} - Revista Nacional de las Ciencias para Estudiantes</title>
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
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>`;
      const filePath = path.join(sectionsOutputDir, `${section.name}.html`);
      fs.writeFileSync(filePath, htmlContent, 'utf8');
      console.log(`Generado HTML de sección: ${filePath}`);
    });

    // Generar sitemap (incluir TODOS los miembros y noticias)
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
${newsItems.map(item => {
      const slug = generateSlug(item.titulo + ' ' + item.fecha);
      return `
<url>
  <loc>${domain}/news/${slug}.html</loc>
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
</url>`;
    }).join('')}
${sections.map(section => `
<url>
  <loc>${domain}/sections/${section.name}.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>`).join('')}
</urlset>`.replace(/^\s*\n/gm, '');
    fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
    console.log(`Generado sitemap: ${sitemapPath}`);

    // Generar robots.txt
    const robotsContent = `User-agent: Googlebot
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
    console.log(`Generado robots.txt: ${robotsPath}`);

  } catch (err) {
    console.error('❌ Error:', err);
  }
})();