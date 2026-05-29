import { supabase } from './supabase';
import type { Profile } from './forum';

export async function searchProfiles(q: string, limit = 12): Promise<Profile[]> {
    const term = q.trim();
    if (term.length < 1) return [];
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, pfp, role')
        .ilike('username', `%${term}%`)
        .order('username', { ascending: true })
        .limit(limit);
    if (error) { console.warn('[friends] searchProfiles:', error); return []; }
    return (data || []) as Profile[];
}

export async function fetchFollowing(userId: string): Promise<Profile[]> {
    const { data, error } = await supabase
        .from('follows')
        .select('followed_id, profile:profiles!follows_followed_id_fkey(id, username, pfp, role)')
        .eq('follower_id', userId)
        .order('created_at', { ascending: false });
    if (error) { console.warn('[friends] fetchFollowing:', error); return []; }
    return ((data || []) as any[]).map(r => r.profile).filter(Boolean);
}

export async function fetchFollowers(userId: string): Promise<Profile[]> {
    const { data, error } = await supabase
        .from('follows')
        .select('follower_id, profile:profiles!follows_follower_id_fkey(id, username, pfp, role)')
        .eq('followed_id', userId);
    if (error) { console.warn('[friends] fetchFollowers:', error); return []; }
    return ((data || []) as any[]).map(r => r.profile).filter(Boolean);
}

export async function isFollowing(followerId: string, followedId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', followerId)
        .eq('followed_id', followedId)
        .maybeSingle();
    if (error) return false;
    return !!data;
}

export async function follow(followedId: string): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;
    if (session.user.id === followedId) return false;
    const { error } = await supabase.from('follows').insert({
        follower_id: session.user.id,
        followed_id: followedId,
    });
    if (error && !/duplicate/i.test(error.message)) {
        console.warn('[friends] follow:', error);
        return false;
    }
    return true;
}

/**
 * Sugerencias inteligentes basadas en friends-of-friends.
 * Devuelve users con count de amigos en común.
 */
export async function fetchSuggestedUsers(limit = 8): Promise<Array<Profile & { mutuals_count: number }>> {
    const { data, error } = await supabase.rpc('suggested_users', { p_limit: limit });
    if (error) { console.warn('[friends] suggested:', error); return []; }
    return ((data || []) as any[]).map(r => ({
        id: r.id, username: r.username, pfp: r.pfp || null, role: null,
        mutuals_count: Number(r.mutuals_count) || 0,
    }));
}

export async function fetchMutualFriendsWith(otherId: string): Promise<Profile[]> {
    const { data, error } = await supabase.rpc('mutual_friends_with', { p_other: otherId });
    if (error) { console.warn('[friends] mutuals:', error); return []; }
    return ((data || []) as any[]).map(r => ({
        id: r.id, username: r.username, pfp: r.pfp || null, role: null,
    }));
}

/**
 * Mis amigos = follows mutuos (yo sigo a X y X me sigue).
 */
export async function fetchMyMutualFollows(): Promise<Profile[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
        .from('mutual_follows')
        .select('u1, u2')
        .or(`u1.eq.${user.id},u2.eq.${user.id}`);
    if (!data) return [];
    const otherIds = data.map((r: any) => r.u1 === user.id ? r.u2 : r.u1);
    if (otherIds.length === 0) return [];
    const { data: profs } = await supabase
        .from('profiles').select('id, username, pfp, role').in('id', otherIds);
    return (profs || []) as Profile[];
}

export async function unfollow(followedId: string): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;
    const { error } = await supabase.from('follows')
        .delete()
        .eq('follower_id', session.user.id)
        .eq('followed_id', followedId);
    if (error) { console.warn('[friends] unfollow:', error); return false; }
    return true;
}
