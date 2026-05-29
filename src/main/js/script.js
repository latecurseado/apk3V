// @ts-nocheck
// ==========================================
// TRES VALLES - ARQUITECTURA MODULAR COMPLETA
// ==========================================
// Nota: este archivo es JavaScript puro, no JSX. Los template strings con HTML
// (p.ej. `<div>...`) provocan falsos positivos en el analizador integrado de
// VS Code. La directiva @ts-nocheck de arriba desactiva esa inferencia.

// Generador determinista de directorio de negocios (template).
// Combina tipos × nombres × calles para producir ~150 entradas plausibles.
// TODAS llevan _template: true para que el admin las distinga de datos reales.
function generateBusinessSeed() {
    const groups = [
        { cat: 'Alimentos',      subs: ['Tortillería', 'Panadería', 'Carnicería', 'Pollería', 'Verdulería', 'Frutería', 'Cremería', 'Pastelería', 'Pescadería', 'Refresquería'] },
        { cat: 'Comercio',       subs: ['Abarrotes', 'Ferretería', 'Papelería', 'Tlapalería', 'Boutique', 'Zapatería', 'Casa de Empeño'] },
        { cat: 'Servicios',      subs: ['Taller Mecánico', 'Estética', 'Vulcanizadora', 'Lavandería', 'Refaccionaria', 'Cerrajería', 'Imprenta'] },
        { cat: 'Salud',          subs: ['Farmacia', 'Consultorio', 'Dentista', 'Óptica', 'Veterinaria'] },
        { cat: 'Restaurantes',   subs: ['Restaurante', 'Cafetería', 'Taquería', 'Cocina Económica', 'Mariscos', 'Heladería'] },
        { cat: 'Hospedaje',      subs: ['Hotel', 'Posada'] },
        { cat: 'Transporte',     subs: ['Auto Transporte', 'Sitio de Taxis'] },
        { cat: 'Construcción',   subs: ['Materiales', 'Constructora', 'Carpintería', 'Herrería'] },
        { cat: 'Tecnología',     subs: ['Ciber', 'Reparación de Celulares'] },
        { cat: 'Educación',      subs: ['Escuela Particular', 'Academia'] },
        { cat: 'Recreación',     subs: ['Billar', 'Salón de Eventos'] },
        { cat: 'Agro',           subs: ['Agroquímicos', 'Veterinaria Agrícola', 'Forrajera'] }
    ];
    // Sufijos típicos
    const suffixes = [
        'La Esperanza', 'Don Lupe', 'El Centro', 'San Rafael', 'Tres Valles',
        'La Cuenca', 'El Mirador', 'Doña María', 'El Buen Trato', 'La Bendición', 'San José',
        'La Gloria', 'El Sol', 'Don Pedro', 'Mi Pueblo', 'La Plaza', 'Doña Carmen',
        'El Manantial', 'San Pedro', 'Santa María', 'El Buen Vestir', 'La Bonita',
        'El Pastor', 'Cuencañas', 'El Cerro', 'La Loma', 'Don Roberto', 'La Esquina',
        'El Camino', 'La Costa', 'Frio Tropical', 'Doña Lupita'
    ];
    const streets = [
        'Av. Hidalgo', 'Calle Morelos', 'Av. Independencia', 'Calle Juárez', 'Plaza Principal',
        '5 de Mayo', 'Calle Allende', 'Av. Reforma', 'Constitución', 'Madero',
        '16 de Septiembre', 'Vicente Guerrero', 'Cuauhtémoc', 'Lázaro Cárdenas',
        'Carr. Federal Km 1', 'Carr. Federal Km 2', 'Carr. Federal Km 3', 'Av. Ferrocarril',
        'Calle Zaragoza', 'Niños Héroes'
    ];

    const out = [];
    let id = 1;
    let sufIdx = 0;
    let streetIdx = 0;

    groups.forEach(g => {
        g.subs.forEach(sub => {
            // 2-4 entradas por subtipo según necesidad (tendrá variación)
            const count = 2 + (id % 3);
            for (let i = 0; i < count; i++) {
                const suffix = suffixes[sufIdx++ % suffixes.length];
                const street = streets[streetIdx++ % streets.length];
                const num = ((id * 17) % 200) + 1;
                const phone = `283-555-${String((id * 137) % 10000).padStart(4, '0')}`;
                out.push({
                    id,
                    name: `${sub} ${suffix}`,
                    category: g.cat,
                    address: `${street} ${num}`,
                    phone,
                    _template: true
                });
                id++;
            }
        });
    });
    return out;
}

// ============ HASH DE CONTRASEÑAS ============
// Formato nuevo: "pbkdf2$<iter>$<saltB64>$<hashB64>"  (sal por usuario, 200k iteraciones)
// Formato legacy (60 chars hex): SHA-256(password + "tresvalles_salt_2024") — solo para validar
// usuarios antiguos. Al iniciar sesión correctamente con el formato legacy, se re-hashea
// automáticamente al formato nuevo (ver auth.login y auth.handleGoogle).

const PBKDF2_ITERATIONS = 200000;
const PBKDF2_HASH_LEN = 32; // bytes
const PBKDF2_SALT_LEN = 16; // bytes

function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}
function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}
function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

// Algoritmo legacy (mantenido SOLO para verificación, no para nuevos hashes).
async function legacyHash(password) {
    const data = new TextEncoder().encode(password + 'tresvalles_salt_2024');
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Genera un hash nuevo (PBKDF2). Usar SIEMPRE para crear/actualizar contraseñas.
async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_LEN));
    const keyMaterial = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial, PBKDF2_HASH_LEN * 8
    );
    return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

// Verifica una contraseña contra un hash almacenado, soportando ambos formatos.
async function verifyPassword(password, stored) {
    if (!stored) return false;
    if (typeof stored === 'string' && stored.startsWith('pbkdf2$')) {
        const [, iterStr, saltB64, hashB64] = stored.split('$');
        const iterations = parseInt(iterStr, 10) || PBKDF2_ITERATIONS;
        const salt = base64ToBytes(saltB64);
        const expected = base64ToBytes(hashB64);
        const keyMaterial = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
        );
        const bits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
            keyMaterial, expected.length * 8
        );
        return constantTimeEqual(new Uint8Array(bits), expected);
    }
    // Hash legacy (64 hex chars). Comparación constante en tiempo.
    const legacy = await legacyHash(password);
    if (legacy.length !== stored.length) return false;
    let diff = 0;
    for (let i = 0; i < legacy.length; i++) diff |= legacy.charCodeAt(i) ^ stored.charCodeAt(i);
    return diff === 0;
}

// Evita XSS al interpolar datos de usuario en innerHTML.
function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Escapa para uso DENTRO de un string JS dentro de un atributo HTML (p.ej. onclick="fn('...')").
// El navegador HTML-decodifica el atributo ANTES de pasarlo al parser JS, por lo que escapeHtml
// NO basta: `&#39;` se convierte en `'` y rompe el string. Aquí usamos escapes JS (\xNN) que
// sobreviven al ciclo HTML→JS sin reintroducir caracteres peligrosos.
function escapeJsAttr(value) {
    if (value == null) return '';
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g,  "\\x27")
        .replace(/"/g,  '\\x22')
        .replace(/</g,  '\\x3C')
        .replace(/>/g,  '\\x3E')
        .replace(/&/g,  '\\x26')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Extrae el ID de un video de YouTube de cualquier formato de URL conocido.
function getYouTubeId(url) {
    if (!url) return null;
    const patterns = [
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patterns) {
        const m = String(url).match(p);
        if (m) return m[1];
    }
    return null;
}

// Reemplaza URLs de YouTube en NODOS DE TEXTO por embeds iframe responsivos
// (no toca atributos ni iframes ya existentes para evitar dobles embeds).
// Genera el HTML de la "fachada" de YouTube (Lite Embed).
// Solo descarga la miniatura (~20KB) en lugar del iframe completo (~500KB).
// Click → reemplaza el div por el iframe real con autoplay.
function youtubeFacadeHTML(id, title = '') {
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) return '';
    const safeTitle = (title || 'Reproducir video').replace(/"/g, '&quot;');
    return `<div class="video-embed-wrap">
        <div class="yt-facade" data-yt-id="${safeId}" role="button" aria-label="${safeTitle}" tabindex="0">
            <img src="https://i.ytimg.com/vi/${safeId}/hqdefault.jpg" loading="lazy" decoding="async" alt="${safeTitle}">
            <div class="yt-facade-shadow"></div>
            <button class="yt-facade-play" type="button" aria-label="Reproducir">
                <svg viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19C12.21,47.87,34,48,34,48s21.79-.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"/>
                    <path d="M 45,24 27,14 27,34" fill="#fff"/>
                </svg>
            </button>
        </div>
        <a class="video-fallback" href="https://www.youtube.com/watch?v=${safeId}" target="_blank" rel="noopener noreferrer">
            <i class="fab fa-youtube"></i> Abrir en YouTube ↗
        </a>
    </div>`;
}

// Re-construye los facades de YouTube que el sanitizer haya dejado mutilados
// (sin el <button>+<svg> de play porque esos tags no están en la whitelist).
// Detecta cualquier `.yt-facade` con o sin data-yt-id y le inyecta el botón.
// Si data-yt-id se perdió, lo recupera del src del thumbnail (i.ytimg.com/vi/<ID>/...).
function rehydrateYouTubeFacades(html) {
    if (!html || !html.includes('yt-facade')) return html;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    tpl.content.querySelectorAll('.yt-facade').forEach(facade => {
        let id = facade.getAttribute('data-yt-id');
        if (!id) {
            const img = facade.querySelector('img');
            const m = img?.src.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
            if (m) { id = m[1]; facade.setAttribute('data-yt-id', id); }
        }
        if (!id) return;
        if (!facade.querySelector('.yt-facade-play')) {
            const playHtml = `
                <div class="yt-facade-shadow"></div>
                <button class="yt-facade-play" type="button" aria-label="Reproducir">
                    <svg viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19C12.21,47.87,34,48,34,48s21.79-.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"/>
                        <path d="M 45,24 27,14 27,34" fill="#fff"/>
                    </svg>
                </button>`;
            facade.insertAdjacentHTML('beforeend', playHtml);
        }
        if (!facade.hasAttribute('role')) facade.setAttribute('role', 'button');
        if (!facade.hasAttribute('tabindex')) facade.setAttribute('tabindex', '0');
        if (!facade.querySelector('img')) {
            facade.insertAdjacentHTML('afterbegin',
                `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" loading="lazy" decoding="async" alt="Reproducir video">`);
        }
    });
    return tpl.innerHTML;
}

// Mejora los <video> tags HTML5: wrapper aspect-ratio + botón play overlay
// + toolbar inferior con controles extra (velocidad, subtítulos, PiP, descarga).
// Los controles nativos del navegador (línea de tiempo, volumen, fullscreen)
// siguen disponibles automáticamente con el atributo `controls`.
function enhanceVideoPlayers(html) {
    if (!html || !/<video/i.test(html)) return html;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    tpl.content.querySelectorAll('video').forEach(video => {
        if (video.parentElement?.classList.contains('video-player-wrap')) return;

        video.setAttribute('preload', 'metadata');
        video.setAttribute('playsinline', '');
        video.removeAttribute('autoplay');
        if (!video.hasAttribute('controls')) video.setAttribute('controls', '');

        // Detectar si hay subtítulos en formato simple atributo data-tracks (JSON):
        // [{"src":"...vtt","label":"Español","srclang":"es","default":true}, ...]
        const tracksData = video.getAttribute('data-tracks');
        let hasTracks = false;
        if (tracksData) {
            try {
                const arr = JSON.parse(tracksData);
                if (Array.isArray(arr)) {
                    arr.forEach(t => {
                        const tr = document.createElement('track');
                        tr.kind = t.kind || 'subtitles';
                        tr.src = t.src;
                        tr.label = t.label || 'Subtítulos';
                        tr.srclang = t.srclang || 'es';
                        if (t.default) tr.default = true;
                        video.appendChild(tr);
                        hasTracks = true;
                    });
                }
            } catch (_) {}
        }
        if (video.querySelectorAll('track').length > 0) hasTracks = true;

        // Envolver en wrapper
        const wrap = document.createElement('div');
        wrap.className = 'video-player-wrap';
        const overlay = document.createElement('div');
        overlay.className = 'video-poster-overlay';
        overlay.innerHTML = '<i class="fas fa-play"></i>';
        // Click se captura por event delegation global (.video-player-wrap)

        // Toolbar inferior con controles extra (velocidad, subtítulos, PiP, descarga)
        const toolbar = document.createElement('div');
        toolbar.className = 'video-extra-toolbar';
        toolbar.innerHTML = `
            <div class="vextra-group">
                <button class="vextra-btn" onclick="cycleVideoSpeed(this)" title="Velocidad">
                    <i class="fas fa-gauge-high"></i> <span>1x</span>
                </button>
                ${hasTracks ? `
                <button class="vextra-btn" onclick="toggleVideoSubs(this)" title="Subtítulos / CC">
                    <i class="fas fa-closed-captioning"></i> CC
                </button>` : ''}
            </div>
            <div class="vextra-group">
                <button class="vextra-btn" onclick="togglePiP(this)" title="Picture-in-picture">
                    <i class="fas fa-clone"></i>
                </button>
                <a class="vextra-btn" href="${video.src || '#'}" download title="Descargar video">
                    <i class="fas fa-download"></i>
                </a>
            </div>`;

        video.parentNode.insertBefore(wrap, video);
        wrap.appendChild(video);
        wrap.appendChild(overlay);
        wrap.appendChild(toolbar);
    });
    return tpl.innerHTML;
}

// Activa la reproducción al click en el overlay.
window.activateVideoPlayer = function (wrap) {
    if (!wrap || wrap.classList.contains('playing')) return;
    const video = wrap.querySelector('video');
    if (!video) return;
    wrap.classList.add('playing');
    video.play().catch(err => console.info('[video]', err?.name || err));
};

// Cicla la velocidad: 1x → 1.25 → 1.5 → 2 → 0.5 → 0.75 → 1x
window.cycleVideoSpeed = function (btn) {
    const speeds = [1, 1.25, 1.5, 2, 0.5, 0.75];
    const wrap = btn.closest('.video-player-wrap');
    const video = wrap?.querySelector('video');
    if (!video) return;
    const idx = speeds.indexOf(video.playbackRate);
    const next = speeds[(idx + 1) % speeds.length];
    video.playbackRate = next;
    const span = btn.querySelector('span');
    if (span) span.textContent = next + 'x';
};

// Activa/desactiva subtítulos
window.toggleVideoSubs = function (btn) {
    const wrap = btn.closest('.video-player-wrap');
    const video = wrap?.querySelector('video');
    if (!video || !video.textTracks?.length) return;
    const track = video.textTracks[0];
    const newMode = track.mode === 'showing' ? 'hidden' : 'showing';
    track.mode = newMode;
    btn.classList.toggle('active', newMode === 'showing');
};

// Picture-in-picture
window.togglePiP = function (btn) {
    const wrap = btn.closest('.video-player-wrap');
    const video = wrap?.querySelector('video');
    if (!video) return;
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
    } else if (video.requestPictureInPicture) {
        video.requestPictureInPicture().catch(err => {
            App.ui.toast?.('Tu navegador no soporta picture-in-picture', 'warning');
        });
    } else {
        App.ui.toast?.('Picture-in-picture no disponible', 'warning');
    }
};

// Reemplaza la fachada por el iframe real con autoplay.
window.activateYTFacade = function (el) {
    const id = el?.dataset?.ytId;
    if (!id) return;
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
    el.outerHTML = `<div class="video-embed">
        <iframe src="https://www.youtube-nocookie.com/embed/${safeId}?autoplay=1&rel=0"
                frameborder="0" allowfullscreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
    </div>`;
};

// Event delegation global: cualquier click sobre una fachada YT o un overlay
// de video MP4 lo activa, sin depender de onclick inline (que puede ser
// stripeado por el sanitizer al guardar/leer threads).
document.addEventListener('click', function (e) {
    // Click en fachada de YouTube → activar iframe
    const facade = e.target.closest?.('.yt-facade');
    if (facade && facade.dataset.ytId) {
        e.preventDefault();
        e.stopPropagation();
        window.activateYTFacade(facade);
        return;
    }
    // Click en wrapper de video MP4 (no en los botones de la toolbar) → play
    const wrap = e.target.closest?.('.video-player-wrap');
    if (wrap && !wrap.classList.contains('playing')) {
        // Ignorar clicks en la toolbar de extras
        if (e.target.closest('.video-extra-toolbar')) return;
        const video = wrap.querySelector('video');
        if (video && video.paused) {
            wrap.classList.add('playing');
            video.play().catch(err => console.info('[video]', err?.name || err));
        }
    }
}, false);

// Soportar Enter/Space sobre la fachada para accesibilidad (teclado)
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const facade = e.target.closest?.('.yt-facade');
    if (facade && facade.dataset.ytId) {
        e.preventDefault();
        window.activateYTFacade(facade);
    }
});

function autoEmbedYouTubeInHtml(html) {
    if (!html || !/youtu/i.test(html)) return html;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const ytRe = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&][^\s<]*)?/i;
    const SKIP = new Set(['IFRAME', 'A', 'SCRIPT', 'STYLE', 'CODE', 'PRE']);

    const walk = (node) => {
        const children = [...node.childNodes];
        for (const child of children) {
            if (child.nodeType === 3) {
                const text = child.textContent;
                const m = text.match(ytRe);
                if (!m) continue;
                const before = text.slice(0, m.index);
                const after = text.slice(m.index + m[0].length);
                const id = m[1];
                const tmpl = document.createElement('template');
                tmpl.innerHTML = youtubeFacadeHTML(id);
                const wrapper = tmpl.content.firstElementChild;
                const parent = child.parentNode;
                if (before) parent.insertBefore(document.createTextNode(before), child);
                parent.insertBefore(wrapper, child);
                if (after) {
                    const afterNode = document.createTextNode(after);
                    parent.insertBefore(afterNode, child);
                    // Re-procesar el "after" por si trae más URLs
                    walk(parent);
                }
                child.remove();
                return;
            }
            if (child.nodeType === 1 && !SKIP.has(child.tagName)) walk(child);
        }
    };
    walk(tpl.content);
    return tpl.innerHTML;
}

// Sanitiza HTML rico (del editor): permite formato seguro y media; bloquea scripts, handlers y URLs peligrosas.
function sanitizeRichHtml(html) {
    if (html == null) return '';
    const ALLOWED = {
        B: [], STRONG: [], I: [], EM: [], U: [], S: [], STRIKE: [], BR: [],
        P: ['style'], DIV: ['style', 'class', 'data-yt-id', 'role', 'tabindex', 'aria-label'], SPAN: ['style'],
        H1: [], H2: [], H3: [], H4: [],
        UL: [], OL: [], LI: [],
        BLOCKQUOTE: [],
        IMG: ['src', 'alt', 'style'],
        VIDEO: ['src', 'controls', 'poster', 'style', 'preload', 'playsinline', 'crossorigin', 'data-tracks'],
        SOURCE: ['src', 'type'],
        TRACK:  ['src', 'kind', 'srclang', 'label', 'default'],
        A: ['href', 'target', 'rel', 'class'],
        IFRAME: ['src', 'allowfullscreen', 'frameborder', 'allow'],
        FONT: ['size', 'face', 'color', 'style']
    };

    const isSafeUrl = (url) => /^(https?:\/\/|data:image\/|data:video\/|blob:)/i.test(String(url || ''));
    const isSafeIframeSrc = (url) => /^https:\/\/(www\.youtube\.com\/embed\/|player\.vimeo\.com\/)/i.test(String(url || ''));
    const isSafeStyle = (s) => !/(expression|javascript:|url\(|@import|behavior)/i.test(String(s || ''));

    const tpl = document.createElement('template');
    tpl.innerHTML = html;

    const clean = (node) => {
        const children = Array.from(node.childNodes);
        for (const child of children) {
            if (child.nodeType === 8) { child.remove(); continue; }       // comentarios
            if (child.nodeType !== 1) continue;                            // solo elementos
            const tag = child.tagName;
            clean(child);                                                  // recursivo primero
            if (!ALLOWED[tag]) {
                while (child.firstChild) child.parentNode.insertBefore(child.firstChild, child);
                child.parentNode.removeChild(child);
                continue;
            }
            const allowed = ALLOWED[tag];
            Array.from(child.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                if (name.startsWith('on') || !allowed.includes(name)) {
                    child.removeAttribute(attr.name); return;
                }
                // iframe.src debe pasar el whitelist estricto (YouTube/Vimeo embed)
                if (tag === 'IFRAME' && name === 'src' && !isSafeIframeSrc(attr.value)) {
                    child.removeAttribute(attr.name);
                    return;
                }
                if (tag !== 'IFRAME' && (name === 'src' || name === 'href') && !isSafeUrl(attr.value)) {
                    child.removeAttribute(attr.name);
                }
                if (name === 'style' && !isSafeStyle(attr.value)) {
                    child.removeAttribute(attr.name);
                }
            });
            if (tag === 'VIDEO') {
                child.setAttribute('controls', '');
                child.setAttribute('preload', 'metadata');
            }
            if (tag === 'IFRAME') {
                // Si tras la limpieza el iframe quedó sin src válido, lo quitamos completamente.
                if (!child.getAttribute('src')) {
                    child.remove();
                    return;
                }
                child.setAttribute('allowfullscreen', '');
                child.setAttribute('frameborder', '0');
            }
            if (tag === 'A') {
                child.setAttribute('target', '_blank');
                child.setAttribute('rel', 'noopener noreferrer');
            }
        }
    };

    clean(tpl.content);
    return tpl.innerHTML;
}

// Avatar SVG inline — sustituye via.placeholder.com (deprecado).
const DEFAULT_PFP = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
    '<rect width="48" height="48" fill="#1a1a2e"/>' +
    '<circle cx="24" cy="19" r="8" fill="#3a7bd5"/>' +
    '<path d="M8 44c0-9 7-14 16-14s16 5 16 14" fill="#3a7bd5"/></svg>'
);
const BOT_PFP = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
    '<rect width="48" height="48" fill="#00d2ff"/>' +
    '<text x="24" y="30" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold" fill="#fff">TV</text></svg>'
);

// Mapeo categoría → icono FontAwesome + color (para los marcadores del mapa).
// Si una categoría no está aquí, cae al icono genérico.
const CATEGORY_MARKERS = {
    'Alimentos':    { icon: 'fa-utensils',         color: '#f97316' },
    'Comercio':     { icon: 'fa-bag-shopping',     color: '#3b82f6' },
    'Servicios':    { icon: 'fa-screwdriver-wrench', color: '#8b5cf6' },
    'Salud':        { icon: 'fa-heart-pulse',      color: '#ef4444' },
    'Restaurantes': { icon: 'fa-mug-hot',          color: '#f59e0b' },
    'Hospedaje':    { icon: 'fa-bed',              color: '#06b6d4' },
    'Transporte':   { icon: 'fa-bus',              color: '#22c55e' },
    'Construcción': { icon: 'fa-helmet-safety',    color: '#eab308' },
    'Tecnología':   { icon: 'fa-microchip',        color: '#00d2ff' },
    'Educación':    { icon: 'fa-graduation-cap',   color: '#ec4899' },
    'Recreación':   { icon: 'fa-music',            color: '#a855f7' },
    'Agro':         { icon: 'fa-tractor',          color: '#65a30d' }
};
const DEFAULT_MARKER = { icon: 'fa-location-dot', color: '#64748b' };

// Centro municipal de Tres Valles, Veracruz (referencia geográfica)
const TRES_VALLES_CENTER = [18.237, -96.131];

// Bounds del municipio de Tres Valles (lat/lng SW + NE).
// El usuario no puede hacer pan fuera de esta caja en el mapa.
const TRES_VALLES_BOUNDS = [
    [18.180, -96.180],  // Suroeste (esquina inferior-izquierda)
    [18.295, -96.080]   // Noreste (esquina superior-derecha)
];

// Correo de contacto al que apunta el botón "Enviar un correo" del pie de
// Explora Tres Valles. Para cambiarlo, edita ÚNICAMENTE esta línea.
const CONTACT_EMAIL = 'pymhermidaj@gmail.com';

// Helper: lee y parsea de localStorage de forma segura
function _lsRead(key, defaultVal) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null || raw === 'undefined') return defaultVal;
        return JSON.parse(raw);
    } catch (_) { return defaultVal; }
}

const App = {
    // ========== MÓDULO 1: ESTADO EN MEMORIA ==========
    // Supabase es la fuente de verdad. localStorage es CACHE SECUNDARIO:
    // arrancamos con lo último que vimos para que la página se vea rápido,
    // y bootstrapData() lo reemplaza con datos frescos de Supabase.
    // Si Supabase no responde (offline / RLS), seguimos viendo el cache.
    db: {
        users:         _lsRead('tv_accounts', []),
        threads:       _lsRead('tv_threads', []),
        session:       _lsRead('tv_session', null),
        following:     _lsRead('tv_following', {}),
        bookmarks:     _lsRead('tv_bookmarks', {}),
        blockedUsers:  _lsRead('tv_blocked', {}),
        notifications: _lsRead('tv_notis', []),
        notifyOn:      _lsRead('tv_notify_on', {}),
        mutes:         _lsRead('tv_mutes', {}),
        themes:        localStorage.getItem('tv_theme') || 'cyber-cian',
        gallery:       _lsRead('tv_gallery', []),
        outlets: _lsRead('tv_outlets', [
            { id: 'laretro',  name: 'La Retro Tres Valles', url: 'https://www.facebook.com/laretro3valles/?locale=es_LA', type: 'facebook', verified: true },
            { id: 'elcanero', name: 'El Cañero de La Cuenca', url: 'https://www.facebook.com/p/El-Ca%C3%B1ero-de-La-Cuenca-61551521516190/', type: 'facebook', verified: true }
        ]),
        businesses: (() => {
            const cached = _lsRead('tv_businesses', null);
            if (Array.isArray(cached) && cached.length > 0) return cached;
            return generateBusinessSeed();
        })(),

        // Persiste TODO en localStorage para que el siguiente arranque sea
        // instantáneo. bootstrapData luego sobrescribe con datos frescos de Supabase.
        save() {
            try {
                localStorage.setItem('tv_session', JSON.stringify(this.session));
                if (typeof this.themes === 'string') localStorage.setItem('tv_theme', this.themes);
                localStorage.setItem('tv_accounts', JSON.stringify(this.users));
                localStorage.setItem('tv_threads', JSON.stringify(this.threads));
                localStorage.setItem('tv_following', JSON.stringify(this.following));
                localStorage.setItem('tv_bookmarks', JSON.stringify(this.bookmarks));
                localStorage.setItem('tv_blocked', JSON.stringify(this.blockedUsers));
                localStorage.setItem('tv_notis', JSON.stringify(this.notifications));
                localStorage.setItem('tv_notify_on', JSON.stringify(this.notifyOn));
                localStorage.setItem('tv_mutes', JSON.stringify(this.mutes));
                localStorage.setItem('tv_gallery', JSON.stringify(this.gallery));
                localStorage.setItem('tv_outlets', JSON.stringify(this.outlets));
                localStorage.setItem('tv_businesses', JSON.stringify(this.businesses));
            } catch (e) {
                console.warn('[db.save] localStorage falló:', e?.message || e);
            }
        }
    },

    // El "modo móvil forzado" fue una feature experimental que ya no usamos.
    // Limpiamos el localStorage por si quedó sucio de pruebas anteriores y nos
    // aseguramos de NO aplicar la clase force-mobile-view en ningún caso.
    applyEarlyPrefs() {
        try {
            localStorage.removeItem('tv_force_mobile');
            document.body.classList.remove('force-mobile-view');
        } catch (_) {}
    },

    init() {
        // Aplicar preferencias visuales guardadas
        this.applyEarlyPrefs();

        // Salvavidas: si algún campo del db quedó corrupto en localStorage, lo normalizamos
        if (!Array.isArray(this.db.threads))     this.db.threads = [];
        if (!Array.isArray(this.db.users))       this.db.users = [];
        if (!Array.isArray(this.db.notifications)) this.db.notifications = [];
        if (!Array.isArray(this.db.outlets))     this.db.outlets = [];
        if (typeof this.db.following !== 'object' || !this.db.following)   this.db.following = {};
        if (typeof this.db.bookmarks !== 'object' || !this.db.bookmarks)   this.db.bookmarks = {};
        if (typeof this.db.blockedUsers !== 'object' || !this.db.blockedUsers) this.db.blockedUsers = {};

        // Normalizar TODOS los hilos / comentarios para que likes/comments/replies
        // sean siempre arrays (evita "t.likes.includes is not a function")
        const fixComment = (c) => ({
            ...c,
            likes:   Array.isArray(c.likes)   ? c.likes   : [],
            replies: Array.isArray(c.replies) ? c.replies.map(fixComment) : []
        });
        this.db.threads = this.db.threads.map(t => ({
            ...t,
            likes:     Array.isArray(t.likes)     ? t.likes     : [],
            comments:  Array.isArray(t.comments)  ? t.comments.map(fixComment) : [],
            reactions: (t.reactions && typeof t.reactions === 'object') ? t.reactions : {}
        }));
        this.db.save();

        this.auth.ensureSeedAdmin();
        // Phase 1: arranca el cliente de Supabase y restaura la sesión activa.
        this.auth.bootstrapSupabase();
        // Phase 2: trae threads/comments/likes/reactions desde Supabase y suscribe a realtime.
        this.sb.bootstrapData();
        // Carga las imágenes default de la galería desde gallery-default/manifest.json
        this.gallery?.loadDefaults?.();
        // Carga los videos default desde videos-default/manifest.json
        this.videosDefault?.loadDefaults?.();
        this.ui.updateHeader();
        this.auth.initGoogle();
        this.ui.setupSearch();
        this.ui.refreshThemeLabel?.(this.db.themes || 'cyber-cian');
        this.news.init();
        this.ui.navigate('inicio');
        // Web Share Target — si el usuario llegó desde un "Compartir" externo (Facebook, etc.),
        // espera a que la sesión esté lista y abre el modal de Repostear pre-rellenado.
        setTimeout(() => this.news.handleShareIntent(), 1200);
        console.log('✅ Tres Valles inicializado correctamente · threads:', this.db.threads.length);
    },

    // ========== MÓDULO 2: AUTENTICACIÓN ==========
    auth: {
        // ============================================================
        // Auth respaldado por Supabase. La sesión local en App.db.session
        // es solo una proyección del estado de Supabase para que el resto
        // de la UI (que aún lee de App.db) siga funcionando durante la
        // migración por fases. Phase 1: auth ↔ Supabase. Phase 2: threads.
        // ============================================================

        _profileToSession(profile, supaUser) {
            if (!profile) return null;
            return {
                id: profile.id,
                name: profile.username,
                email: profile.email || supaUser?.email || '',
                birthdate: profile.birthdate || null,
                pfp: profile.pfp || DEFAULT_PFP,
                banner: profile.banner || '',
                bio: profile.bio || '',
                role: profile.role || 'citizen',
                badges: profile.badges || [],
                isGuest: !!profile.is_guest,
                joinDate: profile.created_at,
                isGoogleUser: supaUser?.app_metadata?.provider === 'google',
                online_status: profile.online_status || 'online',
                custom_status: profile.custom_status || '',
                custom_status_emoji: profile.custom_status_emoji || '',
                show_online_status: profile.show_online_status !== false,
                last_seen: profile.last_seen
            };
        },

        // Cachea el profile en App.db.users para que listados/tarjetas
        // que aún leen de App.db sigan resolviendo autores hasta phase 2.
        _cacheProfile(session) {
            if (!session) return;
            const idx = App.db.users.findIndex(u => u.id === session.id);
            if (idx >= 0) App.db.users[idx] = { ...App.db.users[idx], ...session };
            else App.db.users.push({ ...session });
            App.db.save();
        },

        async _loadSessionFromSupabase(supaSession) {
            if (!supaSession?.user) {
                console.warn('[auth] _loadSessionFromSupabase: sin user');
                return;
            }
            const supaUser = supaSession.user;
            console.log('[auth] cargando sesión para user.id =', supaUser.id, '· email =', supaUser.email);

            let { data: profile, error } = await SB.from('profiles').select('*').eq('id', supaUser.id).maybeSingle();

            // FIX: si el profile no existe (típico tras primer login con Google porque
            // el trigger handle_new_user no corrió o tarda), lo creamos manualmente
            // con los datos de Google (email, nombre, foto).
            if (!profile && !error) {
                console.warn('[auth] profile no existe — auto-creando desde Google metadata');
                const meta = supaUser.user_metadata || {};
                const googleName = meta.full_name || meta.name || meta.user_name || (supaUser.email || '').split('@')[0];
                const googlePfp = meta.avatar_url || meta.picture || '';
                // Username único: usa email-prefix con sufijo numérico si chocara
                let baseUsername = (googleName || 'user').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 30) || 'user';
                let finalUsername = baseUsername;
                let counter = 0;
                while (counter < 50) {
                    const { data: existing } = await SB.from('profiles').select('id').eq('username', finalUsername).maybeSingle();
                    if (!existing) break;
                    counter++;
                    finalUsername = baseUsername + counter;
                }
                const { data: created, error: createErr } = await SB.from('profiles').insert({
                    id: supaUser.id,
                    username: finalUsername,
                    email: supaUser.email || '',
                    pfp: googlePfp,
                    is_guest: false,
                    role: 'citizen'
                }).select().single();

                if (createErr) {
                    console.error('[auth] falló crear profile auto:', createErr);
                    // Aún así seguimos — crear sesión mínima con lo que tenemos
                    profile = {
                        id: supaUser.id,
                        username: finalUsername,
                        email: supaUser.email || '',
                        pfp: googlePfp,
                        role: 'citizen',
                        is_guest: false
                    };
                } else {
                    profile = created;
                    console.log('[auth] profile creado para nuevo Google user:', finalUsername);
                    // Marcar como nuevo usuario para mostrar bienvenida
                    profile._is_new_user = true;
                }
            }

            // Detectar si es un usuario reciente (creado en los últimos 60 segundos)
            // — el trigger de Supabase también pudo haberlo creado.
            if (profile?.created_at) {
                const ageSeconds = (Date.now() - new Date(profile.created_at).getTime()) / 1000;
                if (ageSeconds < 60) profile._is_new_user = true;
            }

            if (error) {
                console.error('[auth] error consultando profile:', error);
                // Aún con error de RLS podemos crear sesión local mínima si tenemos el user
                profile = profile || {
                    id: supaUser.id,
                    username: (supaUser.email || 'user').split('@')[0],
                    email: supaUser.email || '',
                    role: 'citizen'
                };
            }

            const session = this._profileToSession(profile, supaUser);
            App.db.session = session;
            App.db.save();
            this._cacheProfile(session);
            console.log('[auth] sesión activa:', session.name, '· role:', session.role,
                '· banner len:', (session.banner || '').length,
                '· profile.banner len:', (profile?.banner || '').length);

            // Forzar dismiss del splash si está visible (caso del redirect post-OAuth)
            const splash = document.getElementById('splash-screen');
            if (splash && !splash.classList.contains('splash-out')) {
                splash.classList.add('splash-out');
                setTimeout(() => splash.remove(), 500);
            }

            // Bienvenida especial para usuarios nuevos (primera vez que entran)
            if (profile?._is_new_user) {
                setTimeout(() => {
                    App.ui.toast?.(`¡Bienvenido a Tres Valles, ${session.name}! 🎉 Ya puedes publicar, comentar y conectar.`, 'success');
                }, 800);
            }

            App.ui.updateHeader?.();
            // Activar chat: cargar conversaciones + suscribir realtime
            App.chat?.refreshConversations?.();
            App.chat?.subscribeRealtime?.();
            // Activar presence: heartbeat + estado online
            App.presence?.start?.();
            // Sincronizar listas de bloqueos/silenciados desde Supabase
            App.social?.syncBlocksMutes?.();
            // Cargar amistades + suscripción realtime
            await App.friends?.refresh?.();
            App.friends?.subscribeRealtime?.();

            // Si el bootstrap ya corrió, refrescar el feed para que el sidebar y posts se vean
            if (App.ui.state?.currentRoute) {
                App.ui.navigate(App.ui.state.currentRoute);
            }
        },

        // Llamado desde App.init(). Recupera sesión guardada y suscribe a cambios.
        async bootstrapSupabase() {
            if (!window.SB) {
                console.warn('[auth] Supabase no disponible — pantallas de login no funcionarán');
                return;
            }

            const { data: { session } } = await SB.auth.getSession();

            // GUARD: si localStorage tiene una sesión local pero Supabase NO tiene
            // ninguna sesión activa, significa que el token expiró o el usuario
            // cerró sesión desde otro lado. Limpiamos el cache local para evitar
            // mostrar un estado "a medias" (con sidebar de logueado pero sin datos).
            if (App.db.session && !session) {
                console.warn('[auth] sesión local pero NO en Supabase — limpiando');
                App.db.session = null;
                App.db.save();
                App.ui.updateHeader?.();
            }
            // GUARD opuesto: si la sesión local está incompleta (sin nombre o id),
            // pero hay sesión válida en Supabase, forzamos un refresh completo.
            if (session && (!App.db.session?.name || !App.db.session?.id)) {
                console.log('[auth] sesión local incompleta — refrescando desde Supabase');
            }

            if (session) await this._loadSessionFromSupabase(session);

            SB.auth.onAuthStateChange(async (event, sess) => {
                if (event === 'PASSWORD_RECOVERY') {
                    // El usuario llegó aquí desde el email de recuperación.
                    // Abrir la vista para fijar nueva contraseña.
                    App.ui.openAuth?.();
                    App.ui.switchAuth?.('reset');
                    App.ui.toast?.('Escribe tu nueva contraseña', 'info');
                    return;
                }
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                    if (sess) await this._loadSessionFromSupabase(sess);
                } else if (event === 'SIGNED_OUT') {
                    App.db.session = null;
                    App.db.save();
                    App.ui.updateHeader?.();
                }
            });
        },

        // Envía el email de recuperación de contraseña.
        async requestPasswordReset() {
            const email = document.getElementById('forgot-email').value.trim();
            const msg = document.getElementById('forgot-msg');
            if (!email) { App.ui.toast('Escribe tu email', 'warning'); return; }
            if (!email.includes('@')) { App.ui.toast('Email inválido', 'warning'); return; }
            if (!window.SB) { App.ui.toast('Supabase no disponible', 'error'); return; }

            const redirectTo = window.location.origin + window.location.pathname;
            const { error } = await SB.auth.resetPasswordForEmail(email, { redirectTo });

            if (error) {
                console.error('[auth] resetPasswordForEmail:', error);
                if (msg) {
                    msg.textContent = 'Error: ' + error.message;
                    msg.className = 'forgot-msg error';
                }
                App.ui.toast('No se pudo enviar el enlace · revisa la consola', 'error');
                return;
            }

            // Por privacidad Supabase no revela si el email existe; siempre asumimos éxito.
            if (msg) {
                msg.innerHTML = `<i class="fas fa-check-circle"></i> Si <b>${email}</b> está registrado, recibirás un enlace en unos minutos.<br><small>Revisa también la carpeta de spam.</small>`;
                msg.className = 'forgot-msg success';
            }
            App.ui.toast('Enlace enviado · revisa tu correo', 'success');
        },

        // ============ PREGUNTAS DE SEGURIDAD + CÓDIGO DE RESPALDO ============
        async _hashAnswer(text) {
            const t = (text || '').toLowerCase().trim();
            if (!t) return '';
            const buf = new TextEncoder().encode('tv-salt-2026:' + t);
            const hash = await crypto.subtle.digest('SHA-256', buf);
            return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        },

        // Genera un código de respaldo aleatorio de 16 caracteres (alfanumérico).
        _generateBackupCode() {
            const arr = new Uint8Array(10);
            crypto.getRandomValues(arr);
            return Array.from(arr).map(b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('').match(/.{1,4}/g).join('-');
        },

        // Guarda preguntas de seguridad (3) + nuevo código de respaldo. Llamado desde Settings.
        async saveSecurityQuestions() {
            if (!App.db.session || !window.SB) return;
            const q1 = document.getElementById('sec-q1')?.value.trim();
            const q2 = document.getElementById('sec-q2')?.value.trim();
            const q3 = document.getElementById('sec-q3')?.value.trim();
            const a1 = document.getElementById('sec-a1')?.value.trim();
            const a2 = document.getElementById('sec-a2')?.value.trim();
            const a3 = document.getElementById('sec-a3')?.value.trim();

            if (!q1 || !q2 || !q3 || !a1 || !a2 || !a3) {
                App.ui.toast('Completa las 3 preguntas y respuestas', 'warning');
                return;
            }

            const [h1, h2, h3] = await Promise.all([this._hashAnswer(a1), this._hashAnswer(a2), this._hashAnswer(a3)]);
            const code = App.ui._generateBackupCode();
            const codeHash = await this._hashAnswer(code);

            const { error } = await SB.from('profiles').update({
                security_q1: q1, security_a1: h1,
                security_q2: q2, security_a2: h2,
                security_q3: q3, security_a3: h3,
                backup_code_hash: codeHash
            }).eq('id', App.db.session.id);

            if (error) {
                console.error('[auth] saveSecurityQuestions:', error);
                if (/column.*security_q1/i.test(error.message || '')) {
                    App.ui.toast('Falta ejecutar supabase-schema-update-9.sql', 'error');
                } else {
                    App.ui.toast('Error guardando: ' + error.message, 'error');
                }
                return;
            }

            // Mostrar el código de respaldo al usuario UNA SOLA VEZ
            App.ui._showBackupCodeModal(code);
        },

        _showBackupCodeModal(code) {
            const html = `
                <div class="modal-content" style="max-width:480px;text-align:center;">
                    <h2 style="color:#22c55e;margin:0 0 12px;"><i class="fas fa-shield-halved"></i> Recuperación configurada</h2>
                    <p style="color:var(--text-dim);margin:0 0 16px;">
                        Guarda este <b>código de respaldo</b> en un lugar seguro. Si olvidas tu contraseña Y tus respuestas, este código es la última forma de recuperar tu cuenta.
                    </p>
                    <div style="font-family:monospace;font-size:1.5rem;letter-spacing:2px;background:rgba(0,210,255,0.1);border:2px dashed var(--accent);border-radius:10px;padding:18px;margin:14px 0;color:var(--accent);user-select:all;">${code}</div>
                    <p style="color:var(--text-muted);font-size:0.78rem;">
                        ⚠️ Solo se muestra UNA vez. Cópialo ahora mismo. Si lo pierdes, debes volver a configurar la recuperación.
                    </p>
                    <div style="display:flex;gap:8px;margin-top:14px;">
                        <button class="btn-submit" style="flex:1;" onclick="navigator.clipboard?.writeText('${code}'); App.ui.toast('Código copiado','success');">
                            <i class="fas fa-copy"></i> Copiar código
                        </button>
                        <button class="btn-submit" style="flex:1;background:var(--text);color:var(--bg);" onclick="document.getElementById('backup-code-modal').remove()">
                            He guardado el código
                        </button>
                    </div>
                </div>`;
            const modal = document.createElement('div');
            modal.id = 'backup-code-modal';
            modal.className = 'modal';
            modal.innerHTML = html;
            document.body.appendChild(modal);
        },

        // Inicia el flujo de recuperación con preguntas de seguridad
        async startQuestionsRecovery() {
            const username = document.getElementById('forgot-email').value.trim();
            if (!username) { this.toast('Escribe tu email o usuario primero', 'warning'); return; }
            if (!window.SB) return;

            const lookup = username.includes('@')
                ? await SB.from('profiles').select('username, security_q1, security_q2, security_q3').eq('email', username).maybeSingle()
                : await SB.from('profiles').select('username, security_q1, security_q2, security_q3').ilike('username', username).maybeSingle();

            if (lookup.error || !lookup.data) {
                this.toast('Cuenta no encontrada', 'error'); return;
            }
            const { data } = lookup;
            if (!data.security_q1 || !data.security_q2 || !data.security_q3) {
                this.toast('Esta cuenta no tiene preguntas de seguridad configuradas · usa el email', 'warning');
                return;
            }

            // Guardar el username para el siguiente paso
            App.ui.state._recoveryUser = data.username;
            App.ui.switchAuth('questions');
            // Pintar las preguntas
            document.getElementById('rq-q1-label').textContent = data.security_q1;
            document.getElementById('rq-q2-label').textContent = data.security_q2;
            document.getElementById('rq-q3-label').textContent = data.security_q3;
        },

        async submitQuestionsRecovery() {
            const username = App.ui.state._recoveryUser;
            if (!username) return;
            const a1 = document.getElementById('rq-a1').value.trim();
            const a2 = document.getElementById('rq-a2').value.trim();
            const a3 = document.getElementById('rq-a3').value.trim();
            if (!a1 || !a2 || !a3) { this.toast('Responde las 3 preguntas', 'warning'); return; }

            const [h1, h2, h3] = await Promise.all([
                App.auth._hashAnswer(a1), App.auth._hashAnswer(a2), App.auth._hashAnswer(a3)
            ]);

            const { data, error } = await SB.rpc('verify_security_answers', {
                p_username: username, p_a1_hash: h1, p_a2_hash: h2, p_a3_hash: h3
            });
            if (error) {
                console.error('[auth] verify_security_answers:', error);
                this.toast('Error verificando respuestas', 'error');
                return;
            }
            if (!data) {
                this.toast('Respuestas incorrectas', 'error'); return;
            }

            // Respuestas correctas — enviar el email de reset al email de la cuenta
            const { data: prof } = await SB.from('profiles').select('email').ilike('username', username).maybeSingle();
            if (prof?.email) {
                const redirectTo = window.location.origin + window.location.pathname;
                await SB.auth.resetPasswordForEmail(prof.email, { redirectTo });
                this.toast('✅ Identidad verificada · enlace de reset enviado a tu email', 'success');
                this.switchAuth('login');
            } else {
                this.toast('Cuenta sin email asociado · contacta admin', 'warning');
            }
        },

        // Cambia la contraseña del usuario logueado (desde Settings, sin email).
        async changePassword() {
            if (!App.db.session) { App.ui.toast('Inicia sesión primero', 'warning'); return; }
            if (!window.SB) { App.ui.toast('Supabase no disponible', 'error'); return; }

            const pass = document.getElementById('pwd-new').value;
            const passConfirm = document.getElementById('pwd-confirm').value;

            if (!pass || !passConfirm) { App.ui.toast('Completa ambos campos', 'warning'); return; }
            if (pass.length < 6) { App.ui.toast('La contraseña debe tener al menos 6 caracteres', 'warning'); return; }
            if (pass !== passConfirm) { App.ui.toast('Las contraseñas no coinciden', 'error'); return; }

            const { error } = await SB.auth.updateUser({ password: pass });
            if (error) {
                console.error('[auth] changePassword:', error);
                App.ui.toast(error.message || 'No se pudo cambiar la contraseña', 'error');
                return;
            }

            // Limpiar campos para que no queden visibles
            document.getElementById('pwd-new').value = '';
            document.getElementById('pwd-confirm').value = '';
            App.ui.toast('Contraseña actualizada correctamente', 'success');
        },

        // Aplica la nueva contraseña tras volver del email de recuperación.
        async doPasswordReset() {
            const pass = document.getElementById('reset-pass').value;
            const passConfirm = document.getElementById('reset-pass-confirm').value;

            if (!pass || !passConfirm) { App.ui.toast('Completa ambos campos', 'warning'); return; }
            if (pass.length < 6) { App.ui.toast('La contraseña debe tener al menos 6 caracteres', 'warning'); return; }
            if (pass !== passConfirm) { App.ui.toast('Las contraseñas no coinciden', 'error'); return; }
            if (!window.SB) { App.ui.toast('Supabase no disponible', 'error'); return; }

            const { error } = await SB.auth.updateUser({ password: pass });
            if (error) {
                console.error('[auth] updateUser:', error);
                App.ui.toast(error.message || 'No se pudo cambiar la contraseña', 'error');
                return;
            }

            App.ui.toast('Contraseña actualizada · ya puedes iniciar sesión', 'success');
            App.ui.switchAuth('login');
            // Limpiar campos
            document.getElementById('reset-pass').value = '';
            document.getElementById('reset-pass-confirm').value = '';
        },

        async register() {
            const name  = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const birthdate = document.getElementById('reg-birthdate').value;
            const pass  = document.getElementById('reg-pass').value;
            const passConfirm = document.getElementById('reg-pass-confirm').value;

            if (!name || !email || !pass || !passConfirm) {
                App.ui.toast('Completa todos los campos · email obligatorio', 'warning'); return;
            }
            // Email debe ser un formato válido y tener dominio reconocible
            if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
                App.ui.toast('Email inválido · usa un email real (ej. nombre@gmail.com)', 'warning'); return;
            }
            if (!/^[\p{L}\p{N} ._-]{3,24}$/u.test(name)) {
                App.ui.toast('Nombre inválido: usa 3–24 letras/números, espacios o . _ -', 'warning'); return;
            }
            if (pass.length < 6) {
                App.ui.toast('La contraseña debe tener al menos 6 caracteres', 'warning'); return;
            }
            if (pass !== passConfirm) {
                App.ui.toast('Las contraseñas no coinciden', 'error'); return;
            }
            // Validación de fecha de nacimiento: opcional pero si la rellenan que sea coherente.
            if (birthdate) {
                const bd = new Date(birthdate);
                if (Number.isNaN(bd.getTime())) {
                    App.ui.toast('Fecha de nacimiento inválida', 'warning'); return;
                }
                const ageMs = Date.now() - bd.getTime();
                const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
                if (ageYears < 13) {
                    App.ui.toast('Debes tener al menos 13 años para registrarte', 'warning'); return;
                }
                if (ageYears > 120) {
                    App.ui.toast('Fecha de nacimiento poco realista', 'warning'); return;
                }
            }
            if (!window.SB) { App.ui.toast('Supabase no disponible', 'error'); return; }

            const { data, error } = await SB.auth.signUp({
                email, password: pass,
                options: { data: { username: name, pfp: DEFAULT_PFP, birthdate: birthdate || null } }
            });
            if (error) {
                App.ui.toast(error.message || 'Error al registrar', 'error');
                console.error('[auth] signUp:', error);
                return;
            }

            if (!data.session) {
                App.ui.toast('Revisa tu email para confirmar la cuenta', 'info');
                App.ui.closeAuth();
                return;
            }

            await this._loadSessionFromSupabase(data.session);
            App.ui.closeAuth();
            App.ui.toast(`Bienvenido, ${name}`, 'success');
            App.ui.navigate(App.ui.state?.currentRoute || 'inicio');
        },

        // Login flexible: acepta email directo o un nombre de usuario.
        // Si no es email, busca el profile por username y obtiene su email.
        async login() {
            const ident = document.getElementById('login-user').value.trim();
            const pass  = document.getElementById('login-pass').value;

            if (!ident || !pass) { App.ui.toast('Completa todos los campos', 'warning'); return; }
            if (!window.SB) { App.ui.toast('Supabase no disponible', 'error'); return; }

            let emailToUse = ident;
            if (!ident.includes('@')) {
                // Es un username — buscar email asociado en profiles.
                const { data: prof, error: lookupErr } = await SB
                    .from('profiles')
                    .select('email, username')
                    .ilike('username', ident)
                    .maybeSingle();
                if (lookupErr) {
                    console.error('[auth] lookup username:', lookupErr);
                    // Si la columna `email` no existe → falta ejecutar update-2 SQL
                    if (/column.*email.*does not exist|column "email"/i.test(lookupErr.message || '')) {
                        App.ui.toast('Falta ejecutar supabase-schema-update-2.sql · entra con tu email mientras', 'error');
                    } else {
                        App.ui.toast('Error consultando usuario: ' + (lookupErr.message || 'desconocido'), 'error');
                    }
                    return;
                }
                if (!prof || !prof.email) {
                    App.ui.toast('Usuario no encontrado o sin email registrado · prueba con tu email', 'error');
                    return;
                }
                emailToUse = prof.email;
            }

            const { data, error } = await SB.auth.signInWithPassword({ email: emailToUse, password: pass });
            if (error) {
                if (/email not confirmed/i.test(error.message)) {
                    App.ui.toast('Confirma tu email primero · revisa tu bandeja de entrada', 'warning');
                } else {
                    App.ui.toast('Email/usuario o contraseña incorrectos', 'error');
                }
                console.error('[auth] signIn:', error);
                return;
            }

            await this._loadSessionFromSupabase(data.session);
            App.ui.closeAuth();
            App.ui.toast('Bienvenido', 'success');
            App.ui.navigate(App.ui.state?.currentRoute || 'inicio');
        },

        async loginGuest() {
            // Login como invitado deshabilitado: forzamos que todo usuario tenga email.
            // El portal requiere identidad verificable para moderar y proteger la comunidad.
            App.ui.toast('Las cuentas de invitado están deshabilitadas · usa email o Google', 'warning');
        },

        async loginWithGoogle() {
            if (!window.SB) { App.ui.toast('Supabase no disponible', 'error'); return; }
            const { error } = await SB.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + window.location.pathname }
            });
            if (error) {
                App.ui.toast('Google no configurado · activa el provider Google en Supabase Dashboard', 'error');
                console.error('[auth] google:', error);
            }
            // Tras el redirect, bootstrapSupabase recoge la sesión.
        },

        // Sustituye el botón legacy de Google Identity por uno que usa Supabase OAuth.
        initGoogle() {
            const html = `
                <button class="google-supa-btn"
                        onclick="App.auth.loginWithGoogle()"
                        style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px 16px;background:linear-gradient(135deg,#4285f4,#34a853);color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;">
                    <i class="fab fa-google"></i> Continuar con Google
                </button>`;
            document.querySelectorAll('.google-btn-host').forEach(el => el.innerHTML = html);
            ['google-btn-container', 'google-btn-register'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = html;
            });
        },

        openGoogleConfig() {
            App.ui.toast('Configura Google en Supabase Dashboard → Authentication → Providers', 'info');
        },

        // Stub legacy. Supabase ahora gestiona la sesión vía onAuthStateChange.
        setSession(_user) {},

        async logout() {
            const name = App.db.session?.name;
            if (window.SB) await SB.auth.signOut();
            App.db.session = null;
            App.db.save();
            App.ui.closeSettings?.();
            App.ui.updateHeader();
            App.ui.navigate('inicio');
            App.ui.toast(name ? `Hasta luego, ${name}` : 'Sesión cerrada', 'info');
        },

        getUserRole(userId) {
            const u = App.db.users.find(u => u.id === userId);
            return u?.role || 'citizen';
        },

        // No-op en el nuevo modelo: el primer admin se promueve manualmente con SQL:
        //   UPDATE profiles SET role='admin' WHERE username='tunombre';
        async ensureSeedAdmin() {},

        async promoteToAdmin(username) {
            if (!window.SB) return false;
            const { error } = await SB.from('profiles').update({ role: 'admin' }).eq('username', username);
            if (error) { App.ui.toast('No se pudo promover (¿tu sesión es admin?)', 'error'); return false; }
            const u = App.db.users.find(u => u.name === username);
            if (u) { u.role = 'admin'; App.db.save(); }
            App.ui.updateHeader(); App.forum.render?.();
            App.ui.toast(`${username} ahora es admin`, 'success');
            return true;
        },

        async promoteToMedia(username) {
            if (!window.SB) return false;
            const { error } = await SB.from('profiles').update({ role: 'media' }).eq('username', username);
            if (error) { App.ui.toast('No se pudo promover', 'error'); return false; }
            const u = App.db.users.find(u => u.name === username);
            if (u) { u.role = 'media'; App.db.save(); }
            App.ui.updateHeader(); App.forum.render?.();
            App.ui.toast(`${username} ahora es medio verificado`, 'success');
            return true;
        },

        async revokeMedia(username) {
            if (!window.SB) return false;
            const { error } = await SB.from('profiles').update({ role: 'citizen' }).eq('username', username);
            if (error) return false;
            const u = App.db.users.find(u => u.name === username);
            if (u) { u.role = 'citizen'; App.db.save(); }
            App.ui.toast(`${username} ya no es medio verificado`, 'info');
            return true;
        }
    },

    // ========== MÓDULO 2.5: CAPA DE DATOS SUPABASE ==========
    // Phase 2: threads/comments/likes/reactions viven en Postgres.
    // App.db.threads sigue siendo el cache que la UI lee, pero es un
    // espejo de Supabase: bootstrapData() lo rellena al arrancar y
    // subscribeRealtime() lo mantiene sincronizado con cambios de
    // otros usuarios. Los writes locales también se replican.
    sb: {
        _subs: [],

        // ---------- HYDRATION HELPERS ----------
        hydrateThread(row, likesMap = {}, reactionsMap = {}, commentsMap = {}) {
            return {
                id: row.id,
                author: row.author?.username || 'Anónimo',
                authorId: row.author_id,
                pfp: row.author?.pfp || DEFAULT_PFP,
                content: row.content,
                category: row.category,
                attachments: row.attachments || [],
                outletId: row.outlet_id,
                timestamp: row.created_at,
                isShared: !!row.is_shared,
                originalThreadId: row.original_thread_id,
                notifyFollowers: !!row.notify_followers,
                isBot: !!row.is_bot,
                isRich: row.is_rich !== false,
                likes: likesMap[row.id] || [],
                reactions: reactionsMap[row.id] || {},
                comments: commentsMap[row.id] || []
            };
        },

        hydrateComment(row) {
            return {
                id: row.id,
                author: row.author?.username || 'Anónimo',
                authorId: row.author_id,
                pfp: row.author?.pfp || DEFAULT_PFP,
                content: row.content,
                isRich: false,
                likes: [],
                replies: [],
                timestamp: row.created_at,
                parentId: row.parent_id
            };
        },

        // ---------- FETCH MASIVO INICIAL ----------
        async fetchAllThreads() {
            if (!window.SB) return null;

            const { data: threads, error } = await SB
                .from('threads')
                .select('*, author:profiles!threads_author_id_fkey(id, username, pfp, role, badges)')
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) { console.error('[sb] fetchAllThreads:', error); return null; }
            if (!threads?.length) return [];

            const threadIds = threads.map(t => t.id);

            const [{ data: likes }, { data: reactions }, { data: comments }] = await Promise.all([
                SB.from('likes').select('user_id, target_id').eq('target_type', 'thread').in('target_id', threadIds),
                SB.from('reactions').select('user_id, thread_id, emoji').in('thread_id', threadIds),
                SB.from('comments').select('*, author:profiles!comments_author_id_fkey(id, username, pfp, role)').in('thread_id', threadIds).order('created_at', { ascending: true })
            ]);

            // Maps de likes y reacciones
            const likesMap = {};
            (likes || []).forEach(l => {
                (likesMap[l.target_id] = likesMap[l.target_id] || []).push(l.user_id);
            });
            const reactionsMap = {};
            (reactions || []).forEach(r => {
                const m = (reactionsMap[r.thread_id] = reactionsMap[r.thread_id] || {});
                (m[r.emoji] = m[r.emoji] || []).push(r.user_id);
            });

            // Construir árbol de comentarios (parent_id → tree)
            const commentsByThread = {};
            const commentsById = {};
            (comments || []).forEach(c => {
                const h = this.hydrateComment(c);
                commentsById[c.id] = h;
                (commentsByThread[c.thread_id] = commentsByThread[c.thread_id] || []).push(h);
            });
            const commentsMap = {};
            Object.entries(commentsByThread).forEach(([tid, list]) => {
                const roots = [];
                list.forEach(c => {
                    if (c.parentId && commentsById[c.parentId]) commentsById[c.parentId].replies.push(c);
                    else roots.push(c);
                });
                commentsMap[tid] = roots;
            });

            return threads.map(t => this.hydrateThread(t, likesMap, reactionsMap, commentsMap));
        },

        // ---------- WRITES DE THREAD ----------
        async insertThread(thread) {
            if (!window.SB) {
                console.error('[sb] insertThread: SB no disponible');
                return { ok: false, reason: 'Supabase no disponible' };
            }
            // Verificar que la sesión Supabase esté viva (no solo el cache local).
            // Si la sesión expiró, RLS rechazará la insert sin un error claro.
            const { data: { session: liveSession } } = await SB.auth.getSession();
            if (!liveSession?.user) {
                console.error('[sb] insertThread: sin sesión Supabase activa');
                return { ok: false, reason: 'Tu sesión expiró — vuelve a iniciar sesión' };
            }
            const row = {
                id: thread.id,
                author_id: liveSession.user.id,
                content: thread.content,
                category: thread.category,
                attachments: thread.attachments || [],
                outlet_id: thread.outletId || null,
                is_shared: !!thread.isShared,
                original_thread_id: thread.originalThreadId || null,
                notify_followers: !!thread.notifyFollowers,
                is_bot: !!thread.isBot,
                is_rich: thread.isRich !== false
            };
            const { data, error } = await SB.from('threads').insert(row).select();
            if (error) {
                console.error('[sb] insertThread:', error);
                return { ok: false, reason: error.message || 'Error desconocido' };
            }
            console.log('[sb] insertThread OK:', data?.[0]?.id);
            return { ok: true };
        },

        async deleteThread(threadId) {
            if (!window.SB) return false;
            const { error, count } = await SB.from('threads').delete({ count: 'exact' }).eq('id', threadId);
            if (error) {
                console.error('[sb] deleteThread:', error);
                if (/permission denied|policy/i.test(error.message || '')) {
                    App.ui.toast?.('No tienes permiso para borrar este hilo (RLS)', 'error');
                } else {
                    App.ui.toast?.('Error en Supabase: ' + (error.message || 'desconocido'), 'error');
                }
                return false;
            }
            return true;
        },

        // ---------- WRITES DE COMMENT ----------
        async insertComment(comment, threadId, parentId = null) {
            if (!window.SB || !App.db.session) return false;
            const row = {
                id: comment.id,
                thread_id: threadId,
                author_id: App.db.session.id,
                content: comment.content,
                parent_id: parentId
            };
            const { error } = await SB.from('comments').insert(row);
            if (error) { console.error('[sb] insertComment:', error); return false; }
            return true;
        },

        async deleteComment(id) {
            if (!window.SB) return;
            const { error } = await SB.from('comments').delete().eq('id', id);
            if (error) console.error('[sb] deleteComment:', error);
        },

        // ---------- LIKES ----------
        async toggleLikeRemote(targetId, isComment = false) {
            if (!window.SB || !App.db.session) return;
            const target_type = isComment ? 'comment' : 'thread';
            const userId = App.db.session.id;
            const { data: existing } = await SB.from('likes')
                .select('user_id')
                .eq('user_id', userId).eq('target_type', target_type).eq('target_id', targetId)
                .maybeSingle();
            if (existing) {
                await SB.from('likes').delete()
                    .eq('user_id', userId).eq('target_type', target_type).eq('target_id', targetId);
            } else {
                await SB.from('likes').insert({ user_id: userId, target_type, target_id: targetId });
            }
        },

        // ---------- REACTIONS ----------
        async setReactionRemote(threadId, emoji, applied) {
            if (!window.SB || !App.db.session) return;
            const userId = App.db.session.id;
            // Borra cualquier reacción anterior del usuario en este thread.
            await SB.from('reactions').delete().eq('user_id', userId).eq('thread_id', threadId);
            if (applied) {
                await SB.from('reactions').insert({ user_id: userId, thread_id: threadId, emoji });
            }
        },

        // ---------- REALTIME ----------
        subscribeRealtime() {
            if (!window.SB) return;
            this._subs.forEach(s => { try { s.unsubscribe(); } catch (_) {} });
            this._subs = [];

            const ch = SB.channel('tv-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        if (App.db.threads.find(t => t.id === payload.new.id)) return; // ya está (lo creamos)
                        const { data: prof } = await SB.from('profiles')
                            .select('id, username, pfp, role, badges')
                            .eq('id', payload.new.author_id).single();
                        const hydrated = this.hydrateThread({ ...payload.new, author: prof });
                        App.db.threads.unshift(hydrated);
                        App.db.save();
                        App.forum.render?.();
                    } else if (payload.eventType === 'DELETE') {
                        App.db.threads = App.db.threads.filter(t => t.id !== payload.old.id);
                        App.db.save();
                        App.forum.render?.();
                    }
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, (payload) => {
                    const r = payload.new || payload.old;
                    if (!r || r.target_type !== 'thread') return;
                    const thread = App.db.threads.find(t => t.id === r.target_id);
                    if (!thread) return;
                    if (payload.eventType === 'INSERT') {
                        if (!thread.likes.includes(r.user_id)) thread.likes.push(r.user_id);
                    } else if (payload.eventType === 'DELETE') {
                        thread.likes = thread.likes.filter(id => id !== r.user_id);
                    }
                    App.forum.renderThread?.(r.target_id);
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, (payload) => {
                    const r = payload.new || payload.old;
                    if (!r) return;
                    const thread = App.db.threads.find(t => t.id === r.thread_id);
                    if (!thread) return;
                    thread.reactions = thread.reactions || {};
                    if (payload.eventType === 'INSERT') {
                        thread.reactions[r.emoji] = thread.reactions[r.emoji] || [];
                        if (!thread.reactions[r.emoji].includes(r.user_id)) thread.reactions[r.emoji].push(r.user_id);
                    } else if (payload.eventType === 'DELETE') {
                        thread.reactions[r.emoji] = (thread.reactions[r.emoji] || []).filter(id => id !== r.user_id);
                        if (thread.reactions[r.emoji].length === 0) delete thread.reactions[r.emoji];
                    }
                    App.forum.renderThread?.(r.thread_id);
                })
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, async (payload) => {
                    const c = payload.new;
                    const thread = App.db.threads.find(t => t.id === c.thread_id);
                    if (!thread) return;
                    // Si el comentario es nuestro, ya está (insertado optimistamente).
                    if (this._findCommentDeep(thread.comments, c.id)) return;
                    const { data: prof } = await SB.from('profiles')
                        .select('id, username, pfp, role')
                        .eq('id', c.author_id).single();
                    const hydrated = this.hydrateComment({ ...c, author: prof });
                    if (c.parent_id) {
                        const parent = this._findCommentDeep(thread.comments, c.parent_id);
                        if (parent) parent.replies.push(hydrated);
                        else thread.comments.push(hydrated);
                    } else {
                        thread.comments.push(hydrated);
                    }
                    App.forum.renderThread?.(c.thread_id);
                })
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, (payload) => {
                    const c = payload.old;
                    const thread = App.db.threads.find(t => t.id === c.thread_id);
                    if (!thread) return;
                    const removeRec = (list) => {
                        for (let i = 0; i < list.length; i++) {
                            if (list[i].id === c.id) { list.splice(i, 1); return true; }
                            if (removeRec(list[i].replies)) return true;
                        }
                        return false;
                    };
                    removeRec(thread.comments);
                    App.forum.renderThread?.(c.thread_id);
                })
                // ---------- PROFILES (sidebar live: nuevos users, cambios de status, etc.) ----------
                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
                    const p = payload.new || payload.old;
                    if (!p) return;
                    const idx = App.db.users.findIndex(u => String(u.id) === String(p.id));
                    if (payload.eventType === 'DELETE') {
                        if (idx >= 0) App.db.users.splice(idx, 1);
                    } else {
                        const cached = {
                            id: p.id, name: p.username, email: p.email || '',
                            pfp: p.pfp || DEFAULT_PFP, banner: p.banner || '',
                            bio: p.bio || '', role: p.role || 'citizen',
                            badges: p.badges || [], isGuest: !!p.is_guest,
                            joinDate: p.created_at,
                            online_status: p.online_status,
                            custom_status: p.custom_status,
                            custom_status_emoji: p.custom_status_emoji,
                            show_online_status: p.show_online_status,
                            last_seen: p.last_seen
                        };
                        if (idx >= 0) App.db.users[idx] = { ...App.db.users[idx], ...cached };
                        else App.db.users.push(cached);
                        // Si es mi propio profile, también refrescar la sesión local
                        if (App.db.session && String(App.db.session.id) === String(p.id)) {
                            Object.assign(App.db.session, cached);
                        }
                    }
                    App.db.save();
                    App.ui.renderUnifiedSidebar?.();
                    App.ui.refreshHeaderUserCard?.();
                })
                .subscribe();

            this._subs.push(ch);
        },

        _findCommentDeep(list, id) {
            for (const c of list) {
                if (c.id === id) return c;
                const found = this._findCommentDeep(c.replies || [], id);
                if (found) return found;
            }
            return null;
        },

        // ---------- BUSINESSES ----------
        async fetchAllBusinesses() {
            if (!window.SB) return null;
            const { data, error } = await SB.from('businesses')
                .select('*')
                .order('name', { ascending: true });
            if (error) { console.error('[sb] fetchAllBusinesses:', error); return null; }
            return (data || []).map(b => ({
                id: b.id,
                name: b.name,
                category: b.category,
                address: b.address || '',
                phone: b.phone || '',
                description: b.description || '',
                image: b.image || '',
                coords: (typeof b.lat === 'number' && typeof b.lng === 'number') ? [b.lat, b.lng] : null,
                lat: b.lat,
                lng: b.lng,
                _template: !!b.is_template,
                _supabase: true
            }));
        },

        async insertBusiness(biz) {
            if (!window.SB) return null;
            const row = {
                name: biz.name,
                category: biz.category,
                address: biz.address || '',
                phone: biz.phone || '',
                description: biz.description || '',
                image: biz.image || '',
                lat: biz.coords?.[0] ?? biz.lat ?? null,
                lng: biz.coords?.[1] ?? biz.lng ?? null,
                is_template: !!biz._template
            };
            const { data, error } = await SB.from('businesses').insert(row).select().single();
            if (error) { console.error('[sb] insertBusiness:', error); App.ui.toast('Error al guardar el negocio', 'error'); return null; }
            return data;
        },

        async updateBusiness(id, fields) {
            if (!window.SB) return false;
            const row = {};
            if (fields.name !== undefined)        row.name = fields.name;
            if (fields.category !== undefined)    row.category = fields.category;
            if (fields.address !== undefined)     row.address = fields.address;
            if (fields.phone !== undefined)       row.phone = fields.phone;
            if (fields.description !== undefined) row.description = fields.description;
            if (fields.image !== undefined)       row.image = fields.image;
            if (fields.coords) { row.lat = fields.coords[0]; row.lng = fields.coords[1]; }
            const { error } = await SB.from('businesses').update(row).eq('id', id);
            if (error) { console.error('[sb] updateBusiness:', error); App.ui.toast('Error al actualizar', 'error'); return false; }
            return true;
        },

        async deleteBusiness(id) {
            if (!window.SB) return false;
            const { error } = await SB.from('businesses').delete().eq('id', id);
            if (error) { console.error('[sb] deleteBusiness:', error); App.ui.toast('Error al eliminar', 'error'); return false; }
            return true;
        },

        // ---------- COMMUNITY VIDEOS (sección Explora) ----------
        async fetchVideos() {
            if (!window.SB) return [];
            const { data, error } = await SB.from('community_videos')
                .select('*')
                .order('featured', { ascending: false })
                .order('created_at', { ascending: false });
            if (error) { console.error('[sb] fetchVideos:', error); return []; }
            return data || [];
        },

        async insertVideo(title, youtubeId, description = '', category = 'general', featured = false) {
            if (!window.SB || !App.db.session) return null;
            const { data, error } = await SB.from('community_videos').insert({
                title, youtube_id: youtubeId, description, category, featured,
                added_by: App.db.session.id
            }).select().single();
            if (error) { console.error('[sb] insertVideo:', error); App.ui.toast('Error al guardar el video', 'error'); return null; }
            return data;
        },

        async deleteVideo(id) {
            if (!window.SB) return false;
            const { error } = await SB.from('community_videos').delete().eq('id', id);
            if (error) { console.error('[sb] deleteVideo:', error); App.ui.toast('Error al eliminar', 'error'); return false; }
            return true;
        },

        // ---------- CONTADOR DE VISITAS ----------
        // Incrementa el contador global de visitas (RPC atómica) la PRIMERA vez
        // en la sesión del navegador; las veces siguientes solo lee el total.
        // Devuelve el número total de visitas, o null si falla / no hay backend.
        async registerVisit() {
            if (!window.SB) return null;
            const counted = sessionStorage.getItem('tv_visit_counted') === '1';
            const { data, error } = await SB.rpc(counted ? 'get_site_views' : 'bump_site_views');
            if (error) { console.error('[sb] registerVisit:', error); return null; }
            if (!counted) {
                try { sessionStorage.setItem('tv_visit_counted', '1'); } catch (_) {}
            }
            return typeof data === 'number' ? data : null;
        },

        // ---------- FOLLOWS ----------
        // Carga la matriz de follows desde Supabase. La estructura es:
        //   App.db.following[followerId] = [followedId1, followedId2, ...]
        async fetchAllFollows() {
            if (!window.SB) return null;
            const { data, error } = await SB.from('follows')
                .select('follower_id, followed_id')
                .limit(10000);
            if (error) { console.error('[sb] fetchAllFollows:', error); return null; }
            const map = {};
            (data || []).forEach(row => {
                (map[row.follower_id] = map[row.follower_id] || []).push(row.followed_id);
            });
            return map;
        },

        // ---------- NOTIFICATIONS (del usuario actual) ----------
        async fetchMyNotifications() {
            if (!window.SB || !App.db.session) return null;
            // La tabla `notifications` tiene `recipient_id` (no `user_id`).
            // Hacemos JOIN con profiles para sacar el username del actor.
            const { data, error } = await SB.from('notifications')
                .select('*, actor:profiles!notifications_actor_id_fkey(username)')
                .eq('recipient_id', App.db.session.id)
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) { console.error('[sb] fetchMyNotifications:', error); return null; }
            // Adaptar al formato del frontend (que espera userId, sourceUserName, threadId)
            return (data || []).map(n => ({
                id: n.id,
                userId: n.recipient_id,
                type: n.type,
                sourceUserName: n.actor?.username || '',
                threadId: n.target_type === 'thread' ? n.target_id : null,
                targetType: n.target_type,
                targetId: n.target_id,
                read: !!n.read,
                timestamp: n.created_at
            }));
        },

        // ---------- BOOTSTRAP ----------
        async bootstrapData() {
            if (!window.SB) return;
            try {
                const threads = await this.fetchAllThreads();
                // Si fetchAllThreads devuelve null, hubo error de red/RLS.
                // Asignamos array vacío para no quedarnos con datos rancios — la
                // verdad ahora está en Supabase, no en localStorage.
                App.db.threads = Array.isArray(threads) ? threads : [];

                // Cachear TODOS los profiles públicos para que las pfp se muestren al instante
                // en cualquier sitio donde aparezca un user (no solo autores de hilos).
                const { data: allProfs } = await SB.from('profiles')
                    .select('id, username, pfp, banner, bio, role, badges, is_guest, created_at, online_status, custom_status, custom_status_emoji, show_online_status, last_seen, email')
                    .limit(1000);
                if (Array.isArray(allProfs)) {
                    // PASO 1: limpiar fantasmas — eliminar del cache local los users
                    // que ya no existen en Supabase. La sesión actual NUNCA se borra
                    // (aunque se borre temporalmente, su signal lo recreará).
                    const validIds = new Set(allProfs.map(p => String(p.id)));
                    const myId = App.db.session?.id ? String(App.db.session.id) : null;
                    App.db.users = App.db.users.filter(u => {
                        const id = String(u.id);
                        return validIds.has(id) || (myId && id === myId);
                    });

                    // PASO 2: merge/insert los profiles frescos
                    allProfs.forEach(p => {
                        const idx = App.db.users.findIndex(u => String(u.id) === String(p.id));
                        const cached = {
                            id: p.id, name: p.username, email: p.email || '',
                            pfp: p.pfp || DEFAULT_PFP, banner: p.banner || '',
                            bio: p.bio || '',
                            role: p.role || 'citizen', badges: p.badges || [],
                            isGuest: !!p.is_guest, joinDate: p.created_at,
                            online_status: p.online_status,
                            custom_status: p.custom_status,
                            custom_status_emoji: p.custom_status_emoji,
                            show_online_status: p.show_online_status,
                            last_seen: p.last_seen
                        };
                        if (idx >= 0) App.db.users[idx] = { ...App.db.users[idx], ...cached };
                        else App.db.users.push(cached);
                    });

                    // PASO 3: limpiar follows huérfanos (apuntando a users borrados)
                    if (App.db.following) {
                        Object.keys(App.db.following).forEach(followerId => {
                            const list = App.db.following[followerId];
                            if (Array.isArray(list)) {
                                App.db.following[followerId] = list.filter(id => validIds.has(String(id)));
                            }
                        });
                    }
                    App.db.save();
                    App.ui.renderUnifiedSidebar?.();
                }

                // Follows: matriz completa de quién sigue a quién (necesario para
                // renderizar listas de seguidos/seguidores en sidebar y perfil)
                const follows = await this.fetchAllFollows();
                if (follows) {
                    App.db.following = follows;
                    App.ui.renderUnifiedSidebar?.();
                }

                // Notifications: solo las del usuario actual (RLS las filtra)
                if (App.db.session) {
                    const notis = await this.fetchMyNotifications();
                    if (Array.isArray(notis)) {
                        App.db.notifications = notis;
                        App.ui.refreshNotificationBadge?.();
                    }
                }

                App.db.save();
                App.forum.render?.();
                this.subscribeRealtime();

                // Businesses: si Supabase tiene datos, son la fuente de verdad.
                // Si está vacío, mantenemos el seed local como placeholder editable.
                const remoteBusinesses = await this.fetchAllBusinesses();
                if (Array.isArray(remoteBusinesses) && remoteBusinesses.length > 0) {
                    App.db.businesses = remoteBusinesses;
                    if (App.ui.state?.currentRoute === 'explora') App.ui.renderBusinessDirectory?.();
                }

                console.log(`[sb] bootstrap OK · ${App.db.threads.length} threads · ${Object.keys(App.db.following).length} follows · ${App.db.notifications.length} notifs`);
            } catch (e) {
                console.error('[sb] bootstrapData:', e);
            }
        }
    },

    // ========== MÓDULO 3: SISTEMA DE FORO CON COMENTARIOS ==========
    forum: {
        createThread(content, category = 'general', attachments = [], outletId = null, notifyFollowers = false) {
            if (!App.db.session) {
                App.ui.toast('Debes iniciar sesión', 'warning');
                return;
            }
            if (category === 'noticias' && !['admin', 'media'].includes(App.db.session.role)) {
                App.ui.toast('Solo medios verificados pueden publicar en Noticias', 'error');
                return;
            }

            const thread = {
                id: (window.crypto?.randomUUID?.() || (Date.now() + '-' + Math.random().toString(36).slice(2))),
                author: App.db.session.name,
                authorId: App.db.session.id,
                pfp: App.db.session.pfp,
                content,
                category,
                attachments,
                outletId,
                likes: [],
                comments: [],
                reactions: {},
                timestamp: new Date().toISOString(),
                isBot: false,
                isRich: true,
                notifyFollowers
            };

            // Optimistic UI: insertamos primero en cache + render, luego replicamos a Supabase.
            App.db.threads.unshift(thread);
            App.db.save();
            App.ui.closeEditor();
            App.ui.navigate('inicio');

            App.sb.insertThread(thread).then(result => {
                if (!result?.ok) {
                    // Rollback si Supabase rechazó (RLS, validación, red, etc.).
                    App.db.threads = App.db.threads.filter(t => t.id !== thread.id);
                    App.db.save();
                    App.forum.render?.();
                    App.ui.toast('No se publicó: ' + (result?.reason || 'error desconocido'), 'error');
                }
            });

            // Notificar a seguidores SOLO si el autor activó la casilla
            const myId = App.db.session.id;
            const notifiedSet = new Set();
            if (notifyFollowers) {
                Object.entries(App.db.following).forEach(([followerId, ids]) => {
                    if (Array.isArray(ids) && ids.includes(myId)) {
                        App.notifications.create(followerId, 'new_thread', App.db.session.name, thread.id);
                        notifiedSet.add(followerId);
                    }
                });
            }
            // Notificar SIEMPRE a quienes hicieron toggle "Notificarme cuando publique este usuario"
            // independiente de la casilla del autor.
            Object.entries(App.db.notifyOn || {}).forEach(([receiverId, watchedIds]) => {
                if (Array.isArray(watchedIds) && watchedIds.includes(myId) && !notifiedSet.has(receiverId)) {
                    App.notifications.create(receiverId, 'new_thread', App.db.session.name, thread.id);
                    notifiedSet.add(receiverId);
                }
            });
            if (notifiedSet.size > 0 && notifyFollowers) {
                App.ui.toast(`Notificación enviada a ${notifiedSet.size} usuario(s)`, 'info');
            }
            return thread;
        },

        addComment(threadId, content, parentCommentId = null, isRich = false) {
            if (!App.db.session) {
                App.ui.toast('Debes iniciar sesión', 'warning');
                return;
            }

            const thread = App.db.threads.find(t => t.id === threadId);
            if (!thread) return;

            const comment = {
                id: (window.crypto?.randomUUID?.() || (Date.now() + '-' + Math.random().toString(36).slice(2))),
                author: App.db.session.name,
                authorId: App.db.session.id,
                pfp: App.db.session.pfp,
                content,
                isRich,
                likes: [],
                replies: [],
                timestamp: new Date().toISOString(),
                parentId: parentCommentId
            };

            App.sb.insertComment(comment, threadId, parentCommentId);

            if (parentCommentId) {
                const findAndAdd = (comments) => {
                    for (let c of comments) {
                        if (c.id === parentCommentId) {
                            c.replies.push(comment);
                            return true;
                        }
                        if (findAndAdd(c.replies)) return true;
                    }
                    return false;
                };
                findAndAdd(thread.comments);
            } else {
                thread.comments.push(comment);
            }

            App.db.save();
            this.renderThread(threadId);
            App.notifications.create(thread.authorId, 'comment', App.db.session.name, threadId);
        },

        // Alias semántico (usar este nombre desde rutas / publicaciones)
        renderThreads(category = 'all', filter = '') {
            return this.render(filter, category);
        },

        render(filter = "", category = "all") {
            const feed = document.getElementById('feed-container');
            if (!feed) return;

            // Limpiar antes de inyectar para evitar duplicados
            feed.innerHTML = '';

            const blockedIds = App.db.session ? (App.db.blockedUsers[App.db.session.id] || []) : [];
            const mutedIds   = App.db.session ? (App.db.mutes?.[App.db.session.id] || []) : [];
            const hiddenIds  = new Set([...blockedIds, ...mutedIds].map(String));
            const filterLower = filter.toLowerCase();

            // Filtrar
            let filtered = App.db.threads.filter(t => {
                const text = (t.content || '').replace(/<[^>]+>/g, '').toLowerCase();
                const matchesFilter = !filterLower
                    || text.includes(filterLower)
                    || (t.author && t.author.toLowerCase().includes(filterLower));
                const matchesCategory =
                    category === 'all'  ? true :
                    category === 'foro' ? t.category !== 'noticias' :
                    t.category === category;
                const isVisible = !hiddenIds.has(String(t.authorId));
                return matchesFilter && matchesCategory && isVisible;
            });

            // Ordenar SIEMPRE por fecha descendente (interleave news + threads)
            filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // En la home/foro, dar un pequeño boost visual a hilos de seguidos (al tope si son recientes)
            if (App.db.session && (category === 'all')) {
                const followingIds = App.db.following[App.db.session.id] || [];
                const cutoff = Date.now() - 24 * 60 * 60 * 1000;
                const recentFromFollowed = filtered.filter(t =>
                    followingIds.includes(t.authorId) && new Date(t.timestamp).getTime() >= cutoff
                );
                const rest = filtered.filter(t => !recentFromFollowed.includes(t));
                filtered = [...recentFromFollowed, ...rest];
            }

            filtered = filtered.slice(0, 60);

            // Render aislando errores: un hilo malo no rompe todo el feed
            const cards = filtered.map(t => {
                try {
                    return category === 'noticias'
                        ? this.renderNewsCard(t)
                        : this.renderThreadCard(t);
                } catch (e) {
                    console.error('[render] hilo problemático id=', t?.id, e);
                    return '';
                }
            }).filter(Boolean);

            const emptyMsg = category === 'noticias'
                ? `<div class="empty-state"><i class="fas fa-newspaper"></i><p>No hay noticias todavía.</p>
                   <small style="color:var(--text-muted);">Los medios verificados pueden publicar desde el botón 📋 de la navbar.</small></div>`
                : `<div class="empty-state"><i class="fas fa-pen-to-square"></i><p>No hay publicaciones todavía.</p>
                   <button class="btn-submit" style="max-width:240px;margin-top:12px;" onclick="App.ui.openEditor()">¡Sé el primero en publicar!</button></div>`;

            feed.innerHTML = cards.length > 0 ? cards.join('') : emptyMsg;

            // Bibliografía oficial al pie de la sección Noticias
            if (category === 'noticias') {
                feed.insertAdjacentHTML('beforeend', App.news.renderBibliography());
            }
        },

        // Card estructurada para noticias (ruta /noticias)
        renderNewsCard(t) {
            const isLiked = (t.likes || []).includes(App.db.session?.id);
            const raw = t.isRich ? sanitizeRichHtml(t.content) : escapeHtml(t.content);
            const contentEmbedded = autoEmbedYouTubeInHtml(raw);
            const contentRehydrated = rehydrateYouTubeFacades(contentEmbedded);
            const contentRaw = enhanceVideoPlayers(contentRehydrated);
            const content = this._wrapLongContent(contentRaw, t.id);
            const freshClass = t._fresh ? ' news-fresh' : '';
            const outlet = t.outletId ? App.db.outlets.find(o => o.id === t.outletId) : null;
            const sourceTag = outlet
                ? `<a class="news-source-tag" href="${escapeHtml(outlet.url)}" target="_blank" rel="noopener noreferrer">
                       ${escapeHtml(outlet.name)}
                   </a>`
                : `<span class="news-source-tag bot"><i class="fas fa-satellite-dish"></i> Tres Valles News IA</span>`;
            const reactions = t.reactions && Object.keys(t.reactions).length
                ? `<div class="thread-reactions">${Object.entries(t.reactions).map(([emoji, users]) => `
                    <button class="reaction-chip${users.includes(App.db.session?.id) ? ' mine' : ''}"
                            onclick="App.social.react('${t.id}', '${escapeJsAttr(emoji)}')">
                        <span class="rx-emoji">${emoji}</span><span class="rx-count">${users.length}</span>
                    </button>`).join('')}</div>`
                : '';
            const sourceLink = t.sourceUrl
                ? `<a class="news-source-link" href="${escapeHtml(t.sourceUrl)}" target="_blank" rel="noopener noreferrer">
                       <i class="fas fa-link"></i> Ver publicación original ${outlet ? 'en ' + escapeHtml(outlet.name) : ''} <i class="fas fa-arrow-up-right-from-square"></i>
                   </a>`
                : '<div class="news-no-source"><i class="fas fa-triangle-exclamation"></i> Esta publicación no tiene fuente verificada.</div>';
            const sessionId = App.db.session?.id;
            const canDelete = sessionId && (t.authorId === sessionId || App.db.session.role === 'admin');
            const deleteBtn = canDelete
                ? `<button class="thread-delete" onclick="App.forum.deleteThread('${t.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>`
                : '';
            return `
                <article class="news-card${freshClass}" data-thread-id="${t.id}">
                    ${deleteBtn}
                    <header class="news-card-header">
                        ${sourceTag}
                        <time class="news-date" title="${new Date(t.timestamp).toLocaleString()}">
                            <i class="far fa-clock"></i> ${App.ui.timeAgo(t.timestamp)}
                        </time>
                    </header>
                    <div class="news-card-body thread-content">${content}</div>
                    ${sourceLink}
                    ${reactions}
                    <div class="thread-actions">
                        <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="App.social.toggleLike('${t.id}')" title="Me gusta">
                            <i class="fas fa-heart"></i> ${(t.likes || []).length}
                        </button>
                        <button class="action-btn" onclick="App.ui.showReactionPicker(this, '${t.id}')" title="Reaccionar">
                            <i class="fas fa-face-smile"></i>
                        </button>
                        <button class="action-btn" onclick="App.ui.toggleCommentBox('${t.id}')" title="Comentar">
                            <i class="fas fa-comment"></i> ${(t.comments || []).length}
                        </button>
                        <button class="action-btn" onclick="App.social.saveThread('${t.id}')" title="Guardar">
                            <i class="fas fa-bookmark"></i>
                        </button>
                        <button class="action-btn" onclick="App.social.shareThread('${t.id}')" title="Compartir">
                            <i class="fas fa-share"></i>
                        </button>
                    </div>
                    <div id="comment-box-${t.id}" class="hidden">
                        ${this.renderComments(t.comments || [], t.id)}
                        <input type="text" placeholder="Comenta..." class="input-comment" onkeypress="if(event.key==='Enter') {App.forum.addComment('${t.id}', this.value); this.value=''; App.forum.render('', 'noticias');}">
                    </div>
                </article>
            `;
        },

        // Detecta hilos largos y los envuelve en un colapsable con botón "Leer más".
        // Umbral bajado para móvil: >120 palabras O >600 caracteres O >8 líneas.
        // Así textos medianos también se compactan en celular.
        _wrapLongContent(html, threadId) {
            const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (!text) return html;
            const wordCount = text.split(' ').filter(Boolean).length;
            const charCount = text.length;
            const lineBreaks = (html.match(/<(br|p|div)[\s>]/gi) || []).length;
            const isLong = wordCount > 120 || charCount > 600 || lineBreaks > 8;
            if (!isLong) return html;
            return `
                <div class="thread-content-collapsible is-collapsed" data-tid="${threadId}">
                    <div class="thread-content-body">${html}</div>
                    <button class="read-more-toggle" onclick="App.forum.toggleReadMore('${threadId}', this)">
                        <span class="rmt-label">Leer más</span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>`;
        },

        toggleReadMore(threadId, btn) {
            const wrap = btn.closest('.thread-content-collapsible');
            if (!wrap) return;
            const collapsed = wrap.classList.toggle('is-collapsed');
            const lbl = btn.querySelector('.rmt-label');
            if (lbl) lbl.textContent = collapsed ? 'Leer más' : 'Mostrar menos';
        },

        renderThreadCard(t) {
            // Defensivo: aseguramos shape mínimo en hilos potencialmente legacy
            t.likes    = Array.isArray(t.likes)    ? t.likes    : [];
            t.comments = Array.isArray(t.comments) ? t.comments : [];

            // Usamos siempre la pfp más reciente del cache de users (refleja cambios en tiempo real
            // si el autor actualizó su foto), no la guardada en el thread al momento de crearlo.
            const _authorCached = App.db.users.find(u => String(u.id) === String(t.authorId));
            const userRole = App.auth.getUserRole(t.authorId);
            const isLiked = t.likes.includes(App.db.session?.id);
            const pfp = escapeHtml(_authorCached?.pfp || t.pfp || DEFAULT_PFP);
            const author = escapeHtml(_authorCached?.name || t.author || 'Anónimo');
            // Hilos nuevos guardan HTML rico (isRich=true). Antiguos eran texto plano.
            // Auto-embed: convierte URLs de YouTube en texto a iframes (sin duplicar la URL).
            const raw = t.isRich ? sanitizeRichHtml(t.content) : escapeHtml(t.content);
            const contentEmbedded = autoEmbedYouTubeInHtml(raw);
            const contentRehydrated = rehydrateYouTubeFacades(contentEmbedded);
            const contentRaw = enhanceVideoPlayers(contentRehydrated);
            const content = this._wrapLongContent(contentRaw, t.id);
            const freshClass = t._fresh ? ' news-fresh' : '';
            const botBadge = t.isBot
                ? '<span class="bot-badge"><i class="fas fa-satellite-dish"></i> IA · Noticia Local</span>'
                : '';
            const sessionId = App.db.session?.id;
            const canDelete = sessionId && (t.authorId === sessionId || App.db.session.role === 'admin');
            const deleteBtn = canDelete
                ? `<button class="thread-delete" onclick="App.forum.deleteThread('${t.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>`
                : '';
            const outlet = t.outletId ? App.db.outlets.find(o => o.id === t.outletId) : null;
            // Si tenemos URL exacta del post, esa gana sobre la URL de la página
            const sourceHref = t.sourceUrl || outlet?.url;
            const outletChip = outlet
                ? `<a class="outlet-chip" href="${escapeHtml(sourceHref)}" target="_blank" rel="noopener noreferrer" title="${t.sourceUrl ? 'Post original' : 'Página oficial'}">
                       Vía ${escapeHtml(outlet.name)} <i class="fas fa-arrow-up-right-from-square"></i>
                   </a>`
                : '';
            const reactions = t.reactions && Object.keys(t.reactions).length
                ? `<div class="thread-reactions">${Object.entries(t.reactions).map(([emoji, users]) => `
                    <button class="reaction-chip${users.includes(App.db.session?.id) ? ' mine' : ''}"
                            onclick="App.social.react('${t.id}', '${escapeJsAttr(emoji)}')">
                        <span class="rx-emoji">${emoji}</span><span class="rx-count">${users.length}</span>
                    </button>`).join('')}</div>`
                : '';
            const authorProfile = App.db.users.find(u => String(u.id) === String(t.authorId));
            const statusDot = App.ui.statusDotHTML?.(authorProfile) || '';
            const customStatus = App.ui.customStatusHTML?.(authorProfile) || '';
            return `
                <div class="thread-card glass-card${freshClass}" data-thread-id="${t.id}">
                    ${deleteBtn}
                    <div class="t-header">
                        <div class="pfp-with-status" onclick="App.ui.showUserPopover(this, '${t.authorId}')">
                            <img src="${pfp}" class="mini-pfp">
                            ${statusDot}
                        </div>
                        <div class="t-info">
                            <span class="username-${userRole}" onclick="App.ui.showUserPopover(this, '${t.authorId}')">${author}</span>
                            ${customStatus}
                            ${botBadge}
                            ${outletChip}
                        </div>
                    </div>
                    <div class="thread-content">${content}</div>
                    ${reactions}
                    <div class="thread-actions">
                        <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="App.social.toggleLike('${t.id}')" title="Me gusta">
                            <i class="fas fa-heart"></i> ${t.likes.length}
                        </button>
                        <button class="action-btn" onclick="App.ui.showReactionPicker(this, '${t.id}')" title="Reaccionar">
                            <i class="fas fa-face-smile"></i>
                        </button>
                        <button class="action-btn" onclick="App.ui.toggleCommentBox('${t.id}')" title="Comentar">
                            <i class="fas fa-comment"></i> ${t.comments.length}
                        </button>
                        <button class="action-btn" onclick="App.social.saveThread('${t.id}')" title="Guardar">
                            <i class="fas fa-bookmark"></i>
                        </button>
                        <button class="action-btn" onclick="App.social.shareThread('${t.id}')" title="Compartir">
                            <i class="fas fa-share"></i>
                        </button>
                    </div>
                    <div id="comment-box-${t.id}" class="hidden">
                        ${this.renderComments(t.comments, t.id)}
                        <input type="text" placeholder="Comenta..." class="input-comment" onkeypress="if(event.key==='Enter') {App.forum.addComment('${t.id}', this.value); this.value=''; App.forum.render();}">
                    </div>
                </div>
            `;
        },

        renderComments(comments, threadId, indent = 0) {
            if (!Array.isArray(comments)) return '';
            return comments.map(c => {
                c.likes   = Array.isArray(c.likes)   ? c.likes   : [];
                c.replies = Array.isArray(c.replies) ? c.replies : [];
                const raw = c.isRich ? sanitizeRichHtml(c.content) : escapeHtml(c.content);
                const body = autoEmbedYouTubeInHtml(raw);
                return `
                <div class="comment" style="margin-left: ${indent * 20}px;">
                    <div class="comment-header">
                        <img src="${escapeHtml(c.pfp || DEFAULT_PFP)}" class="comment-pfp">
                        <span><b>${escapeHtml(c.author || 'Anónimo')}</b></span>
                        <small style="color:var(--text-dim);font-size:0.7rem;margin-left:auto;">${App.ui.timeAgo(c.timestamp)}</small>
                    </div>
                    <div class="comment-body">${body}</div>
                    <div class="comment-actions">
                        <button onclick="App.social.toggleLike('${threadId}', true, '${c.id}')">❤️ ${c.likes.length}</button>
                        <button onclick="App.ui.openReplyEditor('${threadId}', '${c.id}')"><i class="fas fa-reply"></i> Responder</button>
                    </div>
                    ${c.replies.length > 0 ? this.renderComments(c.replies, threadId, indent + 1) : ''}
                </div>
            `;
            }).join('');
        },

        // Borra un hilo. El autor puede borrar el suyo; admin puede borrar cualquiera.
        // Espera la confirmación de Supabase ANTES de quitar del cache local —
        // así si Supabase rechaza (RLS, permiso, conexión) el hilo NO desaparece
        // localmente sin estar borrado realmente.
        async deleteThread(threadId) {
            const t = App.db.threads.find(x => x.id === threadId);
            if (!t) return false;
            const session = App.db.session;
            if (!session) { App.ui.toast('Inicia sesión primero', 'warning'); return false; }
            const isOwner = String(t.authorId) === String(session.id);
            const isAdmin = session.role === 'admin';
            if (!isOwner && !isAdmin) {
                App.ui.toast('No puedes borrar publicaciones de otros usuarios', 'error');
                return false;
            }
            if (!confirm(`¿Eliminar este hilo definitivamente? Esta acción no se puede deshacer.`)) return false;

            // 1) Borrado en Supabase PRIMERO. Si falla, no tocamos local.
            const ok = await App.sb.deleteThread(threadId);
            if (!ok) {
                // El toast de error ya lo emite App.sb.deleteThread.
                return false;
            }

            // 2) Borrado local solo si Supabase confirmó.
            App.db.threads = App.db.threads.filter(x => x.id !== threadId);
            App.db.save();
            App.ui.toast('Hilo eliminado', 'success');

            // Re-render según contexto
            const route = App.ui.state.currentRoute;
            App.ui.navigate(route);
            if (!document.getElementById('settings-modal')?.classList.contains('hidden')) {
                App.ui.renderActivityTab();
            }
            return true;
        },

        renderThread(threadId) {
            const card = document.querySelector(`[data-thread-id="${threadId}"]`);
            if (!card) return;
            const thread = App.db.threads.find(t => t.id === threadId);
            if (!thread) return;

            // Preservar si la caja de comentarios estaba abierta
            const wasOpen = card.querySelector(`#comment-box-${threadId}`)
                && !card.querySelector(`#comment-box-${threadId}`).classList.contains('hidden');

            // Usar el render correcto según la ruta actual
            const useNewsLayout = App.ui.state.currentRoute === 'noticias';
            const html = useNewsLayout ? this.renderNewsCard(thread) : this.renderThreadCard(thread);

            // Reemplazar el NODO ENTERO (no innerHTML — anidaría una card dentro de otra)
            card.outerHTML = html;

            if (wasOpen) {
                document.getElementById(`comment-box-${threadId}`)?.classList.remove('hidden');
            }
        }
    },

    // ========== MÓDULO 4: SISTEMA SOCIAL (Likes, Guardado, Compartir) ==========
    social: {
        toggleLike(threadId, isComment = false, commentId = null) {
            if (!App.db.session) {
                App.ui.toast('Debes iniciar sesión', 'warning');
                return;
            }

            const thread = App.db.threads.find(t => t.id === threadId);
            if (!thread) return;

            if (!isComment) {
                const idx = thread.likes.indexOf(App.db.session.id);
                if (idx > -1) {
                    thread.likes.splice(idx, 1);
                } else {
                    thread.likes.push(App.db.session.id);
                    App.notifications.create(thread.authorId, 'like', App.db.session.name, threadId);
                }
                App.sb.toggleLikeRemote(threadId, false);
            } else {
                const findAndToggleLike = (comments) => {
                    for (let c of comments) {
                        if (c.id === commentId) {
                            const idx = c.likes.indexOf(App.db.session.id);
                            if (idx > -1) {
                                c.likes.splice(idx, 1);
                            } else {
                                c.likes.push(App.db.session.id);
                            }
                            return;
                        }
                        findAndToggleLike(c.replies);
                    }
                };
                findAndToggleLike(thread.comments);
                App.sb.toggleLikeRemote(commentId, true);
            }

            App.db.save();
            App.forum.renderThread(threadId);
        },

        saveThread(threadId) {
            if (!App.db.session) {
                App.ui.toast('Debes iniciar sesión', 'warning');
                return;
            }

            const userId = App.db.session.id;
            if (!App.db.bookmarks[userId]) {
                App.db.bookmarks[userId] = [];
            }

            const idx = App.db.bookmarks[userId].indexOf(threadId);
            if (idx > -1) {
                App.db.bookmarks[userId].splice(idx, 1);
                App.ui.toast('Eliminado de guardados', 'info');
            } else {
                App.db.bookmarks[userId].push(threadId);
                App.ui.toast('Guardado correctamente', 'success');
            }
            App.db.save();
        },

        // Abre el modal de compartir con opciones internas + externas (Web Share API).
        shareThread(threadId) {
            const thread = App.db.threads.find(t => String(t.id) === String(threadId));
            if (!thread) return;
            App.ui.openShareSheet?.(thread);
        },

        // Repostear (publicar como hilo propio citando el original).
        // Se llama desde el sheet de compartir → "Repostear con comentario".
        repostThread(threadId) {
            if (!App.db.session) {
                App.ui.toast('Debes iniciar sesión', 'warning');
                App.ui.openAuth?.();
                return;
            }
            const thread = App.db.threads.find(t => String(t.id) === String(threadId));
            if (!thread) return;
            const quote = prompt('Añade tu comentario al repostear:');
            if (quote === null) return;
            App.ui.closeShareSheet?.();

            // Reutilizamos el flujo de createThread para que se sincronice a Supabase.
            const content = quote
                ? `📌 ${quote}\n\n"${(thread.content || '').replace(/<[^>]+>/g, '').slice(0, 280)}"\n— ${thread.author}`
                : `🔁 Reposteado de @${thread.author}\n\n"${(thread.content || '').replace(/<[^>]+>/g, '').slice(0, 280)}"`;
            App.forum.createThread(content, thread.category || 'general', [], thread.outletId, false);
            App.ui.toast('Reposteado en tu muro', 'success');
        },

        // ============ BLOQUEAR / SILENCIAR ============
        // Helpers de estado (lectura del cache local)
        isBlocked(userId) {
            const me = App.db.session?.id;
            if (!me) return false;
            return Array.isArray(App.db.blockedUsers?.[me]) && App.db.blockedUsers[me].includes(userId);
        },
        isMuted(userId) {
            const me = App.db.session?.id;
            if (!me) return false;
            App.db.mutes = App.db.mutes || {};
            return Array.isArray(App.db.mutes[me]) && App.db.mutes[me].includes(userId);
        },

        // BLOCK: tú no ves sus publicaciones, ni él ve las tuyas (vía RLS futuro), ni puede chatearte.
        async toggleBlockUser(targetUserId) {
            if (!App.db.session) { App.ui.toast('Inicia sesión primero', 'warning'); return; }
            const me = App.db.session.id;
            if (String(me) === String(targetUserId)) { App.ui.toast('No puedes bloquearte a ti mismo', 'warning'); return; }

            App.db.blockedUsers = App.db.blockedUsers || {};
            App.db.blockedUsers[me] = App.db.blockedUsers[me] || [];
            const idx = App.db.blockedUsers[me].indexOf(targetUserId);
            const now = idx > -1; // ya estaba bloqueado → desbloquear
            if (now) App.db.blockedUsers[me].splice(idx, 1);
            else     App.db.blockedUsers[me].push(targetUserId);
            App.db.save();

            // Sync con Supabase
            if (window.SB) {
                if (now) {
                    await SB.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', targetUserId);
                } else {
                    await SB.from('blocks').insert({ blocker_id: me, blocked_id: targetUserId });
                }
            }
            App.forum.render?.();
            App.ui.toast(now ? 'Usuario desbloqueado' : '🚫 Usuario bloqueado', 'info');
        },

        // MUTE: tú no ves sus publicaciones en el feed, pero él sigue viéndote a ti.
        async toggleMuteUser(targetUserId) {
            if (!App.db.session) { App.ui.toast('Inicia sesión primero', 'warning'); return; }
            const me = App.db.session.id;
            if (String(me) === String(targetUserId)) { App.ui.toast('No puedes silenciarte a ti mismo', 'warning'); return; }

            App.db.mutes = App.db.mutes || {};
            App.db.mutes[me] = App.db.mutes[me] || [];
            const idx = App.db.mutes[me].indexOf(targetUserId);
            const now = idx > -1;
            if (now) App.db.mutes[me].splice(idx, 1);
            else     App.db.mutes[me].push(targetUserId);
            try { localStorage.setItem('tv_mutes', JSON.stringify(App.db.mutes)); } catch (_) {}

            if (window.SB) {
                if (now) {
                    await SB.from('mutes').delete().eq('muter_id', me).eq('muted_id', targetUserId);
                } else {
                    await SB.from('mutes').insert({ muter_id: me, muted_id: targetUserId });
                }
            }
            App.forum.render?.();
            App.ui.toast(now ? 'Usuario activado' : '🔇 Usuario silenciado', 'info');
        },

        // Compat con código viejo que llamaba blockUser por nombre
        blockUser(username) {
            const u = App.db.users.find(x => x.name === username);
            if (u) this.toggleBlockUser(u.id);
        },

        // Sincroniza desde Supabase las listas de blocks y mutes del usuario actual.
        async syncBlocksMutes() {
            if (!window.SB || !App.db.session) return;
            const me = App.db.session.id;
            try {
                const [{ data: blocks }, { data: mutes }] = await Promise.all([
                    SB.from('blocks').select('blocked_id').eq('blocker_id', me),
                    SB.from('mutes').select('muted_id').eq('muter_id', me)
                ]);
                App.db.blockedUsers = App.db.blockedUsers || {};
                App.db.blockedUsers[me] = (blocks || []).map(b => b.blocked_id);
                App.db.mutes = App.db.mutes || {};
                App.db.mutes[me] = (mutes || []).map(m => m.muted_id);
                App.forum?.render?.();
            } catch (e) { console.warn('[social] syncBlocksMutes:', e); }
        },

        async toggleFollow(username) {
            if (!App.db.session) {
                App.ui.toast('Debes iniciar sesión', 'warning');
                return;
            }

            const userId = App.db.session.id;
            if (!App.db.following[userId]) App.db.following[userId] = [];

            const userToFollow = App.db.users.find(u => u.name === username);
            if (!userToFollow) return;

            const idx = App.db.following[userId].indexOf(userToFollow.id);
            const wasFollowing = idx > -1;

            // Optimistic UI: actualizar local primero
            if (wasFollowing) {
                App.db.following[userId].splice(idx, 1);
                userToFollow.followers = Math.max(0, (userToFollow.followers || 0) - 1);
            } else {
                App.db.following[userId].push(userToFollow.id);
                userToFollow.followers = (userToFollow.followers || 0) + 1;
            }
            App.ui.updateHeader();
            App.ui.renderUnifiedSidebar();

            // Persistir a Supabase (única fuente de verdad)
            if (window.SB) {
                try {
                    if (wasFollowing) {
                        const { error } = await SB.from('follows')
                            .delete()
                            .eq('follower_id', userId)
                            .eq('followed_id', userToFollow.id);
                        if (error) throw error;
                    } else {
                        const { error } = await SB.from('follows')
                            .insert({ follower_id: userId, followed_id: userToFollow.id });
                        if (error) throw error;
                        // Notificación al usuario seguido
                        App.notifications.create(userToFollow.id, 'follow', App.db.session.name);
                    }
                } catch (e) {
                    console.error('[follow] error en Supabase, revirtiendo:', e);
                    // Rollback de la UI optimista
                    if (wasFollowing) {
                        App.db.following[userId].push(userToFollow.id);
                        userToFollow.followers = (userToFollow.followers || 0) + 1;
                    } else {
                        const i = App.db.following[userId].indexOf(userToFollow.id);
                        if (i > -1) App.db.following[userId].splice(i, 1);
                        userToFollow.followers = Math.max(0, (userToFollow.followers || 0) - 1);
                    }
                    App.ui.toast('No se pudo actualizar el follow', 'error');
                    App.ui.renderUnifiedSidebar();
                }
            }
        },

        // ===== REACCIONES =====
        REACTION_EMOJIS: ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏'],

        react(threadId, emoji) {
            if (!App.db.session) { App.ui.toast('Debes iniciar sesión', 'warning'); return; }
            const t = App.db.threads.find(x => x.id === threadId);
            if (!t) return;
            if (!t.reactions) t.reactions = {};
            const userId = App.db.session.id;

            // Una reacción por usuario: lo quitamos de las demás primero
            const wasSame = (t.reactions[emoji] || []).includes(userId);
            Object.keys(t.reactions).forEach(e => {
                t.reactions[e] = t.reactions[e].filter(id => id !== userId);
                if (t.reactions[e].length === 0) delete t.reactions[e];
            });
            if (!wasSame) {
                if (!t.reactions[emoji]) t.reactions[emoji] = [];
                t.reactions[emoji].push(userId);
                App.notifications.create(t.authorId, 'like', App.db.session.name, threadId);
            }
            App.sb.setReactionRemote(threadId, emoji, !wasSame);
            App.db.save();
            App.forum.renderThread(threadId);
        },

        // ===== SEGUIDORES (inverso de following) =====
        getFollowers(userId) {
            const followers = [];
            Object.entries(App.db.following).forEach(([followerId, followedIds]) => {
                if (Array.isArray(followedIds) && followedIds.includes(userId)) {
                    const u = App.db.users.find(u => u.id == followerId);
                    if (u) followers.push(u);
                }
            });
            return followers;
        },

        getFollowing(userId) {
            const ids = App.db.following[userId] || [];
            return ids.map(id => App.db.users.find(u => u.id === id)).filter(Boolean);
        },

        getUserReactions(userId) {
            return App.db.threads.filter(t =>
                t.reactions && Object.values(t.reactions).some(arr => arr.includes(userId))
            );
        },

        getUserComments(userId) {
            const out = [];
            const walk = (comments, threadId) => {
                comments.forEach(c => {
                    if (c.authorId === userId) out.push({ ...c, threadId });
                    if (c.replies?.length) walk(c.replies, threadId);
                });
            };
            App.db.threads.forEach(t => walk(t.comments || [], t.id));
            return out;
        },

        // ===== SOLICITUD DE AMISTAD =====
        // Delega al módulo App.friends que persiste en Supabase con realtime.
        // Esta función queda como alias retrocompatible: muchos botones del
        // perfil/popover ya la llaman por nombre.
        sendFriendRequest(username) {
            return App.friends?.sendRequest?.(username);
        }
    },

    // ========== MÓDULO 5: BÚSQUEDA UNIVERSAL ==========
    search: {
        // Strip de etiquetas HTML para búsqueda en texto plano
        stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); },

        // Highlight de coincidencias en texto plano (devuelve HTML escapado con <span class="highlight">)
        highlight(text, query) {
            if (!text || !query) return escapeHtml(text || '');
            const re = new RegExp(escapeRegex(query), 'gi');
            const safe = escapeHtml(text);
            // Construimos el regex sobre el texto escapado (lowercase para HTML básico es seguro aquí)
            return safe.replace(re, m => `<span class="highlight">${m}</span>`);
        },

        // Snippet centrado en la primera coincidencia
        snippet(text, query, len = 140) {
            const plain = this.stripHtml(text);
            if (!plain) return '';
            const idx = plain.toLowerCase().indexOf(query.toLowerCase());
            if (idx === -1) return plain.slice(0, len) + (plain.length > len ? '…' : '');
            const start = Math.max(0, idx - 40);
            const end   = Math.min(plain.length, idx + query.length + 100);
            return (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '');
        },

        execute(query) {
            const q = (query || '').trim().toLowerCase();
            if (!q) return { query: '', users: [], threads: [], businesses: [], outlets: [] };

            const users = App.db.users.filter(u =>
                u.name?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.bio?.toLowerCase().includes(q)
            );

            const threads = App.db.threads.filter(t => {
                const text = this.stripHtml(t.content).toLowerCase();
                return text.includes(q) ||
                       t.author?.toLowerCase().includes(q) ||
                       t.category?.toLowerCase().includes(q);
            });

            const businesses = (App.db.businesses || []).filter(b =>
                b.name?.toLowerCase().includes(q) ||
                b.category?.toLowerCase().includes(q) ||
                b.address?.toLowerCase().includes(q)
            );

            const outlets = (App.db.outlets || []).filter(o =>
                o.name?.toLowerCase().includes(q)
            );

            return { query: q, users, threads, businesses, outlets };
        },

        // Fallback: si el cache local está vacío (bootstrap aún cargando o falló),
        // consulta a Supabase en vivo. Útil para que el buscador NUNCA muestre cero
        // resultados solo porque los datos no se han cargado todavía.
        async executeLive(query) {
            const q = (query || '').trim();
            if (!q || !window.SB) return this.execute(q);

            // Primero intentamos cache local
            const local = this.execute(q);
            const localTotal = local.users.length + local.threads.length + local.businesses.length;
            if (localTotal > 0 || App.db.users.length > 0) return local;

            // Cache vacío → consulta directa a Supabase (3 queries en paralelo)
            try {
                const ql = q.toLowerCase();
                const [profsRes, threadsRes, bizRes] = await Promise.all([
                    SB.from('profiles')
                      .select('id, username, email, pfp, banner, bio, role, badges, online_status, custom_status, custom_status_emoji, last_seen')
                      .or(`username.ilike.%${ql}%,email.ilike.%${ql}%,bio.ilike.%${ql}%`)
                      .limit(20),
                    SB.from('threads')
                      .select('id, content, category, created_at, author:profiles!threads_author_id_fkey(id, username, pfp, role)')
                      .ilike('content', `%${ql}%`)
                      .order('created_at', { ascending: false })
                      .limit(20),
                    SB.from('businesses')
                      .select('id, name, category, address, phone')
                      .or(`name.ilike.%${ql}%,category.ilike.%${ql}%,address.ilike.%${ql}%`)
                      .limit(20)
                ]);

                const liveUsers = (profsRes.data || []).map(p => ({
                    id: p.id, name: p.username, email: p.email || '', pfp: p.pfp || DEFAULT_PFP,
                    banner: p.banner || '', bio: p.bio || '', role: p.role || 'citizen',
                    badges: p.badges || [], online_status: p.online_status,
                    custom_status: p.custom_status, custom_status_emoji: p.custom_status_emoji,
                    last_seen: p.last_seen
                }));
                const liveThreads = (threadsRes.data || []).map(t => ({
                    id: t.id, content: t.content, category: t.category, timestamp: t.created_at,
                    authorId: t.author?.id, author: t.author?.username || 'Anónimo',
                    pfp: t.author?.pfp || DEFAULT_PFP, isRich: true, likes: [], comments: [], reactions: {}
                }));
                const liveBiz = bizRes.data || [];

                return {
                    query: ql, users: liveUsers, threads: liveThreads, businesses: liveBiz,
                    outlets: (App.db.outlets || []).filter(o => o.name?.toLowerCase().includes(ql))
                };
            } catch (e) {
                console.warn('[search] live fallback falló:', e);
                return local;
            }
        }
    },

    // ========== MÓDULO 6: NOTIFICACIONES ==========
    notifications: {
        create(targetUserId, type, sourceUserName, threadId = null) {
            if (!targetUserId) return;

            // Si el origen es admin y la acción es ruidosa, no generamos notificación.
            // (Follow / friend_request / new_thread sí pasan — son intencionales)
            const NOISY = ['like', 'comment'];
            if (App.db.session?.role === 'admin' && NOISY.includes(type)) return;

            // No notificar al propio usuario por sus propias acciones
            if (App.db.session?.id === targetUserId) return;

            const notification = {
                id: Date.now() + Math.random(),
                targetUserId,
                type,
                sourceUserName,
                sourceUserId: App.db.session?.id || null,
                threadId,
                read: false,
                timestamp: new Date().toISOString()
            };

            App.db.notifications.push(notification);
            App.db.save();
        },

        // Solo notificaciones de ADMIN o de usuarios que el target sigue.
        // (system y friend_request se muestran siempre — son fundamentales)
        _isVisible(noti, targetUserId) {
            if (noti.type === 'system' || noti.type === 'friend_request') return true;
            const followed = App.db.following[targetUserId] || [];
            const source = App.db.users.find(u => u.id === noti.sourceUserId);
            if (!source) return false;
            if (source.role === 'admin') return true;
            if (followed.includes(source.id)) return true;
            return false;
        },

        getForUser(userId) {
            return App.db.notifications
                .filter(n => n.targetUserId === userId && this._isVisible(n, userId))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        },

        markAsRead(notiId) {
            const noti = App.db.notifications.find(n => n.id === notiId);
            if (noti) noti.read = true;
            App.db.save();
        },

        getUnreadCount(userId) {
            return App.db.notifications
                .filter(n => n.targetUserId === userId && !n.read && this._isVisible(n, userId))
                .length;
        },

        markAllRead() {
            if (!App.db.session) return;
            const uid = App.db.session.id;
            App.db.notifications.forEach(n => {
                if (n.targetUserId === uid && this._isVisible(n, uid)) n.read = true;
            });
            App.db.save();
            App.ui.updateHeader();
            App.ui.renderNotificationsRoute();
            App.ui.toast('Notificaciones marcadas como leídas', 'success');
        }
    },

    // ========== MÓDULO 7: CONFIGURACIÓN Y PRIVACIDAD ==========
    settings: {
        async updateProfile(newName, newBio, newPfpBase64, newBanner) {
            if (!App.db.session) return;

            if (newName) App.db.session.name = newName;
            App.db.session.bio = newBio;

            if (newPfpBase64) {
                App.db.session.pfp = newPfpBase64;
                App.db.threads.forEach(t => {
                    if (t.authorId === App.db.session.id) t.pfp = newPfpBase64;
                });
            }

            if (newBanner === '__REMOVE__') {
                App.db.session.banner = '';
            } else if (newBanner) {
                App.db.session.banner = newBanner;
            }

            const userIdx = App.db.users.findIndex(u => u.id === App.db.session.id);
            if (userIdx > -1) App.db.users[userIdx] = App.db.session;

            App.db.save();
            App.tempProfilePic = null;
            App.tempBanner = null;

            // Sincronizar con Supabase para que otros usuarios vean los cambios.
            if (window.SB) {
                const fields = {
                    username: App.db.session.name,
                    bio: App.db.session.bio || '',
                    pfp: App.db.session.pfp || '',
                    banner: App.db.session.banner || ''
                };
                const { error } = await SB.from('profiles').update(fields).eq('id', App.db.session.id);
                if (error) {
                    console.error('[settings] update profile remote:', error);
                    App.ui.toast('Cambios guardados local, error al sincronizar con la nube', 'warning');
                } else {
                    App.ui.updateHeader();
                    App.ui.navigate(App.ui.state.currentRoute);
                    App.ui.toast('Perfil actualizado', 'success');
                    return;
                }
            }
            App.ui.updateHeader();
            App.ui.navigate(App.ui.state.currentRoute);
            App.ui.toast('Perfil actualizado (local)', 'success');
        },

        changeTheme(themeName) {
            const themes = {
                'cyber-cian': { '--bg': '#0a0a0c', '--bg-elevated':'#131319', '--bg-card':'#15151c', '--accent': '#00d2ff', '--accent-2':'#3a7bd5', '--accent-grad': 'linear-gradient(135deg,#00d2ff,#3a7bd5)', '--text': '#fff', '--text-dim': '#9ca3af' },
                'dark':       { '--bg': '#0d0d0d', '--bg-elevated':'#1a1a1a', '--bg-card':'#1c1c1c', '--accent': '#f39c12', '--accent-2':'#e67e22', '--accent-grad': 'linear-gradient(135deg,#f39c12,#e67e22)', '--text': '#fff', '--text-dim': '#aaa' },
                'light':      { '--bg': '#f5f5f7', '--bg-elevated':'#fff',    '--bg-card':'#fff',    '--accent': '#5e72e4', '--accent-2':'#825ee4', '--accent-grad': 'linear-gradient(135deg,#5e72e4,#825ee4)', '--text': '#1f2937', '--text-dim': '#6b7280' },
                'retro':      { '--bg': '#0f0f1e', '--bg-elevated':'#1a1a2e', '--bg-card':'#1e1e36', '--accent': '#ff006e', '--accent-2':'#8338ec', '--accent-grad': 'linear-gradient(135deg,#ff006e,#8338ec)', '--text': '#fffb00', '--text-dim': '#c084fc' },
                'sunset':     { '--bg': '#1a0a14', '--bg-elevated':'#2a1320', '--bg-card':'#2e1828', '--accent': '#ff8c00', '--accent-2':'#ff006e', '--accent-grad': 'linear-gradient(135deg,#ff8c00,#ff006e)', '--text': '#fff5e6', '--text-dim': '#fbb6a3' },
                'ocean':      { '--bg': '#020a14', '--bg-elevated':'#0a1830', '--bg-card':'#0e1f3d', '--accent': '#06b6d4', '--accent-2':'#0e4d92', '--accent-grad': 'linear-gradient(135deg,#06b6d4,#0e4d92)', '--text': '#e0f7ff', '--text-dim': '#7dd3fc' },
                'forest':     { '--bg': '#0a1410', '--bg-elevated':'#13241c', '--bg-card':'#172e23', '--accent': '#22c55e', '--accent-2':'#0f766e', '--accent-grad': 'linear-gradient(135deg,#22c55e,#0f766e)', '--text': '#ecfdf5', '--text-dim': '#86efac' },
                'synthwave':  { '--bg': '#0a0014', '--bg-elevated':'#1a0a2e', '--bg-card':'#1f0f38', '--accent': '#ff00ff', '--accent-2':'#00d2ff', '--accent-grad': 'linear-gradient(135deg,#ff00ff,#00d2ff)', '--text': '#fff', '--text-dim': '#ff7fdd' },
                'crimson':    { '--bg': '#140505', '--bg-elevated':'#240a0a', '--bg-card':'#2a0c0c', '--accent': '#dc2626', '--accent-2':'#7f1d1d', '--accent-grad': 'linear-gradient(135deg,#dc2626,#7f1d1d)', '--text': '#fee2e2', '--text-dim': '#fca5a5' },
                'lavender':   { '--bg': '#0e0a1c', '--bg-elevated':'#1c1432', '--bg-card':'#22183a', '--accent': '#a78bfa', '--accent-2':'#6d28d9', '--accent-grad': 'linear-gradient(135deg,#a78bfa,#6d28d9)', '--text': '#f3eaff', '--text-dim': '#c4b5fd' },
                'mono':       { '--bg': '#0a0a0a', '--bg-elevated':'#161616', '--bg-card':'#1a1a1a', '--accent': '#fff',    '--accent-2':'#737373', '--accent-grad': 'linear-gradient(135deg,#fff,#737373)', '--text': '#fff', '--text-dim': '#a3a3a3' },
                'mint':       { '--bg': '#03171a', '--bg-elevated':'#072528', '--bg-card':'#0a2e32', '--accent': '#10b981', '--accent-2':'#06b6d4', '--accent-grad': 'linear-gradient(135deg,#10b981,#06b6d4)', '--text': '#ecfeff', '--text-dim': '#67e8f9' }
            };

            const theme = themes[themeName];
            if (!theme) return;
            Object.entries(theme).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
            App.db.themes = themeName;
            App.db.save();
            App.ui.toast(`Tema ${themeName} aplicado`, 'success');
        },

        // Eliminación REAL de la cuenta: llama a la RPC `delete_my_account`
        // de Supabase que borra el profile (cascade limpia threads, comments,
        // follows, likes, etc.) y el row en auth.users. Después logout.
        async deleteAccount() {
            if (!App.db.session) return;
            if (!window.SB) {
                App.ui.toast('Supabase no disponible', 'error');
                return;
            }

            if (!confirm('⚠️ ¿Estás seguro? Esto BORRARÁ permanentemente tu cuenta, todas tus publicaciones, comentarios y conversaciones. NO se puede deshacer.')) return;
            if (!confirm('Última confirmación: ¿estás 100% seguro de eliminar tu cuenta?')) return;

            App.ui.toast('Eliminando cuenta...', 'info');

            const { data, error } = await SB.rpc('delete_my_account');
            if (error) {
                console.error('[deleteAccount]', error);
                if (/function.*does not exist|delete_my_account/i.test(error.message || '')) {
                    App.ui.toast('Falta ejecutar supabase-schema-update-10.sql', 'error');
                } else {
                    App.ui.toast('Error: ' + (error.message || 'desconocido'), 'error');
                }
                return;
            }
            if (!data) {
                App.ui.toast('No se pudo eliminar la cuenta · contacta admin', 'error');
                return;
            }

            // Limpiar TODO el estado local y cerrar sesión
            try {
                await SB.auth.signOut();
            } catch (_) {}

            App.db.session = null;
            App.db.users = [];
            App.db.threads = [];
            App.db.bookmarks = {};
            App.db.blockedUsers = {};
            App.db.following = {};
            App.db.notifications = [];
            App.db.mutes = {};
            App.db.notifyOn = {};
            App.db.save();

            // Limpiar localStorage Supabase también
            try {
                Object.keys(localStorage).forEach(k => {
                    if (k.startsWith('sb-') || k === 'tv-sb-session') localStorage.removeItem(k);
                });
            } catch (_) {}

            App.ui.toast('✅ Cuenta eliminada · adiós', 'success');
            setTimeout(() => location.reload(), 1200);
        },

        getSavedThreads() {
            if (!App.db.session) return [];
            const savedIds = App.db.bookmarks[App.db.session.id] || [];
            return App.db.threads.filter(t => savedIds.includes(t.id));
        },

        getUserThreads() {
            if (!App.db.session) return [];
            return App.db.threads.filter(t => t.authorId === App.db.session.id);
        },

        getUserLikes() {
            if (!App.db.session) return [];
            return App.db.threads.filter(t => Array.isArray(t.likes) && t.likes.includes(App.db.session.id));
        }
    },

    // ========== MÓDULO 8: PROCESAMIENTO MULTIMEDIA ==========
    mediaOps: {
        compressImage(base64Data, maxWidth = 800, quality = 0.7) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (maxWidth * height) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = base64Data;
            });
        },

        validateFile(file) {
            const maxSize = 2 * 1024 * 1024; // 2MB
            if (file.size > maxSize) {
                alert("❌ Archivo demasiado grande (máx 2MB)");
                return false;
            }
            return true;
        },

        generateDocumentCard(fileName, fileSize) {
            const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
            return `
                <div class="doc-card">
                    <i class="fas fa-file-pdf"></i>
                    <p>${fileName}</p>
                    <small>${sizeMB} MB</small>
                    <button class="btn-small">Descargar</button>
                </div>
            `;
        }
    },

    // ========== MÓDULO 9: INTERFAZ DE USUARIO ==========
    ui: {
        // Estado interno de la UI
        state: {
            currentRoute: 'inicio',
            followingExpanded: false
        },

        updateHeader() {
            const btn = document.getElementById('btn-login-trigger');
            const fab = document.getElementById('fab-new-thread');

            // FAB de publicación siempre visible — openEditor maneja el caso sin sesión.
            if (fab) fab.classList.remove('hidden');

            // Marca el body con la clase del rol — el CSS muestra/oculta elementos admin-only
            // automáticamente. Esto centraliza la visibilidad de TODA la UI exclusiva de admin.
            const isAdminSession = App.db.session?.role === 'admin';
            document.body.classList.toggle('is-admin', isAdminSession);
            document.body.classList.toggle('is-media', App.db.session?.role === 'media');
            document.body.classList.toggle('is-logged', !!App.db.session);

            if (App.db.session) {
                const s = App.db.session;
                const dotHTML = this.statusDotHTML?.(s) || '';
                const csEmoji = s.custom_status_emoji ? `<span class="topbar-cs-emoji" title="${escapeHtml(s.custom_status || '')}">${escapeHtml(s.custom_status_emoji)}</span>` : '';
                btn.innerHTML = `
                    <span class="topbar-pfp-wrap">
                        <img src="${escapeHtml(s.pfp || DEFAULT_PFP)}" alt="${escapeHtml(s.name)}" class="topbar-pfp">
                        ${dotHTML}
                    </span>
                    <span class="topbar-username">${escapeHtml(s.name)}</span>
                    ${csEmoji}
                    <i class="fas fa-gear topbar-gear"></i>
                `;
                btn.classList.add('topbar-user-btn');
                btn.onclick = () => this.openSettings();

                const unreadCount = App.notifications.getUnreadCount(App.db.session.id);
                const badge = document.getElementById('notification-badge');
                const sbBadge = document.getElementById('sidebar-noti-badge');
                const bnBadge = document.getElementById('bn-noti-badge');
                if (badge) {
                    badge.innerText = unreadCount;
                    badge.style.display = unreadCount > 0 ? 'block' : 'none';
                }
                if (sbBadge) {
                    sbBadge.innerText = unreadCount;
                    sbBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
                }
                if (bnBadge) {
                    bnBadge.innerText = unreadCount > 99 ? '99+' : unreadCount;
                    bnBadge.style.display = unreadCount > 0 ? 'block' : 'none';
                }
            } else {
                btn.innerText = 'Acceder';
                btn.classList.remove('topbar-user-btn');
                btn.onclick = () => this.openAuth();
                const sbBadge = document.getElementById('sidebar-noti-badge');
                if (sbBadge) sbBadge.style.display = 'none';
                const bnBadge = document.getElementById('bn-noti-badge');
                if (bnBadge) bnBadge.style.display = 'none';
            }

            this.renderUnifiedSidebar();
        },

        // Alias para que el listener realtime de profiles pueda invalidar el header
        // sin tener que pasar por updateHeader entera (que también re-renderiza sidebar).
        refreshHeaderUserCard() {
            this.updateHeader();
        },

        // ===== TOAST =====
        toast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            if (!container) return;
            const t = document.createElement('div');
            t.className = `toast ${type}`;
            t.textContent = message;
            container.appendChild(t);
            requestAnimationFrame(() => t.classList.add('show'));
            setTimeout(() => {
                t.classList.remove('show');
                setTimeout(() => t.remove(), 350);
            }, 3000);
        },

        // ===== TOGGLE DE SIDEBAR (móvil) =====
        toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('sidebar-hidden');
            const isOpen = !sidebar.classList.contains('sidebar-hidden');
            document.body.classList.toggle('sidebar-open', isOpen);
            // En mobile, al abrir sidebar cerrar otros overlays
            if (isOpen && window.innerWidth < 1024) {
                const panel = document.getElementById('notifications-panel');
                if (panel?.classList.contains('visible')) this.toggleNotifications(false);
                if (App.chat?.state?.open) App.chat.closePanel();
            }
        },

        // Heurística simple de estado: en línea si publicó/comentó en las últimas 24h.
        isUserOnline(userId) {
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;
            return App.db.threads.some(t =>
                t.authorId === userId && new Date(t.timestamp).getTime() >= cutoff
            );
        },

        // Devuelve HTML de las insignias de un usuario (cian/medio/oro).
        renderBadges(user) {
            if (!user) return '';
            const isVerified = ['verified', 'admin', 'media'].includes(user.role);
            let html = '';
            if (isVerified) {
                html += '<span class="badge-verified" title="Cuenta verificada"><i class="fas fa-check"></i></span>';
            }
            if (user.role === 'media') {
                html += '<span class="badge-media" title="Medio de comunicación oficial"><i class="fas fa-satellite-dish"></i></span>';
            }
            if (user.role === 'admin') {
                html += '<span class="badge-gold" title="Administrador"><i class="fas fa-crown"></i></span>';
            }
            return html;
        },

        renderUnifiedSidebar() {
            const userCard = document.getElementById('sidebar-user-card');
            const friendsSection    = document.getElementById('sidebar-friends-section');
            const followingSection  = document.getElementById('sidebar-following-section');
            const othersSection     = document.getElementById('sidebar-others-section');
            if (!userCard) return;

            // Tarjeta del usuario actual con pfp + dot de presencia + custom status
            if (App.db.session) {
                const s = App.db.session;
                userCard.classList.remove('hidden');
                userCard.onclick = () => App.ui.openUserProfile(s.id);
                userCard.style.cursor = 'pointer';
                userCard.innerHTML = `
                    <div class="uc-pfp-wrap">
                        <img src="${escapeHtml(s.pfp || DEFAULT_PFP)}" alt="Perfil">
                        ${this.statusDotHTML?.(s) || ''}
                    </div>
                    <div class="uc-info">
                        <div class="uc-name">${escapeHtml(s.name)} ${this.renderBadges(s)}</div>
                        <div class="uc-meta">${this.customStatusHTML?.(s) || `<span style="color:var(--text-dim);">${s.followers || 0} seguidores</span>`}</div>
                    </div>
                `;
            } else {
                userCard.classList.add('hidden');
                userCard.innerHTML = '';
                userCard.onclick = null;
            }

            // Computar grupos: amigos (mutuo), siguiendo (uno-a-uno), otros (resto).
            const sessionId = App.db.session?.id;
            const myFollowing = sessionId ? (App.db.following[sessionId] || []) : [];
            const friendsList = [], followingList = [], othersList = [];

            if (sessionId) {
                const myFollowingSet = new Set(myFollowing.map(String));
                App.db.users.forEach(u => {
                    if (String(u.id) === String(sessionId)) return; // saltar a uno mismo
                    const iFollow = myFollowingSet.has(String(u.id));
                    const theyFollowMe = (App.db.following[u.id] || []).map(String).includes(String(sessionId));
                    if (iFollow && theyFollowMe) friendsList.push(u);
                    else if (iFollow) followingList.push(u);
                    else othersList.push(u);
                });
            }

            // Helper: renderiza una sección genérica (lista + show-more opcional)
            const renderSection = (section, listEl, users, expanded, moreBtnId) => {
                if (!sessionId || users.length === 0) {
                    section.classList.add('hidden');
                    return;
                }
                section.classList.remove('hidden');
                const LIMIT = 8;
                const limit = expanded ? users.length : LIMIT;
                listEl.innerHTML = users.slice(0, limit).map(u => this.renderUserPill(u)).join('');
                if (moreBtnId) {
                    const moreBtn = document.getElementById(moreBtnId);
                    if (!moreBtn) return;
                    if (users.length > LIMIT) {
                        moreBtn.style.display = 'inline-block';
                        moreBtn.innerText = expanded ? 'Ver menos' : `Ver más (${users.length - LIMIT})`;
                    } else moreBtn.style.display = 'none';
                }
            };

            renderSection(friendsSection, document.getElementById('sidebar-friends'), friendsList, true, null);
            renderSection(followingSection, document.getElementById('sidebar-following'), followingList, !!this.state.followingExpanded, 'sidebar-show-more');
            renderSection(othersSection, document.getElementById('sidebar-others'), othersList, !!this.state.othersExpanded, 'sidebar-others-more');
        },

        renderUserPill(user) {
            const sessionId = App.db.session?.id;
            const myFollowing = sessionId ? (App.db.following[sessionId] || []).map(String) : [];
            const isFollowing = myFollowing.includes(String(user.id));
            const isFriend = App.friends?.isFriend?.(user.id) || false;
            const hasOutgoing = App.friends?.hasOutgoingTo?.(user.id) || false;
            const hasIncoming = App.friends?.hasIncomingFrom?.(user.id) || false;
            const notifyOn = !!(App.db.notifyOn && App.db.notifyOn[sessionId] && App.db.notifyOn[sessionId].includes(user.id));

            const dotHTML = this.statusDotHTML?.(user) || '';
            const safeName = escapeHtml(user.name || 'Anónimo');
            const safeNameJs = escapeJsAttr(user.name || '');
            const safeId = escapeJsAttr(String(user.id));
            const subtitle = user.custom_status
                ? `${escapeHtml(user.custom_status_emoji || '')} ${escapeHtml(user.custom_status)}`.trim()
                : `${user.role || 'citizen'}`;

            // Botón de amistad — varía según el estado
            let friendBtn = '';
            if (isFriend) {
                friendBtn = `<button class="pill-icon-btn friend-active" onclick="event.stopPropagation(); if(confirm('¿Eliminar a ${safeName} de tus amigos?')) App.friends.removeFriend('${safeId}');" title="Amigo · click para eliminar">
                                <i class="fas fa-user-check"></i>
                             </button>`;
            } else if (hasIncoming) {
                friendBtn = `<button class="pill-icon-btn friend-incoming" onclick="event.stopPropagation(); App.ui.navigate('red'); App.ui.state.networkTab='solicitudes'; App.ui.renderNetworkRoute('solicitudes');" title="Te envió una solicitud — ir a aceptarla">
                                <i class="fas fa-user-clock"></i>
                             </button>`;
            } else if (hasOutgoing) {
                friendBtn = `<button class="pill-icon-btn friend-pending" disabled title="Solicitud pendiente">
                                <i class="fas fa-hourglass-half"></i>
                             </button>`;
            } else {
                friendBtn = `<button class="pill-icon-btn" onclick="event.stopPropagation(); App.friends.sendRequest('${safeNameJs}');" title="Enviar solicitud de amistad">
                                <i class="fas fa-user-plus"></i>
                             </button>`;
            }

            // Botón de notificaciones — solo si ya lo sigues
            const notifyBtn = isFollowing
                ? `<button class="pill-icon-btn ${notifyOn ? 'notify-on' : ''}" onclick="event.stopPropagation(); App.ui.toggleNotifyUser('${safeId}'); setTimeout(() => App.ui.renderUnifiedSidebar(), 80);" title="${notifyOn ? 'Notificaciones activas (click para silenciar)' : 'Activar notificaciones de sus publicaciones'}">
                       <i class="fas fa-bell${notifyOn ? '' : '-slash'}"></i>
                   </button>`
                : '';

            // Botón de seguir
            const followBtn = `<button class="user-pill-action ${isFollowing ? 'following' : ''}" onclick="event.stopPropagation(); App.social.toggleFollow('${safeNameJs}'); setTimeout(() => App.ui.renderUnifiedSidebar(), 80);" title="${isFollowing ? 'Dejar de seguir' : 'Seguir'}">
                ${isFollowing ? '✓' : 'Seguir'}
            </button>`;

            return `
                <div class="user-pill" onclick="App.ui.openUserProfile('${safeId}')">
                    <div class="avatar-wrap">
                        <img src="${escapeHtml(user.pfp || DEFAULT_PFP)}" alt="${safeName}">
                        ${dotHTML}
                    </div>
                    <div class="user-pill-info">
                        <div class="user-pill-name">${safeName} ${this.renderBadges(user)}</div>
                        <div class="user-pill-sub">${subtitle}</div>
                    </div>
                    <div class="user-pill-actions">
                        ${friendBtn}
                        ${notifyBtn}
                        ${followBtn}
                    </div>
                </div>
            `;
        },

        toggleOthersExpanded() {
            this.state.othersExpanded = !this.state.othersExpanded;
            this.renderUnifiedSidebar();
        },

        // ============ SHARE SHEET (compartir hilo) ============
        // Abre un modal con opciones internas (chat con amigos) y externas (Web Share API).
        async openShareSheet(thread) {
            if (!thread) return;
            const url = `${window.location.origin}${window.location.pathname}#thread/${thread.id}`;
            const text = (thread.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            const previewText = text.slice(0, 140) + (text.length > 140 ? '…' : '');
            const author = thread.author || 'Anónimo';
            const pfp = thread.pfp || DEFAULT_PFP;

            // Lista de últimas conversaciones (chats abiertos)
            let convs = [];
            if (App.db.session && window.SB) {
                if (!App.chat?.state?.conversations?.length) {
                    await App.chat?.refreshConversations?.();
                }
                convs = App.chat?.state?.conversations || [];
            }

            const convsHTML = convs.length === 0
                ? `<div class="share-sheet-empty">${App.db.session ? 'Aún no tienes conversaciones abiertas.' : 'Inicia sesión para enviar a amigos.'}</div>`
                : convs.slice(0, 8).map(c => `
                    <button class="share-sheet-chip" onclick="App.ui._sendThreadToChat('${escapeJsAttr(c.peerId)}', ${JSON.stringify(c.peerName).replace(/"/g, '&quot;')}, ${JSON.stringify(c.peerPfp || DEFAULT_PFP).replace(/"/g, '&quot;')}, '${thread.id}')">
                        <img src="${escapeHtml(c.peerPfp || DEFAULT_PFP)}" alt="">
                        <span>${escapeHtml(c.peerName)}</span>
                    </button>`).join('');

            const canWebShare = !!navigator.share;

            let modal = document.getElementById('share-sheet-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'share-sheet-modal';
                modal.className = 'modal hidden';
                /* Modal NO cierra al click fuera — solo el botón X. */
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <div class="modal-content share-sheet">
                    <button class="close-btn" onclick="App.ui.closeShareSheet()" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                    <h3 class="share-sheet-title"><i class="fas fa-share-nodes"></i> Compartir</h3>

                    <div class="share-sheet-preview">
                        <img src="${escapeHtml(pfp)}" alt="" class="share-sheet-pfp">
                        <div class="share-sheet-pcontent">
                            <b>${escapeHtml(author)}</b>
                            <p>${escapeHtml(previewText)}</p>
                        </div>
                    </div>

                    <h4 class="share-sheet-section">Enviar a un amigo</h4>
                    <div class="share-sheet-chips">${convsHTML}</div>

                    <h4 class="share-sheet-section">Otras opciones</h4>
                    <div class="share-sheet-actions">
                        <button class="share-action-btn" onclick="App.ui._copyShareLink('${escapeJsAttr(url)}')">
                            <i class="fas fa-link"></i><span>Copiar link</span>
                        </button>
                        <button class="share-action-btn" onclick="App.social.repostThread('${thread.id}')">
                            <i class="fas fa-retweet"></i><span>Repostear</span>
                        </button>
                        ${canWebShare ? `
                        <button class="share-action-btn" onclick="App.ui._webShare('${escapeJsAttr(url)}', ${JSON.stringify(`${author}: ${previewText}`).replace(/"/g, '&quot;')})">
                            <i class="fas fa-arrow-up-from-bracket"></i><span>Más apps</span>
                        </button>` : ''}
                        <a class="share-action-btn" href="https://wa.me/?text=${encodeURIComponent(author + ': ' + previewText + ' ' + url)}" target="_blank" rel="noopener">
                            <i class="fab fa-whatsapp"></i><span>WhatsApp</span>
                        </a>
                        <a class="share-action-btn" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(previewText)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">
                            <i class="fab fa-x-twitter"></i><span>X / Twitter</span>
                        </a>
                        <a class="share-action-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">
                            <i class="fab fa-facebook"></i><span>Facebook</span>
                        </a>
                    </div>
                </div>`;
            modal.classList.remove('hidden');
        },

        closeShareSheet() {
            document.getElementById('share-sheet-modal')?.classList.add('hidden');
        },

        async _copyShareLink(url) {
            try {
                await navigator.clipboard.writeText(url);
                this.toast('Link copiado al portapapeles', 'success');
            } catch (e) {
                // Fallback: prompt para copiar manual
                prompt('Copia este link:', url);
            }
            this.closeShareSheet();
        },

        async _webShare(url, text) {
            if (!navigator.share) { this.toast('No disponible en este navegador', 'warning'); return; }
            try {
                await navigator.share({ title: 'Tres Valles', text, url });
                this.closeShareSheet();
            } catch (e) {
                if (e.name !== 'AbortError') console.warn('[share]', e);
            }
        },

        // Envía un thread a una conversación de chat existente.
        async _sendThreadToChat(peerId, peerName, peerPfp, threadId) {
            if (!App.db.session) { this.toast('Inicia sesión primero', 'warning'); return; }
            const thread = App.db.threads.find(t => String(t.id) === String(threadId));
            if (!thread) return;

            const text = (thread.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            const preview = text.slice(0, 200) + (text.length > 200 ? '…' : '');
            const url = `${window.location.origin}${window.location.pathname}#thread/${thread.id}`;
            const message = `📎 Compartido de ${thread.author}:\n\n"${preview}"\n\n${url}`;

            this.closeShareSheet();
            // Abre el chat con esa persona y envía el mensaje
            await App.chat.openWith(peerId, peerName, peerPfp);
            const input = document.getElementById('chat-input');
            if (input) {
                input.value = message;
                await App.chat.sendCurrent();
            }
            this.toast(`Enviado a ${peerName}`, 'success');
        },

        // ============ PANEL DE ADMINISTRACIÓN ============
        // Punto de entrada — navega a la ruta /admin (estilo YouTube Studio)
        // En vez de modal, ahora es una ruta que ocupa el área central del feed.
        openAdminPanel() {
            if (App.db.session?.role !== 'admin') {
                this.toast('Solo admins pueden acceder', 'error');
                return;
            }
            this.state._adminTab = this.state._adminTab || 'users';
            this.navigate('admin');
        },

        // Para compatibilidad con código viejo que llamaba a closeAdminPanel
        closeAdminPanel() {
            // Cerrar modal viejo si por alguna razón aún existe
            document.getElementById('admin-panel-modal')?.classList.add('hidden');
            // Volver al inicio
            this.navigate('inicio');
        },

        // Render del Panel Admin como ruta — ocupa el área del feed-container
        async renderAdminRoute() {
            if (App.db.session?.role !== 'admin') {
                document.getElementById('feed-container').innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-lock"></i>
                        <p>Solo administradores pueden acceder al Panel Admin.</p>
                        <button class="btn-submit" style="max-width:200px;margin-top:12px;" onclick="App.ui.navigate('inicio')">Volver al inicio</button>
                    </div>`;
                return;
            }
            this.state._adminTab = this.state._adminTab || 'users';
            await this._renderAdminPanel();
        },

        async _renderAdminPanel() {
            const feed = document.getElementById('feed-container');
            if (!feed) return;
            const tab = this.state._adminTab;

            feed.innerHTML = `
                <section class="admin-route">
                    <header class="admin-header-route">
                        <div>
                            <h2 style="margin:0 0 2px;font-size:1.4rem;"><i class="fas fa-shield-halved" style="color:var(--accent);"></i> Panel de Administración</h2>
                            <p style="color:var(--text-dim);font-size:0.85rem;margin:0;">Control de usuarios, contenido y moderación.</p>
                        </div>
                        <button class="btn-secondary" onclick="App.ui.navigate('inicio')" title="Volver al inicio">
                            <i class="fas fa-arrow-left"></i> Volver
                        </button>
                    </header>
                    <nav class="admin-tabs admin-tabs-route">
                        <button class="admin-tab ${tab==='users'?'active':''}" onclick="App.ui._switchAdminTab('users')">
                            <i class="fas fa-users"></i> <span>Usuarios</span>
                        </button>
                        <button class="admin-tab ${tab==='bans'?'active':''}" onclick="App.ui._switchAdminTab('bans')">
                            <i class="fas fa-gavel"></i> <span>Baneos</span>
                        </button>
                        <button class="admin-tab ${tab==='strikes'?'active':''}" onclick="App.ui._switchAdminTab('strikes')">
                            <i class="fas fa-triangle-exclamation"></i> <span>Strikes</span>
                        </button>
                        <button class="admin-tab ${tab==='rules'?'active':''}" onclick="App.ui._switchAdminTab('rules')">
                            <i class="fas fa-scale-balanced"></i> <span>Reglas</span>
                        </button>
                        <button class="admin-tab ${tab==='stats'?'active':''}" onclick="App.ui._switchAdminTab('stats')">
                            <i class="fas fa-chart-line"></i> <span>Stats</span>
                        </button>
                        <button class="admin-tab ${tab==='flow'?'active':''}" onclick="App.ui._switchAdminTab('flow')">
                            <i class="fas fa-stream"></i> <span>Actividad</span>
                        </button>
                    </nav>
                    <div id="admin-panel-content" class="admin-content"></div>
                </section>`;
            await this._renderAdminTabContent(tab);
        },

        async _switchAdminTab(tab) {
            this.state._adminTab = tab;
            await this._renderAdminPanel();
        },

        async _renderAdminTabContent(tab) {
            const wrap = document.getElementById('admin-panel-content');
            if (!wrap) return;
            wrap.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';

            if (tab === 'users') {
                // Intentamos primero con la columna is_owner; si falla (porque el SQL nuevo
                // no se ha corrido), reintentamos sin esa columna.
                let profsRes = await SB.from('profiles')
                    .select('id, username, email, pfp, role, is_guest, is_owner, last_seen, created_at')
                    .order('created_at', { ascending: false });
                if (profsRes.error) {
                    console.warn('[admin] is_owner no existe — fallback sin esa columna:', profsRes.error.message);
                    profsRes = await SB.from('profiles')
                        .select('id, username, email, pfp, role, is_guest, last_seen, created_at')
                        .order('created_at', { ascending: false });
                }
                if (profsRes.error) {
                    console.error('[admin] No pude cargar profiles:', profsRes.error);
                    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-circle-exclamation"></i><p>Error cargando usuarios: ${escapeHtml(profsRes.error.message)}</p></div>`;
                    return;
                }
                const bansRes = await SB.from('bans').select('user_id');
                if (bansRes.error) console.warn('[admin] bans falló:', bansRes.error.message);

                // Strikes: si la tabla no existe, dejamos array vacío
                let strikesRes = { data: [], error: null };
                try {
                    strikesRes = await SB.from('user_strikes').select('user_id, severity').eq('revoked', false);
                    if (strikesRes.error) {
                        console.warn('[admin] user_strikes no existe — usar SQL update strikes:', strikesRes.error.message);
                        strikesRes = { data: [], error: null };
                    }
                } catch (e) {
                    console.warn('[admin] strikes catch:', e);
                    strikesRes = { data: [], error: null };
                }

                const profs = profsRes.data || [];
                const bans = bansRes.data || [];
                const strikes = strikesRes.data || [];
                const bannedSet = new Set((bans || []).map(b => b.user_id));
                // Count + weight de strikes por user
                const strikeMap = {};
                strikes.forEach(s => {
                    const m = strikeMap[s.user_id] = strikeMap[s.user_id] || { count: 0, weight: 0 };
                    m.count++;
                    m.weight += s.severity === 'severe' ? 5 : s.severity === 'major' ? 3 : 1;
                });
                (profs || []).forEach(p => {
                    p._strikes_count = strikeMap[p.id]?.count || 0;
                    p._strike_weight = strikeMap[p.id]?.weight || 0;
                });
                // ¿Soy el owner? Solo el owner ve el bloque de promoción
                const myProfile = (profs || []).find(p => p.id === App.db.session?.id);
                const iAmOwner = !!myProfile?.is_owner;
                const adminCount = (profs || []).filter(p => p.role === 'admin').length;

                const ownerBlock = iAmOwner ? `
                    <div class="admin-owner-block">
                        <h3 style="margin:0 0 4px;color:#ffd700;display:flex;align-items:center;gap:8px;font-size:1rem;">
                            <i class="fas fa-crown"></i> Promoción / Revocación de Admins
                        </h3>
                        <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 12px;">
                            Solo TÚ (owner) puedes promover y revocar admins. Hay ${adminCount} admin${adminCount !== 1 ? 's' : ''} actualmente. Tu cuenta está protegida — nadie puede removerte.
                        </p>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            <button class="btn-small" style="background:linear-gradient(135deg,#22c55e,#10b981);color:white;border:0;" onclick="App.ui.adminPromoteUser()">
                                <i class="fas fa-user-plus"></i> Promover usuario a admin
                            </button>
                            <button class="btn-small btn-ghost" onclick="App.ui.adminRevokeAdminUser()">
                                <i class="fas fa-user-minus"></i> Revocar admin
                            </button>
                        </div>
                    </div>
                ` : '';

                wrap.innerHTML = `
                    ${ownerBlock}
                    <div class="admin-search-row">
                        <input type="text" id="admin-user-search" class="input-modern" placeholder="Buscar por nombre o email..." oninput="App.ui._filterAdminUsers(this.value)">
                        <span class="admin-count">${(profs||[]).length} usuarios</span>
                    </div>
                    <div id="admin-users-list" class="admin-users-list">
                        ${(profs || []).map(p => this._renderAdminUserRow(p, bannedSet.has(p.id))).join('')}
                    </div>`;
            } else if (tab === 'bans') {
                const { data: bansData } = await SB.from('bans').select('*, profile:profiles!bans_user_id_fkey(username), banner:profiles!bans_banned_by_fkey(username)').order('created_at', { ascending: false });
                wrap.innerHTML = (bansData || []).length === 0
                    ? '<div class="admin-empty"><i class="fas fa-circle-check"></i><p>Sin baneos activos</p></div>'
                    : `<div class="admin-bans-list">
                        ${bansData.map(b => `
                            <div class="admin-ban-row">
                                <div class="admin-ban-info">
                                    <b>${escapeHtml(b.profile?.username || 'desconocido')}</b>
                                    ${b.is_permanent
                                        ? '<span class="ban-tag perm">PERMANENTE</span>'
                                        : `<span class="ban-tag temp">Hasta ${new Date(b.expires_at).toLocaleDateString('es-MX')}</span>`}
                                    ${b.reason ? `<small>Motivo: ${escapeHtml(b.reason)}</small>` : ''}
                                    <small style="color:var(--text-muted);">Por ${escapeHtml(b.banner?.username || 'sistema')} · ${App.ui.timeAgo(b.created_at)}</small>
                                </div>
                                <button class="btn-small" onclick="App.ui.adminUnban('${escapeJsAttr(b.profile?.username || '')}')">
                                    <i class="fas fa-circle-check"></i> Desbanear
                                </button>
                            </div>`).join('')}
                       </div>`;
            } else if (tab === 'strikes') {
                // Lista de strikes activos (no revocados, no expirados)
                const { data: activeStrikes } = await SB.from('user_strikes')
                    .select('*, target:profiles!user_strikes_user_id_fkey(username, pfp), giver:profiles!user_strikes_given_by_fkey(username)')
                    .eq('revoked', false)
                    .order('created_at', { ascending: false })
                    .limit(100);
                const filtered = (activeStrikes || []).filter(s => !s.expires_at || new Date(s.expires_at) > new Date());
                wrap.innerHTML = `
                    <div style="padding:16px 0 12px;">
                        <h3 style="margin:0 0 4px;color:var(--accent);"><i class="fas fa-triangle-exclamation"></i> Strikes activos</h3>
                        <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 14px;">${filtered.length} strikes activos. NO hay baneos automáticos: tú decides cuándo escalar según las reglas que establezcas.</p>
                    </div>
                    ${filtered.length === 0
                        ? '<div class="empty-state-mini" style="padding:30px;text-align:center;color:var(--text-dim);">Ningún strike activo</div>'
                        : `<div class="strike-list-full">${filtered.map(s => `
                            <div class="strike-row" style="padding:12px;background:rgba(0,0,0,0.2);border-radius:10px;margin-bottom:6px;display:flex;gap:12px;align-items:center;">
                                <img src="${escapeHtml(s.target?.pfp || DEFAULT_PFP)}" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;">
                                <div style="flex:1;min-width:0;">
                                    <b>${escapeHtml(s.target?.username || '?')}</b>
                                    <span class="strike-tag strike-${s.severity}">${s.severity}</span>
                                    <div style="font-size:0.78rem;color:var(--text-dim);margin-top:2px;">${escapeHtml(s.reason || '(sin motivo)')}</div>
                                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:1px;">Por ${escapeHtml(s.giver?.username || 'admin')} · ${App.ui.timeAgo(s.created_at)}${s.expires_at ? ' · caduca ' + new Date(s.expires_at).toLocaleDateString('es-MX') : ''}</div>
                                </div>
                                <button class="btn-small btn-ghost" onclick="App.ui.adminManageUser('${escapeJsAttr(s.target?.username || '')}')">Gestionar</button>
                            </div>`).join('')}</div>`}`;
            } else if (tab === 'rules') {
                // Sección placeholder — el admin define las reglas más tarde
                wrap.innerHTML = `
                    <div style="padding:18px 0;">
                        <h3 style="margin:0 0 4px;color:var(--accent);"><i class="fas fa-scale-balanced"></i> Reglas y políticas</h3>
                        <p style="color:var(--text-dim);font-size:0.85rem;margin:0 0 18px;">Define las políticas que justifican strikes y baneos. Cada regla se aplica de forma manual — el sistema NO banea automáticamente para evitar baneos absurdos.</p>

                        <div style="padding:18px;background:rgba(0,210,255,0.06);border:1px dashed var(--accent);border-radius:12px;margin-bottom:14px;">
                            <h4 style="margin:0 0 8px;color:var(--accent);font-size:0.95rem;"><i class="fas fa-pen-to-square"></i> Pendiente de configurar</h4>
                            <p style="font-size:0.85rem;line-height:1.5;color:var(--text);margin:0 0 12px;">
                                Aquí irán las reglas que tú definas (ej. "Spam: strike menor", "Insulto grave: strike mayor", "Suplantación: strike severo + baneo manual"). Por ahora, esta sección es solo informativa.
                            </p>
                            <p style="font-size:0.78rem;color:var(--text-dim);margin:0;">
                                Cuando definas tus reglas, podemos volver y construir el editor para guardarlas en Supabase como tabla <code>moderation_rules</code> y mostrarlas a los usuarios al darles strike.
                            </p>
                        </div>

                        <h4 style="color:var(--text);font-size:0.92rem;margin:18px 0 8px;">Sugerencia de severidades (NO obligatorio):</h4>
                        <ul style="font-size:0.85rem;line-height:1.7;color:var(--text);padding-left:20px;">
                            <li><span class="strike-tag strike-minor">minor</span> peso 1 — spam leve, off-topic, mensajes en mayúsculas</li>
                            <li><span class="strike-tag strike-major">major</span> peso 3 — insultos directos, desinformación, repetición de minor</li>
                            <li><span class="strike-tag strike-severe">severe</span> peso 5 — acoso, doxing, contenido ilegal · típicamente lleva a baneo manual</li>
                        </ul>

                        <h4 style="color:var(--text);font-size:0.92rem;margin:18px 0 8px;">Cómo decidir un baneo:</h4>
                        <ol style="font-size:0.85rem;line-height:1.7;color:var(--text);padding-left:20px;">
                            <li>Revisa el peso total de strikes activos del usuario en su perfil de gestión</li>
                            <li>Aplica TU criterio (no hay automatismo) — ej. "peso ≥ 5 = baneo de 7 días"</li>
                            <li>Documenta el motivo del baneo (queda registrado en <code>bans.reason</code>)</li>
                            <li>El usuario puede apelar si crees que fue injusto — usa <i>Revocar strike</i> para deshacer</li>
                        </ol>
                    </div>`;
            } else if (tab === 'stats') {
                const [{ count: nUsers }, { count: nThreads }, { count: nComments }, { count: nMessages }, { count: nBans }, { count: nStrikes }] = await Promise.all([
                    SB.from('profiles').select('*', { count: 'exact', head: true }),
                    SB.from('threads').select('*', { count: 'exact', head: true }),
                    SB.from('comments').select('*', { count: 'exact', head: true }),
                    SB.from('messages').select('*', { count: 'exact', head: true }),
                    SB.from('bans').select('*', { count: 'exact', head: true }),
                    SB.from('user_strikes').select('*', { count: 'exact', head: true }).eq('revoked', false)
                ]);
                wrap.innerHTML = `
                    <div class="admin-stats-grid">
                        <div class="admin-stat"><i class="fas fa-users"></i><b>${nUsers ?? '?'}</b><span>Usuarios</span></div>
                        <div class="admin-stat"><i class="fas fa-comment"></i><b>${nThreads ?? '?'}</b><span>Hilos</span></div>
                        <div class="admin-stat"><i class="fas fa-comments"></i><b>${nComments ?? '?'}</b><span>Comentarios</span></div>
                        <div class="admin-stat"><i class="fas fa-message"></i><b>${nMessages ?? '?'}</b><span>Mensajes privados</span></div>
                        <div class="admin-stat"><i class="fas fa-gavel"></i><b>${nBans ?? '?'}</b><span>Baneos activos</span></div>
                        <div class="admin-stat"><i class="fas fa-triangle-exclamation"></i><b>${nStrikes ?? '?'}</b><span>Strikes activos</span></div>
                    </div>`;
            } else if (tab === 'flow') {
                // Últimos 30 eventos: hilos, comentarios, registros
                const [{ data: lastThreads }, { data: lastComments }, { data: lastUsers }] = await Promise.all([
                    SB.from('threads').select('id, content, created_at, author:profiles!threads_author_id_fkey(username)').order('created_at', { ascending: false }).limit(15),
                    SB.from('comments').select('id, content, created_at, thread_id, author:profiles!comments_author_id_fkey(username)').order('created_at', { ascending: false }).limit(15),
                    SB.from('profiles').select('id, username, created_at').order('created_at', { ascending: false }).limit(10)
                ]);
                const events = [
                    ...(lastUsers || []).map(u => ({ kind: 'user', text: `🆕 <b>${escapeHtml(u.username)}</b> se registró`, at: u.created_at })),
                    ...(lastThreads || []).map(t => ({ kind: 'thread', text: `📝 <b>${escapeHtml(t.author?.username || '?')}</b> publicó: <i>${escapeHtml((t.content || '').replace(/<[^>]+>/g, '').slice(0, 80))}…</i>`, at: t.created_at })),
                    ...(lastComments || []).map(c => ({ kind: 'comment', text: `💬 <b>${escapeHtml(c.author?.username || '?')}</b> comentó: <i>${escapeHtml((c.content || '').slice(0, 80))}…</i>`, at: c.created_at }))
                ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 30);
                wrap.innerHTML = `
                    <div class="admin-flow-list">
                        ${events.map(e => `
                            <div class="admin-flow-item ${e.kind}">
                                <div class="admin-flow-text">${e.text}</div>
                                <small>${App.ui.timeAgo(e.at)}</small>
                            </div>`).join('')}
                    </div>`;
            }
        },

        _renderAdminUserRow(p, isBanned) {
            const role = p.role || 'citizen';
            const isOwner = !!p.is_owner;
            const username = p.username || '';
            const safeName = escapeHtml(username);
            const safeNameJs = escapeJsAttr(username);
            const strikes = p._strikes_count || 0;
            const strikeWeight = p._strike_weight || 0;
            const strikeBadge = strikes > 0
                ? `<span class="strike-badge" title="${strikes} strikes activos · peso ${strikeWeight}">⚠ ${strikes}</span>`
                : '';
            const ownerBadge = isOwner
                ? '<span class="owner-tag" title="Owner · cuenta protegida">👑 OWNER</span>'
                : '';

            // Botón banear: oculto si es owner
            const banBtn = isOwner
                ? '<span class="btn-small btn-ghost" style="cursor:not-allowed;opacity:0.5;" title="El owner no puede ser baneado"><i class="fas fa-shield-halved"></i> Protegido</span>'
                : (isBanned
                    ? `<button class="btn-small" onclick="App.ui.adminUnban('${safeNameJs}')"><i class="fas fa-circle-check"></i> Desbanear</button>`
                    : `<button class="btn-small" style="background:rgba(245,158,11,0.18);color:#f59e0b;" onclick="App.ui.adminBan('${safeNameJs}')"><i class="fas fa-gavel"></i> Banear</button>`);

            return `
                <div class="admin-user-row ${isOwner ? 'admin-owner-row' : ''}" data-username="${escapeHtml(username.toLowerCase())}">
                    <img src="${escapeHtml(p.pfp || DEFAULT_PFP)}" class="admin-user-pfp" alt="">
                    <div class="admin-user-info">
                        <div class="admin-user-name-row">
                            <b>${safeName}</b>
                            ${ownerBadge}
                            <span class="role-tag role-${role}">${role}</span>
                            ${isBanned ? '<span class="ban-tag perm">BANEADO</span>' : ''}
                            ${p.is_guest ? '<span class="ban-tag" style="background:#64748b;color:white;">invitado</span>' : ''}
                            ${strikeBadge}
                        </div>
                        <small>${escapeHtml(p.email || '(sin email)')}</small>
                        <small style="color:var(--text-muted);">Visto: ${p.last_seen ? App.ui.timeAgo(p.last_seen) : 'nunca'}</small>
                    </div>
                    <div class="admin-user-actions">
                        <button class="btn-small btn-ghost" onclick="App.ui.adminManageUser('${safeNameJs}')" title="Gestionar usuario completo">
                            <i class="fas fa-user-gear"></i> Gestionar
                        </button>
                        ${banBtn}
                    </div>
                </div>`;
        },

        // ============ MODAL DE GESTIÓN COMPLETA DE USUARIO ============
        // Centraliza: cambiar rol, dar/revocar strikes, banear, eliminar.
        async adminManageUser(username) {
            if (!App.db.session || App.db.session.role !== 'admin') {
                this.toast('Solo admins', 'error'); return;
            }
            // Cargar profile + strikes en paralelo
            const [{ data: profile }, { data: strikes }] = await Promise.all([
                SB.from('profiles').select('*').eq('username', username).maybeSingle(),
                SB.from('user_strikes')
                    .select('*, given_by_user:profiles!user_strikes_given_by_fkey(username)')
                    .eq('user_id',
                        (await SB.from('profiles').select('id').eq('username', username).maybeSingle())?.data?.id || '00000000-0000-0000-0000-000000000000')
                    .order('created_at', { ascending: false })
            ]);
            if (!profile) { this.toast('Usuario no encontrado', 'error'); return; }

            const activeStrikes = (strikes || []).filter(s => !s.revoked && (!s.expires_at || new Date(s.expires_at) > new Date()));
            const weight = activeStrikes.reduce((acc, s) => acc + (s.severity === 'severe' ? 5 : s.severity === 'major' ? 3 : 1), 0);

            let modal = document.getElementById('admin-manage-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'admin-manage-modal';
                modal.className = 'modal hidden';
                document.body.appendChild(modal);
            }
            const safeUsername = escapeHtml(username);
            const safeUserJs = escapeJsAttr(username);

            modal.innerHTML = `
                <div class="modal-content" style="max-width:640px;">
                    <button class="close-btn" onclick="document.getElementById('admin-manage-modal').classList.add('hidden')"><i class="fas fa-times"></i></button>
                    <h3 style="margin:0 0 4px;">Gestionar a <span style="color:var(--accent);">${safeUsername}</span></h3>
                    <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 18px;">${escapeHtml(profile.email || '')} · rol actual: <b>${profile.role || 'citizen'}</b></p>

                    <h4 style="color:var(--accent);font-size:0.95rem;margin:14px 0 8px;"><i class="fas fa-shield-halved"></i> Cambiar rol</h4>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button class="btn-small ${profile.role==='citizen'?'btn-ghost':''}" onclick="App.ui.adminSetRole('${safeUserJs}', 'citizen')">Ciudadano</button>
                        <button class="btn-small ${profile.role==='media'?'btn-ghost':''}" onclick="App.ui.adminSetRole('${safeUserJs}', 'media')">Medio verificado</button>
                        <button class="btn-small ${profile.role==='admin'?'btn-ghost':''}" onclick="App.ui.adminSetRole('${safeUserJs}', 'admin')">Admin</button>
                    </div>

                    <h4 style="color:var(--accent);font-size:0.95rem;margin:18px 0 8px;"><i class="fas fa-triangle-exclamation"></i> Strikes (${activeStrikes.length} activos · peso ${weight})</h4>
                    <p style="color:var(--text-dim);font-size:0.78rem;margin:0 0 10px;">El sistema NO banea automáticamente. Tú decides cuándo escalar a baneo según la cantidad y severidad.</p>

                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
                        <button class="btn-small" style="background:rgba(245,158,11,0.18);color:#f59e0b;" onclick="App.ui.adminAddStrike('${safeUserJs}', 'minor')">+ Strike menor (peso 1)</button>
                        <button class="btn-small" style="background:rgba(249,115,22,0.18);color:#f97316;" onclick="App.ui.adminAddStrike('${safeUserJs}', 'major')">+ Strike mayor (peso 3)</button>
                        <button class="btn-small" style="background:rgba(239,68,68,0.18);color:#ef4444;" onclick="App.ui.adminAddStrike('${safeUserJs}', 'severe')">+ Strike severo (peso 5)</button>
                    </div>

                    <div class="strike-list" style="max-height:240px;overflow-y:auto;background:rgba(0,0,0,0.25);border-radius:10px;padding:10px;">
                        ${(strikes || []).length === 0
                            ? '<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:0.82rem;">Sin historial de strikes</div>'
                            : strikes.map(s => {
                                const expired = s.expires_at && new Date(s.expires_at) < new Date();
                                const isActive = !s.revoked && !expired;
                                return `
                                    <div style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:0.82rem;display:flex;justify-content:space-between;gap:10px;align-items:center;">
                                        <div style="flex:1;min-width:0;">
                                            <span class="strike-tag strike-${s.severity}">${s.severity}</span>
                                            ${s.revoked ? '<span style="color:#22c55e;font-size:0.72rem;">· REVOCADO</span>' : ''}
                                            ${expired && !s.revoked ? '<span style="color:var(--text-dim);font-size:0.72rem;">· expirado</span>' : ''}
                                            <div style="color:var(--text-dim);font-size:0.75rem;margin-top:2px;">
                                                ${escapeHtml(s.reason || '(sin motivo)')} · ${App.ui.timeAgo(s.created_at)}
                                            </div>
                                        </div>
                                        ${isActive
                                            ? `<button class="btn-small btn-ghost" onclick="App.ui.adminRevokeStrike('${s.id}', '${safeUserJs}')" title="Revocar (perdonar)">Revocar</button>`
                                            : ''}
                                    </div>`;
                            }).join('')}
                    </div>

                    <h4 style="color:var(--accent);font-size:0.95rem;margin:18px 0 8px;"><i class="fas fa-gavel"></i> Acciones disciplinarias</h4>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button class="btn-small" style="background:rgba(245,158,11,0.18);color:#f59e0b;" onclick="App.ui.adminBan('${safeUserJs}'); document.getElementById('admin-manage-modal').classList.add('hidden');">
                            <i class="fas fa-gavel"></i> Banear
                        </button>
                        <button class="btn-small" style="background:rgba(239,68,68,0.25);color:#ef4444;" onclick="App.ui.adminDeleteUser('${safeUserJs}'); document.getElementById('admin-manage-modal').classList.add('hidden');">
                            <i class="fas fa-trash"></i> Eliminar cuenta
                        </button>
                    </div>
                </div>`;
            modal.classList.remove('hidden');
        },

        async adminSetRole(username, newRole) {
            if (!confirm(`¿Cambiar rol de ${username} a "${newRole}"?`)) return;
            const { error } = await SB.from('profiles').update({ role: newRole }).eq('username', username);
            if (error) { this.toast('Error: ' + error.message, 'error'); return; }
            this.toast(`Rol actualizado a ${newRole}`, 'success');
            this.adminManageUser(username);  // refrescar modal
            this._renderAdminPanel();
        },

        async adminAddStrike(username, severity) {
            const reason = prompt(`Motivo del strike (${severity}) a "${username}":`, '');
            if (reason === null) return;
            const days = prompt('¿En cuántos días caduca? (vacío = nunca caduca):', '180');
            if (days === null) return;
            const expDays = days.trim() ? parseInt(days.trim(), 10) : null;

            const { data, error } = await SB.rpc('admin_add_strike', {
                p_username: username,
                p_reason: reason,
                p_severity: severity,
                p_expires_days: expDays
            });
            if (error) { this.toast('Error: ' + error.message, 'error'); return; }
            this.toast('Strike registrado', 'success');
            this.adminManageUser(username);
        },

        async adminRevokeStrike(strikeId, username) {
            const reason = prompt('Motivo de la revocación (opcional):', '');
            if (reason === null) return;
            const { data, error } = await SB.rpc('admin_revoke_strike', {
                p_strike_id: strikeId,
                p_reason: reason || ''
            });
            if (error) { this.toast('Error: ' + error.message, 'error'); return; }
            this.toast('Strike revocado', 'success');
            this.adminManageUser(username);
        },

        // ============ PROMOCIÓN / REVOCACIÓN DE ADMINS (solo owner) ============
        async adminPromoteUser() {
            const username = prompt('¿Qué usuario quieres promover a ADMIN?\nEscribe el username exacto (ej. "charli"):', '');
            if (!username || !username.trim()) return;
            const trimmed = username.trim();
            if (!confirm(`¿Confirmar promoción de "${trimmed}" a ADMIN?\nTendrá acceso al panel de moderación y podrá gestionar usuarios normales.`)) return;

            const { data, error } = await SB.rpc('admin_promote_to_admin', { p_username: trimmed });
            if (error) {
                this.toast('Error: ' + error.message, 'error');
                return;
            }
            this.toast(`${trimmed} promovido a admin`, 'success');
            this._renderAdminPanel();
        },

        async adminRevokeAdminUser() {
            const username = prompt('¿A qué admin quieres revocar el rol?\nEscribe el username (ej. "charli"). Tu cuenta de owner está protegida.', '');
            if (!username || !username.trim()) return;
            const trimmed = username.trim();
            if (!confirm(`¿Confirmar REVOCACIÓN de admin a "${trimmed}"?\nVolverá a ser ciudadano normal sin permisos especiales.`)) return;

            const { data, error } = await SB.rpc('admin_revoke_admin', { p_username: trimmed });
            if (error) {
                this.toast('Error: ' + error.message, 'error');
                return;
            }
            this.toast(`${trimmed} revocado · vuelve a ser ciudadano`, 'success');
            this._renderAdminPanel();
        },

        _filterAdminUsers(q) {
            const term = (q || '').toLowerCase().trim();
            document.querySelectorAll('.admin-user-row').forEach(row => {
                const u = row.dataset.username || '';
                row.style.display = (!term || u.includes(term)) ? '' : 'none';
            });
        },

        async adminBan(username) {
            const reason = prompt(`Motivo del baneo a "${username}":`, '');
            if (reason === null) return;
            const days = prompt('¿Cuántos días dura el baneo? (deja vacío para PERMANENTE):', '7');
            if (days === null) return;
            const isPerm = !days.trim();
            const nDays = parseInt(days, 10) || 7;
            const { data, error } = await SB.rpc('admin_ban_user', {
                p_username: username, p_reason: reason, p_permanent: isPerm, p_days: nDays
            });
            if (error || !data) {
                this.toast('No se pudo banear: ' + (error?.message || 'error'), 'error');
                return;
            }
            this.toast(`${username} baneado ${isPerm ? 'permanentemente' : `${nDays} días`}`, 'success');
            this._renderAdminPanel();
        },

        async adminUnban(username) {
            const { data, error } = await SB.rpc('admin_unban_user', { p_username: username });
            if (error || !data) {
                this.toast('No se pudo desbanear', 'error');
                return;
            }
            this.toast(`${username} desbaneado`, 'success');
            this._renderAdminPanel();
        },

        async adminDeleteUser(username) {
            if (!confirm(`⚠️ ¿Eliminar la cuenta de "${username}" permanentemente? Borra todos sus posts, comentarios y datos.`)) return;
            if (!confirm(`Última confirmación: ¿100% seguro de eliminar "${username}"?`)) return;
            const { data, error } = await SB.rpc('admin_delete_user', { p_username: username });
            if (error || !data) {
                this.toast('No se pudo eliminar: ' + (error?.message || 'error'), 'error');
                return;
            }
            this.toast(`Cuenta "${username}" eliminada`, 'success');
            this._renderAdminPanel();
        },

        // ============ STATUS / PRESENCIA ============
        // Guarda el custom status del input del Settings
        async saveCustomStatus() {
            const emoji = document.getElementById('custom-status-emoji')?.value || '';
            const text  = document.getElementById('custom-status-text')?.value || '';
            const ok = await App.presence.setCustomStatus(emoji, text);
            if (ok) this.toast('Estado actualizado', 'success');
        },

        // Toggle del grid de emoji presets
        toggleEmojiPicker() {
            const grid = document.getElementById('emoji-picker-grid');
            if (!grid) return;
            grid.classList.toggle('hidden');
        },

        // Selecciona un emoji del grid. Si el texto está vacío, usa el sugerido.
        pickStatusEmoji(emoji, suggestedText) {
            const emojiInput = document.getElementById('custom-status-emoji');
            const textInput  = document.getElementById('custom-status-text');
            const preview    = document.getElementById('emoji-picker-preview');
            if (emojiInput) emojiInput.value = emoji || '';
            if (preview)    preview.textContent = emoji || '🙂';
            if (textInput && !textInput.value && suggestedText) textInput.value = suggestedText;
            // Cerrar el grid tras elegir
            document.getElementById('emoji-picker-grid')?.classList.add('hidden');
        },

        // Limpia los campos de estado (no llama a setCustomStatus — eso lo hace al Guardar)
        clearStatusFields() {
            const emojiInput = document.getElementById('custom-status-emoji');
            const textInput  = document.getElementById('custom-status-text');
            const preview    = document.getElementById('emoji-picker-preview');
            if (emojiInput) emojiInput.value = '';
            if (textInput)  textInput.value  = '';
            if (preview)    preview.textContent = '🙂';
            App.presence.clearCustomStatus();
        },

        // Refresca todos los indicadores visuales tras un cambio de status
        refreshStatusUI() {
            // Actualizar UI del Settings (pre-cargar valores actuales)
            const s = App.db.session;
            if (s) {
                const showOnlineCb = document.getElementById('status-show-online');
                if (showOnlineCb) showOnlineCb.checked = s.show_online_status !== false;

                const emojiInput = document.getElementById('custom-status-emoji');
                const textInput  = document.getElementById('custom-status-text');
                const preview    = document.getElementById('emoji-picker-preview');
                if (emojiInput) emojiInput.value = s.custom_status_emoji || '';
                if (textInput)  textInput.value  = s.custom_status || '';
                if (preview)    preview.textContent = s.custom_status_emoji || '🙂';

                // Marcar el preset activo
                document.querySelectorAll('.status-preset-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.status === s.online_status);
                });
            }
            // Reflejar cambios también en el header (pfp + dot + emoji)
            this.updateHeader();
            // Re-renderizar feed para que las pfp muestren el dot actualizado
            App.forum?.render?.();
            // Refrescar sidebar (pfp del usuario + listas)
            this.renderUnifiedSidebar?.();
        },

        // Devuelve el HTML del status-dot que se sobrepone a una pfp.
        // Usar wrapping: <div class="pfp-with-status"><img class="pfp"/>{statusDotHTML}</div>
        statusDotHTML(profileOrSession) {
            if (!profileOrSession) return '';
            const status = App.presence.statusFor(profileOrSession);
            if (status === 'offline') return '';
            return `<span class="presence-dot ${status}" title="${status}"></span>`;
        },

        // Devuelve el HTML del custom status (burbuja al lado de la pfp)
        customStatusHTML(profile) {
            if (!profile) return '';
            const text = profile.custom_status || '';
            const emoji = profile.custom_status_emoji || '';
            if (!text && !emoji) return '';
            return `<span class="custom-status-bubble" title="${escapeHtml(text)}">
                ${emoji ? `<span class="cs-emoji">${escapeHtml(emoji)}</span>` : ''}
                ${text ? `<span class="cs-text">${escapeHtml(text)}</span>` : ''}
            </span>`;
        },

        // ============ OPCIONES PÚBLICAS (sin login) ============
        // Cicla entre los temas disponibles. Funciona sin login.
        cycleQuickTheme() {
            const order = ['cyber-cian', 'dark', 'sunset', 'ocean', 'forest', 'synthwave', 'crimson', 'lavender', 'mono', 'mint', 'retro', 'light'];
            const current = (App.db.themes && order.includes(App.db.themes)) ? App.db.themes : 'cyber-cian';
            const next = order[(order.indexOf(current) + 1) % order.length];
            App.settings.changeTheme(next);
            this.refreshThemeLabel(next);
        },

        refreshThemeLabel(themeName) {
            const lbl = document.getElementById('theme-quick-name');
            const btn = document.getElementById('theme-quick-btn');
            const display = {
                'cyber-cian':'Cyber','dark':'Dark','light':'Light','retro':'Retro','sunset':'Sunset',
                'ocean':'Ocean','forest':'Forest','synthwave':'Synthwave','crimson':'Crimson',
                'lavender':'Lavender','mono':'Mono','mint':'Mint'
            };
            const name = display[themeName] || themeName || 'Cyber';
            // Sin etiqueta visible: solo se ve en el tooltip y el icono
            if (lbl) lbl.textContent = '';
            if (btn) btn.title = `Tema: ${name} · click para cambiar`;
        },

        toggleFollowingExpanded() {
            this.state.followingExpanded = !this.state.followingExpanded;
            this.renderUnifiedSidebar();
        },

        // Tabla de rutas SPA. Cada handler escribe en #feed-container.
        routes: {
            inicio:         () => { App.ui.showForumChrome(true);  App.forum.renderThreads('all'); },
            foro:           () => { App.ui.showForumChrome(true);  App.forum.renderThreads('foro'); },
            noticias:       () => {
                App.ui.showForumChrome(true);
                App.forum.renderThreads('noticias');
                App.news.refresh(false);
            },
            notificaciones: () => { App.ui.showForumChrome(false); App.ui.renderNotificationsRoute(); },
            red:            () => { App.ui.showForumChrome(false); App.ui.renderNetworkRoute('following'); },
            economia:       () => { App.ui.showForumChrome(true);  App.forum.renderThreads('economia'); },
            educacion:      () => { App.ui.showForumChrome(true);  App.forum.renderThreads('educacion'); },
            deportes:       () => { App.ui.showForumChrome(true);  App.forum.renderThreads('deportes'); },
            historia:       () => { App.ui.showForumChrome(true);  App.forum.renderThreads('historia'); },
            explora:        () => { App.ui.showForumChrome(false); App.ui.renderRegionalHub(); },
            perfil:         () => { App.ui.showForumChrome(false); App.ui.renderProfileRoute(App.ui.state.profileUserId); },
            buscar:         () => { App.ui.showForumChrome(false); App.ui.renderSearchRoute(); },
            admin:          () => { App.ui.showForumChrome(false); App.ui.renderAdminRoute(); }
        },

        navigate(route) {
            const handler = this.routes[route];
            if (!handler) return;

            // Tick rápido tipo Xbox al cambiar de sección
            try { playUiTick(); } catch (_) {}

            this.state.currentRoute = route;

            // En móvil, cerrar la sidebar tras navegar; en desktop queda fija.
            if (window.innerWidth < 1024) {
                document.getElementById('sidebar').classList.add('sidebar-hidden');
                document.body.classList.remove('sidebar-open');
            }

            document.querySelectorAll('.sidebar-link-btn').forEach(link => {
                link.classList.toggle('active', link.dataset.route === route);
            });

            // Sincroniza el estado activo de la bottom-nav (móvil)
            document.querySelectorAll('.bottom-nav .bn-item').forEach(item => {
                item.classList.toggle('active', item.dataset.route === route);
            });

            handler();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        // Muestra/oculta los controles del foro (botón Nuevo Hilo + creador).
        showForumChrome(visible) {
            const controls = document.getElementById('forum-controls');
            const creator = document.getElementById('thread-creator');
            if (controls) controls.style.display = visible ? '' : 'none';
            if (creator && !visible) creator.classList.add('hidden');
        },

        // ===== EXPLORA TRES VALLES — Hub regional =====
        renderRegionalHub() {
            const feed = document.getElementById('feed-container');
            if (!feed) return;
            feed.innerHTML = `
                <section class="hub-hero">
                    <h1>Explora Tres Valles</h1>
                    <p>Patrimonio, gente y fuerza productiva del corazón de la Cuenca del Papaloapan.</p>
                </section>

                <div class="hub-grid">
                    <article class="hub-card history" onclick="document.getElementById('hub-historia').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-landmark"></i></div>
                        <h3>Historia</h3>
                        <p>Origen y desarrollo del municipio en la cuenca del Papaloapan.</p>
                    </article>
                    <article class="hub-card economy" onclick="document.getElementById('hub-economia').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-store"></i></div>
                        <h3>Economía</h3>
                        <p>Directorio, mapa de ubicaciones y actividades productivas locales.</p>
                    </article>
                    <article class="hub-card regional" onclick="document.getElementById('hub-region').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-map-marked-alt"></i></div>
                        <h3>Contexto Regional</h3>
                        <p>Tres Valles y su entorno geográfico.</p>
                    </article>
                    <article class="hub-card cana" onclick="document.getElementById('hub-cana').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-industry"></i></div>
                        <h3>Ingenio Azucarero</h3>
                        <p>La caña de azúcar y el ingenio que ha definido la economía local.</p>
                    </article>
                    <article class="hub-card railway" onclick="document.getElementById('hub-ferrocarril').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-train"></i></div>
                        <h3>Ferrocarril</h3>
                        <p>El paso del tren y su rol histórico en la región.</p>
                    </article>
                    <article class="hub-card geo" onclick="document.getElementById('hub-geografia').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-mountain-sun"></i></div>
                        <h3>Geografía y Clima</h3>
                        <p>Planicie costera del Golfo, clima cálido-húmedo.</p>
                    </article>
                    <article class="hub-card geology" onclick="document.getElementById('hub-geologia').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-cubes-stacked"></i></div>
                        <h3>Geología</h3>
                        <p>Suelos aluviales del Papaloapan y formación del terreno.</p>
                    </article>
                    <article class="hub-card food" onclick="document.getElementById('hub-gastronomia').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-utensils"></i></div>
                        <h3>Gastronomía</h3>
                        <p>Cocina veracruzana del sotavento y sabores tradicionales.</p>
                    </article>
                    <article class="hub-card music" onclick="document.getElementById('hub-musica').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-music"></i></div>
                        <h3>Música y Danza</h3>
                        <p>Territorio del son jarocho y los fandangos comunitarios.</p>
                    </article>
                    <article class="hub-card tradition" onclick="document.getElementById('hub-tradiciones').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-mask"></i></div>
                        <h3>Tradiciones</h3>
                        <p>Fiestas patronales, Día de Muertos y costumbres comunitarias.</p>
                    </article>
                    <article class="hub-card nature" onclick="document.getElementById('hub-natura').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-leaf"></i></div>
                        <h3>Naturaleza</h3>
                        <p>Ríos, esteros y biodiversidad de la cuenca.</p>
                    </article>
                    <article class="hub-card sport" onclick="document.getElementById('hub-deporte').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-futbol"></i></div>
                        <h3>Deporte</h3>
                        <p>Fútbol, béisbol y actividades deportivas de la comunidad.</p>
                    </article>
                    <article class="hub-card edu" onclick="document.getElementById('hub-educacion').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-graduation-cap"></i></div>
                        <h3>Educación</h3>
                        <p>Instituciones educativas y vida cultural local.</p>
                    </article>
                    <article class="hub-card gallery" onclick="document.getElementById('hub-galeria').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-images"></i></div>
                        <h3>Galería</h3>
                        <p>Imágenes compartidas por la comunidad.</p>
                    </article>
                    <article class="hub-card videos" onclick="document.getElementById('hub-videos').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-circle-play"></i></div>
                        <h3>Videos</h3>
                        <p>Documentales, recorridos y testimonios sobre Tres Valles.</p>
                    </article>
                    <article class="hub-card logo-card" onclick="document.getElementById('hub-logo').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-shield-halved"></i></div>
                        <h3>Logo y simbología</h3>
                        <p>El escudo municipal y los símbolos que representan a Tres Valles.</p>
                    </article>
                    <article class="hub-card bibliography" onclick="document.getElementById('hub-bibliografia').scrollIntoView({behavior:'smooth'})">
                        <div class="hub-card-icon"><i class="fas fa-book"></i></div>
                        <h3>Bibliografía</h3>
                        <p>Fuentes oficiales y académicas que respaldan esta información.</p>
                    </article>
                </div>

                <section class="hub-section" id="hub-historia">
                    <h2><i class="fas fa-landmark"></i> Historia: De campamento ferrocarrilero a Municipio Libre</h2>
                    <p class="hub-section-lead">
                        La historia de Tres Valles es un testimonio de lucha y crecimiento demográfico
                        impulsado por el riel y la caña.
                    </p>
                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">Los Orígenes</h3>
                    <p class="hub-section-lead">
                        A finales del siglo XIX, la zona era una vasta extensión de selva y llanura
                        perteneciente al municipio de Cosamaloapan, con presencia anterior de pueblos
                        <b>olmecas, totonacos</b> y, al momento de la conquista, bajo dominio <b>azteca</b>.
                        El detonante de la fundación moderna fue la construcción del <b>Ferrocarril Veracruz
                        al Pacífico</b> (después llamado al Istmo). Entre <b>finales de 1899 y principios
                        de 1900</b> se instaló aquí el <b>Campamento Núm. 7</b> de trabajadores, en tierras
                        de Jesús Martínez Ochoa, originando popularmente el nombre <b>"Campo Siete"</b>.
                        Después se le llamó <b>"Brisbin"</b> (1908-1913) en honor al ingeniero estadounidense
                        W. E. Brisbin, y finalmente <b>"Tres Valles"</b> a partir de 1913, por ser paso
                        obligado a los valles de Valle Nacional, Tesechoacan y Playa Vicente.
                    </p>
                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">El Auge Poblacional</h3>
                    <p class="hub-section-lead">
                        Durante el siglo XX, la instalación del <b>Ingenio Tres Valles (1978)</b> y la
                        fábrica de papel <b>MEXPAPE / Bio Pappel (1972-1979)</b> transformaron el asentamiento
                        rural en un polo de atracción magnética. Miles de migrantes de Oaxaca, Puebla y otras
                        regiones de Veracruz llegaron buscando trabajo en la zafra, diversificando la cultura
                        local. Desde 1916, cuando Ignacio Martínez sembró la primera caña, hasta hoy, el
                        municipio se consolidó como potencia agroindustrial.
                    </p>
                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">La Emancipación</h3>
                    <p class="hub-section-lead">
                        El crecimiento económico de Tres Valles pronto superó al de su cabecera municipal
                        (Cosamaloapan). Tras años de gestión cívica del <b>Comité Pro Municipio Libre</b>,
                        Tres Valles logró su independencia política mediante el <b>Decreto 195</b> de la H.
                        LIV Legislatura del Estado, a iniciativa del gobernador <b>Fernando Gutiérrez Barrios</b>.
                        Fue declarado <b>Municipio Libre el 25 de noviembre de 1988</b> (publicado en la
                        Gaceta Oficial 142 del 26 de noviembre), iniciando funciones el <b>1 de diciembre
                        de 1988</b> con un Concejo Municipal. El nuevo municipio se formó con las congregaciones
                        de Los Naranjos, Vista Hermosa y Tres Valles.
                    </p>
                </section>

                <section class="hub-section" id="hub-economia">
                    <h2><i class="fas fa-store"></i> Economía: La capital de la agroindustria</h2>
                    <p class="hub-section-lead">
                        El tejido productivo de Tres Valles es robusto, dinámico y sostiene a la región
                        entera. Combina la agricultura de alto rendimiento, la industria pesada y un
                        comercio local efervescente.
                    </p>
                    <p class="hub-section-lead">
                        <b>Comercio local y servicios:</b> La Avenida Ruiz Cortines, la Avenida Madero y el
                        entorno del Mercado Municipal son las venas comerciales de la ciudad. Desde
                        refaccionarias agrícolas, abarrotes al por mayor y ferreterías, hasta un creciente
                        sector de servicios que incluye ciber cafés, despachos contables y gastronomía local.
                    </p>
                    <p class="hub-section-lead">
                        <b>Agricultura diversificada:</b> Aunque la caña es la reina (con <b>~28,000 hectáreas
                        sembradas</b>, siendo el <b>quinto productor nacional</b> y el primero del estado de
                        Veracruz según SAGARPA 2009), Tres Valles destaca también como <b>principal productor
                        de arroz en Veracruz</b> y entre los primeros a nivel nacional. Se cultiva además
                        maíz, sorgo, frijol, piña y frutales como el mango, aprovechando los suelos
                        aluviales excepcionalmente fértiles.
                    </p>
                    <p class="hub-section-lead">
                        <b>Ganadería:</b> Las zonas ejidales mantienen una fuerte tradición de ganadería
                        de bovinos de doble propósito (carne y leche), vital para la economía de las
                        rancherías y la producción de lácteos artesanales.
                    </p>

                    <h3 style="color:var(--text);font-size:1rem;margin:24px 0 10px;display:flex;align-items:center;gap:8px;">
                        <i class="fas fa-landmark-flag" style="color:var(--accent);"></i> Directorio de servicios institucionales
                    </h3>
                    <ul class="hub-poi-list">
                        <li><i class="fas fa-building-columns"></i> <b>Gobierno:</b> Palacio Municipal (Calle Enríquez S/N, Centro). Sede del H. Ayuntamiento y servicios civiles.</li>
                        <li><i class="fas fa-tree-city"></i> <b>Recreación:</b> Parque Central Miguel Hidalgo (Av. Juárez, Centro). Epicentro social y cultural.</li>
                        <li><i class="fas fa-church"></i> <b>Religión:</b> Parroquia de Cristo Rey (Calle Emiliano Zapata). El monumento religioso más importante de la cabecera.</li>
                        <li><i class="fas fa-industry"></i> <b>Industria:</b> Ingenio Tres Valles (Carr. Federal 145) y Planta Papelera Scribe. Motores industriales.</li>
                        <li><i class="fas fa-hospital"></i> <b>Salud:</b> Hospital General de Subzona IMSS 43 (Blvd. Ruiz Cortines) y clínicas de salud municipales.</li>
                    </ul>

                    <h3 style="color:var(--text);font-size:1rem;margin:24px 0 10px;display:flex;align-items:center;gap:8px;">
                        <i class="fas fa-map-location-dot" style="color:var(--accent);"></i> Mapa de ubicaciones
                    </h3>
                    <div id="hub-map" class="hub-map"></div>
                    <p class="hub-map-note">
                        <i class="fas fa-info-circle"></i> Cada negocio aparece con un icono según su categoría. Click en el marcador para ver detalles, llamar o trazar ruta.
                        ${App.db.session?.role === 'admin' ? '<br><i class="fas fa-shield-halved"></i> <b>Admin:</b> en el directorio de abajo, usa el botón <i class="fas fa-map-pin"></i> "Marcar en mapa" de cada negocio para fijar su ubicación con un click.' : ''}
                    </p>

                    <h3 style="color:var(--text);font-size:1rem;margin:24px 0 10px;display:flex;align-items:center;gap:8px;">
                        <i class="fas fa-list" style="color:var(--accent);"></i> Directorio
                    </h3>
                    <div class="business-filter">
                        <input type="text" id="biz-search" placeholder="Buscar negocio..." oninput="App.ui.bizPage=1; App.ui.renderBusinessDirectory()">
                        <select id="biz-category" onchange="App.ui.bizPage=1; App.ui.renderBusinessDirectory()">
                            <option value="all">Todas las categorías</option>
                            ${[...new Set(App.db.businesses.map(b => b.category))]
                                .map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                        </select>
                    </div>
                    <div id="business-directory" class="business-grid"></div>
                </section>

                <section class="hub-section" id="hub-region">
                    <h2><i class="fas fa-map-marked-alt"></i> Contexto Regional: El eje de la Cuenca</h2>
                    <p class="hub-section-lead">
                        Tres Valles no es solo un punto en el mapa; es una <b>bisagra estratégica y el motor
                        agroindustrial</b> del sureste mexicano. Situado en la rica y fértil llanura de la
                        Cuenca del Papaloapan, en el estado de Veracruz, el municipio sirve como un puente
                        geográfico y comercial entre el sotavento veracruzano y el norte de Oaxaca
                        (Tuxtepec).
                    </p>
                    <p class="hub-section-lead">
                        Su territorio es un tapiz de vastos cañaverales, ríos serpenteantes y rancherías
                        que han sostenido una economía agrícola ininterrumpida durante más de un siglo.
                        Aquí, la identidad jarocha se funde con la cultura del trabajo constante, creando
                        una comunidad vibrante, resiliente y orgullosa de sus raíces.
                    </p>
                </section>

                <section class="hub-section" id="hub-geografia">
                    <h2><i class="fas fa-mountain-sun"></i> Geografía, clima y geología</h2>
                    <p class="hub-section-lead">
                        <b>Planicie costera:</b> Tres Valles está asentado en las llanuras de inundación del
                        bajo Papaloapan, con una <b>extensión de 378.1 km²</b>. Su altitud va de
                        <b>10 a 50 metros</b> sobre el nivel del mar, lo que le otorga un horizonte inmenso
                        e ininterrumpido. Se ubica entre los 96°01' y 96°18' al oeste de Greenwich y entre
                        los 18°10' y 18°25' de latitud norte.
                    </p>
                    <p class="hub-section-lead">
                        <b>Clima cálido-húmedo (AW2 según Köppen):</b> Tropical subhúmedo. Lluvia media
                        anual de <b>1,887.4 mm</b> (concentrada entre junio y octubre), con temperatura
                        media anual de <b>25.4 °C</b>. Los picos máximos se alcanzan en mayo
                        (hasta <b>45.5 °C</b> históricos) y los mínimos en enero-febrero.
                    </p>
                    <p class="hub-section-lead">
                        <b>Hidrografía:</b> Pertenece a la cuenca natural <b>28 Papaloapan</b> y a la región
                        hidrológica X Golfo Centro. Sus principales corrientes son los ríos
                        <b>Tonto, Amapa y Hondo</b>, junto con los arroyos Mondongo, Coapilla, Coyote, Zapote
                        y Jobo. El río Tonto sirve también de límite con el estado de Oaxaca y abastece
                        al Ingenio Tres Valles y a Bio Pappel.
                    </p>
                    <p class="hub-section-lead">
                        <b>Geología aluvial:</b> El secreto de la riqueza de Tres Valles está bajo la tierra.
                        Sus suelos son <b>fluvisoles, vertisoles y gleysoles</b>, formados por depósitos
                        aluviales recientes del río Papaloapan y sus afluentes. Esta geología hace que la
                        tierra sea profunda, oscura y extremadamente fértil, ideal para la caña, el arroz
                        y los frutales.
                    </p>
                </section>

                <section class="hub-section" id="hub-cana">
                    <h2><i class="fas fa-industry"></i> Industria Azucarera: El corazón económico</h2>
                    <p class="hub-section-lead">
                        Tres Valles no se entiende sin su ingenio. Construido por el Gobierno Federal en
                        <b>1978</b> y operado desde 1988 por el grupo <b>PIASA</b>, el <b>Ingenio Tres Valles</b>
                        es uno de los más productivos, modernos y eficientes de México. Se ubica en el km 68
                        de la carretera Tinajas-Cd. Alemán, a unos 5 km de la cabecera municipal.
                    </p>
                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">Capacidad y rendimiento</h3>
                    <p class="hub-section-lead">
                        Tiene una capacidad de molienda de aproximadamente <b>13,000 toneladas de caña al día</b>,
                        generando más de <b>1,500 toneladas de azúcar en 24 horas</b>. Su área de abastecimiento
                        es de cerca de <b>37,000 hectáreas</b> cultivadas por más de <b>6,000 productores cañeros</b>
                        (4,115 ejidatarios y 1,375 pequeños productores) de Tres Valles, Otatitlán, Cosamaloapan
                        y Tierra Blanca. Los rendimientos en fábrica (12.4-12.6%) están entre los más altos
                        del país. Desde mayo de 2011 cuenta con una <b>planta de cogeneración de 40 MW</b>.
                    </p>
                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">La zafra</h3>
                    <p class="hub-section-lead">
                        Entre <b>noviembre y mayo</b>, la ciudad cambia su ritmo. La "zafra" (cosecha de caña)
                        inyecta vitalidad económica a todos los sectores. Las carreteras se llenan de
                        camiones cañeros, el aire adquiere el dulce aroma de la melaza, y al menos
                        <b>14,000 personas</b> dependen directamente del ciclo: 4,503 cañeros, 3,033
                        cosechadores, 4,492 jornaleros, 1,502 transportistas y 754 empleados del ingenio.
                        Es el pilar absoluto de la identidad laboral tresvallense.
                    </p>
                </section>

                <section class="hub-section" id="hub-gastronomia">
                    <h2><i class="fas fa-utensils"></i> Gastronomía: Sabor a la Cuenca</h2>
                    <p class="hub-section-lead">
                        La cocina tresvallense es una celebración del sotavento, con un toque de la
                        vecina influencia oaxaqueña. El <b>Mercado Municipal</b> y las cocinas económicas
                        son templos del sabor.
                    </p>
                    <p class="hub-section-lead">
                        <b>Platillos estrella:</b> Destacan las <b>mojarras fritas</b> al mojo de ajo o a la
                        veracruzana (capturadas en los ríos locales), los <b>tamales de elote</b> y de masa
                        con hoja de plátano, las <b>picadas</b>, las empanadas y el <b>caldo de mariscos</b>.
                    </p>
                    <p class="hub-section-lead">
                        <b>Dulces y lácteos:</b> Por las tardes, es tradición disfrutar de <b>nieves artesanales</b>
                        en el parque, pan dulce de leña, dulces elaborados con piloncillo y coco,
                        además de los quesos frescos y cremas producidos en las rancherías
                        circundantes.
                    </p>
                </section>

                <section class="hub-section" id="hub-musica">
                    <h2><i class="fas fa-music"></i> Música, danza y tradiciones</h2>
                    <p class="hub-section-lead">
                        Tres Valles late a ritmo de <b>son jarocho</b>. Aunque es un municipio industrializado,
                        la raíz campesina mantiene viva la tradición de la <b>jarana</b>, el <b>requinto</b> y el
                        <b>zapateado</b>.
                    </p>
                </section>

                <section class="hub-section" id="hub-tradiciones">
                    <h2><i class="fas fa-mask"></i> Fiestas patronales y Día de Muertos</h2>
                    <p class="hub-section-lead">
                        <b>Calendario oficial de fiestas populares:</b>
                    </p>
                    <ul class="hub-poi-list">
                        <li><i class="fas fa-masks-theater"></i> <b>Carnaval</b> — abril (fecha movible, depende del comité de carnaval).</li>
                        <li><i class="fas fa-cross"></i> <b>Fiesta de Cristo Rey</b> — 20 de noviembre. Se inicia con el festejo del santo patrono.</li>
                        <li><i class="fas fa-cow"></i> <b>Feria Agrícola, Ganadera, Cultural e Industrial</b> — última semana de noviembre, coincidiendo con el aniversario del Municipio Libre (25 de noviembre).</li>
                    </ul>
                    <p class="hub-section-lead">
                        <b>Fiestas patronales:</b> Noviembre es el mes de fiesta. Se celebra a <b>Cristo Rey</b>
                        y, simultáneamente, el <b>aniversario del Municipio Libre (25 de noviembre de 1988)</b>.
                        La cabecera se llena de ferias, desfiles, cabalgatas, jaripeos y bailes populares.
                    </p>
                    <p class="hub-section-lead">
                        <b>Día de Muertos:</b> Las tradiciones se mantienen fuertes con la elaboración de
                        altares monumentales, la visita a los panteones y la preparación de tamales,
                        reflejando la mezcla de creencias indígenas y católicas. La población indígena
                        del municipio (~7.85% según INEGI 2010) habla principalmente <b>chinanteco</b> (1,989),
                        <b>mazateco</b> (804) y otras lenguas como zapoteco, náhuatl y mixteco.
                    </p>
                </section>

                <section class="hub-section" id="hub-natura">
                    <h2><i class="fas fa-leaf"></i> Naturaleza y entorno</h2>
                    <p class="hub-section-lead">
                        El municipio es un <b>oasis verde</b>. La biodiversidad se esconde en los márgenes
                        de los cultivos. Ríos perennes como el <b>Amapa</b>, arroyos, esteros y pequeños
                        humedales albergan una rica fauna típica del trópico: <b>iguanas, tlacuaches,
                        tortugas de agua dulce</b> y una inmensa variedad de aves, desde <b>garzas blancas</b>
                        que caminan tras los tractores, hasta <b>martines pescadores</b> y aves de rapiña.
                    </p>
                    <p class="hub-section-lead">
                        Los reductos de <b>selva baja caducifolia</b>, con árboles como la <b>Ceiba</b> y el
                        <b>Palo Mulato</b>, resisten en las periferias brindando sombra y oxígeno.
                    </p>
                </section>

                <section class="hub-section" id="hub-educacion">
                    <h2><i class="fas fa-graduation-cap"></i> Educación y comunidad</h2>
                    <p class="hub-section-lead">
                        Tres Valles cuenta con un sistema educativo que abarca desde preescolares hasta
                        nivel bachillerato tecnológico (como el <b>CBTis</b> y sistemas de <b>TEBAEV</b>), los
                        cuales preparan a los jóvenes para integrarse a la vida industrial de la región
                        o continuar estudios superiores en <b>Tuxtepec, Veracruz o Xalapa</b>.
                    </p>
                    <p class="hub-section-lead">
                        La <b>Casa de la Cultura</b> local y la <b>biblioteca municipal</b> hacen un esfuerzo
                        constante por mantener vivos los talleres artísticos y la formación cívica
                        de la juventud.
                    </p>
                </section>

                <section class="hub-section" id="hub-salud">
                    <h2><i class="fas fa-hospital"></i> Salud y Servicios</h2>
                    <p class="hub-section-lead">
                        Centros de salud comunitarios, clínicas IMSS / ISSSTE y consultorios privados
                        atienden a la población. Para especialidades, los hospitales regionales más
                        cercanos suelen ubicarse en cabeceras vecinas.
                    </p>
                </section>

                <section class="hub-section" id="hub-transporte">
                    <h2><i class="fas fa-bus"></i> Transporte y Conectividad</h2>
                    <p class="hub-section-lead">
                        Tres Valles está conectado por carreteras federales y estatales a Veracruz,
                        Tuxtepec (Oaxaca) y Cosamaloapan. El transporte mixto y las líneas foráneas
                        de autobús son los principales medios de conexión regional.
                    </p>
                </section>

                <section class="hub-section" id="hub-llegar">
                    <h2><i class="fas fa-route"></i> Cómo Llegar</h2>
                    <p class="hub-section-lead">
                        Desde la <b>Ciudad de Veracruz</b>: aprox. 2 h por la carretera federal hacia el sur.
                        Desde <b>Tuxtepec, Oaxaca</b>: 1 h aprox. Desde <b>Tierra Blanca</b>: 30 min.
                        Las terminales locales operan corridas frecuentes a estos destinos.
                    </p>
                </section>

                <section class="hub-section" id="hub-personajes">
                    <h2><i class="fas fa-user-astronaut"></i> Personajes Destacados</h2>
                    <p class="hub-section-lead">
                        <i class="fas fa-pen-to-square" style="color:var(--accent);"></i>
                        <i>Sección editable.</i> Aquí puedes documentar a personas que han aportado al
                        municipio: artistas, deportistas, profesores, líderes comunitarios, autoridades
                        históricas. La comunidad va sumando aportes con el tiempo.
                    </p>
                </section>

                <section class="hub-section" id="hub-comunidades">
                    <h2><i class="fas fa-house-chimney"></i> Comunidades y localidades</h2>
                    <p class="hub-section-lead">
                        Tres Valles es más que su cabecera municipal. El municipio está compuesto por
                        una red vital de congregaciones, ejidos y poblados (como <b>Novara</b>, <b>Los Naranjos</b>,
                        <b>Poblado Tres</b>, <b>Poblado Dos</b>, entre otros).
                    </p>
                    <p class="hub-section-lead">
                        Cada uno de estos lugares tiene su propia historia, nacida muchas veces de
                        acomodos ejidales, reacomodos históricos (como los derivados de la <b>presa
                        Cerro de Oro</b>) y un profundo sentido de comunidad local.
                    </p>
                </section>

                <section class="hub-section" id="hub-ferrocarril">
                    <h2><i class="fas fa-train"></i> Ferrocarril: Las vías del progreso</h2>
                    <p class="hub-section-lead">
                        El paso del tren es el <b>acta de nacimiento de Tres Valles</b>. A principios del
                        siglo XX, el <b>Ferrocarril del Istmo</b> trajo materiales, personas y progreso a la
                        llanura.
                    </p>
                    <p class="hub-section-lead">
                        Hoy en día, aunque el servicio de pasajeros es un recuerdo de generaciones
                        pasadas, las vías férreas siguen siendo una <b>arteria vital para el transporte de
                        carga</b>, movilizando miles de toneladas de azúcar, papel y materias primas.
                    </p>
                    <p class="hub-section-lead">
                        La antigua zona de la estación y los <b>puentes peatonales de metal</b> sobre las
                        vías sobreviven como monumentos históricos que definen el paisaje urbano e
                        industrial de la ciudad.
                    </p>
                </section>

                <section class="hub-section" id="hub-geologia">
                    <h2><i class="fas fa-cubes-stacked"></i> Geología</h2>
                    <p class="hub-section-lead">
                        El municipio se asienta sobre la planicie aluvial del río Papaloapan, con
                        suelos predominantemente sedimentarios formados por depósitos de los ríos
                        que descienden de la sierra. Esta composición explica la fertilidad y el
                        comportamiento del terreno frente a la lluvia.
                    </p>
                </section>

                <section class="hub-section" id="hub-deporte">
                    <h2><i class="fas fa-futbol"></i> Deporte: Pasión en el diamante y la cancha</h2>
                    <p class="hub-section-lead">
                        El deporte es el principal punto de reunión de las familias los fines de
                        semana.
                    </p>
                    <p class="hub-section-lead">
                        <b>El béisbol (el rey de los deportes):</b> Tres Valles tiene una pasión histórica
                        por el béisbol. La liga municipal y los torneos regionales son altamente
                        competitivos. Ejidos y colonias tienen sus propios equipos y campos, donde
                        las tardes de domingo se viven con intensidad.
                    </p>
                    <p class="hub-section-lead">
                        <b>Fútbol y más:</b> El fútbol soccer moviliza a cientos de jóvenes en las unidades
                        deportivas y campos llaneros. Además, el <b>voleibol</b> y el <b>baloncesto</b> tienen
                        una fuerte presencia en las canchas de las escuelas y el parque central.
                    </p>
                </section>

                <section class="hub-section" id="hub-curiosidades">
                    <h2><i class="fas fa-lightbulb"></i> Datos Curiosos</h2>
                    <p class="hub-section-lead">
                        <i class="fas fa-pen-to-square" style="color:var(--accent);"></i>
                        <i>Sección editable.</i> Recopila aquí anécdotas, hechos peculiares, récords
                        locales o detalles poco conocidos del municipio que merezcan ser preservados
                        para las nuevas generaciones.
                    </p>
                </section>

                <section class="hub-section" id="hub-logo">
                    <h2><i class="fas fa-shield-halved"></i> Logo y simbología municipal</h2>
                    <p class="hub-section-lead">
                        El logo de Tres Valles <b>representa la identidad agrícola, productiva y
                        ferroviaria del municipio en la cuenca del Papaloapan</b>, destacando los tres
                        elementos que sostienen la vida y la economía local: <b>la caña de azúcar, la
                        ganadería</b> y <b>las vías del tren</b> que dieron origen al pueblo. No es un
                        adorno heráldico abstracto: es un retrato visual de lo que la gente de Tres
                        Valles hace, cultiva y habita todos los días.
                    </p>

                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">La caña de azúcar</h3>
                    <p class="hub-section-lead">
                        La <b>caña</b> es el símbolo central. Representa las <b>~28,000 hectáreas</b>
                        sembradas que hacen de Tres Valles el <b>quinto productor nacional</b> de caña
                        y el primero de Veracruz, junto al <b>Ingenio Tres Valles</b> (1978) que ha
                        definido la zafra, los empleos y los ciclos del año en el municipio. Las hojas
                        verdes y los tallos dorados son la firma visual del pueblo cañero.
                    </p>

                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">La ganadería</h3>
                    <p class="hub-section-lead">
                        La <b>ganadería</b> aparece como contraparte de la caña: recuerda que las
                        zonas ejidales y las rancherías mantienen una fuerte tradición de bovinos de
                        <b>doble propósito</b> (carne y leche), vital para la economía rural, los
                        lácteos artesanales y la identidad del Sotavento veracruzano. Es el lado
                        pecuario de un municipio que no vive solo del azúcar.
                    </p>

                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">Las vías del tren</h3>
                    <p class="hub-section-lead">
                        El <b>ferrocarril</b> es el tercer pilar del logo. Las <b>vías cruzadas en
                        forma de Y</b> que ocupan el centro del escudo representan el <b>Ferrocarril
                        Veracruz al Pacífico</b> (después al Istmo), que entre <b>1899 y 1900</b> instaló
                        aquí el <b>Campamento Núm. 7</b> —el origen del pueblo— y que convirtió a Tres
                        Valles en <b>nudo de tres caminos</b> hacia Valle Nacional, Tesechoacan y Playa
                        Vicente. Sin el riel no habría municipio: el tren trazó la calle principal,
                        atrajo a los primeros pobladores y conectó la región con el puerto de Veracruz
                        y con el Istmo. El lema <b>"In Via Prosperitatis"</b> ("En el camino de la
                        prosperidad") que remata el escudo subraya esa vocación: Tres Valles como
                        <b>vía</b>, como cruce productivo.
                    </p>

                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">Tres valles, una sola identidad</h3>
                    <p class="hub-section-lead">
                        El propio nombre del municipio también es parte de la simbología. <b>"Tres
                        Valles"</b>, adoptado oficialmente en <b>1913</b>, recuerda que el poblado fue
                        <b>paso obligado hacia tres valles vecinos</b>: <b>Valle Nacional</b> (Oaxaca),
                        el <b>Valle del Tesechoacan</b> y el <b>Valle de Playa Vicente</b>. Esa
                        <b>vocación de cruce</b> —agrícola, ganadero y ferroviario— es lo que el logo
                        busca condensar, y se refuerza con las leyendas <b>"FÉRTIL"</b>, <b>"CÁLIDO"</b>
                        y <b>"PRÓSPERO"</b> que enmarcan el escudo.
                    </p>

                    <p class="hub-section-lead" style="margin-top:18px;font-size:0.85rem;font-style:italic;color:var(--text-dim);">
                        <i class="fas fa-info-circle"></i> El diseño oficial del escudo municipal puede
                        variar según la administración, pero los elementos descritos —caña, ganado y
                        vías del tren— son los símbolos recurrentes que el H. Ayuntamiento y la
                        comunidad usan para representar a Tres Valles.
                    </p>
                </section>

                <section class="hub-section" id="hub-bibliografia">
                    <h2><i class="fas fa-book"></i> Fuentes y bibliografía</h2>
                    <p class="hub-section-lead">
                        Los datos históricos, demográficos, geográficos y económicos publicados en esta
                        sección están respaldados por las siguientes fuentes oficiales y académicas:
                    </p>

                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">Fuentes oficiales</h3>
                    <ul class="hub-poi-list">
                        <li><i class="fas fa-building-columns"></i> <b>INEGI</b> — Instituto Nacional de Estadística y Geografía. Censo de Población y Vivienda 2010 y 2020. <i>"México en cifras: información nacional por entidad federativa y municipios; Tres Valles, Veracruz"</i>.</li>
                        <li><i class="fas fa-wheat-awn"></i> <b>SAGARPA / SADER</b> — Anuario estadístico de la producción agrícola.</li>
                        <li><i class="fas fa-cloud-sun"></i> <b>Servicio Meteorológico Nacional (CONAGUA)</b> — Parámetros climáticos. Estación CD. Alemán, Cosamaloapan.</li>
                        <li><i class="fas fa-scroll"></i> <b>Decreto N° 195</b> de la H. LIV Legislatura del Estado de Veracruz, 25 de noviembre de 1988. Publicado en la Gaceta Oficial 142 (26 de noviembre de 1988).</li>
                        <li><i class="fas fa-globe"></i> <b>PNUD</b> — Programa de las Naciones Unidas para el Desarrollo. <i>"IDH Municipal en México: Nueva metodología"</i>.</li>
                        <li><i class="fas fa-landmark-flag"></i> <b>INAFED</b> — Instituto Nacional para el Federalismo y el Desarrollo Municipal. <i>"Enciclopedia de los Municipios de México"</i>.</li>
                    </ul>

                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">Bibliografía académica</h3>
                    <ul class="hub-poi-list">
                        <li><i class="fas fa-book-open"></i> Hernández Maus, Elpidia (1962). <i>Tesis de Elpidia Hernández Maus</i>. Jalapa-Enríquez: Escuela Normal Veracruzana "Enrique C. Rébsamen".</li>
                        <li><i class="fas fa-book-open"></i> Corro Ramos, Octaviano (1995). <i>Cosamaloapan. La historia y el hábitat de un gran pueblo</i>. Xalapa: Gobierno del Estado de Veracruz-Llave. ISBN 970-626-135-4.</li>
                        <li><i class="fas fa-book-open"></i> Yáñez López, Antonio (2007). <i>"Tres Valles parte de la historia"</i>. Mano a mano, Vol. 2 N° 5. Coordinación Estatal de Juntas de Mejoras, Xalapa.</li>
                        <li><i class="fas fa-book-open"></i> Yáñez López, Antonio (2008). <i>"Crónica Municipal: Campo Siete, parte de nuestra historia"</i>. Campo 7, Vol. 1 N° 1. Órgano informativo del H. Ayuntamiento de Tres Valles.</li>
                        <li><i class="fas fa-book-open"></i> Velasco Toro, José y Montero García, Luis Alberto (2005). <i>"La construcción del ramal ferroviario Tres Valles San Cristóbal"</i>, en <i>Economía y espacio en el Papaloapan veracruzano, siglos XVII-XX</i>. Gobierno del Estado de Veracruz. ISBN 9706262326.</li>
                        <li><i class="fas fa-book-open"></i> Miranda Hernández, Noé (2013). <i>"Historia religiosa"</i>, en <i>La esmeralda del Papaloapan</i>. Palibrio. ISBN 9781463353841.</li>
                        <li><i class="fas fa-book-open"></i> García de León, Antonio (2011). <i>Tierra adentro, mar en fuera; el puerto de Veracruz y su litoral a Sotavento, 1519-1821</i>. FCE / Universidad Veracruzana / SEV. ISBN 9786071606150.</li>
                        <li><i class="fas fa-book-open"></i> Celaya Nández, Yolanda (2000). <i>Un espacio ganadero en Cosamaloapan: la hacienda Santo Tomás de las Lomas, siglos XVI al XVIII</i> (Tesis). Xalapa: Universidad Veracruzana.</li>
                        <li><i class="fas fa-book-open"></i> Luna Leal, Marisol (2010). <i>"Historia de la organización territorial en el estado de Veracruz"</i>. Xalapa: Universidad Veracruzana.</li>
                        <li><i class="fas fa-book-open"></i> Lupo, Alessandro y López Austin, Alfredo (1998). <i>La cultura plural: reflexiones sobre diálogo y silencios en Mesoamérica: homenaje a Italo Signorini</i>. ISBN 9789683666994.</li>
                    </ul>

                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">Fuentes históricas primarias</h3>
                    <ul class="hub-poi-list">
                        <li><i class="fas fa-file-lines"></i> <b>The Mexican Year Book: A financial and commercial handbook</b> (1914). Nueva York: McCorquodale & Co. Ltd. — Primera publicación oficial con el nombre "Tres Valles" (datos de 1913).</li>
                        <li><i class="fas fa-file-lines"></i> <b>The Railway Age and Northwestern Railroader</b>. Volúmenes 26-31 (1898-1901). Documentación del Ferrocarril Veracruz al Pacífico.</li>
                        <li><i class="fas fa-file-lines"></i> <b>Terry's Mexico: Handbook for Travellers</b> (1909). México: Sonora News Company.</li>
                        <li><i class="fas fa-file-lines"></i> <b>Gaceta del Gobierno de México</b> (1812-1814). Documentos sobre Juan Bautista Topete y Viaña en la Cuenca del Papaloapan.</li>
                        <li><i class="fas fa-file-lines"></i> <b>Registro Público de la Propiedad de Cosamaloapan</b> — Libro 7-2-8/896 y registro de expropiación de 1937.</li>
                    </ul>

                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">Fuentes periodísticas</h3>
                    <ul class="hub-poi-list">
                        <li><i class="fas fa-newspaper"></i> <b>Más Noticias</b> — <i>"Tres Valles enfrenta bajas ventas; programas sociales dan respiro al comercio"</i>. Disponible en: <a href="https://www.masnoticias.mx/tres-valles-enfrenta-bajas-ventas-programas-sociales-dan-respiro-al-comercio/" target="_blank" rel="noopener noreferrer" style="color:var(--accent);">masnoticias.mx</a></li>
                    </ul>

                    <h3 style="color:var(--text);font-size:1rem;margin:18px 0 8px;">Compilación general</h3>
                    <ul class="hub-poi-list">
                        <li><i class="fas fa-globe"></i> <b>Wikipedia</b> — Artículo "Tres Valles (Veracruz)" — compilación y síntesis de las fuentes anteriores. Disponible en: <a href="https://es.wikipedia.org/wiki/Tres_Valles_(Veracruz)" target="_blank" rel="noopener noreferrer" style="color:var(--accent);">es.wikipedia.org/wiki/Tres_Valles_(Veracruz)</a></li>
                        <li><i class="fas fa-school"></i> <b>Universidad Veracruzana</b> — <i>Diccionario Enciclopédico Veracruzano</i>. Entrada: "Tres Valles (municipio)".</li>
                    </ul>

                    <p class="hub-section-lead" style="margin-top:18px;font-size:0.85rem;font-style:italic;color:var(--text-dim);">
                        <i class="fas fa-info-circle"></i> Esta sección se presenta con fines informativos y educativos.
                        Las fuentes citadas son las referencias originales del artículo de Wikipedia sobre el municipio,
                        cuyo contenido ha sido editado y resumido para esta plataforma comunitaria.
                    </p>
                </section>

                ${this.renderGallerySection()}

                <!-- VIDEO DESTACADO ALEATORIO (default playlist) -->
                ${App.videosDefault?.renderSection?.() || ''}

                <!-- VIDEOS COMUNITARIOS -->
                <section class="hub-section" id="hub-videos">
                    <h2><i class="fas fa-circle-play"></i> Videos comunitarios</h2>
                    <p class="hub-section-lead">
                        Documentales, recorridos, testimonios y momentos de Tres Valles. Si tienes un video que aporte valor a la comunidad, pídele al admin que lo añada.
                    </p>
                    ${App.db.session?.role === 'admin' ? `
                        <button class="btn-small" style="margin-bottom:14px;" onclick="App.ui.openVideoEditor()">
                            <i class="fas fa-plus"></i> Añadir video de YouTube
                        </button>` : ''}
                    <div id="videos-grid" class="videos-grid">
                        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Cargando videos…</p></div>
                    </div>
                </section>

                <!-- PIE: CONTADOR DE VISITAS + CONTACTO -->
                <footer class="hub-footer">
                    <div class="hub-visit-counter" title="Total de visitas registradas al sitio">
                        <i class="fas fa-eye"></i>
                        <span id="hub-visit-count" class="hub-visit-num">…</span>
                        <span class="hub-visit-label">visitas</span>
                    </div>
                    <a class="hub-contact-btn"
                       href="mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Contacto desde Explora Tres Valles')}">
                        <i class="fas fa-envelope"></i> Enviar un correo
                    </a>
                </footer>
            `;
            this.renderBusinessDirectory();
            // Iniciar mapa al final (Leaflet ya cargado vía <script defer>)
            setTimeout(() => this.initHubMap(), 50);
            // Cargar videos comunitarios desde Supabase
            this.renderVideosGrid();
            // Contador de visitas del pie
            this.renderVisitCounter();
        },

        // Rellena el contador de visitas del pie de la sección Explora.
        async renderVisitCounter() {
            const el = document.getElementById('hub-visit-count');
            if (!el) return;
            const count = await App.sb.registerVisit();
            el.textContent = (count === null || count === undefined)
                ? '—'
                : count.toLocaleString('es-MX');
        },

        // Renderiza el grid de videos comunitarios (sección Explora)
        async renderVideosGrid() {
            const grid = document.getElementById('videos-grid');
            if (!grid) return;
            const isAdmin = App.db.session?.role === 'admin';
            const videos = await App.sb.fetchVideos();
            if (!videos || videos.length === 0) {
                grid.innerHTML = `<div class="empty-state"><i class="fas fa-video-slash"></i><p>Aún no hay videos publicados. ${isAdmin ? 'Añade uno para empezar.' : 'Vuelve más tarde.'}</p></div>`;
                return;
            }
            grid.innerHTML = videos.map(v => `
                <article class="video-card ${v.featured ? 'featured' : ''}">
                    ${v.featured ? '<span class="video-featured-badge"><i class="fas fa-star"></i> Destacado</span>' : ''}
                    ${isAdmin ? `<button class="video-del" onclick="App.ui.deleteVideoAdmin('${v.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>` : ''}
                    <div class="video-frame">${youtubeFacadeHTML(v.youtube_id, v.title)}</div>
                    <div class="video-info">
                        <h4>${escapeHtml(v.title)}</h4>
                        ${v.description ? `<p>${escapeHtml(v.description)}</p>` : ''}
                        <div class="video-meta">
                            ${v.category && v.category !== 'general' ? `<span class="video-cat">${escapeHtml(v.category)}</span>` : ''}
                            <small><i class="far fa-clock"></i> ${App.ui.timeAgo(v.created_at)}</small>
                        </div>
                    </div>
                </article>
            `).join('');
        },

        // Modal admin: añadir video de YouTube por URL
        openVideoEditor() {
            if (App.db.session?.role !== 'admin') {
                this.toast('Solo admin puede añadir videos', 'error');
                return;
            }
            let modal = document.getElementById('video-editor-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'video-editor-modal';
                modal.className = 'modal hidden';
                /* Modal NO cierra al click fuera — solo el botón X. */
                document.body.appendChild(modal);
            }
            modal.innerHTML = `
                <div class="modal-content video-editor-content">
                    <button class="close-btn" onclick="App.ui.closeVideoEditor()" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                    <h3 style="margin:0 0 8px;color:var(--accent);"><i class="fas fa-circle-play"></i> Añadir video</h3>
                    <p style="color:var(--text-dim);font-size:0.85rem;margin:0 0 16px;">
                        Pega la URL de YouTube. Se extraerá el ID automáticamente.
                    </p>
                    <form onsubmit="event.preventDefault(); App.ui.saveVideoEditor();" class="video-form">
                        <label class="biz-form-row">
                            <span>URL del video <small>(YouTube)</small></span>
                            <input id="vid-url" type="url" required
                                   placeholder="https://www.youtube.com/watch?v=..."
                                   class="input-modern">
                        </label>
                        <label class="biz-form-row">
                            <span>Título</span>
                            <input id="vid-title" type="text" required maxlength="120"
                                   placeholder="Ej: Recorrido por la Plaza Principal"
                                   class="input-modern">
                        </label>
                        <label class="biz-form-row">
                            <span>Descripción <small>(opcional)</small></span>
                            <textarea id="vid-desc" maxlength="300" rows="3"
                                      placeholder="Breve contexto sobre el video"
                                      class="input-modern"></textarea>
                        </label>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                            <label class="biz-form-row">
                                <span>Categoría</span>
                                <select id="vid-cat" class="input-modern">
                                    <option value="general">General</option>
                                    <option value="historia">Historia</option>
                                    <option value="economia">Economía</option>
                                    <option value="cultura">Cultura</option>
                                    <option value="naturaleza">Naturaleza</option>
                                    <option value="testimonio">Testimonio</option>
                                </select>
                            </label>
                            <label class="biz-form-row" style="justify-content:flex-end;">
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:var(--text);font-size:0.85rem;margin-top:24px;">
                                    <input type="checkbox" id="vid-featured" style="cursor:pointer;">
                                    <i class="fas fa-star" style="color:#f59e0b;"></i> Destacar
                                </label>
                            </label>
                        </div>
                        <div class="biz-form-actions">
                            <button type="button" class="btn-ghost" onclick="App.ui.closeVideoEditor()">Cancelar</button>
                            <button type="submit" class="btn-primary"><i class="fas fa-plus"></i> Añadir video</button>
                        </div>
                    </form>
                </div>`;
            modal.classList.remove('hidden');
        },

        closeVideoEditor() {
            document.getElementById('video-editor-modal')?.classList.add('hidden');
        },

        async saveVideoEditor() {
            const url = document.getElementById('vid-url').value.trim();
            const title = document.getElementById('vid-title').value.trim();
            const desc = document.getElementById('vid-desc').value.trim();
            const cat = document.getElementById('vid-cat').value;
            const featured = document.getElementById('vid-featured').checked;

            const ytId = (typeof getYouTubeId === 'function') ? getYouTubeId(url) : null;
            if (!ytId) {
                this.toast('URL de YouTube inválida · prueba con un link como https://www.youtube.com/watch?v=…', 'warning');
                return;
            }
            if (!title) { this.toast('El título es obligatorio', 'warning'); return; }

            const result = await App.sb.insertVideo(title, ytId, desc, cat, featured);
            if (!result) return;
            this.closeVideoEditor();
            this.renderVideosGrid();
            this.toast('Video añadido', 'success');
        },

        async deleteVideoAdmin(id) {
            if (App.db.session?.role !== 'admin') return;
            if (!confirm('¿Eliminar este video del hub?')) return;
            const ok = await App.sb.deleteVideo(id);
            if (!ok) return;
            this.renderVideosGrid();
            this.toast('Video eliminado', 'success');
        },

        // ===== MAPA LEAFLET =====
        // Devuelve [lat, lng] o null para un negocio. Acepta b.coords [lat,lng]
        // (legacy) o b.lat/b.lng (Supabase).
        _bizCoords(b) {
            if (Array.isArray(b.coords) && b.coords.length === 2) return b.coords;
            if (typeof b.lat === 'number' && typeof b.lng === 'number') return [b.lat, b.lng];
            return null;
        },

        // Crea un L.divIcon con el icono FontAwesome de la categoría.
        _makeCategoryIcon(category) {
            const cfg = CATEGORY_MARKERS[category] || DEFAULT_MARKER;
            return L.divIcon({
                html: `<div class="cat-marker-pin" style="--c:${cfg.color}">
                          <i class="fas ${cfg.icon}"></i>
                       </div>`,
                className: 'cat-marker-wrap',
                iconSize: [38, 46],
                iconAnchor: [19, 44],
                popupAnchor: [0, -42]
            });
        },

        // HTML del popup con botones de "Cómo llegar" (Google Maps) y "Ver detalles".
        _bizPopupHTML(b, coords) {
            const cfg = CATEGORY_MARKERS[b.category] || DEFAULT_MARKER;
            const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}`;
            const phoneClean = (b.phone || '').replace(/\D/g, '');
            return `
                <div class="biz-popup">
                    <div class="biz-popup-cat" style="background:${cfg.color}">
                        <i class="fas ${cfg.icon}"></i> ${escapeHtml(b.category)}
                    </div>
                    <h4 class="biz-popup-name">${escapeHtml(b.name)}</h4>
                    ${b.address ? `<p class="biz-popup-addr"><i class="fas fa-location-dot"></i> ${escapeHtml(b.address)}</p>` : ''}
                    ${b.phone ? `<p class="biz-popup-phone"><i class="fas fa-phone"></i> ${escapeHtml(b.phone)}</p>` : ''}
                    <div class="biz-popup-actions">
                        <a href="${gmapsUrl}" target="_blank" rel="noopener" class="biz-popup-btn primary">
                            <i class="fas fa-route"></i> Cómo llegar
                        </a>
                        ${phoneClean ? `<a href="tel:${phoneClean}" class="biz-popup-btn"><i class="fas fa-phone"></i> Llamar</a>` : ''}
                    </div>
                </div>`;
        },

        initHubMap() {
            if (typeof L === 'undefined') {
                console.warn('[Hub] Leaflet no cargado todavía');
                return;
            }
            const el = document.getElementById('hub-map');
            if (!el || el._mapInstance) return;

            const bounds = L.latLngBounds(TRES_VALLES_BOUNDS);
            const map = L.map(el, {
                center: TRES_VALLES_CENTER,
                zoom: 14,
                minZoom: 12,                // No deja alejar más de aquí (ya se ve toda la zona)
                maxZoom: 19,
                maxBounds: bounds,          // Limita el pan a Tres Valles
                maxBoundsViscosity: 1.0     // Bloqueo "sólido": al llegar al borde rebota
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 19,
                minZoom: 12,
                bounds: bounds              // No descarga tiles fuera del área
            }).addTo(map);

            // Marker central (centro municipal)
            const centerIcon = L.divIcon({
                html: `<div class="cat-marker-pin center-pin" style="--c:#00d2ff"><i class="fas fa-location-crosshairs"></i></div>`,
                className: 'cat-marker-wrap',
                iconSize: [42, 50], iconAnchor: [21, 48], popupAnchor: [0, -46]
            });
            L.marker(TRES_VALLES_CENTER, { icon: centerIcon }).addTo(map)
                .bindPopup('<b>Tres Valles</b><br>Centro municipal');

            // Markers de negocios — capa separada para poder filtrar/limpiar
            const bizLayer = L.layerGroup().addTo(map);
            const points = [];
            (App.db.businesses || []).forEach(b => {
                const c = this._bizCoords(b);
                if (!c) return;
                const m = L.marker(c, { icon: this._makeCategoryIcon(b.category) })
                    .bindPopup(this._bizPopupHTML(b, c));
                bizLayer.addLayer(m);
                points.push(c);
            });

            // Auto-fit: si hay negocios mapeados, encajar el viewport para verlos todos.
            if (points.length > 0) {
                const bounds = L.latLngBounds([TRES_VALLES_CENTER, ...points]).pad(0.1);
                map.fitBounds(bounds, { maxZoom: 16 });
            }

            // Leyenda flotante con categorías presentes
            const usedCats = new Set();
            (App.db.businesses || []).forEach(b => { if (this._bizCoords(b)) usedCats.add(b.category); });
            if (usedCats.size > 0) {
                const legend = L.control({ position: 'topright' });
                legend.onAdd = () => {
                    const div = L.DomUtil.create('div', 'map-legend');
                    div.innerHTML = '<div class="map-legend-title"><i class="fas fa-layer-group"></i> Categorías</div>'
                        + [...usedCats].sort().map(cat => {
                            const cfg = CATEGORY_MARKERS[cat] || DEFAULT_MARKER;
                            return `<div class="map-legend-row"><span class="map-legend-dot" style="background:${cfg.color}"><i class="fas ${cfg.icon}"></i></span> ${escapeHtml(cat)}</div>`;
                        }).join('');
                    L.DomEvent.disableClickPropagation(div);
                    return div;
                };
                legend.addTo(map);
            }

            // Modo "Asignar coordenadas" — admin: click en el mapa guarda coords al negocio en pick.
            map.on('click', async (e) => {
                const pick = App.ui.state._mapPick;
                if (!pick) return;
                const idx = App.db.businesses.findIndex(b => String(b.id) === String(pick.bizId));
                if (idx < 0) { App.ui.toast('Negocio no encontrado', 'error'); App.ui.exitMapPickMode(); return; }
                const biz = App.db.businesses[idx];
                const coords = [e.latlng.lat, e.latlng.lng];

                if (biz._supabase) {
                    // Ya está en Supabase: actualiza coords
                    const ok = await App.sb.updateBusiness(biz.id, { coords });
                    if (!ok) { App.ui.exitMapPickMode(); return; }
                    biz.coords = coords; biz.lat = coords[0]; biz.lng = coords[1];
                } else {
                    // Es seed local: lo promovemos a Supabase con coords incluidas
                    const inserted = await App.sb.insertBusiness({ ...biz, coords, _template: false });
                    if (!inserted) { App.ui.exitMapPickMode(); return; }
                    App.db.businesses[idx] = {
                        id: inserted.id, name: inserted.name, category: inserted.category,
                        address: inserted.address || '', phone: inserted.phone || '',
                        description: inserted.description || '', image: inserted.image || '',
                        coords: [inserted.lat, inserted.lng], lat: inserted.lat, lng: inserted.lng,
                        _template: false, _supabase: true
                    };
                }
                App.db.save();
                App.ui.toast(`Ubicación guardada para "${biz.name}"`, 'success');
                App.ui.exitMapPickMode();
                App.ui.navigate('explora');
            });

            el._mapInstance = map;
            el._mapBizLayer = bizLayer;
        },

        // Modo asignar coordenadas (admin). Requiere id de negocio.
        enterMapPickMode(bizId) {
            if (App.db.session?.role !== 'admin') {
                this.toast('Solo admin puede asignar coordenadas', 'error');
                return;
            }
            const biz = App.db.businesses.find(b => String(b.id) === String(bizId));
            if (!biz) { this.toast('Negocio no encontrado', 'error'); return; }

            this.state._mapPick = { bizId };
            const banner = document.createElement('div');
            banner.id = 'map-pick-banner';
            banner.className = 'map-pick-banner';
            banner.innerHTML = `
                <i class="fas fa-crosshairs"></i>
                <div>
                    <b>Asignando coordenadas a "${escapeHtml(biz.name)}"</b>
                    <small>Haz click en el mapa donde queda el negocio</small>
                </div>
                <button onclick="App.ui.exitMapPickMode()" title="Cancelar"><i class="fas fa-times"></i></button>`;
            document.body.appendChild(banner);

            // Llevar al usuario al mapa
            if (this.state.currentRoute !== 'explora') this.navigate('explora');
            setTimeout(() => {
                document.getElementById('hub-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
            this.toast('Click en el mapa para fijar la ubicación', 'info');
        },

        exitMapPickMode() {
            this.state._mapPick = null;
            document.getElementById('map-pick-banner')?.remove();
        },

        // Legacy: setear coords desde consola (sigue funcionando)
        async setBusinessCoords(id, coords) {
            const b = App.db.businesses.find(x => String(x.id) === String(id));
            if (!b) return console.warn('Negocio no encontrado');
            if (b._supabase) await App.sb.updateBusiness(id, { coords });
            b.coords = coords;
            App.db.save();
            App.ui.toast(`Coordenadas guardadas para "${b.name}"`, 'success');
            if (this.state.currentRoute === 'explora') this.navigate('explora');
        },

        // ============ ADMIN: CRUD DE NEGOCIOS ============
        // Abre el editor (id=null para crear nuevo, id=existente para editar).
        openBusinessEditor(id = null) {
            if (App.db.session?.role !== 'admin') {
                this.toast('Solo admin puede gestionar negocios', 'error');
                return;
            }
            const isNew = id === null;
            const b = isNew ? { name:'', category:'Comercio', address:'', phone:'', description:'', coords:null }
                            : App.db.businesses.find(x => String(x.id) === String(id));
            if (!b) { this.toast('Negocio no encontrado', 'error'); return; }

            const cats = Object.keys(CATEGORY_MARKERS);
            const modal = document.getElementById('biz-editor-modal') || (() => {
                const el = document.createElement('div');
                el.id = 'biz-editor-modal';
                el.className = 'modal hidden';
                document.body.appendChild(el);
                return el;
            })();

            modal.innerHTML = `
                <div class="modal-content biz-editor">
                    <button class="close-btn" onclick="App.ui.closeBusinessEditor()" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                    <h2 style="margin:0 0 18px;display:flex;align-items:center;gap:10px;color:var(--accent);">
                        <i class="fas fa-store"></i> ${isNew ? 'Crear nuevo negocio' : 'Editar negocio'}
                    </h2>
                    <form onsubmit="event.preventDefault(); App.ui.saveBusinessEditor(${isNew ? 'null' : `'${b.id}'`})" class="biz-form">
                        <label class="biz-form-row">
                            <span>Nombre</span>
                            <input id="bizf-name" type="text" required maxlength="80" value="${escapeHtml(b.name)}" placeholder="Ej: Tortillería La Esperanza">
                        </label>
                        <label class="biz-form-row">
                            <span>Categoría</span>
                            <select id="bizf-cat" required>
                                ${cats.map(c => `<option value="${escapeHtml(c)}" ${b.category===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}
                            </select>
                        </label>
                        <label class="biz-form-row">
                            <span>Dirección</span>
                            <input id="bizf-addr" type="text" maxlength="160" value="${escapeHtml(b.address || '')}" placeholder="Calle, número, colonia">
                        </label>
                        <label class="biz-form-row">
                            <span>Teléfono</span>
                            <input id="bizf-phone" type="text" maxlength="40" value="${escapeHtml(b.phone || '')}" placeholder="283-555-0000">
                        </label>
                        <label class="biz-form-row">
                            <span>Descripción <small>(opcional)</small></span>
                            <textarea id="bizf-desc" maxlength="400" rows="3" placeholder="Servicios, horarios, etc.">${escapeHtml(b.description || '')}</textarea>
                        </label>
                        ${b.coords ? `<p class="biz-form-coords"><i class="fas fa-map-pin"></i> Coordenadas actuales: <code>${b.coords[0].toFixed(5)}, ${b.coords[1].toFixed(5)}</code></p>` : `<p class="biz-form-coords"><i class="fas fa-circle-exclamation"></i> Sin ubicación. Usa "Marcar en mapa" en el directorio tras guardar.</p>`}
                        <div class="biz-form-actions">
                            <button type="button" class="btn-ghost" onclick="App.ui.closeBusinessEditor()">Cancelar</button>
                            <button type="submit" class="btn-primary"><i class="fas fa-${isNew?'plus':'check'}"></i> ${isNew ? 'Crear' : 'Guardar cambios'}</button>
                        </div>
                    </form>
                </div>`;
            modal.classList.remove('hidden');
        },

        closeBusinessEditor() {
            document.getElementById('biz-editor-modal')?.classList.add('hidden');
        },

        async saveBusinessEditor(id) {
            const name  = document.getElementById('bizf-name').value.trim();
            const category = document.getElementById('bizf-cat').value;
            const address = document.getElementById('bizf-addr').value.trim();
            const phone   = document.getElementById('bizf-phone').value.trim();
            const description = document.getElementById('bizf-desc').value.trim();
            if (!name) { this.toast('El nombre es obligatorio', 'warning'); return; }

            if (id === null) {
                // Crear nuevo
                const inserted = await App.sb.insertBusiness({ name, category, address, phone, description, coords: null });
                if (!inserted) return;
                App.db.businesses.unshift({
                    id: inserted.id, name: inserted.name, category: inserted.category,
                    address: inserted.address || '', phone: inserted.phone || '',
                    description: inserted.description || '', image: '',
                    coords: null, lat: null, lng: null,
                    _template: false, _supabase: true
                });
                this.toast(`Negocio "${name}" creado`, 'success');
            } else {
                // Editar existente
                const idx = App.db.businesses.findIndex(b => String(b.id) === String(id));
                if (idx < 0) { this.toast('Negocio no encontrado', 'error'); return; }
                const biz = App.db.businesses[idx];
                if (biz._supabase) {
                    const ok = await App.sb.updateBusiness(id, { name, category, address, phone, description });
                    if (!ok) return;
                } else {
                    // Era seed local: ahora se promueve a Supabase
                    const inserted = await App.sb.insertBusiness({ name, category, address, phone, description, coords: biz.coords, _template: false });
                    if (!inserted) return;
                    App.db.businesses[idx] = {
                        id: inserted.id, name: inserted.name, category: inserted.category,
                        address: inserted.address || '', phone: inserted.phone || '',
                        description: inserted.description || '', image: inserted.image || '',
                        coords: (typeof inserted.lat === 'number' && typeof inserted.lng === 'number') ? [inserted.lat, inserted.lng] : null,
                        lat: inserted.lat, lng: inserted.lng,
                        _template: false, _supabase: true
                    };
                    App.db.save();
                    this.closeBusinessEditor();
                    this.renderBusinessDirectory?.();
                    this.toast(`Negocio actualizado y registrado`, 'success');
                    return;
                }
                Object.assign(biz, { name, category, address, phone, description });
            }
            App.db.save();
            this.closeBusinessEditor();
            this.renderBusinessDirectory?.();
            // Refrescar mapa también
            const mapEl = document.getElementById('hub-map');
            if (mapEl?._mapInstance) { mapEl._mapInstance.remove(); delete mapEl._mapInstance; setTimeout(() => this.initHubMap(), 50); }
        },

        async deleteBusinessAdmin(id) {
            if (App.db.session?.role !== 'admin') {
                this.toast('Solo admin puede eliminar', 'error');
                return;
            }
            const idx = App.db.businesses.findIndex(b => String(b.id) === String(id));
            if (idx < 0) return;
            const biz = App.db.businesses[idx];
            if (!confirm(`¿Eliminar "${biz.name}" del directorio?\n\nEsta acción no se puede deshacer.`)) return;

            if (biz._supabase) {
                const ok = await App.sb.deleteBusiness(id);
                if (!ok) return;
            }
            App.db.businesses.splice(idx, 1);
            App.db.save();
            this.renderBusinessDirectory?.();
            const mapEl = document.getElementById('hub-map');
            if (mapEl?._mapInstance) { mapEl._mapInstance.remove(); delete mapEl._mapInstance; setTimeout(() => this.initHubMap(), 50); }
            this.toast(`"${biz.name}" eliminado`, 'success');
        },

        // ============ MODO SELECCIÓN MÚLTIPLE ============
        enterBizSelectMode() {
            if (App.db.session?.role !== 'admin') {
                this.toast('Solo admin puede gestionar negocios', 'error');
                return;
            }
            this.state.bizSelectMode = true;
            this.state.bizSelected = new Set();
            this.renderBusinessDirectory?.();
        },

        exitBizSelectMode() {
            this.state.bizSelectMode = false;
            this.state.bizSelected = new Set();
            this.renderBusinessDirectory?.();
        },

        toggleBizSelected(id) {
            this.state.bizSelected = this.state.bizSelected || new Set();
            const key = String(id);
            if (this.state.bizSelected.has(key)) this.state.bizSelected.delete(key);
            else this.state.bizSelected.add(key);
            this.renderBusinessDirectory?.();
        },

        // Selecciona/deselecciona todos los visibles según el filtro actual.
        toggleAllVisibleBiz() {
            this.state.bizSelected = this.state.bizSelected || new Set();
            const q = (document.getElementById('biz-search')?.value || '').toLowerCase().trim();
            const cat = document.getElementById('biz-category')?.value || 'all';
            const visible = App.db.businesses.filter(b => {
                const matchesQ = !q || b.name.toLowerCase().includes(q) || (b.address || '').toLowerCase().includes(q);
                const matchesCat = cat === 'all' || b.category === cat;
                return matchesQ && matchesCat;
            });
            const visibleIds = visible.map(b => String(b.id));
            const allSelected = visibleIds.every(id => this.state.bizSelected.has(id));
            if (allSelected) visibleIds.forEach(id => this.state.bizSelected.delete(id));
            else visibleIds.forEach(id => this.state.bizSelected.add(id));
            this.renderBusinessDirectory?.();
        },

        async deleteBizSelected() {
            if (App.db.session?.role !== 'admin') return;
            const ids = [...(this.state.bizSelected || [])];
            if (ids.length === 0) return;

            if (!confirm(`¿Eliminar ${ids.length} negocio${ids.length === 1 ? '' : 's'} seleccionado${ids.length === 1 ? '' : 's'}?\n\nEsta acción no se puede deshacer.`)) return;

            // Separar locales (sin _supabase) y remotos
            const remoteIds = [];
            const localIds = [];
            ids.forEach(id => {
                const b = App.db.businesses.find(x => String(x.id) === id);
                if (!b) return;
                if (b._supabase) remoteIds.push(b.id);
                else localIds.push(String(b.id));
            });

            // Borrado masivo en Supabase
            if (remoteIds.length > 0 && window.SB) {
                const { error } = await SB.from('businesses').delete().in('id', remoteIds);
                if (error) {
                    console.error('[ui] bulk delete:', error);
                    App.ui.toast('Algunos no se pudieron eliminar (revisa consola)', 'error');
                    return;
                }
            }

            // Borrado en cache local
            App.db.businesses = App.db.businesses.filter(b => !ids.includes(String(b.id)));
            App.db.save();
            this.exitBizSelectMode();

            // Refrescar mapa
            const mapEl = document.getElementById('hub-map');
            if (mapEl?._mapInstance) { mapEl._mapInstance.remove(); delete mapEl._mapInstance; setTimeout(() => this.initHubMap(), 50); }

            this.toast(`${ids.length} negocio${ids.length === 1 ? '' : 's'} eliminado${ids.length === 1 ? '' : 's'}`, 'success');
        },

        // Borra todos los seed templates locales (los que no están en Supabase).
        clearLocalTemplates() {
            if (App.db.session?.role !== 'admin') {
                this.toast('Solo admin puede ejecutar esta acción', 'error');
                return;
            }
            const templates = App.db.businesses.filter(b => b._template && !b._supabase);
            if (templates.length === 0) {
                this.toast('No hay datos de prueba locales para limpiar', 'info');
                return;
            }
            if (!confirm(`¿Eliminar ${templates.length} negocios de prueba (datos locales)?\n\nLos negocios reales en Supabase NO se tocan.`)) return;
            App.db.businesses = App.db.businesses.filter(b => !(b._template && !b._supabase));
            App.db.save();
            this.renderBusinessDirectory?.();
            const mapEl = document.getElementById('hub-map');
            if (mapEl?._mapInstance) { mapEl._mapInstance.remove(); delete mapEl._mapInstance; setTimeout(() => this.initHubMap(), 50); }
            this.toast(`${templates.length} datos de prueba eliminados`, 'success');
        },

        renderGallerySection() {
            const userItems = App.db.gallery || [];
            const defaults = App.gallery._defaults || [];
            // Las del usuario van primero (más recientes); las default después con un tag.
            const isAdmin = App.db.session?.role === 'admin';

            const userTiles = userItems.map(g => `
                <div class="gallery-item" onclick="App.gallery.openLightbox(${g.id})">
                    <img src="${escapeHtml(g.src)}" alt="${escapeHtml(g.caption || '')}" loading="lazy">
                    ${g.caption ? `<div class="gallery-caption">${escapeHtml(g.caption)}</div>` : ''}
                    ${isAdmin ? `<button class="gallery-del" onclick="event.stopPropagation(); App.gallery.delete(${g.id})" title="Eliminar"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            `).join('');

            const defaultTiles = defaults.map(d => `
                <div class="gallery-item gallery-default-item" onclick="App.gallery.openLightboxDefault('${escapeJsAttr(d.src)}', '${escapeJsAttr(d.caption || '')}')">
                    <img src="${escapeHtml(d.src)}" alt="${escapeHtml(d.caption || '')}" loading="lazy" onerror="this.parentElement.style.display='none'">
                    <div class="gallery-default-tag" title="Imagen precargada">default</div>
                    ${d.caption ? `<div class="gallery-caption">${escapeHtml(d.caption)}</div>` : ''}
                </div>
            `).join('');

            const grid = (userItems.length === 0 && defaults.length === 0)
                ? `<div class="empty-state"><i class="fas fa-images"></i><p>Aún no hay fotos en la galería</p></div>`
                : `<div class="gallery-grid">${userTiles}${defaultTiles}</div>`;

            return `
                <section class="hub-section" id="hub-galeria">
                    <h2><i class="fas fa-images"></i> Galería</h2>
                    <p class="hub-section-lead">Imágenes de Tres Valles compartidas por la comunidad.</p>
                    ${isAdmin ? `
                        <label class="btn-small" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:14px;">
                            <i class="fas fa-cloud-arrow-up"></i> Subir foto
                            <input type="file" accept="image/*" onchange="App.gallery.upload(this)" hidden>
                        </label>
                    ` : `<p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:14px;">
                        <i class="fas fa-info-circle"></i> Solo administradores pueden añadir fotos.
                    </p>`}
                    ${grid}
                </section>
            `;
        },

        bizPage: 1,
        BIZ_PER_PAGE: 10,

        renderBusinessDirectory() {
            const grid = document.getElementById('business-directory');
            if (!grid) return;

            const q = (document.getElementById('biz-search')?.value || '').toLowerCase().trim();
            const cat = document.getElementById('biz-category')?.value || 'all';

            const filtered = App.db.businesses.filter(b => {
                const matchesQ = !q ||
                    b.name.toLowerCase().includes(q) ||
                    b.address.toLowerCase().includes(q);
                const matchesCat = cat === 'all' || b.category === cat;
                return matchesQ && matchesCat;
            });

            if (filtered.length === 0) {
                grid.innerHTML = '<div class="business-empty">Sin resultados para tu búsqueda.</div>';
                return;
            }

            const perPage = this.BIZ_PER_PAGE;
            const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
            // Resetear página si quedó fuera de rango (ej. tras filtrar)
            if (this.bizPage > totalPages) this.bizPage = 1;
            const page = this.bizPage;
            const start = (page - 1) * perPage;
            const slice = filtered.slice(start, start + perPage);

            const isAdmin = App.db.session?.role === 'admin';
            // State para modo selección múltiple
            this.state.bizSelected = this.state.bizSelected || new Set();
            const selectMode = !!this.state.bizSelectMode;
            const selectedCount = this.state.bizSelected.size;

            const cards = slice.map(b => {
                const hasCoords = !!this._bizCoords(b);
                const cfg = CATEGORY_MARKERS[b.category] || DEFAULT_MARKER;
                const idAttr = `'${b.id}'`;
                const isSelected = this.state.bizSelected.has(String(b.id));

                const adminMarkBtn = isAdmin && !selectMode
                    ? `<button class="biz-mark-btn" onclick="App.ui.enterMapPickMode(${idAttr})" title="${hasCoords ? 'Reubicar en el mapa' : 'Marcar en el mapa'}">
                          <i class="fas ${hasCoords ? 'fa-pen-to-square' : 'fa-map-pin'}"></i> ${hasCoords ? 'Reubicar' : 'Marcar en mapa'}
                       </button>` : '';

                const adminTopBtns = (isAdmin && !selectMode) ? `
                    <div class="biz-admin-top">
                        <button class="biz-admin-btn" onclick="App.ui.openBusinessEditor(${idAttr})" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="biz-admin-btn danger" onclick="App.ui.deleteBusinessAdmin(${idAttr})" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </div>` : '';

                // Checkbox para modo selección
                const selectBox = (isAdmin && selectMode) ? `
                    <div class="biz-select-overlay ${isSelected ? 'selected' : ''}" onclick="App.ui.toggleBizSelected(${idAttr})">
                        <span class="biz-select-check"><i class="fas fa-check"></i></span>
                    </div>` : '';

                const pinBadge = hasCoords
                    ? `<span class="biz-pin-badge" style="background:${cfg.color}" title="Ubicación registrada"><i class="fas fa-check"></i></span>` : '';
                const tplFlag = (b._template && !b._supabase)
                    ? `<span class="biz-tpl-flag" title="Dato de prueba local — todavía no está en la base de datos central"><i class="fas fa-flask"></i> prueba</span>` : '';
                return `
                <article class="business-card ${selectMode ? 'select-mode' : ''} ${isSelected ? 'is-selected' : ''}">
                    ${selectBox}
                    ${pinBadge}
                    ${adminTopBtns}
                    <span class="biz-cat" style="background:${cfg.color}1a;color:${cfg.color};border-color:${cfg.color}40">
                        <i class="fas ${cfg.icon}"></i> ${escapeHtml(b.category)}
                    </span>
                    <h4>${escapeHtml(b.name)} ${tplFlag}</h4>
                    <p><i class="fas fa-map-marker-alt"></i>${escapeHtml(b.address)}</p>
                    <p><i class="fas fa-phone"></i>${escapeHtml(b.phone)}</p>
                    ${adminMarkBtn}
                </article>`;
            }).join('');

            const adminBar = isAdmin ? (() => {
                const tplCount = App.db.businesses.filter(b => b._template && !b._supabase).length;
                if (selectMode) {
                    const visibleIds = filtered.map(b => String(b.id));
                    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => this.state.bizSelected.has(id));
                    return `
                    <div class="biz-admin-bar select-mode">
                        <span class="biz-select-status">
                            <i class="fas fa-list-check"></i>
                            <b>${selectedCount}</b> seleccionado${selectedCount === 1 ? '' : 's'} de ${filtered.length}
                        </span>
                        <button class="btn-ghost" onclick="App.ui.toggleAllVisibleBiz()">
                            <i class="fas fa-${allVisibleSelected ? 'square-minus' : 'square-check'}"></i>
                            ${allVisibleSelected ? 'Quitar selección' : 'Seleccionar todos'}
                        </button>
                        <button class="btn-ghost danger" onclick="App.ui.deleteBizSelected()" ${selectedCount === 0 ? 'disabled' : ''}>
                            <i class="fas fa-trash"></i> Eliminar${selectedCount > 0 ? ` (${selectedCount})` : ''}
                        </button>
                        <button class="btn-ghost" onclick="App.ui.exitBizSelectMode()" style="margin-left:auto;">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>`;
                }
                return `
                <div class="biz-admin-bar">
                    <button class="btn-primary" onclick="App.ui.openBusinessEditor(null)">
                        <i class="fas fa-plus"></i> Crear negocio
                    </button>
                    <button class="btn-ghost" onclick="App.ui.enterBizSelectMode()" title="Activar modo selección múltiple para borrar varios a la vez">
                        <i class="fas fa-check-double"></i> Selección múltiple
                    </button>
                    ${tplCount > 0 ? `
                        <button class="btn-ghost danger" onclick="App.ui.clearLocalTemplates()" title="Borra los ${tplCount} datos de prueba que solo existen en localStorage">
                            <i class="fas fa-broom"></i> Limpiar ${tplCount} datos de prueba
                        </button>` : ''}
                    <span class="biz-admin-hint">
                        <i class="fas fa-shield-halved"></i> Modo admin
                    </span>
                </div>`;
            })() : '';

            // Paginación: prev, números (ventana de ±2), next
            const pagBtn = (n, label, disabled, current = false) => `
                <button class="pag-btn${current ? ' current' : ''}" ${disabled ? 'disabled' : ''}
                        onclick="App.ui.gotoBizPage(${n})">${label}</button>`;

            const pages = [];
            const win = 2;
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= page - win && i <= page + win)) {
                    pages.push(pagBtn(i, i, false, i === page));
                } else if (pages[pages.length - 1] !== '<span class="pag-ellipsis">…</span>') {
                    pages.push('<span class="pag-ellipsis">…</span>');
                }
            }

            const pagination = totalPages > 1 ? `
                <nav class="pagination">
                    ${pagBtn(page - 1, '‹', page === 1)}
                    ${pages.join('')}
                    ${pagBtn(page + 1, '›', page === totalPages)}
                    <span class="pag-info">
                        ${start + 1}-${Math.min(start + perPage, filtered.length)} de ${filtered.length}
                    </span>
                </nav>
            ` : `<p class="pag-info" style="text-align:right;">${filtered.length} resultado(s)</p>`;

            grid.innerHTML = adminBar + cards + pagination;
        },

        gotoBizPage(n) {
            this.bizPage = Math.max(1, n);
            this.renderBusinessDirectory();
            document.getElementById('business-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },

        renderNotifications() {
            if (!App.db.session) return;

            const notis = App.notifications.getForUser(App.db.session.id).slice(0, 30);
            const container = document.getElementById('notifications-list');
            if (!container) return;

            if (notis.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-bell-slash"></i><p>Sin notificaciones</p></div>';
                return;
            }

            // Mapeo tipo → icono + color del overlay
            const typeIcon = {
                'like':       { icon: 'fa-heart',        bg: '#ef4444' },
                'comment':    { icon: 'fa-comment',      bg: '#3b82f6' },
                'reply':      { icon: 'fa-reply',        bg: '#3b82f6' },
                'follow':     { icon: 'fa-user-plus',    bg: '#22c55e' },
                'reaction':   { icon: 'fa-face-smile',   bg: '#f59e0b' },
                'new_thread': { icon: 'fa-feather',      bg: 'var(--accent)' },
                'mention':    { icon: 'fa-at',           bg: '#8b5cf6' }
            };

            const myFollowing = App.db.following[App.db.session.id] || [];

            container.innerHTML = notis.map(n => {
                const actor = App.db.users.find(u => u.name === n.sourceUserName);
                const pfp = actor?.pfp || DEFAULT_PFP;
                const ti = typeIcon[n.type] || { icon: 'fa-bell', bg: 'var(--accent)' };
                const onProfile = actor ? `onclick="App.ui.toggleNotifications(false); App.ui.openUserProfile('${actor.id}')"` : '';

                // Botón de acción según tipo
                let actionHTML = '';
                if (n.type === 'follow' && actor) {
                    const iAmFollowing = myFollowing.includes(actor.id);
                    actionHTML = `<button class="noti-action-btn ${iAmFollowing ? 'following' : ''}"
                        onclick="event.stopPropagation(); App.social.toggleFollow('${escapeJsAttr(actor.name)}'); App.ui.renderNotifications();">
                        ${iAmFollowing ? 'Siguiendo' : 'Seguir'}
                    </button>`;
                } else if (n.threadId && (n.type === 'like' || n.type === 'comment' || n.type === 'reply' || n.type === 'reaction' || n.type === 'new_thread')) {
                    actionHTML = `<button class="noti-action-btn following"
                        onclick="event.stopPropagation(); App.ui.toggleNotifications(false); App.ui.jumpToThread('${n.threadId}');">
                        Ver
                    </button>`;
                }

                return `
                <div class="notification ig-style ${n.read ? '' : 'unread'}" ${onProfile}>
                    <div class="noti-avatar-wrap">
                        <img class="noti-avatar" src="${escapeHtml(pfp)}" alt="">
                        <span class="noti-icon-overlay" style="background:${ti.bg}"><i class="fas ${ti.icon}"></i></span>
                    </div>
                    <div class="noti-body">
                        <p><b>${escapeHtml(n.sourceUserName)}</b> ${this.getNotiText(n.type)}</p>
                        <small>${this.timeAgo(n.timestamp)}</small>
                    </div>
                    ${actionHTML}
                </div>`;
            }).join('');
        },

        // Ruta SPA: Mi Red — 4 tabs (Amigos / Solicitudes / Siguiendo / Seguidores)
        renderNetworkRoute(activeTab = 'amigos') {
            this.state.networkTab = activeTab;
            const feed = document.getElementById('feed-container');
            if (!feed) return;
            if (!App.db.session) {
                feed.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-user-group"></i>
                        <p>Inicia sesión para ver tu red</p>
                        <button class="btn-submit" style="max-width:200px;margin-top:15px;" onclick="App.ui.openAuth()">Acceder</button>
                    </div>`;
                return;
            }

            const userId = App.db.session.id;
            const following = App.social.getFollowing(userId);
            const followers = App.social.getFollowers(userId);
            const friendIds = App.friends?.getFriendIds?.() || [];
            const friendsList = friendIds.map(id => App.db.users.find(u => String(u.id) === String(id))).filter(Boolean);
            const incoming = App.friends?.state?.incomingPending || [];
            const outgoing = App.friends?.state?.outgoingPending || [];

            const tabsHTML = `
                <div class="network-tabs">
                    <button class="network-tab${activeTab === 'amigos' ? ' active' : ''}" onclick="App.ui.renderNetworkRoute('amigos')">
                        <i class="fas fa-user-group"></i> Amigos <span class="net-count">${friendsList.length}</span>
                    </button>
                    <button class="network-tab${activeTab === 'solicitudes' ? ' active' : ''}" onclick="App.ui.renderNetworkRoute('solicitudes')">
                        <i class="fas fa-user-clock"></i> Solicitudes
                        ${incoming.length > 0 ? `<span class="net-count net-count-alert">${incoming.length}</span>` : ''}
                    </button>
                    <button class="network-tab${activeTab === 'following' ? ' active' : ''}" onclick="App.ui.renderNetworkRoute('following')">
                        <i class="fas fa-user-check"></i> Siguiendo <span class="net-count">${following.length}</span>
                    </button>
                    <button class="network-tab${activeTab === 'followers' ? ' active' : ''}" onclick="App.ui.renderNetworkRoute('followers')">
                        <i class="fas fa-users"></i> Seguidores <span class="net-count">${followers.length}</span>
                    </button>
                </div>`;

            let body = '';

            if (activeTab === 'solicitudes') {
                // Bloque entrantes
                const incomingHTML = incoming.length === 0
                    ? '<div class="empty-state-mini"><i class="fas fa-inbox"></i> No tienes solicitudes pendientes</div>'
                    : incoming.map(req => {
                        const sender = App.db.users.find(u => u.id === req.from_user_id);
                        if (!sender) return '';
                        const safeName = escapeHtml(sender.name);
                        return `
                            <div class="friend-req-card">
                                <img src="${escapeHtml(sender.pfp || DEFAULT_PFP)}" class="fr-pfp" alt="">
                                <div class="fr-info">
                                    <b onclick="App.ui.openUserProfile('${escapeJsAttr(String(sender.id))}')" style="cursor:pointer;">${safeName} ${this.renderBadges(sender)}</b>
                                    <small>Quiere ser tu amigo · ${this.timeAgo(req.created_at)}</small>
                                </div>
                                <div class="fr-actions">
                                    <button class="btn-small btn-success" onclick="App.friends.accept('${req.id}')"><i class="fas fa-check"></i> Aceptar</button>
                                    <button class="btn-small btn-ghost" onclick="App.friends.reject('${req.id}')"><i class="fas fa-times"></i> Rechazar</button>
                                </div>
                            </div>`;
                    }).join('');

                const outgoingHTML = outgoing.length === 0
                    ? ''
                    : `<h4 style="margin:24px 0 10px;color:var(--text-dim);"><i class="fas fa-paper-plane"></i> Enviadas (esperando respuesta)</h4>` +
                      outgoing.map(req => {
                          const target = App.db.users.find(u => u.id === req.to_user_id);
                          if (!target) return '';
                          const safeName = escapeHtml(target.name);
                          return `
                            <div class="friend-req-card friend-req-out">
                                <img src="${escapeHtml(target.pfp || DEFAULT_PFP)}" class="fr-pfp" alt="">
                                <div class="fr-info">
                                    <b onclick="App.ui.openUserProfile('${escapeJsAttr(String(target.id))}')" style="cursor:pointer;">${safeName} ${this.renderBadges(target)}</b>
                                    <small>Pendiente · enviada ${this.timeAgo(req.created_at)}</small>
                                </div>
                                <div class="fr-actions">
                                    <button class="btn-small btn-ghost" onclick="App.friends.reject('${req.id}')"><i class="fas fa-trash"></i> Cancelar</button>
                                </div>
                            </div>`;
                      }).join('');

                body = `
                    <h4 style="margin:0 0 10px;color:var(--accent);"><i class="fas fa-inbox"></i> Recibidas</h4>
                    ${incomingHTML}
                    ${outgoingHTML}
                `;
            } else if (activeTab === 'amigos') {
                body = friendsList.length === 0
                    ? '<div class="empty-state"><i class="fas fa-user-group"></i><p>Aún no tienes amigos. Envía solicitudes desde la sidebar o desde el perfil de otros usuarios.</p></div>'
                    : `<div class="network-grid">${friendsList.map(u => this.renderNetworkCard(u, 'amigo')).join('')}</div>`;
            } else {
                const list = activeTab === 'followers' ? followers : following;
                body = list.length === 0
                    ? `<div class="empty-state"><i class="fas fa-user-slash"></i><p>${activeTab === 'followers' ? 'Aún no tienes seguidores' : 'Aún no sigues a nadie'}</p></div>`
                    : `<div class="network-grid">${list.map(u => this.renderNetworkCard(u)).join('')}</div>`;
            }

            feed.innerHTML = `
                <div class="network-route">
                    <h2 style="color:var(--accent);margin:0 0 14px;"><i class="fas fa-user-group"></i> Mi Red</h2>
                    ${tabsHTML}
                    ${body}
                </div>
            `;
        },

        renderNetworkCard(user, variant = 'default') {
            const sessionId = App.db.session?.id;
            const isSelf = sessionId && String(sessionId) === String(user.id);
            const safeName = escapeHtml(user.name);
            const safeNameJs = escapeJsAttr(user.name || '');
            const safeId = escapeJsAttr(String(user.id));
            const isFollowing = (App.db.following[sessionId] || []).includes(user.id);
            const isFriend = App.friends?.isFriend?.(user.id) || false;
            const hasOutgoing = App.friends?.hasOutgoingTo?.(user.id) || false;
            const hasIncoming = App.friends?.hasIncomingFrom?.(user.id) || false;
            const notifyOn = !!(App.db.notifyOn && App.db.notifyOn[sessionId] && App.db.notifyOn[sessionId].includes(user.id));
            const dotHTML = this.statusDotHTML?.(user) || '';

            // Botón "Ver perfil" — siempre presente como acceso directo (mejora descubrimiento
            // aunque la pfp y el nombre también abran el perfil al click).
            const viewBtn = `<button class="btn-small btn-ghost" onclick="App.ui.openUserProfile('${safeId}')" title="Ver perfil completo">
                <i class="fas fa-user"></i> Ver perfil
            </button>`;

            // Botones según contexto: self / amigo / default
            let actions = '';
            if (isSelf) {
                // Eres tú mismo: solo "Ver mi perfil" (no auto-seguir/amistar/silenciar)
                actions = `<button class="btn-small" onclick="App.ui.openUserProfile('${safeId}')">
                    <i class="fas fa-user"></i> Ver mi perfil
                </button>`;
            } else if (variant === 'amigo') {
                // Tab Amigos: Ver perfil + Mensaje + Quitar
                actions = `
                    ${viewBtn}
                    <button class="btn-small" onclick="App.chat.openWith('${safeId}', ${JSON.stringify(user.name).replace(/"/g, '&quot;')}, ${JSON.stringify(user.pfp || DEFAULT_PFP).replace(/"/g, '&quot;')})">
                        <i class="fas fa-envelope"></i> Mensaje
                    </button>
                    <button class="btn-small btn-ghost" onclick="if(confirm('¿Eliminar a ${safeName} de tus amigos?')) App.friends.removeFriend('${safeId}');" title="Eliminar amistad">
                        <i class="fas fa-user-xmark"></i>
                    </button>`;
            } else {
                // Default: misma lógica que renderUserPill (amistad + seguir + notif)
                let friendBtn = '';
                if (isFriend) {
                    friendBtn = `<button class="btn-small btn-success" onclick="App.chat.openWith('${safeId}', ${JSON.stringify(user.name).replace(/"/g, '&quot;')}, ${JSON.stringify(user.pfp || DEFAULT_PFP).replace(/"/g, '&quot;')})" title="Amigo · enviar mensaje">
                                    <i class="fas fa-envelope"></i>
                                 </button>`;
                } else if (hasIncoming) {
                    friendBtn = `<button class="btn-small" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;" onclick="App.ui.navigate('red'); App.ui.state.networkTab='solicitudes'; App.ui.renderNetworkRoute('solicitudes');" title="Te envió una solicitud">
                                    <i class="fas fa-user-clock"></i> Responder
                                 </button>`;
                } else if (hasOutgoing) {
                    friendBtn = `<button class="btn-small btn-ghost" disabled title="Solicitud pendiente">
                                    <i class="fas fa-hourglass-half"></i> Pendiente
                                 </button>`;
                } else {
                    friendBtn = `<button class="btn-small btn-ghost" onclick="App.friends.sendRequest('${safeNameJs}')" title="Enviar solicitud de amistad">
                                    <i class="fas fa-user-plus"></i>
                                 </button>`;
                }

                const followBtn = `<button class="btn-small${isFollowing ? ' btn-ghost' : ''}" onclick="App.social.toggleFollow('${safeNameJs}'); setTimeout(() => { if (App.ui.state.currentRoute==='red') App.ui.renderNetworkRoute(App.ui.state.networkTab||'amigos'); else if (App.ui.state.currentRoute==='buscar') App.ui.renderSearchRoute(); }, 80);">
                    ${isFollowing ? '✓ Siguiendo' : 'Seguir'}
                </button>`;

                const notifyBtn = isFollowing
                    ? `<button class="btn-small ${notifyOn ? '' : 'btn-ghost'}" style="${notifyOn ? 'background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;' : ''}" onclick="App.ui.toggleNotifyUser('${safeId}'); setTimeout(() => { if (App.ui.state.currentRoute==='red') App.ui.renderNetworkRoute(App.ui.state.networkTab||'amigos'); else if (App.ui.state.currentRoute==='buscar') App.ui.renderSearchRoute(); }, 80);" title="${notifyOn ? 'Notificaciones activas (click para silenciar)' : 'Activar notificaciones'}">
                            <i class="fas fa-bell${notifyOn ? '' : '-slash'}"></i>
                        </button>`
                    : '';

                actions = viewBtn + friendBtn + followBtn + notifyBtn;
            }

            return `
                <div class="network-card">
                    <div class="avatar-wrap" style="width:56px;height:56px;margin:0 auto 10px;cursor:pointer;" onclick="App.ui.openUserProfile('${safeId}')">
                        <img src="${escapeHtml(user.pfp || DEFAULT_PFP)}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);">
                        ${dotHTML}
                    </div>
                    <h4 onclick="App.ui.openUserProfile('${safeId}')" style="cursor:pointer;">${safeName} ${this.renderBadges(user)}${isSelf ? ' <span style="color:var(--text-dim);font-size:0.7rem;">(tú)</span>' : ''}</h4>
                    <p>${escapeHtml(user.bio || 'Sin biografía')}</p>
                    <div class="network-card-stats">
                        <span><b>${user.followers || 0}</b> seguidores</span>
                    </div>
                    <div class="network-card-actions">
                        ${actions}
                    </div>
                </div>
            `;
        },

        // Ruta SPA: notificaciones a pantalla completa en el área central
        renderNotificationsRoute() {
            const feed = document.getElementById('feed-container');
            if (!feed) return;

            if (!App.db.session) {
                feed.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-bell"></i>
                        <p>Inicia sesión para ver tus notificaciones</p>
                        <button class="btn-submit" style="max-width:200px;margin-top:15px;" onclick="App.ui.openAuth()">Acceder</button>
                    </div>`;
                return;
            }

            const notis = App.notifications.getForUser(App.db.session.id);
            const hasUnread = notis.some(n => !n.read);

            feed.innerHTML = `
                <div class="notifications-route">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
                        <h2 style="color:var(--accent);margin:0;"><i class="fas fa-bell"></i> Notificaciones</h2>
                        ${hasUnread ? '<button class="btn-small" onclick="App.notifications.markAllRead()">Marcar todas como leídas</button>' : ''}
                    </div>
                    ${notis.length === 0
                        ? '<div class="empty-state"><i class="fas fa-bell-slash"></i><p>No tienes notificaciones todavía</p></div>'
                        : notis.map(n => `
                            <div class="notification ${n.read ? '' : 'unread'}">
                                <p><b>${escapeHtml(n.sourceUserName)}</b> ${this.getNotiText(n.type)}</p>
                                <small>${this.timeAgo(n.timestamp)}</small>
                            </div>
                        `).join('')}
                </div>
            `;
        },

        getNotiText(type) {
            const texts = {
                'like': 'le gustó tu publicación',
                'comment': 'comentó tu hilo',
                'follow': 'te está siguiendo',
                'new_thread': 'publicó un nuevo hilo',
                'friend_request': 'te envió una solicitud de amistad 🤝',
                'system': 'tiene un anuncio para ti'
            };
            return texts[type] || '';
        },

        timeAgo(timestamp) {
            const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
            if (seconds < 60) return 'hace poco';
            if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`;
            if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`;
            return `hace ${Math.floor(seconds / 86400)}d`;
        },

        openAuth() {
            document.getElementById('auth-modal').classList.remove('hidden');
            this.switchAuth('login');
        },

        closeAuth() {
            document.getElementById('auth-modal').classList.add('hidden');
        },

        switchAuth(view) {
            ['view-login', 'view-register', 'view-forgot', 'view-reset', 'view-questions'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('hidden', `view-${view}` !== id);
            });
        },

        setupSearch() {
            const input = document.getElementById('global-search');
            const dropdown = document.getElementById('search-dropdown');
            const clearBtn = document.getElementById('search-clear');
            if (!input || !dropdown) return;

            let debounce;
            input.addEventListener('input', (e) => {
                const v = e.target.value;
                if (clearBtn) clearBtn.classList.toggle('hidden', !v);
                clearTimeout(debounce);
                debounce = setTimeout(() => this.renderSearchDropdown(v), 120);
            });

            input.addEventListener('focus', () => {
                if (input.value) this.renderSearchDropdown(input.value);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const q = input.value.trim();
                    if (!q) return;
                    App.ui.state.searchQuery = q;
                    dropdown.classList.add('hidden');
                    App.ui.navigate('buscar');
                } else if (e.key === 'Escape') {
                    dropdown.classList.add('hidden');
                    input.blur();
                }
            });

            // Cerrar dropdown al hacer click fuera
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-wrap')) {
                    dropdown.classList.add('hidden');
                }
            });
        },

        clearSearch() {
            const input = document.getElementById('global-search');
            const dropdown = document.getElementById('search-dropdown');
            const clearBtn = document.getElementById('search-clear');
            if (input) input.value = '';
            if (clearBtn) clearBtn.classList.add('hidden');
            if (dropdown) dropdown.classList.add('hidden');
        },

        async renderSearchDropdown(query) {
            const dropdown = document.getElementById('search-dropdown');
            if (!dropdown) return;
            const q = (query || '').trim();
            if (q.length < 2) { dropdown.classList.add('hidden'); return; }

            // Mostrar "buscando..." mientras esperamos a Supabase si el cache local está vacío
            if (App.db.users.length === 0 && App.db.threads.length === 0) {
                dropdown.innerHTML = `<div class="search-empty"><i class="fas fa-spinner fa-spin"></i> Buscando…</div>`;
                dropdown.classList.remove('hidden');
            }

            // executeLive: usa cache si tiene datos, si no consulta Supabase en vivo
            const r = await App.search.executeLive(q);
            const total = r.threads.length + r.users.length + r.businesses.length;
            if (total === 0) {
                dropdown.innerHTML = `<div class="search-empty"><i class="fas fa-magnifying-glass"></i> Sin resultados para <b>"${escapeHtml(q)}"</b></div>`;
                dropdown.classList.remove('hidden');
                return;
            }

            const section = (icon, title, items, render) => items.length === 0 ? '' : `
                <div class="sd-section">
                    <h5><i class="${icon}"></i> ${title} <small>(${items.length})</small></h5>
                    ${items.slice(0, 4).map(render).join('')}
                </div>
            `;

            dropdown.innerHTML = `
                ${section('fas fa-comments', 'Hilos', r.threads, t => `
                    <div class="sd-item" onclick="App.ui.openThreadFromSearch('${t.id}')">
                        <img src="${escapeHtml(t.pfp || DEFAULT_PFP)}" alt="">
                        <div class="sd-item-info">
                            <div class="sd-item-title">${escapeHtml(t.author || 'Anónimo')}</div>
                            <div class="sd-item-sub">${App.search.highlight(App.search.snippet(t.content, q, 100), q)}</div>
                        </div>
                    </div>`)}
                ${section('fas fa-user-group', 'Usuarios', r.users, u => `
                    <div class="sd-item" onclick="App.ui.openUserFromSearch('${u.id}')">
                        <img src="${escapeHtml(u.pfp || DEFAULT_PFP)}" alt="">
                        <div class="sd-item-info">
                            <div class="sd-item-title">${App.search.highlight(u.name, q)} ${App.ui.renderBadges(u)}</div>
                            <div class="sd-item-sub">${escapeHtml(u.bio || 'Sin biografía')}</div>
                        </div>
                    </div>`)}
                ${section('fas fa-store', 'Negocios', r.businesses, b => `
                    <div class="sd-item" onclick="App.ui.navigate('explora')">
                        <div class="sd-item-icon"><i class="fas fa-store"></i></div>
                        <div class="sd-item-info">
                            <div class="sd-item-title">${App.search.highlight(b.name, q)}</div>
                            <div class="sd-item-sub">${escapeHtml(b.category)} · ${escapeHtml(b.address)}</div>
                        </div>
                    </div>`)}
                <button class="sd-see-all" onclick="App.ui.state.searchQuery='${escapeJsAttr(q)}'; document.getElementById('search-dropdown').classList.add('hidden'); App.ui.navigate('buscar');">
                    Ver todos los resultados (${total}) →
                </button>
            `;
            dropdown.classList.remove('hidden');
        },

        openThreadFromSearch(threadId) {
            document.getElementById('search-dropdown')?.classList.add('hidden');
            this.navigate('inicio');
            setTimeout(() => {
                const card = document.querySelector(`[data-thread-id="${threadId}"]`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.style.outline = '2px solid var(--accent)';
                    setTimeout(() => card.style.outline = '', 2000);
                }
            }, 200);
        },

        openUserFromSearch(userId) {
            document.getElementById('search-dropdown')?.classList.add('hidden');
            this.openUserProfile(userId);
        },

        async renderSearchRoute(query) {
            const feed = document.getElementById('feed-container');
            if (!feed) return;
            const q = (query || App.ui.state.searchQuery || '').trim();
            if (!q) {
                feed.innerHTML = `<div class="empty-state"><i class="fas fa-magnifying-glass"></i><p>Escribe en la barra de búsqueda para empezar</p></div>`;
                return;
            }

            // Mostrar loading mientras llega Supabase si el cache está vacío
            if (App.db.users.length === 0 && App.db.threads.length === 0) {
                feed.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Buscando…</p></div>`;
            }

            const r = await App.search.executeLive(q);
            const total = r.threads.length + r.users.length + r.businesses.length + r.outlets.length;

            const sec = (title, items, body) => items.length === 0 ? '' : `
                <section class="search-section-full">
                    <h3>${title} <span class="net-count">${items.length}</span></h3>
                    ${body}
                </section>`;

            feed.innerHTML = `
                <div class="search-route">
                    <h2 style="margin:0 0 6px;">Resultados para <span style="color:var(--accent);">"${escapeHtml(q)}"</span></h2>
                    <p style="color:var(--text-dim);margin:0 0 22px;">${total} coincidencias en total</p>

                    ${total === 0
                        ? `<div class="empty-state"><i class="fas fa-circle-exclamation"></i><p>No se encontró nada</p></div>`
                        : ''}

                    ${sec(`<i class="fas fa-comments"></i> Hilos`, r.threads,
                        r.threads.map(t => App.forum.renderThreadCard(t)).join('')
                    )}

                    ${sec(`<i class="fas fa-user-group"></i> Usuarios`, r.users, `
                        <div class="network-grid">${r.users.map(u => App.ui.renderNetworkCard(u)).join('')}</div>
                    `)}

                    ${sec(`<i class="fas fa-store"></i> Negocios`, r.businesses, `
                        <div class="business-grid">${r.businesses.map(b => `
                            <article class="business-card">
                                <span class="biz-cat">${escapeHtml(b.category)}</span>
                                <h4>${App.search.highlight(b.name, q)}</h4>
                                <p><i class="fas fa-map-marker-alt"></i>${escapeHtml(b.address)}</p>
                                <p><i class="fas fa-phone"></i>${escapeHtml(b.phone)}</p>
                            </article>`).join('')}</div>
                    `)}

                    ${sec(`<i class="fas fa-satellite-dish"></i> Medios`, r.outlets, `
                        <div class="biblio-list">${r.outlets.map(o => `
                            <div class="outlet-row">
                                <div class="outlet-row-info">
                                    <b>${App.search.highlight(o.name, q)}</b>
                                    <a href="${escapeHtml(o.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(o.url)}</a>
                                </div>
                            </div>`).join('')}</div>
                    `)}
                </div>
            `;
        },

        openSettings() {
            const modal = document.getElementById('settings-modal');
            if (!modal) return;
            modal.classList.remove('hidden');
            const isAdmin = App.db.session?.role === 'admin';
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = isAdmin ? '' : 'none';
            });

            // Pre-cargar campos del perfil + preview banner/pfp
            const s = App.db.session;
            if (s) {
                document.getElementById('settings-name').value = s.name || '';
                document.getElementById('settings-bio').value  = s.bio  || '';
                const ppPfp = document.querySelector('#profile-preview .pp-pfp');
                const ppBan = document.querySelector('#profile-preview .pp-banner');
                if (ppPfp) ppPfp.src = s.pfp || DEFAULT_PFP;
                if (ppBan) ppBan.style.backgroundImage = s.banner ? `url("${s.banner}")` : '';
            }
            App.tempProfilePic = null;
            App.tempBanner = null;

            this.switchSettingsTab('profile');
            // Pre-cargar estado actual de presence en los toggles
            setTimeout(() => this.refreshStatusUI?.(), 50);
        },

        closeSettings() {
            const modal = document.getElementById('settings-modal');
            if (modal) modal.classList.add('hidden');
        },

        showReactionPicker(buttonEl, threadId) {
            document.querySelector('.reaction-picker')?.remove();
            const picker = document.createElement('div');
            picker.className = 'reaction-picker';
            picker.innerHTML = App.social.REACTION_EMOJIS.map(e => `
                <button onclick="App.social.react('${threadId}', '${escapeJsAttr(e)}'); document.querySelector('.reaction-picker')?.remove();">${escapeHtml(e)}</button>
            `).join('');
            document.body.appendChild(picker);
            const r = buttonEl.getBoundingClientRect();
            picker.style.cssText = `
                position: fixed;
                top: ${Math.max(10, r.top - 56)}px;
                left: ${Math.min(r.left, window.innerWidth - 320)}px;
                z-index: 3000;
            `;
            setTimeout(() => {
                document.addEventListener('click', function close(e) {
                    if (!picker.contains(e.target) && e.target !== buttonEl) {
                        picker.remove();
                        document.removeEventListener('click', close);
                    }
                });
            }, 100);
        },

        toggleNotifications(force) {
            const panel = document.getElementById('notifications-panel');
            const backdrop = document.getElementById('notifications-backdrop');
            if (!panel) return;
            const willShow = typeof force === 'boolean' ? force : !panel.classList.contains('visible');
            panel.classList.toggle('visible', willShow);
            if (backdrop) backdrop.classList.toggle('visible', willShow);
            document.body.classList.toggle('notifications-open', willShow);
            // En mobile, cerrar otros overlays para evitar solape
            if (willShow && window.innerWidth < 1024) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar && !sidebar.classList.contains('sidebar-hidden')) {
                    sidebar.classList.add('sidebar-hidden');
                    document.body.classList.remove('sidebar-open');
                }
                if (App.chat?.state?.open) App.chat.closePanel();
            }
            if (willShow) this.renderNotifications();
        },

        renderActivityTab() {
            if (!App.db.session) return;
            const userId = App.db.session.id;

            const myThreads  = App.settings.getUserThreads();
            const myLikes    = App.settings.getUserLikes();
            const mySaved    = App.settings.getSavedThreads();
            const myReacts   = App.social.getUserReactions(userId);
            const myComments = App.social.getUserComments(userId);

            const renderItem = (t, extra = '', deletable = false) => {
                const text = (t.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
                const snippet = text.slice(0, 90);
                const targetId = t.threadId || t.id;
                const del = deletable
                    ? `<button class="ai-del" onclick="App.forum.deleteThread('${targetId}')" title="Eliminar"><i class="fas fa-trash"></i></button>`
                    : '';
                return `
                    <div class="activity-item">
                        <span class="ai-text" onclick="App.ui.jumpToThread('${targetId}')">${escapeHtml(snippet)}${text.length > 90 ? '…' : ''} ${extra}</span>
                        <small>${App.ui.timeAgo(t.timestamp)}</small>
                        ${del}
                    </div>`;
            };

            const empty = '<p style="color:var(--text-muted);font-size:0.8rem;padding:6px;">— sin actividad —</p>';

            const fill = (id, items, mapper) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.innerHTML = items.length === 0 ? empty : items.slice(0, 30).map(mapper).join('');
            };

            // Solo "mis publicaciones" lleva botón borrar (los propios hilos)
            fill('my-threads', myThreads, t => renderItem(t, '', true));
            fill('my-likes',   myLikes,   t => renderItem(t));
            fill('my-saved',   mySaved,   t => renderItem(t));
            fill('my-reacts',  myReacts,  t => {
                const myEmoji = Object.entries(t.reactions || {})
                    .find(([, ids]) => ids.includes(userId))?.[0] || '';
                return renderItem(t, `<span class="ai-tag">${myEmoji}</span>`);
            });
            fill('my-comments', myComments, c => renderItem(c, '<span class="ai-tag">💬</span>'));
        },

        // Salta a un hilo desde el historial (cierra settings, navega y resalta)
        jumpToThread(threadId) {
            this.closeSettings();
            this.navigate('inicio');
            setTimeout(() => {
                const card = document.querySelector(`[data-thread-id="${threadId}"]`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.style.outline = '2px solid var(--accent)';
                    setTimeout(() => card.style.outline = '', 2000);
                }
            }, 200);
        },

        renderSettingsNetwork(which = 'followers') {
            if (!App.db.session) return;
            document.querySelectorAll('.snw-tab').forEach((t, i) => {
                t.classList.toggle('active', (i === 0 && which === 'followers') || (i === 1 && which === 'following'));
            });
            const list = which === 'followers'
                ? App.social.getFollowers(App.db.session.id)
                : App.social.getFollowing(App.db.session.id);
            const container = document.getElementById('settings-network-list');
            if (!container) return;
            container.innerHTML = list.length === 0
                ? `<div class="empty-state" style="padding:30px;"><i class="fas fa-user-slash"></i><p>${which === 'followers' ? 'Aún no tienes seguidores' : 'Aún no sigues a nadie'}</p></div>`
                : list.map(u => this.renderUserPill(u, which === 'following')).join('');
        },

        switchSettingsTab(tabName) {
            document.querySelectorAll('#settings-modal .tab-content').forEach(el => {
                el.classList.toggle('active', el.dataset.tab === tabName);
            });
            document.querySelectorAll('#settings-modal .tab-btn').forEach(el => {
                el.classList.toggle('active', el.dataset.target === tabName);
            });
            if (tabName === 'activity') this.renderActivityTab();
            if (tabName === 'network')  this.renderSettingsNetwork('followers');
            if (tabName === 'media')    { this.renderMediaTab(); App.admin.refreshBusinessCounts(); }
        },

        // ===== ADMIN: Tab Medios =====
        renderMediaTab() {
            const container = document.getElementById('outlets-list');
            if (!container) return;
            const outlets = App.db.outlets || [];
            container.innerHTML = outlets.length === 0
                ? '<p style="color:var(--text-muted);font-size:0.8rem;">— sin outlets —</p>'
                : outlets.map(o => `
                    <div class="outlet-row">
                        <div class="outlet-row-info">
                            <b>${escapeHtml(o.name)}</b>
                            <a href="${escapeHtml(o.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(o.url)}</a>
                        </div>
                        <button class="btn-small" style="background:var(--danger);" onclick="App.ui.removeOutlet('${escapeJsAttr(o.id)}')">Eliminar</button>
                    </div>
                `).join('');
        },

        addOutletFromForm() {
            if (!App.db.session || App.db.session.role !== 'admin') {
                this.toast('Solo admin puede añadir outlets', 'error'); return;
            }
            const name = document.getElementById('new-outlet-name').value.trim();
            const url  = document.getElementById('new-outlet-url').value.trim();
            if (!name || !url) { this.toast('Completa nombre y URL', 'warning'); return; }
            if (!/^https?:\/\//i.test(url)) { this.toast('URL debe empezar con http(s)://', 'warning'); return; }
            const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '-' + Date.now().toString(36);
            App.db.outlets.push({ id, name, url, type: 'custom', verified: true });
            App.db.save();
            document.getElementById('new-outlet-name').value = '';
            document.getElementById('new-outlet-url').value = '';
            this.renderMediaTab();
            this.toast(`Outlet "${name}" añadido`, 'success');
        },

        removeOutlet(outletId) {
            if (!confirm('¿Eliminar este outlet?')) return;
            App.db.outlets = App.db.outlets.filter(o => o.id !== outletId);
            App.db.save();
            this.renderMediaTab();
            this.toast('Outlet eliminado', 'info');
        },

        openEditor() {
            if (!App.db.session) {
                this.toast('Debes iniciar sesión para publicar', 'warning');
                this.openAuth();
                return;
            }
            App.editor.mode = 'thread';
            App.editor.replyContext = null;

            // Categoría automática según ruta + rol
            const route = this.state.currentRoute;
            const role = App.db.session.role;
            let cat = 'general';
            let hint = '<i class="fas fa-comments"></i> Tu publicación aparecerá en el <b>Foro</b>.';
            if (route === 'noticias' && ['admin', 'media'].includes(role)) {
                cat = 'noticias';
                hint = '<i class="fas fa-satellite-dish"></i> Publicarás como <b>Noticia oficial</b>. Aparecerá en la sección Noticias.';
            } else if (route === 'noticias') {
                hint = '<i class="fas fa-circle-info"></i> Tu publicación aparecerá en el <b>Foro</b> (solo medios verificados pueden publicar Noticias).';
            }
            App.editor.targetCategory = cat;

            const modal = document.getElementById('thread-creator-modal');
            const title = modal?.querySelector('h3');
            if (title) title.textContent = cat === 'noticias' ? 'Publicar Noticia Oficial' : 'Crear Publicación';
            const hintEl = document.getElementById('editor-context-hint');
            if (hintEl) hintEl.innerHTML = hint;

            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(() => document.getElementById('editor-body')?.focus(), 80);
            }
        },

        openReplyEditor(threadId, parentCommentId = null) {
            if (!App.db.session) {
                this.toast('Debes iniciar sesión para responder', 'warning');
                this.openAuth();
                return;
            }
            App.editor.mode = 'reply';
            App.editor.replyContext = { threadId, parentCommentId };
            const modal = document.getElementById('thread-creator-modal');
            const title = modal?.querySelector('h3');
            if (title) title.textContent = parentCommentId ? 'Responder al comentario' : 'Comentar el hilo';
            const hintEl = document.getElementById('editor-context-hint');
            if (hintEl) hintEl.innerHTML = '<i class="fas fa-reply"></i> Respuesta enriquecida — formato y multimedia disponibles.';
            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(() => document.getElementById('editor-body')?.focus(), 80);
            }
        },

        closeEditor() {
            const modal = document.getElementById('thread-creator-modal');
            if (modal) modal.classList.add('hidden');
            const body = document.getElementById('editor-body');
            if (body) body.innerHTML = '';
            const cb = document.getElementById('notify-followers');
            if (cb) cb.checked = false;
            App.editor.mode = 'thread';
            App.editor.replyContext = null;
            App.editor.targetCategory = 'general';
        },

        toggleCommentBox(threadId, parentCommentId = null) {
            const box = document.getElementById(`comment-box-${threadId}`);
            if (box) box.classList.toggle('hidden');
        },

        // Click en pfp/username → abre directamente el perfil completo (estilo X/Twitter).
        // Antes mostraba un popover intermedio; lo eliminamos para evitar el doble-botón.
        showUserPopover(element, userId) {
            if (!userId) return;
            return this.openUserProfile(userId);
        },

        // Versión legacy del popover, conservada por si se necesita pequeña tarjeta hover.
        // Por defecto NO se llama; se usa openUserProfile en su lugar.
        _legacyShowUserPopover(element, userId) {
            if (!userId) return;

            const user = App.db.users.find(u => u.id == userId);
            if (!user) return;

            const sessionId = App.db.session?.id;
            const isSelf = sessionId && sessionId === userId;
            const isFollowing = App.db.following[sessionId]?.includes(userId);
            const safeName = escapeHtml(user.name);
            // Prioridad: banner personalizado > color por rol
            const bannerStyle = user.banner
                ? `background-image:url("${escapeHtml(user.banner)}");background-size:cover;background-position:center;`
                : `background:${user.role === 'admin' ? 'linear-gradient(135deg,#ffd700,#ff8c00)'
                    : user.role === 'verified' ? 'linear-gradient(135deg,#00d2ff,#3a7bd5)'
                    : user.role === 'media' ? 'linear-gradient(135deg,#8b5cf6,#6366f1)'
                    : 'linear-gradient(135deg,#2a2a3a,#1a1a2e)'};`;

            const actions = isSelf
                ? '<button class="btn-small" disabled style="opacity:0.6;">Tu perfil</button>'
                : `
                    <button class="btn-small" onclick="App.social.toggleFollow('${escapeJsAttr(user.name)}')" title="Seguir publicaciones">
                        <i class="fas fa-${isFollowing ? 'user-check' : 'user-plus'}"></i> ${isFollowing ? 'Siguiendo' : 'Seguir'}
                    </button>
                    <button class="btn-small" style="background:linear-gradient(135deg,#8b5cf6,#6366f1);" onclick="App.social.sendFriendRequest('${escapeJsAttr(user.name)}')" title="Enviar solicitud de amistad">
                        <i class="fas fa-handshake"></i> Solicitud
                    </button>
                    <button class="btn-small" style="background: rgba(255,71,87,0.18); color:#ff4757;" onclick="App.social.blockUser('${escapeJsAttr(user.name)}')" title="Bloquear">
                        <i class="fas fa-ban"></i>
                    </button>
                `;

            const html = `
                <div class="user-popover glass-card">
                    <div class="popover-banner" style="${bannerStyle}"></div>
                    <img src="${escapeHtml(user.pfp || DEFAULT_PFP)}" class="popover-pfp">
                    <div class="popover-content">
                        <h3>${safeName}</h3>
                        <div class="popover-badges">${App.ui.renderBadges(user)}</div>
                        <p>${escapeHtml(user.bio || 'Sin biografía')}</p>
                        <div class="popover-stats">
                            <span>${user.following || 0} Siguiendo</span>
                            <span>${user.followers || 0} Seguidores</span>
                        </div>
                        <div class="popover-actions">${actions}</div>
                        <button class="popover-fullprofile-btn" onclick="App.ui.openUserProfile('${user.id}'); document.querySelector('.user-popover')?.remove();">
                            <i class="fas fa-id-badge"></i> Ver perfil completo
                        </button>
                    </div>
                </div>
            `;

            const existing = document.querySelector('.user-popover');
            if (existing) existing.remove();

            const popover = document.createElement('div');
            popover.innerHTML = html;
            document.body.appendChild(popover);

            const rect = element.getBoundingClientRect();
            const popoverEl = popover.querySelector('.user-popover');
            popoverEl.style.cssText = `
                position: fixed;
                top: ${rect.top + 50}px;
                left: ${Math.min(rect.left, window.innerWidth - 380)}px;
                z-index: 3000;
                width: 350px;
            `;

            setTimeout(() => {
                document.addEventListener('click', function closePopover(e) {
                    if (!e.target.closest('.user-popover')) {
                        popover.remove();
                        document.removeEventListener('click', closePopover);
                    }
                });
            }, 100);
        },

        // ============ PERFIL COMPLETO (ruta inline tipo Twitter) ============
        // Click en un username/pfp → navega a la ruta `perfil` y el contenido
        // se renderiza dentro de #feed-container (no como modal flotante).
        async openUserProfile(userId) {
            console.log('[profile] openUserProfile llamado con:', userId);
            if (!userId) {
                console.warn('[profile] userId vacío, ignorando');
                return;
            }
            this.state.profileUserId = userId;
            this.state.profileTab = 'posts';
            this.navigate('perfil');
        },

        closeUserProfile() {
            // Mantenido por compat: vuelve a inicio
            this.state.profileUserId = null;
            this.navigate('inicio');
        },

        // Render del perfil inline dentro de #feed-container.
        // Estrategia: render INMEDIATO con cache local (App.db.users + sesión), y luego
        // refresh asíncrono desde Supabase EN DOS PASOS:
        //   1) campos pequeños (username, role, bio, presence) → rápido
        //   2) banner + pfp por separado → puede ser pesado (base64 grande), no bloquea UI
        async renderProfileRoute(userId) {
            console.log('[profile] renderProfileRoute INICIO · userId:', userId);
            const feed = document.getElementById('feed-container');
            if (!feed) { console.warn('[profile] feed-container no existe'); return; }
            if (!userId) { console.warn('[profile] userId vacío, redirigiendo a inicio'); this.navigate('inicio'); return; }

            const localUser = App.db.users.find(u => String(u.id) === String(userId));
            const isSelf = App.db.session && String(App.db.session.id) === String(userId);
            console.log('[profile] localUser found:', !!localUser, '· isSelf:', isSelf);

            // Construir user inicial desde lo que tengamos en cache (rápido, sin esperar)
            let user = localUser;
            if (isSelf && App.db.session) {
                user = {
                    ...(localUser || {}),
                    id: App.db.session.id,
                    name: App.db.session.username || App.db.session.name || (localUser?.name || ''),
                    pfp: App.db.session.pfp || localUser?.pfp || DEFAULT_PFP,
                    banner: App.db.session.banner || localUser?.banner || '',
                    bio: App.db.session.bio || localUser?.bio || '',
                    role: App.db.session.role || localUser?.role || 'citizen',
                    email: App.db.session.email || localUser?.email || '',
                    badges: App.db.session.badges || localUser?.badges || [],
                    isGuest: !!(App.db.session.isGuest || localUser?.isGuest)
                };
            }

            if (!user) {
                // No tenemos cache local → mostrar spinner mientras pedimos a Supabase
                feed.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Cargando perfil…</p></div>';
            } else {
                // Render inmediato con cache local (banner/pfp incluidos si los hay)
                try {
                    console.log('[profile] render inmediato con cache · user:', user.name);
                    this._renderUserProfileInline(user, this.state.profileTab || 'posts');
                } catch (e) {
                    console.error('[profile] render inmediato EXCEPCIÓN:', e);
                }
            }

            if (!window.SB) {
                if (!user) {
                    feed.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><p>Usuario no encontrado</p><button class="btn-primary" onclick="App.ui.navigate(\'inicio\')" style="margin-top:14px;">Volver al inicio</button></div>';
                }
                return;
            }

            // PASO 1: fetch de campos pequeños (rápido, ~100ms)
            const lightCols = 'id, username, email, pfp, bio, role, is_guest, badges, created_at, online_status, custom_status, custom_status_emoji, show_online_status, last_seen';
            try {
                const lightPromise = SB.from('profiles').select(lightCols).eq('id', userId).maybeSingle();
                const lightTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('light timeout 6s')), 6000));
                const r = await Promise.race([lightPromise, lightTimeout]);
                if (r.error) console.error('[profile] light query error:', r.error);
                else if (r.data) {
                    console.log('[profile] light query OK');
                    const d = r.data;
                    user = {
                        ...(user || {}),
                        id: d.id,
                        name: d.username,
                        email: d.email || '',
                        pfp: d.pfp || (user?.pfp) || DEFAULT_PFP,
                        bio: d.bio || '',
                        role: d.role || 'citizen',
                        badges: d.badges || [],
                        isGuest: !!d.is_guest,
                        joinDate: d.created_at,
                        online_status: d.online_status,
                        custom_status: d.custom_status,
                        custom_status_emoji: d.custom_status_emoji,
                        show_online_status: d.show_online_status,
                        last_seen: d.last_seen,
                        banner: (user?.banner) || ''
                    };
                    const idx = App.db.users.findIndex(u => String(u.id) === String(userId));
                    if (idx >= 0) App.db.users[idx] = { ...App.db.users[idx], ...user };
                    else App.db.users.push(user);
                    App.db.save();
                    try { this._renderUserProfileInline(user, this.state.profileTab || 'posts'); } catch (e) { console.error('[profile] re-render con light data falló:', e); }
                }
            } catch (e) {
                console.error('[profile] light query EXCEPCIÓN:', e.message || e);
            }

            if (!user) {
                feed.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><p>Usuario no encontrado</p><button class="btn-primary" onclick="App.ui.navigate(\'inicio\')" style="margin-top:14px;">Volver al inicio</button></div>';
                return;
            }

            // PASO 2: fetch del banner por separado (puede ser pesado, no bloquea más allá de aquí)
            // Timeout largo (20s) para que llegue aunque sea 5MB de base64.
            try {
                const bannerPromise = SB.from('profiles').select('banner').eq('id', userId).maybeSingle();
                const bannerTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('banner timeout 20s')), 20000));
                const br = await Promise.race([bannerPromise, bannerTimeout]);
                if (br.error) console.error('[profile] banner query error:', br.error);
                else {
                    const sbBanner = br.data?.banner || '';
                    const fallbackBanner = isSelf ? (App.db.session?.banner || '') : (localUser?.banner || '');
                    const finalBanner = sbBanner || fallbackBanner;
                    console.log('[profile] banner query OK · sb len:', sbBanner.length, '· fallback len:', fallbackBanner.length);

                    // Si Supabase NO tenía banner pero localmente sí, lo subimos (auto-sync)
                    if (isSelf && !sbBanner && fallbackBanner) {
                        SB.from('profiles').update({ banner: fallbackBanner }).eq('id', userId)
                            .then(({ error }) => {
                                if (error) console.warn('[profile] auto-sync banner falló:', error);
                                else console.log('[profile] auto-sync banner OK');
                            });
                    }

                    if (finalBanner !== (user.banner || '')) {
                        user.banner = finalBanner;
                        const idx = App.db.users.findIndex(u => String(u.id) === String(userId));
                        if (idx >= 0) App.db.users[idx] = { ...App.db.users[idx], banner: finalBanner };
                        App.db.save();
                        try { this._renderUserProfileInline(user, this.state.profileTab || 'posts'); console.log('[profile] re-render con banner OK'); }
                        catch (e) { console.error('[profile] re-render con banner falló:', e); }
                    }
                }
            } catch (e) {
                console.warn('[profile] banner query EXCEPCIÓN (no crítico):', e.message || e);
            }
        },

        _switchProfileTab(userId, tab) {
            this.state.profileTab = tab;
            const user = App.db.users.find(u => String(u.id) === String(userId));
            if (user) this._renderUserProfileInline(user, tab);
        },

        // Construye el HTML del perfil y lo inyecta en #feed-container.
        _renderUserProfileInline(user, activeTab = 'posts') {
            const feed = document.getElementById('feed-container');
            if (!feed) return;

            const sessionId = App.db.session?.id;
            const isSelf = sessionId && String(sessionId) === String(user.id);
            const isFollowing = (App.db.following[sessionId] || []).includes(user.id);
            const notifyOn = !!(App.db.notifyOn && App.db.notifyOn[sessionId] && App.db.notifyOn[sessionId].includes(user.id));

            const userThreads = (App.db.threads || [])
                .filter(t => String(t.authorId) === String(user.id))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            const userMediaThreads = userThreads.filter(t => /<img|<video|<iframe/i.test(t.content || ''));
            const userLikedThreads = (App.db.threads || [])
                .filter(t => Array.isArray(t.likes) && t.likes.includes(user.id))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            const followers = Object.values(App.db.following || {})
                .filter(arr => Array.isArray(arr) && arr.includes(user.id)).length;
            const following = (App.db.following[user.id] || []).length;

            const joinDate = user.joinDate || user.created_at;
            const memberSince = joinDate
                ? new Date(joinDate).toLocaleDateString('es-MX', { year: 'numeric', month: 'long' })
                : 'fecha desconocida';

            // Banner con fallback en capas: la imagen del usuario va arriba, el gradiente debajo.
            // Si la imagen falla al cargar, el gradiente queda visible automáticamente.
            const bannerSafe = (user.banner || '').toString().trim();
            const bannerStyle = bannerSafe
                ? `background-image:url("${bannerSafe.replace(/"/g, '\\"').replace(/\n/g, '')}"), linear-gradient(135deg, #00d2ff 0%, #3a7bd5 45%, #8b5cf6 70%, #ec4899 100%); background-size:cover, cover; background-position:center, center; background-repeat:no-repeat, no-repeat;`
                : '';

            const safeName = escapeHtml(user.name);
            const safeBio = escapeHtml(user.bio || '');
            const handle = '@' + (user.name || '').toLowerCase().replace(/\s+/g, '_');

            const actionButtons = isSelf
                ? `<button class="xp-btn xp-btn-primary" onclick="App.ui.openSettings();" title="Editar tu perfil, banner y foto">
                       <i class="fas fa-pen"></i> Editar perfil
                   </button>`
                : `<button class="xp-btn ${isFollowing ? 'xp-btn-outline' : 'xp-btn-primary'}"
                          onclick="App.social.toggleFollow('${escapeJsAttr(user.name)}'); setTimeout(() => App.ui.renderProfileRoute('${user.id}'), 100);">
                       ${isFollowing ? 'Siguiendo' : 'Seguir'}
                   </button>
                   <button class="xp-btn xp-btn-outline" onclick="App.chat.openWith('${user.id}', ${JSON.stringify(user.name).replace(/"/g, '&quot;')}, ${JSON.stringify(user.pfp || DEFAULT_PFP).replace(/"/g, '&quot;')})">
                       <i class="fas fa-envelope"></i>
                   </button>
                   <button class="xp-btn xp-btn-outline ${notifyOn ? 'xp-active' : ''}" onclick="App.ui.toggleNotifyUser('${user.id}')" title="${notifyOn ? 'Notificaciones activas' : 'Activar notificaciones'}">
                       <i class="fas fa-bell${notifyOn ? '' : '-slash'}"></i>
                   </button>
                   <button class="xp-btn xp-btn-outline" onclick="App.social.sendFriendRequest?.('${escapeJsAttr(user.name)}')" title="Solicitud de amistad">
                       <i class="fas fa-user-plus"></i>
                   </button>
                   <button class="xp-btn xp-btn-outline ${App.social.isMuted(user.id) ? 'xp-active' : ''}"
                           onclick="App.social.toggleMuteUser('${user.id}'); setTimeout(() => App.ui.renderProfileRoute('${user.id}'), 100);"
                           title="${App.social.isMuted(user.id) ? 'Quitar silencio' : 'Silenciar (no ver sus publicaciones)'}">
                       <i class="fas fa-volume-${App.social.isMuted(user.id) ? 'high' : 'xmark'}"></i>
                   </button>
                   <button class="xp-btn xp-btn-outline xp-danger ${App.social.isBlocked(user.id) ? 'xp-active' : ''}"
                           onclick="App.social.toggleBlockUser('${user.id}'); setTimeout(() => App.ui.renderProfileRoute('${user.id}'), 100);"
                           title="${App.social.isBlocked(user.id) ? 'Desbloquear' : 'Bloquear'}">
                       <i class="fas fa-ban"></i>
                   </button>`;

            const renderThreadItem = (t) => {
                const text = (t.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
                const snippet = text.slice(0, 200);
                const hasMedia = /<img|<video|<iframe/i.test(t.content || '');
                return `<article class="xp-feed-item" onclick="App.ui.jumpToThread('${t.id}')">
                    <div class="xp-feed-head">
                        <img src="${escapeHtml(user.pfp || DEFAULT_PFP)}" class="xp-feed-pfp" alt="">
                        <div class="xp-feed-meta">
                            <b>${safeName}</b>
                            <span class="xp-handle">${escapeHtml(handle)}</span>
                            <span class="xp-feed-time">· ${App.ui.timeAgo(t.timestamp)}</span>
                        </div>
                    </div>
                    <p class="xp-feed-text">${escapeHtml(snippet)}${text.length > 200 ? '…' : ''}</p>
                    ${hasMedia ? '<div class="xp-feed-media-tag"><i class="fas fa-image"></i> Multimedia</div>' : ''}
                    <div class="xp-feed-stats">
                        <span><i class="far fa-comment"></i> ${(t.comments || []).length}</span>
                        <span><i class="far fa-heart"></i> ${(t.likes || []).length}</span>
                        ${t.category ? `<span class="xp-feed-cat">${escapeHtml(t.category)}</span>` : ''}
                    </div>
                </article>`;
            };

            let feedItems = [], emptyText = '';
            if (activeTab === 'posts')      { feedItems = userThreads;      emptyText = isSelf ? 'Aún no has publicado nada' : 'Aún no ha publicado hilos'; }
            else if (activeTab === 'media') { feedItems = userMediaThreads; emptyText = 'Sin publicaciones con multimedia'; }
            else if (activeTab === 'likes') { feedItems = userLikedThreads; emptyText = 'Sin publicaciones que le gusten'; }

            const feedHTML = feedItems.length === 0
                ? `<div class="xp-empty"><i class="fas fa-feather"></i> ${emptyText}</div>`
                : feedItems.slice(0, 50).map(renderThreadItem).join('');

            feed.innerHTML = `
                <div class="xp-route-content">
                    <header class="xp-topbar">
                        <button class="xp-back" onclick="App.ui.navigate('inicio')" aria-label="Volver"><i class="fas fa-arrow-left"></i></button>
                        <div class="xp-topbar-info">
                            <b>${safeName}</b>
                            <small>${userThreads.length} publicaciones</small>
                        </div>
                    </header>

                    <div class="xp-banner" style="${bannerStyle}"></div>

                    <div class="xp-header">
                        <div class="xp-pfp-wrap">
                            <img src="${escapeHtml(user.pfp || DEFAULT_PFP)}" class="xp-pfp" alt="${safeName}">
                            ${App.ui.statusDotHTML?.(user) || ''}
                        </div>
                        <div class="xp-actions">${actionButtons}</div>
                    </div>

                    <div class="xp-identity">
                        <h2 class="xp-name">${safeName} ${App.ui.renderBadges(user)}</h2>
                        <span class="xp-handle">${escapeHtml(handle)}</span>
                        ${App.ui.customStatusHTML?.(user) || ''}
                    </div>

                    ${safeBio ? `<p class="xp-bio">${safeBio}</p>` : ''}

                    <div class="xp-meta-row">
                        <span><i class="far fa-calendar"></i> Se unió en ${memberSince}</span>
                    </div>

                    <div class="xp-stats">
                        <span><b>${following}</b> Siguiendo</span>
                        <span><b>${followers}</b> Seguidores</span>
                        <span><b>${userThreads.length}</b> Publicaciones</span>
                    </div>

                    <nav class="xp-tabs">
                        <button class="xp-tab ${activeTab==='posts'?'active':''}" onclick="App.ui._switchProfileTab('${user.id}','posts')">Publicaciones</button>
                        <button class="xp-tab ${activeTab==='media'?'active':''}" onclick="App.ui._switchProfileTab('${user.id}','media')">Multimedia</button>
                        <button class="xp-tab ${activeTab==='likes'?'active':''}" onclick="App.ui._switchProfileTab('${user.id}','likes')">Me gusta</button>
                    </nav>

                    <div class="xp-feed">${feedHTML}</div>
                </div>`;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        // Construye y muestra el modal del perfil estilo X/Twitter.
        // Layout: banner ancho → pfp sobrepuesta + nombre/@user → botones de acción
        // → bio → stats horizontales → tabs (Posts/Multimedia/Likes) → feed.
        _renderUserProfileModal(user, activeTab = 'posts') {
            const sessionId = App.db.session?.id;
            const isSelf = sessionId && String(sessionId) === String(user.id);
            const isFollowing = (App.db.following[sessionId] || []).includes(user.id);
            const notifyOn = !!(App.db.notifyOn && App.db.notifyOn[sessionId] && App.db.notifyOn[sessionId].includes(user.id));

            const userThreads = (App.db.threads || [])
                .filter(t => String(t.authorId) === String(user.id))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            const userMediaThreads = userThreads.filter(t => /<img|<video|<iframe/i.test(t.content || ''));
            const userLikedThreads = (App.db.threads || [])
                .filter(t => Array.isArray(t.likes) && t.likes.includes(user.id))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            const followers = Object.values(App.db.following || {})
                .filter(arr => Array.isArray(arr) && arr.includes(user.id)).length;
            const following = (App.db.following[user.id] || []).length;

            const joinDate = user.joinDate || user.created_at;
            const memberSince = joinDate
                ? new Date(joinDate).toLocaleDateString('es-MX', { year: 'numeric', month: 'long' })
                : 'fecha desconocida';

            // Banner con fallback en capas: la imagen del usuario va arriba, el gradiente debajo.
            // Si la imagen falla al cargar, el gradiente queda visible automáticamente.
            const bannerSafe = (user.banner || '').toString().trim();
            const bannerStyle = bannerSafe
                ? `background-image:url("${bannerSafe.replace(/"/g, '\\"').replace(/\n/g, '')}"), linear-gradient(135deg, #00d2ff 0%, #3a7bd5 45%, #8b5cf6 70%, #ec4899 100%); background-size:cover, cover; background-position:center, center; background-repeat:no-repeat, no-repeat;`
                : '';

            const safeName = escapeHtml(user.name);
            const safeBio = escapeHtml(user.bio || '');
            const handle = '@' + (user.name || '').toLowerCase().replace(/\s+/g, '_');

            // Botones (estilo X: pill rounded, primary outline)
            const actionButtons = isSelf
                ? `<button class="xp-btn xp-btn-outline" onclick="App.ui.closeUserProfile(); App.ui.openSettings();">
                       <i class="fas fa-pen"></i> Editar perfil
                   </button>`
                : `<button class="xp-btn ${isFollowing ? 'xp-btn-outline' : 'xp-btn-primary'}"
                          onclick="App.social.toggleFollow('${escapeJsAttr(user.name)}'); setTimeout(() => App.ui.openUserProfile('${user.id}'), 100);">
                       ${isFollowing ? 'Siguiendo' : 'Seguir'}
                   </button>
                   <button class="xp-btn xp-btn-outline" onclick="App.ui.closeUserProfile(); App.chat.openWith('${user.id}', ${JSON.stringify(user.name).replace(/"/g, '&quot;')}, ${JSON.stringify(user.pfp || DEFAULT_PFP).replace(/"/g, '&quot;')})">
                       <i class="fas fa-envelope"></i>
                   </button>
                   <button class="xp-btn xp-btn-outline ${notifyOn ? 'xp-active' : ''}" onclick="App.ui.toggleNotifyUser('${user.id}')" title="${notifyOn ? 'Notificaciones activas' : 'Activar notificaciones'}">
                       <i class="fas fa-bell${notifyOn ? '' : '-slash'}"></i>
                   </button>
                   <button class="xp-btn xp-btn-outline" onclick="App.social.sendFriendRequest?.('${escapeJsAttr(user.name)}')" title="Solicitud de amistad">
                       <i class="fas fa-user-plus"></i>
                   </button>`;

            // Render del feed según tab activa
            const renderThreadItem = (t) => {
                const text = (t.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
                const snippet = text.slice(0, 200);
                const hasMedia = /<img|<video|<iframe/i.test(t.content || '');
                return `<article class="xp-feed-item" onclick="App.ui.closeUserProfile(); App.ui.jumpToThread('${t.id}')">
                    <div class="xp-feed-head">
                        <img src="${escapeHtml(user.pfp || DEFAULT_PFP)}" class="xp-feed-pfp" alt="">
                        <div class="xp-feed-meta">
                            <b>${safeName}</b>
                            <span class="xp-handle">${escapeHtml(handle)}</span>
                            <span class="xp-feed-time">· ${App.ui.timeAgo(t.timestamp)}</span>
                        </div>
                    </div>
                    <p class="xp-feed-text">${escapeHtml(snippet)}${text.length > 200 ? '…' : ''}</p>
                    ${hasMedia ? '<div class="xp-feed-media-tag"><i class="fas fa-image"></i> Multimedia</div>' : ''}
                    <div class="xp-feed-stats">
                        <span><i class="far fa-comment"></i> ${(t.comments || []).length}</span>
                        <span><i class="far fa-heart"></i> ${(t.likes || []).length}</span>
                        ${t.category ? `<span class="xp-feed-cat">${escapeHtml(t.category)}</span>` : ''}
                    </div>
                </article>`;
            };

            let feedItems = [];
            let emptyText = '';
            if (activeTab === 'posts') {
                feedItems = userThreads;
                emptyText = isSelf ? 'Aún no has publicado nada' : 'Aún no ha publicado hilos';
            } else if (activeTab === 'media') {
                feedItems = userMediaThreads;
                emptyText = 'Sin publicaciones con multimedia';
            } else if (activeTab === 'likes') {
                feedItems = userLikedThreads;
                emptyText = 'Sin publicaciones que le gusten';
            }
            const feedHTML = feedItems.length === 0
                ? `<div class="xp-empty"><i class="fas fa-feather"></i> ${emptyText}</div>`
                : feedItems.slice(0, 50).map(renderThreadItem).join('');

            const html = `
                <div class="modal-content xp-modal-content">
                    <header class="xp-topbar">
                        <button class="xp-back" onclick="App.ui.closeUserProfile()" aria-label="Cerrar"><i class="fas fa-arrow-left"></i></button>
                        <div class="xp-topbar-info">
                            <b>${safeName}</b>
                            <small>${userThreads.length} publicaciones</small>
                        </div>
                    </header>

                    <div class="xp-banner" style="${bannerStyle}"></div>

                    <div class="xp-header">
                        <div class="xp-pfp-wrap">
                            <img src="${escapeHtml(user.pfp || DEFAULT_PFP)}" class="xp-pfp" alt="${safeName}">
                            ${App.ui.statusDotHTML?.(user) || ''}
                        </div>
                        <div class="xp-actions">${actionButtons}</div>
                    </div>

                    <div class="xp-identity">
                        <h2 class="xp-name">${safeName} ${App.ui.renderBadges(user)}</h2>
                        <span class="xp-handle">${escapeHtml(handle)}</span>
                        ${App.ui.customStatusHTML?.(user) || ''}
                    </div>

                    ${safeBio ? `<p class="xp-bio">${safeBio}</p>` : ''}

                    <div class="xp-meta-row">
                        <span><i class="far fa-calendar"></i> Se unió en ${memberSince}</span>
                    </div>

                    <div class="xp-stats">
                        <span><b>${following}</b> Siguiendo</span>
                        <span><b>${followers}</b> Seguidores</span>
                        <span><b>${userThreads.length}</b> Publicaciones</span>
                    </div>

                    <nav class="xp-tabs">
                        <button class="xp-tab ${activeTab==='posts'?'active':''}" onclick="App.ui._switchProfileTab('${user.id}','posts')">Publicaciones</button>
                        <button class="xp-tab ${activeTab==='media'?'active':''}" onclick="App.ui._switchProfileTab('${user.id}','media')">Multimedia</button>
                        <button class="xp-tab ${activeTab==='likes'?'active':''}" onclick="App.ui._switchProfileTab('${user.id}','likes')">Me gusta</button>
                    </nav>

                    <div class="xp-feed">${feedHTML}</div>
                </div>`;

            let modal = document.getElementById('profile-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'profile-modal';
                modal.className = 'modal hidden';
                /* Modal NO cierra al click fuera — solo el botón X. */
                document.body.appendChild(modal);
            }
            modal.innerHTML = html;
            modal.classList.remove('hidden');
        },

        // Toggle del flag local "notificarme cuando publique X usuario".
        // Persiste en localStorage como App.db.notifyOn[myId] = [userIds].
        toggleNotifyUser(targetUserId) {
            if (!App.db.session) { this.toast('Inicia sesión primero', 'warning'); return; }
            const myId = App.db.session.id;
            App.db.notifyOn = App.db.notifyOn || {};
            App.db.notifyOn[myId] = App.db.notifyOn[myId] || [];
            const list = App.db.notifyOn[myId];
            const idx = list.indexOf(targetUserId);
            if (idx > -1) {
                list.splice(idx, 1);
                this.toast('Ya no recibirás notificaciones de sus publicaciones', 'info');
            } else {
                list.push(targetUserId);
                this.toast('Recibirás notificaciones cuando publique', 'success');
            }
            localStorage.setItem('tv_notify_on', JSON.stringify(App.db.notifyOn));
            // Refrescar el modal para que el botón cambie de estado
            this.openUserProfile(targetUserId);
        }
    }
};

// ========== MÓDULO 10: NOTICIAS IA ==========
// Intenta primero el endpoint PHP. Si falla (no hay servidor), usa pool local.
App.news = {
    REFRESH_INTERVAL_MS: 30 * 60 * 1000, // 30 min
    ENDPOINT: 'main/php/fetch_news.php',

    // POOL VACÍO. No publicamos noticias inventadas: cada noticia debe venir
    // del endpoint real (PHP/Graph API) o pegada manualmente por admin con
    // el URL exacto del post fuente.
    pool: [],

    init() {
        // No auto-sembramos contenido sin fuente real. Solo intentamos refrescar
        // desde el endpoint PHP/Graph API; si no hay nada, el feed queda vacío
        // hasta que un admin/medio publique con su URL fuente correspondiente.
        setInterval(() => this.refresh(false), this.REFRESH_INTERVAL_MS);
    },

    async refresh(showToast) {
        const btn = document.getElementById('refresh-news');
        if (btn) btn.classList.add('spinning');

        let items = await this.fetchRemote();
        if (items.length === 0) {
            items = this.pickFromPool(4);
        }

        if (items.length === 0) {
            if (showToast) App.ui.toast('No hay noticias nuevas por ahora', 'info');
        } else {
            this.publish(items);
            if (showToast) App.ui.toast(`${items.length} noticias actualizadas`, 'success');
        }

        if (btn) setTimeout(() => btn.classList.remove('spinning'), 600);
    },

    async fetchRemote() {
        // Si la página corre en file:// no hay servidor — no intentamos fetch (evita spam de CORS)
        if (location.protocol === 'file:') return [];
        try {
            const res = await fetch(this.ENDPOINT, { cache: 'no-store' });
            if (!res.ok) return [];
            const data = await res.json();
            const existing = new Set(App.db.threads.filter(t => t.isBot).map(t => t.content));
            return (Array.isArray(data) ? data : [])
                .filter(n => n && n.content && n.sourceUrl && !existing.has(n.content))
                .map(n => ({
                    content: n.content,
                    category: n.category || 'noticias',
                    outletId: n.outletId || null,
                    sourceUrl: n.sourceUrl
                }));
        } catch (_) {
            return [];
        }
    },

    pickFromPool(n) {
        const existing = new Set(App.db.threads.filter(t => t.isBot).map(t => t.content));
        const fresh = this.pool.filter(p => !existing.has(p.content));
        // Mezcla y toma N
        for (let i = fresh.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
        }
        return fresh.slice(0, n);
    },

    renderBibliography() {
        const outlets = (App.db.outlets || []).filter(o => o.verified);
        const items = outlets.map(o => `
            <li>
                <a href="${escapeHtml(o.url)}" target="_blank" rel="noopener noreferrer">
                    <i class="fas fa-link"></i> ${escapeHtml(o.name)}
                </a>
            </li>`).join('');
        return `
            <footer class="news-bibliography">
                <h4><i class="fas fa-book"></i> Fuentes oficiales · Bibliografía</h4>
                <ul class="biblio-list">${items}</ul>
                <p class="biblio-note">
                    Los contenidos publicados en esta sección citan y enlazan a sus fuentes originales.
                    Todos los derechos pertenecen a sus respectivos autores y medios.
                </p>
            </footer>
        `;
    },

    publish(items) {
        if (!items || items.length === 0) return;
        const author = App.db.session?.name || 'Redacción';
        const authorId = App.db.session?.id;
        const pfp = App.db.session?.pfp || BOT_PFP;
        if (!authorId) {
            App.ui.toast('Inicia sesión como admin/medio para publicar', 'warning');
            return;
        }
        const newThreads = items.map((it, i) => ({
            id: (window.crypto?.randomUUID?.() || (Date.now() + '-' + Math.random().toString(36).slice(2))),
            author,
            authorId,
            pfp,
            // Si hay sourceUrl, lo metemos como link al final del contenido.
            content: it.sourceUrl
                ? `${it.content}\n\n🔗 <a href="${it.sourceUrl}" target="_blank" rel="noopener noreferrer">Ver post original</a>`
                : it.content,
            category: it.category || 'noticias',
            outletId: it.outletId || null,
            attachments: [],
            likes: [],
            comments: [],
            reactions: {},
            timestamp: new Date(Date.now() - i * 1000).toISOString(),
            isBot: true,
            isRich: true,
            _fresh: true
        }));
        App.db.threads.unshift(...newThreads);
        App.db.save();

        // Sincronizar a Supabase para que sean globales (todos los usuarios las ven)
        if (window.SB && App.sb?.insertThread) {
            newThreads.forEach(t => {
                App.sb.insertThread(t).catch(err => console.error('[news] sync:', err));
            });
        }

        const route = App.ui.state.currentRoute;
        if (route === 'inicio' || route === 'noticias') {
            App.forum.render('', route === 'noticias' ? 'noticias' : 'all');
        }

        setTimeout(() => {
            newThreads.forEach(t => { delete t._fresh; });
            App.db.save();
        }, 1500);
    }
};

// ========== MÓDULO 11: EDITOR ENRIQUECIDO ==========
App.editor = {
    mode: 'thread',          // 'thread' | 'reply'
    replyContext: null,      // { threadId, parentCommentId }
    targetCategory: 'general', // se ajusta por contexto (ruta + rol)
    MAX_IMAGE_BYTES: 5 * 1024 * 1024,   // 5 MB
    MAX_VIDEO_BYTES: 10 * 1024 * 1024,  // 10 MB
    MAX_DOC_BYTES:   3 * 1024 * 1024,   // 3 MB

    // Comandos de formato (negrita, cursiva, alineación, listas, etc.)
    exec(command, value = null) {
        const editor = document.getElementById('editor-body');
        if (editor) editor.focus();
        document.execCommand(command, false, value);
    },

    setFontSize(size) {
        if (!size) return;
        this.exec('fontSize', size);
    },

    setFontFamily(family) {
        if (!family) return;
        this.exec('fontName', family);
    },

    setColor(color) {
        if (!color) return;
        this.exec('foreColor', color);
    },

    // Inserta nodo en la posición del caret (o al final si el caret está fuera).
    insertNode(node) {
        const editor = document.getElementById('editor-body');
        if (!editor) return;
        editor.focus();
        const sel = window.getSelection();
        if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(node);
            range.setStartAfter(node);
            range.setEndAfter(node);
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            editor.appendChild(node);
        }
        // Salto de línea después para seguir escribiendo cómodo
        const br = document.createElement('br');
        node.parentNode?.insertBefore(br, node.nextSibling);
    },

    async insertImage(input) {
        const file = input?.files?.[0];
        input.value = '';
        await this.embedImage(file);
    },

    async insertVideo(input) {
        const file = input?.files?.[0];
        input.value = '';
        await this.embedVideo(file);
    },

    async insertDocument(input) {
        const file = input?.files?.[0];
        input.value = '';
        await this.embedDocument(file);
    },

    async embedImage(file) {
        if (!file || !file.type.startsWith('image/')) return;
        if (file.size > this.MAX_IMAGE_BYTES) {
            App.ui.toast('Imagen demasiado grande (máx 5MB)', 'warning'); return;
        }
        const dataUrl = await this.readAsDataUrl(file);
        const compressed = await App.mediaOps.compressImage(dataUrl, 1200, 0.78);
        const img = document.createElement('img');
        img.src = compressed;
        img.alt = file.name;
        this.insertNode(img);
    },

    async embedVideo(file) {
        if (!file || !file.type.startsWith('video/')) return;
        if (file.size > this.MAX_VIDEO_BYTES) {
            App.ui.toast('Video demasiado grande (máx 10MB)', 'warning'); return;
        }
        const dataUrl = await this.readAsDataUrl(file);
        const video = document.createElement('video');
        video.src = dataUrl;
        video.controls = true;
        video.preload = 'metadata';
        this.insertNode(video);
    },

    async embedDocument(file) {
        if (!file) return;
        if (file.size > this.MAX_DOC_BYTES) {
            App.ui.toast('Documento demasiado grande (máx 3MB)', 'warning'); return;
        }
        const dataUrl = await this.readAsDataUrl(file);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = file.name;
        a.className = 'doc-attachment';
        a.innerHTML = `<i class="fas fa-file-arrow-down"></i> ${escapeHtml(file.name)} <small>(${(file.size / 1024).toFixed(0)} KB)</small>`;
        this.insertNode(a);
    },

    handleDroppedFile(file) {
        if (!file) return;
        if (file.type.startsWith('image/')) return this.embedImage(file);
        if (file.type.startsWith('video/')) return this.embedVideo(file);
        return this.embedDocument(file);
    },

    // Pega un enlace; si es YouTube se embebe, si no se inserta como link clickable.
    promptLink() {
        const url = prompt('Pega URL (YouTube se embebe automáticamente):');
        if (!url) return;
        this.insertLink(url.trim());
    },

    insertLink(url) {
        const ytId = getYouTubeId(url);
        if (ytId) return this.embedYouTube(ytId);

        if (!/^https?:\/\//i.test(url)) {
            App.ui.toast('Solo se aceptan URLs http(s)', 'warning');
            return;
        }
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = url;
        a.className = 'rich-link';
        this.insertNode(a);
    },

    embedYouTube(id) {
        const tmpl = document.createElement('template');
        tmpl.innerHTML = youtubeFacadeHTML(id);
        const wrapper = tmpl.content.firstElementChild;
        wrapper.contentEditable = 'false';
        this.insertNode(wrapper);
        App.ui.toast('Video de YouTube embebido (Lite Embed)', 'success');
    },

    // Detecta si lo pegado en el editor es una URL de YouTube y lo embebe en lugar del texto.
    handlePaste(e) {
        const text = e.clipboardData?.getData('text');
        if (!text) return;
        const ytId = getYouTubeId(text);
        if (ytId) {
            e.preventDefault();
            this.embedYouTube(ytId);
        }
    },

    readAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = e => resolve(e.target.result);
            r.onerror = reject;
            r.readAsDataURL(file);
        });
    },

    // Foto de perfil (settings)
    handleProfilePic(input) {
        const file = input?.files?.[0];
        if (!file || !App.mediaOps.validateFile(file)) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const compressed = await App.mediaOps.compressImage(e.target.result, 200);
            App.tempProfilePic = compressed;
            const prev = document.querySelector('#profile-preview .pp-pfp');
            if (prev) prev.src = compressed;
            App.ui.toast('Foto cargada — pulsa Guardar Cambios', 'success');
        };
        reader.readAsDataURL(file);
    },

    // Banner del perfil (settings)
    handleBanner(input) {
        const file = input?.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            App.ui.toast('Banner demasiado grande (máx 5MB)', 'warning'); return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            const compressed = await App.mediaOps.compressImage(e.target.result, 1400, 0.78);
            App.tempBanner = compressed;
            const prev = document.querySelector('#profile-preview .pp-banner');
            if (prev) prev.style.backgroundImage = `url("${compressed}")`;
            App.ui.toast('Banner cargado — pulsa Guardar Cambios', 'success');
        };
        reader.readAsDataURL(file);
    },

    removeBanner() {
        App.tempBanner = '__REMOVE__';
        const prev = document.querySelector('#profile-preview .pp-banner');
        if (prev) prev.style.backgroundImage = '';
        App.ui.toast('Banner se quitará al guardar', 'info');
    }
};

// ========== MÓDULO ADMIN ==========
App.admin = {
    purgeAll() {
        if (!App.db.session || App.db.session.role !== 'admin') {
            App.ui.toast('Solo admin puede ejecutar esta acción', 'error');
            return;
        }
        const totalT = App.db.threads.length;
        const totalG = App.db.gallery.length;
        const totalN = App.db.notifications.length;
        if (totalT + totalG + totalN === 0) {
            App.ui.toast('No hay contenido para borrar', 'info');
            return;
        }
        const msg = `⚠️ ¿BORRAR TODO el contenido?\n\nSe eliminarán:\n· ${totalT} hilos / noticias\n· ${totalG} fotos de galería\n· ${totalN} notificaciones\n\nNo se borran cuentas, outlets ni configuración.\n\nEsta acción NO se puede deshacer.`;
        if (!confirm(msg)) return;
        if (!confirm('Última confirmación: ¿estás 100% seguro?')) return;

        App.db.threads = [];
        App.db.gallery = [];
        App.db.notifications = [];
        App.db.bookmarks = {};
        App.db.save();
        App.ui.toast(`Borrados: ${totalT} hilos, ${totalG} fotos, ${totalN} notificaciones`, 'success');
        App.ui.closeSettings();
        App.ui.updateHeader();
        App.ui.navigate('inicio');
    },

    purgeThreadsOnly() {
        if (!App.db.session || App.db.session.role !== 'admin') {
            App.ui.toast('Solo admin', 'error'); return;
        }
        if (!confirm(`¿Borrar todos los hilos y noticias (${App.db.threads.length})?`)) return;
        App.db.threads = [];
        App.db.save();
        App.ui.toast('Todos los hilos borrados', 'success');
        App.ui.navigate('inicio');
    },

    purgeTemplateBusinesses() {
        if (!App.db.session || App.db.session.role !== 'admin') return;
        const before = App.db.businesses.length;
        App.db.businesses = App.db.businesses.filter(b => !b._template);
        App.db.save();
        App.ui.toast(`Eliminados ${before - App.db.businesses.length} negocios template`, 'success');
        App.admin.refreshBusinessCounts();
    },

    refreshBusinessCounts() {
        const total = App.db.businesses.length;
        const tpl = App.db.businesses.filter(b => b._template).length;
        const a = document.getElementById('biz-count');
        const b = document.getElementById('biz-template-count');
        if (a) a.textContent = total;
        if (b) b.textContent = tpl;
    },

    // Parser CSV con manejo de comillas (campos pueden contener comas)
    _parseCSVLine(line) {
        const out = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (inQ) {
                if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
                else if (c === '"') inQ = false;
                else cur += c;
            } else {
                if (c === '"') inQ = true;
                else if (c === ',') { out.push(cur); cur = ''; }
                else cur += c;
            }
        }
        out.push(cur);
        return out.map(s => s.trim());
    },

    // Importa negocios desde CSV: name,category,address,phone,lat,lng,description
    // Sube cada negocio a Supabase (si está disponible) además de cachearlo localmente.
    async importBusinessesCSV(input) {
        if (!App.db.session || App.db.session.role !== 'admin') return;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;

        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) { App.ui.toast('CSV vacío', 'warning'); return; }

        // Detectar header
        const start = /name|nombre/i.test(lines[0]) ? 1 : 0;
        const items = [];
        for (let i = start; i < lines.length; i++) {
            const cols = this._parseCSVLine(lines[i]);
            if (!cols[0]) continue;
            const item = {
                name: cols[0],
                category: cols[1] || 'Otros',
                address: cols[2] || '',
                phone: cols[3] || '',
                description: cols[6] || ''
            };
            if (cols[4] && cols[5]) {
                const lat = parseFloat(cols[4]), lng = parseFloat(cols[5]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    item.coords = [lat, lng];
                    item.lat = lat;
                    item.lng = lng;
                }
            }
            items.push(item);
        }

        if (items.length === 0) {
            App.ui.toast('CSV sin filas válidas', 'warning'); return;
        }

        const replaceAll = confirm(`Importar ${items.length} negocios.\n\nOK = Reemplazar TODO el directorio (borra los actuales en Supabase y locales).\nCancelar = Añadir al directorio existente.`);

        App.ui.toast(`Subiendo ${items.length} negocios a Supabase…`, 'info');

        // Si reemplazamos, primero borra todo en Supabase
        if (replaceAll && window.SB) {
            const existing = App.db.businesses.filter(b => b._supabase).map(b => b.id);
            if (existing.length > 0) {
                await SB.from('businesses').delete().in('id', existing);
            }
            App.db.businesses = [];
        }

        // Subir cada item a Supabase (con .insertBusiness ya existente)
        let added = 0;
        let failed = 0;
        for (const item of items) {
            const inserted = window.SB ? await App.sb.insertBusiness(item) : null;
            if (inserted) {
                added++;
                App.db.businesses.push({
                    id: inserted.id, name: inserted.name, category: inserted.category,
                    address: inserted.address || '', phone: inserted.phone || '',
                    description: inserted.description || '', image: inserted.image || '',
                    coords: (typeof inserted.lat === 'number' && typeof inserted.lng === 'number') ? [inserted.lat, inserted.lng] : null,
                    lat: inserted.lat, lng: inserted.lng,
                    _template: false, _supabase: true
                });
            } else {
                // Fallback: solo local
                failed++;
                App.db.businesses.push({ ...item, id: Date.now() + Math.random(), _template: false });
            }
        }

        App.db.save();
        App.admin.refreshBusinessCounts?.();
        App.ui.renderBusinessDirectory?.();
        const mapEl = document.getElementById('hub-map');
        if (mapEl?._mapInstance) { mapEl._mapInstance.remove(); delete mapEl._mapInstance; setTimeout(() => App.ui.initHubMap(), 50); }

        if (failed === 0) {
            App.ui.toast(`✓ ${added} negocios importados a Supabase`, 'success');
        } else {
            App.ui.toast(`${added} subidos a Supabase, ${failed} solo locales (revisa consola)`, 'warning');
        }
    },

    importBusinessesJSON(input) {
        if (!App.db.session || App.db.session.role !== 'admin') return;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        const r = new FileReader();
        r.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                if (!Array.isArray(data)) throw new Error('JSON debe ser un array');
                let nextId = (App.db.businesses.reduce((m, b) => Math.max(m, b.id), 0) || 0) + 1;
                const items = data.map(b => ({
                    id: b.id || nextId++,
                    name: b.name || 'Sin nombre',
                    category: b.category || 'Otros',
                    address: b.address || '',
                    phone: b.phone || '',
                    coords: Array.isArray(b.coords) ? b.coords : undefined
                }));
                if (confirm(`Importar ${items.length} negocios. ¿Reemplazar TODO el directorio?\n(Cancelar = añadir)`)) {
                    App.db.businesses = items;
                } else {
                    App.db.businesses = [...App.db.businesses, ...items];
                }
                App.db.save();
                App.ui.toast(`${items.length} negocios importados`, 'success');
                App.admin.refreshBusinessCounts();
            } catch (err) {
                App.ui.toast('JSON inválido: ' + err.message, 'error');
            }
        };
        r.readAsText(file, 'utf-8');
    },

    exportBusinessesCSV() {
        const rows = ['name,category,address,phone,lat,lng'];
        App.db.businesses.forEach(b => {
            const safe = s => `"${String(s || '').replace(/"/g, '""')}"`;
            const lat = b.coords?.[0] || '';
            const lng = b.coords?.[1] || '';
            rows.push([safe(b.name), safe(b.category), safe(b.address), safe(b.phone), lat, lng].join(','));
        });
        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tres-valles-negocios-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        App.ui.toast(`Exportados ${App.db.businesses.length} negocios`, 'success');
    }
};

// ========== MÓDULO GALERÍA ==========
// ============================================================
// MÓDULO: VIDEOS DEFAULT (player destacado con autoplay queue)
// ============================================================
// Lee `videos-default/manifest.json`. Elige UNO al azar para
// mostrarlo grande arriba de la sección Videos. Cuando termina,
// avanza al siguiente automáticamente. Botón "Ver todos" muestra
// la lista completa para que el usuario elija manualmente.
// ============================================================
App.videosDefault = {
    // Lista hardcoded para evitar problemas con fetch/SW/cache. El manifest
    // del archivo gallery-default/manifest.json sigue funcionando como override
    // si está disponible, pero por defecto SIEMPRE hay contenido.
    _list: [
        {
            kind: 'youtube',
            youtube_id: 'SwljRmZDFi0',
            title: 'Orgullo Veracruzano · Tres Valles',
            description: 'Acompaña a Felley a conocer el Municipio de Tres Valles, Veracruz.',
            author: 'TVMÁS RTV',
            source_url: 'https://www.youtube.com/@TVMASRTV',
            year: 2021
        }
    ],
    _currentIdx: -1,

    async loadDefaults() {
        try {
            // Cache-bust con timestamp para que el SW NUNCA sirva una versión vieja del manifest
            const url = 'main/videos-default/manifest.json?_=' + Date.now();
            const res = await fetch(url, { cache: 'reload' });
            if (!res.ok) {
                console.warn('[videosDefault] manifest no disponible — uso lista hardcoded:', res.status);
                return; // mantiene la lista hardcoded
            }
            const data = await res.json();
            const list = Array.isArray(data?.videos) ? data.videos : [];
            if (list.length === 0) return; // mantiene hardcoded si el manifest está vacío
            this._list = list.filter(v => v && (v.file || v.youtube_id)).map(v => {
                const base = {
                    title: typeof v.title === 'string' ? v.title : '',
                    description: typeof v.description === 'string' ? v.description : '',
                    author: typeof v.author === 'string' ? v.author : '',
                    source_url: typeof v.source_url === 'string' ? v.source_url : '',
                    year: v.year || ''
                };
                if (v.youtube_id) {
                    return { ...base, kind: 'youtube', youtube_id: String(v.youtube_id) };
                }
                return { ...base, kind: 'local', src: 'main/videos-default/' + v.file };
            });
            console.log(`[videosDefault] ${this._list.length} videos cargados desde manifest`);
        } catch (e) {
            console.warn('[videosDefault] error cargando manifest — uso lista hardcoded:', e?.message || e);
            // Mantener la lista hardcoded
        }
        // Si el usuario ya está viendo Explora, re-renderizar para mostrar los videos
        if (App.ui?.state?.currentRoute === 'explora') {
            App.ui.navigate('explora');
        }
    },

    // Devuelve el índice del video que toca reproducir; si es -1, elige uno al azar.
    pickStartIndex() {
        if (this._list.length === 0) return -1;
        if (this._list.length === 1) return 0;
        return Math.floor(Math.random() * this._list.length);
    },

    // Avanza al siguiente del array (cíclico)
    next() {
        if (this._list.length === 0) return;
        this._currentIdx = (this._currentIdx + 1) % this._list.length;
        this._renderInto(document.getElementById('videos-default-featured'));
    },

    // Salta al video con índice específico (usado desde el botón "Ver todos")
    jumpTo(idx) {
        if (idx < 0 || idx >= this._list.length) return;
        this._currentIdx = idx;
        this._renderInto(document.getElementById('videos-default-featured'));
        // Cerrar la lista expandida
        const list = document.getElementById('videos-default-list');
        if (list) list.classList.add('hidden');
        const btn = document.getElementById('videos-default-toggle');
        if (btn) btn.innerHTML = '<i class="fas fa-list"></i> Ver todos';
    },

    // Toggle del listado completo
    toggleList() {
        const list = document.getElementById('videos-default-list');
        const btn  = document.getElementById('videos-default-toggle');
        if (!list || !btn) return;
        const willHide = !list.classList.contains('hidden');
        list.classList.toggle('hidden');
        btn.innerHTML = willHide
            ? '<i class="fas fa-list"></i> Ver todos'
            : '<i class="fas fa-xmark"></i> Cerrar lista';
    },

    // Renderiza la sección completa (player + botón + lista). Se llama
    // desde renderHub. Si no hay defaults, retorna string vacío.
    renderSection() {
        if (this._list.length === 0) return '';
        if (this._currentIdx === -1) this._currentIdx = this.pickStartIndex();

        return `
            <section class="hub-section videos-default-section">
                <h2><i class="fas fa-tv"></i> En reproducción</h2>
                <p class="hub-section-lead">Selección aleatoria de videos del municipio. Cuando uno termina, sigue el siguiente.</p>
                <div id="videos-default-featured" class="videos-default-featured">
                    ${this._renderPlayer(this._currentIdx)}
                </div>
                <button id="videos-default-toggle" class="btn-small videos-default-toggle" onclick="App.videosDefault.toggleList()">
                    <i class="fas fa-list"></i> Ver todos
                </button>
                <div id="videos-default-list" class="videos-default-list hidden">
                    ${this._list.map((v, i) => {
                        const subtitle = v.author
                            ? `Por ${escapeHtml(v.author)}${v.year ? ' · ' + escapeHtml(String(v.year)) : ''}`
                            : (v.description ? escapeHtml(v.description) : '');
                        const ytTag = v.kind === 'youtube' ? '<span class="vd-yt-tag" title="YouTube"><i class="fab fa-youtube"></i></span>' : '';
                        return `
                            <div class="vd-list-item ${i === this._currentIdx ? 'active' : ''}" onclick="App.videosDefault.jumpTo(${i})">
                                <div class="vd-list-thumb">${ytTag || '<i class="fas fa-circle-play"></i>'}</div>
                                <div class="vd-list-info">
                                    <b>${escapeHtml(v.title || 'Sin título')}</b>
                                    ${subtitle ? `<small>${subtitle}</small>` : ''}
                                </div>
                                ${i === this._currentIdx ? '<span class="vd-list-tag">ahora</span>' : ''}
                            </div>`;
                    }).join('')}
                </div>
            </section>
        `;
    },

    _renderPlayer(idx) {
        const v = this._list[idx];
        if (!v) return '';

        // Player: video local con HTML5 o iframe de YouTube
        let playerHTML = '';
        if (v.kind === 'youtube' && v.youtube_id) {
            const safeId = String(v.youtube_id).replace(/[^a-zA-Z0-9_-]/g, '');
            // enablejsapi=1 + origin permite escuchar el evento "ended" desde JS
            playerHTML = `
                <iframe id="vd-yt-iframe" class="videos-default-video"
                    src="https://www.youtube-nocookie.com/embed/${safeId}?autoplay=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}"
                    frameborder="0" allowfullscreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                </iframe>`;
            // Para YouTube no podemos detectar "ended" sin la API completa;
            // dejamos que el usuario pueda saltar manualmente con la lista.
        } else {
            playerHTML = `
                <video controls preload="metadata" playsinline class="videos-default-video"
                       onended="App.videosDefault.next()"
                       onerror="App.videosDefault._handleError()">
                    <source src="${escapeHtml(v.src)}">
                    Tu navegador no soporta video HTML5.
                </video>`;
        }

        // Créditos al autor — siempre visibles si existen
        const credits = (v.author || v.source_url) ? `
            <div class="videos-default-credit">
                <i class="fas fa-circle-info"></i>
                <span>
                    Video por
                    ${v.source_url
                        ? `<a href="${escapeHtml(v.source_url)}" target="_blank" rel="noopener noreferrer"><b>${escapeHtml(v.author || 'autor')}</b> <i class="fas fa-arrow-up-right-from-square"></i></a>`
                        : `<b>${escapeHtml(v.author || 'autor')}</b>`
                    }
                    ${v.year ? `· ${escapeHtml(String(v.year))}` : ''}
                    ${v.kind === 'youtube' ? '· vía YouTube' : ''}
                </span>
            </div>` : '';

        return `
            ${playerHTML}
            <div class="videos-default-info">
                <h3>${escapeHtml(v.title || 'Sin título')}</h3>
                ${v.description ? `<p>${escapeHtml(v.description)}</p>` : ''}
                ${credits}
                <small><i class="fas fa-forward"></i> ${v.kind === 'youtube' ? 'Usa "Ver todos" para saltar al siguiente' : 'Al terminar continúa con el siguiente'} · ${idx + 1} / ${this._list.length}</small>
            </div>
        `;
    },

    _renderInto(el) {
        if (!el) return;
        el.innerHTML = this._renderPlayer(this._currentIdx);
        // Auto-play del nuevo video local (los iframes de YouTube ya llevan autoplay=1
        // en la URL, no necesitan llamada a .play()). Local: puede ser bloqueado por
        // el navegador si el usuario no interactuó aún.
        const vid = el.querySelector('video');
        if (vid) vid.play().catch(err => console.info('[videosDefault] autoplay bloqueado:', err?.name));
        // Refrescar la lista marcando el activo
        const listEl = document.getElementById('videos-default-list');
        if (listEl) {
            listEl.querySelectorAll('.vd-list-item').forEach((item, i) => {
                item.classList.toggle('active', i === this._currentIdx);
                const tag = item.querySelector('.vd-list-tag');
                if (i === this._currentIdx && !tag) {
                    item.insertAdjacentHTML('beforeend', '<span class="vd-list-tag">ahora</span>');
                } else if (i !== this._currentIdx && tag) {
                    tag.remove();
                }
            });
        }
    },

    // Si un archivo no existe, salta al siguiente sin romper el flow
    _handleError() {
        console.warn('[videosDefault] error cargando, saltando al siguiente');
        // Pequeño debounce para evitar loops si TODOS los videos fallan
        if (this._failures > this._list.length) return;
        this._failures = (this._failures || 0) + 1;
        setTimeout(() => this.next(), 200);
    }
};

App.gallery = {
    MAX_BYTES: 5 * 1024 * 1024,
    // Lista hardcoded para evitar problemas con fetch/SW/cache. loadDefaults()
    // intentará leer el manifest pero por defecto YA hay contenido.
    _defaults: [
        { src: 'main/gallery-default/Escudo_Tres_Valles.svg.png',
          caption: 'Escudo oficial del municipio de Tres Valles — "In Via Prosperitatis"' },
        { src: 'main/gallery-default/PARQUEEDUA.png',
          caption: 'Parque Central Miguel Hidalgo — corazón social y cultural' },
        { src: 'main/gallery-default/Captura de pantalla 2026-04-30 073104.png',
          caption: 'Monumento de bienvenida a Tres Valles' },
        { src: 'main/gallery-default/Captura de pantalla 2026-04-30 073230.png',
          caption: 'Tanque elevado emblemático con murales de Tres Valles' },
        { src: 'main/gallery-default/Captura de pantalla 2026-04-30 073036.png',
          caption: 'Planta Papelera Scribe — uno de los motores industriales' },
        { src: 'main/gallery-default/WhatsApp Image 2026-04-30 at 7.30.16 AM (1).jpeg',
          caption: 'Acceso al Ingenio Tres Valles — Grupo PIASA' },
        { src: 'main/gallery-default/WhatsApp Image 2026-04-30 at 7.30.15 AM.jpeg',
          caption: 'Vista del Ingenio Tres Valles desde la carretera' },
        { src: 'main/gallery-default/WhatsApp Image 2026-04-30 at 7.30.16 AM.jpeg',
          caption: 'Ingenio Tres Valles visto desde la parada de autobús' },
        { src: 'main/gallery-default/Captura de pantalla 2026-04-30 073150.png',
          caption: 'Vías del Ferrocarril del Istmo y puente peatonal histórico' },
        { src: 'main/gallery-default/Captura de pantalla 2026-04-30 073339.png',
          caption: 'Calle del centro con torre de alta tensión y vida cotidiana' },
        { src: 'main/gallery-default/Captura de pantalla 2026-04-30 073412.png',
          caption: 'Calle comercial del centro de Tres Valles' },
        { src: 'main/gallery-default/Captura de pantalla 2026-04-30 073350.png',
          caption: 'Calle típica del municipio' },
        { src: 'main/gallery-default/Captura de pantalla 2026-04-30 073401.png',
          caption: 'Avenida con cielo abierto característico de la planicie' },
        { src: 'main/gallery-default/Captura de pantalla 2026-05-13 070746.png',
          caption: 'Sucursal Coppel / BanCoppel en Tres Valles — comercio de cadena' },
        { src: 'main/gallery-default/IMG_7805.jpeg',
          caption: 'Pasillo del mercado municipal — locales de calzado y abarrotes' },
        { src: 'main/gallery-default/IMG_7809.jpeg',
          caption: 'Puesto de frutas y verduras en el mercado municipal' },
        { src: 'main/gallery-default/images.jpg',
          caption: 'Pasillo interior del mercado municipal' }
    ],

    // Lee gallery-default/manifest.json y arma la lista de imágenes precargadas.
    // Falla con warning si la carpeta no existe o el JSON está roto.
    async loadDefaults() {
        try {
            // Cache-bust con timestamp para que el SW NUNCA sirva una versión vieja del manifest
            const url = 'main/gallery-default/manifest.json?_=' + Date.now();
            const res = await fetch(url, { cache: 'reload' });
            if (!res.ok) {
                console.warn('[gallery] manifest no disponible — uso lista hardcoded:', res.status);
                return; // mantiene hardcoded
            }
            const data = await res.json();
            const list = Array.isArray(data?.images) ? data.images : [];
            if (list.length === 0) return;
            this._defaults = list
                .filter(it => it && typeof it.file === 'string' && it.file)
                .map(it => ({
                    src: 'main/gallery-default/' + it.file,
                    caption: typeof it.caption === 'string' ? it.caption : ''
                }));
            console.log(`[gallery] ${this._defaults.length} imágenes default cargadas desde manifest`);
        } catch (e) {
            console.warn('[gallery] error cargando manifest — uso lista hardcoded:', e?.message || e);
            // Mantener la lista hardcoded
        }
        // Si el usuario ya está viendo Explora, re-renderizar para mostrar las fotos
        if (App.ui?.state?.currentRoute === 'explora') {
            App.ui.navigate('explora');
        }
    },

    // Lightbox para imágenes default (sin id porque no están en App.db).
    openLightboxDefault(src, caption) {
        document.querySelector('.lightbox')?.remove();
        const lb = document.createElement('div');
        lb.className = 'lightbox';
        lb.innerHTML = `
            <button class="lightbox-close" onclick="this.parentElement.remove()">&times;</button>
            <img src="${escapeHtml(src)}" alt="${escapeHtml(caption || '')}">
            ${caption ? `<div class="lightbox-caption">${escapeHtml(caption)}</div>` : ''}
        `;
        document.body.appendChild(lb);
    },

    async upload(input) {
        if (!App.db.session || App.db.session.role !== 'admin') {
            App.ui.toast('Solo admin puede subir fotos a la galería', 'error');
            return;
        }
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        if (file.size > this.MAX_BYTES) {
            App.ui.toast('Imagen demasiado grande (máx 5MB)', 'warning');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            const compressed = await App.mediaOps.compressImage(e.target.result, 1600, 0.78);
            const caption = (prompt('Pie de foto (opcional):') || '').trim();
            App.db.gallery.unshift({
                id: Date.now(),
                src: compressed,
                caption,
                addedBy: App.db.session.id,
                addedAt: new Date().toISOString()
            });
            App.db.save();
            App.ui.toast('Foto añadida a la galería', 'success');
            if (App.ui.state.currentRoute === 'explora') App.ui.navigate('explora');
        };
        reader.readAsDataURL(file);
    },

    delete(id) {
        if (!App.db.session || App.db.session.role !== 'admin') return;
        if (!confirm('¿Eliminar esta foto?')) return;
        App.db.gallery = App.db.gallery.filter(g => g.id !== id);
        App.db.save();
        App.ui.toast('Foto eliminada', 'info');
        if (App.ui.state.currentRoute === 'explora') App.ui.navigate('explora');
    },

    openLightbox(id) {
        const item = App.db.gallery.find(g => g.id === id);
        if (!item) return;
        document.querySelector('.lightbox')?.remove();
        const lb = document.createElement('div');
        lb.className = 'lightbox';
        lb.innerHTML = `
            <button class="lightbox-close" onclick="this.parentElement.remove()">&times;</button>
            <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.caption || '')}">
            ${item.caption ? `<div class="lightbox-caption">${escapeHtml(item.caption)}</div>` : ''}
        `;
        document.body.appendChild(lb);
        // Lightbox solo cierra con el botón ✕ (no al click afuera ni con Escape).
    }
};

// ========== TOGGLE COLAPSAR SIDEBAR ==========
App.ui.toggleSidebarCollapse = function () {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('tv_sidebar_collapsed', collapsed ? '1' : '0');
};

// ========== NOTICIA MANUAL ==========
App.news.publishManual = function () {
    if (!App.db.session || !['admin', 'media'].includes(App.db.session.role)) {
        App.ui.toast('Solo admin o medios verificados pueden publicar noticias', 'error');
        return;
    }
    const raw       = document.getElementById('paste-news-content').value;
    const category  = document.getElementById('paste-news-category').value || 'noticias';
    const outletId  = document.getElementById('paste-news-outlet').value || null;
    const sourceUrl = document.getElementById('paste-news-source').value.trim();
    const bulkMode  = document.getElementById('paste-news-bulk')?.checked;

    if (!raw.trim()) { App.ui.toast('Pega contenido primero', 'warning'); return; }

    if (bulkMode) {
        // Cada bloque (separado por --- en su propia línea) es una noticia.
        // Primera línea de cada bloque = URL del post; el resto = contenido.
        const blocks = raw.split(/^\s*---+\s*$/m).map(b => b.trim()).filter(Boolean);
        const items = [];
        const errors = [];

        blocks.forEach((block, i) => {
            const lines = block.split('\n');
            const firstLine = lines[0]?.trim() || '';
            const rest = lines.slice(1).join('\n').trim();

            if (!/^https?:\/\//i.test(firstLine)) {
                errors.push(`Bloque ${i + 1}: la primera línea debe ser un URL`);
                return;
            }
            if (!rest) {
                errors.push(`Bloque ${i + 1}: falta contenido tras el URL`);
                return;
            }
            items.push({ content: rest, category, outletId, sourceUrl: firstLine });
        });

        if (errors.length) {
            App.ui.toast(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} más)` : ''), 'error');
            return;
        }
        if (items.length === 0) {
            App.ui.toast('No se detectaron bloques válidos', 'warning'); return;
        }

        this.publish(items);
        App.ui.toast(`${items.length} noticias publicadas en lote`, 'success');
    } else {
        // Modo individual
        if (!sourceUrl) { App.ui.toast('La URL del post original es obligatoria', 'warning'); return; }
        if (!/^https?:\/\//i.test(sourceUrl)) { App.ui.toast('La URL debe empezar con http(s)://', 'warning'); return; }
        this.publish([{ content: raw.trim(), category, outletId, sourceUrl }]);
        App.ui.toast('Noticia publicada con su fuente original', 'success');
    }

    document.getElementById('paste-news-content').value = '';
    document.getElementById('paste-news-source').value = '';
    document.getElementById('paste-news-bulk').checked = false;
    document.getElementById('news-paste-modal').classList.add('hidden');
};

// Borra todas las noticias bot que NO tengan URL fuente verificable.
// Útil para limpiar plantillas inventadas de versiones anteriores.
App.news.purgeUnsourced = function () {
    if (!App.db.session || App.db.session.role !== 'admin') {
        App.ui.toast('Solo admin puede ejecutar esta limpieza', 'error');
        return;
    }
    const before = App.db.threads.length;
    App.db.threads = App.db.threads.filter(t => !t.isBot || t.sourceUrl);
    const removed = before - App.db.threads.length;
    App.db.save();
    App.ui.toast(`${removed} noticia(s) sin fuente eliminada(s)`, removed > 0 ? 'success' : 'info');
    if (App.ui.state.currentRoute === 'noticias' || App.ui.state.currentRoute === 'inicio') {
        App.ui.navigate(App.ui.state.currentRoute);
    }
};

// Captura datos de un Web Share Target. Cuando el usuario tiene la PWA instalada
// y comparte un post desde la app de Facebook (o cualquier app), Android/iOS abre
// la PWA con ?share_title=...&share_text=...&share_url=... en la URL. Detectamos
// esos parámetros, abrimos el modal de Repostear noticia y rellenamos los campos.
App.news.handleShareIntent = function () {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl   = params.get('share_url')   || '';
    const sharedText  = params.get('share_text')  || '';
    const sharedTitle = params.get('share_title') || '';
    if (!sharedUrl && !sharedText && !sharedTitle) return;

    // El usuario debe ser admin o medio para repostar
    if (!App.db.session || !['admin', 'media'].includes(App.db.session.role)) {
        App.ui.toast?.('Inicia sesión como admin/medio para repostear', 'warning');
        return;
    }

    // Algunas apps mandan la URL dentro del texto en lugar de en url=. Lo extraemos.
    let bodyText = sharedText;
    let urlGuess = sharedUrl;
    if (!urlGuess) {
        const m = bodyText.match(/https?:\/\/[^\s]+/);
        if (m) {
            urlGuess = m[0];
            bodyText = bodyText.replace(m[0], '').trim();
        }
    }

    App.news.populateOutletPicker();
    document.getElementById('news-paste-modal')?.classList.remove('hidden');

    // Pre-rellenar campos
    const srcInput = document.getElementById('paste-news-source');
    const txtArea  = document.getElementById('paste-news-content');
    if (srcInput && urlGuess) {
        srcInput.value = urlGuess;
        App.news.autodetectOutlet(urlGuess);
    }
    if (txtArea) {
        const title = sharedTitle ? sharedTitle.trim() : '';
        txtArea.value = title && bodyText ? `${title}\n\n${bodyText}` : (bodyText || title);
    }

    // Limpiar la URL para que no quede el ?share_url=... en la barra de direcciones
    if (window.history?.replaceState) {
        const clean = window.location.origin + window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, clean);
    }

    App.ui.toast?.('Texto compartido detectado · revisa y publica', 'info');
};

// Llena el dropdown de outlets + botones de acceso directo a sus páginas de FB.
App.news.populateOutletPicker = function () {
    const sel = document.getElementById('paste-news-outlet');
    const quick = document.getElementById('news-paste-outlet-quick');
    const verified = (App.db.outlets || []).filter(o => o.verified);

    if (sel) {
        sel.innerHTML = verified
            .map(o => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)}</option>`).join('');
    }
    if (quick) {
        quick.innerHTML = verified.map(o => {
            const isFb = (o.type === 'facebook') || /facebook\.com/i.test(o.url || '');
            const icon = isFb ? 'fa-facebook' : 'fa-globe';
            return `<a class="news-paste-quick-btn" href="${escapeHtml(o.url)}" target="_blank" rel="noopener" data-outlet="${escapeHtml(o.id)}">
                <i class="fab ${icon}"></i> ${escapeHtml(o.name)}
                <span class="news-paste-quick-hint">Abrir →</span>
            </a>`;
        }).join('');
    }
    // Reset campos al abrir
    const info = document.getElementById('paste-detect-info');
    if (info) info.textContent = '';
};

// Detecta el outlet a partir de la URL pegada y selecciona el dropdown.
App.news.autodetectOutlet = function (url) {
    const info = document.getElementById('paste-detect-info');
    const sel = document.getElementById('paste-news-outlet');
    if (!url || !sel) { if (info) info.textContent = ''; return; }
    if (!/^https?:\/\//i.test(url)) {
        if (info) { info.textContent = '⚠ La URL debe empezar con http(s)://'; info.className = 'news-paste-hint warning'; }
        return;
    }
    const lower = url.toLowerCase();
    const match = (App.db.outlets || []).find(o => {
        if (!o.url) return false;
        // Coincide si comparte el slug del path o el host
        try {
            const ouHost = new URL(o.url).hostname;
            const inHost = new URL(url).hostname;
            if (ouHost && inHost && ouHost === inHost) {
                // Comparar segmento del path (ej: /laretro3valles/)
                const slug = (o.url.match(/facebook\.com\/(?:p\/)?([^/?]+)/i) || [])[1] || '';
                return slug && lower.includes(slug.toLowerCase());
            }
        } catch (_) {}
        // Heurística por palabras clave
        if (/laretro/i.test(o.id) && /laretro/i.test(lower)) return true;
        if (/canero/i.test(o.id) && /(ca[%c3a1]+ero|canero)/i.test(lower)) return true;
        return false;
    });
    if (match) {
        sel.value = match.id;
        if (info) {
            info.innerHTML = `<i class="fas fa-circle-check"></i> Detectado: <b>${escapeHtml(match.name)}</b>`;
            info.className = 'news-paste-hint success';
        }
    } else {
        if (info) {
            info.innerHTML = `<i class="fas fa-circle-info"></i> Outlet no detectado automáticamente — selecciónalo manualmente abajo.`;
            info.className = 'news-paste-hint';
        }
    }
};

// Pega el contenido del portapapeles directo en el textarea (1 click).
App.news.pasteFromClipboard = async function () {
    if (!navigator.clipboard?.readText) {
        App.ui.toast('Tu navegador no permite pegar automático · usa Ctrl+V', 'warning');
        return;
    }
    try {
        const text = await navigator.clipboard.readText();
        if (!text) { App.ui.toast('Portapapeles vacío', 'info'); return; }
        const ta = document.getElementById('paste-news-content');
        if (ta) {
            ta.value = text;
            ta.dispatchEvent(new Event('input'));
        }
        // Si la primera línea parece URL, la metemos en el campo source automáticamente
        const firstLine = text.split('\n')[0]?.trim() || '';
        if (/^https?:\/\/.+/.test(firstLine)) {
            const src = document.getElementById('paste-news-source');
            if (src && !src.value) {
                src.value = firstLine;
                App.news.autodetectOutlet(firstLine);
                // Quitar la URL del textarea
                ta.value = text.split('\n').slice(1).join('\n').trim();
            }
        }
        App.ui.toast('Texto pegado del portapapeles', 'success');
    } catch (e) {
        App.ui.toast('No se pudo leer el portapapeles · usa Ctrl+V', 'warning');
        console.warn('[news] clipboard:', e);
    }
};

// ============================================================
// MÓDULO: PRESENCE (estado online estilo Discord)
// ============================================================
// Mantiene un heartbeat que actualiza profiles.last_seen cada 60s.
// Permite cambiar online_status (online/away/busy/invisible/offline)
// y custom_status (emoji + texto). Otros clientes ven el estado al
// renderizar la pfp.
App.presence = {
    HEARTBEAT_MS: 60_000,
    ONLINE_THRESHOLD_MS: 90_000,
    _timer: null,

    isOnline(profile) {
        if (!profile) return false;
        if (profile.show_online_status === false) return false;
        if (profile.online_status === 'invisible' || profile.online_status === 'offline') return false;
        if (!profile.last_seen) return false;
        const last = new Date(profile.last_seen).getTime();
        return (Date.now() - last) < this.ONLINE_THRESHOLD_MS;
    },

    statusFor(profile) {
        if (!profile || profile.show_online_status === false) return 'offline';
        const status = profile.online_status || 'online';
        if (status === 'invisible') return 'offline';
        if (!this.isOnline(profile) && status !== 'offline') return 'offline';
        return status;
    },

    async start() {
        if (!window.SB || !App.db.session) return;
        this.stop();
        await this._sendHeartbeat();
        this._timer = setInterval(() => this._sendHeartbeat(), this.HEARTBEAT_MS);

        // Heartbeat extra cuando el usuario vuelve al tab
        document.addEventListener('visibilitychange', this._onVisibility);
        window.addEventListener('focus', this._onFocus);
    },

    stop() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        document.removeEventListener('visibilitychange', this._onVisibility);
        window.removeEventListener('focus', this._onFocus);
    },

    _onVisibility: () => {
        if (document.visibilityState === 'visible') App.presence._sendHeartbeat();
    },
    _onFocus: () => App.presence._sendHeartbeat(),

    async _sendHeartbeat() {
        if (!window.SB || !App.db.session) return;
        try {
            await SB.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', App.db.session.id);
        } catch (e) { console.warn('[presence] heartbeat:', e); }
    },

    async setOnlineStatus(status) {
        if (!window.SB || !App.db.session) return false;
        if (!['online','away','busy','invisible','offline'].includes(status)) return false;
        const { error } = await SB.from('profiles').update({ online_status: status }).eq('id', App.db.session.id);
        if (error) { console.error('[presence] setOnlineStatus:', error); return false; }
        App.db.session.online_status = status;
        App.db.save();
        App.ui.refreshStatusUI?.();
        return true;
    },

    async setShowOnline(show) {
        if (!window.SB || !App.db.session) return false;
        const { error } = await SB.from('profiles').update({ show_online_status: !!show }).eq('id', App.db.session.id);
        if (error) { console.error('[presence] setShowOnline:', error); return false; }
        App.db.session.show_online_status = !!show;
        App.db.save();
        App.ui.refreshStatusUI?.();
        return true;
    },

    async setCustomStatus(emoji, text) {
        if (!window.SB || !App.db.session) return false;
        const e = (emoji || '').slice(0, 8);
        const t = (text || '').slice(0, 100);
        const { error } = await SB.from('profiles').update({
            custom_status_emoji: e, custom_status: t
        }).eq('id', App.db.session.id);
        if (error) { console.error('[presence] setCustomStatus:', error); return false; }
        App.db.session.custom_status_emoji = e;
        App.db.session.custom_status = t;
        App.db.save();
        App.ui.refreshStatusUI?.();
        return true;
    },

    async clearCustomStatus() {
        return this.setCustomStatus('', '');
    }
};

// ============================================================
// MÓDULO: AMISTAD (friend_requests + Supabase realtime)
// ============================================================
// Modelo: tabla `friend_requests(from_user_id, to_user_id, status)`.
// "Amigos" = un row con status='accepted' en cualquier dirección.
// RPCs `send_friend_request`, `accept_friend_request`, `reject_friend_request`
// hacen los writes; las RLS garantizan que solo el receptor pueda aceptar.
// ============================================================
App.friends = {
    state: {
        // Cache: { incomingPending: [], outgoingPending: [], friends: [] }
        incomingPending: [],
        outgoingPending: [],
        friends: [],
        _sub: null
    },

    // Carga las 3 listas (entrantes, salientes, amigos)
    async refresh() {
        if (!window.SB || !App.db.session) {
            this.state.incomingPending = [];
            this.state.outgoingPending = [];
            this.state.friends = [];
            return;
        }
        const me = App.db.session.id;
        const { data, error } = await SB.from('friend_requests')
            .select('id, from_user_id, to_user_id, status, created_at, responded_at')
            .or(`from_user_id.eq.${me},to_user_id.eq.${me}`)
            .order('created_at', { ascending: false });
        if (error) { console.error('[friends] refresh:', error); return; }

        this.state.incomingPending = (data || []).filter(r => r.status === 'pending' && r.to_user_id === me);
        this.state.outgoingPending = (data || []).filter(r => r.status === 'pending' && r.from_user_id === me);
        this.state.friends = (data || []).filter(r => r.status === 'accepted');
    },

    // ¿Soy amigo del usuario id?
    isFriend(userId) {
        if (!App.db.session) return false;
        const me = App.db.session.id;
        return this.state.friends.some(r =>
            (r.from_user_id === me && r.to_user_id === userId) ||
            (r.to_user_id === me && r.from_user_id === userId)
        );
    },

    // ¿Hay solicitud pendiente que YO envié al usuario id?
    hasOutgoingTo(userId) {
        return this.state.outgoingPending.some(r => r.to_user_id === userId);
    },

    // ¿Hay solicitud pendiente que ese usuario ME envió?
    hasIncomingFrom(userId) {
        return this.state.incomingPending.some(r => r.from_user_id === userId);
    },

    // Lista de IDs de amigos (para el resto de UI)
    getFriendIds() {
        if (!App.db.session) return [];
        const me = App.db.session.id;
        return this.state.friends.map(r => r.from_user_id === me ? r.to_user_id : r.from_user_id);
    },

    // ----- ACCIONES -----
    async sendRequest(username) {
        if (!window.SB || !App.db.session) {
            App.ui.toast('Inicia sesión', 'warning'); return false;
        }
        const { data, error } = await SB.rpc('send_friend_request', { p_target_username: username });
        if (error) {
            console.error('[friends] sendRequest:', error);
            App.ui.toast('No se pudo enviar: ' + (error.message || 'error'), 'error');
            return false;
        }
        App.ui.toast(`Solicitud enviada a ${username}`, 'success');
        await this.refresh();
        App.ui.renderUnifiedSidebar?.();
        return true;
    },

    async accept(requestId) {
        if (!window.SB) return false;
        const { data, error } = await SB.rpc('accept_friend_request', { p_request_id: requestId });
        if (error) {
            App.ui.toast('Error al aceptar: ' + (error.message || ''), 'error');
            return false;
        }
        App.ui.toast('Solicitud aceptada', 'success');
        await this.refresh();
        App.ui.renderUnifiedSidebar?.();
        if (App.ui.state.currentRoute === 'red') App.ui.renderNetworkRoute(App.ui.state.networkTab || 'amigos');
        return true;
    },

    async reject(requestId) {
        if (!window.SB) return false;
        const { error } = await SB.rpc('reject_friend_request', { p_request_id: requestId });
        if (error) {
            App.ui.toast('Error al rechazar', 'error');
            return false;
        }
        App.ui.toast('Solicitud rechazada', 'info');
        await this.refresh();
        if (App.ui.state.currentRoute === 'red') App.ui.renderNetworkRoute(App.ui.state.networkTab || 'amigos');
        return true;
    },

    // Borra una amistad ya aceptada (usa la misma policy de DELETE)
    async removeFriend(userId) {
        if (!window.SB || !App.db.session) return false;
        const me = App.db.session.id;
        const row = this.state.friends.find(r =>
            (r.from_user_id === me && r.to_user_id === userId) ||
            (r.to_user_id === me && r.from_user_id === userId)
        );
        if (!row) return false;
        const { error } = await SB.from('friend_requests').delete().eq('id', row.id);
        if (error) { App.ui.toast('Error al eliminar amistad', 'error'); return false; }
        App.ui.toast('Amistad eliminada', 'info');
        await this.refresh();
        App.ui.renderUnifiedSidebar?.();
        if (App.ui.state.currentRoute === 'red') App.ui.renderNetworkRoute(App.ui.state.networkTab || 'amigos');
        return true;
    },

    // Suscripción realtime: cualquier cambio en friend_requests recarga las listas
    // y notifica al usuario si llegó una nueva solicitud.
    subscribeRealtime() {
        if (!window.SB || !App.db.session) return;
        if (this.state._sub) { try { this.state._sub.unsubscribe(); } catch (_) {} }

        const me = App.db.session.id;
        this.state._sub = SB.channel('friends-' + me)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, async (payload) => {
                const r = payload.new || payload.old;
                if (!r) return;
                // Solo nos importa si involucra al usuario actual
                if (r.from_user_id !== me && r.to_user_id !== me) return;

                await this.refresh();
                App.ui.renderUnifiedSidebar?.();
                if (App.ui.state.currentRoute === 'red') {
                    App.ui.renderNetworkRoute(App.ui.state.networkTab || 'amigos');
                }
                // Notificar si me llegó una nueva solicitud
                if (payload.eventType === 'INSERT' && r.to_user_id === me && r.status === 'pending') {
                    const sender = App.db.users.find(u => u.id === r.from_user_id);
                    App.ui.toast(`Nueva solicitud de amistad${sender ? ': ' + sender.name : ''}`, 'info');
                }
                // Notificar si aceptaron mi solicitud
                if (payload.eventType === 'UPDATE' && r.from_user_id === me && r.status === 'accepted') {
                    const friend = App.db.users.find(u => u.id === r.to_user_id);
                    App.ui.toast(`${friend ? friend.name : 'Alguien'} aceptó tu solicitud · ya pueden chatear`, 'success');
                }
            })
            .subscribe();
    }
};

// ============================================================
// MÓDULO: CHAT PRIVADO (Phase B)
// Mensajería 1-a-1 entre usuarios usando la tabla `messages` de
// Supabase. Realtime para nuevos mensajes. RLS en BD garantiza
// que solo emisor y receptor vean cada mensaje.
// ============================================================
App.chat = {
    state: {
        open: false,
        view: 'list',       // 'list' | 'thread'
        peerId: null,        // id del usuario con el que se conversa
        peerName: '',        // nombre cacheado para el header del thread
        peerPfp: '',
        conversations: [],   // [{ peerId, peerName, peerPfp, lastMessage, lastAt, unread }]
        messages: [],        // mensajes del thread abierto, asc por created_at
        unreadTotal: 0,      // sumatoria global para el badge
        sub: null
    },

    // ---------- UI: panel ----------
    openPanel() {
        if (!App.db.session) { App.ui.toast('Inicia sesión para usar el chat', 'warning'); App.ui.openAuth?.(); return; }
        if (!window.SB) { App.ui.toast('Supabase no disponible', 'error'); return; }
        this.state.open = true;
        this.state.view = 'list';
        this._ensureModal();
        this._render();
        this.refreshConversations();
    },

    closePanel() {
        this.state.open = false;
        document.getElementById('chat-modal')?.classList.add('hidden');
    },

    _ensureModal() {
        let modal = document.getElementById('chat-modal');
        if (modal) { modal.classList.remove('hidden'); return modal; }
        modal = document.createElement('div');
        modal.id = 'chat-modal';
        modal.className = 'modal hidden';
        /* Modal NO cierra al click fuera — solo el botón X. */
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        return modal;
    },

    _render() {
        const modal = document.getElementById('chat-modal');
        if (!modal) return;
        const view = this.state.view;
        if (view === 'list') modal.innerHTML = this._renderListHTML();
        else modal.innerHTML = this._renderThreadHTML();

        if (view === 'thread') {
            // autoscroll al fondo
            requestAnimationFrame(() => {
                const wrap = document.querySelector('.chat-messages');
                if (wrap) wrap.scrollTop = wrap.scrollHeight;
                document.getElementById('chat-input')?.focus();
            });
        }
    },

    _renderListHTML() {
        const convs = this.state.conversations;
        const list = convs.length === 0
            ? `<div class="chat-empty"><i class="fas fa-comments"></i><p>Aún no tienes conversaciones</p>
                  <small>Abre el perfil de cualquier usuario y pulsa "Mensaje" para escribirle.</small></div>`
            : convs.map(c => `
                <div class="chat-conv-item ${c.unread > 0 ? 'has-unread' : ''}" onclick="App.chat.openWith('${c.peerId}', ${JSON.stringify(c.peerName).replace(/"/g, '&quot;')}, ${JSON.stringify(c.peerPfp).replace(/"/g, '&quot;')})">
                    <img class="chat-conv-pfp" src="${escapeHtml(c.peerPfp || DEFAULT_PFP)}" alt="">
                    <div class="chat-conv-body">
                        <div class="chat-conv-top">
                            <b class="chat-conv-name">${escapeHtml(c.peerName)}</b>
                            <small class="chat-conv-time">${App.ui.timeAgo(c.lastAt)}</small>
                        </div>
                        <p class="chat-conv-preview">${escapeHtml((c.lastMessage || '').slice(0, 60))}${(c.lastMessage || '').length > 60 ? '…' : ''}</p>
                    </div>
                    ${c.unread > 0 ? `<span class="chat-unread-dot">${c.unread > 9 ? '9+' : c.unread}</span>` : ''}
                </div>`).join('');

        return `
            <div class="modal-content chat-modal-content">
                <button class="close-btn" onclick="App.chat.closePanel()" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                <h2 class="chat-title"><i class="fas fa-message"></i> Mensajes</h2>
                <p class="chat-subtitle">Conversaciones privadas — solo tú y la otra persona pueden verlas.</p>
                <div class="chat-list">${list}</div>
            </div>`;
    },

    _renderThreadHTML() {
        const msgs = this.state.messages;
        const myId = App.db.session?.id;
        const html = msgs.length === 0
            ? `<div class="chat-empty-thread"><i class="fas fa-feather"></i><p>Aún no hay mensajes. Empieza la conversación.</p></div>`
            : msgs.map(m => {
                const mine = String(m.sender_id) === String(myId);
                const cls = mine ? 'mine' : 'theirs';
                const t = new Date(m.created_at);
                const time = t.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                return `<div class="chat-msg ${cls}">
                    <div class="chat-msg-bubble">${escapeHtml(m.content)}</div>
                    <small class="chat-msg-time">${time}</small>
                </div>`;
            }).join('');

        return `
            <div class="modal-content chat-modal-content">
                <button class="close-btn" onclick="App.chat.closePanel()" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                <div class="chat-thread-header">
                    <button class="chat-back" onclick="App.chat.backToList()" title="Volver"><i class="fas fa-arrow-left"></i></button>
                    <img class="chat-thread-pfp" src="${escapeHtml(this.state.peerPfp || DEFAULT_PFP)}" alt="">
                    <div>
                        <b class="chat-thread-name">${escapeHtml(this.state.peerName)}</b>
                        <small>Conversación privada</small>
                    </div>
                </div>
                <div class="chat-messages">${html}</div>
                <form class="chat-form" onsubmit="event.preventDefault(); App.chat.sendCurrent();">
                    <input type="text" id="chat-input" placeholder="Escribe un mensaje…" maxlength="2000" autocomplete="off">
                    <button type="submit" class="chat-send-btn" title="Enviar"><i class="fas fa-paper-plane"></i></button>
                </form>
            </div>`;
    },

    // Abre el thread con un usuario concreto (desde lista o desde perfil)
    async openWith(peerId, peerName, peerPfp) {
        if (!App.db.session) return;
        if (!window.SB) return;
        this.state.view = 'thread';
        this.state.peerId = peerId;
        this.state.peerName = peerName || '';
        this.state.peerPfp = peerPfp || '';
        this.state.messages = [];
        this._ensureModal();
        this.state.open = true;
        this._render();

        await this._loadMessages(peerId);
        await this._markIncomingRead(peerId);
        this._render();
    },

    backToList() {
        this.state.view = 'list';
        this.state.peerId = null;
        this._render();
        this.refreshConversations();
    },

    async _loadMessages(peerId) {
        const myId = App.db.session.id;
        const { data, error } = await SB.from('messages')
            .select('id, sender_id, recipient_id, content, read, created_at')
            .or(`and(sender_id.eq.${myId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${myId})`)
            .order('created_at', { ascending: true })
            .limit(500);
        if (error) { console.error('[chat] load:', error); return; }
        this.state.messages = data || [];
    },

    async _markIncomingRead(peerId) {
        const myId = App.db.session.id;
        await SB.from('messages').update({ read: true })
            .eq('sender_id', peerId).eq('recipient_id', myId).eq('read', false);
        this.refreshUnreadBadge();
    },

    async sendCurrent() {
        const input = document.getElementById('chat-input');
        if (!input) return;
        const content = input.value.trim();
        if (!content) return;
        if (!this.state.peerId) return;
        if (!window.SB) return;

        // Render optimista
        const tmp = {
            id: 'tmp-' + Date.now(),
            sender_id: App.db.session.id,
            recipient_id: this.state.peerId,
            content, read: false,
            created_at: new Date().toISOString(),
            _pending: true
        };
        this.state.messages.push(tmp);
        input.value = '';
        this._render();

        const { data, error } = await SB.from('messages').insert({
            sender_id: App.db.session.id,
            recipient_id: this.state.peerId,
            content
        }).select().single();

        if (error) {
            console.error('[chat] send:', error);
            App.ui.toast('No se pudo enviar el mensaje', 'error');
            // Revertir
            this.state.messages = this.state.messages.filter(m => m.id !== tmp.id);
            this._render();
            return;
        }
        // Reemplazar tmp por la fila real
        const idx = this.state.messages.findIndex(m => m.id === tmp.id);
        if (idx >= 0) this.state.messages[idx] = data;
        this._render();
    },

    // ---------- LISTA DE CONVERSACIONES + BADGE ----------
    async refreshConversations() {
        if (!App.db.session || !window.SB) return;
        const myId = App.db.session.id;
        const { data, error } = await SB.from('messages')
            .select('id, sender_id, recipient_id, content, read, created_at')
            .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
            .order('created_at', { ascending: false })
            .limit(500);
        if (error) { console.error('[chat] convs:', error); return; }

        // Agrupar por peer
        const byPeer = new Map();
        for (const m of data || []) {
            const peer = String(m.sender_id) === String(myId) ? m.recipient_id : m.sender_id;
            if (!byPeer.has(peer)) byPeer.set(peer, { lastMessage: m.content, lastAt: m.created_at, unread: 0 });
            const slot = byPeer.get(peer);
            if (!m.read && String(m.recipient_id) === String(myId)) slot.unread++;
        }
        const peerIds = [...byPeer.keys()];
        let peerProfiles = [];
        if (peerIds.length) {
            const { data: profs } = await SB.from('profiles')
                .select('id, username, pfp')
                .in('id', peerIds);
            peerProfiles = profs || [];
        }
        const conversations = peerIds.map(pid => {
            const p = peerProfiles.find(pp => String(pp.id) === String(pid));
            const slot = byPeer.get(pid);
            return {
                peerId: pid,
                peerName: p?.username || 'Usuario',
                peerPfp: p?.pfp || DEFAULT_PFP,
                lastMessage: slot.lastMessage,
                lastAt: slot.lastAt,
                unread: slot.unread
            };
        }).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

        this.state.conversations = conversations;
        this.state.unreadTotal = conversations.reduce((s, c) => s + c.unread, 0);
        this.refreshUnreadBadge();
        if (this.state.open && this.state.view === 'list') this._render();
    },

    refreshUnreadBadge() {
        const total = this.state.unreadTotal;
        const badge = document.getElementById('chat-badge');
        if (!badge) return;
        if (total > 0) {
            badge.textContent = total > 99 ? '99+' : String(total);
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    },

    // ---------- REALTIME ----------
    subscribeRealtime() {
        if (!window.SB || !App.db.session) return;
        if (this.state.sub) { try { this.state.sub.unsubscribe(); } catch (_) {} }
        const myId = App.db.session.id;
        const ch = SB.channel('tv-chat')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
                const m = payload.new;
                // Solo nos interesa si nos involucra
                if (String(m.sender_id) !== String(myId) && String(m.recipient_id) !== String(myId)) return;
                const peer = String(m.sender_id) === String(myId) ? m.recipient_id : m.sender_id;

                // Si está abierto el thread con ese peer, anexar
                if (this.state.view === 'thread' && String(this.state.peerId) === String(peer)) {
                    if (!this.state.messages.find(x => x.id === m.id)) {
                        this.state.messages.push(m);
                        this._render();
                        // Si soy receptor, marcar como leído al ver
                        if (String(m.recipient_id) === String(myId)) await this._markIncomingRead(peer);
                    }
                } else if (String(m.recipient_id) === String(myId)) {
                    // Mensaje nuevo entrante en otra conversación
                    App.ui.toast?.('Nuevo mensaje', 'info');
                }
                // Refrescar lista global y badge
                this.refreshConversations();
            })
            .subscribe();
        this.state.sub = ch;
    }
};

// ========== MÓDULO 12: PALETA DE COMANDOS (Ctrl+K) ==========
// Usa los elementos #command-palette / #cp-input / #cp-results ya presentes en index.html.
App.commandPalette = {
    state: { open: false, items: [], cursor: 0 },

    open() {
        const overlay = document.getElementById('command-palette');
        const input = document.getElementById('cp-input');
        if (!overlay || !input) return;
        overlay.classList.remove('hidden');
        input.value = '';
        this.state.open = true;
        this.render('');
        setTimeout(() => input.focus(), 30);
    },

    close() {
        const overlay = document.getElementById('command-palette');
        if (!overlay) return;
        overlay.classList.add('hidden');
        this.state.open = false;
    },

    render(query) {
        const results = document.getElementById('cp-results');
        if (!results) return;

        const routes = [
            { type: 'route', icon: 'fa-home',       label: 'Ir a Inicio',         action: () => App.ui.navigate('inicio') },
            { type: 'route', icon: 'fa-comments',   label: 'Ir al Foro',          action: () => App.ui.navigate('foro') },
            { type: 'route', icon: 'fa-bell',       label: 'Notificaciones',      action: () => App.ui.navigate('notificaciones') },
            { type: 'route', icon: 'fa-newspaper',  label: 'Noticias',            action: () => App.ui.navigate('noticias') },
            { type: 'route', icon: 'fa-user-group', label: 'Mi Red',              action: () => App.ui.navigate('red') },
            { type: 'route', icon: 'fa-mountain',   label: 'Explora Tres Valles', action: () => App.ui.navigate('explora') },
            { type: 'action', icon: 'fa-pen-to-square', label: 'Crear publicación', action: () => App.ui.openEditor() },
            { type: 'action', icon: 'fa-gear',       label: 'Configuración',       action: () => App.ui.openSettings() }
        ];

        const q = (query || '').trim().toLowerCase();
        let items = q
            ? routes.filter(r => r.label.toLowerCase().includes(q))
            : routes.slice();

        if (q) {
            const r = App.search.execute(q);
            r.users.slice(0, 5).forEach(u => items.push({
                type: 'user',
                icon: 'fa-user',
                label: `${u.name}`,
                sub: u.bio || '',
                action: () => { App.commandPalette.close(); App.ui.openUserFromSearch(u.id); }
            }));
            r.threads.slice(0, 5).forEach(t => items.push({
                type: 'thread',
                icon: 'fa-comment-dots',
                label: App.search.snippet(t.content, q, 60).replace(/<[^>]+>/g, ''),
                sub: `por ${t.author || 'Anónimo'}`,
                action: () => { App.commandPalette.close(); App.ui.openThreadFromSearch(t.id); }
            }));
            r.businesses.slice(0, 3).forEach(b => items.push({
                type: 'biz',
                icon: 'fa-store',
                label: b.name,
                sub: `${b.category} · ${b.address}`,
                action: () => { App.commandPalette.close(); App.ui.navigate('explora'); }
            }));
        }

        this.state.items = items;
        this.state.cursor = 0;

        if (!items.length) {
            results.innerHTML = `<div class="cp-empty" style="padding:18px;color:var(--text-muted);text-align:center;">Sin resultados</div>`;
            return;
        }

        results.innerHTML = items.map((it, idx) => `
            <div class="cp-item${idx === 0 ? ' active' : ''}" data-idx="${idx}" role="option">
                <i class="fas ${escapeHtml(it.icon)}"></i>
                <div class="cp-item-text">
                    <div class="cp-item-label">${escapeHtml(it.label)}</div>
                    ${it.sub ? `<div class="cp-item-sub">${escapeHtml(it.sub)}</div>` : ''}
                </div>
                <span class="cp-item-type">${escapeHtml(it.type)}</span>
            </div>
        `).join('');

        results.querySelectorAll('.cp-item').forEach(el => {
            el.addEventListener('mouseenter', () => {
                results.querySelectorAll('.cp-item').forEach(x => x.classList.remove('active'));
                el.classList.add('active');
                this.state.cursor = parseInt(el.dataset.idx, 10) || 0;
            });
            el.addEventListener('click', () => this.activate());
        });
    },

    move(delta) {
        if (!this.state.items.length) return;
        const n = this.state.items.length;
        this.state.cursor = (this.state.cursor + delta + n) % n;
        const results = document.getElementById('cp-results');
        results?.querySelectorAll('.cp-item').forEach((el, i) => {
            el.classList.toggle('active', i === this.state.cursor);
            if (i === this.state.cursor) el.scrollIntoView({ block: 'nearest' });
        });
    },

    activate() {
        const it = this.state.items[this.state.cursor];
        if (!it) return;
        try { it.action(); } catch (e) { console.error('[CP] action error:', e); }
        this.close();
    }
};

// ========== AUDIO ENGINE (Web Audio compartido) ==========
function getAudioCtx() {
    if (window._tvAudio) return window._tvAudio;
    try {
        window._tvAudio = new (window.AudioContext || window['webkitAudioContext'])();
        return window._tvAudio;
    } catch (_) { return null; }
}

// Tick rápido tipo Xbox para navegación de sidebar (~120ms)
function playUiTick() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.06);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.13);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.14);

    // Capa de armónico para riqueza tonal
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'triangle';
    o2.frequency.value = 1760;
    g2.gain.setValueAtTime(0, ctx.currentTime);
    g2.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.10);
    o2.connect(g2).connect(ctx.destination);
    o2.start();
    o2.stop(ctx.currentTime + 0.11);
}

// SONIDO DE BIENVENIDA (sintético, Web Audio)
// 5 variaciones: xilófono, piano, guitarra, campanas, marimba.
function playWelcomeChime() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const variants = {
        xylophone: { type: 'triangle', attack: 0.005, decay: 0.45, harmonic: 2,   harmonicGain: 0.10, melody: [523.25, 659.25, 783.99, 1046.50] },
        piano:     { type: 'triangle', attack: 0.012, decay: 0.85, harmonic: 1.5, harmonicGain: 0.08, melody: [261.63, 329.63, 392.00, 493.88] },
        guitar:    { type: 'sawtooth', attack: 0.005, decay: 0.7,  harmonic: 1,   harmonicGain: 0,    melody: [196.00, 246.94, 329.63, 392.00] },
        bells:     { type: 'sine',     attack: 0.01,  decay: 1.6,  harmonic: 3,   harmonicGain: 0.12, melody: [392.00, 523.25, 659.25, 783.99] },
        marimba:   { type: 'triangle', attack: 0.006, decay: 0.55, harmonic: 1.5, harmonicGain: 0.06, melody: [261.63, 311.13, 415.30, 523.25] }
    };
    const keys = Object.keys(variants);
    const variant = variants[keys[Math.floor(Math.random() * keys.length)]];

    const playNote = (freq, time) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = variant.type;
        osc.frequency.value = freq;
        const now = ctx.currentTime + time;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.22, now + variant.attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + variant.decay);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + variant.decay + 0.05);

        if (variant.harmonicGain > 0) {
            const o2 = ctx.createOscillator();
            const g2 = ctx.createGain();
            o2.type = 'sine';
            o2.frequency.value = freq * variant.harmonic;
            g2.gain.setValueAtTime(0, now);
            g2.gain.linearRampToValueAtTime(variant.harmonicGain, now + variant.attack);
            g2.gain.exponentialRampToValueAtTime(0.0001, now + variant.decay);
            o2.connect(g2).connect(ctx.destination);
            o2.start(now);
            o2.stop(now + variant.decay + 0.05);
        }
    };

    const interval = 0.13;
    variant.melody.forEach((n, i) => playNote(n, i * interval));
}

// ============================================================
// MOBILE SIGMA — auto-hide del header + bottom-nav al scrollear hacia abajo
// (estilo Twitter/Instagram: el chrome se aparta cuando lees, vuelve cuando subes)
// ============================================================
function setupMobileScrollChrome() {
    if (window.innerWidth > 768) return;  // solo en móvil

    let lastY = window.scrollY;
    let lastDirection = 0;
    let ticking = false;
    const TRIGGER = 12;  // px de scroll para reaccionar

    function update() {
        const y = window.scrollY;
        const delta = y - lastY;

        if (Math.abs(delta) < TRIGGER) { ticking = false; return; }

        // Cerca del top: siempre visible
        if (y < 80) {
            document.body.classList.remove('nav-hidden');
        } else if (delta > 0 && lastDirection >= 0) {
            // scroll hacia abajo — ocultar
            document.body.classList.add('nav-hidden');
            lastDirection = 1;
        } else if (delta < 0 && lastDirection <= 0) {
            // scroll hacia arriba — mostrar
            document.body.classList.remove('nav-hidden');
            lastDirection = -1;
        }
        lastY = y;
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(update);
            ticking = true;
        }
    }, { passive: true });

    // Al cambiar de orientación, recalculamos
    window.addEventListener('orientationchange', () => {
        document.body.classList.remove('nav-hidden');
        lastY = window.scrollY;
    });
}

// ========== SPLASH SCREEN ==========
function setupSplash() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;
    const particles = splash.querySelector('.splash-particles');

    // Genera partículas flotantes interactivas
    for (let i = 0; i < 28; i++) {
        const p = document.createElement('span');
        p.className = 'splash-p';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        p.style.animationDelay = (Math.random() * 4) + 's';
        p.style.animationDuration = (4 + Math.random() * 4) + 's';
        particles.appendChild(p);
    }

    // Mueve partículas siguiendo el mouse (paralaje)
    splash.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 30;
        const y = (e.clientY / window.innerHeight - 0.5) * 30;
        particles.style.transform = `translate(${x}px, ${y}px)`;
    });

    let played = false;
    const dismiss = () => {
        if (!played) { try { playWelcomeChime(); } catch(_){} played = true; }
        splash.classList.add('splash-out');
        setTimeout(() => splash.remove(), 700);
        document.removeEventListener('keydown', dismiss);
    };

    splash.addEventListener('click', dismiss);
    document.addEventListener('keydown', dismiss);

    // Auto-dismiss después de 4.5s (sin sonido — autoplay bloqueado sin gesto)
    setTimeout(() => {
        if (!played) {
            splash.classList.add('splash-out');
            setTimeout(() => splash.remove(), 700);
        }
    }, 4500);
}

document.addEventListener('DOMContentLoaded', () => {
    setupSplash();
    setupMobileScrollChrome();
    App.init();

    // Toggle del sidebar (mobile/tablet)
    const toggleBtn = document.getElementById('toggle-sidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            App.ui.toggleSidebar();
        });
    }

    // Click fuera cierra sidebar SOLO en móvil (en desktop está fijo).
    document.addEventListener('click', (e) => {
        if (window.innerWidth >= 1024) return;
        const sidebar = document.getElementById('sidebar');
        if (!sidebar || sidebar.classList.contains('sidebar-hidden')) return;
        if (!sidebar.contains(e.target) && !toggleBtn?.contains(e.target)) {
            sidebar.classList.add('sidebar-hidden');
            document.body.classList.remove('sidebar-open');
        }
    });

    // Cerrar modales con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        ['auth-modal', 'settings-modal', 'thread-creator-modal', 'news-paste-modal'].forEach(id => {
            document.getElementById(id)?.classList.add('hidden');
        });
        if (App.commandPalette?.state?.open) App.commandPalette.close();
    });

    // Paleta de comandos: Ctrl/Cmd+K abre, navegación con flechas/Enter dentro del input.
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            App.commandPalette.open();
        }
    });
    const cpInput = document.getElementById('cp-input');
    if (cpInput) {
        cpInput.addEventListener('input', (e) => App.commandPalette.render(e.target.value));
        cpInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); App.commandPalette.move(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); App.commandPalette.move(-1); }
            else if (e.key === 'Enter') { e.preventDefault(); App.commandPalette.activate(); }
        });
    }

    // Las ventanas emergentes solo se cierran con su botón ✕ (no al click afuera).

    // Registro
    const regForm = document.getElementById('reg-form');
    if (regForm) {
        regForm.onsubmit = (e) => {
            e.preventDefault();
            App.auth.register();
        };
    }

    // Submit del editor (modo hilo o modo reply) — con logs y try/catch defensivos
    const submitThreadBtn = document.getElementById('submit-thread');
    if (!submitThreadBtn) {
        console.error('[Publicar] Botón #submit-thread NO encontrado en el DOM');
    } else {
        submitThreadBtn.addEventListener('click', () => {
            console.log('[Publicar] Click recibido');
            try {
                const body = document.getElementById('editor-body');
                if (!body) {
                    console.error('[Publicar] #editor-body no existe');
                    App.ui.toast('Editor no encontrado — recarga la página', 'error');
                    return;
                }
                if (!App.db.session) {
                    console.warn('[Publicar] sin sesión');
                    App.ui.toast('Debes iniciar sesión para publicar', 'warning');
                    App.ui.openAuth();
                    return;
                }

                const text = (body.innerText || '').trim();
                const html = body.innerHTML || '';
                const hasMedia = body.querySelector('img, video, iframe, .doc-attachment, .video-embed');
                console.log('[Publicar] text:', text.length, 'chars · media:', !!hasMedia, '· user:', App.db.session.name, '· mode:', App.editor.mode);

                if (!text && !hasMedia) {
                    App.ui.toast('Escribe algo o adjunta multimedia primero', 'warning');
                    body.focus();
                    return;
                }
                const cleanHtml = sanitizeRichHtml(html);

                if (App.editor.mode === 'reply' && App.editor.replyContext) {
                    const { threadId, parentCommentId } = App.editor.replyContext;
                    App.forum.addComment(threadId, cleanHtml, parentCommentId, true);
                    App.ui.closeEditor();
                    App.ui.toast('Respuesta publicada', 'success');
                } else {
                    const category = App.editor.targetCategory || 'general';
                    const notify = document.getElementById('notify-followers')?.checked || false;
                    console.log('[Publicar] creando hilo categoría:', category, '· notify:', notify);
                    const t = App.forum.createThread(cleanHtml, category, [], null, notify);
                    if (t) {
                        console.log('[Publicar] OK · id:', t.id);
                        App.ui.toast(category === 'noticias' ? 'Noticia publicada' : 'Publicación creada', 'success');
                    } else {
                        console.warn('[Publicar] createThread retornó undefined (revisa el toast de razón)');
                    }
                }
            } catch (err) {
                console.error('[Publicar] EXCEPCIÓN:', err);
                App.ui.toast('Error al publicar: ' + (err.message || err), 'error');
            }
        });
    }

    // Drag & drop de archivos al editor
    const editorBody = document.getElementById('editor-body');
    if (editorBody) {
        ['dragenter', 'dragover'].forEach(ev => {
            editorBody.addEventListener(ev, (e) => {
                e.preventDefault();
                e.stopPropagation();
                editorBody.classList.add('drag-over');
            });
        });
        ['dragleave', 'drop'].forEach(ev => {
            editorBody.addEventListener(ev, (e) => {
                e.preventDefault();
                e.stopPropagation();
                editorBody.classList.remove('drag-over');
            });
        });
        editorBody.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer?.files || []);
            files.forEach(f => App.editor.handleDroppedFile(f));
        });
        editorBody.addEventListener('paste', (e) => App.editor.handlePaste(e));
    }

    // Restaurar estado colapsado del sidebar
    if (localStorage.getItem('tv_sidebar_collapsed') === '1') {
        document.body.classList.add('sidebar-collapsed');
    }

    // Tema persistido
    if (App.db.themes) {
        App.settings.changeTheme(App.db.themes);
    }

    // ============ REGISTRO DE SERVICE WORKER (PWA) ============
    // KILL-SWITCH: si la URL tiene ?nosw=1, desregistra TODOS los SW y limpia caches.
    // Útil cuando un usuario queda atrapado con un SW viejo que no se actualiza.
    // También se ejecuta automáticamente con ?reset=1.
    if (location.search.includes('nosw=1') || location.search.includes('reset=1')) {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
                Promise.all(regs.map(r => r.unregister())).then(() => {
                    if ('caches' in window) {
                        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
                            .then(() => {
                                console.log('[KILL-SWITCH] SW + caches limpiados — recargando');
                                location.href = location.origin + location.pathname;
                            });
                    } else location.href = location.origin + location.pathname;
                });
            });
        }
        return; // No registrar SW nuevo en este load
    }

    // Solo en producción (no funciona en file://). Si no hay servidor,
    // navigator.serviceWorker existe pero registro fallará silenciosamente.
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(reg => {
                    console.log('[PWA] Service Worker registrado · scope:', reg.scope);
                    // Forzar update check en cada navegación (para que un deploy nuevo
                    // se detecte sin esperar a que pasen 24h)
                    reg.update().catch(() => {});
                    // Detecta una nueva versión y la activa de inmediato.
                    reg.addEventListener('updatefound', () => {
                        const sw = reg.installing;
                        if (!sw) return;
                        sw.addEventListener('statechange', () => {
                            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('[PWA] Nueva versión instalada — activando');
                                sw.postMessage({ type: 'SKIP_WAITING' });
                                App.ui?.toast?.('Nueva versión activa · próxima recarga la usa', 'info');
                            }
                        });
                    });
                    // Cuando el SW activo cambia (skipWaiting + claim), refrescamos para tomar la nueva
                    let refreshing = false;
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (refreshing) return;
                        refreshing = true;
                        // Reload silencioso para que el usuario vea la nueva versión
                        setTimeout(() => location.reload(), 500);
                    });
                })
                .catch(err => console.warn('[PWA] SW no registrado:', err.message));
        });
    }
});
