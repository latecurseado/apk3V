import { useEffect, useRef, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import { markStoryViewed, deleteStory, countStoryViews, type Story } from '../lib/stories';
import { timeAgo } from '../lib/forum';
import { toast } from '../lib/toast';
import Avatar from './Avatar';

interface AuthorBundle {
    author: { id: string; username: string; pfp: string | null };
    stories: Story[];
}

interface Props {
    bundles: AuthorBundle[];
    initialBundleIndex: number;
    initialStoryIndex: number;
    onClose: () => void;
    onAllSeen?: () => void;
}

const IMG_DURATION_MS = 5000;
const VID_DURATION_MS = 15000; // fallback si el video no carga metadata

export default function StoryViewer({ bundles, initialBundleIndex, initialStoryIndex, onClose, onAllSeen }: Props) {
    const { user } = useSession();
    const [bIdx, setBIdx] = useState(initialBundleIndex);
    const [sIdx, setSIdx] = useState(initialStoryIndex);
    const [progress, setProgress] = useState(0);
    const [paused, setPaused] = useState(false);
    const [viewCount, setViewCount] = useState<number | null>(null);
    const rafRef = useRef<number | null>(null);
    const startRef = useRef<number>(0);
    const durRef = useRef<number>(IMG_DURATION_MS);
    const videoRef = useRef<HTMLVideoElement>(null);

    const bundle = bundles[bIdx];
    const story = bundle?.stories[sIdx];
    const isMine = user?.id === bundle?.author.id;

    /* Marca como vista + cuenta visitas si es mía */
    useEffect(() => {
        if (!story) return;
        markStoryViewed(story.id).catch(() => { /* */ });
        if (isMine) {
            countStoryViews(story.id).then(setViewCount);
        } else {
            setViewCount(null);
        }
    }, [story?.id, isMine]);

    /* Auto-advance loop */
    useEffect(() => {
        if (!story) return;
        setProgress(0);
        startRef.current = performance.now();
        durRef.current = story.media_type === 'video' ? VID_DURATION_MS : IMG_DURATION_MS;
        cancelAnimationFrame(rafRef.current!);
        const tick = (now: number) => {
            if (paused) {
                startRef.current = now - progress * durRef.current;
                rafRef.current = requestAnimationFrame(tick);
                return;
            }
            const elapsed = now - startRef.current;
            const p = Math.min(elapsed / durRef.current, 1);
            setProgress(p);
            if (p >= 1) {
                advance();
                return;
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current!);
    }, [story?.id, paused]);

    /* Video metadata · ajusta duración real */
    const onVidMeta = (e: any) => {
        const v = e.currentTarget as HTMLVideoElement;
        if (v.duration && isFinite(v.duration)) {
            durRef.current = Math.min(v.duration * 1000, 60_000);
        }
    };

    /* Teclas */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); advance(); }
            else if (e.key === 'ArrowLeft') back();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    });

    const advance = () => {
        if (!bundle) return;
        if (sIdx + 1 < bundle.stories.length) {
            setSIdx(sIdx + 1);
        } else if (bIdx + 1 < bundles.length) {
            setBIdx(bIdx + 1);
            setSIdx(0);
        } else {
            onAllSeen?.();
            onClose();
        }
    };
    const back = () => {
        if (sIdx > 0) setSIdx(sIdx - 1);
        else if (bIdx > 0) {
            const prev = bundles[bIdx - 1];
            setBIdx(bIdx - 1);
            setSIdx(prev.stories.length - 1);
        }
    };

    const onTap = (e: any) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width / 3) back();
        else advance();
    };

    const onDelete = async () => {
        if (!story || !isMine) return;
        if (!confirm('¿Borrar esta story?')) return;
        const ok = await deleteStory(story.id);
        if (ok) {
            toast.success('Story borrada');
            onAllSeen?.();
            onClose();
        } else {
            toast.error('No se pudo borrar');
        }
    };

    if (!bundle || !story) return null;

    return (
        <div class="story-viewer-overlay">
            <div class="story-viewer">
                {/* Barras de progreso */}
                <div class="story-progress-row">
                    {bundle.stories.map((_, i) => (
                        <div key={i} class="story-progress-bar">
                            <span style={`width: ${i < sIdx ? 100 : i === sIdx ? progress * 100 : 0}%`}></span>
                        </div>
                    ))}
                </div>

                {/* Header */}
                <header class="story-viewer-head">
                    <a href={`/perfil?u=${bundle.author.username}`} class="story-viewer-author">
                        <Avatar user={bundle.author as any} size={36} />
                        <div>
                            <strong>@{bundle.author.username || 'anon'}</strong>
                            <small>{timeAgo(story.created_at)}</small>
                        </div>
                    </a>
                    <div class="story-viewer-actions">
                        {isMine && viewCount !== null && (
                            <span class="story-view-count" title="Vistas">
                                <i class="fas fa-eye"></i> {viewCount}
                            </span>
                        )}
                        {isMine && (
                            <button class="story-icon-btn" onClick={onDelete} title="Borrar story">
                                <i class="fas fa-trash"></i>
                            </button>
                        )}
                        <button class="story-icon-btn" onClick={onClose} title="Cerrar">
                            <i class="fas fa-xmark"></i>
                        </button>
                    </div>
                </header>

                {/* Media */}
                <div
                    class="story-media-wrap"
                    onClick={onTap}
                    onPointerDown={() => setPaused(true)}
                    onPointerUp={() => setPaused(false)}
                    onPointerLeave={() => setPaused(false)}
                >
                    {story.media_type === 'video' ? (
                        <video
                            ref={videoRef}
                            src={story.media_url}
                            autoPlay
                            playsInline
                            muted={false}
                            onLoadedMetadata={onVidMeta}
                            class="story-media"
                        />
                    ) : (
                        <img src={story.media_url} alt={story.caption} class="story-media" />
                    )}
                </div>

                {/* Caption */}
                {story.caption && (
                    <div class="story-caption">{story.caption}</div>
                )}

                {/* Nav arrows · desktop */}
                <button class="story-nav left" onClick={back}><i class="fas fa-chevron-left"></i></button>
                <button class="story-nav right" onClick={advance}><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>
    );
}
