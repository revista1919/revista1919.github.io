const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');

const articlesCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const teamCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const outputJson = path.join(__dirname, 'dist', 'articles.json');
const outputHtmlDir = path.join(__dirname, 'dist', 'articles');
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
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
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

if (!fs.existsSync(outputHtmlDir)) fs.mkdirSync(outputHtmlDir, { recursive: true });
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

    // Extraer todos los autores únicos de los artículos
    const allAuthorsSet = new Set();
    articles.forEach(article => {
      if (article.autores) {
        article.autores.split(';').map(a => a.trim()).filter(a => a).forEach(author => allAuthorsSet.add(author));
      }
    });
    const allAuthors = Array.from(allAuthorsSet);

    articles.forEach(article => {
      const authorsList = article.autores.split(';').map(a => a.trim()).map(a => formatAuthorForCitation(a));
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
    <h3>
      ${article.autores.split(';').map(a => {
        const slug = generateSlug(a.trim());
        return `<a href="/team/${slug}.html" class="author-link">${a.trim()}</a>`;
      }).join('; ')}
    </h3>
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

    // Procesar equipo
    const teamRes = await fetch(teamCsvUrl);
    if (!teamRes.ok) throw new Error(`Error descargando CSV de equipo: ${teamRes.statusText}`);
    const teamCsvData = await teamRes.text();
    const teamParsed = Papa.parse(teamCsvData, { header: true, skipEmptyLines: true });
    const teamMembers = teamParsed.data;

    // Crear un mapa de información de autores desde el CSV de equipo
    const authorInfoMap = new Map();
    teamMembers.forEach(member => {
      const nombre = member['Nombre'] || 'Miembro desconocido';
      authorInfoMap.set(nombre, {
        nombre,
        roles: (member['Rol en la Revista'] || 'No especificado').split(';').map(r => r.trim()).filter(r => r),
        descripcion: member['Descripción'] || 'Información no disponible',
        areas: member['Áreas de interés'] || 'No especificadas',
        imagen: getImageSrc(member['Imagen'] || '')
      });
    });

    // Generar páginas para todos los autores
    allAuthors.forEach(author => {
      const info = authorInfoMap.get(author) || {
        nombre: author,
        roles: ['Autor'],
        descripcion: 'Información no disponible',
        areas: 'No especificadas',
        imagen: ''
      };
      const slug = generateSlug(info.nombre);
      const roles = info.roles.join(', ');
      const areasList = info.areas.split(';').map(a => a.trim()).filter(a => a);
      const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${info.descripcion.substring(0, 160)}...">
  <meta name="keywords" content="${info.areas}, ${roles}, Revista Nacional de las Ciencias para Estudiantes">
  <meta name="author" content="${info.nombre}">
  <title>${info.nombre} - Revista Nacional de las Ciencias para Estudiantes</title>
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
        ${info.imagen ? `<img src="${info.imagen}" alt="Foto de ${info.nombre}" class="profile-img">` : `<div class="profile-img-fallback">Sin Imagen</div>`}
      </div>
      <div class="profile-info">
        <h1>${info.nombre}</h1>
        <p class="role">${roles}</p>
      </div>
    </div>
    <div class="section">
      <h2>Descripción</h2>
      <p>${info.descripcion}</p>
    </div>
    <div class="section">
      <h2>Áreas de interés</h2>
      <div class="areas-tags">
        ${areasList.length ? areasList.map(area => `<span class="area-tag">${area}</span>`).join('') : '<p>No especificadas</p>'}
      </div>
    </div>
    <footer>
      <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
      <a href="/">Volver al inicio</a>
    </footer>
  </div>
</body>
</html>
      `.trim();
      const filePath = path.join(teamOutputHtmlDir, `${slug}.html`);
      fs.writeFileSync(filePath, htmlContent, 'utf8');
      console.log(`Generado HTML de autor: ${filePath}`);
    });

    // Filtrar miembros del equipo para la sección "Nuestro Equipo"
    const filteredMembers = teamMembers.filter((data) => {
      const memberRoles = (data['Rol en la Revista'] || '')
        .split(';')
        .map((role) => role.trim())
        .filter((role) => role);
      return !(memberRoles.length === 1 && memberRoles[0] === 'Autor');
    });

    // Generar página de índice del equipo
    const teamIndexContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Nuestro Equipo - Revista Nacional de las Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>Nuestro Equipo</h1>
    <p>Conoce a los miembros del equipo de la Revista Nacional de las Ciencias para Estudiantes.</p>
  </header>
  <main>
    <section>
      <ul>
        ${filteredMembers.map(member => {
          const nombre = member['Nombre'] || 'Miembro desconocido';
          const slug = generateSlug(nombre);
          return `<li><a href="/team/${slug}.html">${nombre}</a> - ${member['Rol en la Revista'] || 'No especificado'}</li>`;
        }).join('')}
      </ul>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>
    `.trim();
    const teamIndexPath = path.join(teamOutputHtmlDir, 'index.html');
    fs.writeFileSync(teamIndexPath, teamIndexContent, 'utf8');
    console.log(`Generado índice HTML del equipo: ${teamIndexPath}`);

    // Generar páginas estáticas para las secciones de la SPA
    const sections = [
      { name: 'about', label: 'Acerca de', content: 'La Revista Nacional de las Ciencias para Estudiantes es una publicación dedicada a promover la investigación científica entre estudiantes.' },
      { name: 'guidelines', label: 'Guías', content: 'Guías para autores y revisores de la Revista Nacional de las Ciencias para Estudiantes.' },
      { name: 'faq', label: 'Preguntas Frecuentes', content: 'Preguntas frecuentes sobre la Revista Nacional de las Ciencias para Estudiantes.' },
      { name: 'news', label: 'Noticias', content: 'Últimas noticias de la Revista Nacional de las Ciencias para Estudiantes.' },
    ];

    sections.forEach(section => {
      const htmlContent = `
<!DOCTYPE html>
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
</html>
      `.trim();
      const filePath = path.join(sectionsOutputDir, `${section.name}.html`);
      fs.writeFileSync(filePath, htmlContent, 'utf8');
      console.log(`Generado HTML de sección: ${filePath}`);
    });

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
  <loc>${domain}/team/index.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
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
${allAuthors.map(author => {
      const slug = generateSlug(author);
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