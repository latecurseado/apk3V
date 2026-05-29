import { supabase } from './supabase';

export interface Collaborator {
    user_id: string;
    role: 'collaborator' | 'contributor' | 'featured';
    username: string | null;
    pfp: string | null;
}

export async function fetchCollaborators(threadId: string): Promise<Collaborator[]> {
    const { data, error } = await supabase
        .from('thread_collaborators')
        .select('user_id, role, profile:profiles!thread_collaborators_user_id_fkey(username, pfp)')
        .eq('thread_id', threadId);
    if (error || !data) return [];
    return (data as any[]).map(r => ({
        user_id: r.user_id,
        role: r.role,
        username: r.profile?.username || null,
        pfp: r.profile?.pfp || null,
    }));
}

export async function addCollaborator(threadId: string, userId: string, role: 'collaborator' | 'contributor' | 'featured' = 'collaborator'): Promise<boolean> {
    const { error } = await supabase.from('thread_collaborators').insert({
        thread_id: threadId,
        user_id: userId,
        role,
    });
    if (error) console.error('[collab] add:', error);
    return !error;
}

export async function removeCollaborator(threadId: string, userId: string): Promise<boolean> {
    const { error } = await supabase.from('thread_collaborators')
        .delete()
        .eq('thread_id', threadId)
        .eq('user_id', userId);
    return !error;
}
