import { useEffect, useState } from 'preact/hooks';
import { subscribePresence } from '../lib/presence';
import { supabase } from '../lib/supabase';
import Avatar from './Avatar';

interface UserMini {
    id: string;
    username: string;
    pfp: string | null;
}

/** Quién está en línea ahora · usa el sistema de presence global. */
export default function OnlineUsersWidget() {
    const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
    const [users, setUsers] = useState<UserMini[]>([]);

    useEffect(() => {
        return subscribePresence(setOnlineIds);
    }, []);

    useEffect(() => {
        if (onlineIds.size === 0) { setUsers([]); return; }
        const ids = Array.from(onlineIds).slice(0, 24);
        let alive = true;
        (async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, username, pfp')
                .in('id', ids)
                .limit(24);
            if (!alive) return;
            setUsers((data || []) as UserMini[]);
        })();
        return () => { alive = false; };
    }, [onlineIds]);

    if (users.length === 0) {
        return (
            <section class="online-widget">
                <h3><i class="fas fa-circle online-dot"></i> En línea</h3>
                <p class="online-empty">Nadie ahora · sé el primero.</p>
            </section>
        );
    }

    return (
        <section class="online-widget">
            <h3>
                <i class="fas fa-circle online-dot"></i> En línea
                <span class="online-count">{onlineIds.size}</span>
            </h3>
            <div class="online-list">
                {users.slice(0, 8).map(u => (
                    <a key={u.id} href={`/perfil?u=${u.username}`} class="online-user" title={`@${u.username}`}>
                        <span class="online-avatar-wrap">
                            <Avatar user={u as any} size={32} />
                            <span class="online-pulse"></span>
                        </span>
                        <small>@{u.username}</small>
                    </a>
                ))}
                {onlineIds.size > 8 && (
                    <span class="online-more">+{onlineIds.size - 8} más</span>
                )}
            </div>
        </section>
    );
}
