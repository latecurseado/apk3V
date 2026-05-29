import { useEffect, useRef, useState } from 'preact/hooks';
import { useSession, userLabel } from '../lib/auth';
import { uploadAttachment, type Attachment } from '../lib/attachments';
import { insertThread, type Forum, type Thread } from '../lib/forum';
import { toast } from '../lib/toast';

interface Props {
    forums: Forum[];
    onClose: () => void;
    onPosted?: (thread: Thread) => void;
}

const MAX_DURATION_S = 90;       // 90 s · TikTok-style
const MAX_SIZE_MB = 50;

/**
 * Subida simple de Reels.
 * Un único paso: el usuario elige un video, opcionalmente escribe un caption,
 * y publica. El reel se guarda como un hilo en el foro #reels con un
 * adjunto de tipo "video" — la vista de reels filtrará por ese foro.
 */
export default function ReelUploader({ forums, onClose, onPosted }: Props) {
    const { user } = useSession();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [busy, setBusy] = useState(false);
    const [duration, setDuration] = useState<number | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Auto-abre file picker al montar (UX más rápido)
    useEffect(() => {
        setTimeout(() => fileRef.current?.click(), 200);
    }, []);

    useEffect(() => {
        if (!file) { setPreview(null); setDuration(null); return; }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const onFile = (e: any) => {
        const f = e.target.files?.[0] as File | undefined;
        if (!f) return;
        if (!f.type.startsWith('video/')) {
            toast.error('Sólo videos (mp4, webm…)');
            return;
        }
        if (f.size > MAX_SIZE_MB * 1024 * 1024) {
            toast.error(`Máximo ${MAX_SIZE_MB} MB`);
            return;
        }
        setFile(f);
    };

    const onVideoMeta = (e: any) => {
        const v = e.currentTarget as HTMLVideoElement;
        setDuration(v.duration);
    };

    const tooLong = duration !== null && duration > MAX_DURATION_S;

    const reelsForum = forums.find(f => f.slug === 'reels') || forums.find(f => f.slug === 'general') || forums[0];

    const submit = async () => {
        if (!user) { toast.error('Inicia sesión'); return; }
        if (!file) { toast.error('Elige un video'); return; }
        if (tooLong) { toast.error(`Máximo ${MAX_DURATION_S} segundos para Reels`); return; }
        if (!reelsForum) { toast.error('No hay foros disponibles'); return; }

        setBusy(true);
        const up = await uploadAttachment(file);
        if (!up.ok || !up.attachment) {
            toast.error(up.reason || 'Error al subir');
            setBusy(false);
            return;
        }
        const att: Attachment = { ...up.attachment, type: 'video' };
        const text = caption.trim() || '🎬 Reel';
        const res = await insertThread(text, reelsForum.slug, reelsForum.id, [att]);
        setBusy(false);
        if (!res.ok) {
            toast.error('No se pudo publicar: ' + (res.reason || ''));
            return;
        }
        toast.success('¡Reel publicado!');
        onPosted?.({
            id: res.id!,
            author_id: user.id,
            content: text,
            category: reelsForum.slug,
            forum_id: reelsForum.id,
            created_at: new Date().toISOString(),
            edited_at: null,
            pinned_at: null,
            is_bot: false,
            attachments: [att],
            author: { id: user.id, username: userLabel(user), pfp: null, role: null },
            likes_count: 0, liked_by_me: false, comments_count: 0,
        });
        onClose();
    };

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal reel-uploader" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-mobile-screen"></i> Nuevo Reel</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>

                <div class="modal-body reel-up-body">
                    {!file && (
                        <label class="reel-dropzone">
                            <input
                                type="file"
                                accept="video/mp4,video/webm,video/quicktime"
                                onChange={onFile}
                                ref={fileRef}
                                style="display:none;"
                            />
                            <i class="fas fa-cloud-arrow-up"></i>
                            <strong>Elige un video vertical</strong>
                            <small>MP4 o WebM · máx {MAX_SIZE_MB} MB · hasta {MAX_DURATION_S}s</small>
                            <span class="auth-btn primary small">
                                <i class="fas fa-folder-open"></i> Seleccionar
                            </span>
                        </label>
                    )}

                    {file && preview && (
                        <div class="reel-preview-wrap">
                            <video
                                src={preview}
                                controls
                                playsInline
                                onLoadedMetadata={onVideoMeta}
                                class="reel-preview-video"
                            />
                            <div class="reel-meta-row">
                                <span><i class="fas fa-file-video"></i> {file.name}</span>
                                <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                                {duration !== null && (
                                    <span class={tooLong ? 'reel-meta-bad' : ''}>
                                        <i class="far fa-clock"></i> {duration.toFixed(1)}s
                                    </span>
                                )}
                                <button class="auth-btn ghost small" onClick={() => { setFile(null); fileRef.current?.click(); }}>
                                    <i class="fas fa-arrows-rotate"></i> Cambiar
                                </button>
                            </div>
                            {tooLong && (
                                <div class="reel-warning">
                                    <i class="fas fa-triangle-exclamation"></i>
                                    El video supera {MAX_DURATION_S}s. Reels son cortos por diseño.
                                </div>
                            )}
                        </div>
                    )}

                    <label class="reel-caption">
                        <span><i class="fas fa-comment-dots"></i> Caption (opcional)</span>
                        <textarea
                            rows={2}
                            maxLength={200}
                            placeholder="Describe el reel en una línea…"
                            value={caption}
                            onInput={(e: any) => setCaption(e.currentTarget.value)}
                        />
                        <small class="auth-hint">{caption.length}/200</small>
                    </label>

                    <div class="reel-target">
                        <i class="fas fa-folder-tree"></i>
                        Se publicará en <b>#{reelsForum?.slug || 'reels'}</b>
                        {!forums.find(f => f.slug === 'reels') && (
                            <small class="auth-hint"> · (crea el foro "reels" para una sección dedicada)</small>
                        )}
                    </div>
                </div>

                <footer class="compose-footer">
                    <button class="auth-btn ghost small" onClick={onClose} disabled={busy}>Cancelar</button>
                    <button class="auth-btn primary" onClick={submit} disabled={busy || !file || tooLong}>
                        {busy
                            ? <><i class="fas fa-circle-notch fa-spin"></i> Subiendo…</>
                            : <><i class="fas fa-paper-plane"></i> Publicar reel</>
                        }
                    </button>
                </footer>
            </div>
        </div>
    );
}
