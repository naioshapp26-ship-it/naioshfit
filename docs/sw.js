// Service Worker for Naiosh Fit PWA
// Version bump (v5) — skip caching for /saas routes
const CACHE_NAME = 'naioshfit-v5';
const STATIC_CACHE_NAME = 'naioshfit-static-v5';
const DYNAMIC_CACHE_NAME = 'naioshfit-dynamic-v5';

// Files to cache immediately (App Shell)
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching App Shell');
        // Avoid caching HTML with content that should be no-store; still precache shell
        return cache.addAll(STATIC_FILES.filter((f) => f !== '/index.html' && f !== '/'));
      })
      .catch((error) => {
        console.log('[SW] Precaching failed:', error);
      })
  );
  // Activate updated worker immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('[SW] Removing old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
  );
  return self.clients.claim();
});

// Allow page to tell SW to take control immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-HTTP(S) schemes (e.g., chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // Do not let SW intercept version.json; always go to network
  if (url.pathname === '/version.json') {
    return; // default fetch behavior
  }

  // SaaS signup API — never intercept (POST/GET must hit server directly)
  if (url.pathname.startsWith('/saas/')) {
    return;
  }

  // Handle API requests with Network First strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        if (request.method === 'GET' && networkResponse.ok) {
          try {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            // Only put once (clone exactly once)
            await cache.put(request, networkResponse.clone());
          } catch (cacheErr) {
            console.log('[SW] Failed to cache API response:', cacheErr);
          }
        }
        return networkResponse;
      } catch (err) {
        if (request.method === 'GET') {
          const cached = await caches.match(request);
          if (cached) return cached;
        }
        // Re-throw to surface in console for diagnostics
        throw err;
      }
    })());
    return;
  }

  // Handle static assets with Cache First strategy
  event.respondWith((async () => {
    try {
      const cached = await caches.match(request);
      if (cached) return cached;

      const networkResponse = await fetch(request);
      if (!networkResponse || !networkResponse.ok || networkResponse.type !== 'basic') {
        return networkResponse;
      }

      // Cache only GET requests and avoid browser extension / opaque requests
      if (request.method === 'GET' && !request.url.startsWith('chrome-extension:')) {
        try {
          const cache = await caches.open(DYNAMIC_CACHE_NAME);
          // Avoid caching HTML documents explicitly (should be no-store)
          const ct = networkResponse.headers.get('Content-Type') || '';
          if (!ct.includes('text/html')) {
            await cache.put(request, networkResponse.clone());
          }
        } catch (cacheErr) {
          console.log('[SW] Failed to cache static asset:', cacheErr);
        }
      }
      return networkResponse;
    } catch (err) {
      // Offline fallback for navigation requests
      if (request.mode === 'navigate') {
        const offline = await caches.match('/');
        if (offline) return offline;
      }
      throw err; // Let it appear in console for visibility
    }
  })());
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'workout-sync') {
    event.waitUntil(syncWorkouts());
  }

  if (event.tag === 'nutrition-sync') {
    event.waitUntil(syncNutrition());
  }
});

// Background sync functions
async function syncWorkouts() {
  try {
    // Get pending workouts from IndexedDB
    const pendingWorkouts = await getPendingData('workouts');

    for (const workout of pendingWorkouts) {
      try {
        await fetch('/api/workouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(workout.data),
        });

        // Remove from pending if successful
        await removePendingData('workouts', workout.id);
      } catch (error) {
        console.log('[SW] Failed to sync workout:', error);
      }
    }
  } catch (error) {
    console.log('[SW] Workout sync failed:', error);
  }
}

async function syncNutrition() {
  try {
    // Get pending nutrition data from IndexedDB
    const pendingNutrition = await getPendingData('nutrition');

    for (const nutrition of pendingNutrition) {
      try {
        await fetch('/api/nutrition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(nutrition.data),
        });

        // Remove from pending if successful
        await removePendingData('nutrition', nutrition.id);
      } catch (error) {
        console.log('[SW] Failed to sync nutrition:', error);
      }
    }
  } catch (error) {
    console.log('[SW] Nutrition sync failed:', error);
  }
}

// IndexedDB helper functions for offline data storage
function getPendingData(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MYounisOffline', 1);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result || []);
      };

      getAllRequest.onerror = () => {
        reject(getAllRequest.error);
      };
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

function removePendingData(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MYounisOffline', 1);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const deleteRequest = store.delete(id);

      deleteRequest.onsuccess = () => {
        resolve();
      };

      deleteRequest.onerror = () => {
        reject(deleteRequest.error);
      };
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}