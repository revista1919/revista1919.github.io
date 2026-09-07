const path = require('path');

module.exports = {
  source: 'dist',
  
  // ✅ Rutas REALES que usa tu aplicación
  routes: [
    // Español
    '/',
    '/article',
    '/volume',
    '/collection',
    '/about',
    '/aims-scope',
    '/guidelines',
    '/faq',
    '/new',
    '/team',
    // Inglés
    '/en',
    '/en/article',
    '/en/volume',
    '/en/collection',
    '/en/about',
    '/en/aims-scope',
    '/en/guidelines',
    '/en/faq',
    '/en/new',
    '/en/team'
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
  
  // ⏰ AUMENTAR EL DELAY PARA QUE CARGUEN LOS DATOS
  delay: 8000,  // 8 segundos para que fetch() complete
  
  waitForNavigation: 'networkidle0',
  
  // 🎯 ESPERAR A QUE LOS DATOS ESTÉN CARGADOS
  waitFor: [
    // Esperar a que la lista de artículos esté visible
    {
      selector: '.border-t.border-gray-300',  // Contenedor de artículos
      timeout: 10000
    },
    // Esperar a que no haya spinner de carga
    {
      selector: 'body:not(:has(.animate-spin))',
      timeout: 10000
    }
  ],
  
  // 🚀 EJECUTAR JAVASCRIPT ANTES DE TOMAR SNAPSHOT
  beforeEval: async (page) => {
    // Esperar a que las fetch terminen
    await page.waitForFunction(() => {
      return !document.querySelector('.animate-spin');
    }, { timeout: 10000 });
    
    // Scroll para cargar lazy content
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if(totalHeight >= scrollHeight){
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    // Volver arriba
    await page.evaluate(() => window.scrollTo(0, 0));
  },
  
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
  
  timeout: 60000  // 60 segundos máximo
};