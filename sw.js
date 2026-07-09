const CACHE_NAME = 'caf-uci-v1';
const ASSETS = [
  './',
  './index.html',
  './script.js',
  './style.css',
  './logoUci.png',
  './manifest.json'
];

// Installa il Service Worker e salva i file base nella memoria del telefono
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Gestisce le richieste per far caricare l'app all'istante
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});