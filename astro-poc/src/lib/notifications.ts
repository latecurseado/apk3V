import { supabase } from './supabase';

export interface Notification {
    id: string;
    recipient_id: string;
    actor_id: string | null;
    type: string;
    target_type: string | null;
    target_id: string | null;
    extra: any;
    read: boolean;
    created_at: string;
    actor: { id: string; username: string; pfp: string | null } | null;
}

export async function fetchMyNotifications(limit = 30): Promise<Notification[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
        .from('notifications')
        .select('*, actor:profiles!notifications_actor_id_fkey(id, username, pfp)')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
    return (data || []) as unknown as Notification[];
}

export async function countUnread(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;
    const { count } = await supabase.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id).eq('read', false);
    return count ?? 0;
}

export async function markAllRead(): Promise<number> {
    const { data, error } = await supabase.rpc('mark_all_notifs_read');
    if (error) { console.error('[notif] markAllRead:', error); return 0; }
    return typeof data === 'number' ? data : 0;
}

export async function markOneRead(id: string): Promise<boolean> {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    return !error;
}

export function notificationHref(n: Notification): string {
    switch (n.type) {
        case 'follow':       return n.actor?.username ? `/perfil?u=${n.actor.username}` : '/foro';
        case 'like_thread':  return `/foro`;
        case 'comment':      return `/foro`;
        case 'mention':      return `/foro`;
        default:             return '/';
    }
}

export function notificationText(n: Notification): string {
    const actor = n.actor?.username ? `@${n.actor.username}` : 'Alguien';
    switch (n.type) {
        case 'follow':       return `${actor} te empezó a seguir`;
        case 'like_thread':  return `${actor} le dio like a tu hilo`;
        case 'comment':      return `${actor} comentó tu hilo`;
        case 'mention':      return `${actor} te mencionó en un hilo`;
        default:             return `${actor} hizo algo`;
    }
}

export function notificationIcon(n: Notification): string {
    switch (n.type) {
        case 'follow':       return 'fa-user-plus';
        case 'like_thread':  return 'fa-heart';
        case 'comment':      return 'fa-comment';
        case 'mention':      return 'fa-at';
        default:             return 'fa-bell';
    }
}
