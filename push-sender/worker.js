/**
 * Tres Valles · Push Sender Worker
 * ---------------------------------
 * Cron por minuto: lee notificaciones no enviadas (`pushed_at IS NULL`)
 * de los últimos 5 min, busca suscripciones del destinatario y envía
 * Web Push VAPID a cada una. Limpia endpoints inválidos (410/404).
 *
 * Antes de desplegar, en Supabase:
 *   ALTER TABLE notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;
 *
 * Deploy:
 *   wrangler login
 *   wrangler secret put SUPABASE_SERVICE_KEY    (service_role key)
 *   wrangler secret put VAPID_PUBLIC_KEY        (base64url 65 bytes / 87 chars)
 *   wrangler secret put VAPID_PRIVATE_KEY       (base64url 32 bytes / 43 chars)
 *   wrangler deploy
 *
 * Genera VAPID con: npx web-push generate-vapid-keys
 */

const TYPE_COPY = {
    follow:      { title: 'Nuevo seguidor',    body: '@{actor} te empezó a seguir' },
    like_thread: { title: 'Nuevo like',        body: 'A @{actor} le gustó tu hilo' },
    like:        { title: 'Nuevo like',        body: 'A @{actor} le gustó tu hilo' },
    comment:     { title: 'Nuevo comentario',  body: '@{actor} comentó en tu hilo' },
    mention:     { title: 'Te mencionaron',    body: '@{actor} te mencionó' },
    dm:          { title: 'Nuevo mensaje',     body: '@{actor} te escribió por DM' },
    reaction:    { title: 'Nueva reacción',    body: '@{actor} reaccionó a tu hilo' },
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (url.pathname === '/run') {
            const result = await runJob(env);
            return new Response(JSON.stringify(result, null, 2), {
                headers: { 'content-type': 'application/json' },
            });
        }
        return new Response('Tres Valles push sender · cron por minuto.', {
            headers: { 'content-type': 'text/plain' },
        });
    },
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runJob(env));
    },
};

async function runJob(env) {
    const stats = { fetched: 0, sent: 0, failed: 0, dropped: 0, errors: [] };
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const notifsRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/notifications?select=*,actor:actor_id(username)&pushed_at=is.null&created_at=gte.${since}&limit=100`,
        { headers: sbHeaders(env) },
    );
    if (!notifsRes.ok) { stats.errors.push(`fetch notifs: ${notifsRes.status}`); return stats; }
    const notifs = await notifsRes.json();
    stats.fetched = notifs.length;
    if (notifs.length === 0) return stats;

    for (const n of notifs) {
        try {
            const subsRes = await fetch(
                `${env.SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${n.recipient_id}&select=*`,
                { headers: sbHeaders(env) },
            );
            const subs = await subsRes.json();
            if (!Array.isArray(subs) || subs.length === 0) {
                await markPushed(env, n.id);
                continue;
            }
            const tpl = TYPE_COPY[n.type] || { title: 'Tres Valles', body: 'Nueva actividad' };
            const actor = (n.actor && n.actor.username) || 'alguien';
            const payload = JSON.stringify({
                title: tpl.title,
                body: tpl.body.replaceAll('{actor}', actor),
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                tag: `tv-${n.type}-${n.target_id || n.id}`,
                url: targetUrlFor(n),
                type: n.type,
            });
            for (const sub of subs) {
                const subscription = {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth_key },
                };
                try {
                    await sendWebPush(subscription, payload, env);
                    stats.sent++;
                } catch (e) {
                    stats.failed++;
                    stats.errors.push(`push ${sub.endpoint.slice(0, 40)}: ${e.message}`);
                    if (e.status === 410 || e.status === 404) {
                        await fetch(`${env.SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
                            method: 'DELETE',
                            headers: sbHeaders(env),
                        });
                        stats.dropped++;
                    }
                }
            }
            await markPushed(env, n.id);
        } catch (e) {
            stats.errors.push(`notif ${n.id}: ${e.message}`);
        }
    }
    return stats;
}

function sbHeaders(env) {
    return {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
    };
}

async function markPushed(env, notifId) {
    await fetch(`${env.SUPABASE_URL}/rest/v1/notifications?id=eq.${notifId}`, {
        method: 'PATCH',
        headers: { ...sbHeaders(env), Prefer: 'return=minimal' },
        body: JSON.stringify({ pushed_at: new Date().toISOString() }),
    });
}

function targetUrlFor(n) {
    if (n.type === 'dm') return `/chat?c=${n.target_id}`;
    if (n.target_type === 'thread' && n.target_id) return `/hilo?id=${n.target_id}`;
    return '/';
}

/* ─────────────────────── VAPID Web Push (RFC 8030 + 8291) ─────────────────────── */

async function sendWebPush(subscription, payload, env) {
    const endpoint = subscription.endpoint;
    const audience = new URL(endpoint).origin;
    const jwt = await signVapidJWT(audience, env.VAPID_SUBJECT, env);
    const encrypted = await encryptPayload(payload, subscription.keys);
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': '86400',
            'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
        },
        body: encrypted,
    });
    if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return true;
}

async function signVapidJWT(audience, subject, env) {
    const header = { typ: 'JWT', alg: 'ES256' };
    const payload = {
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: subject,
    };
    const b64h = b64urlStr(JSON.stringify(header));
    const b64p = b64urlStr(JSON.stringify(payload));
    const unsigned = `${b64h}.${b64p}`;

    const privKey = await importVapidPrivateKey(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    const sig = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        privKey,
        new TextEncoder().encode(unsigned),
    );
    return `${unsigned}.${b64urlBytes(new Uint8Array(sig))}`;
}

async function importVapidPrivateKey(pubB64, privB64) {
    const pub = b64urlDecode(pubB64);
    if (pub.length !== 65 || pub[0] !== 0x04) {
        throw new Error('VAPID_PUBLIC_KEY debe ser 65 bytes uncompressed (0x04|X|Y) base64url');
    }
    const x = pub.slice(1, 33);
    const y = pub.slice(33, 65);
    const d = b64urlDecode(privB64);
    return await crypto.subtle.importKey(
        'jwk',
        {
            kty: 'EC', crv: 'P-256',
            x: b64urlBytes(x),
            y: b64urlBytes(y),
            d: b64urlBytes(d),
            ext: true,
        },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign'],
    );
}

async function encryptPayload(payload, subKeys) {
    const data = new TextEncoder().encode(payload);
    const recipientPub = b64urlDecode(subKeys.p256dh);
    const authSecret = b64urlDecode(subKeys.auth);

    // Par efímero ECDH
    const local = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
    );
    const localPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));

    const recipientPubKey = await crypto.subtle.importKey(
        'raw', recipientPub,
        { name: 'ECDH', namedCurve: 'P-256' },
        false, [],
    );
    const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'ECDH', public: recipientPubKey }, local.privateKey, 256,
    ));

    const keyInfo = concat(
        new TextEncoder().encode('WebPush: info\0'),
        recipientPub,
        localPubRaw,
    );
    const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const cek = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

    const padded = new Uint8Array(data.length + 1);
    padded.set(data, 0);
    padded[data.length] = 0x02;

    const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce, tagLength: 128 },
        cekKey, padded,
    ));

    // Header RFC 8188: salt(16) | rs(4 BE) | idlen(1) | keyid(idlen)
    const rs = 4096;
    const rsBuf = new Uint8Array(4);
    new DataView(rsBuf.buffer).setUint32(0, rs, false);
    const header = concat(salt, rsBuf, new Uint8Array([localPubRaw.length]), localPubRaw);
    return concat(header, ciphertext);
}

async function hkdf(salt, ikm, info, length) {
    const key = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        key, length * 8,
    ));
}

function concat(...arrs) {
    let len = 0; for (const a of arrs) len += a.length;
    const out = new Uint8Array(len);
    let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
}
function b64urlStr(s) {
    return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlBytes(bytes) {
    let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlDecode(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(s);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}
