const path = require('path');

module.exports = {
  source: 'dist',
  
  // ✅ Añadir rutas en inglés para pre-renderizar
  routes: [
    '/es',
    '/en',
    '/es/news',
    '/es/articles',
    '/es/about',
    '/es/guidelines',
    '/es/faq',
    '/es/team',
    '/es/submit',
    '/es/login',
    '/en/news',
    '/en/articles',
    '/en/about',
    '/en/guidelines',
    '/en/faq',
    '/en/team',
    '/en/submit',
    '/en/login'
  ],
  
  puppeteerExecutablePath: '/usr/bin/chromium-browser',
  
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
  
  delay: 3000,
  waitForNavigation: 'networkidle0',
  
  waitFor: [
    'body > div > div > div.container',
    '.articles',
    '.news-grid',
    '.team-grid',
    { timeout: 5000 }
  ],
  
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
  
  skipThirdPartyRequests: true,
  skipThirdPartyRequestsParallel: true,
  
  crawl: false,
  
  onError: (error, route) => {
    console.warn(`⚠️  Error en ${route}:`, error.message);
  },
  
  verbose: true,
  
  publicPath: '/www.revistacienciasestudiantes.com/',
  
  timeout: 45000
};
