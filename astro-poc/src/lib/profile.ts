import { supabase } from './supabase';

export interface SocialLinks {
    twitter?: string;
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    youtube?: string;
    github?: string;
}

export interface ProfileFull {
    id: string;
    username: string;
    pfp: string | null;
    bio: string;
    banner_url: string | null;
    role: string | null;
    badges: string[] | null;
    created_at: string;
    frame?: string;
    accent_color?: string;
    avatar_style?: string;
    location?: string;
    work?: string;
    education?: string;
    website?: string;
    relationship?: string;
    gender?: string;
    pronouns?: string;
    social_links?: SocialLinks;
    birthdate?: string | null;
}

export interface Achievement {
    id: string;
    user_id: string;
    code: string;
    granted_at: string;
}

export async function fetchAchievements(userId: string): Promise<Achievement[]> {
    const { data } = await supabase.from('achievements').select('*').eq('user_id', userId);
    return (data || []) as Achievement[];
}

export const BADGE_INFO: Record<string, { label: string; icon: string; color: string }> = {
    first_post:  { label: 'Primer hilo',   icon: 'fa-feather',       color: '#ffd02b' },
    liked:       { label: '10 likes',      icon: 'fa-heart',         color: '#ff6b9d' },
    popular:     { label: '100 likes',     icon: 'fa-star',          color: '#ffaa00' },
    early_user:  { label: 'Pionero',       icon: 'fa-rocket',        color: '#00d2ff' },
    admin:       { label: 'Admin',         icon: 'fa-shield-halved', color: '#3a7bd5' },
};

const PROFILE_COLS = 'id, username, pfp, bio, banner_url, role, badges, created_at, frame, accent_color, avatar_style, location, work, education, website, relationship, gender, pronouns, social_links, birthdate';

export async function fetchProfileByUsername(username: string): Promise<ProfileFull | null> {
    const { data } = await supabase.from('profiles').select(PROFILE_COLS).eq('username', username).maybeSingle();
    return (data as ProfileFull | null) || null;
}

export async function fetchProfileById(id: string): Promise<ProfileFull | null> {
    const { data } = await supabase.from('profiles').select(PROFILE_COLS).eq('id', id).maybeSingle();
    return (data as ProfileFull | null) || null;
}

export async function updateMyProfile(patch: Partial<ProfileFull>): Promise<{ ok: boolean; reason?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { ok: false, reason: 'Sin sesión' };
    const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
}

export async function uploadAvatar(file: File): Promise<{ ok: boolean; url?: string; reason?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { ok: false, reason: 'Sin sesión' };
    if (file.size > 5 * 1024 * 1024) return { ok: false, reason: 'Máximo 5 MB' };
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${session.user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, {
        cacheControl: '3600', upsert: true,
    });
    if (error) return { ok: false, reason: error.message };
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
}

export async function countThreadsByAuthor(authorId: string): Promise<number> {
    const { count } = await supabase.from('threads').select('*', { count: 'exact', head: true })
        .eq('author_id', authorId);
    return count ?? 0;
}

export async function countFollowers(userId: string): Promise<number> {
    const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true })
        .eq('followed_id', userId);
    return count ?? 0;
}

export async function countFollowing(userId: string): Promise<number> {
    const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);
    return count ?? 0;
}
