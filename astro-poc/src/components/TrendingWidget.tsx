import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/forum';

interface TrendingThread {
    id: string;
    content: string;
    author_username: string | null;
    likes: number;
    comments: number;
    created_at: string;
}

type Period = 'day' | 'week' | 'month';
const PERIOD_HOURS: Record<Period, number> = { day: 24, week: 168, month: 720 };
const PERIOD_LABEL: Record<Period, string> = { day: 'Hoy', week: 'Semana', month: 'Mes' };

/**
 * Widget de hilos en tendencia: los hilos con más reacciones (likes + comments)
 * por período (24h / 7d / 30d). Refresca cada 5 min.
 */
export default function TrendingWidget() {
    const [items, setItems] = useState<TrendingThread[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('day');

    useEffect(() => {
        let alive = true;
        setLoading(true);
        const load = async () => {
            const hours = PERIOD_HOURS[period];
            const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
            // Estrategia simple: traer top 30 hilos recientes y rankearlos client-side
            const { data: threads } = await supabase
                .from('threads')
                .select('id, content, author_id, created_at, profiles!threads_author_id_fkey(username)')
                .gte('created_at', since)
                .eq('is_bot', false)
                .order('created_at', { ascending: false })
                .limit(30);
            if (!threads || threads.length === 0) {
                if (alive) { setItems([]); setLoading(false); }
                return;
            }
            const ids = threads.map((t: any) => t.id);
            const [{ data: likes }, { data: comments }] = await Promise.all([
                supabase.from('likes').select('target_id').in('target_id', ids).eq('target_type', 'thread'),
                supabase.from('comments').select('thread_id').in('thread_id', ids),
            ]);
            const likeCount: Record<string, number> = {};
            const commentCount: Record<string, number> = {};
            (likes || []).forEach((l: any) => { likeCount[l.target_id] = (likeCount[l.target_id] || 0) + 1; });
            (comments || []).forEach((c: any) => { commentCount[c.thread_id] = (commentCount[c.thread_id] || 0) + 1; });

            const ranked = (threads as any[])
                .map(t => ({
                    id: t.id,
                    content: t.content,
                    author_username: t.profiles?.username || null,
                    likes: likeCount[t.id] || 0,
                    comments: commentCount[t.id] || 0,
                    created_at: t.created_at,
                    score: (likeCount[t.id] || 0) + (commentCount[t.id] || 0) * 2,
                }))
                .filter(t => t.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 4);

            if (alive) {
                setItems(ranked);
                setLoading(false);
            }
        };
        load();
        const tick = setInterval(load, 5 * 60 * 1000);
        return () => { alive = false; clearInterval(tick); };
    }, [period]);

    const periodTabs = (
        <div class="trending-period-tabs">
            {(['day', 'week', 'month'] as Period[]).map(p => (
                <button
                    key={p}
                    class={`trending-period ${period === p ? 'active' : ''}`}
                    onClick={() => setPeriod(p)}
                >
                    {PERIOD_LABEL[p]}
                </button>
            ))}
        </div>
    );

    if (loading) {
        return (
            <section class="trending-widget">
                <h3><i class="fas fa-fire"></i> Tendencias</h3>
                {periodTabs}
                <div class="skel sk-line"></div>
                <div class="skel sk-line short"></div>
            </section>
        );
    }
    if (items.length === 0) {
        return (
            <section class="trending-widget">
                <h3><i class="fas fa-fire"></i> Tendencias</h3>
                {periodTabs}
                <p class="trending-empty">
                    <i class="far fa-clock"></i> Aún no hay actividad caliente en {PERIOD_LABEL[period].toLowerCase()}.
                </p>
            </section>
        );
    }

    const preview = (txt: string) => {
        const clean = txt.replace(/<[^>]+>/g, '').replace(/[*_`]/g, '').trim();
        return clean.length > 90 ? clean.slice(0, 88) + '…' : clean;
    };

    return (
        <section class="trending-widget">
            <h3><i class="fas fa-fire"></i> Tendencias</h3>
            {periodTabs}
            <ol class="trending-list">
                {items.map((it, i) => (
                    <li key={it.id}>
                        <a href={`/hilo?id=${it.id}`} class="trending-link">
                            <span class="trending-rank">{i + 1}</span>
                            <div class="trending-body">
                                <p>{preview(it.content)}</p>
                                <small>
                                    {it.author_username ? `@${it.author_username}` : 'Invitado'}
                                    {' · '}
                                    <i class="fas fa-heart"></i> {it.likes}
                                    {' · '}
                                    <i class="fas fa-comment"></i> {it.comments}
                                    {' · '}
                                    {timeAgo(it.created_at)}
                                </small>
                            </div>
                        </a>
                    </li>
                ))}
            </ol>
        </section>
    );
}
