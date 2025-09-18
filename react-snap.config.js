const path = require('path');

module.exports = {
  // Carpeta de salida
  source: 'dist',
  
  // Rutas para pre-renderizar (tus tabs)
  routes: [
    '/',           // Home con tab 'articles'
    '/#news',      // Tab noticias
    '/#about',     // Tab acerca de
    '/#guidelines', // Tab guías
    '/#faq',       // Tab FAQ
    '/#team',      // Tab equipo
    '/#submit',    // Tab enviar artículo
    '/#login'      // Tab login
  ],
  
  // Usar Chromium del sistema
  puppeteerExecutablePath: '/usr/bin/chromium-browser',
  
  // Args optimizados para pre-rendering
  puppeteerArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-web-security',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-client-side-phishing-detection',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-default-browser-check',
    '--safebrowsing-disable-auto-update',
    '--disable-default-apps',
    '--hide-scrollbars',
    '--mute-audio'
  ],
  
  // Esperar carga completa (CSV, etc.)
  delay: 3000,
  waitForNavigation: 'networkidle0',
  
  // Selectores para verificar contenido
  waitFor: [
    'body > div > div > div.container',
    '.articles',
    '.news-grid',
    '.team-grid',
    { timeout: 5000 }
  ],
  
  // HTML optimizado
  inlineCss: true,
  generateIndexHtml: false,
  
  minifyHtml: {
    collapseBooleanAttributes: true,
    decodeEntities: true,
    html5: true,
    minifyCSS: true,
    minifyJS: true,
    processConditionalComments: true,
    removeEmptyAttributes: true,
    removeOptionalTags: true,
    sortAttributes: true,
    sortClasses: false
  },
  
  // Evitar requests de terceros
  skipThirdPartyRequests: true,
  skipThirdPartyRequestsParallel: true,
  
  // No crawling (usamos rutas específicas)
  crawl: false,
  
  // Manejo de errores
  onError: (error, route) => {
    console.warn(`⚠️  Error en ${route}:`, error.message);
    // No falla el build por errores individuales
  },
  
  // Logging
  verbose: true,
  
  // Para GitHub Pages
  publicPath: '/revista1919/',
  
  // Timeout más alto para contenido dinámico
  timeout: 45000
};