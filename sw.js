const CACHE = 'schulverwaltung-v2';
const ASSETS = [
    './',
    './index.html',
    './script.js',
    './style.css',
    './app-icon.png',
    './manifest.json',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Network-First: immer die neueste Version laden, bei Offline auf den Cache zurückfallen.
// So wird nach jedem Deploy automatisch die aktuelle Version ausgeliefert.
self.addEventListener('fetch', e => {
    const req = e.request;

    // Nur eigene GET-Anfragen behandeln; Firebase/CDN/POST normal durchlassen.
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
        return;
    }

    e.respondWith(
        fetch(req)
            .then(res => {
                // Frische Antwort in den Cache legen (für Offline-Nutzung)
                const copy = res.clone();
                caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
                return res;
            })
            .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
    );
});
