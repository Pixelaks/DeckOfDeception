const CACHE_NAME = 'dod-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle standard network requests
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});