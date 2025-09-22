const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');

// URLs de los CSVs (mantén las tuyas o usa variables de entorno)
const articlesCsvUrl = process.env.ARTICLES_CSV_URL || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const teamCsvUrl = process.env.TEAM_CSV_URL || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const newsCsvUrl = process.env.NEWS_CSV_URL || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQKnN8qMJcBN8im9Q61o-qElx1jQp5NdS80_B-FakCHrPLXHlQ_FXZWT0o5GVVHAM26l9sjLxsTCNO8/pub?output=csv';

// Configuración del dominio y locales
const domain = 'https://www.revistacienciasestudiantes.com';
const locales = [
  { code: 'es', name: 'Revista Nacional de las Ciencias para Estudiantes', dir: 'es' },
  { code: 'en', name: 'National Review of Sciences for Students', dir: 'en' }
];

// Traducciones estáticas para elementos que no vienen del CSV
const translations = {
  es: {
    articles: {
      title: 'Índice de Artículos por Año',
      description: 'Accede a los artículos por año de publicación. Cada enlace lleva a la página del artículo con resumen y PDF.',
      yearLabel: 'Año',
      volNum: 'Vol. {vol}, Núm. {num}',
      publicationDate: 'Fecha de publicación',
      thematicArea: 'Área temática',
      abstract: 'Resumen',
      englishAbstract: 'Abstract (English)',
      downloadPDF: 'Descargar PDF',
      citations: 'Citas',
      backToHome: 'Volver al inicio',
      noDate: 'Sin fecha'
    },
    news: {
      title: 'Índice de Noticias por Año',
      description: 'Accede a las noticias por año de publicación.',
      yearLabel: 'Año',
      publishedOn: 'Publicado el',
      backToNews: 'Volver a Noticias',
      noDate: 'Sin fecha'
    },
    team: {
      title: 'Equipo',
      description: 'Descripción',
      areasOfInterest: 'Áreas de interés',
      noSpecified: 'No especificadas',
      noImage: 'Sin Imagen',
      backToHome: 'Volver al inicio'
    },
    sections: {
      about: 'Acerca de',
      guidelines: 'Guías',
      faq: 'Preguntas Frecuentes',
      news: 'Noticias',
      moreInfo: 'Para más información, visita nuestra página principal.',
      backToHome: 'Volver al inicio'
    }
  },
  en: {
    articles: {
      title: 'Articles Index by Year',
      description: 'Access articles by year of publication. Each link leads to the article page with abstract and PDF.',
      yearLabel: 'Year',
      volNum: 'Vol. {vol}, No. {num}',
      publicationDate: 'Publication Date',
      thematicArea: 'Thematic Area',
      abstract: 'Abstract',
      englishAbstract: 'Resumen (Spanish)',
      downloadPDF: 'Download PDF',
      citations: 'Citations',
      backToHome: 'Back to Home',
      noDate: 'No date'
    },
    news: {
      title: 'News Index by Year',
      description: 'Access news by year of publication.',
      yearLabel: 'Year',
      publishedOn: 'Published on',
      backToNews: 'Back to News',
      noDate: 'No date'
    },
    team: {
      title: 'Team',
      description: 'Description',
      areasOfInterest: 'Areas of Interest',
      noSpecified: 'Not specified',
      noImage: 'No Image',
      backToHome: 'Back to Home'
    },
    sections: {
      about: 'About',
      guidelines: 'Guidelines',
      faq: 'Frequently Asked Questions',
      news: 'News',
      moreInfo: 'For more information, visit our main page.',
      backToHome: 'Back to Home'
    }
  }
};

// Funciones utilitarias
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

function decodeContent(content) {
  // Intenta decodificar como Base64; si falla, asume texto plano
  try {
    const binary = atob(content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch (err) {
    console.warn(`No se pudo decodificar Base64, usando texto plano: ${content.substring(0, 50)}...`);
    return content; // Devuelve texto plano si no es Base64 válido
  }
}

// Función principal para generar contenido por locale
async function generateForLocale(localeConfig, articles, newsItems, allMembers) {
  const { code, name, dir } = localeConfig;
  const basePublicDir = path.join(__dirname, 'public', dir);
  const t = translations[code];

  // Crear directorios
  const dirs = [
    path.join(basePublicDir, 'articles'),
    path.join(basePublicDir, 'news'),
    path.join(basePublicDir, 'team'),
    path.join(basePublicDir, 'sections')
  ];

  dirs.forEach(dirPath => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Creado directorio: ${dirPath}`);
    }
  });

  // 1. GENERAR ARTÍCULOS INDIVIDUALES
  console.log(`\n📝 Generando ${articles.length} artículos para ${name} (${code})...`);

  articles.forEach(article => {
    const authorsList = article.autores.split(';').map(a => formatAuthorForCitation(a.trim()));
    const authorMetaTags = authorsList.map(author => 
      `  <meta name="citation_author" content="${author}">`
    ).join('\n');

    // Contenido adaptado por idioma
    const abstractContent = code === 'en' ? (article.englishAbstract || article.resumen) : article.resumen;
    const otherAbstractContent = code === 'en' ? article.resumen : (article.englishAbstract || article.resumen);

    const htmlContent = `<!DOCTYPE html>
<html lang="${code}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${abstractContent.substring(0, 160)}...">
  <meta name="keywords" content="${article.palabras_clave.join(', ')}, ${article.area}">
  <meta name="citation_title" content="${article.titulo}">
${authorMetaTags}
  <meta name="citation_publication_date" content="${article.fecha}">
  <meta name="citation_journal_title" content="${name}">
  <meta name="citation_issn" content="1234-5678">
  <meta name="citation_volume" content="${article.volumen}">
  <meta name="citation_issue" content="${article.numero}">
  <meta name="citation_firstpage" content="${article.primeraPagina}">
  <meta name="citation_lastpage" content="${article.ultimaPagina}">
  <meta name="citation_pdf_url" content="${article.pdf}">
  <meta name="citation_abstract_html_url" content="${domain}/${dir}/articles/articulo${article.numeroArticulo}.html">
  <meta name="citation_abstract" content="${abstractContent}">
  <meta name="citation_keywords" content="${article.palabras_clave.join('; ')}">
  <title>${article.titulo} - ${name}</title>
  <link rel="stylesheet" href="/globals.css">
</head>
<body class="min-h-screen bg-[#f4ece7]">
  <header class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between">
        <a href="/${dir}/" class="flex items-center">
          <img src="/logo.png" alt="Logo ${name}" class="h-12 w-auto">
          <span class="ml-3 text-xl font-bold text-[#5a3e36]">${name}</span>
        </a>
      </div>
    </div>
  </header>
  
  <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <article class="bg-white rounded-lg shadow-md p-8">
      <header class="text-center mb-8">
        <h1 class="text-3xl md:text-4xl font-bold text-[#5a3e36] mb-4">${article.titulo}</h1>
        <h2 class="text-xl text-gray-700 mb-4">${article.autores}</h2>
        <div class="space-y-2 text-sm text-gray-600">
          <p><strong>${t.articles.publicationDate}:</strong> ${article.fecha}</p>
          <p><strong>${t.articles.thematicArea}:</strong> ${article.area}</p>
          <p>Volumen ${article.volumen}, Número ${article.numero}, Páginas ${article.primeraPagina}-${article.ultimaPagina}</p>
        </div>
      </header>

      <section class="mb-8">
        <h2 class="text-2xl font-semibold text-[#5a3e36] mb-4 border-b-2 border-[#f4ece7] pb-2">${t.articles.abstract}</h2>
        <div class="prose max-w-none text-gray-800 leading-relaxed">${abstractContent}</div>
      </section>

      <section class="mb-8">
        <h2 class="text-2xl font-semibold text-[#5a3e36] mb-4 border-b-2 border-[#f4ece7] pb-2">${code === 'en' ? t.articles.englishAbstract : t.articles.englishAbstract}</h2>
        <div class="prose max-w-none text-gray-800 leading-relaxed italic">${otherAbstractContent}</div>
      </section>

      <section class="mb-8 text-center">
        <h2 class="text-2xl font-semibold text-[#5a3e36] mb-4">${t.articles.downloadPDF}</h2>
        <a href="${article.pdf}" 
           class="inline-block bg-[#5a3e36] text-white px-8 py-3 rounded-lg hover:bg-[#7a5c4f] transition-colors duration-200 text-lg font-medium"
           download>
          📄 ${t.articles.downloadPDF}
        </a>
      </section>

      <section>
        <h2 class="text-2xl font-semibold text-[#5a3e36] mb-4 border-b-2 border-[#f4ece7] pb-2">${t.articles.citations}</h2>
        <div class="space-y-4 mt-4">
          <div>
            <h3 class="font-semibold text-gray-800 mb-2">APA:</h3>
            <p class="text-sm text-gray-700 bg-gray-50 p-3 rounded">${article.autores}. (${new Date(article.fecha).getFullYear()}). <em>${article.titulo}</em>. <strong>${name}</strong>, <em>${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}</em>.</p>
          </div>
          <div>
            <h3 class="font-semibold text-gray-800 mb-2">MLA:</h3>
            <p class="text-sm text-gray-700 bg-gray-50 p-3 rounded">${article.autores}. "${article.titulo}." <strong>${name}</strong>, vol. ${article.volumen}, no. ${article.numero}, ${new Date(article.fecha).getFullYear()}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</p>
          </div>
          <div>
            <h3 class="font-semibold text-gray-800 mb-2">Chicago:</h3>
            <p class="text-sm text-gray-700 bg-gray-50 p-3 rounded">${article.autores}. "${article.titulo}." <strong>${name}</strong> ${article.volumen}, no. ${article.numero} (${new Date(article.fecha).getFullYear()}): ${article.primeraPagina}-${article.ultimaPagina}.</p>
          </div>
        </div>
      </section>
    </article>
  </main>

  <footer class="bg-[#5a3e36] text-white py-8 mt-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <p>&copy; ${new Date().getFullYear()} ${name}. Todos los derechos reservados.</p>
      <p class="mt-2">
        <a href="/${dir}/" class="hover:underline">${t.articles.backToHome}</a>
      </p>
    </div>
  </footer>
</body>
</html>`.trim();

    const filePath = path.join(basePublicDir, 'articles', `articulo${article.numeroArticulo}.html`);
    fs.writeFileSync(filePath, htmlContent, 'utf8');
    console.log(`📄 Generado artículo: ${filePath}`);
  });

  // 2. GENERAR ÍNDICE DE ARTÍCULOS
  console.log(`📋 Generando índice de artículos para ${name}...`);

  const articlesByYear = articles.reduce((acc, article) => {
    const year = new Date(article.fecha).getFullYear() || t.articles.noDate;
    if (!acc[year]) acc[year] = [];
    acc[year].push(article);
    return acc;
  }, {});

  const indexContent = `<!DOCTYPE html>
<html lang="${code}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${t.articles.description}">
  <title>${t.articles.title} - ${name}</title>
  <link rel="stylesheet" href="/globals.css">
</head>
<body class="min-h-screen bg-[#f4ece7]">
  <header class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between">
        <a href="/${dir}/" class="flex items-center">
          <img src="/logo.png" alt="Logo ${name}" class="h-12 w-auto">
          <span class="ml-3 text-xl font-bold text-[#5a3e36]">${name}</span>
        </a>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <header class="text-center mb-12">
      <h1 class="text-4xl md:text-5xl font-bold text-[#5a3e36] mb-4">${t.articles.title}</h1>
      <p class="text-xl text-gray-700 max-w-3xl mx-auto">${t.articles.description}</p>
    </header>

    <div class="space-y-12">
${Object.keys(articlesByYear)
  .filter(year => year !== t.articles.noDate)
  .sort((a, b) => parseInt(b) - parseInt(a))
  .map(year => `
      <section class="bg-white rounded-lg shadow-md p-6">
        <h2 class="text-2xl font-bold text-[#5a3e36] mb-6 border-b-2 border-[#f4ece7] pb-2">${t.articles.yearLabel} ${year}</h2>
        <ul class="space-y-3">
          ${articlesByYear[year].map(article => `
            <li class="border-l-4 border-[#5a3e36] pl-4">
              <a href="/${dir}/articles/articulo${article.numeroArticulo}.html" 
                 class="block p-4 hover:bg-gray-50 rounded transition-colors duration-200">
                <h3 class="font-semibold text-lg text-gray-900 mb-1">${article.titulo}</h3>
                <p class="text-sm text-gray-600">${article.autores}</p>
                <p class="text-sm text-gray-500 mt-1">${t.articles.volNum.replace('{vol}', article.volumen).replace('{num}', article.numero)}</p>
              </a>
            </li>
          `).join('')}
        </ul>
      </section>
    `).join('')}
    </div>

    ${Object.keys(articlesByYear).includes(t.articles.noDate) ? `
    <section class="bg-white rounded-lg shadow-md p-6 mt-12">
      <h2 class="text-2xl font-bold text-[#5a3e36] mb-6 border-b-2 border-[#f4ece7] pb-2">${t.articles.yearLabel} ${t.articles.noDate}</h2>
      <ul class="space-y-3">
        ${articlesByYear[t.articles.noDate].map(article => `
          <li class="border-l-4 border-gray-300 pl-4">
            <a href="/${dir}/articles/articulo${article.numeroArticulo}.html" 
               class="block p-4 hover:bg-gray-50 rounded transition-colors duration-200">
              <h3 class="font-semibold text-lg text-gray-900 mb-1">${article.titulo}</h3>
              <p class="text-sm text-gray-600">${article.autores}</p>
              <p class="text-sm text-gray-500 mt-1">${t.articles.volNum.replace('{vol}', article.volumen).replace('{num}', article.numero)}</p>
            </a>
          </li>
        `).join('')}
      </ul>
    </section>
    ` : ''}
  </main>

  <footer class="bg-[#5a3e36] text-white py-8 mt-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <p>&copy; ${new Date().getFullYear()} ${name}. Todos los derechos reservados.</p>
      <p class="mt-2">
        <a href="/${dir}/" class="hover:underline">${t.articles.backToHome}</a>
      </p>
    </div>
  </footer>
</body>
</html>`.trim();

  const indexPath = path.join(basePublicDir, 'articles', 'index.html');
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  console.log(`📄 Generado índice de artículos: ${indexPath}`);

  // 3. GENERAR NOTICIAS INDIVIDUALES
  console.log(`📰 Generando ${newsItems.length} noticias para ${name}...`);

  newsItems.forEach((newsItem) => {
    const slug = generateSlug(`${newsItem.titulo} ${newsItem.fecha}`);
    const content = decodeContent(newsItem.cuerpo); // Usa función actualizada

    const htmlContent = `<!DOCTYPE html>
<html lang="${code}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${newsItem.titulo.substring(0, 160)}...">
  <meta name="keywords" content="noticias, ${name.toLowerCase()}, ${newsItem.titulo.replace(/[^a-zA-Z0-9]/g, ' ').substring(0, 100)}">
  <title>${newsItem.titulo} - ${t.news.title} - ${name}</title>
  <link rel="stylesheet" href="/globals.css">
</head>
<body class="min-h-screen bg-gradient-to-br from-[#f4ece7] to-[#e8d9c6]">
  <header class="bg-white/90 backdrop-blur-sm border-b shadow-sm">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between">
        <a href="/${dir}/" class="flex items-center">
          <img src="/logo.png" alt="Logo ${name}" class="h-10 w-auto">
          <span class="ml-3 text-lg font-semibold text-[#5a3e36]">${name}</span>
        </a>
      </div>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <article class="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
      <div class="p-8 lg:p-12">
        <header class="text-center mb-8">
          <h1 class="text-3xl lg:text-4xl font-bold text-[#5a3e36] mb-4 leading-tight">${newsItem.titulo}</h1>
          <p class="text-lg text-[#8b6f47] italic">${t.news.publishedOn} ${newsItem.fecha}</p>
        </header>

        <div class="prose prose-lg max-w-none text-[#2d3748] leading-relaxed">
          <div class="ql-editor">${content}</div>
        </div>
      </div>
    </article>
  </main>

  <footer class="bg-[#5a3e36] text-white py-8 mt-12">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <p>&copy; ${new Date().getFullYear()} ${name}</p>
      <div class="mt-4 space-x-4">
        <a href="/${dir}/sections/news.html" class="hover:underline">${t.news.backToNews}</a>
        <span>|</span>
        <a href="/${dir}/" class="hover:underline">${t.news.backToHome}</a>
      </div>
    </div>
  </footer>
</body>
</html>`.trim();

    const filePath = path.join(basePublicDir, 'news', `${slug}.html`);
    fs.writeFileSync(filePath, htmlContent, 'utf8');
    console.log(`📄 Generado noticia: ${filePath}`);
  });

  // 4. GENERAR ÍNDICE DE NOTICIAS
  console.log(`📋 Generando índice de noticias para ${name}...`);

  const newsByYear = newsItems.reduce((acc, item) => {
    const year = new Date(item.fecha).getFullYear() || t.news.noDate;
    if (!acc[year]) acc[year] = [];
    acc[year].push(item);
    return acc;
  }, {});

  const newsIndexContent = `<!DOCTYPE html>
<html lang="${code}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${t.news.description}">
  <title>${t.news.title} - ${name}</title>
  <link rel="stylesheet" href="/globals.css">
</head>
<body class="min-h-screen bg-gradient-to-br from-[#f4ece7] to-[#e8d9c6]">
  <header class="bg-white/90 backdrop-blur-sm border-b shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between">
        <a href="/${dir}/" class="flex items-center">
          <img src="/logo.png" alt="Logo ${name}" class="h-12 w-auto">
          <span class="ml-3 text-xl font-semibold text-[#5a3e36]">${name}</span>
        </a>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <header class="text-center mb-12">
      <h1 class="text-4xl md:text-5xl font-bold text-[#5a3e36] mb-4">${t.news.title}</h1>
      <p class="text-xl text-gray-700 max-w-3xl mx-auto">${t.news.description}</p>
    </header>

    <div class="space-y-12">
${Object.keys(newsByYear)
  .filter(year => year !== t.news.noDate)
  .sort((a, b) => parseInt(b) - parseInt(a))
  .map(year => `
      <section class="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8">
        <h2 class="text-2xl font-bold text-[#5a3e36] mb-6 border-b-2 border-[#f4ece7] pb-2">${t.news.yearLabel} ${year}</h2>
        <div class="grid gap-6 md:grid-cols-2">
          ${newsByYear[year].map(item => {
            const slug = generateSlug(item.titulo + ' ' + item.fecha);
            return `
            <article class="group">
              <a href="/${dir}/news/${slug}.html" class="block p-6 bg-white rounded-lg hover:shadow-md transition-shadow duration-200">
                <h3 class="font-semibold text-lg text-gray-900 group-hover:text-[#5a3e36] mb-2 line-clamp-2">${item.titulo}</h3>
                <p class="text-sm text-gray-500">${item.fecha}</p>
              </a>
            </article>
            `;
          }).join('')}
        </div>
      </section>
    `).join('')}
    </div>
  </main>

  <footer class="bg-[#5a3e36] text-white py-8 mt-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <p>&copy; ${new Date().getFullYear()} ${name}</p>
      <p class="mt-2">
        <a href="/${dir}/" class="hover:underline">${t.news.backToHome}</a>
      </p>
    </div>
  </footer>
</body>
</html>`.trim();

  const newsIndexPath = path.join(basePublicDir, 'news', 'index.html');
  fs.writeFileSync(newsIndexPath, newsIndexContent, 'utf8');
  console.log(`📄 Generado índice de noticias: ${newsIndexPath}`);

  // 5. GENERAR PÁGINAS DE EQUIPO
  console.log(`👥 Generando ${allMembers.length} perfiles de equipo para ${name}...`);

  allMembers.forEach(member => {
    const nombre = member['Nombre'] || (code === 'en' ? 'Unknown Member' : 'Miembro desconocido');
    const slug = generateSlug(nombre);
    const roles = (member['Rol en la Revista'] || (code === 'en' ? 'Not specified' : 'No especificado'))
      .split(';')
      .map(r => r.trim())
      .filter(r => r)
      .join(', ');
    const descripcion = member['Descripción'] || (code === 'en' ? 'Information not available' : 'Información no disponible');
    const areas = (member['Áreas de interés'] || (code === 'en' ? 'Not specified' : 'No especificadas'))
      .split(';')
      .map(a => a.trim())
      .filter(a => a);
    const imagen = getImageSrc(member['Imagen'] || '');

    const areasTagsHtml = areas.length ? 
      areas.map(area => `<span class="inline-block bg-[#2d3748] text-white px-3 py-1 rounded-full text-sm font-medium mr-2 mb-2">${area}</span>`).join('') :
      `<p class="text-gray-500 italic">${t.team.noSpecified}</p>`;

    const htmlContent = `<!DOCTYPE html>
<html lang="${code}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${descripcion.substring(0, 160)}...">
  <meta name="keywords" content="${areas.join(', ')}, ${roles}, ${name}">
  <meta name="author" content="${nombre}">
  <title>${nombre} - ${t.team.title} - ${name}</title>
  <link rel="stylesheet" href="/globals.css">
</head>
<body class="min-h-screen bg-[#f8f9fa]">
  <header class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between">
        <a href="/${dir}/" class="flex items-center">
          <img src="/logo.png" alt="Logo ${name}" class="h-12 w-auto">
          <span class="ml-3 text-xl font-semibold text-[#5a3e36]">${name}</span>
        </a>
      </div>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div class="p-8 lg:p-12 text-center lg:text-left">
        <div class="lg:flex lg:items-center lg:space-x-8 space-y-8 lg:space-y-0">
          <div class="flex-shrink-0">
            ${imagen ? 
              `<img src="${imagen}" alt="Foto de ${nombre}" class="w-48 h-48 rounded-full object-cover border-4 border-[#2b6cb0] mx-auto lg:mx-0">` :
              `<div class="w-48 h-48 rounded-full bg-gray-200 flex items-center justify-center mx-auto lg:mx-0 border-4 border-[#2b6cb0]">
                <span class="text-gray-500 text-lg">${t.team.noImage}</span>
              </div>`
            }
          </div>
          
          <div class="flex-1">
            <h1 class="text-3xl lg:text-4xl font-bold text-[#2b6cb0] mb-3">${nombre}</h1>
            <p class="text-lg text-gray-700 bg-[#edf2f7] inline-block px-4 py-2 rounded-full font-medium mb-6">${roles}</p>
          </div>
        </div>

        <div class="mt-12 space-y-8">
          <section>
            <h2 class="text-2xl font-semibold text-[#2d3748] mb-4 border-b-2 border-gray-200 pb-2">${t.team.description}</h2>
            <p class="text-gray-700 leading-relaxed text-lg">${descripcion}</p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-[#2d3748] mb-4 border-b-2 border-gray-200 pb-2">${t.team.areasOfInterest}</h2>
            <div class="flex flex-wrap gap-2 justify-center lg:justify-start">
              ${areasTagsHtml}
            </div>
          </section>
        </div>
      </div>
    </div>
  </main>

  <footer class="bg-[#5a3e36] text-white py-8 mt-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <p>&copy; ${new Date().getFullYear()} ${name}</p>
      <p class="mt-2">
        <a href="/${dir}/" class="hover:underline">${t.team.backToHome}</a>
      </p>
    </div>
  </footer>
</body>
</html>`.trim();

    const filePath = path.join(basePublicDir, 'team', `${slug}.html`);
    fs.writeFileSync(filePath, htmlContent, 'utf8');
    console.log(`📄 Generado perfil de equipo: ${filePath}`);
  });

  // 6. GENERAR PÁGINAS ESTÁTICAS DE SECCIONES
  console.log(`📄 Generando páginas de secciones para ${name}...`);

  const sections = [
    {
      name: 'about',
      label: t.sections.about,
      content: code === 'en' ? 'We are an independent, peer-reviewed journal created by and for students. Our mission is to foster critical thinking and scientific research among young people through accessible, rigorous, and serious publication.' : 'Somos una revista independiente, revisada por pares, creada por y para estudiantes. Nuestra misión es fomentar el pensamiento crítico y la investigación científica entre jóvenes a través de una publicación accesible, rigurosa y seria.'
    },
    {
      name: 'guidelines',
      label: t.sections.guidelines,
      content: code === 'en' ? 'Learn about our submission guidelines, formatting requirements, and review process.' : 'Conoce nuestras guías de envío, requisitos de formato y proceso de revisión.'
    },
    {
      name: 'faq',
      label: t.sections.faq,
      content: code === 'en' ? 'Find answers to common questions about publishing, submission process, and our editorial policies.' : 'Encuentra respuestas a preguntas comunes sobre publicación, proceso de envío y nuestras políticas editoriales.'
    },
    {
      name: 'news',
      label: t.sections.news,
      content: code === 'en' ? 'Stay updated with the latest news and announcements from our journal.' : 'Mantente al día con las últimas noticias y anuncios de nuestra revista.'
    }
  ];

  sections.forEach(section => {
    const htmlContent = `<!DOCTYPE html>
<html lang="${code}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${section.content.substring(0, 160)}...">
  <title>${section.label} - ${name}</title>
  <link rel="stylesheet" href="/globals.css">
</head>
<body class="min-h-screen bg-[#f4ece7]">
  <header class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between">
        <a href="/${dir}/" class="flex items-center">
          <img src="/logo.png" alt="Logo ${name}" class="h-12 w-auto">
          <span class="ml-3 text-xl font-semibold text-[#5a3e36]">${name}</span>
        </a>
      </div>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="bg-white rounded-2xl shadow-lg p-8 lg:p-12">
      <header class="text-center mb-12">
        <h1 class="text-4xl md:text-5xl font-bold text-[#5a3e36] mb-6">${section.label}</h1>
      </header>
      
      <div class="prose prose-lg max-w-none text-gray-800">
        <p class="text-xl leading-relaxed mb-8">${section.content}</p>
        <p class="text-lg text-gray-600 italic">${t.sections.moreInfo}</p>
      </div>
    </div>
  </main>

  <footer class="bg-[#5a3e36] text-white py-8 mt-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <p>&copy; ${new Date().getFullYear()} ${name}</p>
      <p class="mt-2">
        <a href="/${dir}/" class="hover:underline">${t.sections.backToHome}</a>
      </p>
    </div>
  </footer>
</body>
</html>`.trim();

    const filePath = path.join(basePublicDir, 'sections', `${section.name}.html`);
    fs.writeFileSync(filePath, htmlContent, 'utf8');
    console.log(`📄 Generado sección: ${filePath}`);
  });

  // 7. GENERAR SITEMAP
  console.log(`🗺️ Generando sitemap para ${name}...`);

  const today = new Date().toISOString().split('T')[0];
  let sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  <!-- Generated for ${name} - ${new Date().toLocaleDateString()} -->
  
  <url>
    <loc>${domain}/${dir}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  
  <url>
    <loc>${domain}/${dir}/articles/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  
  ${articles.map(article => `
  <url>
    <loc>${domain}/${dir}/articles/articulo${article.numeroArticulo}.html</loc>
    <lastmod>${article.fecha || today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${article.pdf}</loc>
    <lastmod>${article.fecha || today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  `).join('')}
  
  <url>
    <loc>${domain}/${dir}/news/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  
  ${newsItems.map(item => {
    const slug = generateSlug(item.titulo + ' ' + item.fecha);
    return `
  <url>
    <loc>${domain}/${dir}/news/${slug}.html</loc>
    <lastmod>${item.fecha || today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  `;
  }).join('')}
  
  ${allMembers.map(member => {
    const nombre = member['Nombre'] || 'unknown';
    const slug = generateSlug(nombre);
    return `
  <url>
    <loc>${domain}/${dir}/team/${slug}.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  `;
  }).join('')}
  
  ${sections.map(section => `
  <url>
    <loc>${domain}/${dir}/sections/${section.name}.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  `).join('')}
  
</urlset>`;

  const sitemapPath = path.join(basePublicDir, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemapContent.trim(), 'utf8');
  console.log(`📄 Generado sitemap: ${sitemapPath}`);

  // 8. GENERAR ROBOTS.TXT
  console.log(`🤖 Generando robots.txt para ${name}...`);

  const robotsContent = `User-agent: *
Allow: /${dir}/
Allow: /${dir}/articles/
Allow: /${dir}/Articles/
Allow: /${dir}/news/
Allow: /${dir}/team/
Allow: /${dir}/sections/
Allow: /globals.css
Disallow: /${dir}/search
Disallow: /${dir}/admin*
Disallow: /${dir}/api/

Sitemap: ${domain}/${dir}/sitemap.xml

# Generated for ${name}
# ${new Date().toISOString()}
  `.trim();

  const robotsPath = path.join(basePublicDir, 'robots.txt');
  fs.writeFileSync(robotsPath, robotsContent, 'utf8');
  console.log(`📄 Generado robots.txt: ${robotsPath}`);

  // 9. GENERAR JSON DE DATOS (para uso en Next.js)
  const articlesJsonPath = path.join(basePublicDir, 'articles.json');
  fs.writeFileSync(articlesJsonPath, JSON.stringify(articles, null, 2), 'utf8');
  console.log(`📄 Generado JSON de artículos: ${articlesJsonPath}`);

  const newsJsonPath = path.join(basePublicDir, 'news.json');
  fs.writeFileSync(newsJsonPath, JSON.stringify(newsItems, null, 2), 'utf8');
  console.log(`📄 Generado JSON de noticias: ${newsJsonPath}`);

  const teamJsonPath = path.join(basePublicDir, 'team.json');
  fs.writeFileSync(teamJsonPath, JSON.stringify(allMembers, null, 2), 'utf8');
  console.log(`📄 Generado JSON de equipo: ${teamJsonPath}`);

  console.log(`✅ Completado ${name} (${code}): ${articles.length} artículos, ${newsItems.length} noticias, ${allMembers.length} miembros del equipo`);
}

// Función principal
(async () => {
  console.log('🚀 Iniciando generación de contenido estático multi-idioma...');
  console.log(`📅 ${new Date().toLocaleString()}\n`);

  try {
    // Cargar datos de CSVs
    console.log('📥 Descargando datos de Google Sheets...');

    // Artículos
    const articlesRes = await fetch(articlesCsvUrl);
    if (!articlesRes.ok) throw new Error(`Error descargando CSV de artículos: ${articlesRes.statusText}`);
    const articlesCsvData = await articlesRes.text();
    const articlesParsed = Papa.parse(articlesCsvData, { header: true, skipEmptyLines: true });
    const articles = articlesParsed.data
      .map(row => ({
        titulo: row['Título'] || 'Sin título',
        autores: row['Autor(es)'] || 'Autor desconocido',
        resumen: row['Resumen'] || 'Resumen no disponible',
        englishAbstract: row['Abstract'] || row['Resumen'] || 'English abstract not available',
        pdf: `${domain}/Articles/Articulo${row['Número de artículo']}.pdf`,
        fecha: parseDateFlexible(row['Fecha']),
        volumen: row['Volumen'] || '',
        numero: row['Número'] || '',
        primeraPagina: row['Primera página'] || '',
        ultimaPagina: row['Última página'] || '',
        area: row['Área temática'] || '',
        numeroArticulo: row['Número de artículo'] || '',
        palabras_clave: row['Palabras clave']
          ? row['Palabras clave'].split(/[;,]/).map(k => k.trim()).filter(Boolean)
          : []
      }))
      .filter(article => article.numeroArticulo && article.titulo !== 'Sin título');

    // Noticias
    const newsRes = await fetch(newsCsvUrl);
    if (!newsRes.ok) throw new Error(`Error descargando CSV de noticias: ${newsRes.statusText}`);
    const newsCsvData = await newsRes.text();
    const newsParsed = Papa.parse(newsCsvData, { header: true, skipEmptyLines: true });
    const newsItems = newsParsed.data
      .filter(row => 
        (row["Título"] || "").trim() !== "" && 
        (row["Contenido de la noticia"] || "").trim() !== ""
      )
      .map(row => ({
        titulo: String(row["Título"] ?? ""),
        cuerpo: String(row["Contenido de la noticia"] ?? ""),
        fecha: parseDateFlexible(String(row["Fecha"] ?? "")),
      }));

    // Equipo
    const teamRes = await fetch(teamCsvUrl);
    if (!teamRes.ok) throw new Error(`Error descargando CSV de equipo: ${teamRes.statusText}`);
    const teamCsvData = await teamRes.text();
    const teamParsed = Papa.parse(teamCsvData, { header: true, skipEmptyLines: true });
    const allMembers = teamParsed.data.filter(row => (row['Nombre'] || '').trim() !== '');

    console.log(`✅ Datos cargados: ${articles.length} artículos, ${newsItems.length} noticias, ${allMembers.length} miembros\n`);

    // Generar para cada idioma
    for (const localeConfig of locales) {
      await generateForLocale(localeConfig, articles, newsItems, allMembers);
    }

    // Crear redirects para Netlify (opcional, para GitHub Pages no es necesario pero se genera por compatibilidad)
    const redirectsContent = locales.map(locale => 
      `/${locale.dir} /${locale.dir}/ 301`
    ).join('\n');

    fs.writeFileSync(path.join(__dirname, 'public', '_redirects'), redirectsContent, 'utf8');
    console.log(`📄 Generado _redirects: ${path.join(__dirname, 'public', '_redirects')}`);

    console.log('\n🎉 ¡GENERACIÓN COMPLETADA EXITOSAMENTE!');
    console.log(`📁 Archivos generados en: public/es/ y public/en/`);
    console.log(`🔗 URLs disponibles:`);
    locales.forEach(locale => {
      console.log(`   • ${domain}/${locale.dir}/ (Español/Inglés)`);
      console.log(`   • ${domain}/${locale.dir}/articles/ (Artículos)`);
      console.log(`   • ${domain}/${locale.dir}/news/ (Noticias)`);
      console.log(`   • ${domain}/${locale.dir}/team/ (Equipo)`);
    });
    console.log(`\n🚀 Ejecuta "npm run build" para generar el sitio estático completo`);

  } catch (error) {
    console.error('❌ ERROR durante la generación:', error);
    process.exit(1);
  }
})();