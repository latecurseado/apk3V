import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import { fetchForumsWithStats, createForum, deleteForum, type Forum } from '../lib/forum';
import { fetchMySubscribedForumIds, toggleSubscription } from '../lib/forum-mgmt';
import { requireAuthOrPrompt } from '../lib/auth-gate';
import { toast } from '../lib/toast';
import Skeleton from './Skeleton';

const ICON_OPTIONS = [
    'fa-hashtag', 'fa-comments', 'fa-newspaper', 'fa-hands-helping', 'fa-calendar',
    'fa-store', 'fa-music', 'fa-gamepad', 'fa-camera', 'fa-utensils',
    'fa-futbol', 'fa-car', 'fa-paw', 'fa-heart', 'fa-graduation-cap',
    'fa-tools', 'fa-leaf', 'fa-globe', 'fa-fire', 'fa-bolt',
];

const COLOR_PRESETS = ['#00d2ff', '#ff0844', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#ef4444', '#3b82f6'];

export default function ForumDirectory() {
    const { user } = useSession();
    const [forums, setForums] = useState<Forum[] | null>(null);
    const [subbedIds, setSubbedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => {
        fetchForumsWithStats().then(setForums);
    }, []);

    useEffect(() => {
        if (!user) { setSubbedIds(new Set()); return; }
        fetchMySubscribedForumIds(user.id).then(setSubbedIds);
        const ch = supabase
            .channel('forum-dir-subs')
            .on('postgres_changes' as any,
                { event: '*', schema: 'public', table: 'forum_subscriptions' },
                async () => setSubbedIds(await fetchMySubscribedForumIds(user.id)))
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [user?.id]);

    // Realtime de foros
    useEffect(() => {
        const ch = supabase
            .channel('forum-dir-list')
            .on('postgres_changes' as any,
                { event: '*', schema: 'public', table: 'forums' },
                async () => setForums(await fetchForumsWithStats()))
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, []);

    const toggleSub = async (f: Forum) => {
        if (!requireAuthOrPrompt('suscribirte a un foro', user?.id ?? null)) return;
        const r = await toggleSubscription(f.id);
        if (r === null) return;
        toast.success(r ? `Suscrito a #${f.slug}` : `Sin suscribir`);
    };

    const filtered = (forums || []).filter(f => {
        const t = search.trim().toLowerCase();
        if (!t) return true;
        return f.name.toLowerCase().includes(t) || f.slug.toLowerCase().includes(t)
            || (f.description || '').toLowerCase().includes(t);
    });

    return (
        <div class="forum-dir">
            <header class="forum-dir-hero">
                <h1><i class="fas fa-compass"></i> Todos los foros</h1>
                <p>Encuentra una comunidad o crea la tuya.</p>
            </header>

            <div class="forum-dir-toolbar">
                <div class="forum-dir-search">
                    <i class="fas fa-magnifying-glass"></i>
                    <input type="search" placeholder="Buscar foro por nombre o slug..."
                        value={search} onInput={(e: any) => setSearch(e.currentTarget.value)} />
                </div>
                <button class="auth-btn primary" onClick={() => {
                    if (!requireAuthOrPrompt('crear un foro', user?.id ?? null)) return;
                    setShowCreate(true);
                }}>
                    <i class="fas fa-plus"></i> Crear nuevo foro
                </button>
            </div>

            {showCreate && (
                <CreateForumPanel onClose={() => setShowCreate(false)} onCreated={async () => {
                    setForums(await fetchForumsWithStats());
                    setShowCreate(false);
                }} />
            )}

            {!forums && <div class="forum-dir-grid"><Skeleton variant="card" count={6} /></div>}

            {forums && filtered.length === 0 && (
                <div class="forum-empty">
                    <i class="fas fa-magnifying-glass"></i>
                    <p>Sin coincidencias para "{search}".</p>
                </div>
            )}

            {forums && filtered.length > 0 && (
                <div class="forum-dir-grid">
                    {filtered.map(f => {
                        const isSub = subbedIds.has(f.id);
                        const accent = f.color || '#00d2ff';
                        return (
                            <article class="forum-card" key={f.id} style={`--forum-accent: ${accent};`}>
                                <a class="forum-card-banner" href={`/foro?f=${f.slug}`} style={
                                    f.banner_url
                                        ? `background-image: url("${f.banner_url}");`
                                        : `background: linear-gradient(135deg, ${accent}33, ${accent}11);`
                                }>
                                    <span class="forum-card-icon" style={`background: ${accent};`}>
                                        <i class={`fas ${f.icon}`}></i>
                                    </span>
                                    {f.is_system && <span class="forum-card-tag">Oficial</span>}
                                    {(f as any).visibility === 'invite' && <span class="forum-card-tag invite"><i class="fas fa-lock"></i> Invitación</span>}
                                </a>
                                <div class="forum-card-body">
                                    <a class="forum-card-title" href={`/foro?f=${f.slug}`}>
                                        <h3>{f.name}</h3>
                                        <small>#{f.slug}</small>
                                    </a>
                                    {f.description && <p class="forum-card-desc">{f.description}</p>}
                                    <div class="forum-card-stats">
                                        <span><i class="fas fa-user-group"></i> {f.member_count || 0}</span>
                                        <span><i class="fas fa-comments"></i> {f.thread_count || 0}</span>
                                    </div>
                                    <div class="forum-card-actions">
                                        <a class="auth-btn ghost small" href={`/foro?f=${f.slug}`}>
                                            <i class="fas fa-arrow-right"></i> Entrar
                                        </a>
                                        <button
                                            class={`auth-btn small ${isSub ? 'ghost' : 'primary'}`}
                                            onClick={() => toggleSub(f)}
                                        >
                                            <i class={`fas ${isSub ? 'fa-star' : 'fa-star'}`}></i>
                                            {isSub ? 'Suscrito' : 'Seguir'}
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ────────── Panel para crear foro ────────── */
function CreateForumPanel({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('fa-comments');
    const [color, setColor] = useState('#00d2ff');
    const [bannerUrl, setBannerUrl] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!name.trim()) return;
        setBusy(true);
        const res = await createForum(name, description, icon);
        if (!res.ok || !res.forum) {
            toast.error('Error: ' + (res.reason || ''));
            setBusy(false);
            return;
        }
        // Update con color + banner
        await supabase.from('forums').update({ color, banner_url: bannerUrl })
            .eq('id', res.forum.id);
        toast.success('Foro creado');
        setBusy(false);
        onCreated();
    };

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-plus"></i> Crear nuevo foro</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    {/* Preview */}
                    <div class="create-forum-preview" style={`--forum-accent: ${color};`}>
                        <div class="forum-card-banner" style={
                            bannerUrl
                                ? `background-image: url("${bannerUrl}");`
                                : `background: linear-gradient(135deg, ${color}33, ${color}11);`
                        }>
                            <span class="forum-card-icon" style={`background: ${color};`}>
                                <i class={`fas ${icon}`}></i>
                            </span>
                        </div>
                        <div class="create-forum-preview-name">
                            <strong>{name || 'Nombre del foro'}</strong>
                            <small>{description || 'Descripción corta...'}</small>
                        </div>
                    </div>

                    <div class="form-grid">
                        <label><span>Nombre del foro</span>
                            <input type="text" value={name} maxLength={40}
                                onInput={(e: any) => setName(e.currentTarget.value)}
                                placeholder="Ej. Fotografía local" />
                        </label>
                        <label><span>Descripción corta</span>
                            <input type="text" value={description} maxLength={120}
                                onInput={(e: any) => setDescription(e.currentTarget.value)}
                                placeholder="Una línea sobre qué se discute aquí" />
                        </label>
                        <label><span>URL de banner (opcional)</span>
                            <input type="url" value={bannerUrl}
                                onInput={(e: any) => setBannerUrl(e.currentTarget.value)}
                                placeholder="https://imagen.com/banner.jpg" />
                        </label>
                        <label><span>Icono</span>
                            <div class="icon-grid">
                                {ICON_OPTIONS.map(ic => (
                                    <button
                                        type="button"
                                        key={ic}
                                        class={`icon-opt ${ic === icon ? 'active' : ''}`}
                                        onClick={() => setIcon(ic)}
                                        style={ic === icon ? `background: ${color};` : ''}
                                    >
                                        <i class={`fas ${ic}`}></i>
                                    </button>
                                ))}
                            </div>
                        </label>
                        <label><span>Color del foro</span>
                            <div class="color-grid">
                                {COLOR_PRESETS.map(c => (
                                    <button
                                        type="button"
                                        key={c}
                                        class={`color-opt ${c === color ? 'active' : ''}`}
                                        onClick={() => setColor(c)}
                                        style={`background: ${c};`}
                                    >
                                        {c === color && <i class="fas fa-check"></i>}
                                    </button>
                                ))}
                                <input type="color" value={color}
                                    onInput={(e: any) => setColor(e.currentTarget.value)}
                                    class="color-picker-custom" />
                            </div>
                        </label>
                        <div class="form-actions">
                            <button class="auth-btn ghost small" onClick={onClose} disabled={busy}>Cancelar</button>
                            <button class="auth-btn primary" onClick={submit} disabled={busy || !name.trim()}>
                                <i class="fas fa-plus"></i> {busy ? 'Creando…' : 'Crear foro'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
