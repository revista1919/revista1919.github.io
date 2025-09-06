// generate-all.js actualizado
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');

const articlesCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const teamCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

const outputJson = path.join(__dirname, 'dist', 'articles.json');
const outputHtmlDir = path.join(__dirname, 'dist', 'articles');
const teamOutputHtmlDir = path.join(__dirname, 'dist', 'team');
const sitemapPath = path.join(__dirname, 'dist', 'sitemap.xml');
const robotsPath = path.join(__dirname, 'dist', 'robots.txt');
const domain = 'https://www.revistacienciasestudiantes.com'; // Cambia a 'https://revista1919.github.io' si pruebas localmente

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
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

if (!fs.existsSync(outputHtmlDir)) fs.mkdirSync(outputHtmlDir, { recursive: true });
if (!fs.existsSync(teamOutputHtmlDir)) fs.mkdirSync(teamOutputHtmlDir, { recursive: true });

(async () => {
  try {
    // Procesar artículos (sin cambios)
    const articlesRes = await fetch(articlesCsvUrl);
    if (!articlesRes.ok) throw new Error(`Error descargando CSV de artículos: ${articlesRes.statusText}`);
    const articlesCsvData = await articlesRes.text();
    const articlesParsed = Papa.parse(articlesCsvData, { header: true, skipEmptyLines: true });
    const articles = articlesParsed.data.map(row => ({
      titulo: row['Título'] || 'Sin título',
      autores: row['Autor(es)'] || 'Autor desconocido',
      resumen: row['Resumen'] || 'Resumen no disponible',
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

    // Generar índice de artículos (sin cambios)
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

    // Filtrar miembros: excluir si único rol es "Autor"
    const filteredMembers = teamParsed.data.filter((data) => {
      const memberRoles = (data['Rol en la Revista'] || '')
        .split(';')
        .map((role) => role.trim())
        .filter((role) => role);
      return !(memberRoles.length === 1 && memberRoles[0] === 'Autor');
    });

    // Generar HTML para cada miembro
    filteredMembers.forEach(member => {
      const nombre = member['Nombre'] || 'Miembro desconocido';
      const slug = generateSlug(nombre);
      const roles = (member['Rol en la Revista'] || 'No especificado')
        .split(';')
        .map(r => r.trim())
        .filter(r => r)
        .join(', ') || 'No especificado';
      const descripcion = member['Descripción'] || 'Información no disponible';
      const areas = member['Áreas de interés'] || 'No especificadas';
      const imagen = member['Imagen'] || ''; // Asumiendo que columna G se llama 'Imagen' en headers; ajusta si es diferente

      const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${descripcion.substring(0, 160)}...">
  <meta name="keywords" content="${areas}, ${roles}, Revista Nacional de las Ciencias para Estudiantes">
  <title>${nombre} - Equipo de la Revista Nacional de las Ciencias para Estudiantes</title>
  <link rel="stylesheet" href="/index.css">
  <style>
    body { background-color: #f5f5f5; font-family: serif; color: #333; }
    .profile-container { max-width: 800px; margin: 0 auto; padding: 2rem; background: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    .profile-header { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1rem; }
    @media (min-width: 640px) { .profile-header { flex-direction: row; text-align: left; } }
    .profile-img { width: 150px; height: 150px; border-radius: 50%; object-fit: cover; border: 2px solid #5a3e36; }
    .profile-info { flex: 1; }
    .section { margin-top: 1.5rem; }
    h1, h2 { color: #5a3e36; }
    p { margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <div class="profile-container">
    <div class="profile-header">
      ${imagen ? `<img src="${imagen}" alt="Foto de ${nombre}" class="profile-img">` : ''}
      <div class="profile-info">
        <h1 class="text-3xl font-bold">${nombre}</h1>
        <p class="text-lg font-semibold text-gray-700">${roles}</p>
      </div>
    </div>
    <div class="section">
      <h2 class="text-2xl font-semibold">Descripción</h2>
      <p>${descripcion}</p>
    </div>
    <div class="section">
      <h2 class="text-2xl font-semibold">Áreas de interés</h2>
      <p>${areas}</p>
    </div>
    <footer class="mt-4 text-center">
      <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
      <a href="/" class="text-blue-600 hover:underline">Volver al inicio</a> | <a href="/team" class="text-blue-600 hover:underline">Volver al equipo</a>
    </footer>
  </div>
</body>
</html>
      `.trim();

      const filePath = path.join(teamOutputHtmlDir, `${slug}.html`);
      fs.writeFileSync(filePath, htmlContent, 'utf8');
      console.log(`Generado HTML de miembro: ${filePath}`);
    });

    // Generar sitemap
    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
<!-- Created for Revista Nacional de las Ciencias para Estudiantes -->
<url>
  <loc>${domain}/</loc>
  <lastmod>2025-08-30T03:01:32+00:00</lastmod>
  <changefreq>weekly</changefreq>
  <priority>1.0</priority>
</url>
<url>
  <loc>${domain}/articles/index.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>${articles.map(article => `
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
</url>`).join('')}${filteredMembers.map(member => {
      const slug = generateSlug(member['Nombre']);
      return `
<url>
  <loc>${domain}/team/${slug}.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>`;
    }).join('')}
</urlset>`.replace(/^\s*\n/gm, '');

    fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
    console.log(`Generado sitemap: ${sitemapPath}`);

    // Generar robots.txt
    const robotsContent = `User-agent: Googlebot
Allow: /articles/
Allow: /Articles/
Allow: /team/
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