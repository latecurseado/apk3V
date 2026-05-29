import { useEffect, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { fetchReactionsForThreads, type ReactionSummary } from '../lib/thread-actions';
import { fetchForums, type Thread, type Forum } from '../lib/forum';
import ThreadCard from './ThreadCard';
import Skeleton from './Skeleton';

export default function BookmarksPage() {
    const { user, ready } = useSession();
    const [threads, setThreads] = useState<Thread[]>([]);
    const [forums, setForums] = useState<Forum[]>([]);
    const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionSummary[]>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ready || !user) return;
        let alive = true;
        (async () => {
            const { data: bks } = await supabase
                .from('bookmarks')
                .select('thread_id, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(60);
            if (!alive) return;
            const ids = (bks || []).map((b: any) => b.thread_id);
            if (ids.length === 0) {
                setLoading(false);
                return;
            }
            const [{ data: rows }, fs] = await Promise.all([
                supabase
                    .from('threads')
                    .select('*, author:profiles!threads_author_id_fkey(id, username, pfp, role, account_type, business_category, verified)')
                    .in('id', ids),
                fetchForums(),
            ]);
            if (!alive) return;
            // Mantener orden por bookmark.created_at
            const orderMap = new Map(ids.map((id, i) => [id, i]));
            const ordered = ((rows || []) as any[])
                .map(r => ({
                    id: r.id,
                    author_id: r.author_id,
                    content: r.content,
                    category: r.category,
                    forum_id: r.forum_id,
                    created_at: r.created_at,
                    edited_at: r.edited_at || null,
                    pinned_at: r.pinned_at || null,
                    is_bot: !!r.is_bot,
                    attachments: Array.isArray(r.attachments) ? r.attachments : [],
                    author: r.author,
                    likes_count: 0, liked_by_me: false, comments_count: 0,
                }) as Thread)
                .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
            setThreads(ordered);
            setForums(fs);
            const rx = await fetchReactionsForThreads(ordered.map(t => t.id), user.id);
            setReactionsMap(rx);
            setLoading(false);
        })();
        return () => { alive = false; };
    }, [user?.id, ready]);

    if (!ready) return <div class="forum-loading"><i class="fas fa-circle-notch fa-spin"></i></div>;
    if (!user) {
        return (
            <div class="stub-state">
                <i class="fas fa-lock"></i>
                <h2>Inicia sesión</h2>
                <p>Para ver tus marcadores.</p>
            </div>
        );
    }

    const forumById: Record<string, Forum> = {};
    forums.forEach(f => { forumById[f.id] = f; });

    return (
        <div class="bookmarks-page" style="max-width: 720px; margin: 0 auto;">
            <header class="bookmarks-head">
                <h1><i class="fas fa-bookmark"></i> Marcadores</h1>
                <p>Hilos que guardaste para más tarde.</p>
            </header>

            {loading && <Skeleton variant="thread" count={3} />}

            {!loading && threads.length === 0 && (
                <div class="forum-empty">
                    <i class="far fa-bookmark"></i>
                    <p>Aún no hay marcadores.</p>
                </div>
            )}

            <div class="forum-list">
                {threads.map(t => (
                    <ThreadCard
                        key={t.id}
                        thread={t}
                        forum={t.forum_id ? forumById[t.forum_id] : null}
                        currentUserId={user.id}
                        reactions={reactionsMap[t.id] || []}
                        onDeleted={() => setThreads(ts => ts.filter(x => x.id !== t.id))}
                    />
                ))}
            </div>
        </div>
    );
}
