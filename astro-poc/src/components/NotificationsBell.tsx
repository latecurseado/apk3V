import { useEffect, useRef, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import {
    fetchMyNotifications, countUnread, markAllRead, markOneRead,
    notificationHref, notificationText, notificationIcon, type Notification,
} from '../lib/notifications';
import { timeAgo } from '../lib/forum';

export default function NotificationsBell() {
    const { user } = useSession();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Notification[]>([]);
    const [unread, setUnread] = useState(0);
    const wrapRef = useRef<HTMLDivElement>(null);

    // Carga inicial + cuando cambia el user
    useEffect(() => {
        if (!user) { setItems([]); setUnread(0); return; }
        countUnread().then(setUnread);
    }, [user?.id]);

    // Cuando se abre el dropdown, fetch fresco
    useEffect(() => {
        if (!open || !user) return;
        fetchMyNotifications(20).then(setItems);
    }, [open, user?.id]);

    // Realtime: nuevas notificaciones
    useEffect(() => {
        if (!user) return;
        const ch = supabase
            .channel(`tv-notifs-${user.id}`)
            .on('postgres_changes' as any,
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
                async () => {
                    setUnread(await countUnread());
                    if (open) setItems(await fetchMyNotifications(20));
                })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [user?.id, open]);

    // Cerrar al click fuera
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    if (!user) return null; // No tiene sentido el bell sin sesión

    const doMarkAll = async () => {
        const n = await markAllRead();
        setUnread(0);
        setItems(its => its.map(i => ({ ...i, read: true })));
    };

    const clickItem = async (n: Notification) => {
        if (!n.read) {
            await markOneRead(n.id);
            setUnread(c => Math.max(0, c - 1));
            setItems(its => its.map(i => i.id === n.id ? { ...i, read: true } : i));
        }
        window.location.href = notificationHref(n);
    };

    return (
        <div class="notif-wrap" ref={wrapRef}>
            <button class="notif-btn" onClick={() => setOpen(o => !o)} aria-label="Notificaciones">
                <i class="fas fa-bell"></i>
                {unread > 0 && <span class="notif-badge">{unread > 99 ? '99+' : unread}</span>}
            </button>
            {open && (
                <div class="notif-dropdown">
                    <div class="notif-head">
                        <strong>Notificaciones</strong>
                        {unread > 0 && (
                            <button class="notif-mark-all" onClick={doMarkAll}>
                                Marcar todo leído
                            </button>
                        )}
                    </div>
                    <div class="notif-list">
                        {items.length === 0 && (
                            <div class="notif-empty">
                                <i class="far fa-bell-slash"></i>
                                <p>Sin notificaciones</p>
                            </div>
                        )}
                        {items.map(n => (
                            <button
                                key={n.id}
                                class={`notif-item ${n.read ? '' : 'unread'}`}
                                onClick={() => clickItem(n)}
                            >
                                <span class="notif-icon">
                                    <i class={`fas ${notificationIcon(n)}`}></i>
                                </span>
                                <div class="notif-body">
                                    <p>{notificationText(n)}</p>
                                    <small>{timeAgo(n.created_at)}</small>
                                </div>
                                {!n.read && <span class="notif-dot"></span>}
                            </button>
                        ))}
                    </div>
                    <a href="/notificaciones" class="notif-see-all">
                        <i class="fas fa-list"></i> Ver todas las notificaciones
                    </a>
                </div>
            )}
        </div>
    );
}
