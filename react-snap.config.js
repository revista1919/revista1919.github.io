const path = require('path');

module.exports = {
  source: 'dist',
  
  // ✅ Rutas REALES que usa tu aplicación (App.js y AppEN.js)
  routes: [
    // Español
    '/',
    '/article',
    '/volume',
    '/collection',
    '/submit',
    '/team',
    '/admin',
    '/about',
    '/aims-scope',
    '/guidelines',
    '/faq',
    '/new',
    '/login',
    '/collection/:folderName',
    '/reviewer-response',
    '/reviewer-onboarding',
    '/reviewer-workspace/:assignmentId',
    
    // Inglés
    '/en',
    '/en/article',
    '/en/volume',
    '/en/collection',
    '/en/submit',
    '/en/team',
    '/en/admin',
    '/en/about',
    '/en/aims-scope',
    '/en/guidelines',
    '/en/faq',
    '/en/new',
    '/en/login',
    '/en/collection/:folderName',
    '/en/reviewer-response',
    '/en/reviewer-onboarding',
    '/en/reviewer-workspace/:assignmentId',
    
    // Portal editorial (rutas anidadas)
    '/login/submit',
    '/login/director',
    '/login/chief',
    '/login/submissions',
    '/login/reviewer-tasks',
    '/login/deskreview',
    '/login/assignment',
    '/login/calendar',
    '/login/reviewer-profile',
    '/login/reviewer-applications',
    '/login/tasks',
    '/login/news',
    '/login/sci-news',
    '/login/admissions',
    '/login/users',
    
    // Portal editorial inglés
    '/en/login/submit',
    '/en/login/director',
    '/en/login/chief',
    '/en/login/submissions',
    '/en/login/reviewer-tasks',
    '/en/login/deskreview',
    '/en/login/assignment',
    '/en/login/calendar',
    '/en/login/reviewer-profile',
    '/en/login/reviewer-applications',
    '/en/login/tasks',
    '/en/login/news',
    '/en/login/sci-news',
    '/en/login/admissions',
    '/en/login/users'
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