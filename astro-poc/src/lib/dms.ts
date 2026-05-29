import { supabase } from './supabase';
import type { Profile } from './forum';

export interface DmThread {
    id: string;
    user_a: string;
    user_b: string;
    last_message_at: string;
    created_at: string;
    other: Profile | null;
    unread_count: number;
    last_message: string | null;
}

export interface DmAttachment {
    url: string;
    type: 'image' | 'voice' | 'file';
    name: string;
    size: number;
    duration_seconds?: number;
}

export interface DmMessage {
    id: string;
    dm_thread_id: string;
    sender_id: string;
    content: string;
    attachments: DmAttachment[];
    parent_id: string | null;
    parent?: DmMessage | null;
    message_type: 'text' | 'image' | 'voice' | 'system';
    edited_at: string | null;
    deleted_at: string | null;
    pinned_at?: string | null;
    expires_at?: string | null;
    forwarded_from?: string | null;
    read_at: string | null;
    created_at: string;
}

export interface DmReaction {
    message_id: string;
    user_id: string;
    emoji: string;
    created_at: string;
}

export async function getOrCreateDmWith(otherUserId: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_or_create_dm_thread', { other_user_id: otherUserId });
    if (error) { console.error('[dm] getOrCreate:', error); return null; }
    return data as string;
}

export async function fetchMyDmThreads(): Promise<DmThread[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: threads } = await supabase
        .from('dm_threads')
        .select('*')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order('last_message_at', { ascending: false })
        .limit(50);
    if (!threads || threads.length === 0) return [];

    const otherIds = threads.map((t: any) => t.user_a === user.id ? t.user_b : t.user_a);
    const threadIds = threads.map((t: any) => t.id);

    const [profilesRes, lastMsgsRes, unreadRes] = await Promise.all([
        supabase.from('profiles').select('id, username, pfp, role').in('id', otherIds),
        supabase.from('dm_messages')
            .select('dm_thread_id, content, created_at')
            .in('dm_thread_id', threadIds)
            .order('created_at', { ascending: false }),
        supabase.from('dm_messages')
            .select('dm_thread_id')
            .in('dm_thread_id', threadIds)
            .is('read_at', null)
            .neq('sender_id', user.id),
    ]);

    const profileById: Record<string, any> = {};
    (profilesRes.data || []).forEach((p: any) => { profileById[p.id] = p; });

    const lastByThread: Record<string, string> = {};
    (lastMsgsRes.data || []).forEach((m: any) => {
        if (!lastByThread[m.dm_thread_id]) lastByThread[m.dm_thread_id] = m.content;
    });

    const unreadByThread: Record<string, number> = {};
    (unreadRes.data || []).forEach((m: any) => {
        unreadByThread[m.dm_thread_id] = (unreadByThread[m.dm_thread_id] || 0) + 1;
    });

    return threads.map((t: any) => {
        const otherId = t.user_a === user.id ? t.user_b : t.user_a;
        return {
            id: t.id,
            user_a: t.user_a,
            user_b: t.user_b,
            last_message_at: t.last_message_at,
            created_at: t.created_at,
            other: profileById[otherId] || null,
            unread_count: unreadByThread[t.id] || 0,
            last_message: lastByThread[t.id] || null,
        };
    });
}

export async function fetchMessages(threadId: string, limit = 100): Promise<DmMessage[]> {
    const { data } = await supabase
        .from('dm_messages')
        .select('*')
        .eq('dm_thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(limit);
    const msgs = (data || []) as DmMessage[];
    // Resolver parent_id → poblar parent inline para reply quotes
    const byId = new Map(msgs.map(m => [m.id, m]));
    return msgs.map(m => ({
        ...m,
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
        parent: m.parent_id ? byId.get(m.parent_id) ?? null : null,
    }));
}

export interface SendResult {
    ok: boolean;
    message?: DmMessage;
    error?: string;
    code?: string;
}

export async function sendDmMessageDetailed(
    threadId: string,
    content: string,
    options: { attachments?: DmAttachment[]; parentId?: string | null; messageType?: 'text' | 'image' | 'voice' } = {},
): Promise<SendResult> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'no_session' };
    const text = (content || '').trim();
    if (!text && (!options.attachments || options.attachments.length === 0)) {
        return { ok: false, error: 'empty' };
    }
    const { data, error } = await supabase.from('dm_messages').insert({
        dm_thread_id: threadId,
        sender_id: user.id,
        content: text,
        attachments: options.attachments || [],
        parent_id: options.parentId || null,
        message_type: options.messageType || (options.attachments?.length ? 'image' : 'text'),
    }).select().single();
    if (error) {
        console.error('[dm] send error:', error);
        return { ok: false, error: error.message, code: (error as any).code };
    }
    return { ok: true, message: data as DmMessage };
}

export async function sendDmMessage(
    threadId: string,
    content: string,
    options: { attachments?: DmAttachment[]; parentId?: string | null; messageType?: 'text' | 'image' | 'voice' } = {},
): Promise<DmMessage | null> {
    const r = await sendDmMessageDetailed(threadId, content, options);
    return r.ok ? (r.message ?? null) : null;
}

export async function editDmMessage(messageId: string, newContent: string): Promise<boolean> {
    const { error } = await supabase.from('dm_messages')
        .update({ content: newContent })
        .eq('id', messageId);
    if (error) { console.error('[dm] edit:', error); return false; }
    return true;
}

export async function deleteDmMessage(messageId: string): Promise<boolean> {
    // Soft delete: marca deleted_at + limpia contenido
    const { error } = await supabase.from('dm_messages')
        .update({ deleted_at: new Date().toISOString(), content: '', attachments: [] })
        .eq('id', messageId);
    if (error) { console.error('[dm] delete:', error); return false; }
    return true;
}

/* ───────── Reacciones a mensajes ───────── */

export async function fetchMessageReactions(messageIds: string[]): Promise<Record<string, DmReaction[]>> {
    if (messageIds.length === 0) return {};
    const { data } = await supabase.from('dm_message_reactions')
        .select('*').in('message_id', messageIds);
    const map: Record<string, DmReaction[]> = {};
    (data || []).forEach((r: any) => {
        (map[r.message_id] = map[r.message_id] || []).push(r);
    });
    return map;
}

export async function toggleDmReaction(messageId: string, emoji: string): Promise<'added' | 'removed' | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: existing } = await supabase.from('dm_message_reactions')
        .select('user_id').eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji)
        .maybeSingle();
    if (existing) {
        await supabase.from('dm_message_reactions').delete()
            .eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
        return 'removed';
    }
    await supabase.from('dm_message_reactions').insert({
        message_id: messageId, user_id: user.id, emoji,
    });
    return 'added';
}

/* ───────── Thread settings (mute) ───────── */

export async function isThreadMuted(threadId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from('dm_thread_settings')
        .select('muted').eq('user_id', user.id).eq('dm_thread_id', threadId).maybeSingle();
    return !!data?.muted;
}

export async function setThreadMuted(threadId: string, muted: boolean): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('dm_thread_settings')
        .upsert({ user_id: user.id, dm_thread_id: threadId, muted });
    return !error;
}

export interface DmThreadSettings {
    muted: boolean;
    accent_color: string;
    background_url: string;
    auto_delete_after_hours: number;
}

export async function fetchThreadSettings(threadId: string): Promise<DmThreadSettings> {
    const { data: { user } } = await supabase.auth.getUser();
    const empty: DmThreadSettings = { muted: false, accent_color: '', background_url: '', auto_delete_after_hours: 0 };
    if (!user) return empty;
    const { data } = await supabase.from('dm_thread_settings')
        .select('*').eq('user_id', user.id).eq('dm_thread_id', threadId).maybeSingle();
    if (!data) return empty;
    return {
        muted: !!data.muted,
        accent_color: data.accent_color || '',
        background_url: data.background_url || '',
        auto_delete_after_hours: data.auto_delete_after_hours || 0,
    };
}

export async function updateThreadSettings(threadId: string, patch: Partial<DmThreadSettings>): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('dm_thread_settings')
        .upsert({ user_id: user.id, dm_thread_id: threadId, ...patch });
    return !error;
}

/* ───── Pin / Unpin ───── */

export async function togglePinMessage(messageId: string, isPinned: boolean): Promise<boolean> {
    const { error } = await supabase.from('dm_messages')
        .update({ pinned_at: isPinned ? null : new Date().toISOString() })
        .eq('id', messageId);
    return !error;
}

export async function fetchPinnedMessages(threadId: string): Promise<DmMessage[]> {
    const { data } = await supabase
        .from('dm_messages')
        .select('*')
        .eq('dm_thread_id', threadId)
        .not('pinned_at', 'is', null)
        .order('pinned_at', { ascending: false })
        .limit(10);
    return (data || []) as DmMessage[];
}

/* ───── Forward message ───── */

export async function forwardMessage(messageId: string, toThreadId: string): Promise<DmMessage | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    // Obtener mensaje original
    const { data: orig } = await supabase.from('dm_messages').select('*').eq('id', messageId).maybeSingle();
    if (!orig) return null;
    const { data, error } = await supabase.from('dm_messages').insert({
        dm_thread_id: toThreadId,
        sender_id: user.id,
        content: orig.content || '',
        attachments: orig.attachments || [],
        forwarded_from: orig.id,
        message_type: orig.message_type || 'text',
    }).select().single();
    if (error) { console.error('[dm] forward:', error); return null; }
    return data as DmMessage;
}

/* ───── Disappearing messages (al enviar con expiración) ───── */

export async function sendDmMessageWithExpiry(
    threadId: string,
    content: string,
    expiresInHours: number,
    options: { attachments?: DmAttachment[]; parentId?: string | null } = {},
): Promise<DmMessage | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const expiresAt = expiresInHours > 0 ? new Date(Date.now() + expiresInHours * 3600_000).toISOString() : null;
    const { data, error } = await supabase.from('dm_messages').insert({
        dm_thread_id: threadId,
        sender_id: user.id,
        content,
        attachments: options.attachments || [],
        parent_id: options.parentId || null,
        expires_at: expiresAt,
        message_type: options.attachments?.length ? 'image' : 'text',
    }).select().single();
    if (error) return null;
    return data as DmMessage;
}

/* ───────── Upload imágenes/voice al bucket attachments ───────── */

export async function uploadDmFile(file: File, type: 'image' | 'voice' | 'file'): Promise<DmAttachment | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    if (file.size > 10 * 1024 * 1024) {
        console.warn('[dm] file too big');
        return null;
    }
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${user.id}/dm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('attachments').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
    });
    if (error) { console.error('[dm] upload:', error); return null; }
    const { data } = supabase.storage.from('attachments').getPublicUrl(path);
    return { url: data.publicUrl, type, name: file.name, size: file.size };
}

export async function markThreadRead(threadId: string): Promise<number> {
    const { data } = await supabase.rpc('mark_dm_thread_read', { p_thread_id: threadId });
    return typeof data === 'number' ? data : 0;
}
