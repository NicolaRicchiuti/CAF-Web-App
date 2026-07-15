// Aumenta questo numero ogni volta che fai un aggiornamento importante!
const CACHE_NAME = 'caf-uci-v6'; 

const ASSETS = [
  './',
  './index.html',
  './script.js',
  './style.css',
  './logoUci.png',
  './manifest.json'
];

// Installa il Service Worker e salva i file
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Forza l'installazione immediata del nuovo aggiornamento
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// ATTIVAZIONE: Elimina la cache vecchia quando cambi il CACHE_NAME
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Cache vecchia eliminata:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Gestisce le richieste (pesca dalla cache se c'è, altrimenti va online)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});