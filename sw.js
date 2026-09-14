const CACHE_NAME = 'dod-cache-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  
  // Optional: Clean up old cache versions if you change the CACHE_NAME
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Target your heavy game assets: images, audio, and video
  const isAsset = url.pathname.match(/\.(webp|png|jpg|jpeg|mp3|mp4|svg|ico)$/i);

  if (isAsset) {
    // CACHE FIRST STRATEGY FOR ASSETS
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // 1. Return instantly from phone storage if we have it
        if (cachedResponse) {
          return cachedResponse;
        }

        // 2. Otherwise, fetch from the network
        return fetch(event.request).then((networkResponse) => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // 3. Clone the file and save it to the phone's cache for next time
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
          // Fallback if offline and asset isn't cached (prevents crashing)
          return new Response(''); 
        });
      })
    );
  } else {
    // NETWORK FIRST STRATEGY FOR EVERYTHING ELSE (API calls, HTML, JS)
    // This keeps your game logic and matchmaking fresh
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
