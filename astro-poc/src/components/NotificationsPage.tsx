import { useEffect, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/forum';
import Avatar from './Avatar';

interface NotifRow {
    id: string;
    recipient_id: string;
    actor_id: string | null;
    type: string;
    target_type: string | null;
    target_id: string | null;
    extra: any;
    read: boolean;
    created_at: string;
    actor?: { username: string; pfp: string | null };
}

const TYPE_INFO: Record<string, { icon: string; color: string; copy: (actor: string) => string }> = {
    follow:       { icon: 'fa-user-plus',    color: '#00d2ff', copy: a => `@${a} te empezó a seguir` },
    like_thread:  { icon: 'fa-heart',        color: '#ff0844', copy: a => `A @${a} le gustó tu hilo` },
    like:         { icon: 'fa-heart',        color: '#ff0844', copy: a => `A @${a} le gustó tu hilo` },
    comment:      { icon: 'fa-comment',      color: '#10b981', copy: a => `@${a} comentó en tu hilo` },
    mention:      { icon: 'fa-at',           color: '#f59e0b', copy: a => `@${a} te mencionó` },
    dm:           { icon: 'fa-envelope',     color: '#a855f7', copy: a => `@${a} te escribió por DM` },
    reaction:     { icon: 'fa-face-smile',   color: '#f59e0b', copy: a => `@${a} reaccionó a tu hilo` },
    story:        { icon: 'fa-circle',       color: '#ec4899', copy: a => `@${a} publicó una nueva story` },
    collaboration:{ icon: 'fa-handshake-simple', color: '#10b981', copy: a => `@${a} te invitó a colaborar en un hilo` },
    marketplace:  { icon: 'fa-store',        color: '#10b981', copy: a => `@${a} preguntó sobre tu artículo` },
    report:       { icon: 'fa-flag',         color: '#ef4444', copy: () => 'Un admin revisó tu reporte' },
    friend_request:{ icon: 'fa-user-clock', color: '#00d2ff', copy: a => `@${a} te envió solicitud de amistad` },
    reply:        { icon: 'fa-reply',        color: '#a855f7', copy: a => `@${a} respondió tu comentario` },
};

function targetUrl(n: NotifRow): string {
    if (n.type === 'dm') return `/chat?c=${n.target_id}`;
    if (n.type === 'follow' && n.actor?.username) return `/perfil?u=${n.actor.username}`;
    if (n.target_type === 'thread' && n.target_id) return `/hilo?id=${n.target_id}`;
    if (n.target_type === 'profile' && n.actor?.username) return `/perfil?u=${n.actor.username}`;
    return '/';
}

type Tab = 'todas' | 'no_leidas' | 'menciones' | 'social';

export default function NotificationsPage() {
    const { user, ready } = useSession();
    const [notifs, setNotifs] = useState<NotifRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('todas');

    const load = async () => {
        if (!user) return;
        setLoading(true);
        const { data } = await supabase
            .from('notifications')
            .select('*, actor:profiles!notifications_actor_id_fkey(username, pfp)')
            .eq('recipient_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100);
        setNotifs((data || []) as NotifRow[]);
        setLoading(false);
    };

    useEffect(() => { if (ready && user) load(); }, [user?.id, ready]);

    const markAllRead = async () => {
        if (!user) return;
        await supabase.rpc('mark_all_notifs_read');
        setNotifs(ns => ns.map(n => ({ ...n, read: true })));
    };

    const markRead = async (id: string) => {
        await supabase.from('notifications').update({ read: true }).eq('id', id);
        setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const deleteOne = async (id: string) => {
        await supabase.from('notifications').delete().eq('id', id);
        setNotifs(ns => ns.filter(n => n.id !== id));
    };

    const filtered = notifs.filter(n => {
        if (tab === 'todas') return true;
        if (tab === 'no_leidas') return !n.read;
        if (tab === 'menciones') return n.type === 'mention' || n.type === 'reply';
        if (tab === 'social') return ['follow','like','like_thread','reaction','friend_request'].includes(n.type);
        return true;
    });

    const unreadCount = notifs.filter(n => !n.read).length;

    if (!ready) return <div class="forum-loading"><i class="fas fa-circle-notch fa-spin"></i></div>;
    if (!user) {
        return (
            <div class="stub-state">
                <i class="fas fa-lock"></i>
                <h2>Inicia sesión</h2>
                <p>Para ver tus notificaciones.</p>
            </div>
        );
    }

    return (
        <div class="notifs-page">
            <header class="notifs-head">
                <div>
                    <h1><i class="fas fa-bell"></i> Notificaciones</h1>
                    <p>{unreadCount > 0 ? `${unreadCount} sin leer · ` : ''}{notifs.length} en total</p>
                </div>
                {unreadCount > 0 && (
                    <button class="auth-btn ghost small" onClick={markAllRead}>
                        <i class="fas fa-check-double"></i> Marcar todas leídas
                    </button>
                )}
            </header>

            <nav class="search-tabs">
                <button class={`search-tab ${tab === 'todas' ? 'active' : ''}`} onClick={() => setTab('todas')}>
                    <i class="fas fa-globe"></i> <span>Todas</span>
                </button>
                <button class={`search-tab ${tab === 'no_leidas' ? 'active' : ''}`} onClick={() => setTab('no_leidas')}>
                    <i class="fas fa-circle"></i> <span>No leídas {unreadCount > 0 && <span class="search-tab-count">{unreadCount}</span>}</span>
                </button>
                <button class={`search-tab ${tab === 'menciones' ? 'active' : ''}`} onClick={() => setTab('menciones')}>
                    <i class="fas fa-at"></i> <span>Menciones</span>
                </button>
                <button class={`search-tab ${tab === 'social' ? 'active' : ''}`} onClick={() => setTab('social')}>
                    <i class="fas fa-heart"></i> <span>Social</span>
                </button>
            </nav>

            {loading && <div class="forum-loading"><i class="fas fa-circle-notch fa-spin"></i></div>}

            {!loading && filtered.length === 0 && (
                <div class="forum-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>No hay notificaciones en esta categoría.</p>
                </div>
            )}

            <div class="notifs-list">
                {filtered.map(n => {
                    const info = TYPE_INFO[n.type] || { icon: 'fa-bell', color: '#888', copy: () => 'Nueva actividad' };
                    const actor = n.actor?.username || 'alguien';
                    const url = targetUrl(n);
                    return (
                        <div key={n.id} class={`notif-row ${n.read ? 'read' : 'unread'}`}>
                            <a
                                class="notif-link"
                                href={url}
                                onClick={() => !n.read && markRead(n.id)}
                            >
                                <span class="notif-icon" style={`color: ${info.color}; background: color-mix(in srgb, ${info.color} 15%, transparent);`}>
                                    <i class={`fas ${info.icon}`}></i>
                                </span>
                                {n.actor && (
                                    <Avatar user={{ id: n.actor_id || '', username: actor, pfp: n.actor.pfp }} size={36} />
                                )}
                                <div class="notif-body">
                                    <p>{info.copy(actor)}</p>
                                    <small>{timeAgo(n.created_at)}</small>
                                </div>
                                {!n.read && <span class="notif-dot"></span>}
                            </a>
                            <button class="notif-del" onClick={() => deleteOne(n.id)} title="Borrar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
