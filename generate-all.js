const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.API_GEMINI;
if (!apiKey) {
  console.error('❌ API_GEMINI no configurada. No se realizarán traducciones.');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);

const journalES = 'Revista Nacional de las Ciencias para Estudiantes';
const journalEN = 'The National Review of Sciences for Students';

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

async function translateWithGemini(text) {
  if (!text.trim()) return { es: text, en: text };

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `
You are an expert translator for the academic journal "${journalES}" (English: "${journalEN}"), a global platform dedicated to student-led scientific research and education. This journal promotes academic excellence, accessibility, and collaboration for students worldwide in all scientific fields.

Given this text: "${text.replace(/"/g, '\\"')}"

- Detect the primary language.
- If primarily in Spanish, translate to formal, academic English.
- If primarily in English, translate to formal, academic Spanish.
- Always provide both versions, ensuring accuracy, preserving structure (e.g., lists, bold), and maintaining a professional tone suitable for a student-focused academic journal.
- If the text is mixed or neutral, provide high-quality versions in both languages.
- Output ONLY valid JSON: {"es": "Full Spanish text", "en": "Full English text"}
Do not add any extra text, explanations, or comments.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    return JSON.parse(response);
  } catch (err) {
    console.error('Error con Gemini:', err);
    return { es: text, en: text }; // Fallback
  }
}

if (!fs.existsSync(outputHtmlDir)) fs.mkdirSync(outputHtmlDir, { recursive: true });
if (!fs.existsSync(newsOutputHtmlDir)) fs.mkdirSync(newsOutputHtmlDir, { recursive: true });
if (!fs.existsSync(teamOutputHtmlDir)) fs.mkdirSync(teamOutputHtmlDir, { recursive: true });
if (!fs.existsSync(sectionsOutputDir)) fs.mkdirSync(sectionsOutputDir, { recursive: true });

(async () => {
  try {
    // Procesar artículos (sin cambios, ya tiene abstract en EN)
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
  <meta name="citation_journal_title" content="${journalES}">
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
  <title>${article.titulo} - ${journalES}</title>
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
      <p><strong>APA:</strong> ${article.autores}. (${new Date(article.fecha).getFullYear()}). ${article.titulo}. <em>${journalES}</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</p>
      <p><strong>MLA:</strong> ${article.autores}. "${article.titulo}." <em>${journalES}</em>, vol. ${article.volumen}, no. ${article.numero}, ${new Date(article.fecha).getFullYear()}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</p>
      <p><strong>Chicago:</strong> ${article.autores}. "${article.titulo}." <em>${journalES}</em> ${article.volumen}, no. ${article.numero} (${new Date(article.fecha).getFullYear()}): ${article.primeraPagina}-${article.ultimaPagina}.</p>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${journalES}</p>
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
  <title>Índice de Artículos - ${journalES}</title>
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
    <p>&copy; ${new Date().getFullYear()} ${journalES}</p>
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

    // Traducir noticias en paralelo
    const newsPromises = newsItems.map(async (item) => {
      const [tituloBilingual, cuerpoBilingual] = await Promise.all([
        translateWithGemini(item.titulo),
        translateWithGemini(item.cuerpo),
      ]);
      return { ...item, tituloBilingual, cuerpoBilingual };
    });
    const translatedNews = await Promise.all(newsPromises);

    translatedNews.forEach((newsItem) => {
      const slug = generateSlug(`${newsItem.titulo} ${newsItem.fecha}`);

      // HTML ES
      const htmlContentES = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${newsItem.tituloBilingual.es.substring(0, 160)}...">
  <meta name="keywords" content="noticias, revista ciencias estudiantes, ${newsItem.titulo.replace(/[^a-zA-Z0-9]/g, ' ').substring(0, 100)}">
  <title>${newsItem.tituloBilingual.es} - Noticias - ${journalES}</title>
  <link rel="stylesheet" href="/index.css">
  <style> /* mismo estilo que antes */ </style>
</head>
<body>
  <div class="container">
    <header>
      <a href="/">
        <img src="/logo.png" alt="Logo de ${journalES}" class="logo">
      </a>
      <h1>${newsItem.tituloBilingual.es}</h1>
      <p class="date">Publicado el ${newsItem.fecha}</p>
    </header>
    <main>
      <div class="content ql-editor">
        ${newsItem.cuerpoBilingual.es}
      </div>
    </main>
    <footer>
      <p>&copy; ${new Date().getFullYear()} ${journalES}</p>
      <a href="/sections/news.html">Volver a Noticias</a> | <a href="/">Volver al inicio</a>
    </footer>
  </div>
</body>
</html>`.trim();
      const filePathES = path.join(newsOutputHtmlDir, `${slug}.html`);
      fs.writeFileSync(filePathES, htmlContentES, 'utf8');
      console.log(`Generado HTML ES de noticia: ${filePathES}`);

      // HTML EN
      const htmlContentEN = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${newsItem.tituloBilingual.en.substring(0, 160)}...">
  <meta name="keywords" content="news, student sciences review, ${newsItem.titulo.replace(/[^a-zA-Z0-9]/g, ' ').substring(0, 100)}">
  <title>${newsItem.tituloBilingual.en} - News - ${journalEN}</title>
  <link rel="stylesheet" href="/index.css">
  <style> /* mismo estilo */ </style>
</head>
<body>
  <div class="container">
    <header>
      <a href="/en/">
        <img src="/logo.png" alt="Logo of ${journalEN}" class="logo">
      </a>
      <h1>${newsItem.tituloBilingual.en}</h1>
      <p class="date">Published on ${newsItem.fecha}</p>
    </header>
    <main>
      <div class="content ql-editor">
        ${newsItem.cuerpoBilingual.en}
      </div>
    </main>
    <footer>
      <p>&copy; ${new Date().getFullYear()} ${journalEN}</p>
      <a href="/sections/news.EN.html">Back to News</a> | <a href="/en/">Back to Home</a>
    </footer>
  </div>
</body>
</html>`.trim();
      const filePathEN = path.join(newsOutputHtmlDir, `${slug}.EN.html`);
      fs.writeFileSync(filePathEN, htmlContentEN, 'utf8');
      console.log(`Generado HTML EN de noticia: ${filePathEN}`);
    });

    // Generar índice de noticias ES y EN
    const newsByYear = translatedNews.reduce((acc, item) => {
      const year = new Date(item.fecha).getFullYear() || 'Sin fecha';
      if (!acc[year]) acc[year] = [];
      acc[year].push(item);
      return acc;
    }, {});

    // Índice ES
    let newsIndexContentES = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Índice de Noticias - ${journalES}</title>
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
            <a href="/news/${slug}.html">${item.tituloBilingual.es}</a> (${item.fecha})
          </li>
        `;
        }).join('')}
      </ul>
    </section>
`).join('')}
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${journalES}</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>`.trim();
    const newsIndexPathES = path.join(newsOutputHtmlDir, 'index.html');
    fs.writeFileSync(newsIndexPathES, newsIndexContentES, 'utf8');
    console.log(`Generado índice ES HTML de noticias: ${newsIndexPathES}`);

    // Índice EN
    let newsIndexContentEN = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>News Index - ${journalEN}</title>
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
            <a href="/news/${slug}.EN.html">${item.tituloBilingual.en}</a> (${item.fecha})
          </li>
        `;
        }).join('')}
      </ul>
    </section>
`).join('')}
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${journalEN}</p>
    <a href="/en/">Back to Home</a>
  </footer>
</body>
</html>`.trim();
    const newsIndexPathEN = path.join(newsOutputHtmlDir, 'index.EN.html');
    fs.writeFileSync(newsIndexPathEN, newsIndexContentEN, 'utf8');
    console.log(`Generado índice EN HTML de noticias: ${newsIndexPathEN}`);

    // Procesar equipo
    const teamRes = await fetch(teamCsvUrl);
    if (!teamRes.ok) throw new Error(`Error descargando CSV de equipo: ${teamRes.statusText}`);
    const teamCsvData = await teamRes.text();
    const teamParsed = Papa.parse(teamCsvData, { header: true, skipEmptyLines: true });
    const allMembers = teamParsed.data;

    // Traducir equipo en paralelo
    const teamPromises = allMembers.map(async (member) => {
      const [descripcionBilingual, rolesBilingual, areasBilingual] = await Promise.all([
        translateWithGemini(member['Descripción'] || 'Información no disponible'),
        translateWithGemini(member['Rol en la Revista'] || 'No especificado'),
        translateWithGemini(member['Áreas de interés'] || 'No especificadas'),
      ]);
      return { ...member, descripcionBilingual, rolesBilingual, areasBilingual };
    });
    const translatedTeam = await Promise.all(teamPromises);

    translatedTeam.forEach(member => {
      const nombre = member['Nombre'] || 'Miembro desconocido';
      const slug = generateSlug(nombre);
      const imagen = getImageSrc(member['Imagen'] || '');

      // ES
      const rolesES = member.rolesBilingual.es.split(';').map(r => r.trim()).filter(r => r).join(', ') || 'No especificado';
      const areasES = member.areasBilingual.es.split(';').map(a => a.trim()).filter(a => a);
      const areasTagsHtmlES = areasES.length ? areasES.map(area => `<span class="area-tag">${area}</span>`).join('') : '<p>No especificadas</p>';
      const htmlContentES = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${member.descripcionBilingual.es.substring(0, 160)}...">
  <meta name="keywords" content="${member.areasBilingual.es}, ${rolesES}, ${journalES}">
  <meta name="author" content="${nombre}">
  <title>${nombre} - Equipo de ${journalES}</title>
  <link rel="stylesheet" href="/index.css">
  <style> /* mismo estilo que antes */ </style>
</head>
<body>
  <div class="profile-container">
    <div class="profile-header">
      <div class="profile-img-container">
        ${imagen ? `<img src="${imagen}" alt="Foto de ${nombre}" class="profile-img">` : `<div class="profile-img-fallback">Sin Imagen</div>`}
      </div>
      <div class="profile-info">
        <h1>${nombre}</h1>
        <p class="role">${rolesES}</p>
      </div>
    </div>
    <div class="section">
      <h2>Descripción</h2>
      <p>${member.descripcionBilingual.es}</p>
    </div>
    <div class="section">
      <h2>Áreas de interés</h2>
      <div class="areas-tags">
        ${areasTagsHtmlES}
      </div>
    </div>
    <footer>
      <p>&copy; ${new Date().getFullYear()} ${journalES}</p>
      <a href="/">Volver al inicio</a>
    </footer>
  </div>
</body>
</html>`.trim();
      const filePathES = path.join(teamOutputHtmlDir, `${slug}.html`);
      fs.writeFileSync(filePathES, htmlContentES, 'utf8');
      console.log(`Generado HTML ES de miembro: ${filePathES}`);

      // EN
      const rolesEN = member.rolesBilingual.en.split(';').map(r => r.trim()).filter(r => r).join(', ') || 'Not specified';
      const areasEN = member.areasBilingual.en.split(';').map(a => a.trim()).filter(a => a);
      const areasTagsHtmlEN = areasEN.length ? areasEN.map(area => `<span class="area-tag">${area}</span>`).join('') : '<p>Not specified</p>';
      const htmlContentEN = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${member.descripcionBilingual.en.substring(0, 160)}...">
  <meta name="keywords" content="${member.areasBilingual.en}, ${rolesEN}, ${journalEN}">
  <meta name="author" content="${nombre}">
  <title>${nombre} - Team of ${journalEN}</title>
  <link rel="stylesheet" href="/index.css">
  <style> /* mismo estilo */ </style>
</head>
<body>
  <div class="profile-container">
    <div class="profile-header">
      <div class="profile-img-container">
        ${imagen ? `<img src="${imagen}" alt="Photo of ${nombre}" class="profile-img">` : `<div class="profile-img-fallback">No Image</div>`}
      </div>
      <div class="profile-info">
        <h1>${nombre}</h1>
        <p class="role">${rolesEN}</p>
      </div>
    </div>
    <div class="section">
      <h2>Description</h2>
      <p>${member.descripcionBilingual.en}</p>
    </div>
    <div class="section">
      <h2>Areas of Interest</h2>
      <div class="areas-tags">
        ${areasTagsHtmlEN}
      </div>
    </div>
    <footer>
      <p>&copy; ${new Date().getFullYear()} ${journalEN}</p>
      <a href="/en/">Back to Home</a>
    </footer>
  </div>
</body>
</html>`.trim();
      const filePathEN = path.join(teamOutputHtmlDir, `${slug}.EN.html`);
      fs.writeFileSync(filePathEN, htmlContentEN, 'utf8');
      console.log(`Generado HTML EN de miembro: ${filePathEN}`);
    });

    // Generar índice de equipo (team index, aunque no lo tenía, lo agrego para consistencia)
    let teamIndexContentES = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Índice de Equipo - ${journalES}</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>Nuestro Equipo</h1>
    <p>Conoce a los miembros del equipo de ${journalES}.</p>
  </header>
  <main>
    <ul>
      ${translatedTeam.map(member => {
        const slug = generateSlug(member['Nombre']);
        return `
        <li>
          <a href="/team/${slug}.html">${member['Nombre']}</a> - ${member.rolesBilingual.es}
        </li>
        `;
      }).join('')}
    </ul>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${journalES}</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>`.trim();
    const teamIndexPathES = path.join(teamOutputHtmlDir, 'index.html');
    fs.writeFileSync(teamIndexPathES, teamIndexContentES, 'utf8');
    console.log(`Generado índice ES HTML de equipo: ${teamIndexPathES}`);

    let teamIndexContentEN = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Team Index - ${journalEN}</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>Our Team</h1>
    <p>Meet the team members of ${journalEN}.</p>
  </header>
  <main>
    <ul>
      ${translatedTeam.map(member => {
        const slug = generateSlug(member['Nombre']);
        return `
        <li>
          <a href="/team/${slug}.EN.html">${member['Nombre']}</a> - ${member.rolesBilingual.en}
        </li>
        `;
      }).join('')}
    </ul>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${journalEN}</p>
    <a href="/en/">Back to Home</a>
  </footer>
</body>
</html>`.trim();
    const teamIndexPathEN = path.join(teamOutputHtmlDir, 'index.EN.html');
    fs.writeFileSync(teamIndexPathEN, teamIndexContentEN, 'utf8');
    console.log(`Generado índice EN HTML de equipo: ${teamIndexPathEN}`);

    // Generar secciones estáticas bilingües
    const sections = [
      { name: 'about', contentES: 'La Revista Nacional de las Ciencias para Estudiantes es una publicación dedicada a promover la investigación científica entre estudiantes.' },
      { name: 'guidelines', contentES: 'Guías para autores y revisores de la Revista Nacional de las Ciencias para Estudiantes.' },
      { name: 'faq', contentES: 'Preguntas frecuentes sobre la Revista Nacional de las Ciencias para Estudiantes.' },
      { name: 'news', contentES: 'Últimas noticias de la Revista Nacional de las Ciencias para Estudiantes.' },
    ];

    const sectionsPromises = sections.map(async (section) => {
      const labelBilingual = await translateWithGemini(section.name.toUpperCase());
      const contentBilingual = await translateWithGemini(section.contentES);
      return { ...section, labelBilingual, contentBilingual };
    });
    const translatedSections = await Promise.all(sectionsPromises);

    translatedSections.forEach(section => {
      // ES
      const htmlContentES = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${section.labelBilingual.es} - ${journalES}">
  <meta name="keywords" content="${section.labelBilingual.es}, ${journalES}">
  <title>${section.labelBilingual.es} - ${journalES}</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>${section.labelBilingual.es}</h1>
  </header>
  <main>
    <section class="py-8 max-w-7xl mx-auto">
      <p>${section.contentBilingual.es}</p>
      <p>Para más información, visita nuestra página principal.</p>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${journalES}</p>
    <a href="/">Volver al inicio</a>
  </footer>
</body>
</html>`.trim();
      const filePathES = path.join(sectionsOutputDir, `${section.name}.html`);
      fs.writeFileSync(filePathES, htmlContentES, 'utf8');
      console.log(`Generado HTML ES de sección: ${filePathES}`);

      // EN
      const htmlContentEN = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${section.labelBilingual.en} - ${journalEN}">
  <meta name="keywords" content="${section.labelBilingual.en}, ${journalEN}">
  <title>${section.labelBilingual.en} - ${journalEN}</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  <header>
    <h1>${section.labelBilingual.en}</h1>
  </header>
  <main>
    <section class="py-8 max-w-7xl mx-auto">
      <p>${section.contentBilingual.en}</p>
      <p>For more information, visit our main page.</p>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${journalEN}</p>
    <a href="/en/">Back to Home</a>
  </footer>
</body>
</html>`.trim();
      const filePathEN = path.join(sectionsOutputDir, `${section.name}.EN.html`);
      fs.writeFileSync(filePathEN, htmlContentEN, 'utf8');
      console.log(`Generado HTML EN de sección: ${filePathEN}`);
    });

    // Generar sitemap (incluye EN)
    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
<!-- Created for ${journalES} / ${journalEN} -->
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
<url>
  <loc>${domain}/news/index.EN.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
${translatedNews.map(item => {
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
<url>
  <loc>${domain}/team/index.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
<url>
  <loc>${domain}/team/index.EN.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
${translatedTeam.map(member => {
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
${translatedSections.map(section => `
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
</urlset>`.replace(/^\s*\n/gm, '');
    fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
    console.log(`Generado sitemap: ${sitemapPath}`);

    // Generar robots.txt (añadí /en/ por si acaso, pero como son .EN.html, no cambia mucho)
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