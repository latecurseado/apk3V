import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import { type Thread, type Forum } from '../lib/forum';
import { fetchReactionsForThreads, type ReactionSummary } from '../lib/thread-actions';
import ThreadCard from './ThreadCard';
import Skeleton from './Skeleton';

/**
 * Página dedicada a un único hilo. Lee `?id=` del query string, carga el
 * hilo con su foro y reacciones, y lo muestra usando ThreadCard.
 * Dispara CustomEvent 'threadLoaded' para que la página actualice meta-tags
 * dinámicamente al compartir el link.
 */
export default function ThreadPage() {
    const { user } = useSession();
    const [thread, setThread] = useState<Thread | null>(null);
    const [forum, setForum] = useState<Forum | null>(null);
    const [reactions, setReactions] = useState<ReactionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [threadId, setThreadId] = useState<string | null>(null);

    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        const id = sp.get('id');
        setThreadId(id);
    }, []);

    useEffect(() => {
        if (!threadId) return;
        let alive = true;
        (async () => {
            setLoading(true);
            const { data: tRow, error } = await supabase
                .from('threads')
                .select('*, author:profiles!threads_author_id_fkey(id, username, pfp, role)')
                .eq('id', threadId)
                .maybeSingle();
            if (error || !tRow) {
                if (alive) { setNotFound(true); setLoading(false); }
                return;
            }
            const t: Thread = {
                id: tRow.id,
                author_id: tRow.author_id,
                content: tRow.content,
                category: tRow.category,
                forum_id: tRow.forum_id,
                created_at: tRow.created_at,
                edited_at: tRow.edited_at || null,
                pinned_at: tRow.pinned_at || null,
                is_bot: !!tRow.is_bot,
                attachments: Array.isArray(tRow.attachments) ? tRow.attachments : [],
                author: tRow.author,
                likes_count: 0, liked_by_me: false, comments_count: 0,
            };
            if (!alive) return;
            setThread(t);

            // Forum
            if (t.forum_id) {
                const { data: f } = await supabase.from('forums').select('*').eq('id', t.forum_id).maybeSingle();
                if (alive && f) setForum(f as Forum);
            }

            // Reactions
            const rx = await fetchReactionsForThreads([t.id], user?.id ?? null);
            if (alive) setReactions(rx[t.id] || []);

            setLoading(false);

            // Dispara evento para que la página actualice título / descripción / OG
            const plain = t.content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            const title = plain.slice(0, 80) + (plain.length > 80 ? '…' : '');
            const desc = plain.slice(0, 180);
            const firstImg = t.attachments?.find((a: any) => a.type === 'image')?.url;
            document.dispatchEvent(new CustomEvent('threadLoaded', {
                detail: { title, description: desc, image: firstImg || null },
            }));
        })();
        return () => { alive = false; };
    }, [threadId, user?.id]);

    if (!threadId) {
        return (
            <main class="thread-page">
                <div class="forum-empty">
                    <i class="fas fa-link-slash"></i>
                    <p>Falta el ID del hilo. Usa la URL <code>/hilo?id=...</code></p>
                    <a href="/" class="auth-btn primary"><i class="fas fa-arrow-left"></i> Volver al inicio</a>
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main class="thread-page">
                <a href="/" class="thread-page-back"><i class="fas fa-arrow-left"></i> Inicio</a>
                <Skeleton variant="thread" count={1} />
            </main>
        );
    }

    if (notFound || !thread) {
        return (
            <main class="thread-page">
                <div class="forum-empty">
                    <i class="fas fa-circle-question"></i>
                    <p>Este hilo no existe o fue borrado.</p>
                    <a href="/" class="auth-btn primary"><i class="fas fa-arrow-left"></i> Volver al inicio</a>
                </div>
            </main>
        );
    }

    return (
        <main class="thread-page">
            <a href="/" class="thread-page-back"><i class="fas fa-arrow-left"></i> Inicio</a>
            <ThreadCard
                thread={thread}
                forum={forum}
                currentUserId={user?.id ?? null}
                reactions={reactions}
                onDeleted={() => { window.location.href = '/'; }}
                onEdited={(newContent) => setThread(t => t ? { ...t, content: newContent, edited_at: new Date().toISOString() } : t)}
                onReactionToggle={async () => {
                    const rx = await fetchReactionsForThreads([thread.id], user?.id ?? null);
                    setReactions(rx[thread.id] || []);
                }}
            />
            <div class="thread-page-share">
                <button
                    class="auth-btn ghost small"
                    onClick={() => {
                        navigator.clipboard?.writeText(window.location.href);
                        const span = document.querySelector('.thread-page-share-msg');
                        if (span) {
                            span.textContent = '✓ Link copiado';
                            setTimeout(() => { span.textContent = ''; }, 2000);
                        }
                    }}
                >
                    <i class="fas fa-link"></i> Copiar enlace
                </button>
                <span class="thread-page-share-msg"></span>
            </div>
        </main>
    );
}
