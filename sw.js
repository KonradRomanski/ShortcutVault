const BUILD_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = `shortcutvault-${BUILD_VERSION}`;
const VERSION_QUERY = `?v=${encodeURIComponent(BUILD_VERSION)}`;
const INDEX_URL = './index.html';
const APP_SHELL = [
  './',
  INDEX_URL,
  `./styles.css${VERSION_QUERY}`,
  `./data.js${VERSION_QUERY}`,
  `./app.js${VERSION_QUERY}`,
  `./manifest.webmanifest${VERSION_QUERY}`,
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('shortcutvault-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_URL, copy));
          return res;
        })
        .catch(() => caches.match(INDEX_URL).then((cached) => cached || caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(network);
        return cached;
      }

      return network.then((res) => res || caches.match(INDEX_URL));
    }),
  );
});
