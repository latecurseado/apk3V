import { supabase } from './supabase';

/* ───────── BOOKMARKS ───────── */

export async function isBookmarked(userId: string, threadId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('bookmarks')
        .select('thread_id')
        .eq('user_id', userId)
        .eq('thread_id', threadId)
        .maybeSingle();
    if (error) return false;
    return !!data;
}

export async function toggleBookmark(threadId: string): Promise<boolean | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const userId = session.user.id;
    const has = await isBookmarked(userId, threadId);
    if (has) {
        await supabase.from('bookmarks').delete()
            .eq('user_id', userId).eq('thread_id', threadId);
        return false;
    }
    await supabase.from('bookmarks').insert({ user_id: userId, thread_id: threadId });
    return true;
}

export async function fetchBookmarkedIds(userId: string): Promise<Set<string>> {
    const { data } = await supabase.from('bookmarks').select('thread_id').eq('user_id', userId);
    return new Set((data || []).map((r: any) => r.thread_id));
}

/* ───────── REACTIONS ───────── */

export const REACTION_EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '😢'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

export interface ReactionSummary {
    emoji: string;
    count: number;
    mine: boolean;
}

export async function fetchReactionsForThreads(
    threadIds: string[],
    currentUserId: string | null,
): Promise<Record<string, ReactionSummary[]>> {
    if (threadIds.length === 0) return {};
    const { data, error } = await supabase
        .from('reactions')
        .select('thread_id, emoji, user_id')
        .in('thread_id', threadIds);
    if (error) { console.warn('[reactions] fetch:', error); return {}; }
    const map: Record<string, Record<string, { count: number; mine: boolean }>> = {};
    (data || []).forEach((r: any) => {
        const m = (map[r.thread_id] = map[r.thread_id] || {});
        const e = (m[r.emoji] = m[r.emoji] || { count: 0, mine: false });
        e.count++;
        if (r.user_id === currentUserId) e.mine = true;
    });
    const result: Record<string, ReactionSummary[]> = {};
    Object.entries(map).forEach(([tid, em]) => {
        result[tid] = Object.entries(em).map(([emoji, info]) => ({ emoji, ...info }));
    });
    return result;
}

export async function toggleReaction(threadId: string, emoji: string): Promise<'added' | 'removed' | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const userId = session.user.id;
    const { data: existing } = await supabase.from('reactions')
        .select('emoji')
        .eq('user_id', userId).eq('thread_id', threadId).eq('emoji', emoji)
        .maybeSingle();
    if (existing) {
        await supabase.from('reactions').delete()
            .eq('user_id', userId).eq('thread_id', threadId).eq('emoji', emoji);
        return 'removed';
    }
    await supabase.from('reactions').insert({ user_id: userId, thread_id: threadId, emoji });
    return 'added';
}

/* ───────── EDIT THREAD ───────── */

export async function updateThreadContent(threadId: string, content: string): Promise<boolean> {
    const { error } = await supabase.from('threads').update({ content }).eq('id', threadId);
    if (error) console.error('[threads] update:', error);
    return !error;
}

export async function updateCommentContent(commentId: string, content: string): Promise<boolean> {
    const { error } = await supabase.from('comments').update({ content }).eq('id', commentId);
    if (error) console.error('[comments] update:', error);
    return !error;
}

/* ───────── PIN THREAD (admin) ───────── */

export async function togglePin(threadId: string, isCurrentlyPinned: boolean): Promise<boolean> {
    const { error } = await supabase.from('threads')
        .update({ pinned_at: isCurrentlyPinned ? null : new Date().toISOString() })
        .eq('id', threadId);
    if (error) console.error('[threads] pin:', error);
    return !error;
}

/* ───────── WEB SHARE ───────── */

export async function shareThread(threadId: string, forumSlug: string, content: string): Promise<void> {
    const url = `${window.location.origin}/foro?f=${forumSlug}#hilo-${threadId}`;
    const title = 'Tres Valles · Foro';
    const text = content.slice(0, 140) + (content.length > 140 ? '…' : '');
    if (navigator.share) {
        try { await navigator.share({ title, text, url }); } catch { /* user cancelled */ }
    } else {
        await navigator.clipboard.writeText(url);
    }
}
