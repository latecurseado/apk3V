import { useEffect, useState } from 'preact/hooks';
import { updateForum, type Forum } from '../lib/forum';
import { fetchMods, addMod, removeMod } from '../lib/forum-mgmt';
import { searchProfiles } from '../lib/friends';
import { toast } from '../lib/toast';
import type { Profile } from '../lib/forum';

interface Props {
    forum: Forum;
    onClose: () => void;
    onUpdated: (patch: Partial<Forum>) => void;
}

export default function ForumSettings({ forum, onClose, onUpdated }: Props) {
    const [tab, setTab] = useState<'general' | 'reglas' | 'mods'>('general');
    const [name, setName] = useState(forum.name);
    const [description, setDescription] = useState(forum.description);
    const [icon, setIcon] = useState(forum.icon);
    const [color, setColor] = useState(forum.color || '#00d2ff');
    const [visibility, setVisibility] = useState<'public' | 'invite'>((forum as any).visibility || 'public');
    const [rules, setRules] = useState(forum.rules || '');
    const [saving, setSaving] = useState(false);

    const [mods, setMods] = useState<Profile[]>([]);
    const [modSearch, setModSearch] = useState('');
    const [modResults, setModResults] = useState<Profile[]>([]);

    useEffect(() => { fetchMods(forum.id).then(setMods); }, [forum.id]);

    useEffect(() => {
        const q = modSearch.trim();
        if (q.length < 1) { setModResults([]); return; }
        const t = setTimeout(async () => {
            const list = await searchProfiles(q, 8);
            const modIds = new Set(mods.map(m => m.id));
            setModResults(list.filter(p => !modIds.has(p.id)));
        }, 200);
        return () => clearTimeout(t);
    }, [modSearch, mods.length]);

    const saveGeneral = async () => {
        setSaving(true);
        const ok = await updateForum(forum.id, {
            name, description, icon, color,
            ...(visibility !== ((forum as any).visibility || 'public') ? { visibility } as any : {}),
        });
        setSaving(false);
        if (ok) {
            toast.success('Foro actualizado');
            onUpdated({ name, description, icon, color });
        } else toast.error('Error al guardar');
    };

    const saveRules = async () => {
        setSaving(true);
        const ok = await updateForum(forum.id, { rules });
        setSaving(false);
        if (ok) { toast.success('Reglas guardadas'); onUpdated({ rules }); }
        else toast.error('Error al guardar');
    };

    const doAddMod = async (p: Profile) => {
        const ok = await addMod(forum.id, p.id);
        if (ok) { setMods(m => [...m, p]); setModSearch(''); toast.success(`@${p.username} es ahora moderador`); }
        else toast.error('No se pudo añadir');
    };

    const doRemoveMod = async (p: Profile) => {
        if (!confirm(`¿Quitar a @${p.username} como moderador?`)) return;
        const ok = await removeMod(forum.id, p.id);
        if (ok) { setMods(m => m.filter(x => x.id !== p.id)); toast.success('Moderador removido'); }
        else toast.error('No se pudo remover');
    };

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-gear"></i> Configurar #{forum.slug}</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <nav class="modal-tabs">
                    <button class={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>General</button>
                    <button class={tab === 'reglas' ? 'active' : ''} onClick={() => setTab('reglas')}>Reglas</button>
                    <button class={tab === 'mods' ? 'active' : ''} onClick={() => setTab('mods')}>Moderadores</button>
                </nav>
                <div class="modal-body">
                    {tab === 'general' && (
                        <div class="form-grid">
                            <label><span>Nombre</span>
                                <input type="text" value={name} onInput={(e: any) => setName(e.currentTarget.value)} /></label>
                            <label><span>Descripción</span>
                                <input type="text" value={description} onInput={(e: any) => setDescription(e.currentTarget.value)} /></label>
                            <label><span>Icono (clase FA)</span>
                                <input type="text" value={icon} onInput={(e: any) => setIcon(e.currentTarget.value)} placeholder="fa-comments" /></label>
                            <label><span>Color</span>
                                <input type="color" value={color} onInput={(e: any) => setColor(e.currentTarget.value)} /></label>
                            <label><span>Visibilidad</span>
                                <select value={visibility} onChange={(e: any) => setVisibility(e.currentTarget.value)} disabled={forum.is_system}>
                                    <option value="public">🌐 Pública — cualquiera lee y postea</option>
                                    <option value="invite">🔒 Invitación — solo invitados ven hilos</option>
                                </select>
                            </label>
                            <div class="form-actions">
                                <button class="auth-btn primary small" onClick={saveGeneral} disabled={saving}>
                                    <i class="fas fa-floppy-disk"></i> {saving ? 'Guardando…' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    )}

                    {tab === 'reglas' && (
                        <div class="form-grid">
                            <label><span>Reglas del subforo (HTML permitido)</span>
                                <textarea rows={10} value={rules} onInput={(e: any) => setRules(e.currentTarget.value)}
                                    placeholder="1. Respeta a los demás&#10;2. Solo contenido de Tres Valles&#10;3. ..." />
                            </label>
                            <div class="form-actions">
                                <button class="auth-btn primary small" onClick={saveRules} disabled={saving}>
                                    <i class="fas fa-floppy-disk"></i> {saving ? 'Guardando…' : 'Guardar reglas'}
                                </button>
                            </div>
                        </div>
                    )}

                    {tab === 'mods' && (
                        <div class="form-grid">
                            <label><span>Moderadores actuales · {mods.length}</span>
                                <div class="mods-list">
                                    {mods.length === 0 && <small>Sin moderadores. Búscalos abajo.</small>}
                                    {mods.map(m => (
                                        <div class="mod-row" key={m.id}>
                                            <span class="fp-avatar"><i class="fas fa-user-shield"></i></span>
                                            <strong>@{m.username}</strong>
                                            <button class="cms-btn danger" onClick={() => doRemoveMod(m)}><i class="fas fa-xmark"></i></button>
                                        </div>
                                    ))}
                                </div>
                            </label>
                            <label><span>Añadir moderador (busca por username)</span>
                                <input type="text" value={modSearch} onInput={(e: any) => setModSearch(e.currentTarget.value)} placeholder="Buscar usuario…" />
                                {modResults.length > 0 && (
                                    <div class="mods-search-results">
                                        {modResults.map(p => (
                                            <button class="mod-row" key={p.id} onClick={() => doAddMod(p)}>
                                                <span class="fp-avatar"><i class="fas fa-user"></i></span>
                                                <strong>@{p.username}</strong>
                                                <small>+ Añadir</small>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </label>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
