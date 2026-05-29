import { useEffect, useRef, useState } from 'preact/hooks';
import { videos } from '../data/videos';
import { toast } from '../lib/toast';

/**
 * Reels viewer estilo TikTok/Instagram Reels.
 * - Layout vertical 9:16 fullscreen
 * - Scroll snap entre videos · auto-play del activo
 * - Tap = play/pause · double-tap = like
 * - Mute toggle global
 * - Like guardado en localStorage (sin backend para shorts del sistema)
 * - Counter de views/likes mockeado (sumar real con tabla shorts_stats próximo)
 */

const LIKES_KEY = 'tv-reels-likes';
const MUTE_KEY = 'tv-reels-mute';

function loadLikedSet(): Set<string> {
    try {
        const raw = localStorage.getItem(LIKES_KEY);
        if (raw) return new Set(JSON.parse(raw));
    } catch { /* */ }
    return new Set();
}
function saveLikedSet(set: Set<string>) {
    try { localStorage.setItem(LIKES_KEY, JSON.stringify(Array.from(set))); } catch { /* */ }
}

export default function ReelsViewer() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeIdx, setActiveIdx] = useState(0);
    const [muted, setMuted] = useState(() => {
        if (typeof window === 'undefined') return true;
        return localStorage.getItem(MUTE_KEY) !== '0';
    });
    const [paused, setPaused] = useState(false);
    const [liked, setLiked] = useState<Set<string>>(loadLikedSet);
    const [showHeart, setShowHeart] = useState<{ x: number; y: number } | null>(null);
    const lastTap = useRef<number>(0);

    // Deep-link ?v=N
    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        const v = parseInt(sp.get('v') || '0', 10);
        if (!isNaN(v) && v >= 0 && v < videos.length) {
            setActiveIdx(v);
            requestAnimationFrame(() => {
                const el = containerRef.current;
                if (!el) return;
                const target = el.children[v] as HTMLElement;
                target?.scrollIntoView({ block: 'start' });
            });
        }
    }, []);

    // IntersectionObserver para detectar el activo
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const observers: IntersectionObserver[] = [];
        const items = el.querySelectorAll('.reel-item');
        items.forEach((item, i) => {
            const io = new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                    setActiveIdx(i);
                    setPaused(false);
                }
            }, { root: el, threshold: [0, 0.5, 0.6, 1] });
            io.observe(item);
            observers.push(io);
        });
        return () => { observers.forEach(o => o.disconnect()); };
    }, []);

    // Keyboard nav
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); jumpTo(activeIdx + 1); }
            else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); jumpTo(activeIdx - 1); }
            else if (e.key === ' ' || e.key.toLowerCase() === 'p') { e.preventDefault(); setPaused(p => !p); }
            else if (e.key.toLowerCase() === 'm') { e.preventDefault(); toggleMute(); }
            else if (e.key.toLowerCase() === 'l') { toggleLike(videos[activeIdx].youtube_id); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [activeIdx]);

    const jumpTo = (i: number) => {
        const el = containerRef.current;
        if (!el) return;
        const target = el.children[Math.max(0, Math.min(videos.length - 1, i))] as HTMLElement;
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const toggleMute = () => {
        setMuted(m => {
            const next = !m;
            try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* */ }
            return next;
        });
    };

    const toggleLike = (id: string) => {
        setLiked(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else {
                next.add(id);
                if (navigator.vibrate) navigator.vibrate(15);
            }
            saveLikedSet(next);
            return next;
        });
    };

    const handleStageClick = (e: any) => {
        const now = Date.now();
        const isDouble = now - lastTap.current < 350;
        lastTap.current = now;

        if (isDouble) {
            // Double tap = like + corazón flotante
            const rect = e.currentTarget.getBoundingClientRect();
            setShowHeart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            setTimeout(() => setShowHeart(null), 900);
            const cur = videos[activeIdx];
            if (!liked.has(cur.youtube_id)) toggleLike(cur.youtube_id);
        } else {
            // Single tap = play/pause
            setTimeout(() => {
                if (Date.now() - lastTap.current >= 340) setPaused(p => !p);
            }, 350);
        }
    };

    const cur = videos[activeIdx];
    const isLiked = liked.has(cur.youtube_id);

    return (
        <div class="reels-shell">
            <div class="reels-container" ref={containerRef}>
                {videos.map((v, i) => {
                    const itemLiked = liked.has(v.youtube_id);
                    return (
                        <article class="reel-item" key={v.youtube_id}>
                            <div class="reel-video" onClick={i === activeIdx ? handleStageClick : undefined}>
                                {Math.abs(i - activeIdx) <= 1 ? (
                                    <iframe
                                        src={`https://www.youtube-nocookie.com/embed/${v.youtube_id}?autoplay=${i === activeIdx && !paused ? 1 : 0}&mute=${muted ? 1 : 0}&loop=1&playlist=${v.youtube_id}&controls=0&rel=0&modestbranding=1&playsinline=1`}
                                        title={v.title}
                                        allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <img src={`https://i.ytimg.com/vi/${v.youtube_id}/maxresdefault.jpg`} alt={v.title} />
                                )}

                                {i === activeIdx && paused && (
                                    <div class="reel-paused-overlay">
                                        <i class="fas fa-play"></i>
                                    </div>
                                )}

                                {i === activeIdx && showHeart && (
                                    <i
                                        class="fas fa-heart reel-fly-heart"
                                        style={`left: ${showHeart.x}px; top: ${showHeart.y}px;`}
                                    ></i>
                                )}
                            </div>

                            <div class="reel-overlay">
                                <h3>{v.title}</h3>
                                <p>{v.description}</p>
                                <small>
                                    <a href={v.source_url} target="_blank" rel="noopener">@{v.author}</a>
                                    {v.year ? ` · ${v.year}` : ''}
                                </small>
                            </div>

                            <div class="reel-actions">
                                <button
                                    class={`reel-act ${itemLiked ? 'liked' : ''}`}
                                    onClick={() => toggleLike(v.youtube_id)}
                                    title="Me gusta (L)"
                                >
                                    <i class={`${itemLiked ? 'fas' : 'far'} fa-heart`}></i>
                                </button>
                                <button class="reel-act" title="Comentar (próximamente)" onClick={() => toast.info('Comentarios en reels: próxima sesión')}>
                                    <i class="far fa-comment"></i>
                                </button>
                                <button class="reel-act" title="Compartir" onClick={() => {
                                    const url = `${window.location.origin}/reels?v=${i}`;
                                    if (navigator.share) navigator.share({ title: v.title, url });
                                    else { navigator.clipboard.writeText(url); toast.success('Enlace copiado'); }
                                }}>
                                    <i class="fas fa-share-nodes"></i>
                                </button>
                                <button class="reel-act" onClick={toggleMute} title={muted ? 'Activar sonido (M)' : 'Silenciar (M)'}>
                                    <i class={`fas ${muted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>

            {/* Indicador de progreso lateral (paginación) */}
            <div class="reels-progress">
                {videos.map((_, i) => (
                    <span key={i} class={`reels-dot ${i === activeIdx ? 'active' : ''}`}></span>
                ))}
            </div>

            {/* Botones nav (desktop) */}
            <div class="reels-nav">
                <button class="reels-nav-btn" onClick={() => jumpTo(activeIdx - 1)} disabled={activeIdx === 0} aria-label="Anterior (↑)">
                    <i class="fas fa-chevron-up"></i>
                </button>
                <button class="reels-nav-btn" onClick={() => jumpTo(activeIdx + 1)} disabled={activeIdx >= videos.length - 1} aria-label="Siguiente (↓)">
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>

            {/* Hint de teclas (solo desktop, primer load) */}
            <div class="reels-hint">↑↓ navegar · Space pausa · L like · M mute · 2-tap = like ❤️</div>
        </div>
    );
}
