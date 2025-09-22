module.exports = {
  crawlDir: './build',
  include: ['/*', '/en/*'], // Prerenderiza todas las rutas
  renderInitialState: true,
  source: 'build/index.html',
  inspect: false,
  minify: true,
  // Rutas específicas para prerenderizar
  crawl: [
    '/',
    '/en/',
    '/en/articles',
    '/en/team',
    '/en/news',
    '/en/about',
    '/en/guidelines',
    '/en/faq'
  ]
};