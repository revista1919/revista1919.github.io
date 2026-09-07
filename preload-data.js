// preload-data.js
const fs = require('fs');
const path = require('path');

function injectPreloadedData() {
  console.log('🔄 Inyectando datos pre-cargados en index.html...');
  
  const distPath = path.join(__dirname, 'dist', 'index.html');
  const articlesPath = path.join(__dirname, 'dist', 'articles.json');
  const volumesPath = path.join(__dirname, 'dist', 'volumes.json');
  
  if (!fs.existsSync(distPath)) {
    console.error('❌ No se encuentra index.html en dist/');
    return;
  }
  
  let html = fs.readFileSync(distPath, 'utf8');
  
  // Inyectar datos de artículos
  if (fs.existsSync(articlesPath)) {
    const articlesData = fs.readFileSync(articlesPath, 'utf8');
    
    const preloadedArticles = `
<script id="preloaded-articles-data" type="application/json">
${articlesData}
</script>`;
    
    // Insertar antes del cierre de </head> o al inicio de <body>
    if (html.includes('</head>')) {
      html = html.replace('</head>', preloadedArticles + '\n</head>');
    } else if (html.includes('<body>')) {
      html = html.replace('<body>', preloadedArticles + '\n<body>');
    } else {
      html = preloadedArticles + '\n' + html;
    }
    
    console.log('✅ Datos de artículos inyectados en index.html');
  } else {
    console.warn('⚠️ No se encontró articles.json en dist/');
  }
  
  // Inyectar datos de volúmenes
  if (fs.existsSync(volumesPath)) {
    const volumesData = fs.readFileSync(volumesPath, 'utf8');
    
    const preloadedVolumes = `
<script id="preloaded-volumes-data" type="application/json">
${volumesData}
</script>`;
    
    if (html.includes('</head>')) {
      html = html.replace('</head>', preloadedVolumes + '\n</head>');
    }
    
    console.log('✅ Datos de volúmenes inyectados en index.html');
  }
  
  fs.writeFileSync(distPath, html, 'utf8');
  console.log('✅ index.html actualizado con datos pre-cargados');
}

// Ejecutar
injectPreloadedData();