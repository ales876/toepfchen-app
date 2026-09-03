// Offline-First: die App ist ein fester Satz Dateien, also Cache-First mit
// Versions-Bump beim Deploy. Daten liegen in IndexedDB und werden hier nie angefasst.
const CACHE = 'potty-quest-v10';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css',
  './js/app.js', './js/db.js', './js/model.js', './js/stats.js', './js/features.js',
  './js/engine.js', './js/rules.data.js', './js/evidence.data.js', './js/charts.js',
  './js/mascot.js', './js/confetti.js', './js/csv.js', './js/icons.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: sofort aus dem Cache antworten, im Hintergrund erneuern.
// Cache-First waere offline genauso gut, wuerde aber Updates bis zum naechsten
// Versions-Bump verschlucken - inklusive korrigierter Regeltexte.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(e.request);
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => hit || cache.match('./index.html'));
      return hit || network;
    })
  );
});
