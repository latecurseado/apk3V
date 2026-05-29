import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { addCollaborator, fetchCollaborators, removeCollaborator, type Collaborator } from '../lib/collaborators';
import { searchProfiles } from '../lib/friends';
import type { Profile } from '../lib/forum';
import { toast } from '../lib/toast';
import Avatar from './Avatar';

interface Props {
    threadId: string;
    onClose: () => void;
}

export default function InviteCollaboratorModal({ threadId, onClose }: Props) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<Profile[]>([]);
    const [collabs, setCollabs] = useState<Collaborator[]>([]);
    const [searching, setSearching] = useState(false);
    const [role, setRole] = useState<'collaborator' | 'contributor' | 'featured'>('collaborator');

    useEffect(() => {
        fetchCollaborators(threadId).then(setCollabs);
    }, [threadId]);

    useEffect(() => {
        const term = q.trim();
        if (term.length < 1) { setResults([]); return; }
        setSearching(true);
        const id = setTimeout(async () => {
            const found = await searchProfiles(term, 8);
            setResults(found);
            setSearching(false);
        }, 200);
        return () => clearTimeout(id);
    }, [q]);

    const invite = async (userId: string, username: string) => {
        const ok = await addCollaborator(threadId, userId, role);
        if (ok) {
            toast.success(`@${username} agregado como ${role}`);
            setCollabs(await fetchCollaborators(threadId));
            setQ('');
            setResults([]);
        } else {
            toast.error('No se pudo agregar');
        }
    };

    const remove = async (userId: string, username: string) => {
        const ok = await removeCollaborator(threadId, userId);
        if (ok) {
            toast.success(`@${username} removido`);
            setCollabs(c => c.filter(x => x.user_id !== userId));
        }
    };

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal small invite-collab" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-handshake-simple"></i> Invitar colaboradores</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    <p class="hub-section-lead" style="margin:0 0 10px;">
                        Otras personas aparecerán como co-autoras de este hilo.
                    </p>

                    <label class="reel-caption">
                        <span><i class="fas fa-user-tag"></i> Tipo de colaboración</span>
                        <select value={role} onChange={(e: any) => setRole(e.currentTarget.value)}>
                            <option value="collaborator">Colaborador (co-autor)</option>
                            <option value="contributor">Contribuidor (aporte puntual)</option>
                            <option value="featured">Destacado (mención especial)</option>
                        </select>
                    </label>

                    <div class="chat-search" style="margin: 12px 0;">
                        <i class="fas fa-magnifying-glass"></i>
                        <input
                            type="search"
                            placeholder="Buscar usuario por @..."
                            value={q}
                            onInput={(e: any) => setQ(e.currentTarget.value)}
                            autoFocus
                        />
                    </div>

                    {searching && <p class="auth-hint"><i class="fas fa-circle-notch fa-spin"></i> Buscando…</p>}

                    {!searching && q.trim() && results.length === 0 && (
                        <p class="auth-hint">Sin coincidencias para "{q}"</p>
                    )}

                    {results.length > 0 && (
                        <div class="invite-results">
                            {results.map(p => {
                                const already = collabs.some(c => c.user_id === p.id);
                                return (
                                    <div class="invite-row" key={p.id}>
                                        <Avatar user={p} size={32} />
                                        <strong>@{p.username || 'Anónimo'}</strong>
                                        {already
                                            ? <span class="auth-hint"><i class="fas fa-check"></i> Ya agregado</span>
                                            : <button class="auth-btn primary small" onClick={() => invite(p.id, p.username || '')}>
                                                <i class="fas fa-plus"></i> Añadir
                                            </button>}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {collabs.length > 0 && (
                        <>
                            <h4 style="margin: 14px 0 6px; font-size: 0.85rem; color: var(--text-dim);">Colaboradores actuales</h4>
                            <div class="invite-results">
                                {collabs.map(c => (
                                    <div class="invite-row" key={c.user_id}>
                                        <Avatar user={{ id: c.user_id, username: c.username || 'a', pfp: c.pfp }} size={32} />
                                        <div style="flex:1;">
                                            <strong>@{c.username || 'Anónimo'}</strong>
                                            <small style="display:block; color:var(--text-dim); font-size:0.72rem;">{c.role}</small>
                                        </div>
                                        <button class="thread-del" onClick={() => remove(c.user_id, c.username || '')}>
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
