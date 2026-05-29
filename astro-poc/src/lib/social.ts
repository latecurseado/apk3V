import { supabase } from './supabase';

/* ============ FRIEND REQUESTS ============ */

export interface FriendRequest {
    id: string;
    from_user_id: string;
    to_user_id: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
    responded_at: string | null;
    from_profile?: { username: string; pfp: string | null };
    to_profile?: { username: string; pfp: string | null };
}

export async function sendFriendRequest(targetUsername: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('send_friend_request', { p_target_username: targetUsername });
    if (error) { console.error('[fr] send:', error); return null; }
    return data as string;
}

export async function acceptFriendRequest(requestId: string): Promise<boolean> {
    const { error } = await supabase.rpc('accept_friend_request', { p_request_id: requestId });
    return !error;
}

export async function rejectFriendRequest(requestId: string): Promise<boolean> {
    const { error } = await supabase.rpc('reject_friend_request', { p_request_id: requestId });
    return !error;
}

export async function fetchPendingRequests(): Promise<FriendRequest[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
        .from('friend_requests')
        .select('*, from_profile:profiles!friend_requests_from_user_id_fkey(username, pfp), to_profile:profiles!friend_requests_to_user_id_fkey(username, pfp)')
        .eq('status', 'pending')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
    return ((data || []) as FriendRequest[]);
}

export async function checkFriendRequestStatus(otherUserId: string): Promise<{ requestId: string | null; direction: 'sent' | 'received' | null; status: string | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { requestId: null, direction: null, status: null };
    const { data } = await supabase
        .from('friend_requests')
        .select('id, from_user_id, to_user_id, status')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${user.id})`)
        .in('status', ['pending', 'accepted'])
        .maybeSingle();
    if (!data) return { requestId: null, direction: null, status: null };
    return {
        requestId: data.id,
        direction: data.from_user_id === user.id ? 'sent' : 'received',
        status: data.status,
    };
}

/* ============ BLOCK / MUTE ============ */

export async function blockUser(targetId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('blocks').insert({
        blocker_id: user.id, blocked_id: targetId,
    });
    return !error;
}

export async function unblockUser(targetId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('blocks').delete()
        .eq('blocker_id', user.id).eq('blocked_id', targetId);
    return !error;
}

export async function isBlocked(targetId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from('blocks')
        .select('blocker_id')
        .eq('blocker_id', user.id).eq('blocked_id', targetId)
        .maybeSingle();
    return !!data;
}

export async function muteUser(targetId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('mutes').insert({
        muter_id: user.id, muted_id: targetId,
    });
    return !error;
}

export async function unmuteUser(targetId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('mutes').delete()
        .eq('muter_id', user.id).eq('muted_id', targetId);
    return !error;
}

export async function isMuted(targetId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from('mutes')
        .select('muter_id')
        .eq('muter_id', user.id).eq('muted_id', targetId)
        .maybeSingle();
    return !!data;
}
