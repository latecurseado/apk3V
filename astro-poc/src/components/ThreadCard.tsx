import { useEffect, useMemo, useState } from 'preact/hooks';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import {
    toggleLike, deleteThread, timeAgo,
    fetchComments, insertComment, deleteComment,
    type Thread, type Comment, type Forum,
} from '../lib/forum';
import {
    isBookmarked, toggleBookmark,
    REACTION_EMOJIS, toggleReaction, type ReactionSummary,
    updateThreadContent, togglePin, shareThread,
} from '../lib/thread-actions';
import { toast } from '../lib/toast';
import { requireAuthOrPrompt } from '../lib/auth-gate';
import { parseRichText } from '../lib/rich-text';
import { sanitizeCmsHtml, sanitizeCommentHtml } from '../lib/sanitize';
import PollDisplay from './PollDisplay';
import RepostModal from './RepostModal';
import { openLightbox } from '../lib/lightbox';
import Avatar from './Avatar';
import { useDoubleClick, useLongPress } from '../lib/hooks';
import RichCommentEditor from './RichCommentEditor';
import QRShareModal from './QRShareModal';
import { fetchCollaborators, type Collaborator } from '../lib/collaborators';
import AccountBadge from './AccountBadge';
import InviteCollaboratorModal from './InviteCollaboratorModal';
import ReportModal from './ReportModal';
import CommentReactions from './CommentReactions';

interface Props {
    thread: Thread;
    forum?: Forum | null;
    currentUserId: string | null;
    isAdmin?: boolean;
    reactions?: ReactionSummary[];
    onDeleted: () => void;
    onEdited?: (newContent: string) => void;
    onPinChanged?: () => void;
    onReactionToggle?: (emoji: string, action: 'added' | 'removed') => void;
}

export default function ThreadCard({
    thread, forum, currentUserId, isAdmin,
    reactions, onDeleted, onEdited, onPinChanged, onReactionToggle,
}: Props) {
    const [likes, setLikes] = useState(thread.likes_count);
    const [liked, setLiked] = useState(thread.liked_by_me);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [commentsCount, setCommentsCount] = useState(thread.comments_count);
    const [bookmarked, setBookmarked] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draftContent, setDraftContent] = useState(thread.content);
    const [reposting, setReposting] = useState(false);
    const [contentExpanded, setContentExpanded] = useState(false);
    const [qrOpen, setQrOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

    useEffect(() => {
        let alive = true;
        fetchCollaborators(thread.id).then(c => { if (alive) setCollaborators(c); });
        return () => { alive = false; };
    }, [thread.id]);

    const isMine = currentUserId && thread.author_id === currentUserId;
    const isPinned = !!thread.pinned_at;
    const wasEdited = !!thread.edited_at;
    const [showHeartBurst, setShowHeartBurst] = useState(false);

    // Truncado por palabras: si el contenido del hilo supera 100 palabras,
    // mostramos un resumen + "Ver más" que expande inline.
    const WORD_LIMIT = 100;
    const { isLong, previewHtml } = useMemo(() => {
        const plain = thread.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const words = plain ? plain.split(/\s+/) : [];
        if (words.length <= WORD_LIMIT) return { isLong: false, previewHtml: '' };
        const cut = words.slice(0, WORD_LIMIT).join(' ');
        return { isLong: true, previewHtml: cut + '…' };
    }, [thread.content]);

    // Carga estado del bookmark
    useEffect(() => {
        if (!currentUserId) { setBookmarked(false); return; }
        isBookmarked(currentUserId, thread.id).then(setBookmarked);
    }, [currentUserId, thread.id]);

    // Doble click en el contenido → like + corazón flotante (Instagram-style)
    const handleDoubleClick = useDoubleClick(() => {
        if (!currentUserId) {
            if (!requireAuthOrPrompt('dar like', currentUserId)) return;
        }
        if (!liked) {
            setLiked(true);
            setLikes(c => c + 1);
            toggleLike(thread.id);
            if (navigator.vibrate) navigator.vibrate(20);
            setShowHeartBurst(true);
            setTimeout(() => setShowHeartBurst(false), 700);
        }
    });

    // Long-press en el botón like → abre emoji picker
    const longPressLike = useLongPress(() => setShowEmojiPicker(true));

    const doLike = async () => {
        if (!requireAuthOrPrompt('dar like', currentUserId)) return;
        const wasLiked = liked;
        setLiked(l => !l);
        setLikes(c => c + (wasLiked ? -1 : 1));
        const r = await toggleLike(thread.id);
        if (r === null) { setLiked(wasLiked); setLikes(c => c + (wasLiked ? 1 : -1)); return; }
        // Confetti en el primer like que YO doy a este hilo
        if (!wasLiked && !sessionStorage.getItem('tv-confetti-shown')) {
            celebrate();
            try { sessionStorage.setItem('tv-confetti-shown', '1'); } catch { /* */ }
        }
    };

    const doBookmark = async () => {
        if (!requireAuthOrPrompt('guardar hilos', currentUserId)) return;
        const result = await toggleBookmark(thread.id);
        if (result === null) return;
        setBookmarked(result);
        toast.success(result ? 'Guardado en marcadores' : 'Marcador eliminado');
    };

    const doReaction = async (emoji: string) => {
        if (!requireAuthOrPrompt('reaccionar', currentUserId)) return;
        setShowEmojiPicker(false);
        const action = await toggleReaction(thread.id, emoji);
        if (action && onReactionToggle) onReactionToggle(emoji, action);
    };

    const doDelete = async () => {
        if (!confirm('¿Borrar este hilo?')) return;
        const ok = await deleteThread(thread.id);
        if (ok) { toast.success('Hilo borrado'); onDeleted(); }
        else toast.error('No se pudo borrar');
    };

    const doShare = async () => {
        await shareThread(thread.id, forum?.slug || thread.category || 'general', thread.content);
        if (!navigator.share) toast.success('Enlace copiado al portapapeles');
    };

    const doPin = async () => {
        const ok = await togglePin(thread.id, isPinned);
        if (ok) {
            toast.success(isPinned ? 'Hilo despineado' : 'Hilo destacado arriba');
            onPinChanged?.();
        } else toast.error('Error al destacar');
    };

    const startEdit = () => { setDraftContent(thread.content); setEditing(true); };

    const saveEdit = async () => {
        const text = draftContent.trim();
        if (!text || text === thread.content) { setEditing(false); return; }
        const ok = await updateThreadContent(thread.id, text);
        if (ok) {
            toast.success('Hilo editado');
            setEditing(false);
            onEdited?.(text);
        } else toast.error('Error al guardar');
    };

    const displayName = thread.author?.username || `Invitado #${thread.author_id.slice(0, 6)}`;
    const isAnon = !thread.author?.username;

    // Ordenar reacciones por count desc
    const sortedReactions = useMemo(
        () => (reactions ? [...reactions].sort((a, b) => b.count - a.count) : []),
        [reactions],
    );

    return (
        <article class={`thread-card ${isPinned ? 'pinned' : ''}`} id={`hilo-${thread.id}`}>
            {isPinned && (
                <div class="thread-pin-banner">
                    <i class="fas fa-thumbtack"></i> Hilo destacado
                </div>
            )}
            <header class="thread-head">
                <a class="thread-avatar-link" href={thread.author?.username ? `/perfil?u=${thread.author.username}` : '#'}>
                    <Avatar user={thread.author ? { id: thread.author.id, username: thread.author.username, pfp: thread.author.pfp } : { id: thread.author_id }} size={40} />
                </a>
                <div class="thread-author">
                    <strong>
                        {displayName}
                        <AccountBadge
                            accountType={(thread.author as any)?.account_type}
                            businessCategory={(thread.author as any)?.business_category}
                            role={thread.author?.role}
                            verified={(thread.author as any)?.verified}
                        />
                        {collaborators.length > 0 && (
                            <span class="thread-collab-mark" title={`Colaboran: ${collaborators.map(c => '@' + (c.username || 'anon')).join(', ')}`}>
                                {' '}+ {collaborators.length} <i class="fas fa-handshake-simple"></i>
                            </span>
                        )}
                    </strong>
                    <small>
                        <a class="thread-permalink" href={`/hilo?id=${thread.id}`} title="Permalink">
                            {timeAgo(thread.created_at)}
                        </a>
                        {wasEdited && <span class="thread-edited" title={`Editado ${timeAgo(thread.edited_at!)}`}> · editado</span>}
                        {forum && (
                            <>
                                {' · en '}
                                <a class="feed-forum-badge" href={`/foro?f=${forum.slug}`}>
                                    <i class={`fas ${forum.icon}`}></i> {forum.name}
                                </a>
                            </>
                        )}
                    </small>
                </div>

                <div class="thread-head-actions">
                    {(isMine || isAdmin) && (
                        <button class="thread-del" onClick={doDelete} title="Borrar"><i class="fas fa-trash"></i></button>
                    )}
                    {isMine && !editing && (
                        <button class="thread-del" onClick={startEdit} title="Editar"><i class="fas fa-pencil"></i></button>
                    )}
                    {isAdmin && (
                        <button class={`thread-del ${isPinned ? 'active' : ''}`} onClick={doPin} title={isPinned ? 'Despinear' : 'Destacar arriba'}>
                            <i class="fas fa-thumbtack"></i>
                        </button>
                    )}
                </div>
            </header>

            {editing ? (
                <div class="thread-edit">
                    <textarea
                        value={draftContent}
                        onInput={(e: any) => setDraftContent(e.currentTarget.value)}
                        rows={3}
                        maxLength={2000}
                    />
                    <div class="thread-edit-actions">
                        <button class="auth-btn ghost small" onClick={() => setEditing(false)}>Cancelar</button>
                        <button class="auth-btn primary small" onClick={saveEdit} disabled={!draftContent.trim()}>
                            <i class="fas fa-floppy-disk"></i> Guardar
                        </button>
                    </div>
                </div>
            ) : (
                <div class="thread-content-wrap">
                    <div
                        class={`thread-content rich${isLong && !contentExpanded ? ' clamped' : ''}`}
                        dangerouslySetInnerHTML={{
                            __html: sanitizeCmsHtml(parseRichText(
                                isLong && !contentExpanded ? previewHtml : thread.content,
                            )),
                        }}
                        onClick={handleDoubleClick}
                    />
                    {isLong && !contentExpanded && (
                        <button
                            type="button"
                            class="thread-seemore"
                            onClick={() => {
                                setContentExpanded(true);
                                setCommentsOpen(true);
                                requestAnimationFrame(() => {
                                    document.getElementById(`hilo-${thread.id}`)
                                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                });
                            }}
                        >
                            Ver más <i class="fas fa-chevron-down"></i>
                        </button>
                    )}
                    {isLong && contentExpanded && (
                        <button
                            type="button"
                            class="thread-seemore collapse"
                            onClick={() => setContentExpanded(false)}
                        >
                            Ver menos <i class="fas fa-chevron-up"></i>
                        </button>
                    )}
                </div>
            )}
            {showHeartBurst && (
                <div class="thread-heart-burst">
                    <i class="fas fa-heart"></i>
                </div>
            )}

            {collaborators.length > 0 && (
                <div class="thread-collab-row">
                    <span class="thread-collab-label">
                        <i class="fas fa-handshake-simple"></i> Colaboran:
                    </span>
                    <div class="thread-collab-avatars">
                        {collaborators.slice(0, 5).map(c => (
                            <a
                                key={c.user_id}
                                href={c.username ? `/perfil?u=${c.username}` : '#'}
                                title={`@${c.username || 'anon'}`}
                                class="thread-collab-avatar"
                            >
                                <Avatar user={{ id: c.user_id, username: c.username || 'a', pfp: c.pfp }} size={26} />
                            </a>
                        ))}
                        {collaborators.length > 5 && (
                            <span class="thread-collab-more">+{collaborators.length - 5}</span>
                        )}
                    </div>
                </div>
            )}

            {thread.attachments && thread.attachments.length > 0 && (
                <div class={`thread-attachments count-${Math.min(thread.attachments.length, 4)}`}>
                    {thread.attachments.map((a, i) => {
                        const images = thread.attachments.filter(x => x.type === 'image');
                        const imgIdx = images.findIndex(x => x.url === a.url);
                        if (a.type === 'image') {
                            return (
                                <button
                                    key={i}
                                    class="thread-img-wrap"
                                    onClick={() => openLightbox(images.map(im => ({ url: im.url, caption: im.name, alt: im.name })), imgIdx)}
                                    aria-label={`Ver imagen ${i + 1}`}
                                >
                                    <img class="lazy-blur" src={a.url} alt={a.name} loading="lazy" decoding="async"
                                        onLoad={(e: any) => e.currentTarget.classList.add('loaded')} />
                                </button>
                            );
                        }
                        if (a.type === 'video') {
                            return (
                                <div key={i} class="thread-video-wrap">
                                    <video src={a.url} controls playsInline preload="metadata" class="thread-video" />
                                </div>
                            );
                        }
                        // doc / file genérico
                        const ext = (a.name.split('.').pop() || '').toLowerCase();
                        const icon = ext === 'pdf' ? 'fa-file-pdf'
                            : ext === 'doc' || ext === 'docx' ? 'fa-file-word'
                            : ext === 'xls' || ext === 'xlsx' || ext === 'csv' ? 'fa-file-excel'
                            : ext === 'ppt' || ext === 'pptx' ? 'fa-file-powerpoint'
                            : ext === 'zip' ? 'fa-file-zipper'
                            : 'fa-file-lines';
                        const kb = a.size ? `${(a.size / 1024).toFixed(0)} KB` : '';
                        return (
                            <a key={i} class="thread-file rich" href={a.url} target="_blank" rel="noopener">
                                <span class="thread-file-icon"><i class={`fas ${icon}`}></i></span>
                                <span class="thread-file-info">
                                    <strong>{a.name}</strong>
                                    {kb && <small>{kb}</small>}
                                </span>
                                <span class="thread-file-cta"><i class="fas fa-download"></i></span>
                            </a>
                        );
                    })}
                </div>
            )}

            <PollDisplay threadId={thread.id} currentUserId={currentUserId} />

            {/* Reacciones existentes */}
            {sortedReactions.length > 0 && (
                <div class="thread-reactions">
                    {sortedReactions.map(r => (
                        <button
                            class={`reaction-pill ${r.mine ? 'mine' : ''}`}
                            onClick={() => doReaction(r.emoji)}
                        >
                            <span class="reaction-emoji">{r.emoji}</span>
                            <span class="reaction-count">{r.count}</span>
                        </button>
                    ))}
                </div>
            )}

            <footer class="thread-actions">
                <button
                    class={`thread-act ${liked ? 'active' : ''}`}
                    onClick={doLike}
                    title="Like · mantén pulsado para reacciones"
                    {...longPressLike}
                >
                    <i class={`${liked ? 'fas' : 'far'} fa-heart`}></i> {likes}
                </button>
                <button class="thread-act" onClick={() => setCommentsOpen(o => !o)} title="Comentar">
                    <i class="far fa-comment"></i> {commentsCount}
                </button>
                <div class="thread-act-wrap">
                    <button class="thread-act" onClick={() => setShowEmojiPicker(s => !s)} title="Reaccionar">
                        <i class="far fa-face-smile"></i>
                    </button>
                    {showEmojiPicker && (
                        <div class="emoji-picker">
                            {REACTION_EMOJIS.map(e => (
                                <button key={e} class="emoji-btn" onClick={() => doReaction(e)}>{e}</button>
                            ))}
                        </div>
                    )}
                </div>
                <button class={`thread-act ${bookmarked ? 'active' : ''}`} onClick={doBookmark} title={bookmarked ? 'Quitar marcador' : 'Guardar'}>
                    <i class={`${bookmarked ? 'fas' : 'far'} fa-bookmark`}></i>
                </button>
                <button class="thread-act" onClick={doShare} title="Compartir">
                    <i class="fas fa-share-nodes"></i>
                </button>
                <button class="thread-act" onClick={() => setQrOpen(true)} title="Compartir por QR">
                    <i class="fas fa-qrcode"></i>
                </button>
                {currentUserId && (
                    <button class="thread-act" onClick={() => setReposting(true)} title="Repostear a otro foro">
                        <i class="fas fa-retweet"></i>
                    </button>
                )}
                {isMine && (
                    <button class="thread-act" onClick={() => setInviteOpen(true)} title="Invitar colaboradores">
                        <i class="fas fa-handshake-simple"></i>
                    </button>
                )}
                {currentUserId && !isMine && (
                    <button class="thread-act" onClick={() => setReportOpen(true)} title="Reportar">
                        <i class="fas fa-flag"></i>
                    </button>
                )}
            </footer>

            {reposting && (
                <RepostModal
                    content={thread.content}
                    author={displayName}
                    currentForumId={thread.forum_id}
                    onClose={() => setReposting(false)}
                />
            )}

            {qrOpen && (
                <QRShareModal
                    url={`/hilo?id=${thread.id}`}
                    title="Compartir hilo"
                    onClose={() => setQrOpen(false)}
                />
            )}

            {inviteOpen && (
                <InviteCollaboratorModal
                    threadId={thread.id}
                    onClose={() => { setInviteOpen(false); fetchCollaborators(thread.id).then(setCollaborators); }}
                />
            )}

            {reportOpen && (
                <ReportModal
                    targetType="thread"
                    targetId={thread.id}
                    onClose={() => setReportOpen(false)}
                />
            )}

            {commentsOpen && (
                <InlineComments
                    threadId={thread.id}
                    currentUserId={currentUserId}
                    onCountChange={setCommentsCount}
                />
            )}
        </article>
    );
}

function celebrate() {
    // Colores tomados de la paleta activa (respeta tema claro/oscuro)
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim() || '#e8893f';
    const accent2 = css.getPropertyValue('--accent-2').trim() || '#84a981';
    confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 },
        colors: [accent, accent2, '#f3eee6'],
    });
}

function InlineComments({ threadId, currentUserId, onCountChange }: {
    threadId: string; currentUserId: string | null; onCountChange: (n: number) => void;
}) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        fetchComments(threadId).then(list => {
            if (!alive) return;
            setComments(list); onCountChange(list.length); setLoading(false);
        });
        return () => { alive = false; };
    }, [threadId]);

    const submit = async (html: string, parentId: string | null = null) => {
        const plain = html.replace(/<[^>]+>/g, '').trim();
        if (!plain || !currentUserId) return;
        setPosting(true);
        const ok = await insertComment(threadId, html, parentId);
        if (ok) {
            const fresh = await fetchComments(threadId);
            setComments(fresh); onCountChange(fresh.length);
            setReplyingTo(null);
        } else {
            toast.error('No se pudo publicar');
        }
        setPosting(false);
    };

    // Agrupar por parent_id para árbol (un solo nivel de anidación; las
    // respuestas a respuestas se aplanan en el nivel del padre).
    const tree = useMemo(() => {
        const roots: Comment[] = [];
        const childrenMap = new Map<string, Comment[]>();
        for (const c of comments) {
            if (c.parent_id) {
                const arr = childrenMap.get(c.parent_id) || [];
                arr.push(c);
                childrenMap.set(c.parent_id, arr);
            } else {
                roots.push(c);
            }
        }
        return { roots, childrenMap };
    }, [comments]);

    const renderComment = (c: Comment, isReply = false) => {
        const name = c.author?.username || `Invitado #${c.author_id.slice(0, 6)}`;
        const isMine = currentUserId && c.author_id === currentUserId;
        const children = tree.childrenMap.get(c.id) || [];
        // Si el contenido es HTML (empieza con tag) sanitizamos, si no parseamos
        // como texto plano (compatibilidad con comentarios antiguos pre-editor).
        const looksLikeHtml = /^<[a-z]/i.test(c.content.trim());
        const rendered = looksLikeHtml
            ? sanitizeCommentHtml(c.content)
            : sanitizeCommentHtml(parseRichText(c.content));

        return (
            <div class={`comment${isReply ? ' is-reply' : ''}`} key={c.id}>
                <div class="comment-avatar">
                    <Avatar user={c.author ? { id: c.author.id, username: c.author.username, pfp: c.author.pfp } : { id: c.author_id }} size={isReply ? 28 : 34} />
                </div>
                <div class="comment-body">
                    <div class="comment-meta">
                        {c.author?.username
                            ? <a href={`/perfil?u=${c.author.username}`}><strong>{name}</strong></a>
                            : <strong>{name}</strong>}
                        <small>{timeAgo(c.created_at)}</small>
                        {isMine && (
                            <button class="comment-del" onClick={async () => {
                                if (!confirm('¿Borrar comentario?')) return;
                                if (await deleteComment(c.id)) {
                                    const next = comments.filter(x => x.id !== c.id && x.parent_id !== c.id);
                                    setComments(next); onCountChange(next.length);
                                    toast.success('Comentario borrado');
                                }
                            }} title="Borrar"><i class="fas fa-trash"></i></button>
                        )}
                    </div>
                    <div class="comment-text rich" dangerouslySetInnerHTML={{ __html: rendered }} />
                    <CommentReactions commentId={c.id} />
                    {currentUserId && !isReply && (
                        <button
                            class="comment-reply-btn"
                            onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                        >
                            <i class="fas fa-reply"></i> {replyingTo === c.id ? 'Cancelar' : 'Responder'}
                        </button>
                    )}
                    {replyingTo === c.id && (
                        <div class="comment-reply-editor">
                            <RichCommentEditor
                                placeholder={`Responder a ${name}…`}
                                submitLabel="Responder"
                                onSubmit={(html) => submit(html, c.id)}
                                onCancel={() => setReplyingTo(null)}
                                initialExpanded
                                autoFocus
                                submitting={posting}
                                compact
                            />
                        </div>
                    )}
                    {children.length > 0 && (
                        <div class="comment-replies">
                            {children.map(child => renderComment(child, true))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div class="comments">
            {loading && (
                <>
                    <div class="skeleton skeleton-comment"></div>
                    <div class="skeleton skeleton-comment"></div>
                </>
            )}
            {!loading && tree.roots.length === 0 && <div class="comments-empty">Sé el primero en comentar.</div>}
            {tree.roots.map(c => renderComment(c))}

            {currentUserId && (
                <div class="comment-composer-rich">
                    <RichCommentEditor
                        placeholder="Escribe un comentario…"
                        submitLabel="Comentar"
                        onSubmit={(html) => submit(html, null)}
                        submitting={posting}
                    />
                </div>
            )}
        </div>
    );
}
