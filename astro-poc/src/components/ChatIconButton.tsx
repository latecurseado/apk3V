import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';

export default function ChatIconButton() {
    const { user } = useSession();
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        if (!user) { setUnread(0); return; }
        const refresh = async () => {
            const { data: { user: u } } = await supabase.auth.getUser();
            if (!u) return;
            const { data: threads } = await supabase
                .from('dm_threads')
                .select('id')
                .or(`user_a.eq.${u.id},user_b.eq.${u.id}`);
            if (!threads || threads.length === 0) { setUnread(0); return; }
            const ids = threads.map((t: any) => t.id);
            const { count } = await supabase.from('dm_messages')
                .select('*', { count: 'exact', head: true })
                .in('dm_thread_id', ids)
                .is('read_at', null)
                .neq('sender_id', u.id);
            setUnread(count ?? 0);
        };
        refresh();
        const ch = supabase
            .channel(`chat-icon-${user.id}`)
            .on('postgres_changes' as any,
                { event: 'INSERT', schema: 'public', table: 'dm_messages' },
                () => refresh())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [user?.id]);

    return (
        <a class="chat-icon-btn" href="/chat" title="Mensajes" aria-label="Mensajes">
            <i class="fas fa-message"></i>
            {unread > 0 && <span class="chat-icon-badge">{unread > 99 ? '99+' : unread}</span>}
        </a>
    );
}
