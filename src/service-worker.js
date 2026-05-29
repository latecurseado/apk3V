// Tres Valles — Service Worker (network-first)
// Estrategia v60+: NETWORK-FIRST para todo lo del propio origen.
// Razón: cada deploy debe verse al instante. Solo se cae a cache cuando
// la red falla por completo (modo offline). Antes era cache-first y
// causaba que cambios desplegados no se vieran hasta limpiar cache
// manualmente — eso ya no pasa.

const CACHE_VERSION = 'tv-v96';
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './main/css/style.css',
    './main/js/script.js',
    './main/js/supabase-client.js',
    './main/icons/icon-192.png',
    './main/icons/icon-512.png'
];

// ============ INSTALL: precache mínimo (solo el shell) ============
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(PRECACHE_ASSETS).catch(err => {
                console.warn('[SW] precache falló (no bloquea):', err);
            }))
            .then(() => self.skipWaiting())
    );
});

// ============ ACTIVATE: limpia versiones viejas ============
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ============ FETCH: network-first universal ============
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // BYPASS TOTAL para APIs y endpoints autenticados:
    // - Supabase (REST + Auth + Realtime): NUNCA cachear porque las respuestas
    //   dependen del JWT del usuario y cachearlas rompe queries silenciosamente.
    // - Cualquier otra API con auth headers también debe ir directo a la red.
    // Si el SW intercepta estas requests y devuelve cache stale, la conexión
    // queda colgada del lado del cliente — exactamente el bug que tuvimos.
    if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.io')) {
        return; // dejar pasar al fetch nativo del navegador
    }

    // CDN externos (fuentes, iconos): stale-while-revalidate (no afecta deploys propios)
    if (url.origin !== self.location.origin) {
        event.respondWith(staleWhileRevalidate(req));
        return;
    }

    // Mismo origen: network-first SIEMPRE.
    // Si la red responde → guardar en cache + entregar.
    // Si la red falla (offline) → entregar lo que haya en cache.
    // Si no hay cache tampoco → para navegación, fallback a index.html.
    event.respondWith(networkFirst(req));
});

// Network-first: intenta red, cae a cache si falla
async function networkFirst(req) {
    try {
        const res = await fetch(req);
        if (res.ok) {
            const cache = await caches.open(CACHE_VERSION);
            cache.put(req, res.clone()).catch(() => {});
        }
        return res;
    } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Si es navegación SPA y no hay cache del path, entregar index.html
        if (req.mode === 'navigate') {
            const indexCached = await caches.match('./index.html');
            if (indexCached) return indexCached;
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
}

// Para CDN externos: entrega cache de inmediato + actualiza en segundo plano
async function staleWhileRevalidate(req) {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
    }).catch(() => cached);
    return cached || fetchPromise;
}

// Permite forzar la actualización desde la app: postMessage({ type: 'SKIP_WAITING' })
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
