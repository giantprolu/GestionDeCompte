const CACHE_NAME = 'moneyflow-v2';
const STATIC_CACHE_NAME = 'moneyflow-static-v2';

// Only cache truly static assets, NOT HTML pages
const staticAssets = [
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Install event - cache only static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(staticAssets);
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up ALL old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete any cache that doesn't match current versions
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - Network First strategy for HTML, Cache First for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests - always fetch from network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip external requests (Clerk, Supabase, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip clerk-related requests
  if (url.href.includes('clerk') || 
      url.href.includes('.clerk.') ||
      url.href.includes('accounts.dev')) {
    return;
  }

  // Skip Next.js internal requests that shouldn't be cached
  if (url.pathname.startsWith('/_next/webpack-hmr') ||
      url.pathname.includes('__nextjs') ||
      url.pathname.includes('turbopack')) {
    return;
  }

  // For HTML pages (navigation requests) - ALWAYS Network First
  if (event.request.mode === 'navigate' || 
      event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Don't cache HTML responses - always get fresh
          return response;
        })
        .catch(() => {
          // Only on network failure, try to return a basic offline message
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hors ligne</title></head><body style="font-family: sans-serif; text-align: center; padding: 50px;"><h1>Vous êtes hors ligne</h1><p>Veuillez vérifier votre connexion internet.</p><button onclick="location.reload()">Réessayer</button></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // For static assets (images, fonts, etc.) - Cache First
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // For JS/CSS chunks - Network First with short-lived cache
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful responses for offline use
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Try cache on network failure
          return caches.match(event.request);
        })
    );
    return;
  }

  // Default: Network only, no caching
  event.respondWith(fetch(event.request));
});

// Push notification event
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || '1',
        url: data.url || '/',
      },
      actions: data.actions || [],
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'MoneyFlow', options)
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received.');
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
