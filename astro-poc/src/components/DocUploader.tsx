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

const DOC_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,text/markdown,application/zip';

function iconFor(name: string): string {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return 'fa-file-pdf';
    if (ext === 'doc' || ext === 'docx') return 'fa-file-word';
    if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'fa-file-excel';
    if (ext === 'ppt' || ext === 'pptx') return 'fa-file-powerpoint';
    if (ext === 'txt' || ext === 'md') return 'fa-file-lines';
    if (ext === 'zip') return 'fa-file-zipper';
    return 'fa-file';
}

/**
 * Subida simple de documentos.
 * El doc se publica como hilo con un adjunto de tipo "file" en el foro
 * destino (por defecto el más adecuado: "docs" si existe, sino "general").
 */
export default function DocUploader({ forums, onClose, onPosted }: Props) {
    const { user } = useSession();
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);
    const [targetForumId, setTargetForumId] = useState<string>('');
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const docForum = forums.find(f => f.slug === 'docs') || forums.find(f => f.slug === 'general') || forums[0];
        if (docForum) setTargetForumId(docForum.id);
    }, [forums]);

    useEffect(() => {
        setTimeout(() => fileRef.current?.click(), 200);
    }, []);

    const onFile = (e: any) => {
        const f = e.target.files?.[0] as File | undefined;
        if (!f) return;
        if (f.size > 8 * 1024 * 1024) {
            toast.error('Máximo 8 MB para documentos');
            return;
        }
        setFile(f);
        if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    };

    const submit = async () => {
        if (!user) { toast.error('Inicia sesión'); return; }
        if (!file) { toast.error('Elige un archivo'); return; }
        const forum = forums.find(f => f.id === targetForumId);
        if (!forum) { toast.error('Elige un foro'); return; }

        setBusy(true);
        const up = await uploadAttachment(file);
        if (!up.ok || !up.attachment) {
            toast.error(up.reason || 'Error al subir');
            setBusy(false);
            return;
        }
        const att: Attachment = { ...up.attachment, type: 'file', name: title || up.attachment.name };
        const finalText = `📄 **${title || file.name}**${description.trim() ? `\n\n${description.trim()}` : ''}`;

        const res = await insertThread(finalText, forum.slug, forum.id, [att]);
        setBusy(false);
        if (!res.ok) {
            toast.error('No se pudo publicar: ' + (res.reason || ''));
            return;
        }
        toast.success('¡Documento publicado!');
        onPosted?.({
            id: res.id!,
            author_id: user.id,
            content: finalText,
            category: forum.slug,
            forum_id: forum.id,
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
            <div class="modal doc-uploader" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-file-lines"></i> Subir documento</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>

                <div class="modal-body doc-up-body">
                    {!file && (
                        <label class="reel-dropzone">
                            <input
                                type="file"
                                accept={DOC_ACCEPT}
                                onChange={onFile}
                                ref={fileRef}
                                style="display:none;"
                            />
                            <i class="fas fa-cloud-arrow-up"></i>
                            <strong>Elige un documento</strong>
                            <small>PDF · Word · Excel · PowerPoint · TXT · CSV · ZIP · máx 8 MB</small>
                            <span class="auth-btn primary small">
                                <i class="fas fa-folder-open"></i> Seleccionar
                            </span>
                        </label>
                    )}

                    {file && (
                        <div class="doc-preview">
                            <div class="doc-preview-icon">
                                <i class={`fas ${iconFor(file.name)}`}></i>
                            </div>
                            <div class="doc-preview-info">
                                <strong>{file.name}</strong>
                                <small>{(file.size / 1024).toFixed(0)} KB</small>
                            </div>
                            <button class="auth-btn ghost small" onClick={() => { setFile(null); fileRef.current?.click(); }}>
                                <i class="fas fa-arrows-rotate"></i> Cambiar
                            </button>
                        </div>
                    )}

                    <label class="reel-caption">
                        <span><i class="fas fa-heading"></i> Título</span>
                        <input
                            type="text"
                            maxLength={120}
                            placeholder="Reglamento del comité…"
                            value={title}
                            onInput={(e: any) => setTitle(e.currentTarget.value)}
                        />
                    </label>

                    <label class="reel-caption">
                        <span><i class="fas fa-comment-dots"></i> Descripción (opcional)</span>
                        <textarea
                            rows={3}
                            maxLength={500}
                            placeholder="Para qué sirve, quién lo escribió, fecha…"
                            value={description}
                            onInput={(e: any) => setDescription(e.currentTarget.value)}
                        />
                        <small class="auth-hint">{description.length}/500</small>
                    </label>

                    <label class="reel-caption">
                        <span><i class="fas fa-folder-tree"></i> Publicar en</span>
                        <select value={targetForumId} onChange={(e: any) => setTargetForumId(e.currentTarget.value)}>
                            {forums.map(f => <option value={f.id}>#{f.slug} · {f.name}</option>)}
                        </select>
                    </label>
                </div>

                <footer class="compose-footer">
                    <button class="auth-btn ghost small" onClick={onClose} disabled={busy}>Cancelar</button>
                    <button class="auth-btn primary" onClick={submit} disabled={busy || !file || !title.trim()}>
                        {busy
                            ? <><i class="fas fa-circle-notch fa-spin"></i> Subiendo…</>
                            : <><i class="fas fa-paper-plane"></i> Publicar</>
                        }
                    </button>
                </footer>
            </div>
        </div>
    );
}
