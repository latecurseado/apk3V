import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession, signInAnonymously, signOut, userLabel } from '../lib/auth';
import {
    fetchThreads, fetchForums,
    type Thread, type Forum,
} from '../lib/forum';
import { fetchReactionsForThreads, type ReactionSummary } from '../lib/thread-actions';
import { fetchFollowing } from '../lib/friends';
import { requireAuthOrPrompt } from '../lib/auth-gate';
import { useInfiniteScroll, usePullToRefresh } from '../lib/hooks';
import FriendsPanel from './FriendsPanel';
import ThreadCard from './ThreadCard';
import ComposeModal from './ComposeModal';
import Skeleton from './Skeleton';
import ShortsStrip from './ShortsStrip';
import InlineComposer from './InlineComposer';
import CreatePicker from './CreatePicker';
import PushOptIn from './PushOptIn';
import StoriesBar from './StoriesBar';
import DynamicWidgets from './DynamicWidgets';

type FeedTab = 'todos' | 'siguiendo';

export default function HomeFeed() {
    const { user, ready } = useSession();
    const [forums, setForums] = useState<Forum[]>([]);
    const [threads, setThreads] = useState<Thread[]>([]);
    const [followingIds, setFollowingIds] = useState<string[]>([]);
    const [tab, setTab] = useState<FeedTab>('todos');
    const [loading, setLoading] = useState(true);
    const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionSummary[]>>({});
    const [composeOpen, setComposeOpen] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [rightbarCollapsed, setRightbarCollapsed] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try { setRightbarCollapsed(localStorage.getItem('tv-rightbar-collapsed') === '1'); } catch { /* */ }
    }, []);
    const toggleRightbar = (collapsed: boolean) => {
        setRightbarCollapsed(collapsed);
        try { localStorage.setItem('tv-rightbar-collapsed', collapsed ? '1' : '0'); } catch { /* */ }
    };

    const refresh = async () => {
        const opts = tab === 'siguiendo' && user
            ? { authorIds: [...followingIds, user.id], limit: 50 }
            : { limit: 50 };
        const fresh = await fetchThreads(opts);
        setThreads(fresh);
        setHasMore(fresh.length >= 50);
        const rx = await fetchReactionsForThreads(fresh.map(t => t.id), user?.id ?? null);
        setReactionsMap(rx);
    };
    const { isPulling, pullDistance } = usePullToRefresh(refresh);

    useInfiniteScroll(sentinelRef, async () => {
        if (loadingMore || !hasMore || loading || threads.length === 0) return;
        setLoadingMore(true);
        try {
            const oldest = threads[threads.length - 1];
            const cursorDate = oldest?.created_at;
            const opts: any = tab === 'siguiendo' && user
                ? { authorIds: [...followingIds, user.id], limit: 30 }
                : { limit: 30 };
            // fetch_more via direct query con cursor para evitar duplicados
            let q = supabase.from('threads')
                .select('*, author:profiles!threads_author_id_fkey(id, username, pfp, role)')
                .lt('created_at', cursorDate)
                .order('pinned_at', { ascending: false, nullsFirst: false })
                .order('created_at', { ascending: false })
                .limit(30);
            if (tab === 'siguiendo' && user) {
                q = q.in('author_id', [...followingIds, user.id]);
            }
            const { data: rows } = await q;
            const newOnes: Thread[] = (rows || []).map((r: any) => ({
                id: r.id, author_id: r.author_id, content: r.content,
                category: r.category, forum_id: r.forum_id,
                created_at: r.created_at,
                edited_at: r.edited_at || null, pinned_at: r.pinned_at || null,
                is_bot: !!r.is_bot,
                attachments: Array.isArray(r.attachments) ? r.attachments : [],
                author: r.author, likes_count: 0, liked_by_me: false, comments_count: 0,
            }));
            if (newOnes.length < 30) setHasMore(false);
            setThreads(ts => [...ts, ...newOnes]);
            const rx = await fetchReactionsForThreads(newOnes.map(t => t.id), user?.id ?? null);
            setReactionsMap(prev => ({ ...prev, ...rx }));
        } finally {
            setLoadingMore(false);
        }
    }, hasMore && !loading);

    const forumById = useMemo(() => {
        const m: Record<string, Forum> = {};
        forums.forEach(f => { m[f.id] = f; });
        return m;
    }, [forums]);

    // Carga inicial: foros + a quién sigo
    useEffect(() => {
        fetchForums().then(setForums);
    }, []);

    useEffect(() => {
        if (!user) { setFollowingIds([]); return; }
        fetchFollowing(user.id).then(list => setFollowingIds(list.map(p => p.id)));
    }, [user?.id]);

    // Hilos según tab
    useEffect(() => {
        setLoading(true);
        const opts = tab === 'siguiendo' && user
            ? { authorIds: [...followingIds, user.id], limit: 50 }
            : { limit: 50 };
        fetchThreads(opts).then(async (ts) => {
            setThreads(ts);
            const rx = await fetchReactionsForThreads(ts.map(t => t.id), user?.id ?? null);
            setReactionsMap(rx);
        }).finally(() => setLoading(false));
    }, [tab, followingIds.join(','), user?.id]);

    // Realtime: nuevos hilos aparecen arriba
    useEffect(() => {
        const channel = supabase
            .channel('tv-home-feed')
            .on('postgres_changes' as any,
                { event: 'INSERT', schema: 'public', table: 'threads' },
                async () => {
                    const opts = tab === 'siguiendo' && user
                        ? { authorIds: [...followingIds, user.id], limit: 50 }
                        : { limit: 50 };
                    setThreads(await fetchThreads(opts));
                })
            .on('postgres_changes' as any,
                { event: 'DELETE', schema: 'public', table: 'threads' },
                (payload: any) => setThreads(ts => ts.filter(t => t.id !== payload.old.id)))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [tab, followingIds.join(','), user?.id]);

    return (
        <div class={`disc-layout ${rightbarCollapsed ? 'rightbar-collapsed' : ''}`}>
            {/* ─── Izquierda: lista de foros + accesos ─── */}
            <aside class="disc-sidebar">
                <div class="disc-sidebar-head">
                    <h3><i class="fas fa-compass"></i> El Kiosko</h3>
                </div>
                <div class="forum-nav">
                    <div class="forum-nav-group">
                        <span class="forum-nav-label">Tus rincones</span>
                        {forums.slice(0, 8).map(f => (
                            <a key={f.id} class="forum-nav-item" href={`/foro?f=${f.slug}`}>
                                <i class={`fas ${f.icon}`} style={f.color && f.color !== '#00d2ff' ? `color: ${f.color};` : ''}></i>
                                <span>{f.name}</span>
                            </a>
                        ))}
                        {forums.length === 0 && (
                            <div class="fp-empty" style="padding:6px 10px;">Cargando…</div>
                        )}
                        <a class="forum-nav-more" href="/foros">
                            <i class="fas fa-grip"></i>
                            <span>Ver todos los rincones</span>
                            <i class="fas fa-arrow-right" style="margin-left:auto;font-size:0.7em;"></i>
                        </a>
                    </div>
                    <div class="forum-nav-group">
                        <span class="forum-nav-label">El Recorrido</span>
                        <a class="forum-nav-item highlight-reels" href="/reels">
                            <i class="fas fa-bolt"></i><span>Cortos</span>
                        </a>
                        <a class="forum-nav-item" href="/explora">
                            <i class="fas fa-mountain"></i><span>Explora</span>
                        </a>
                        <a class="forum-nav-item" href="/explora#hub-videos">
                            <i class="fas fa-circle-play"></i><span>Videos</span>
                        </a>
                        <a class="forum-nav-item" href="/explora#hub-galeria">
                            <i class="fas fa-images"></i><span>Galería</span>
                        </a>
                        <a class="forum-nav-item" href="/explora#hub-mapa">
                            <i class="fas fa-map-location-dot"></i><span>Mapa</span>
                        </a>
                        <a class="forum-nav-item highlight-market" href="/marketplace">
                            <i class="fas fa-store"></i><span>El Tianguis</span>
                        </a>
                        {user && (
                            <>
                                <a class="forum-nav-item" href="/notificaciones">
                                    <i class="fas fa-bell"></i><span>Notificaciones</span>
                                </a>
                                <a class="forum-nav-item" href="/marcadores">
                                    <i class="fas fa-bookmark"></i><span>Marcadores</span>
                                </a>
                            </>
                        )}
                    </div>
                </div>
            </aside>

            {/* ─── Centro: feed con segmented control fluido ─── */}
            <main class="disc-main">
                <div class="seg-control" data-active={tab} role="tablist" aria-label="Filtro del feed">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'todos'}
                        class={`seg-btn ${tab === 'todos' ? 'active' : ''}`}
                        onClick={() => setTab('todos')}
                    >
                        <i class="fas fa-globe"></i> Todo el pueblo
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'siguiendo'}
                        class={`seg-btn ${tab === 'siguiendo' ? 'active' : ''}`}
                        onClick={() => setTab('siguiendo')}
                        disabled={!user}
                        title={!user ? 'Inicia sesión para ver solo lo de tus seguidos' : ''}
                    >
                        <i class="fas fa-user-group"></i> Tu raza {user ? `· ${followingIds.length}` : ''}
                    </button>
                </div>

                <AuthBar user={user} ready={ready} />
                <PushOptIn />
                <StoriesBar />

                {/* Composer inline tipo Twitter — se expande al click */}
                <InlineComposer
                    defaultForum={null}
                    onPosted={(t) => setThreads(ts => [t, ...ts])}
                />

                {/* Botón "Crear" con selector de tipo (Hilo / Foto / Video / Reel / Doc) */}
                <div class="create-bar">
                    <CreatePicker
                        trigger="button"
                        label="Crear"
                        onPosted={(t) => setThreads(ts => [t, ...ts])}
                    />
                    <small class="create-bar-hint">
                        ¿Otro tipo de contenido? Pulsa <b>Crear</b> y elige formato.
                    </small>
                </div>

                {/* FAB móvil: misma funcionalidad accesible siempre */}
                <CreatePicker
                    trigger="fab"
                    onPosted={(t) => setThreads(ts => [t, ...ts])}
                />

                {/* Shorts horizontales tipo YouTube */}
                <ShortsStrip />

                {loading && <div class="forum-loading"><i class="fas fa-circle-notch fa-spin"></i> Cargando feed…</div>}

                {!loading && threads.length === 0 && (
                    <div class="forum-empty">
                        <i class="fas fa-newspaper"></i>
                        <p>
                            {tab === 'siguiendo'
                                ? '¡Todavía no sigues a nadie con cuentos! Busca raza en el panel de al lado.'
                                : 'Está tranquilo por aquí… échate el primer cuento en cualquier rincón.'}
                        </p>
                    </div>
                )}

                {(isPulling || pullDistance > 0) && (
                    <div class="ptr-indicator" style={`height: ${pullDistance}px;`}>
                        <i class={`fas fa-arrow-down ${pullDistance >= 40 ? 'ready' : ''}`}></i>
                    </div>
                )}
                <div class="forum-list">
                    {loading && <Skeleton variant="thread" count={3} />}
                    {!loading && threads.length > 0 && threads.map(t => (
                        <ThreadCard
                            key={t.id}
                            thread={t}
                            forum={t.forum_id ? forumById[t.forum_id] : null}
                            currentUserId={user?.id ?? null}
                            reactions={reactionsMap[t.id] || []}
                            onDeleted={() => setThreads(ts => ts.filter(x => x.id !== t.id))}
                            onEdited={(newContent) => setThreads(ts => ts.map(x => x.id === t.id ? { ...x, content: newContent, edited_at: new Date().toISOString() } : x))}
                            onReactionToggle={async () => {
                                const rx = await fetchReactionsForThreads([t.id], user?.id ?? null);
                                setReactionsMap(prev => ({ ...prev, [t.id]: rx[t.id] || [] }));
                            }}
                        />
                    ))}
                    {hasMore && threads.length > 0 && !loading && (
                        <div ref={sentinelRef} class="infinite-sentinel">
                            {loadingMore && <Skeleton variant="thread" count={2} />}
                        </div>
                    )}
                    {!hasMore && threads.length > 0 && (
                        <div class="infinite-end">
                            <i class="fas fa-check"></i> Ya viste todo el feed
                        </div>
                    )}
                </div>
            </main>

            {composeOpen && (
                <ComposeModal
                    defaultForum={null}
                    onClose={() => setComposeOpen(false)}
                    onPosted={(t) => setThreads(ts => [t, ...ts])}
                />
            )}

            {/* ─── Derecha: widgets en orden dinámico (drag&drop reorder) ─── */}
            <aside class="disc-rightbar">
                <DynamicWidgets onEdit={() => window.location.href = '/perfil?edit=1'} />
                <div class="disc-sidebar-head" style="margin-top: 18px;">
                    <h3><i class="fas fa-user-group"></i> Amigos</h3>
                    <button
                        class="rightbar-collapse-btn"
                        onClick={() => toggleRightbar(true)}
                        title="Ocultar esta columna"
                        aria-label="Ocultar columna derecha"
                    >
                        <i class="fas fa-angles-right"></i>
                    </button>
                </div>
                <FriendsPanel />
            </aside>

            {/* FAB para reabrir la columna (sólo visible en desktop cuando está colapsada) */}
            <button
                class="rightbar-show-fab"
                onClick={() => toggleRightbar(false)}
                title="Mostrar widgets y amigos"
                aria-label="Mostrar columna derecha"
            >
                <i class="fas fa-angles-left"></i>
            </button>
        </div>
    );
}

/* ────── Auth bar compacta ────── */
function AuthBar({ user, ready }: { user: any; ready: boolean }) {
    const [busy, setBusy] = useState(false);
    if (!ready) return null;
    if (user) return null; // No la mostramos si ya está logueado
    const doAnon = async () => {
        setBusy(true);
        const { error } = await signInAnonymously();
        if (error) alert('Habilita "Anonymous Sign-ins" en Supabase Dashboard.\n\n' + error.message);
        setBusy(false);
    };
    return (
        <div class="auth-bar compact" style="margin-bottom: 12px;">
            <span><i class="fas fa-user-secret"></i> Entra como invitado para publicar, dar like y seguir gente</span>
            <button class="auth-btn primary small" onClick={doAnon} disabled={busy}>
                <i class="fas fa-bolt"></i> {busy ? 'Entrando…' : 'Entrar'}
            </button>
        </div>
    );
}

