import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession, userLabel } from '../lib/auth';
import {
    fetchForums, insertThread, type Forum, type Thread,
} from '../lib/forum';
import { createPoll } from '../lib/polls';
import { uploadAttachment, type Attachment } from '../lib/attachments';
import { toast } from '../lib/toast';
import MentionTextarea from './MentionTextarea';
import PollCreator, { type PollDraft } from './PollCreator';
import { useDraft } from '../lib/hooks';

type Section = 'imagen' | 'video' | 'audio' | 'encuesta' | 'link';

interface Props {
    defaultForum?: Forum | null;
    onClose: () => void;
    onPosted: (thread: Thread) => void;
    preset?: 'plain' | 'image' | 'video';
}

export default function ComposeModal({ defaultForum, onClose, onPosted, preset = 'plain' }: Props) {
    const { user } = useSession();
    const [forums, setForums] = useState<Forum[]>([]);
    const [targetForumId, setTargetForumId] = useState<string>(defaultForum?.id || '');
    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [videoUrl, setVideoUrl] = useState('');
    const [videoFile, setVideoFile] = useState<Attachment | null>(null);
    const [audioFile, setAudioFile] = useState<Attachment | null>(null);
    const [linkUrl, setLinkUrl] = useState('');
    const [pollDraft, setPollDraft] = useState<PollDraft | null>(null);
    const [active, setActive] = useState<Section | null>(null);
    const [busy, setBusy] = useState(false);
    const [uploadingImg, setUploadingImg] = useState(false);
    const [uploadingAudio, setUploadingAudio] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [draftRestored, setDraftRestored] = useState(false);

    // Auto-save del borrador
    const { clearDraft } = useDraft(
        'compose',
        { content, videoUrl, linkUrl, pollDraft },
        (saved) => {
            if (saved.content && saved.content.length > 0) {
                setContent(saved.content);
                if (saved.videoUrl) setVideoUrl(saved.videoUrl);
                if (saved.linkUrl) setLinkUrl(saved.linkUrl);
                if (saved.pollDraft) setPollDraft(saved.pollDraft);
                setDraftRestored(true);
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
        if (preset === 'video') setActive('video');
        if (preset === 'image') {
            // Auto-abre el file picker tras montar
            setTimeout(() => {
                const inp = document.querySelector('.compose-tool input[type=file][accept^="image/"]') as HTMLInputElement | null;
                inp?.click();
            }, 150);
        }
    }, []);

    const targetForum = forums.find(f => f.id === targetForumId) || null;

    const handleImage = async (e: any) => {
        const files = Array.from(e.target.files || []) as File[];
        if (files.length === 0) return;
        if (attachments.length + files.length > 4) { toast.error('Máximo 4 imágenes'); return; }
        setUploadingImg(true);
        for (const file of files) {
            const res = await uploadAttachment(file);
            if (res.ok && res.attachment) setAttachments(a => [...a, res.attachment!]);
            else toast.error(`${file.name}: ${res.reason}`);
        }
        setUploadingImg(false);
        e.target.value = '';
    };

    const handleAudio = async (e: any) => {
        const f = e.target.files?.[0] as File | undefined;
        if (!f) return;
        setUploadingAudio(true);
        const res = await uploadAttachment(f);
        setUploadingAudio(false);
        if (res.ok && res.attachment) setAudioFile(res.attachment);
        else toast.error(res.reason || 'Error');
        e.target.value = '';
    };

    const handleVideoFile = async (e: any) => {
        const f = e.target.files?.[0] as File | undefined;
        if (!f) return;
        if (!f.type.startsWith('video/')) { toast.error('Sólo archivos de video'); return; }
        setUploadingVideo(true);
        const res = await uploadAttachment(f);
        setUploadingVideo(false);
        if (res.ok && res.attachment) {
            setVideoFile({ ...res.attachment, type: 'video' });
            toast.success('Video subido');
        } else {
            toast.error(res.reason || 'Error al subir');
        }
        e.target.value = '';
    };

    const extractYouTubeId = (url: string): string | null => {
        const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return m ? m[1] : null;
    };
    const ytId = extractYouTubeId(videoUrl.trim());

    const submit = async () => {
        if (!user) { toast.error('Inicia sesión'); return; }
        if (!targetForumId) { toast.error('Elige un foro'); return; }

        // Construir contenido final con video/audio/link embebidos como markdown
        let finalContent = content.trim();
        if (ytId) finalContent += `\n\n📺 https://youtu.be/${ytId}`;
        if (audioFile) finalContent += `\n\n🎵 [${audioFile.name}](${audioFile.url})`;
        if (linkUrl.trim()) finalContent += `\n\n🔗 ${linkUrl.trim()}`;

        // El video subido va como attachment (se renderiza con <video> en ThreadCard)
        const allAttachments = videoFile ? [...attachments, videoFile] : attachments;

        if (finalContent.length < 2 && allAttachments.length === 0 && !audioFile && !ytId && !linkUrl) {
            toast.error('Añade contenido al post');
            return;
        }

        setBusy(true);
        const forum = forums.find(f => f.id === targetForumId)!;
        const res = await insertThread(finalContent, forum.slug, targetForumId, allAttachments);
        if (!res.ok) {
            toast.error('No se pudo publicar: ' + (res.reason || ''));
            setBusy(false);
            return;
        }
        // Crear encuesta si hay
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
            attachments: allAttachments,
            author: { id: user.id, username: userLabel(user), pfp: null, role: null },
            likes_count: 0, liked_by_me: false, comments_count: 0,
        });
        toast.success('¡Publicado!');
        clearDraft();
        setBusy(false);
        onClose();
    };

    if (!user) {
        return (
            <div class="modal-overlay" onClick={onClose}>
                <div class="modal small" onClick={(e: any) => e.stopPropagation()}>
                    <header class="modal-head">
                        <h3><i class="fas fa-right-to-bracket"></i> Necesitas sesión</h3>
                        <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                    </header>
                    <div class="modal-body">
                        <p>Inicia sesión arriba para publicar. Puedes entrar como invitado en 1 click.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal compose-modal" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-feather-pointed"></i> Nueva publicación</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>

                <div class="modal-body compose-body">
                    {/* Selector de foro destino */}
                    <div class="compose-forum-select">
                        <label>
                            <i class="fas fa-hashtag"></i>
                            <span>Publicar en</span>
                            <select value={targetForumId} onChange={(e: any) => setTargetForumId(e.currentTarget.value)}>
                                {forums.map(f => (
                                    <option value={f.id}>#{f.slug} · {f.name}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {draftRestored && (
                        <div class="compose-draft-banner">
                            <i class="fas fa-circle-check"></i>
                            <span>Borrador recuperado</span>
                            <button onClick={() => { setContent(''); clearDraft(); setDraftRestored(false); }}>
                                Descartar
                            </button>
                        </div>
                    )}

                    {/* Textarea principal con menciones */}
                    <MentionTextarea
                        value={content}
                        onChange={setContent}
                        placeholder="¿Qué pasa en Tres Valles? Usa @ para mencionar, # para etiquetar. Soporta markdown (**negrita** *cursiva*)"
                        rows={4}
                        maxLength={2000}
                        disabled={busy}
                        onSubmitShortcut={submit}
                    />

                    {/* Previews / secciones expandidas */}
                    {attachments.length > 0 && (
                        <div class="compose-preview">
                            <div class="compose-preview-head">
                                <i class="fas fa-image"></i> Imágenes ({attachments.length}/4)
                            </div>
                            <div class="attach-preview-row">
                                {attachments.map((a, i) => (
                                    <div class="attach-preview" key={a.url}>
                                        <img src={a.url} alt={a.name} />
                                        <button class="attach-x" onClick={() => setAttachments(arr => arr.filter((_, j) => j !== i))}>
                                            <i class="fas fa-xmark"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {active === 'video' && (
                        <div class="compose-preview">
                            <div class="compose-preview-head"><i class="fas fa-video"></i> Video</div>

                            {/* Opción A · subir archivo de video */}
                            {!videoFile ? (
                                <label class={`video-upload-zone ${uploadingVideo ? 'busy' : ''}`}>
                                    <input type="file" accept="video/mp4,video/webm,video/quicktime"
                                        onChange={handleVideoFile} disabled={uploadingVideo} hidden />
                                    <i class={`fas ${uploadingVideo ? 'fa-circle-notch fa-spin' : 'fa-cloud-arrow-up'}`}></i>
                                    <strong>{uploadingVideo ? 'Subiendo…' : 'Subir archivo de video'}</strong>
                                    <small>MP4 / WebM · máx 50 MB</small>
                                </label>
                            ) : (
                                <div class="video-upload-preview">
                                    <video src={videoFile.url} controls playsInline class="compose-video-el" />
                                    <div class="video-upload-meta">
                                        <span><i class="fas fa-file-video"></i> {videoFile.name}</span>
                                        <button class="attach-x" onClick={() => setVideoFile(null)} title="Quitar video">
                                            <i class="fas fa-xmark"></i>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Separador */}
                            <div class="compose-or"><span>o pega un link de YouTube</span></div>

                            {/* Opción B · YouTube URL */}
                            <input
                                type="url"
                                inputMode="url"
                                placeholder="https://youtube.com/watch?v=..."
                                value={videoUrl}
                                onInput={(e: any) => setVideoUrl(e.currentTarget.value)}
                                class="compose-input"
                            />
                            {ytId && (
                                <div class="compose-video-preview">
                                    <img src={`https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`} alt="Preview" />
                                    <small>✓ Video detectado: <code>{ytId}</code></small>
                                </div>
                            )}
                        </div>
                    )}

                    {audioFile && (
                        <div class="compose-preview">
                            <div class="compose-preview-head"><i class="fas fa-music"></i> Audio</div>
                            <div class="compose-audio-preview">
                                <i class="fas fa-file-audio"></i>
                                <span>{audioFile.name}</span>
                                <button class="attach-x" onClick={() => setAudioFile(null)}><i class="fas fa-xmark"></i></button>
                            </div>
                        </div>
                    )}

                    {active === 'link' && (
                        <div class="compose-preview">
                            <div class="compose-preview-head"><i class="fas fa-link"></i> Link</div>
                            <input
                                type="url"
                                placeholder="https://..."
                                value={linkUrl}
                                onInput={(e: any) => setLinkUrl(e.currentTarget.value)}
                                class="compose-input"
                            />
                        </div>
                    )}

                    {pollDraft && (
                        <PollCreator value={pollDraft} onChange={setPollDraft} onRemove={() => setPollDraft(null)} />
                    )}

                    {/* Toolbar de tipos de contenido */}
                    <div class="compose-toolbar">
                        <label class={`compose-tool ${uploadingImg ? 'busy' : ''}`} title="Imagen">
                            <i class={`fas ${uploadingImg ? 'fa-circle-notch fa-spin' : 'fa-image'}`}></i>
                            <span>Imagen</span>
                            <input type="file" accept="image/*" multiple onChange={handleImage} disabled={uploadingImg || attachments.length >= 4} style="display:none;" />
                        </label>
                        <button class={`compose-tool ${active === 'video' ? 'active' : ''}`} onClick={() => setActive(active === 'video' ? null : 'video')} title="Video YouTube">
                            <i class="fas fa-video"></i><span>Video</span>
                        </button>
                        <label class={`compose-tool ${uploadingAudio ? 'busy' : ''}`} title="Audio">
                            <i class={`fas ${uploadingAudio ? 'fa-circle-notch fa-spin' : 'fa-music'}`}></i>
                            <span>Audio</span>
                            <input type="file" accept="audio/*" onChange={handleAudio} disabled={uploadingAudio} style="display:none;" />
                        </label>
                        <button class={`compose-tool ${pollDraft ? 'active' : ''}`} onClick={() => setPollDraft(pollDraft ? null : { question: '', options: ['', ''], allowMultiple: false })} title="Encuesta">
                            <i class="fas fa-square-poll-vertical"></i><span>Encuesta</span>
                        </button>
                        <button class={`compose-tool ${active === 'link' ? 'active' : ''}`} onClick={() => setActive(active === 'link' ? null : 'link')} title="Link">
                            <i class="fas fa-link"></i><span>Link</span>
                        </button>
                    </div>
                </div>

                <footer class="compose-footer">
                    <span class="composer-count">{content.length}/2000</span>
                    <button class="auth-btn ghost small" onClick={onClose} disabled={busy}>Cancelar</button>
                    <button class="auth-btn primary" onClick={submit} disabled={busy}>
                        <i class="fas fa-paper-plane"></i> {busy ? 'Publicando…' : 'Publicar'}
                    </button>
                </footer>
            </div>
        </div>
    );
}
