import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import { fetchThreads, fetchForums, type Thread, type Forum } from '../lib/forum';
import { fetchReactionsForThreads, type ReactionSummary } from '../lib/thread-actions';
import ThreadCard from './ThreadCard';

export default function TagFeed({ tag }: { tag: string }) {
    const { user } = useSession();
    const [threads, setThreads] = useState<Thread[]>([]);
    const [forums, setForums] = useState<Forum[]>([]);
    const [loading, setLoading] = useState(true);
    const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionSummary[]>>({});

    useEffect(() => { fetchForums().then(setForums); }, []);

    useEffect(() => {
        setLoading(true);
        // Filtra hilos cuyo content contiene #tag (case-insensitive)
        supabase.from('threads')
            .select('*, author:profiles!threads_author_id_fkey(id, username, pfp, role)')
            .ilike('content', `%#${tag}%`)
            .order('created_at', { ascending: false })
            .limit(60)
            .then(async ({ data }) => {
                const ts = (data || []).map((r: any) => ({
                    id: r.id, author_id: r.author_id, content: r.content,
                    category: r.category, forum_id: r.forum_id, created_at: r.created_at,
                    edited_at: r.edited_at || null, pinned_at: r.pinned_at || null,
                    is_bot: !!r.is_bot, author: r.author,
                    likes_count: 0, liked_by_me: false, comments_count: 0,
                })) as Thread[];
                setThreads(ts);
                const rx = await fetchReactionsForThreads(ts.map(t => t.id), user?.id ?? null);
                setReactionsMap(rx);
                setLoading(false);
            });
    }, [tag, user?.id]);

    const forumById: Record<string, Forum> = {};
    forums.forEach(f => { forumById[f.id] = f; });

    return (
        <div class="tag-feed">
            <header class="tag-feed-head">
                <h1><i class="fas fa-hashtag"></i> {tag}</h1>
                <p>Hilos que mencionan <b>#{tag}</b></p>
            </header>
            {loading && (
                <>
                    <div class="skeleton skeleton-thread"></div>
                    <div class="skeleton skeleton-thread"></div>
                </>
            )}
            {!loading && threads.length === 0 && (
                <div class="forum-empty">
                    <i class="fas fa-hashtag"></i>
                    <p>Nadie ha escrito todavía con <b>#{tag}</b>. ¡Sé el primero!</p>
                </div>
            )}
            <div class="forum-list">
                {threads.map(t => (
                    <ThreadCard
                        key={t.id}
                        thread={t}
                        forum={t.forum_id ? forumById[t.forum_id] : null}
                        currentUserId={user?.id ?? null}
                        reactions={reactionsMap[t.id] || []}
                        onDeleted={() => setThreads(ts => ts.filter(x => x.id !== t.id))}
                        onEdited={(c) => setThreads(ts => ts.map(x => x.id === t.id ? { ...x, content: c } : x))}
                    />
                ))}
            </div>
        </div>
    );
}
