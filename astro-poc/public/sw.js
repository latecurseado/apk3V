// Tres Valles · Service Worker
// Network-first: cada navegación va a la red. Solo cae a cache cuando
// está offline. Bypass total para Supabase y endpoints externos.
// + Maneja eventos push (Web Push API) y notificationclick para abrir la
//   ruta correcta cuando el usuario toca la notificación.

const CACHE = 'tv-astro-v3';
const PRECACHE = ['/', '/foro', '/explora', '/chat', '/buscar', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(PRECACHE).catch(() => {/* silent */}))
            .then(() => self.skipWaiting())
    );
});

// La app puede pedir que el SW nuevo tome control de inmediato.
self.addEventListener('message', (event) => {
    if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // BYPASS para Supabase + APIs externas + WebSocket realtime
    if (url.hostname.endsWith('.supabase.co') ||
        url.hostname.endsWith('.supabase.io') ||
        url.hostname === 'api.open-meteo.com' ||
        url.hostname === 'i.ytimg.com' ||
        url.hostname === 'www.youtube-nocookie.com' ||
        url.hostname === 'unpkg.com' ||
        url.hostname === 'cdnjs.cloudflare.com') {
        return;
    }

    // CDN tiles del mapa: stale-while-revalidate
    if (url.hostname.endsWith('.basemaps.cartocdn.com')) {
        event.respondWith(
            caches.open(CACHE).then(c =>
                c.match(req).then(cached => {
                    const fresh = fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => cached);
                    return cached || fresh;
                })
            )
        );
        return;
    }

    // Network-first para todo lo demás del propio origen
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(req)
                .then(r => {
                    if (r.ok) {
                        const copy = r.clone();
                        caches.open(CACHE).then(c => c.put(req, copy));
                    }
                    return r;
                })
                .catch(() => caches.match(req).then(c => c || caches.match('/')))
        );
    }
});

/* ============== PUSH NOTIFICATIONS ============== */

self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; }
    catch { try { data = { title: 'Tres Valles', body: event.data ? event.data.text() : '' }; } catch { data = {}; } }

    const title = data.title || 'Tres Valles';
    const options = {
        body: data.body || '',
        icon: data.icon || '/icons/icon-192.png',
        badge: data.badge || '/icons/icon-192.png',
        tag: data.tag || 'tv-push',
        renotify: !!data.renotify,
        data: {
            url: data.url || '/',
            type: data.type || 'generic',
        },
        actions: data.actions || [],
        vibrate: [200, 80, 200],
    };
    if (data.image) options.image = data.image;
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil((async () => {
        const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        // Si ya hay una ventana abierta, navega a la URL
        for (const client of clientsList) {
            try {
                const u = new URL(client.url);
                if (u.origin === self.location.origin) {
                    await client.focus();
                    await client.navigate(targetUrl);
                    return;
                }
            } catch { /* ignore */ }
        }
        // Si no hay ventana, abre una nueva
        await self.clients.openWindow(targetUrl);
    })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
    // El navegador rotó la suscripción · re-suscribir y actualizar backend
    event.waitUntil(
        self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: event.oldSubscription?.options?.applicationServerKey })
            .then(sub => {
                // Notifica a la app abierta para que actualice el endpoint
                return self.clients.matchAll().then(clients => {
                    clients.forEach(c => c.postMessage({ type: 'push-resubscribed', subscription: sub.toJSON() }));
                });
            })
            .catch(err => console.warn('[sw] resubscribe failed:', err))
    );
});
