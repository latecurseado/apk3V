import { useEffect, useRef, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
    fetchGroupMessages, sendGroupMessage, subscribeGroupMessages, fetchMembers, addMember,
    type DmGroup, type DmGroupMessage, type DmGroupMember,
} from '../lib/groups';
import { searchProfiles } from '../lib/friends';
import { timeAgo } from '../lib/forum';
import { toast } from '../lib/toast';
import Avatar from './Avatar';

interface Props {
    group: DmGroup;
    onClose: () => void;
}

export default function GroupChatView({ group, onClose }: Props) {
    const { user } = useSession();
    const [messages, setMessages] = useState<DmGroupMessage[]>([]);
    const [members, setMembers] = useState<DmGroupMember[]>([]);
    const [draft, setDraft] = useState('');
    const [showMembers, setShowMembers] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteQ, setInviteQ] = useState('');
    const [inviteResults, setInviteResults] = useState<any[]>([]);
    const [sending, setSending] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    const isReadOnly = group.kind === 'channel'
        && !members.some(m => m.user_id === user?.id && (m.role === 'owner' || m.role === 'admin'));

    useEffect(() => {
        let alive = true;
        (async () => {
            const [msgs, mems] = await Promise.all([
                fetchGroupMessages(group.id, 80),
                fetchMembers(group.id),
            ]);
            if (!alive) return;
            setMessages(msgs);
            setMembers(mems);
        })();
        const unsub = subscribeGroupMessages(group.id, (m) => {
            // El postgres_changes da el row pero no joinea sender · refrescamos mínimo
            setMessages(prev => [...prev, m]);
            (async () => {
                const { data } = await supabase
                    .from('profiles').select('username, pfp').eq('id', m.sender_id).single();
                if (data) {
                    setMessages(prev => prev.map(x => x.id === m.id ? { ...x, sender: data as any } : x));
                }
            })();
        });
        return () => { alive = false; unsub(); };
    }, [group.id]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    useEffect(() => {
        const term = inviteQ.trim();
        if (term.length < 1) { setInviteResults([]); return; }
        const id = setTimeout(async () => {
            const res = await searchProfiles(term, 6);
            setInviteResults(res);
        }, 200);
        return () => clearTimeout(id);
    }, [inviteQ]);

    const send = async () => {
        const text = draft.trim();
        if (!text || sending) return;
        setSending(true);
        const ok = await sendGroupMessage(group.id, text);
        if (ok) setDraft('');
        else toast.error('No se pudo enviar');
        setSending(false);
    };

    const invite = async (userId: string, username: string) => {
        const ok = await addMember(group.id, userId, 'member');
        if (ok) {
            toast.success(`@${username} añadido`);
            setMembers(await fetchMembers(group.id));
            setInviteQ('');
            setInviteResults([]);
        } else {
            toast.error('No se pudo añadir');
        }
    };

    const kindIcon = group.kind === 'channel' ? 'fa-bullhorn' : group.kind === 'community' ? 'fa-users-rectangle' : 'fa-user-group';
    const kindLabel = group.kind === 'channel' ? 'Canal' : group.kind === 'community' ? 'Comunidad' : 'Grupo';

    return (
        <div class="group-chat-view">
            <header class="group-chat-head">
                <button class="disc-icon-btn" onClick={onClose} title="Volver">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <div class="group-chat-title">
                    <span class="group-chat-icon"><i class={`fas ${kindIcon}`}></i></span>
                    <div>
                        <strong>{group.name}</strong>
                        <small>{kindLabel} · {members.length} {members.length === 1 ? 'miembro' : 'miembros'}</small>
                    </div>
                </div>
                <div class="group-chat-actions">
                    <button class="disc-icon-btn" onClick={() => setShowInvite(s => !s)} title="Invitar">
                        <i class="fas fa-user-plus"></i>
                    </button>
                    <button class="disc-icon-btn" onClick={() => setShowMembers(s => !s)} title="Miembros">
                        <i class="fas fa-users"></i>
                    </button>
                </div>
            </header>

            {showInvite && (
                <div class="group-invite-panel">
                    <input
                        type="search"
                        placeholder="Buscar usuario para invitar..."
                        value={inviteQ}
                        onInput={(e: any) => setInviteQ(e.currentTarget.value)}
                        autoFocus
                    />
                    {inviteResults.map(p => (
                        <button class="invite-row" key={p.id} onClick={() => invite(p.id, p.username)}>
                            <Avatar user={p} size={28} />
                            <strong>@{p.username}</strong>
                            <i class="fas fa-plus"></i>
                        </button>
                    ))}
                </div>
            )}

            {showMembers && (
                <div class="group-members-panel">
                    <h4>Miembros ({members.length})</h4>
                    {members.map(m => (
                        <a key={m.user_id} class="invite-row" href={`/perfil?u=${m.profile?.username}`}>
                            <Avatar user={{ id: m.user_id, username: m.profile?.username || 'a', pfp: m.profile?.pfp ?? null }} size={28} />
                            <strong>@{m.profile?.username || 'Anon'}</strong>
                            <small class="auth-hint">{m.role}</small>
                        </a>
                    ))}
                </div>
            )}

            <div class="group-chat-messages">
                {messages.length === 0 && (
                    <div class="fp-empty">
                        <i class="fas fa-comments"></i>
                        <p>Sin mensajes todavía. ¡Rompe el hielo!</p>
                    </div>
                )}
                {messages.map(m => {
                    const isMine = m.sender_id === user?.id;
                    return (
                        <div class={`group-msg ${isMine ? 'mine' : ''}`} key={m.id}>
                            {!isMine && (
                                <Avatar user={{ id: m.sender_id, username: m.sender?.username || 'a', pfp: m.sender?.pfp || null }} size={28} />
                            )}
                            <div class="group-msg-bubble">
                                {!isMine && <strong class="group-msg-sender">@{m.sender?.username || 'anon'}</strong>}
                                <p>{m.content}</p>
                                <small>{timeAgo(m.created_at)}</small>
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef}></div>
            </div>

            <footer class="group-chat-composer">
                {isReadOnly ? (
                    <div class="group-readonly">
                        <i class="fas fa-bullhorn"></i> Solo el creador del canal publica aquí
                    </div>
                ) : (
                    <>
                        <input
                            type="text"
                            placeholder="Mensaje al grupo..."
                            value={draft}
                            onInput={(e: any) => setDraft(e.currentTarget.value)}
                            onKeyDown={(e: any) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                            disabled={sending}
                        />
                        <button class="auth-btn primary small" onClick={send} disabled={sending || !draft.trim()}>
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </>
                )}
            </footer>
        </div>
    );
}
