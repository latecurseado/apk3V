import { supabase } from './supabase';

/**
 * Web Push (VAPID) helper.
 *
 * Setup:
 * 1. Genera VAPID keys con: `npx web-push generate-vapid-keys`
 * 2. Pon la PUBLIC key en astro-poc/.env como PUBLIC_VAPID_KEY
 *    o directamente en `VAPID_PUBLIC_KEY` abajo (no es secreta).
 * 3. La PRIVATE key se usa SOLO en el Worker que envía los pushes.
 */

// ← REEMPLAZA con tu clave pública VAPID (genera con: npx web-push generate-vapid-keys)
// Es seguro tenerla en el cliente · solo la private key debe ser secreta.
const VAPID_PUBLIC_KEY =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_VAPID_KEY) ||
    'BPaste-aqui-tu-VAPID-public-key-base64url-87-chars-aproximadamente';

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function isPushSupported(): boolean {
    return typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
}

export function getPushPermission(): PushPermissionState {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission as PushPermissionState;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

/** Pide permiso al usuario y crea la suscripción. Devuelve true si quedó suscrito. */
export async function subscribeToPush(): Promise<boolean> {
    if (!isPushSupported()) return false;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Permiso
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;

    // Service worker · esperar a estar listo
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return false;

    // Suscribir
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const data = sub.toJSON() as any;
    if (!data.endpoint || !data.keys) return false;

    // Guardar en Supabase
    const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth_key: data.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
        last_used: new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' });

    if (error) {
        console.error('[push] no se pudo guardar la subscripción:', error);
        return false;
    }
    return true;
}

/** Cancela la suscripción local y elimina del backend. */
export async function unsubscribeFromPush(): Promise<boolean> {
    if (!isPushSupported()) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    const { data: { user } } = await supabase.auth.getUser();
    try {
        await sub.unsubscribe();
    } catch { /* */ }
    if (user) {
        await supabase.from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', sub.endpoint);
    }
    return true;
}

/** ¿Está suscrito en ESTE dispositivo? */
export async function isSubscribed(): Promise<boolean> {
    if (!isPushSupported()) return false;
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        return !!sub;
    } catch {
        return false;
    }
}
