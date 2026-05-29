import { useEffect, useRef, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession, userLabel } from '../lib/auth';
import { fetchForums, insertThread, type Forum, type Thread } from '../lib/forum';
import { createPoll } from '../lib/polls';
import { uploadAttachment, type Attachment } from '../lib/attachments';
import { toast } from '../lib/toast';
import { requireAuthOrPrompt } from '../lib/auth-gate';
import { useDraft } from '../lib/hooks';
import MentionTextarea from './MentionTextarea';
import PollCreator, { type PollDraft } from './PollCreator';
import Avatar from './Avatar';

interface Props {
    defaultForum?: Forum | null;
    onPosted: (thread: Thread) => void;
}

/**
 * Composer inline tipo Twitter/Facebook:
 * - Estado colapsado: una barra delgada con avatar + placeholder
 * - Click → expande mostrando textarea grande + toolbar + selector de foro
 * - ESC o click fuera (con campo vacío) → vuelve a colapsar
 */
export default function InlineComposer({ defaultForum, onPosted }: Props) {
    const { user } = useSession();
    const [forums, setForums] = useState<Forum[]>([]);
    const [targetForumId, setTargetForumId] = useState<string>(defaultForum?.id || '');
    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [videoUrl, setVideoUrl] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [audioFile, setAudioFile] = useState<Attachment | null>(null);
    const [pollDraft, setPollDraft] = useState<PollDraft | null>(null);
    const [showVideo, setShowVideo] = useState(false);
    const [showLink, setShowLink] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [uploadingImg, setUploadingImg] = useState(false);
    const [uploadingAudio, setUploadingAudio] = useState(false);
    const [draftRestored, setDraftRestored] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    const { clearDraft } = useDraft(
        'inline-compose',
        { content, videoUrl, linkUrl, pollDraft, targetForumId },
        (saved) => {
            if (saved.content && saved.content.length > 0) {
                setContent(saved.content);
                if (saved.videoUrl) { setVideoUrl(saved.videoUrl); setShowVideo(true); }
                if (saved.linkUrl) { setLinkUrl(saved.linkUrl); setShowLink(true); }
                if (saved.pollDraft) setPollDraft(saved.pollDraft);
                if (saved.targetForumId) setTargetForumId(saved.targetForumId);
                setDraftRestored(true);
                setExpanded(true);
            }
        },
    );

    useEffect(() => {
        fetchForums().then(fs => {
            setForums(fs);
            if (!targetForumId && fs[0]) {
                const general = fs.find(f => f.slug === 'general') || fs[0];
                setTargetForumId(general.id);
            }
        });
    }, []);

    // Auto-cerrar si vacío + click fuera
    useEffect(() => {
        if (!expanded) return;
        const onClickOut = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                const empty = !content.trim() && attachments.length === 0
                    && !videoUrl && !linkUrl && !audioFile && !pollDraft;
                if (empty) setExpanded(false);
            }
        };
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                const empty = !content.trim() && attachments.length === 0
                    && !videoUrl && !linkUrl && !audioFile && !pollDraft;
                if (empty) setExpanded(false);
            }
        };
        document.addEventListener('mousedown', onClickOut);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onClickOut);
            document.removeEventListener('keydown', onEsc);
        };
    }, [expanded, content, attachments.length, videoUrl, linkUrl, audioFile, pollDraft]);

    const expand = () => {
        if (!requireAuthOrPrompt('publicar', user?.id ?? null)) return;
        setExpanded(true);
    };

    const handleImage = async (e: any) => {
        const files = Array.from(e.target.files || []) as File[];
        if (!files.length) return;
        if (attachments.length + files.length > 4) { toast.error('Máximo 4 imágenes'); return; }
        setUploadingImg(true);
        for (const f of files) {
            const r = await uploadAttachment(f);
            if (r.ok && r.attachment) setAttachments(a => [...a, r.attachment!]);
            else toast.error(`${f.name}: ${r.reason}`);
        }
        setUploadingImg(false);
        e.target.value = '';
    };

    const handleAudio = async (e: any) => {
        const f = e.target.files?.[0] as File | undefined;
        if (!f) return;
        setUploadingAudio(true);
        const r = await uploadAttachment(f);
        setUploadingAudio(false);
        if (r.ok && r.attachment) setAudioFile(r.attachment);
        else toast.error(r.reason || 'Error');
        e.target.value = '';
    };

    // Pegar imagen desde portapapeles
    const handlePaste = async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items || [];
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.type.startsWith('image/')) {
                const f = it.getAsFile();
                if (f) {
                    e.preventDefault();
                    const ext = (f.type.split('/')[1] || 'png');
                    const file = new File([f], `paste-${Date.now()}.${ext}`, { type: f.type });
                    if (attachments.length >= 4) return;
                    setUploadingImg(true);
                    const r = await uploadAttachment(file);
                    setUploadingImg(false);
                    if (r.ok && r.attachment) setAttachments(a => [...a, r.attachment!]);
                }
            }
        }
    };

    // Drag & drop
    const onDragOver = (e: DragEvent) => { e.preventDefault(); };
    const onDrop = async (e: DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer?.files || []);
        const imgs = files.filter(f => f.type.startsWith('image/'));
        if (imgs.length + attachments.length > 4) { toast.error('Máximo 4 imágenes'); return; }
        setUploadingImg(true);
        for (const f of imgs) {
            const r = await uploadAttachment(f);
            if (r.ok && r.attachment) setAttachments(a => [...a, r.attachment!]);
        }
        setUploadingImg(false);
    };

    const ytId = (() => {
        const m = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return m ? m[1] : null;
    })();

    const submit = async () => {
        if (!user) { requireAuthOrPrompt('publicar', null); return; }
        if (!targetForumId) { toast.error('Elige un foro'); return; }

        let finalContent = content.trim();
        if (ytId) finalContent += `\n\n📺 https://youtu.be/${ytId}`;
        if (audioFile) finalContent += `\n\n🎵 [${audioFile.name}](${audioFile.url})`;
        if (linkUrl.trim()) finalContent += `\n\n🔗 ${linkUrl.trim()}`;

        if (finalContent.length < 2 && attachments.length === 0 && !audioFile && !ytId && !linkUrl) {
            toast.error('Añade algo al post');
            return;
        }

        setBusy(true);
        const forum = forums.find(f => f.id === targetForumId)!;
        const res = await insertThread(finalContent, forum.slug, targetForumId, attachments);
        if (!res.ok) {
            toast.error('No se publicó: ' + (res.reason || ''));
            setBusy(false);
            return;
        }
        if (pollDraft && pollDraft.question.trim() && pollDraft.options.filter(o => o.trim()).length >= 2) {
            await createPoll(res.id!, pollDraft.question.trim(), pollDraft.options, pollDraft.allowMultiple);
        }

        onPosted({
            id: res.id!,
            author_id: user.id,
            content: finalContent,
            category: forum.slug,
            forum_id: forum.id,
            created_at: new Date().toISOString(),
            edited_at: null,
            pinned_at: null,
            is_bot: false,
            attachments,
            author: { id: user.id, username: userLabel(user), pfp: null, role: null },
            likes_count: 0, liked_by_me: false, comments_count: 0,
        });

        // Reset
        setContent('');
        setAttachments([]);
        setVideoUrl('');
        setLinkUrl('');
        setAudioFile(null);
        setPollDraft(null);
        setShowVideo(false);
        setShowLink(false);
        clearDraft();
        setExpanded(false);
        setBusy(false);
        setDraftRestored(false);
        toast.success('¡Publicado!');
    };

    const targetForum = forums.find(f => f.id === targetForumId) || null;
    const meUser = user ? { id: user.id, username: userLabel(user), pfp: null } : null;

    if (!expanded) {
        return (
            <div class="inline-composer collapsed" ref={wrapRef}>
                <button class="inline-composer-bar" onClick={expand}>
                    <Avatar user={meUser as any} size={36} />
                    <span class="inline-composer-placeholder">
                        ¿Qué onda en <b>#{targetForum?.slug || 'general'}</b>? Échale un cuento…
                    </span>
                    <span class="inline-composer-quick-tools">
                        <i class="fas fa-image" title="Imagen"></i>
                        <i class="fas fa-video" title="Video"></i>
                        <i class="fas fa-square-poll-vertical" title="Encuesta"></i>
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div
            class="inline-composer expanded"
            ref={wrapRef}
            onPaste={handlePaste as any}
            onDragOver={onDragOver as any}
            onDrop={onDrop as any}
        >
            <header class="inline-composer-head">
                <Avatar user={meUser as any} size={36} />
                <div class="inline-composer-forum-pick">
                    <label>Publicar en</label>
                    <select value={targetForumId} onChange={(e: any) => setTargetForumId(e.currentTarget.value)}>
                        {forums.map(f => <option value={f.id}>#{f.slug} · {f.name}</option>)}
                    </select>
                </div>
                <button class="inline-composer-close" onClick={() => {
                    const empty = !content.trim() && attachments.length === 0 && !videoUrl && !linkUrl && !audioFile && !pollDraft;
                    if (empty) setExpanded(false);
                    else if (confirm('¿Descartar lo que escribiste?')) {
                        setContent(''); setAttachments([]); setVideoUrl(''); setLinkUrl('');
                        setAudioFile(null); setPollDraft(null); setShowVideo(false); setShowLink(false);
                        clearDraft(); setExpanded(false);
                    }
                }} aria-label="Cerrar">
                    <i class="fas fa-xmark"></i>
                </button>
            </header>

            {draftRestored && (
                <div class="compose-draft-banner">
                    <i class="fas fa-circle-check"></i>
                    <span>Borrador recuperado</span>
                    <button onClick={() => { setContent(''); clearDraft(); setDraftRestored(false); }}>Descartar</button>
                </div>
            )}

            <MentionTextarea
                value={content}
                onChange={setContent}
                placeholder="Escribe algo... @ menciona · # etiqueta · pega/arrastra imágenes"
                rows={3}
                maxLength={2000}
                disabled={busy}
                onSubmitShortcut={submit}
            />

            {attachments.length > 0 && (
                <div class="inline-composer-attachments">
                    {attachments.map((a, i) => (
                        <div class="attach-preview" key={a.url}>
                            <img src={a.url} alt={a.name} />
                            <button class="attach-x" onClick={() => setAttachments(arr => arr.filter((_, j) => j !== i))}>
                                <i class="fas fa-xmark"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {showVideo && (
                <div class="inline-composer-section">
                    <label>
                        <i class="fas fa-video"></i> Video de YouTube
                        <input type="url" class="compose-input"
                            placeholder="https://youtube.com/watch?v=..."
                            value={videoUrl}
                            onInput={(e: any) => setVideoUrl(e.currentTarget.value)} />
                    </label>
                    {ytId && (
                        <div class="compose-video-preview">
                            <img src={`https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`} alt="Preview" />
                            <small>✓ Video detectado</small>
                        </div>
                    )}
                </div>
            )}

            {audioFile && (
                <div class="inline-composer-section">
                    <div class="compose-audio-preview">
                        <i class="fas fa-file-audio"></i>
                        <span>{audioFile.name}</span>
                        <button class="attach-x" onClick={() => setAudioFile(null)}><i class="fas fa-xmark"></i></button>
                    </div>
                </div>
            )}

            {showLink && (
                <div class="inline-composer-section">
                    <label>
                        <i class="fas fa-link"></i> Link
                        <input type="url" class="compose-input"
                            placeholder="https://..."
                            value={linkUrl}
                            onInput={(e: any) => setLinkUrl(e.currentTarget.value)} />
                    </label>
                </div>
            )}

            {pollDraft && (
                <PollCreator value={pollDraft} onChange={setPollDraft} onRemove={() => setPollDraft(null)} />
            )}

            <footer class="inline-composer-foot">
                <div class="inline-composer-tools">
                    <label class={`compose-tool ${uploadingImg ? 'busy' : ''}`} title="Imagen">
                        <i class={`fas ${uploadingImg ? 'fa-circle-notch fa-spin' : 'fa-image'}`}></i>
                        <input type="file" accept="image/*" multiple onChange={handleImage}
                            disabled={uploadingImg || attachments.length >= 4} style="display:none;" />
                    </label>
                    <button class={`compose-tool ${showVideo ? 'active' : ''}`}
                        onClick={() => setShowVideo(v => !v)} title="Video YouTube">
                        <i class="fas fa-video"></i>
                    </button>
                    <label class={`compose-tool ${uploadingAudio ? 'busy' : ''}`} title="Audio">
                        <i class={`fas ${uploadingAudio ? 'fa-circle-notch fa-spin' : 'fa-music'}`}></i>
                        <input type="file" accept="audio/*" onChange={handleAudio}
                            disabled={uploadingAudio} style="display:none;" />
                    </label>
                    <button class={`compose-tool ${pollDraft ? 'active' : ''}`}
                        onClick={() => setPollDraft(pollDraft ? null : { question: '', options: ['', ''], allowMultiple: false })}
                        title="Encuesta">
                        <i class="fas fa-square-poll-vertical"></i>
                    </button>
                    <button class={`compose-tool ${showLink ? 'active' : ''}`}
                        onClick={() => setShowLink(v => !v)} title="Link">
                        <i class="fas fa-link"></i>
                    </button>
                </div>
                <span class="composer-count">{content.length}/2000</span>
                <button class="auth-btn primary" onClick={submit}
                    disabled={busy || (content.trim().length < 2 && attachments.length === 0 && !audioFile && !ytId && !linkUrl)}>
                    <i class="fas fa-paper-plane"></i> {busy ? 'Publicando…' : 'Publicar'}
                </button>
            </footer>
        </div>
    );
}
