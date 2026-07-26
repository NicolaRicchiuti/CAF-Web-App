// Aumenta questo numero ogni volta che fai un aggiornamento importante!
const CACHE_NAME = 'caf-uci-v8'; 

const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './script.js?v=2.4',
  './admin.js?v=2.4',
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

// GESTIONE RICHIESTE: Pesca dalla cache, ma IGNORA le chiamate al database e alle email
self.addEventListener('fetch', (e) => {
  // 1. REGOLA DI SICUREZZA: Ignora le chiamate API (Resend/Vercel) e Supabase
  // In questo modo i dati in tempo reale non si "incastrano" nella memoria del telefono
  if (e.request.url.includes('supabase.co') || e.request.url.includes('/api/')) {
    return; // Il Service Worker si fa da parte e lascia andare la chiamata su Internet
  }

  // 2. COMPORTAMENTO NORMALE: Cerca nella cache per velocizzare il sito
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});