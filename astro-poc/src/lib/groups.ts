import { supabase } from './supabase';

export type GroupKind = 'group' | 'channel' | 'community';

export interface DmGroup {
    id: string;
    name: string;
    description: string;
    avatar_url: string;
    kind: GroupKind;
    parent_id?: string | null;   // canal → id de su comunidad
    created_by: string;
    is_public: boolean;
    last_message_at: string;
    created_at: string;
    member_count?: number;
}

export interface DmGroupMember {
    group_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member' | 'reader';
    joined_at: string;
    profile?: { username: string; pfp: string | null };
}

export interface DmGroupMessage {
    id: string;
    group_id: string;
    sender_id: string;
    content: string;
    attachments: any[];
    parent_id: string | null;
    edited_at: string | null;
    deleted_at: string | null;
    pinned_at: string | null;
    created_at: string;
    sender?: { username: string; pfp: string | null };
}

export async function createGroup(opts: {
    name: string;
    kind: GroupKind;
    is_public?: boolean;
    description?: string;
    avatar_url?: string;
}): Promise<string | null> {
    const { data, error } = await supabase.rpc('create_dm_group', {
        p_name: opts.name,
        p_kind: opts.kind,
        p_is_public: opts.is_public ?? false,
        p_description: opts.description ?? '',
        p_avatar_url: opts.avatar_url ?? '',
    });
    if (error) { console.error('[groups] create:', error); return null; }
    return data as string;
}

/** Crea una comunidad (espacio con varios canales) + su canal "General". */
export async function createCommunity(opts: {
    name: string; description?: string; avatar_url?: string; is_public?: boolean;
}): Promise<string | null> {
    const { data, error } = await supabase.rpc('create_community', {
        p_name: opts.name,
        p_description: opts.description ?? '',
        p_avatar_url: opts.avatar_url ?? '',
        p_is_public: opts.is_public ?? true,
    });
    if (error) { console.error('[communities] create:', error); return null; }
    return data as string;
}

/** Añade un canal a una comunidad (solo owner/admin). Devuelve el id del canal. */
export async function addChannelToCommunity(communityId: string, name: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('add_channel_to_community', {
        p_community_id: communityId,
        p_name: name,
    });
    if (error) { console.error('[communities] add channel:', error); return null; }
    return data as string;
}

/** Unirse a una comunidad pública (te añade a todos sus canales). */
export async function joinCommunity(communityId: string): Promise<boolean> {
    const { error } = await supabase.rpc('join_community', { p_community_id: communityId });
    if (error) console.error('[communities] join:', error);
    return !error;
}

export async function fetchMyGroups(): Promise<DmGroup[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
        .from('dm_group_members')
        .select('group:dm_groups(*)')
        .eq('user_id', user.id);
    if (error || !data) return [];
    return (data as any[])
        .map(r => r.group)
        .filter(Boolean)
        .sort((a: DmGroup, b: DmGroup) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
}

export async function addMember(groupId: string, userId: string, role: 'admin' | 'member' | 'reader' = 'member'): Promise<boolean> {
    const { error } = await supabase.from('dm_group_members').insert({
        group_id: groupId, user_id: userId, role,
    });
    if (error) console.error('[groups] add member:', error);
    return !error;
}

export async function fetchMembers(groupId: string): Promise<DmGroupMember[]> {
    const { data, error } = await supabase
        .from('dm_group_members')
        .select('*, profile:profiles!dm_group_members_user_id_fkey(username, pfp)')
        .eq('group_id', groupId);
    if (error) return [];
    return (data || []) as DmGroupMember[];
}

export async function fetchGroupMessages(groupId: string, limit = 50): Promise<DmGroupMessage[]> {
    const { data, error } = await supabase
        .from('dm_group_messages')
        .select('*, sender:profiles!dm_group_messages_sender_id_fkey(username, pfp)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) return [];
    return ((data || []) as DmGroupMessage[]).reverse();
}

export async function sendGroupMessage(groupId: string, content: string, attachments: any[] = []): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('dm_group_messages').insert({
        group_id: groupId,
        sender_id: user.id,
        content,
        attachments,
    });
    if (error) console.error('[groups] send:', error);
    return !error;
}

export function subscribeGroupMessages(groupId: string, onMessage: (m: DmGroupMessage) => void): () => void {
    const ch = supabase.channel(`dm-group:${groupId}`)
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'dm_group_messages', filter: `group_id=eq.${groupId}` },
            (payload) => onMessage(payload.new as DmGroupMessage),
        )
        .subscribe();
    return () => { ch.unsubscribe(); };
}
