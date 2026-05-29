import { supabase } from './supabase';
import type { Profile, Forum } from './forum';

/* ───── Subscriptions ───── */

export async function fetchMySubscribedForumIds(userId: string): Promise<Set<string>> {
    const { data } = await supabase.from('forum_subscriptions').select('forum_id').eq('user_id', userId);
    return new Set((data || []).map((r: any) => r.forum_id));
}

export async function toggleSubscription(forumId: string): Promise<boolean | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const userId = session.user.id;
    const { data: existing } = await supabase.from('forum_subscriptions')
        .select('forum_id').eq('forum_id', forumId).eq('user_id', userId).maybeSingle();
    if (existing) {
        await supabase.from('forum_subscriptions').delete()
            .eq('forum_id', forumId).eq('user_id', userId);
        return false;
    }
    await supabase.from('forum_subscriptions').insert({ forum_id: forumId, user_id: userId });
    return true;
}

/* ───── Mods ───── */

export async function fetchMods(forumId: string): Promise<Profile[]> {
    const { data, error } = await supabase.from('forum_mods')
        .select('user_id, profile:profiles!forum_mods_user_id_fkey(id, username, pfp, role)')
        .eq('forum_id', forumId);
    if (error) return [];
    return ((data || []) as any[]).map(r => r.profile).filter(Boolean);
}

export async function addMod(forumId: string, userId: string): Promise<boolean> {
    const { error } = await supabase.from('forum_mods').insert({ forum_id: forumId, user_id: userId });
    if (error) console.error('[mod] add:', error);
    return !error;
}

export async function removeMod(forumId: string, userId: string): Promise<boolean> {
    const { error } = await supabase.from('forum_mods').delete()
        .eq('forum_id', forumId).eq('user_id', userId);
    if (error) console.error('[mod] remove:', error);
    return !error;
}

/* ───── Invites (foros invite-only) ───── */

export async function inviteUser(forumId: string, userId: string): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('forum_invites').insert({
        forum_id: forumId, user_id: userId, invited_by: session?.user?.id ?? null,
    });
    if (error) console.error('[invite]:', error);
    return !error;
}

export async function amIInvited(forumId: string, userId: string): Promise<boolean> {
    const { data } = await supabase.from('forum_invites')
        .select('user_id').eq('forum_id', forumId).eq('user_id', userId).maybeSingle();
    return !!data;
}

/* ───── Cross-post (repost) ───── */

/**
 * Limpia HTML/markdown del contenido para reposts.
 * - Quita tags HTML (div, p, br, etc.)
 * - Decodifica entidades (&nbsp;, &amp;, &lt;, &gt;)
 * - Colapsa whitespace múltiple
 * - Trunca a 600 chars
 */
export function cleanForRepost(raw: string): string {
    let text = raw
        // Quitar tags HTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        // Decodificar entidades comunes
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Colapsar whitespace
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (text.length > 600) text = text.slice(0, 600) + '…';
    return text;
}

export async function repostThread(
    originalContent: string,
    originalAuthor: string,
    targetForumId: string,
    extraComment: string = '',
): Promise<{ ok: boolean; reason?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { ok: false, reason: 'Necesitas sesión' };

    const cleaned = cleanForRepost(originalContent);
    const userComment = extraComment.trim();

    // Formato: comentario opcional del repostador + bloque de cita visible
    // El parser de rich-text detecta el bloque "> @autor: ..." como blockquote
    const quoteBlock = `> **@${originalAuthor}** escribió:\n> ${cleaned.split('\n').join('\n> ')}`;
    const content = userComment ? `${userComment}\n\n${quoteBlock}` : quoteBlock;

    const { error } = await supabase.from('threads').insert({
        id: crypto.randomUUID(),
        author_id: session.user.id,
        content,
        category: 'repost',
        forum_id: targetForumId,
        attachments: [],
        is_shared: true,
        is_bot: false,
        is_rich: true,
    });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
}

/* ───── Forum can-edit check (owner, admin, or mod) ───── */

export async function canManageForum(forum: Forum, currentUserId: string | null, isAdmin: boolean): Promise<boolean> {
    if (!currentUserId) return false;
    if (isAdmin) return true;
    if (forum.created_by === currentUserId) return true;
    const { data } = await supabase.from('forum_mods')
        .select('user_id').eq('forum_id', forum.id).eq('user_id', currentUserId).maybeSingle();
    return !!data;
}
