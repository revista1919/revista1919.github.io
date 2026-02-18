const CACHE_NAME = "revista-cache-v1";
const urlsToCache = [
  "/",                  // página principal
  "/index.html",
  "/favicon.ico",
  "/logo.png",
  "/logoEN.png",
  "/logoig.png",
  "/logoyt.png",
  "/main.js",
  "/site.webmanifest"
];

// INSTALACIÓN: guarda en caché los archivos listados
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// ACTIVACIÓN: limpia cachés viejos si cambias versión
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
});

// FETCH: responde con caché si existe, si no, pide a la red
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
