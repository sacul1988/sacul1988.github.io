const CACHE = 'schulverwaltung-v202606150828';
const ASSETS = [
    './',
    './index.html',
    './grades.js',
    './script.js',
    './style.css',
    './app-icon.png',
    './apple-touch-icon.png',
    './apple-touch-icon-precomposed.png',
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

// Hilfsfunktion für Netzwerk-Timeout (Lie-Fi-Schutz bei schlechter Verbindung)
function fetchWithTimeout(request, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
        fetch(request).then(
            res => {
                clearTimeout(timeoutId);
                resolve(res);
            },
            err => {
                clearTimeout(timeoutId);
                reject(err);
            }
        );
    });
}

// Network-First mit Timeout: immer die neueste Version laden (Lie-Fi geschützt), bei Offline auf den Cache zurückfallen.
// So wird nach jedem Deploy automatisch die aktuelle Version ausgeliefert, ohne bei Hängern zu blockieren.
self.addEventListener('fetch', e => {
    const req = e.request;

    // Nur eigene GET-Anfragen behandeln; Firebase/CDN/POST normal durchlassen.
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
        return;
    }

    e.respondWith(
        fetchWithTimeout(req, 2000)
            .then(res => {
                // Frische Antwort in den Cache legen (für Offline-Nutzung)
                const copy = res.clone();
                caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
                return res;
            })
            .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
    );
});
