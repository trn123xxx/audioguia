/* ============================================================
   sw.js — Service Worker de Audioguía Personal
   Gestiona caché offline para la app shell (HTML, CSS, JS)
   Los audios se almacenan en IndexedDB, no aquí.
   ============================================================ */

const CACHE_NAME = 'audioguia-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json'
];

/* Instalación: precaché del app shell */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

/* Activación: limpia cachés antiguas */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Fetch: network-first para la API de Supabase, cache-first para el resto */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Las llamadas a Supabase siempre van a la red (necesitan datos frescos) */
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request).catch(() => new Response('Offline', { status: 503 })));
    return;
  }

  /* Para el resto: cache-first con fallback a red */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
