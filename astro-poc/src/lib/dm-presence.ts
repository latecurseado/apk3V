/**
 * Indicador "escribiendo…" para DMs vía Supabase broadcast channel.
 * Cada thread tiene su propio canal `dm-typing-{threadId}`.
 */
import { supabase } from './supabase';

interface TypingEvent { user_id: string; at: number; }

const channels = new Map<string, any>();
const typingByThread = new Map<string, Set<string>>(); // threadId → Set<userId>
const listeners = new Map<string, Set<(typing: Set<string>) => void>>();
const debounceMap = new Map<string, number>();

function emit(threadId: string) {
    const set = typingByThread.get(threadId) || new Set();
    const ls = listeners.get(threadId);
    ls?.forEach(fn => fn(new Set(set)));
}

export function joinTypingChannel(threadId: string, myUserId: string): () => void {
    if (channels.has(threadId)) {
        // Ya unido; solo subscribe a updates
    } else {
        const ch = supabase.channel(`dm-typing-${threadId}`, {
            config: { broadcast: { self: false } },
        });
        ch.on('broadcast', { event: 'typing' }, (payload: any) => {
            const ev = payload.payload as TypingEvent;
            if (ev.user_id === myUserId) return;
            const set = typingByThread.get(threadId) || new Set<string>();
            set.add(ev.user_id);
            typingByThread.set(threadId, set);
            emit(threadId);
            // Auto-expirar después de 4 segundos sin nuevo evento
            window.setTimeout(() => {
                const s = typingByThread.get(threadId);
                if (s && Date.now() - ev.at >= 3900) {
                    s.delete(ev.user_id);
                    emit(threadId);
                }
            }, 4000);
        });
        ch.subscribe();
        channels.set(threadId, ch);
    }
    return () => {
        // Cleanup solo si nadie más escucha
        const ls = listeners.get(threadId);
        if (!ls || ls.size === 0) {
            const ch = channels.get(threadId);
            if (ch) supabase.removeChannel(ch);
            channels.delete(threadId);
            typingByThread.delete(threadId);
        }
    };
}

export function subscribeTyping(threadId: string, listener: (typing: Set<string>) => void): () => void {
    let ls = listeners.get(threadId);
    if (!ls) { ls = new Set(); listeners.set(threadId, ls); }
    ls.add(listener);
    listener(typingByThread.get(threadId) || new Set());
    return () => {
        ls!.delete(listener);
        if (ls!.size === 0) listeners.delete(threadId);
    };
}

/**
 * Notifica que YO estoy escribiendo en este thread. Throttled a 1 vez por 2.5s.
 */
export function broadcastTyping(threadId: string, myUserId: string) {
    const key = `${threadId}:${myUserId}`;
    if (debounceMap.has(key)) return;
    debounceMap.set(key, window.setTimeout(() => debounceMap.delete(key), 2500));
    const ch = channels.get(threadId);
    if (!ch) return;
    ch.send({ type: 'broadcast', event: 'typing', payload: { user_id: myUserId, at: Date.now() } });
}
