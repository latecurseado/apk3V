import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession, userLabel } from '../lib/auth';
import {
    fetchProfileByUsername, fetchProfileById, updateMyProfile, uploadAvatar,
    countThreadsByAuthor, countFollowers, countFollowing,
    fetchAchievements, BADGE_INFO,
    type ProfileFull, type Achievement,
} from '../lib/profile';
import { isFollowing, follow, unfollow, fetchFollowing, fetchFollowers } from '../lib/friends';
import { fetchThreads, fetchForums, type Thread, type Forum } from '../lib/forum';
import { fetchReactionsForThreads, type ReactionSummary } from '../lib/thread-actions';
import { subscribePresence } from '../lib/presence';
import { toast } from '../lib/toast';
import ThreadCard from './ThreadCard';
import Skeleton from './Skeleton';
import Avatar from './Avatar';
import ProfileActivityChart from './ProfileActivityChart';
import AccountBadge from './AccountBadge';
import ProfileActionsMenu from './ProfileActionsMenu';
import CountUp from './CountUp';

type Tab = 'hilos' | 'acerca' | 'siguiendo' | 'seguidores';

export default function ProfilePage() {
    const { user } = useSession();
    const [profile, setProfile] = useState<ProfileFull | null | undefined>(undefined);
    const [targetUsername, setTargetUsername] = useState<string | null>(null);
    const [stats, setStats] = useState({ threads: 0, followers: 0, following: 0 });
    const [following, setFollowing] = useState<any[]>([]);
    const [followers, setFollowers] = useState<any[]>([]);
    const [threads, setThreads] = useState<Thread[]>([]);
    const [forums, setForums] = useState<Forum[]>([]);
    const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionSummary[]>>({});
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [tab, setTab] = useState<Tab>('hilos');
    const [editing, setEditing] = useState(false);
    const [iFollow, setIFollow] = useState(false);
    const [theyFollowMe, setTheyFollowMe] = useState(false);
    const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

    const isMe = !targetUsername || (profile && user && profile.id === user.id);

    // Detecta a quién mostramos: ?u= → otro user; sin u= → mi perfil
    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        const u = sp.get('u');
        setTargetUsername(u);
    }, []);

    // Carga el perfil
    useEffect(() => {
        (async () => {
            if (targetUsername) {
                setProfile(await fetchProfileByUsername(targetUsername));
            } else if (user) {
                setProfile(await fetchProfileById(user.id));
            } else {
                setProfile(null);
            }
        })();
    }, [targetUsername, user?.id]);

    // Stats + listas + hilos del perfil
    useEffect(() => {
        if (!profile) return;
        Promise.all([
            countThreadsByAuthor(profile.id),
            countFollowers(profile.id),
            countFollowing(profile.id),
            fetchFollowing(profile.id),
            fetchFollowers(profile.id),
            fetchForums(),
            fetchThreads({ authorIds: [profile.id], limit: 30 }),
        ]).then(async ([t, fr, fi, flw, flwr, fs, ts]) => {
            setStats({ threads: t, followers: fr, following: fi });
            setFollowing(flw);
            setFollowers(flwr);
            setForums(fs);
            setThreads(ts);
            const rx = await fetchReactionsForThreads(ts.map(t => t.id), user?.id ?? null);
            setReactionsMap(rx);
        });
        if (user && profile.id !== user.id) {
            isFollowing(user.id, profile.id).then(setIFollow);
            isFollowing(profile.id, user.id).then(setTheyFollowMe);
        }
        fetchAchievements(profile.id).then(setAchievements);
    }, [profile?.id, user?.id]);

    // Presencia
    useEffect(() => {
        return subscribePresence(setOnlineIds);
    }, []);

    if (profile === undefined) return <Skeleton variant="profile" />;
    if (profile === null) {
        return (
            <div class="stub-state">
                <i class="fas fa-user-slash"></i>
                <h2>Perfil no encontrado</h2>
                <p>{targetUsername ? `No existe @${targetUsername}` : 'Inicia sesión para ver tu perfil'}</p>
            </div>
        );
    }

    const forumById: Record<string, Forum> = {};
    forums.forEach(f => { forumById[f.id] = f; });

    const handleFollow = async () => {
        if (!user) { toast.info('Inicia sesión para seguir'); return; }
        if (iFollow) {
            await unfollow(profile.id);
            setIFollow(false);
            setStats(s => ({ ...s, followers: s.followers - 1 }));
            toast.success(`Dejaste de seguir a @${profile.username}`);
        } else {
            await follow(profile.id);
            setIFollow(true);
            setStats(s => ({ ...s, followers: s.followers + 1 }));
            toast.success(`Sigues a @${profile.username}`);
        }
    };

    const isOnline = onlineIds.has(profile.id);

    return (
        <div class="profile-page">
            <ProfileHeader
                profile={profile}
                stats={stats}
                isMe={!!isMe}
                isOnline={isOnline}
                iFollow={iFollow}
                theyFollowMe={theyFollowMe}
                achievements={achievements}
                onEdit={() => setEditing(true)}
                onFollow={handleFollow}
                hasUser={!!user}
            />

            {editing && isMe && (
                <ProfileEditor
                    profile={profile}
                    onClose={() => setEditing(false)}
                    onSaved={(p) => { setProfile(p); setEditing(false); }}
                />
            )}

            <nav class="profile-tabs">
                <button class={tab === 'hilos' ? 'active' : ''} onClick={() => setTab('hilos')}>
                    <i class="fas fa-comments"></i> Hilos · {stats.threads}
                </button>
                <button class={tab === 'acerca' ? 'active' : ''} onClick={() => setTab('acerca')}>
                    <i class="fas fa-circle-info"></i> Acerca de
                </button>
                <button class={tab === 'siguiendo' ? 'active' : ''} onClick={() => setTab('siguiendo')}>
                    <i class="fas fa-user-group"></i> Siguiendo · {stats.following}
                </button>
                <button class={tab === 'seguidores' ? 'active' : ''} onClick={() => setTab('seguidores')}>
                    <i class="fas fa-users"></i> Seguidores · {stats.followers}
                </button>
            </nav>

            {tab === 'acerca' && (
                <>
                    <ProfileAbout profile={profile} />
                    <ProfileActivityChart userId={profile.id} />
                </>
            )}

            {tab === 'hilos' && (
                <div class="forum-list">
                    {threads.length === 0 && (
                        <div class="forum-empty"><i class="fas fa-feather"></i><p>Sin hilos todavía.</p></div>
                    )}
                    {threads.map(t => (
                        <ThreadCard
                            key={t.id}
                            thread={t}
                            forum={t.forum_id ? forumById[t.forum_id] : null}
                            currentUserId={user?.id ?? null}
                            reactions={reactionsMap[t.id] || []}
                            onDeleted={() => setThreads(ts => ts.filter(x => x.id !== t.id))}
                            onEdited={(c) => setThreads(ts => ts.map(x => x.id === t.id ? { ...x, content: c } : x))}
                        />
                    ))}
                </div>
            )}

            {tab === 'siguiendo' && (
                <UserGrid users={following} onlineIds={onlineIds} emptyMsg="No sigue a nadie aún." />
            )}
            {tab === 'seguidores' && (
                <UserGrid users={followers} onlineIds={onlineIds} emptyMsg="Sin seguidores todavía." />
            )}
        </div>
    );
}

/* ───────── Header ───────── */
function ProfileHeader({ profile, stats, isMe, isOnline, iFollow, theyFollowMe = false, achievements, onEdit, onFollow, hasUser }: {
    profile: ProfileFull; stats: any; isMe: boolean; isOnline: boolean; iFollow: boolean; theyFollowMe?: boolean;
    achievements: Achievement[];
    onEdit: () => void; onFollow: () => void; hasUser: boolean;
}) {
    return (
        <div class="profile-header">
            <div
                class="profile-banner"
                style={profile.banner_url ? `background-image: url(${profile.banner_url});` : ''}
            ></div>
            <div class="profile-id">
                <div class={`profile-avatar ${isOnline ? 'online' : ''} ${profile.frame ? 'frame-' + profile.frame : ''}`}>
                    <Avatar user={profile} size={110} />
                </div>
                <div class="profile-info">
                    <h1>
                        {profile.username || 'Anónimo'}
                        <AccountBadge
                            accountType={(profile as any).account_type}
                            businessCategory={(profile as any).business_category}
                            role={profile.role}
                            size="md"
                        />
                        {isOnline && !(profile as any).dnd_mode && <span class="profile-badge online">● En línea</span>}
                        {(profile as any).dnd_mode && <span class="profile-badge dnd"><i class="fas fa-moon"></i> No molestar</span>}
                    </h1>
                    {(profile as any).business_name && (
                        <p class="profile-business-name"><i class="fas fa-store"></i> {(profile as any).business_name}</p>
                    )}
                    {(profile as any).custom_status_emoji && (profile as any).custom_status && (
                        <p class="profile-status">
                            <span class="profile-status-emoji">{(profile as any).custom_status_emoji}</span>
                            <span>{(profile as any).custom_status}</span>
                        </p>
                    )}
                    <p>{profile.bio || (isMe ? '¡Añade una bio en Editar perfil!' : 'Sin bio')}</p>
                    {achievements.length > 0 && (
                        <div class="profile-badges">
                            {achievements.map(a => {
                                const info = BADGE_INFO[a.code] || { label: a.code, icon: 'fa-medal', color: 'var(--accent)' };
                                return (
                                    <span class="profile-badge-pill" title={info.label} style={`color: ${info.color}; border-color: ${info.color}40;`}>
                                        <i class={`fas ${info.icon}`}></i>
                                        {info.label}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                    <div class="profile-stats">
                        <span><b><CountUp value={stats.threads} /></b> hilos</span>
                        <span><b><CountUp value={stats.followers} /></b> seguidores</span>
                        <span><b><CountUp value={stats.following} /></b> siguiendo</span>
                    </div>
                </div>
                <div class="profile-actions">
                    {isMe ? (
                        <button class="auth-btn primary small" onClick={onEdit}>
                            <i class="fas fa-pen"></i> Editar perfil
                        </button>
                    ) : hasUser ? (
                        <>
                            <button class={`auth-btn ${iFollow ? 'ghost' : 'primary'} small`} onClick={onFollow}>
                                <i class={`fas ${iFollow ? 'fa-user-check' : 'fa-user-plus'}`}></i>
                                {iFollow ? 'Siguiendo' : 'Seguir'}
                            </button>
                            <a
                                class="auth-btn ghost small"
                                href={`/chat?to=${profile.id}`}
                                title={iFollow && theyFollowMe
                                    ? 'Amigos mutuos · chat libre'
                                    : 'Puedes escribirle · si no te sigue, quizá no responda'}
                            >
                                <i class="fas fa-message"></i>
                                Mensaje
                                {(!iFollow || !theyFollowMe) && (
                                    <small style="opacity:0.6; margin-left:4px; font-size:0.7em;">
                                        <i class="fas fa-circle-info"></i>
                                    </small>
                                )}
                            </a>
                            <ProfileActionsMenu targetId={profile.id} targetUsername={profile.username || ''} />
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

/* ───────── About (sección tipo Facebook) ───────── */
function ProfileAbout({ profile }: { profile: ProfileFull }) {
    const items: Array<{ icon: string; label: string; value?: string | null }> = [
        { icon: 'fa-location-dot',     label: 'Ubicación',   value: profile.location },
        { icon: 'fa-briefcase',        label: 'Trabajo',     value: profile.work },
        { icon: 'fa-graduation-cap',   label: 'Educación',   value: profile.education },
        { icon: 'fa-cake-candles',     label: 'Cumpleaños',  value: profile.birthdate ? new Date(profile.birthdate).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : '' },
        { icon: 'fa-heart',            label: 'Estado',      value: profile.relationship },
        { icon: 'fa-venus-mars',       label: 'Pronombres',  value: profile.pronouns || profile.gender },
        { icon: 'fa-globe',            label: 'Sitio web',   value: profile.website },
        { icon: 'fa-calendar',         label: 'Miembro desde', value: new Date(profile.created_at).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) },
    ];

    const social = profile.social_links || {};
    const socialList: Array<{ key: string; icon: string; url: string; label: string }> = [];
    if (social.twitter)   socialList.push({ key: 'twitter',   icon: 'fa-twitter',   url: `https://twitter.com/${social.twitter.replace('@', '')}`,    label: social.twitter });
    if (social.instagram) socialList.push({ key: 'instagram', icon: 'fa-instagram', url: `https://instagram.com/${social.instagram.replace('@', '')}`, label: social.instagram });
    if (social.facebook)  socialList.push({ key: 'facebook',  icon: 'fa-facebook',  url: `https://facebook.com/${social.facebook}`,                    label: social.facebook });
    if (social.tiktok)    socialList.push({ key: 'tiktok',    icon: 'fa-tiktok',    url: `https://tiktok.com/@${social.tiktok.replace('@', '')}`,     label: social.tiktok });
    if (social.youtube)   socialList.push({ key: 'youtube',   icon: 'fa-youtube',   url: `https://youtube.com/@${social.youtube.replace('@', '')}`,   label: social.youtube });
    if (social.github)    socialList.push({ key: 'github',    icon: 'fa-github',    url: `https://github.com/${social.github}`,                       label: social.github });

    const filled = items.filter(i => i.value && i.value.length > 0);

    return (
        <div class="profile-about">
            {profile.bio && (
                <section class="about-section">
                    <h3><i class="fas fa-quote-left"></i> Bio</h3>
                    <p class="about-bio">{profile.bio}</p>
                </section>
            )}

            {filled.length > 0 && (
                <section class="about-section">
                    <h3><i class="fas fa-circle-info"></i> Información</h3>
                    <ul class="about-list">
                        {filled.map(it => (
                            <li key={it.label}>
                                <i class={`fas ${it.icon}`}></i>
                                <span class="about-label">{it.label}</span>
                                <span class="about-value">{it.value}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {socialList.length > 0 && (
                <section class="about-section">
                    <h3><i class="fas fa-share-nodes"></i> Redes</h3>
                    <div class="about-social">
                        {socialList.map(s => (
                            <a key={s.key} class={`social-pill ${s.key}`} href={s.url} target="_blank" rel="noopener">
                                <i class={`fab ${s.icon}`}></i> {s.label}
                            </a>
                        ))}
                    </div>
                </section>
            )}

            {filled.length === 0 && !profile.bio && socialList.length === 0 && (
                <div class="forum-empty">
                    <i class="fas fa-circle-info"></i>
                    <p>Aún sin información completa. Pulsa "Editar perfil" para añadir más detalles.</p>
                </div>
            )}
        </div>
    );
}

/* ───────── Grid de usuarios ───────── */
function UserGrid({ users, onlineIds, emptyMsg }: { users: any[]; onlineIds: Set<string>; emptyMsg: string }) {
    if (users.length === 0) return <div class="forum-empty"><i class="fas fa-user-group"></i><p>{emptyMsg}</p></div>;
    return (
        <div class="profile-user-grid">
            {users.map(u => (
                <a class="profile-user-card" href={`/perfil?u=${u.username}`} key={u.id}>
                    <span class={`fp-avatar ${onlineIds.has(u.id) ? 'online' : ''} ${u.role === 'admin' ? 'admin' : ''}`}>
                        <i class="fas fa-user"></i>
                    </span>
                    <strong>@{u.username || 'Anónimo'}</strong>
                    {u.role === 'admin' && <small>Admin</small>}
                </a>
            ))}
        </div>
    );
}

/* ───────── Editor de perfil (modal) ───────── */
const ACCENT_PRESETS = [
    { v: '#00d2ff', label: 'Cian' },
    { v: '#a855f7', label: 'Violeta' },
    { v: '#ec4899', label: 'Rosa' },
    { v: '#ff0844', label: 'Rojo' },
    { v: '#f59e0b', label: 'Ámbar' },
    { v: '#10b981', label: 'Verde' },
    { v: '#3a7bd5', label: 'Azul' },
    { v: '#fbbf24', label: 'Oro' },
];

const FRAME_OPTIONS: { v: string; label: string; preview: string }[] = [
    { v: '', label: 'Sin marco', preview: '' },
    { v: 'rainbow', label: 'Arcoíris', preview: 'conic-gradient(from 0deg, #ff0844, #f59e0b, #facc15, #22c55e, #00d2ff, #a855f7, #ff0844)' },
    { v: 'gold', label: 'Oro', preview: 'linear-gradient(135deg, #facc15, #f59e0b, #fbbf24)' },
    { v: 'pulse-cyan', label: 'Pulso cian', preview: 'radial-gradient(circle, #00d2ff, #3a7bd5)' },
];

const AVATAR_STYLES = [
    { v: '', label: 'Inicial' },
    { v: 'lorelei', label: 'Lorelei' },
    { v: 'adventurer', label: 'Aventura' },
    { v: 'avataaars', label: 'Avataaars' },
    { v: 'bottts', label: 'Robots' },
    { v: 'pixel-art', label: 'Pixel' },
    { v: 'fun-emoji', label: 'Emoji' },
];

function ProfileEditor({ profile, onClose, onSaved }: {
    profile: ProfileFull; onClose: () => void; onSaved: (p: ProfileFull) => void;
}) {
    const [username, setUsername] = useState(profile.username || '');
    const [bio, setBio] = useState(profile.bio || '');
    const [pfp, setPfp] = useState<string | null>(profile.pfp || null);
    const [banner, setBanner] = useState<string | null>(profile.banner_url || null);
    const [accentColor, setAccentColor] = useState((profile as any).accent_color || '#00d2ff');
    const [frame, setFrame] = useState((profile as any).frame || '');
    const [avatarStyle, setAvatarStyle] = useState((profile as any).avatar_style || '');
    const [location, setLocation] = useState(profile.location || '');
    const [work, setWork] = useState(profile.work || '');
    const [education, setEducation] = useState(profile.education || '');
    const [website, setWebsite] = useState(profile.website || '');
    const [relationship, setRelationship] = useState(profile.relationship || '');
    const [pronouns, setPronouns] = useState(profile.pronouns || '');
    const [twitter, setTwitter] = useState(profile.social_links?.twitter || '');
    const [instagram, setInstagram] = useState(profile.social_links?.instagram || '');
    const [facebook, setFacebook] = useState(profile.social_links?.facebook || '');
    const [tab, setTab] = useState<'basic' | 'style' | 'about' | 'social'>('basic');
    const [saving, setSaving] = useState(false);
    const [uploadingPfp, setUploadingPfp] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    const handlePfpFile = async (file: File) => {
        if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return; }
        if (!file.type.startsWith('image/')) { toast.error('Solo imágenes'); return; }
        setUploadingPfp(true);
        const res = await uploadAvatar(file);
        setUploadingPfp(false);
        if (res.ok && res.url) {
            setPfp(res.url);
            toast.success('Foto actualizada');
        } else {
            toast.error('Error: ' + (res.reason || 'desconocido'));
        }
    };

    const handleBannerFile = async (file: File) => {
        if (file.size > 8 * 1024 * 1024) { toast.error('Máximo 8MB'); return; }
        if (!file.type.startsWith('image/')) { toast.error('Solo imágenes'); return; }
        setUploadingBanner(true);
        // Reusamos el uploader de attachments para el banner
        const { uploadAttachment } = await import('../lib/attachments');
        const res = await uploadAttachment(file);
        setUploadingBanner(false);
        if (res.ok && res.attachment) {
            setBanner(res.attachment.url);
            toast.success('Banner actualizado');
        } else {
            toast.error('Error: ' + (res.reason || 'desconocido'));
        }
    };

    const onPfpDrop = (e: any) => {
        e.preventDefault();
        const f = e.dataTransfer?.files?.[0] as File | undefined;
        if (f) handlePfpFile(f);
    };

    const onBannerDrop = (e: any) => {
        e.preventDefault();
        const f = e.dataTransfer?.files?.[0] as File | undefined;
        if (f) handleBannerFile(f);
    };

    const save = async () => {
        setSaving(true);
        const social_links = { twitter, instagram, facebook };
        const patch: any = {
            username: username.trim(), bio, pfp, banner_url: banner,
            accent_color: accentColor, frame, avatar_style: avatarStyle,
            location, work, education, website, relationship, pronouns,
            social_links,
        };
        const res = await updateMyProfile(patch);
        setSaving(false);
        if (res.ok) {
            toast.success('Perfil guardado');
            onSaved({ ...profile, ...patch });
        } else {
            toast.error('Error: ' + (res.reason || 'desconocido'));
        }
    };

    const completeness = Math.round((
        (username ? 1 : 0) + (bio.length > 20 ? 1 : 0) + (pfp ? 1 : 0) + (banner ? 1 : 0) +
        (location ? 1 : 0) + (work ? 1 : 0) + (website ? 1 : 0) + (twitter || instagram || facebook ? 1 : 0)
    ) / 8 * 100);

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal profile-editor" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-pen"></i> Editar perfil</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>

                <div class="pe-progress-strip">
                    <div class="pe-progress-bar">
                        <div class="pe-progress-fill" style={`width: ${completeness}%; background: ${accentColor};`}></div>
                    </div>
                    <small><b>{completeness}%</b> · perfil completo</small>
                </div>

                {/* Hero preview · banner + avatar overlay */}
                <div class="pe-hero" style={`--pe-accent: ${accentColor};`}>
                    <div
                        class={`pe-hero-banner ${banner ? 'has-img' : ''}`}
                        style={banner ? `background-image: url('${banner}');` : ''}
                        onDragOver={(e: any) => e.preventDefault()}
                        onDrop={onBannerDrop}
                    >
                        {!banner && <div class="pe-banner-placeholder"><i class="fas fa-panorama"></i> Arrastra o sube tu banner</div>}
                        <label class="pe-banner-edit" title="Cambiar banner">
                            <input type="file" accept="image/*" onChange={(e: any) => { const f = e.target.files?.[0]; if (f) handleBannerFile(f); e.target.value = ''; }} hidden />
                            <i class={`fas ${uploadingBanner ? 'fa-circle-notch fa-spin' : 'fa-camera'}`}></i>
                        </label>
                        {banner && (
                            <button class="pe-banner-rm" onClick={() => setBanner(null)} title="Quitar banner">
                                <i class="fas fa-xmark"></i>
                            </button>
                        )}
                    </div>
                    <div
                        class={`pe-hero-avatar ${frame ? 'frame-' + frame : ''}`}
                        style={frame === 'rainbow' ? `background: ${FRAME_OPTIONS[1].preview};` : ''}
                        onDragOver={(e: any) => e.preventDefault()}
                        onDrop={onPfpDrop}
                    >
                        <div class="pe-hero-avatar-inner">
                            {pfp
                                ? <img src={pfp} alt="" />
                                : <i class="fas fa-user"></i>}
                            {uploadingPfp && <div class="pe-spinner"><i class="fas fa-circle-notch fa-spin"></i></div>}
                        </div>
                        <label class="pe-avatar-edit" title="Cambiar foto">
                            <input type="file" accept="image/*" onChange={(e: any) => { const f = e.target.files?.[0]; if (f) handlePfpFile(f); e.target.value = ''; }} hidden />
                            <i class="fas fa-camera"></i>
                        </label>
                    </div>
                </div>

                <nav class="modal-tabs pe-tabs">
                    <button class={tab === 'basic' ? 'active' : ''} onClick={() => setTab('basic')}>
                        <i class="fas fa-user"></i> Básico
                    </button>
                    <button class={tab === 'style' ? 'active' : ''} onClick={() => setTab('style')}>
                        <i class="fas fa-palette"></i> Estilo
                    </button>
                    <button class={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>
                        <i class="fas fa-id-card"></i> Acerca de
                    </button>
                    <button class={tab === 'social' ? 'active' : ''} onClick={() => setTab('social')}>
                        <i class="fas fa-share-nodes"></i> Redes
                    </button>
                </nav>
                <div class="modal-body">
                    <div class="form-grid pe-form">
                        {tab === 'basic' && (
                            <>
                                <label class="pe-field"><span><i class="fas fa-at"></i> Username</span>
                                    <input type="text" value={username} onInput={(e: any) => setUsername(e.currentTarget.value)} maxLength={30} />
                                </label>
                                <label class="pe-field"><span><i class="fas fa-quote-left"></i> Bio</span>
                                    <textarea rows={3} value={bio} onInput={(e: any) => setBio(e.currentTarget.value)} maxLength={300} placeholder="Cuenta algo sobre ti..." />
                                    <small class="auth-hint">{bio.length}/300</small>
                                </label>
                            </>
                        )}

                        {tab === 'style' && (
                            <>
                                <label class="pe-field">
                                    <span><i class="fas fa-droplet"></i> Color de acento</span>
                                    <div class="pe-color-grid">
                                        {ACCENT_PRESETS.map(c => (
                                            <button
                                                key={c.v}
                                                type="button"
                                                class={`pe-color-swatch ${accentColor === c.v ? 'active' : ''}`}
                                                style={`background: ${c.v};`}
                                                onClick={() => setAccentColor(c.v)}
                                                title={c.label}
                                            >
                                                {accentColor === c.v && <i class="fas fa-check"></i>}
                                            </button>
                                        ))}
                                        <input
                                            type="color"
                                            value={accentColor}
                                            onInput={(e: any) => setAccentColor(e.currentTarget.value)}
                                            class="pe-color-custom"
                                            title="Color personalizado"
                                        />
                                    </div>
                                </label>

                                <label class="pe-field">
                                    <span><i class="fas fa-frame"></i> Marco del avatar</span>
                                    <div class="pe-frame-grid">
                                        {FRAME_OPTIONS.map(f => (
                                            <button
                                                key={f.v}
                                                type="button"
                                                class={`pe-frame-opt ${frame === f.v ? 'active' : ''}`}
                                                onClick={() => setFrame(f.v)}
                                            >
                                                <span
                                                    class="pe-frame-ring"
                                                    style={f.preview ? `background: ${f.preview};` : 'background: rgba(255,255,255,0.1); border:2px dashed rgba(255,255,255,0.3);'}
                                                >
                                                    <span class="pe-frame-inner">
                                                        {pfp ? <img src={pfp} alt="" /> : <i class="fas fa-user"></i>}
                                                    </span>
                                                </span>
                                                <small>{f.label}</small>
                                            </button>
                                        ))}
                                    </div>
                                </label>

                                <label class="pe-field">
                                    <span><i class="fas fa-icons"></i> Estilo de avatar generado</span>
                                    <small class="auth-hint">Si no subes foto propia, se usa este estilo procedural de DiceBear basado en tu username.</small>
                                    <div class="pe-avatar-style-grid">
                                        {AVATAR_STYLES.map(s => (
                                            <button
                                                key={s.v}
                                                type="button"
                                                class={`pe-avatar-style ${avatarStyle === s.v ? 'active' : ''}`}
                                                onClick={() => setAvatarStyle(s.v)}
                                            >
                                                <img
                                                    src={`https://api.dicebear.com/7.x/${s.v || 'initials'}/svg?seed=${encodeURIComponent(username || 'preview')}`}
                                                    alt={s.label}
                                                    loading="lazy"
                                                />
                                                <small>{s.label}</small>
                                            </button>
                                        ))}
                                    </div>
                                </label>
                            </>
                        )}
                        {tab === 'about' && (
                            <>
                                <label><span><i class="fas fa-location-dot"></i> Ubicación</span>
                                    <input type="text" value={location} onInput={(e: any) => setLocation(e.currentTarget.value)} placeholder="Tres Valles, Veracruz" maxLength={80} />
                                </label>
                                <label><span><i class="fas fa-briefcase"></i> Trabajo</span>
                                    <input type="text" value={work} onInput={(e: any) => setWork(e.currentTarget.value)} placeholder="Lo que haces · empresa" maxLength={80} />
                                </label>
                                <label><span><i class="fas fa-graduation-cap"></i> Educación</span>
                                    <input type="text" value={education} onInput={(e: any) => setEducation(e.currentTarget.value)} placeholder="Escuela o universidad" maxLength={80} />
                                </label>
                                <label><span><i class="fas fa-heart"></i> Estado sentimental</span>
                                    <select value={relationship} onChange={(e: any) => setRelationship(e.currentTarget.value)}>
                                        <option value="">Prefiero no decir</option>
                                        <option value="Soltero/a">Soltero/a</option>
                                        <option value="En una relación">En una relación</option>
                                        <option value="Casado/a">Casado/a</option>
                                        <option value="Es complicado">Es complicado</option>
                                    </select>
                                </label>
                                <label><span><i class="fas fa-venus-mars"></i> Pronombres</span>
                                    <input type="text" value={pronouns} onInput={(e: any) => setPronouns(e.currentTarget.value)} placeholder="él · ella · elle" maxLength={30} />
                                </label>
                                <label><span><i class="fas fa-globe"></i> Sitio web</span>
                                    <input type="url" value={website} onInput={(e: any) => setWebsite(e.currentTarget.value)} placeholder="https://..." />
                                </label>
                            </>
                        )}
                        {tab === 'social' && (
                            <>
                                <label><span><i class="fab fa-twitter"></i> Twitter / X</span>
                                    <input type="text" value={twitter} onInput={(e: any) => setTwitter(e.currentTarget.value)} placeholder="@usuario" />
                                </label>
                                <label><span><i class="fab fa-instagram"></i> Instagram</span>
                                    <input type="text" value={instagram} onInput={(e: any) => setInstagram(e.currentTarget.value)} placeholder="@usuario" />
                                </label>
                                <label><span><i class="fab fa-facebook"></i> Facebook</span>
                                    <input type="text" value={facebook} onInput={(e: any) => setFacebook(e.currentTarget.value)} placeholder="usuario" />
                                </label>
                            </>
                        )}
                        <div class="form-actions">
                            <button class="auth-btn ghost small" onClick={onClose}>Cancelar</button>
                            <button class="auth-btn primary small" onClick={save} disabled={saving || !username.trim()}>
                                <i class="fas fa-floppy-disk"></i> {saving ? 'Guardando…' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
