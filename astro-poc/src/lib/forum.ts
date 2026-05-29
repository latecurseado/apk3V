import { supabase } from './supabase';

export interface Profile {
    id: string;
    username: string;
    pfp: string | null;
    role: string | null;
}

export interface ThreadAttachment {
    url: string;
    type: 'image' | 'file';
    name: string;
    size: number;
}

export interface Thread {
    id: string;
    author_id: string;
    content: string;
    category: string | null;
    forum_id: string | null;
    created_at: string;
    edited_at: string | null;
    pinned_at: string | null;
    is_bot: boolean;
    attachments: ThreadAttachment[];
    author: Profile | null;
    likes_count: number;
    liked_by_me: boolean;
    comments_count: number;
}

export interface Forum {
    id: string;
    slug: string;
    name: string;
    description: string;
    icon: string;
    is_system: boolean;
    sort_order: number;
    rules: string;
    color: string;
    banner_url?: string;
    long_description?: string;
    button_label?: string;
    button_color?: string;
    member_count?: number;
    thread_count?: number;
    last_activity?: string | null;
    created_by: string | null;
    created_at: string;
}

export async function fetchForumsWithStats(): Promise<Forum[]> {
    const { data, error } = await supabase
        .from('forums_with_stats')
        .select('*')
        .order('is_system', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('member_count', { ascending: false });
    if (error) { console.warn('[forum] withStats:', error); return []; }
    return (data || []) as Forum[];
}

export async function fetchForumBySlug(slug: string): Promise<Forum | null> {
    const { data } = await supabase.from('forums_with_stats').select('*').eq('slug', slug).maybeSingle();
    return (data as Forum | null) || null;
}

export interface ForumMember {
    id: string;
    username: string;
    pfp: string;
    role: string;
    joined_at: string;
}

export async function fetchForumMembers(forumId: string, limit = 50): Promise<ForumMember[]> {
    const { data, error } = await supabase.rpc('forum_members', { p_forum_id: forumId, p_limit: limit });
    if (error) { console.warn('[forum] members:', error); return []; }
    return ((data || []) as any[]).map(r => ({
        id: r.id, username: r.username, pfp: r.pfp || '', role: r.role, joined_at: r.joined_at,
    }));
}

export async function updateForum(id: string, patch: Partial<Pick<Forum, 'name' | 'description' | 'icon' | 'rules' | 'color'>>): Promise<boolean> {
    const { error } = await supabase.from('forums').update(patch).eq('id', id);
    if (error) console.error('[forum] updateForum:', error);
    return !error;
}

export async function fetchForums(): Promise<Forum[]> {
    const { data, error } = await supabase
        .from('forums')
        .select('*')
        .order('is_system', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) {
        console.warn('[forum] fetchForums:', error);
        return [];
    }
    return (data || []) as Forum[];
}

export async function createForum(name: string, description: string, icon: string): Promise<{ ok: boolean; reason?: string; forum?: Forum }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { ok: false, reason: 'Necesitas iniciar sesión.' };
    const slug = name.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        .slice(0, 32);
    if (!slug) return { ok: false, reason: 'Nombre inválido.' };
    const { data, error } = await supabase.from('forums').insert({
        slug,
        name: name.trim(),
        description: description.trim(),
        icon: icon || 'fa-comments',
        is_system: false,
        sort_order: 1000,
        created_by: session.user.id,
    }).select().single();
    if (error) {
        return { ok: false, reason: error.message };
    }
    return { ok: true, forum: data as Forum };
}

export async function deleteForum(id: string): Promise<boolean> {
    const { error } = await supabase.from('forums').delete().eq('id', id);
    if (error) { console.error('[forum] deleteForum:', error); return false; }
    return true;
}

export interface Comment {
    id: string;
    thread_id: string;
    author_id: string;
    content: string;
    created_at: string;
    parent_id: string | null;
    author: Profile | null;
}

const PROFILE_SELECT = 'author:profiles!threads_author_id_fkey(id, username, pfp, role, account_type, business_category, verified)';
const COMMENT_PROFILE_SELECT = 'author:profiles!comments_author_id_fkey(id, username, pfp, role, account_type, business_category, verified)';

export async function fetchThreads(opts: { forumId?: string | null; authorIds?: string[]; limit?: number } = {}): Promise<Thread[]> {
    const limit = opts.limit ?? 50;
    let q = supabase
        .from('threads')
        .select(`*, ${PROFILE_SELECT}`)
        .order('pinned_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit);
    if (opts.forumId) q = q.eq('forum_id', opts.forumId);
    if (opts.authorIds && opts.authorIds.length > 0) {
        q = q.in('author_id', opts.authorIds);
    } else if (opts.authorIds && opts.authorIds.length === 0) {
        // El usuario pidió filtro "siguiendo" pero no sigue a nadie → resultado vacío
        return [];
    }
    const { data: rows, error } = await q;
    if (error) { console.error('[forum] fetchThreads:', error); return []; }
    if (!rows?.length) return [];

    const ids = rows.map(r => r.id);
    const { data: { user } } = await supabase.auth.getUser();

    const [likesRes, commentsRes, myLikesRes] = await Promise.all([
        supabase.from('likes').select('target_id', { count: 'exact' })
            .eq('target_type', 'thread').in('target_id', ids),
        supabase.from('comments').select('thread_id').in('thread_id', ids),
        user
            ? supabase.from('likes').select('target_id')
                .eq('target_type', 'thread').eq('user_id', user.id).in('target_id', ids)
            : Promise.resolve({ data: [] as Array<{ target_id: string }> }),
    ]);

    const likeCounts: Record<string, number> = {};
    (likesRes.data || []).forEach(l => {
        likeCounts[l.target_id] = (likeCounts[l.target_id] || 0) + 1;
    });

    const commentCounts: Record<string, number> = {};
    (commentsRes.data || []).forEach(c => {
        commentCounts[c.thread_id] = (commentCounts[c.thread_id] || 0) + 1;
    });

    const myLikes = new Set((myLikesRes.data || []).map((l: any) => l.target_id));

    return rows.map((r: any) => ({
        id: r.id,
        author_id: r.author_id,
        content: r.content,
        category: r.category,
        forum_id: r.forum_id,
        created_at: r.created_at,
        edited_at: r.edited_at || null,
        pinned_at: r.pinned_at || null,
        is_bot: !!r.is_bot,
        attachments: Array.isArray(r.attachments) ? r.attachments : [],
        author: r.author,
        likes_count: likeCounts[r.id] || 0,
        liked_by_me: myLikes.has(r.id),
        comments_count: commentCounts[r.id] || 0,
    }));
}

export async function fetchThreadById(id: string): Promise<Thread | null> {
    const { data, error } = await supabase
        .from('threads')
        .select(`*, ${PROFILE_SELECT}`)
        .eq('id', id)
        .maybeSingle();
    if (error || !data) return null;
    return {
        id: data.id,
        author_id: data.author_id,
        content: data.content,
        category: data.category,
        created_at: data.created_at,
        is_bot: !!data.is_bot,
        author: (data as any).author,
        likes_count: 0,
        liked_by_me: false,
        comments_count: 0,
    };
}

export async function insertThread(
    content: string,
    category = 'general',
    forumId?: string | null,
    attachments: ThreadAttachment[] = [],
): Promise<{ ok: boolean; reason?: string; id?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { ok: false, reason: 'Necesitas iniciar sesión.' };
    const id = crypto.randomUUID();
    const { error } = await supabase.from('threads').insert({
        id,
        author_id: session.user.id,
        content,
        category,
        forum_id: forumId ?? null,
        attachments,
        is_shared: false,
        notify_followers: false,
        is_bot: false,
        is_rich: false,
    });
    if (error) {
        console.error('[forum] insertThread:', error);
        return { ok: false, reason: error.message };
    }
    return { ok: true, id };
}

export async function deleteThread(id: string): Promise<boolean> {
    const { error } = await supabase.from('threads').delete().eq('id', id);
    if (error) console.error('[forum] deleteThread:', error);
    return !error;
}

export async function fetchComments(threadId: string): Promise<Comment[]> {
    const { data, error } = await supabase
        .from('comments')
        .select(`*, ${COMMENT_PROFILE_SELECT}`)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
    if (error) { console.error('[forum] fetchComments:', error); return []; }
    return (data || []) as unknown as Comment[];
}

export async function insertComment(threadId: string, content: string, parentId: string | null = null): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;
    const { error } = await supabase.from('comments').insert({
        id: crypto.randomUUID(),
        thread_id: threadId,
        author_id: session.user.id,
        content,
        parent_id: parentId,
    });
    if (error) console.error('[forum] insertComment:', error);
    return !error;
}

export async function deleteComment(id: string): Promise<boolean> {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) console.error('[forum] deleteComment:', error);
    return !error;
}

export async function toggleLike(threadId: string): Promise<boolean | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const userId = session.user.id;
    const { data: existing } = await supabase.from('likes')
        .select('user_id')
        .eq('user_id', userId).eq('target_type', 'thread').eq('target_id', threadId)
        .maybeSingle();
    if (existing) {
        await supabase.from('likes').delete()
            .eq('user_id', userId).eq('target_type', 'thread').eq('target_id', threadId);
        return false;
    }
    await supabase.from('likes').insert({ user_id: userId, target_type: 'thread', target_id: threadId });
    return true;
}

export function timeAgo(iso: string): string {
    const d = new Date(iso).getTime();
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 60) return 'hace unos segundos';
    const m = Math.floor(s / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h} h`;
    const days = Math.floor(h / 24);
    if (days < 30) return `hace ${days} d`;
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}
