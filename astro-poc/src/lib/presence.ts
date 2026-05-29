import { supabase } from './supabase';

/**
 * Supabase Realtime Presence — quién está online.
 * Se suscribe a un único canal global 'tv-presence' y mantiene
 * un Set con los user_ids actualmente conectados.
 *
 * Uso:
 *   const unsub = subscribePresence((onlineIds) => { ... });
 *   trackMyPresence(myUserId);
 */

type Listener = (online: Set<string>) => void;
const listeners = new Set<Listener>();
let online: Set<string> = new Set();
let channel: any = null;
let tracking = false;

function emit() {
    listeners.forEach(fn => fn(new Set(online)));
}

function ensureChannel() {
    if (channel) return channel;
    channel = supabase.channel('tv-presence', {
        config: { presence: { key: 'anyone' } },
    });
    channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const next = new Set<string>();
        for (const key in state) {
            const arr = state[key] as Array<{ user_id?: string }>;
            arr.forEach(p => { if (p.user_id) next.add(p.user_id); });
        }
        online = next;
        emit();
    });
    channel.subscribe();
    return channel;
}

export function subscribePresence(listener: Listener): () => void {
    ensureChannel();
    listeners.add(listener);
    listener(new Set(online));
    return () => { listeners.delete(listener); };
}

export async function trackMyPresence(userId: string): Promise<void> {
    if (tracking) return;
    const ch = ensureChannel();
    // Esperar a que el canal esté subscrito antes de trackear
    await new Promise<void>((resolve) => {
        const check = setInterval(() => {
            if (ch.state === 'joined') { clearInterval(check); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(check); resolve(); }, 4000);
    });
    try {
        await ch.track({ user_id: userId, at: Date.now() });
        tracking = true;
    } catch (e) {
        console.warn('[presence] track failed:', e);
    }
}

export function isOnline(userId: string): boolean {
    return online.has(userId);
}
