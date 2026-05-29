import { useEffect, useMemo, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession, signInAnonymously, signOut, userLabel } from '../lib/auth';
import {
    fetchThreads, insertThread,
    fetchForums, createForum, deleteForum,
    fetchForumMembers,
    type Thread, type Forum, type ForumMember,
} from '../lib/forum';
import { fetchReactionsForThreads, type ReactionSummary } from '../lib/thread-actions';
import { fetchMySubscribedForumIds, toggleSubscription, canManageForum } from '../lib/forum-mgmt';
import { createPoll } from '../lib/polls';
import { toast } from '../lib/toast';
import FriendsPanel from './FriendsPanel';
import ThreadCard from './ThreadCard';
import MentionTextarea from './MentionTextarea';
import PollCreator, { type PollDraft } from './PollCreator';
import ForumSettings from './ForumSettings';
import AttachmentPicker from './AttachmentPicker';
import type { Attachment } from '../lib/attachments';
import ComposeModal from './ComposeModal';
import InlineComposer from './InlineComposer';
import { requireAuthOrPrompt } from '../lib/auth-gate';
import Skeleton from './Skeleton';

export default function ForumIsland() {
    const { user, ready } = useSession();
    const [forums, setForums] = useState<Forum[]>([]);
    const [activeForumSlug, setActiveForumSlug] = useState<string>('general');
    const [threads, setThreads] = useState<Thread[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [showFriends, setShowFriends] = useState(false);
    const [showForumList, setShowForumList] = useState(false);
    const [rightbarCollapsed, setRightbarCollapsed] = useState(false);
    const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionSummary[]>>({});
    const [isAdmin, setIsAdmin] = useState(false);
    const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
    const [canManage, setCanManage] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [composeOpen, setComposeOpen] = useState(false);
    const [members, setMembers] = useState<ForumMember[]>([]);
    const [showMembers, setShowMembers] = useState(false);

    useEffect(() => {
        try { setRightbarCollapsed(localStorage.getItem('tv-rightbar-collapsed') === '1'); } catch { /* */ }
    }, []);
    const toggleRightbar = (collapsed: boolean) => {
        setRightbarCollapsed(collapsed);
        try { localStorage.setItem('tv-rightbar-collapsed', collapsed ? '1' : '0'); } catch { /* */ }
    };

    const activeForum = useMemo(
        () => forums.find(f => f.slug === activeForumSlug) || null,
        [forums, activeForumSlug],
    );

    // URL state sync (?f=slug)
    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        const f = sp.get('f');
        if (f) setActiveForumSlug(f);
        const onPop = () => {
            const sp2 = new URLSearchParams(window.location.search);
            setActiveForumSlug(sp2.get('f') || 'general');
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    const selectForum = (slug: string) => {
        setActiveForumSlug(slug);
        const url = new URL(window.location.href);
        if (slug === 'general') url.searchParams.delete('f');
        else url.searchParams.set('f', slug);
        window.history.pushState({}, '', url);
        setShowForumList(false);
    };

    // Foros
    useEffect(() => {
        fetchForums().then(setForums);
    }, []);

    // Threads del foro activo + reacciones
    useEffect(() => {
        if (!activeForum) return;
        setLoading(true);
        fetchThreads({ forumId: activeForum.id, limit: 50 })
            .then(async (ts) => {
                setThreads(ts);
                const rx = await fetchReactionsForThreads(ts.map(t => t.id), user?.id ?? null);
                setReactionsMap(rx);
            })
            .catch(e => setError(e instanceof Error ? e.message : String(e)))
            .finally(() => setLoading(false));
    }, [activeForum?.id, user?.id]);

    // ¿Soy admin?
    useEffect(() => {
        if (!user) { setIsAdmin(false); return; }
        supabase.rpc('am_i_admin').then(({ data }) => setIsAdmin(data === true)).catch(() => setIsAdmin(false));
    }, [user?.id]);

    // Mis suscripciones
    useEffect(() => {
        if (!user) { setSubscribedIds(new Set()); return; }
        fetchMySubscribedForumIds(user.id).then(setSubscribedIds);
    }, [user?.id]);

    // ¿Puedo gestionar el foro activo?
    useEffect(() => {
        if (!activeForum || !user) { setCanManage(false); return; }
        canManageForum(activeForum, user.id, isAdmin).then(setCanManage);
    }, [activeForum?.id, user?.id, isAdmin]);

    // Miembros del foro activo (lazy)
    useEffect(() => {
        if (!activeForum) return;
        fetchForumMembers(activeForum.id, 50).then(setMembers);
    }, [activeForum?.id]);

    const doSubscribe = async () => {
        if (!activeForum) return;
        const r = await toggleSubscription(activeForum.id);
        if (r === null) { toast.info('Inicia sesión para suscribirte'); return; }
        const next = new Set(subscribedIds);
        if (r) next.add(activeForum.id); else next.delete(activeForum.id);
        setSubscribedIds(next);
        toast.success(r ? `Suscrito a #${activeForum.slug}` : `Sin suscribir`);
    };

    // Realtime: nuevos hilos del foro activo + cambios en foros
    useEffect(() => {
        if (!activeForum) return;
        const channel = supabase
            .channel(`tv-foro-${activeForum.id}`)
            .on('postgres_changes' as any,
                { event: 'INSERT', schema: 'public', table: 'threads', filter: `forum_id=eq.${activeForum.id}` },
                async () => {
                    const fresh = await fetchThreads({ forumId: activeForum.id, limit: 50 });
                    setThreads(fresh);
                })
            .on('postgres_changes' as any,
                { event: 'DELETE', schema: 'public', table: 'threads' },
                (payload: any) => {
                    setThreads(ts => ts.filter(t => t.id !== payload.old.id));
                })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [activeForum?.id]);

    // Realtime: lista de foros
    useEffect(() => {
        const channel = supabase
            .channel('tv-forums-rt')
            .on('postgres_changes' as any,
                { event: '*', schema: 'public', table: 'forums' },
                async () => setForums(await fetchForums()))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const handlePosted = (t: Thread) => {
        setThreads(ts => [t, ...ts.filter(x => x.id !== t.id)]);
    };

    const filteredThreads = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return threads;
        return threads.filter(t =>
            t.content.toLowerCase().includes(term) ||
            (t.author?.username || '').toLowerCase().includes(term),
        );
    }, [threads, search]);

    return (
        <div class={`disc-layout ${showFriends ? 'show-friends' : ''} ${showForumList ? 'show-forums' : ''} ${rightbarCollapsed ? 'rightbar-collapsed' : ''}`}>
            {/* ═════════ Sidebar izquierda: lista de foros ═════════ */}
            <aside class="disc-sidebar">
                <div class="disc-sidebar-head">
                    <h3><i class="fas fa-compass"></i> Foros</h3>
                    <button class="disc-icon-btn" title="Cerrar" onClick={() => setShowForumList(false)}>
                        <i class="fas fa-xmark"></i>
                    </button>
                </div>
                <ForumList
                    forums={forums}
                    activeSlug={activeForumSlug}
                    onSelect={selectForum}
                    currentUserId={user?.id ?? null}
                    subscribedIds={subscribedIds}
                    onForumDeleted={(id) => {
                        setForums(fs => fs.filter(f => f.id !== id));
                        if (activeForum?.id === id) selectForum('general');
                    }}
                />
                {user && (
                    <CreateForumButton onCreated={f => { setForums(fs => [...fs, f]); selectForum(f.slug); }} />
                )}
            </aside>

            {/* ═════════ Centro: hilos del foro activo ═════════ */}
            <main class="disc-main">
                <div class="disc-topbar">
                    <button class="disc-icon-btn mobile-only" onClick={() => setShowForumList(true)} title="Ver foros">
                        <i class="fas fa-bars"></i>
                    </button>
                    <div class="disc-forum-title">
                        <i class={`fas ${activeForum?.icon || 'fa-hashtag'}`}></i>
                        <div>
                            <strong>{activeForum?.name || '…'}</strong>
                            {activeForum?.description && <small>{activeForum.description}</small>}
                        </div>
                    </div>
                    <div class="disc-search">
                        <i class="fas fa-magnifying-glass"></i>
                        <input
                            type="search"
                            placeholder="Buscar en este foro…"
                            value={search}
                            onInput={(e: any) => setSearch(e.currentTarget.value)}
                        />
                    </div>
                    {activeForum && user && (
                        <button
                            class={`disc-icon-btn ${subscribedIds.has(activeForum.id) ? 'active' : ''}`}
                            onClick={doSubscribe}
                            title={subscribedIds.has(activeForum.id) ? 'Suscrito · click para dejar' : 'Suscribirse al foro'}
                        >
                            <i class={`${subscribedIds.has(activeForum.id) ? 'fas' : 'far'} fa-star`}></i>
                        </button>
                    )}
                    {canManage && activeForum && (
                        <button class="disc-icon-btn" onClick={() => setSettingsOpen(true)} title="Configurar foro">
                            <i class="fas fa-gear"></i>
                        </button>
                    )}
                    <button class="disc-icon-btn mobile-only" onClick={() => setShowFriends(true)} title="Amigos">
                        <i class="fas fa-user-group"></i>
                    </button>
                </div>

                {activeForum && (activeForum as any).banner_url && (
                    <div class="forum-banner" style={`background-image: url("${(activeForum as any).banner_url}"); --forum-accent: ${activeForum.color || 'var(--accent)'};`}>
                        <div class="forum-banner-overlay">
                            <span class="forum-banner-icon"><i class={`fas ${activeForum.icon}`}></i></span>
                            <div>
                                <h2>{activeForum.name}</h2>
                                <p>#{activeForum.slug} · {(activeForum as any).description || ''}</p>
                            </div>
                            <button class="auth-btn ghost small" onClick={() => setShowMembers(true)}>
                                <i class="fas fa-user-group"></i> {members.length} miembros
                            </button>
                        </div>
                    </div>
                )}

                {showMembers && activeForum && (
                    <ForumMembersModal forum={activeForum} members={members} onClose={() => setShowMembers(false)} />
                )}

                {activeForum?.rules && (
                    <details class="forum-rules">
                        <summary><i class="fas fa-scroll"></i> Reglas de #{activeForum.slug}</summary>
                        <div dangerouslySetInnerHTML={{ __html: activeForum.rules }} />
                    </details>
                )}

                {settingsOpen && activeForum && (
                    <ForumSettings
                        forum={activeForum}
                        onClose={() => setSettingsOpen(false)}
                        onUpdated={(patch) => setForums(fs => fs.map(f => f.id === activeForum.id ? { ...f, ...patch } : f))}
                    />
                )}

                <InlineComposer
                    defaultForum={activeForum}
                    onPosted={handlePosted}
                />

                {error && <div class="forum-error"><i class="fas fa-triangle-exclamation"></i> {error}</div>}
                {loading && <div class="forum-loading"><i class="fas fa-circle-notch fa-spin"></i> Cargando hilos…</div>}
                {!loading && filteredThreads.length === 0 && (
                    <div class="forum-empty">
                        <i class="fas fa-comments"></i>
                        <p>{search ? 'Sin resultados para tu búsqueda.' : `Aún no hay hilos en #${activeForum?.slug}. Sé el primero.`}</p>
                    </div>
                )}

                <div class="forum-list">
                    {loading && <Skeleton variant="thread" count={3} />}
                    {filteredThreads.map(t => (
                        <ThreadCard
                            key={t.id}
                            thread={t}
                            forum={activeForum}
                            currentUserId={user?.id ?? null}
                            isAdmin={isAdmin}
                            reactions={reactionsMap[t.id] || []}
                            onDeleted={() => setThreads(ts => ts.filter(x => x.id !== t.id))}
                            onEdited={(newContent) => setThreads(ts => ts.map(x => x.id === t.id ? { ...x, content: newContent, edited_at: new Date().toISOString() } : x))}
                            onPinChanged={async () => {
                                const fresh = await fetchThreads({ forumId: activeForum!.id, limit: 50 });
                                setThreads(fresh);
                            }}
                            onReactionToggle={async () => {
                                const rx = await fetchReactionsForThreads([t.id], user?.id ?? null);
                                setReactionsMap(prev => ({ ...prev, [t.id]: rx[t.id] || [] }));
                            }}
                        />
                    ))}
                </div>
            </main>

            {/* ═════════ Sidebar derecha: amigos ═════════ */}
            <aside class="disc-rightbar">
                <div class="disc-sidebar-head">
                    <h3><i class="fas fa-user-group"></i> Amigos</h3>
                    <button
                        class="rightbar-collapse-btn"
                        title="Ocultar esta columna"
                        aria-label="Ocultar columna derecha"
                        onClick={() => toggleRightbar(true)}
                    >
                        <i class="fas fa-angles-right"></i>
                    </button>
                    <button class="disc-icon-btn" title="Cerrar" onClick={() => setShowFriends(false)}>
                        <i class="fas fa-xmark"></i>
                    </button>
                </div>
                <FriendsPanel />
            </aside>

            <button
                class="rightbar-show-fab"
                onClick={() => toggleRightbar(false)}
                title="Mostrar widgets y amigos"
                aria-label="Mostrar columna derecha"
            >
                <i class="fas fa-angles-left"></i>
            </button>
        </div>
    );
}

/* ────────── Sidebar: lista de foros ────────── */
function ForumList({ forums, activeSlug, onSelect, currentUserId, subscribedIds, onForumDeleted }: {
    forums: Forum[];
    activeSlug: string;
    onSelect: (slug: string) => void;
    currentUserId: string | null;
    subscribedIds: Set<string>;
    onForumDeleted: (id: string) => void;
}) {
    const remove = async (f: Forum) => {
        if (!confirm(`¿Borrar el foro "${f.name}" y todos sus hilos?`)) return;
        const ok = await deleteForum(f.id);
        if (ok) { onForumDeleted(f.id); toast.success('Foro borrado'); }
        else toast.error('No se pudo borrar');
    };
    const subscribed = forums.filter(f => subscribedIds.has(f.id));
    const system = forums.filter(f => f.is_system);
    const custom = forums.filter(f => !f.is_system);
    return (
        <div class="forum-nav">
            {subscribed.length > 0 && (
                <div class="forum-nav-group">
                    <span class="forum-nav-label"><i class="fas fa-star" style="color:#ffd02b;"></i> Suscritos</span>
                    {subscribed.map(f => (
                        <button
                            key={f.id}
                            class={`forum-nav-item ${f.slug === activeSlug ? 'active' : ''}`}
                            onClick={() => onSelect(f.slug)}
                            style={f.color && f.color !== '#00d2ff' ? `--accent: ${f.color};` : ''}
                        >
                            <i class={`fas ${f.icon}`}></i>
                            <span>{f.name}</span>
                        </button>
                    ))}
                </div>
            )}
            <div class="forum-nav-group">
                <span class="forum-nav-label">Oficiales</span>
                {system.map(f => (
                    <button
                        key={f.id}
                        class={`forum-nav-item ${f.slug === activeSlug ? 'active' : ''}`}
                        onClick={() => onSelect(f.slug)}
                    >
                        <i class={`fas ${f.icon}`}></i>
                        <span>{f.name}</span>
                    </button>
                ))}
            </div>
            {custom.length > 0 && (
                <div class="forum-nav-group">
                    <span class="forum-nav-label">De la comunidad</span>
                    {custom.map(f => (
                        <div class="forum-nav-row" key={f.id}>
                            <button
                                class={`forum-nav-item ${f.slug === activeSlug ? 'active' : ''}`}
                                onClick={() => onSelect(f.slug)}
                            >
                                <i class={`fas ${f.icon}`}></i>
                                <span>{f.name}</span>
                                {(f as any).visibility === 'invite' && <i class="fas fa-lock" style="margin-left:6px;font-size:0.7em;"></i>}
                            </button>
                            {currentUserId && f.created_by === currentUserId && (
                                <button class="disc-icon-btn small danger" onClick={() => remove(f)} title="Borrar mi foro">
                                    <i class="fas fa-trash"></i>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <a class="forum-nav-more" href="/foros">
                <i class="fas fa-grip"></i>
                <span>Ver todos los foros</span>
                <i class="fas fa-arrow-right" style="margin-left:auto;font-size:0.7em;"></i>
            </a>
        </div>
    );
}

function CreateForumButton({ onCreated }: { onCreated: (f: Forum) => void }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('fa-comments');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!name.trim()) return;
        setBusy(true);
        const res = await createForum(name, description, icon);
        setBusy(false);
        if (!res.ok) { alert('No se pudo crear: ' + (res.reason || 'error')); return; }
        if (res.forum) onCreated(res.forum);
        setName(''); setDescription(''); setIcon('fa-comments'); setOpen(false);
    };

    if (!open) {
        return (
            <button class="forum-nav-create" onClick={() => setOpen(true)}>
                <i class="fas fa-plus"></i> Crear subforo
            </button>
        );
    }

    return (
        <div class="forum-create-form">
            <input type="text" placeholder="Nombre del foro" value={name}
                onInput={(e: any) => setName(e.currentTarget.value)} maxLength={40} />
            <input type="text" placeholder="Descripción corta" value={description}
                onInput={(e: any) => setDescription(e.currentTarget.value)} maxLength={120} />
            <input type="text" placeholder="Icono (fa-...)" value={icon}
                onInput={(e: any) => setIcon(e.currentTarget.value)} />
            <div class="forum-create-actions">
                <button class="auth-btn ghost small" onClick={() => setOpen(false)} disabled={busy}>Cancelar</button>
                <button class="auth-btn primary small" onClick={submit} disabled={busy || !name.trim()}>
                    {busy ? 'Creando…' : 'Crear'}
                </button>
            </div>
        </div>
    );
}

/* ────────── Modal de miembros del foro ────────── */
function ForumMembersModal({ forum, members, onClose }: {
    forum: Forum; members: ForumMember[]; onClose: () => void;
}) {
    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-user-group"></i> Miembros de #{forum.slug}</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    {members.length === 0 && (
                        <div class="fp-empty">Aún nadie suscrito a este foro. ¡Sé el primero!</div>
                    )}
                    <ul class="members-list">
                        {members.map(m => (
                            <li key={m.id}>
                                <a href={`/perfil?u=${m.username}`} class="member-row">
                                    <span class={`fp-avatar ${m.role === 'admin' ? 'admin' : ''}`}>
                                        <i class="fas fa-user"></i>
                                    </span>
                                    <div>
                                        <strong>@{m.username}</strong>
                                        <small>{m.role === 'admin' ? 'Admin' : 'Miembro'} · desde {new Date(m.joined_at).toLocaleDateString('es-MX')}</small>
                                    </div>
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

/* ────────── Launcher del ComposeModal ────────── */
function ComposeLauncher({ forum, onClick }: { forum: Forum | null; onClick: () => void }) {
    return (
        <button class="compose-launcher" onClick={onClick}>
            <span class="compose-launcher-avatar"><i class="fas fa-feather-pointed"></i></span>
            <span class="compose-launcher-placeholder">
                ¿Qué quieres publicar en <b>#{forum?.slug || 'general'}</b>?
            </span>
            <span class="compose-launcher-tools">
                <i class="fas fa-image" title="Imagen"></i>
                <i class="fas fa-video" title="Video"></i>
                <i class="fas fa-square-poll-vertical" title="Encuesta"></i>
            </span>
        </button>
    );
}

/* ────────── Auth bar ────────── */
function AuthBar({ user, ready }: { user: any; ready: boolean }) {
    const [busy, setBusy] = useState(false);
    const doAnon = async () => {
        setBusy(true);
        const { error } = await signInAnonymously();
        if (error) alert('Error: ' + error.message + '\n\nHabilita Anonymous Sign-ins en Supabase Dashboard.');
        setBusy(false);
    };
    const doSignOut = async () => { setBusy(true); await signOut(); setBusy(false); };

    if (!ready) return null;
    if (user) {
        const label = userLabel(user);
        return (
            <div class="auth-bar compact">
                <div class="auth-who">
                    <span class="auth-avatar"><i class="fas fa-user"></i></span>
                    <div>
                        <strong>{label}</strong>
                        <small>{user.email || 'Invitado'}</small>
                    </div>
                </div>
                <button class="auth-btn ghost small" onClick={doSignOut} disabled={busy}>
                    <i class="fas fa-right-from-bracket"></i> Salir
                </button>
            </div>
        );
    }
    return (
        <div class="auth-bar compact">
            <span><i class="fas fa-user-secret"></i> Sin sesión — solo lectura</span>
            <button class="auth-btn primary small" onClick={doAnon} disabled={busy}>
                <i class="fas fa-bolt"></i> Entrar como invitado
            </button>
        </div>
    );
}

/* ────────── Composer ────────── */
function Composer({ forum, onPosted }: { forum: Forum; onPosted: (t: Thread) => void }) {
    const [content, setContent] = useState('');
    const [busy, setBusy] = useState(false);
    const [pollDraft, setPollDraft] = useState<PollDraft | null>(null);
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    const submit = async () => {
        const text = content.trim();
        if (text.length < 2 && attachments.length === 0) return;
        setBusy(true);
        const res = await insertThread(text, forum.slug, forum.id, attachments);
        if (!res.ok) { toast.error('No se pudo publicar: ' + (res.reason || 'error')); setBusy(false); return; }
        if (pollDraft && pollDraft.question.trim() && pollDraft.options.filter(o => o.trim()).length >= 2) {
            await createPoll(res.id!, pollDraft.question.trim(), pollDraft.options, pollDraft.allowMultiple);
        }
        const { data: { user } } = await supabase.auth.getUser();
        onPosted({
            id: res.id!,
            author_id: user!.id,
            content: text,
            category: forum.slug,
            forum_id: forum.id,
            created_at: new Date().toISOString(),
            edited_at: null,
            pinned_at: null,
            is_bot: false,
            attachments,
            author: { id: user!.id, username: userLabel(user), pfp: null, role: null },
            likes_count: 0, liked_by_me: false, comments_count: 0,
        });
        setContent('');
        setPollDraft(null);
        setAttachments([]);
        setBusy(false);
        toast.success('Publicado');
    };

    return (
        <div class="composer">
            <MentionTextarea
                placeholder={`Publica en #${forum.slug}… usa @ para mencionar, # para etiquetar`}
                value={content}
                onChange={setContent}
                rows={2}
                maxLength={2000}
                disabled={busy}
                onSubmitShortcut={submit}
            />
            {pollDraft && (
                <PollCreator
                    value={pollDraft}
                    onChange={setPollDraft}
                    onRemove={() => setPollDraft(null)}
                />
            )}
            <AttachmentPicker value={attachments} onChange={setAttachments} />
            <div class="composer-actions">
                {!pollDraft && (
                    <button class="composer-tool" onClick={() => setPollDraft({ question: '', options: ['', ''], allowMultiple: false })} title="Añadir encuesta">
                        <i class="fas fa-square-poll-vertical"></i>
                    </button>
                )}
                <span class="composer-count">{content.length}/2000 · Ctrl+Enter</span>
                <button class="auth-btn primary small" onClick={submit} disabled={busy || (content.trim().length < 2 && attachments.length === 0)}>
                    <i class="fas fa-paper-plane"></i> Publicar
                </button>
            </div>
        </div>
    );
}

