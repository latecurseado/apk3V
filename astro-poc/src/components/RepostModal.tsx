import { useEffect, useState } from 'preact/hooks';
import { useSession, userLabel } from '../lib/auth';
import { fetchForums, type Forum } from '../lib/forum';
import { repostThread, cleanForRepost } from '../lib/forum-mgmt';
import { toast } from '../lib/toast';
import Avatar from './Avatar';

export default function RepostModal({ content, author, currentForumId, onClose }: {
    content: string;
    author: string;
    currentForumId: string | null;
    onClose: () => void;
}) {
    const { user } = useSession();
    const [forums, setForums] = useState<Forum[]>([]);
    const [target, setTarget] = useState<string>('');
    const [comment, setComment] = useState('');
    const [posting, setPosting] = useState(false);

    useEffect(() => { fetchForums().then(fs => {
        const filtered = fs.filter(f => f.id !== currentForumId);
        setForums(filtered);
        if (filtered[0]) setTarget(filtered[0].id);
    }); }, [currentForumId]);

    const doRepost = async () => {
        if (!target) return;
        setPosting(true);
        const res = await repostThread(content, author, target, comment.trim());
        setPosting(false);
        if (res.ok) { toast.success('Repost publicado'); onClose(); }
        else toast.error('No se pudo repostear: ' + (res.reason || ''));
    };

    // Limpia HTML del contenido original para preview legible
    const cleanedPreview = cleanForRepost(content);
    const previewSnippet = cleanedPreview.slice(0, 240) + (cleanedPreview.length > 240 ? '…' : '');
    const me = user ? userLabel(user) : 'tú';

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal small" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-share-from-square"></i> Repostear a otro foro</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    <p class="hub-section-lead" style="margin: 0 0 12px;">
                        Vas a copiar este hilo al foro que elijas. Se publicará con tu cuenta (<b>@{me}</b>) y se marcará como repost de <b>@{author}</b>.
                    </p>

                    <div class="repost-preview">
                        {/* Quien repostea */}
                        <div class="repost-preview-header">
                            {user && <Avatar user={{ id: user.id, username: me, pfp: null }} size={28} />}
                            <div class="repost-preview-who">
                                <strong>@{me}</strong>
                                <small><i class="fas fa-retweet"></i> reposteando</small>
                            </div>
                        </div>

                        {/* Comentario opcional del repostador (aparece arriba del quote) */}
                        {comment.trim() && (
                            <p class="repost-preview-comment">{comment.trim()}</p>
                        )}

                        {/* Bloque citado del autor original */}
                        <div class="repost-preview-quote">
                            <small><i class="fas fa-quote-left"></i> Repost de <b>@{author}</b></small>
                            <p>{previewSnippet || '(sin texto)'}</p>
                        </div>
                    </div>

                    <label class="form-grid">
                        <span><i class="fas fa-comment-pen"></i> Añade tu comentario (opcional)</span>
                        <textarea
                            rows={2}
                            maxLength={300}
                            placeholder="Qué piensas sobre este hilo…"
                            value={comment}
                            onInput={(e: any) => setComment(e.currentTarget.value)}
                        />
                        <small class="auth-hint">{comment.length}/300</small>
                    </label>

                    <label class="form-grid">
                        <span><i class="fas fa-hashtag"></i> Destino</span>
                        <select value={target} onChange={(e: any) => setTarget(e.currentTarget.value)}>
                            {forums.map(f => (
                                <option value={f.id}>#{f.slug} · {f.name}</option>
                            ))}
                        </select>
                    </label>

                    <div class="form-actions">
                        <button class="auth-btn ghost small" onClick={onClose}>Cancelar</button>
                        <button class="auth-btn primary small" onClick={doRepost} disabled={posting || !target}>
                            <i class="fas fa-paper-plane"></i> {posting ? 'Publicando…' : 'Repostear'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
