const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');

const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const outputJson = './articles.json';
const outputHtmlDir = path.join(__dirname, 'articles');
const sitemapPath = path.join(__dirname, 'sitemap.xml');
const domain = 'https://www.revistacienciasestudiantes.com'; // Cambia si tu dominio es diferente

// ---------- Función robusta para parsear fechas ----------
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

// ---------- Invertir "Nombre Apellido" a "Apellido, Nombre" para citation_author ----------
function formatAuthorForCitation(author) {
  const parts = author.trim().split(' ');
  if (parts.length >= 2) {
    const apellido = parts.pop(); // Última palabra como apellido
    const nombre = parts.join(' ');
    return `${apellido}, ${nombre}`;
  }
  return author; // Si no se puede invertir, deja como está
}

// ---------- Crear carpeta HTML si no existe ----------
if (!fs.existsSync(outputHtmlDir)) fs.mkdirSync(outputHtmlDir);

// ---------- Flujo principal ----------
(async () => {
  try {
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Error descargando CSV: ${res.statusText}`);
    const csvData = await res.text();

    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    const articles = parsed.data.map(row => ({
      titulo: row['Título'] || 'Sin título',
      autores: row['Autor(es)'] || 'Autor desconocido',
      resumen: row['Resumen'] || 'Resumen no disponible',
      pdf: `${domain}/Articles/Articulo${row['Número de artículo']}.pdf`, // Generamos URL absoluta
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

    // ---------- Guardar JSON ----------
    fs.writeFileSync(outputJson, JSON.stringify(articles, null, 2));
    console.log(`✅ Archivo generado: ${outputJson} (${articles.length} artículos)`);

    // ---------- Generar HTML por artículo ----------
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
  <meta name="citation_issn" content="1234-5678"> <!-- Cambia por tu ISSN real si lo tienes -->
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
      `;

      const filePath = path.join(outputHtmlDir, `articulo${article.numeroArticulo}.html`);
      fs.writeFileSync(filePath, htmlContent);
      console.log(`Generado HTML: ${filePath}`);
    });

    // ---------- Generar index.html para navegación por año ----------
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
`;

    Object.keys(articlesByYear).sort().reverse().forEach(year => {
      indexContent += `
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
`;
    });

    indexContent += `
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>
    `;

    const indexPath = path.join(outputHtmlDir, 'index.html');
    fs.writeFileSync(indexPath, indexContent);
    console.log(`Generado índice HTML: ${indexPath}`);

    // ---------- Generar sitemap.xml ----------
    const sitemapContent = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset
      xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
            http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
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
</url>
`).join('')}
</urlset>
    `;

    fs.writeFileSync(sitemapPath, sitemapContent);
    console.log(`Generado sitemap: ${sitemapPath}`);

  } catch (err) {
    console.error('❌ Error:', err);
  }
})();