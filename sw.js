/**
 * Service worker: red primero, caché como respaldo.
 * Así nunca sirve archivos viejos mientras hay conexión, y sin conexión la app abre igual.
 */
const CACHE = 'drafty-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'vendor/motion.js',
  'fonts/MonaspaceArgon-Var.woff2',
  'fonts/MonaspaceNeon-Var.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'js/main.js',
  'js/state.js',
  'js/workspace.js',
  'js/storage.js',
  'js/history.js',
  'js/render.js',
  'js/motion.js',
  'js/dragdrop.js',
  'js/keyboard.js',
  'js/toast.js',
  'js/theme.js',
  'js/tilt.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});
