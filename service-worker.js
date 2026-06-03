const CACHE_NAME = 'yinpu-search-v5';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './seals.json',
  './icons/apple-touch-icon-180.png',
  './icons/apple-touch-icon-167.png',
  './icons/apple-touch-icon-152.png',
  './icons/apple-touch-icon-120.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// Strategy per resource type. Rationale lives in
// docs/adr/0001-caching-strategy.md.
//
// - network-first: small, mutable, URL-stable data (the seal manifest).
//   Always tries network so updates appear immediately when online,
//   falls back to cache offline.
//
// - stale-while-revalidate (SWR): the HTML document. Serves cached
//   shell instantly, then refreshes in the background so the next
//   visit sees any code changes — no CACHE_NAME bump needed for
//   most updates.
//
// - cache-first (default): immutable URL-addressed assets — seal
//   images, icons, manifest. Once cached, never re-fetched while
//   the cache is valid.

const NETWORK_FIRST = ['/seals.json'];

function isNetworkFirst(url) {
  return NETWORK_FIRST.some(p => url.pathname.endsWith(p));
}

function isStaleWhileRevalidate(request, url) {
  // Top-level page navigations and any .html document.
  return request.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('/');
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (isNetworkFirst(url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isStaleWhileRevalidate(event.request, url)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

function networkFirst(request) {
  return fetch(request)
    .then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return response;
    })
    .catch(() => caches.match(request));
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(cached => {
    const networkFetch = fetch(request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => cached);
    return cached || networkFetch;
  });
}

function cacheFirst(request) {
  return caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      return response;
    }).catch(() => caches.match('./index.html'));
  });
}

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
