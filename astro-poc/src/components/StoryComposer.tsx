import { useEffect, useRef, useState } from 'preact/hooks';
import { createStory } from '../lib/stories';
import { toast } from '../lib/toast';

interface Props {
    onClose: () => void;
    onPosted?: () => void;
}

export default function StoryComposer({ onClose, onPosted }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [busy, setBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTimeout(() => fileRef.current?.click(), 150);
    }, []);

    useEffect(() => {
        if (!file) { setPreview(null); return; }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const onFile = (e: any) => {
        const f = e.target.files?.[0] as File | undefined;
        if (!f) return;
        const isImg = f.type.startsWith('image/');
        const isVid = f.type.startsWith('video/');
        if (!isImg && !isVid) { toast.error('Sólo imagen o video'); return; }
        if (f.size > 30 * 1024 * 1024) { toast.error('Máximo 30 MB'); return; }
        setFile(f);
    };

    const submit = async () => {
        if (!file) return;
        setBusy(true);
        try {
            await createStory(file, caption);
            toast.success('¡Story publicada! Estará 24h activa.');
            onPosted?.();
            onClose();
        } catch (e: any) {
            toast.error(e.message || 'Error al subir');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal story-composer" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-circle-plus"></i> Nueva Story</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body story-comp-body">
                    {!file && (
                        <label class="reel-dropzone">
                            <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFile} style="display:none;" />
                            <i class="fas fa-cloud-arrow-up"></i>
                            <strong>Elige foto o video</strong>
                            <small>Máx 30 MB · expira en 24h</small>
                            <span class="auth-btn primary small">
                                <i class="fas fa-folder-open"></i> Seleccionar
                            </span>
                        </label>
                    )}
                    {file && preview && (
                        <div class="story-preview">
                            {file.type.startsWith('video/') ? (
                                <video src={preview} controls playsInline class="story-preview-media" />
                            ) : (
                                <img src={preview} alt="" class="story-preview-media" />
                            )}
                            <button class="auth-btn ghost small" onClick={() => { setFile(null); fileRef.current?.click(); }}>
                                <i class="fas fa-arrows-rotate"></i> Cambiar
                            </button>
                        </div>
                    )}
                    <label class="reel-caption">
                        <span><i class="fas fa-comment-dots"></i> Caption (opcional)</span>
                        <textarea
                            rows={2}
                            maxLength={200}
                            placeholder="Algo corto…"
                            value={caption}
                            onInput={(e: any) => setCaption(e.currentTarget.value)}
                        />
                        <small class="auth-hint">{caption.length}/200</small>
                    </label>
                </div>
                <footer class="compose-footer">
                    <button class="auth-btn ghost small" onClick={onClose} disabled={busy}>Cancelar</button>
                    <button class="auth-btn primary" onClick={submit} disabled={busy || !file}>
                        {busy
                            ? <><i class="fas fa-circle-notch fa-spin"></i> Subiendo…</>
                            : <><i class="fas fa-paper-plane"></i> Publicar story</>}
                    </button>
                </footer>
            </div>
        </div>
    );
}
