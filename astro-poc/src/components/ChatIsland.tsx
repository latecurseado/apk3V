import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession, userLabel } from '../lib/auth';
import { searchProfiles } from '../lib/friends';
import { subscribePresence } from '../lib/presence';
import {
    fetchMyDmThreads, fetchMessages, sendDmMessage, sendDmMessageDetailed, sendDmMessageWithExpiry, markThreadRead,
    getOrCreateDmWith, fetchMessageReactions, toggleDmReaction,
    editDmMessage, deleteDmMessage, isThreadMuted, setThreadMuted,
    uploadDmFile, togglePinMessage, fetchPinnedMessages, forwardMessage,
    fetchThreadSettings, type DmThreadSettings,
    type DmThread, type DmMessage, type DmReaction, type DmAttachment,
} from '../lib/dms';
import GifPicker from './GifPicker';
import ChatSettingsModal from './ChatSettingsModal';
import StickerPicker from './StickerPicker';
import StickerView from './StickerView';
import { stickerMarker, parseStickerOnly } from '../lib/stickers';
import CreateGroupModal from './CreateGroupModal';
import GroupChatView from './GroupChatView';
import BotChatView from './BotChatView';
import { fetchMyGroups, addChannelToCommunity, type DmGroup } from '../lib/groups';
import { timeAgo } from '../lib/forum';
import { parseRichText } from '../lib/rich-text';
import { sanitizeCmsHtml } from '../lib/sanitize';
import { openLightbox } from '../lib/lightbox';
import type { Profile } from '../lib/forum';
import { toast } from '../lib/toast';
import { joinTypingChannel, subscribeTyping, broadcastTyping } from '../lib/dm-presence';
import { useLongPress } from '../lib/hooks';
import Avatar from './Avatar';
import Skeleton from './Skeleton';
import LinkPreview from './LinkPreview';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '😢', '🙏', '🎉'];

export default function ChatIsland() {
    const { user, ready } = useSession();
    const [threads, setThreads] = useState<DmThread[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [messages, setMessages] = useState<DmMessage[]>([]);
    const [reactionsMap, setReactionsMap] = useState<Record<string, DmReaction[]>>({});
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [draft, setDraft] = useState('');
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
    const [typingIds, setTypingIds] = useState<Set<string>>(new Set());
    const [replyTo, setReplyTo] = useState<DmMessage | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState<{ msgId: string | null; forCompose: boolean }>({ msgId: null, forCompose: false });
    const [chatSearch, setChatSearch] = useState('');
    const [showChatSearch, setShowChatSearch] = useState(false);
    const [muted, setMuted] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [recording, setRecording] = useState<{ start: number } | null>(null);
    const [showThreadOptions, setShowThreadOptions] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groups, setGroups] = useState<DmGroup[]>([]);
    const [activeGroup, setActiveGroup] = useState<DmGroup | null>(null);
    const [activeBot, setActiveBot] = useState(false);
    const [expandedComms, setExpandedComms] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!user) return;
        fetchMyGroups().then(setGroups);
    }, [user?.id]);

    const refreshGroups = () => { fetchMyGroups().then(setGroups); };
    const toggleComm = (id: string) => setExpandedComms(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const addChannel = async (communityId: string) => {
        const name = prompt('Nombre del nuevo canal:')?.trim();
        if (!name) return;
        const id = await addChannelToCommunity(communityId, name);
        if (id) { toast.success('Canal creado'); refreshGroups(); setExpandedComms(p => new Set(p).add(communityId)); }
        else toast.error('No se pudo crear el canal (¿eres owner/admin?)');
    };
    const [showSettings, setShowSettings] = useState(false);
    const [threadSettings, setThreadSettings] = useState<DmThreadSettings | null>(null);
    const [pinned, setPinned] = useState<DmMessage[]>([]);
    const [forwarding, setForwarding] = useState<DmMessage | null>(null);
    const composerRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordChunksRef = useRef<Blob[]>([]);

    // Modo voz · lee mensajes entrantes en alto (TTS) y autorreproduce notas de
    // voz → el chat de texto se siente como un chat de voz, sin llamada.
    const [voiceMode, setVoiceMode] = useState(false);
    const voiceModeRef = useRef(false);
    const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
    const ttsAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

    useEffect(() => {
        try { const v = localStorage.getItem('tv-chat-voicemode') === '1'; setVoiceMode(v); voiceModeRef.current = v; } catch { /* */ }
        if (ttsAvailable) {
            const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
            load();
            window.speechSynthesis.addEventListener?.('voiceschanged', load);
        }
    }, []);

    const toggleVoiceMode = () => {
        setVoiceMode(prev => {
            const next = !prev;
            voiceModeRef.current = next;
            try { localStorage.setItem('tv-chat-voicemode', next ? '1' : '0'); } catch { /* */ }
            if (ttsAvailable && !next) window.speechSynthesis.cancel();
            if (next) toast.success('Modo voz: te leeré los mensajes en alto 🔊');
            return next;
        });
    };

    const speakIncoming = (text: string) => {
        if (!voiceModeRef.current || !ttsAvailable) return;
        const clean = (text || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '').replace(/\s{2,}/g, ' ').trim();
        if (!clean) return;
        try {
            const synth = window.speechSynthesis;
            const u = new SpeechSynthesisUtterance(clean);
            u.lang = 'es-MX';
            const v = voicesRef.current.find(vc => /es[-_]MX/i.test(vc.lang)) || voicesRef.current.find(vc => vc.lang.toLowerCase().startsWith('es'));
            if (v) u.voice = v;
            u.rate = 1.03; u.pitch = 1.05;
            synth.speak(u);
        } catch { /* */ }
    };

    const activeThread = threads.find(t => t.id === activeId) || null;

    /* ───── URL syncing ───── */
    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        const c = sp.get('c');
        if (c) setActiveId(c);
        const toUser = sp.get('to');
        if (toUser && user) {
            (async () => {
                const tid = await getOrCreateDmWith(toUser);
                if (tid) {
                    setActiveId(tid);
                    setThreads(await fetchMyDmThreads());
                    const u = new URL(window.location.href);
                    u.searchParams.delete('to');
                    u.searchParams.set('c', tid);
                    window.history.replaceState({}, '', u);
                }
            })();
        }
    }, [user?.id]);

    /* ───── Threads list ───── */
    useEffect(() => {
        if (!user) return;
        fetchMyDmThreads().then(setThreads);
    }, [user?.id]);

    /* ───── Active thread → messages + reactions + mute + pinned + settings ───── */
    useEffect(() => {
        if (!activeId) { setMessages([]); setPinned([]); setThreadSettings(null); return; }
        setLoadingMsgs(true);
        Promise.all([
            fetchMessages(activeId),
            fetchThreadSettings(activeId),
            fetchPinnedMessages(activeId),
        ]).then(async ([ms, s, pin]) => {
            setMessages(ms);
            setThreadSettings(s);
            setMuted(s.muted);
            setPinned(pin);
            const rx = await fetchMessageReactions(ms.map(m => m.id));
            setReactionsMap(rx);
            setLoadingMsgs(false);
            await markThreadRead(activeId);
            setThreads(ts => ts.map(t => t.id === activeId ? { ...t, unread_count: 0 } : t));
        });
    }, [activeId]);

    /* ───── Realtime: messages + reactions
            (subscripción estable · NO depende de messages.length para evitar recrearla en cada nuevo mensaje) ───── */
    useEffect(() => {
        if (!user || !activeId) return;
        const activeIdRef = activeId;
        const ch = supabase
            .channel(`tv-dms-${user.id}-${activeIdRef}`)
            .on('postgres_changes' as any,
                { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `dm_thread_id=eq.${activeIdRef}` },
                async (payload: any) => {
                    const msg = payload.new as DmMessage;
                    // Append optimista en lugar de re-fetch completo
                    setMessages(prev => {
                        if (prev.some(m => m.id === msg.id)) return prev;
                        const next = [...prev, { ...msg, attachments: Array.isArray(msg.attachments) ? msg.attachments : [] }];
                        return next;
                    });
                    if (msg.sender_id !== user.id) {
                        await markThreadRead(activeIdRef);
                        // Modo voz: lee el texto en alto / autorreproduce la nota de voz entrante
                        if (voiceModeRef.current) {
                            if (msg.message_type === 'voice' && msg.attachments?.[0]?.url) {
                                try { new Audio(msg.attachments[0].url).play().catch(() => {}); } catch { /* */ }
                            } else if (msg.content) {
                                speakIncoming(msg.content);
                            }
                        }
                    }
                    // Actualiza preview en sidebar (sin forzar refetch completo si ya lo tenemos)
                    setThreads(ts => ts.map(t => t.id === activeIdRef
                        ? { ...t, last_msg: msg.content, last_at: msg.created_at, unread_count: msg.sender_id === user.id ? 0 : (t.unread_count || 0) }
                        : t,
                    ));
                })
            .on('postgres_changes' as any,
                { event: 'UPDATE', schema: 'public', table: 'dm_messages', filter: `dm_thread_id=eq.${activeIdRef}` },
                (payload: any) => {
                    const updated = payload.new as DmMessage;
                    setMessages(prev => prev.map(m => m.id === updated.id
                        ? { ...updated, attachments: Array.isArray(updated.attachments) ? updated.attachments : [], parent: m.parent } as DmMessage
                        : m,
                    ));
                })
            .on('postgres_changes' as any,
                { event: 'DELETE', schema: 'public', table: 'dm_messages', filter: `dm_thread_id=eq.${activeIdRef}` },
                (payload: any) => {
                    const oldMsg = payload.old as DmMessage;
                    setMessages(prev => prev.filter(m => m.id !== oldMsg.id));
                })
            .on('postgres_changes' as any,
                { event: '*', schema: 'public', table: 'dm_message_reactions' },
                async () => {
                    setReactionsMap(prev => prev); // trigger refetch en próximo tick
                    const ids = (await supabase
                        .from('dm_messages')
                        .select('id')
                        .eq('dm_thread_id', activeIdRef)
                    ).data?.map((r: any) => r.id) || [];
                    const rx = await fetchMessageReactions(ids);
                    setReactionsMap(rx);
                })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [user?.id, activeId]);

    /* ───── Refresh threads list periódicamente (sin saturar realtime) ───── */
    useEffect(() => {
        if (!user) return;
        const tick = setInterval(async () => {
            setThreads(await fetchMyDmThreads());
        }, 30_000);
        return () => clearInterval(tick);
    }, [user?.id]);

    /* ───── Auto-scroll ───── */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, activeId]);

    /* ───── Typing channel ───── */
    useEffect(() => {
        if (!activeId || !user) return;
        const unsubChannel = joinTypingChannel(activeId, user.id);
        const unsubListener = subscribeTyping(activeId, setTypingIds);
        return () => { unsubListener(); unsubChannel(); };
    }, [activeId, user?.id]);

    /* ───── Search users to start chat ───── */
    useEffect(() => {
        const q = search.trim();
        if (q.length < 1) { setSearchResults([]); return; }
        const t = setTimeout(async () => {
            const list = await searchProfiles(q, 8);
            setSearchResults(list.filter(p => p.id !== user?.id));
        }, 200);
        return () => clearTimeout(t);
    }, [search, user?.id]);

    /* ───── Presence ───── */
    useEffect(() => subscribePresence(setOnlineIds), []);

    const startChatWith = async (otherId: string) => {
        const tid = await getOrCreateDmWith(otherId);
        if (!tid) { toast.error('No se pudo iniciar el chat'); return; }
        setActiveId(tid);
        setSearch('');
        setSearchResults([]);
        setThreads(await fetchMyDmThreads());
        const u = new URL(window.location.href);
        u.searchParams.set('c', tid);
        window.history.pushState({}, '', u);
    };

    /* ───── Send message (respeta disappearing) ───── */
    const send = async () => {
        const text = draft.trim();
        if (!text || !activeId) return;
        const previousDraft = draft;
        setDraft('');
        const parentId = replyTo?.id ?? null;
        setReplyTo(null);
        const expiresHrs = threadSettings?.auto_delete_after_hours || 0;
        if (expiresHrs > 0) {
            const result = await sendDmMessageWithExpiry(activeId, text, expiresHrs, { parentId });
            if (!result) {
                setDraft(previousDraft);
                toast.error('No se pudo enviar el mensaje');
            }
            return;
        }
        const result = await sendDmMessageDetailed(activeId, text, { parentId });
        if (!result.ok) {
            setDraft(previousDraft);
            // Detección específica: RLS rechaza con code 42501 / "new row violates row-level security"
            const msg = result.error || '';
            const isRls = result.code === '42501'
                || msg.includes('row-level security')
                || msg.includes('violates row-level security')
                || msg.includes('permission denied');
            if (isRls) {
                toast.error('Permiso denegado por Supabase RLS. El owner debe re-ejecutar supabase-all.sql.');
                console.warn('[dm] RLS rejected the insert · re-ejecuta supabase-all.sql en SQL Editor.');
            } else if (result.error === 'no_session') {
                toast.error('Tu sesión expiró · vuelve a entrar.');
            } else {
                toast.error('Error: ' + (msg || 'desconocido'));
            }
        }
    };

    /* ───── Upload image ───── */
    const handleImageFile = async (file: File) => {
        if (!activeId) return;
        setUploading(true);
        const att = await uploadDmFile(file, 'image');
        setUploading(false);
        if (!att) { toast.error('No se pudo subir la imagen'); return; }
        await sendDmMessage(activeId, '', {
            attachments: [att],
            parentId: replyTo?.id ?? null,
            messageType: 'image',
        });
        setReplyTo(null);
    };

    const onFileChange = (e: any) => {
        const f = e.target.files?.[0] as File | undefined;
        if (f) handleImageFile(f);
        e.target.value = '';
    };

    const onPaste = async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items || [];
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.type.startsWith('image/')) {
                const f = it.getAsFile();
                if (f) {
                    e.preventDefault();
                    handleImageFile(f);
                    break;
                }
            }
        }
    };

    /* ───── Voice recording ───── */
    const startRecording = async () => {
        if (!navigator.mediaDevices) { toast.error('Tu navegador no soporta grabación de audio'); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            recordChunksRef.current = [];
            mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
            mr.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' });
                const duration = Math.round((Date.now() - (recording?.start || 0)) / 1000);
                const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
                if (!activeId) return;
                setUploading(true);
                const att = await uploadDmFile(file, 'voice');
                setUploading(false);
                if (att) {
                    att.duration_seconds = duration;
                    await sendDmMessage(activeId, '', {
                        attachments: [att],
                        messageType: 'voice',
                    });
                }
            };
            mr.start();
            mediaRecorderRef.current = mr;
            setRecording({ start: Date.now() });
            if (navigator.vibrate) navigator.vibrate(15);
        } catch (e) {
            toast.error('No se pudo acceder al micrófono');
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        mediaRecorderRef.current = null;
        setRecording(null);
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.ondataavailable = null as any;
            mediaRecorderRef.current.onstop = null as any;
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }
        setRecording(null);
    };

    /* ───── Edit / Delete ───── */
    const startEdit = (msg: DmMessage) => {
        setEditingId(msg.id);
        setEditingText(msg.content);
    };
    const saveEdit = async () => {
        if (!editingId) return;
        const ok = await editDmMessage(editingId, editingText.trim());
        if (ok) { toast.success('Editado'); setEditingId(null); }
        else toast.error('Error');
    };
    const remove = async (id: string) => {
        if (!confirm('¿Borrar este mensaje?')) return;
        const ok = await deleteDmMessage(id);
        if (ok) toast.success('Mensaje borrado');
    };

    /* ───── Toggle mute ───── */
    const toggleMute = async () => {
        if (!activeId) return;
        const next = !muted;
        const ok = await setThreadMuted(activeId, next);
        if (ok) { setMuted(next); toast.success(next ? 'Silenciado' : 'Notificaciones activadas'); }
    };

    /* ───── Filter messages by search + expired ───── */
    const visibleMessages = useMemo(() => {
        const now = Date.now();
        const notExpired = messages.filter(m => !m.expires_at || new Date(m.expires_at).getTime() > now);
        const q = chatSearch.trim().toLowerCase();
        if (!q) return notExpired;
        return notExpired.filter(m => m.content?.toLowerCase().includes(q));
    }, [messages, chatSearch]);

    /* ───── Auto-purge expirados cada 60s + al cargar ───── */
    useEffect(() => {
        const purge = () => {
            const now = Date.now();
            setMessages(ms => ms.filter(m => !m.expires_at || new Date(m.expires_at).getTime() > now));
        };
        purge();
        const id = setInterval(purge, 60_000);
        return () => clearInterval(id);
    }, []);

    if (!ready) return <div class="cms-loading">Conectando…</div>;
    if (!user) {
        return (
            <div class="stub-state">
                <i class="fas fa-message"></i>
                <h2>Necesitas iniciar sesión</h2>
                <p>Los mensajes directos requieren cuenta.</p>
            </div>
        );
    }

    return (
        <div class="chat-layout">
            {/* ─── Sidebar de conversaciones ─── */}
            <aside class="chat-sidebar">
                <div class="disc-sidebar-head">
                    <h3><i class="fas fa-message"></i> Mensajes</h3>
                    <button
                        class="disc-icon-btn small"
                        onClick={() => setShowCreateGroup(true)}
                        title="Crear grupo o canal"
                    >
                        <i class="fas fa-circle-plus"></i>
                    </button>
                </div>
                {showCreateGroup && (
                    <CreateGroupModal
                        onClose={() => setShowCreateGroup(false)}
                        onCreated={async () => {
                            const fresh = await fetchMyGroups();
                            setGroups(fresh);
                            if (fresh[0]) setActiveGroup(fresh[0]);
                        }}
                    />
                )}

                {/* ─── Bot pineado arriba · siempre visible ─── */}
                <button
                    class={`chat-thread-row bot-pin ${activeBot ? 'active' : ''}`}
                    onClick={() => {
                        setActiveBot(true);
                        setActiveId(null);
                        setActiveGroup(null);
                    }}
                >
                    <div class="bot-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="chat-thread-info">
                        <strong>
                            TresVallesBot
                            <span class="bot-pin-tag"><i class="fas fa-thumbtack"></i></span>
                        </strong>
                        <small>Asistente IA · pregúntame lo que sea</small>
                    </div>
                    <span class="bot-pin-dot" title="Disponible 24/7"></span>
                </button>

                {groups.length > 0 && (() => {
                    const communities = groups.filter(g => g.kind === 'community');
                    const channelsByComm: Record<string, DmGroup[]> = {};
                    for (const g of groups) {
                        if (g.parent_id) (channelsByComm[g.parent_id] ||= []).push(g);
                    }
                    const plainGroups = groups.filter(g => g.kind !== 'community' && !g.parent_id);
                    const openGroup = (g: DmGroup) => { setActiveGroup(g); setActiveId(null); setActiveBot(false); };
                    return (
                        <div class="chat-groups-section">
                            {/* ── Comunidades (espacios con varios canales) ── */}
                            {communities.length > 0 && (
                                <>
                                    <h4 class="chat-section-title"><i class="fas fa-users-rectangle"></i> Comunidades</h4>
                                    {communities.map(comm => {
                                        const isOwner = comm.created_by === user?.id;
                                        const open = expandedComms.has(comm.id);
                                        return (
                                            <div key={comm.id} class="chat-community">
                                                <button class="chat-community-head" onClick={() => toggleComm(comm.id)}>
                                                    <span class="group-thumb"><i class="fas fa-users-rectangle"></i></span>
                                                    <div class="chat-thread-info">
                                                        <strong>{comm.name}</strong>
                                                        <small>{(channelsByComm[comm.id]?.length || 0)} canal(es)</small>
                                                    </div>
                                                    <i class={`fas fa-chevron-${open ? 'down' : 'right'} chat-community-caret`}></i>
                                                </button>
                                                {open && (
                                                    <div class="chat-community-channels">
                                                        {(channelsByComm[comm.id] || []).map(ch => (
                                                            <button
                                                                key={ch.id}
                                                                class={`chat-thread-row sub ${activeGroup?.id === ch.id ? 'active' : ''}`}
                                                                onClick={() => openGroup(ch)}
                                                            >
                                                                <span class="group-thumb sm"><i class="fas fa-hashtag"></i></span>
                                                                <div class="chat-thread-info"><strong>{ch.name}</strong></div>
                                                            </button>
                                                        ))}
                                                        {isOwner && (
                                                            <button class="chat-add-channel" onClick={() => addChannel(comm.id)}>
                                                                <i class="fas fa-plus"></i> Añadir canal
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            )}

                            {/* ── Grupos y canales sueltos ── */}
                            {plainGroups.length > 0 && (
                                <>
                                    <h4 class="chat-section-title"><i class="fas fa-user-group"></i> Grupos y canales</h4>
                                    {plainGroups.map(g => (
                                        <button
                                            key={g.id}
                                            class={`chat-thread-row ${activeGroup?.id === g.id ? 'active' : ''}`}
                                            onClick={() => openGroup(g)}
                                        >
                                            <span class="group-thumb">
                                                <i class={`fas ${g.kind === 'channel' ? 'fa-bullhorn' : 'fa-user-group'}`}></i>
                                            </span>
                                            <div class="chat-thread-info">
                                                <strong>{g.name}</strong>
                                                <small>{g.kind === 'channel' ? 'Canal' : 'Grupo'}</small>
                                            </div>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    );
                })()}
                <div class="chat-search">
                    <i class="fas fa-magnifying-glass"></i>
                    <input
                        type="search"
                        placeholder="Buscar usuario..."
                        value={search}
                        onInput={(e: any) => setSearch(e.currentTarget.value)}
                    />
                </div>
                {search.trim() && (
                    <div class="chat-search-results">
                        {searchResults.length === 0 && <div class="fp-empty">Sin coincidencias</div>}
                        {searchResults.map(p => (
                            <button class="chat-thread-row" key={p.id} onClick={() => startChatWith(p.id)}>
                                <Avatar user={p} size={36} />
                                <div class="chat-thread-info">
                                    <strong>@{p.username || 'Anónimo'}</strong>
                                    <small>{p.role === 'admin' ? 'Admin' : 'Miembro'}</small>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                <div class="chat-threads">
                    {threads.length === 0 && !search && (
                        <div class="fp-empty">Sin conversaciones. Busca arriba.</div>
                    )}
                    {threads.map(t => {
                        const online = t.other ? onlineIds.has(t.other.id) : false;
                        return (
                            <button
                                key={t.id}
                                class={`chat-thread-row ${activeId === t.id ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveId(t.id);
                                    setActiveBot(false);
                                    setActiveGroup(null);
                                    const u = new URL(window.location.href);
                                    u.searchParams.set('c', t.id);
                                    window.history.pushState({}, '', u);
                                }}
                            >
                                <div class={`chat-thread-avatar-wrap ${online ? 'online' : ''}`}>
                                    <Avatar user={t.other as any} size={40} />
                                </div>
                                <div class="chat-thread-info">
                                    <div class="chat-thread-head">
                                        <strong>@{t.other?.username || 'Anónimo'}</strong>
                                        <small>{timeAgo(t.last_message_at)}</small>
                                    </div>
                                    {t.last_message && (
                                        <p class="chat-thread-preview">{t.last_message.slice(0, 60)}</p>
                                    )}
                                </div>
                                {t.unread_count > 0 && <span class="chat-unread-badge">{t.unread_count}</span>}
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* ─── Ventana principal ─── */}
            <main class="chat-main" style={
                threadSettings && (threadSettings.accent_color || threadSettings.background_url)
                    ? `${threadSettings.accent_color ? `--chat-accent: ${threadSettings.accent_color};` : ''} ${threadSettings.background_url ? `--chat-bg-url: url("${threadSettings.background_url}");` : ''}`
                    : ''
            } data-themed={threadSettings && (threadSettings.accent_color || threadSettings.background_url) ? '1' : '0'}>
                {activeBot ? (
                    <BotChatView onClose={() => setActiveBot(false)} />
                ) : activeGroup ? (
                    <GroupChatView group={activeGroup} onClose={() => setActiveGroup(null)} />
                ) : !activeThread ? (
                    <div class="chat-placeholder">
                        <i class="fas fa-comments"></i>
                        <h3>Tus mensajes</h3>
                        <p>Selecciona una conversación, grupo o pregúntale al bot arriba.</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div class="chat-header">
                            <a class="chat-header-user" href={`/perfil?u=${activeThread.other?.username || ''}`}>
                                <div class={`chat-thread-avatar-wrap ${activeThread.other && onlineIds.has(activeThread.other.id) ? 'online' : ''}`}>
                                    <Avatar user={activeThread.other as any} size={40} />
                                </div>
                                <div>
                                    <strong>@{activeThread.other?.username || 'Anónimo'}</strong>
                                    <small>
                                        {typingIds.size > 0
                                            ? '✏️ escribiendo…'
                                            : (activeThread.other && onlineIds.has(activeThread.other.id) ? '🟢 En línea' : 'Desconectado')}
                                    </small>
                                </div>
                            </a>
                            <div class="chat-header-actions">
                                <button
                                    class="disc-icon-btn"
                                    onClick={async () => {
                                        if (!activeThread.other?.id) return;
                                        const { startCall } = await import('../lib/calls');
                                        try {
                                            const ctrl = await startCall(activeThread.other.id, 'audio');
                                            if (ctrl) {
                                                window.dispatchEvent(new CustomEvent('callStarted', {
                                                    detail: { controller: ctrl, label: '@' + (activeThread.other?.username || 'usuario') },
                                                }));
                                            }
                                        } catch (e: any) {
                                            toast.error(e?.message || 'Error al llamar');
                                        }
                                    }}
                                    title="Llamada de voz"
                                >
                                    <i class="fas fa-phone"></i>
                                </button>
                                <button
                                    class="disc-icon-btn"
                                    onClick={async () => {
                                        if (!activeThread.other?.id) return;
                                        const { startCall } = await import('../lib/calls');
                                        try {
                                            const ctrl = await startCall(activeThread.other.id, 'video');
                                            if (ctrl) {
                                                window.dispatchEvent(new CustomEvent('callStarted', {
                                                    detail: { controller: ctrl, label: '@' + (activeThread.other?.username || 'usuario') },
                                                }));
                                            }
                                        } catch (e: any) {
                                            toast.error(e?.message || 'Error al llamar');
                                        }
                                    }}
                                    title="Videollamada"
                                >
                                    <i class="fas fa-video"></i>
                                </button>
                                {ttsAvailable && (
                                    <button
                                        class={`disc-icon-btn ${voiceMode ? 'active' : ''}`}
                                        onClick={toggleVoiceMode}
                                        title={voiceMode ? 'Modo voz activo · te leo los mensajes' : 'Modo voz · escucha los mensajes en alto'}
                                        aria-pressed={voiceMode}
                                    >
                                        <i class={`fas ${voiceMode ? 'fa-headphones' : 'fa-headphones-simple'}`}></i>
                                    </button>
                                )}
                                <button class="disc-icon-btn" onClick={() => setShowChatSearch(s => !s)} title="Buscar en chat">
                                    <i class="fas fa-magnifying-glass"></i>
                                </button>
                                <button class={`disc-icon-btn ${muted ? 'active' : ''}`} onClick={toggleMute} title={muted ? 'Activar notifs' : 'Silenciar'}>
                                    <i class={`fas ${muted ? 'fa-bell-slash' : 'fa-bell'}`}></i>
                                </button>
                                <button class="disc-icon-btn" onClick={() => setShowSettings(true)} title="Ajustes del chat">
                                    <i class="fas fa-sliders"></i>
                                </button>
                            </div>
                        </div>

                        {/* Mensajes pinned */}
                        {pinned.length > 0 && (
                            <div class="chat-pinned-bar">
                                <i class="fas fa-thumbtack"></i>
                                <span class="chat-pinned-preview">
                                    {pinned[0].content?.slice(0, 80) || '[imagen]'}
                                </span>
                                <small>{pinned.length > 1 ? `+${pinned.length - 1} más` : ''}</small>
                            </div>
                        )}

                        {showSettings && (
                            <ChatSettingsModal
                                threadId={activeId!}
                                onClose={() => setShowSettings(false)}
                                onChange={(s) => { setThreadSettings(s); setMuted(s.muted); }}
                            />
                        )}

                        {showStickerPicker && (
                            <div class="chat-gif-overlay">
                                <StickerPicker
                                    onPick={async (s) => {
                                        setShowStickerPicker(false);
                                        if (!activeId) return;
                                        await sendDmMessage(activeId, stickerMarker(s.slug));
                                    }}
                                    onClose={() => setShowStickerPicker(false)}
                                />
                            </div>
                        )}

                        {showGifPicker && (
                            <div class="chat-gif-overlay">
                                <GifPicker
                                    onPick={async (url) => {
                                        setShowGifPicker(false);
                                        if (!activeId) return;
                                        await sendDmMessage(activeId, '', {
                                            attachments: [{ url, type: 'image', name: 'gif.gif', size: 0 }],
                                            messageType: 'image',
                                        });
                                    }}
                                    onClose={() => setShowGifPicker(false)}
                                />
                            </div>
                        )}

                        {forwarding && (
                            <ForwardModal
                                msg={forwarding}
                                threads={threads.filter(t => t.id !== activeId)}
                                onClose={() => setForwarding(null)}
                                onForward={async (toThreadId) => {
                                    await forwardMessage(forwarding.id, toThreadId);
                                    setForwarding(null);
                                    toast.success('Reenviado');
                                }}
                            />
                        )}

                        {showChatSearch && (
                            <div class="chat-search-inline">
                                <i class="fas fa-magnifying-glass"></i>
                                <input
                                    type="search"
                                    placeholder="Buscar en esta conversación..."
                                    value={chatSearch}
                                    onInput={(e: any) => setChatSearch(e.currentTarget.value)}
                                    autoFocus
                                />
                                <button onClick={() => { setChatSearch(''); setShowChatSearch(false); }} title="Cerrar">
                                    <i class="fas fa-xmark"></i>
                                </button>
                            </div>
                        )}

                        {/* Messages */}
                        <div class="chat-messages">
                            {loadingMsgs && <Skeleton variant="message" count={6} />}
                            {!loadingMsgs && visibleMessages.length === 0 && (
                                <div class="chat-empty">
                                    <i class="far fa-comment-dots"></i>
                                    <p>{chatSearch ? `Sin resultados para "${chatSearch}"` : 'Sin mensajes. Empieza la conversación.'}</p>
                                </div>
                            )}
                            {visibleMessages.map(m => (
                                <MessageBubble
                                    key={m.id}
                                    msg={m}
                                    isMine={m.sender_id === user.id}
                                    reactions={reactionsMap[m.id] || []}
                                    currentUserId={user.id}
                                    onReply={() => setReplyTo(m)}
                                    onEdit={() => startEdit(m)}
                                    onDelete={() => remove(m.id)}
                                    onReact={(emoji) => toggleDmReaction(m.id, emoji)}
                                    onOpenEmoji={() => setShowEmojiPicker({ msgId: m.id, forCompose: false })}
                                    onPin={async () => {
                                        await togglePinMessage(m.id, !!m.pinned_at);
                                        if (activeId) setPinned(await fetchPinnedMessages(activeId));
                                        toast.success(m.pinned_at ? 'Despineado' : 'Pineado');
                                    }}
                                    onForward={() => setForwarding(m)}
                                    isEditing={editingId === m.id}
                                    editingText={editingText}
                                    onEditingChange={setEditingText}
                                    onSaveEdit={saveEdit}
                                    onCancelEdit={() => setEditingId(null)}
                                />
                            ))}
                            {typingIds.size > 0 && (
                                <div class="chat-msg other typing-row">
                                    <div class="chat-msg-bubble typing">
                                        <span class="typing-dot"></span>
                                        <span class="typing-dot"></span>
                                        <span class="typing-dot"></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef}></div>
                        </div>

                        {/* Reply preview */}
                        {replyTo && (
                            <div class="chat-reply-preview">
                                <i class="fas fa-reply"></i>
                                <div class="chat-reply-info">
                                    <strong>Respondiendo a {replyTo.sender_id === user.id ? 'ti mismo' : '@' + (activeThread.other?.username || 'usuario')}</strong>
                                    <small>{replyTo.content.slice(0, 80)}{replyTo.content.length > 80 ? '…' : ''}</small>
                                </div>
                                <button class="disc-icon-btn small" onClick={() => setReplyTo(null)} title="Cancelar">
                                    <i class="fas fa-xmark"></i>
                                </button>
                            </div>
                        )}

                        {/* Recording overlay */}
                        {recording && (
                            <div class="chat-recording">
                                <span class="rec-dot"></span>
                                <span class="rec-time">{Math.floor((Date.now() - recording.start) / 1000)}s</span>
                                <span class="rec-label">Grabando...</span>
                                <button class="auth-btn ghost small" onClick={cancelRecording}>
                                    <i class="fas fa-xmark"></i> Cancelar
                                </button>
                                <button class="auth-btn primary small" onClick={stopRecording}>
                                    <i class="fas fa-paper-plane"></i> Enviar
                                </button>
                            </div>
                        )}

                        {/* Emoji picker (para compose) */}
                        {showEmojiPicker.msgId === null && showEmojiPicker.forCompose && (
                            <div class="chat-emoji-tray">
                                {QUICK_EMOJIS.map(em => (
                                    <button key={em} class="emoji-btn" onClick={() => {
                                        setDraft(d => d + em);
                                        composerRef.current?.focus();
                                        setShowEmojiPicker({ msgId: null, forCompose: false });
                                    }}>{em}</button>
                                ))}
                            </div>
                        )}

                        {/* Composer */}
                        {!recording && (
                            <div class="chat-composer">
                                <label class="chat-tool" title="Subir imagen">
                                    <i class={`fas ${uploading ? 'fa-circle-notch fa-spin' : 'fa-image'}`}></i>
                                    <input type="file" accept="image/*" onChange={onFileChange} style="display:none;" disabled={uploading} />
                                </label>
                                <button class="chat-tool" onClick={() => setShowEmojiPicker(s => ({ msgId: null, forCompose: !s.forCompose }))} title="Emojis">
                                    <i class="far fa-face-smile"></i>
                                </button>
                                <button class="chat-tool" onClick={() => setShowGifPicker(true)} title="GIF">
                                    <i class="far fa-images"></i>
                                </button>
                                <button class="chat-tool" onClick={() => setShowStickerPicker(true)} title="Stickers Tres Valles">
                                    <i class="fas fa-icons"></i>
                                </button>
                                <input
                                    ref={composerRef}
                                    type="text"
                                    placeholder="Escribe un mensaje..."
                                    value={draft}
                                    onInput={(e: any) => {
                                        setDraft(e.currentTarget.value);
                                        if (activeId && user) broadcastTyping(activeId, user.id);
                                    }}
                                    onKeyDown={(e: any) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                                    onPaste={onPaste as any}
                                />
                                {draft.trim() ? (
                                    <button class="auth-btn primary small" onClick={send} disabled={uploading}>
                                        <i class="fas fa-paper-plane"></i>
                                    </button>
                                ) : (
                                    <button class="chat-tool primary" onClick={startRecording} title="Grabar mensaje de voz">
                                        <i class="fas fa-microphone"></i>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Reaction picker para mensaje específico */}
                        {showEmojiPicker.msgId && (
                            <div class="chat-msg-react-picker" onClick={() => setShowEmojiPicker({ msgId: null, forCompose: false })}>
                                <div class="chat-msg-react-grid" onClick={(e: any) => e.stopPropagation()}>
                                    {QUICK_EMOJIS.map(em => (
                                        <button key={em} class="emoji-btn-big" onClick={() => {
                                            toggleDmReaction(showEmojiPicker.msgId!, em);
                                            setShowEmojiPicker({ msgId: null, forCompose: false });
                                        }}>{em}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

/* ────────── Burbuja de mensaje ────────── */
function MessageBubble({
    msg, isMine, reactions, currentUserId,
    onReply, onEdit, onDelete, onReact, onOpenEmoji, onPin, onForward,
    isEditing, editingText, onEditingChange, onSaveEdit, onCancelEdit,
}: {
    msg: DmMessage;
    isMine: boolean;
    reactions: DmReaction[];
    currentUserId: string;
    onReply: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onReact: (emoji: string) => void;
    onOpenEmoji: () => void;
    onPin: () => void;
    onForward: () => void;
    isEditing: boolean;
    editingText: string;
    onEditingChange: (v: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
}) {
    const [showActions, setShowActions] = useState(false);
    const longPress = useLongPress(() => { setShowActions(true); });

    const isDeleted = !!msg.deleted_at;
    const isVoice = msg.message_type === 'voice';
    const hasImages = (msg.attachments || []).some(a => a.type === 'image');

    // Agrupar reacciones
    const reactionGroups = reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
        if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
        acc[r.emoji].count++;
        if (r.user_id === currentUserId) acc[r.emoji].mine = true;
        return acc;
    }, {});

    return (
        <div class={`chat-msg ${isMine ? 'mine' : 'other'} ${isDeleted ? 'deleted' : ''} ${msg.pinned_at ? 'pinned' : ''}`}>
            {/* Indicador de pineado */}
            {msg.pinned_at && (
                <div class="chat-msg-pin-tag">
                    <i class="fas fa-thumbtack"></i> Pineado
                </div>
            )}
            {msg.forwarded_from && (
                <div class="chat-msg-forward-tag">
                    <i class="fas fa-share"></i> Reenviado
                </div>
            )}
            {/* Reply preview embebido */}
            {msg.parent && (
                <div class="chat-msg-reply-quote">
                    <i class="fas fa-reply"></i>
                    <span>{(msg.parent.content || '[imagen]').slice(0, 60)}…</span>
                </div>
            )}

            <div class="chat-msg-content-wrap" {...longPress as any}>
                {isEditing ? (
                    <div class="chat-msg-edit">
                        <input
                            type="text"
                            value={editingText}
                            onInput={(e: any) => onEditingChange(e.currentTarget.value)}
                            onKeyDown={(e: any) => {
                                if (e.key === 'Enter') onSaveEdit();
                                else if (e.key === 'Escape') onCancelEdit();
                            }}
                            autoFocus
                        />
                        <button class="auth-btn ghost small" onClick={onCancelEdit}><i class="fas fa-xmark"></i></button>
                        <button class="auth-btn primary small" onClick={onSaveEdit}><i class="fas fa-check"></i></button>
                    </div>
                ) : (
                    <div class="chat-msg-bubble">
                        {isDeleted ? (
                            <em class="chat-msg-deleted">🗑 Mensaje borrado</em>
                        ) : (
                            <>
                                {hasImages && (
                                    <div class="chat-msg-images">
                                        {msg.attachments.filter(a => a.type === 'image').map((a, i) => (
                                            <button
                                                key={i}
                                                class="chat-msg-image"
                                                onClick={() => openLightbox(msg.attachments.filter(x => x.type === 'image').map(im => ({ url: im.url, caption: im.name })), i)}
                                            >
                                                <img src={a.url} alt={a.name} loading="lazy" class="lazy-blur" onLoad={(e: any) => e.currentTarget.classList.add('loaded')} />
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {isVoice && msg.attachments[0] && (
                                    <audio controls src={msg.attachments[0].url} class="chat-msg-audio" />
                                )}
                                {msg.content && (() => {
                                    const stickerOnly = parseStickerOnly(msg.content);
                                    if (stickerOnly) {
                                        return <StickerView sticker={stickerOnly} big />;
                                    }
                                    return (
                                        <>
                                            <div
                                                class="chat-msg-text"
                                                dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(parseRichText(msg.content)) }}
                                            />
                                            <LinkPreview text={msg.content} />
                                        </>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                )}

                {/* Acciones flotantes (aparecen al hover en desktop, long-press en mobile) */}
                {!isDeleted && (showActions || true) && (
                    <div class="chat-msg-actions">
                        <button onClick={onOpenEmoji} title="Reaccionar"><i class="far fa-face-smile"></i></button>
                        <button onClick={onReply} title="Responder"><i class="fas fa-reply"></i></button>
                        <button onClick={onForward} title="Reenviar"><i class="fas fa-share"></i></button>
                        <button onClick={onPin} title={msg.pinned_at ? 'Despinear' : 'Pinear'} class={msg.pinned_at ? 'active' : ''}>
                            <i class="fas fa-thumbtack"></i>
                        </button>
                        {!isDeleted && msg.content && (
                            <button onClick={() => { navigator.clipboard.writeText(msg.content); }} title="Copiar"><i class="far fa-copy"></i></button>
                        )}
                        {isMine && !isDeleted && (
                            <>
                                <button onClick={onEdit} title="Editar"><i class="fas fa-pencil"></i></button>
                                <button onClick={onDelete} class="danger" title="Borrar"><i class="fas fa-trash"></i></button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Reactions pills */}
            {Object.keys(reactionGroups).length > 0 && (
                <div class="chat-msg-reactions">
                    {Object.entries(reactionGroups).map(([emoji, info]) => (
                        <button
                            key={emoji}
                            class={`chat-react-pill ${info.mine ? 'mine' : ''}`}
                            onClick={() => onReact(emoji)}
                        >
                            <span>{emoji}</span>
                            <span class="chat-react-count">{info.count}</span>
                        </button>
                    ))}
                </div>
            )}

            <small class="chat-msg-meta">
                {timeAgo(msg.created_at)}
                {msg.edited_at && ' · editado'}
                {isMine && msg.read_at && ' · ✓✓ visto'}
                {isMine && !msg.read_at && ' · ✓ enviado'}
            </small>
        </div>
    );
}

/* ────────── ForwardModal: pickear thread destino ────────── */
function ForwardModal({ msg, threads, onClose, onForward }: {
    msg: DmMessage;
    threads: DmThread[];
    onClose: () => void;
    onForward: (toThreadId: string) => void;
}) {
    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal small" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-share"></i> Reenviar a...</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    <div class="repost-preview">
                        <small>Reenviarás:</small>
                        <p>{(msg.content || '[archivo]').slice(0, 200)}</p>
                    </div>
                    <ul class="members-list">
                        {threads.length === 0 && <div class="fp-empty">Sin otros chats. Abre una conversación primero.</div>}
                        {threads.map(t => (
                            <li key={t.id}>
                                <button class="member-row" style="width:100%;" onClick={() => onForward(t.id)}>
                                    <Avatar user={t.other as any} size={36} />
                                    <div>
                                        <strong>@{t.other?.username || 'Anónimo'}</strong>
                                        <small>{t.last_message?.slice(0, 40) || ''}</small>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
