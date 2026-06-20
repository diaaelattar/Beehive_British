const CACHE_NAME = 'beehive2-cache-v1';
const CORE_ASSETS = [
  'index.html',
  'css/style.css',
  'js/data.js',
  'js/data_v3.js',
  'js/app.js',
  'app_logo.png',
  'manifest.json'
];

// Install Event - Pre-cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Pre-caching core assets');
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('Deleting old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Serve from Cache, otherwise fetch and cache dynamically
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Exclude browser extensions or chrome:// URLs
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Return cached version
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(event.request).then(networkResponse => {
        // Validate response
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && !event.request.url.includes('.mp3') && !event.request.url.includes('.pdf')) {
          return networkResponse;
        }

        // Cache newly requested assets (audios, PDFs, etc.) dynamically
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Offline fallback for HTML
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('index.html');
        }
      });
    })
  );
});
