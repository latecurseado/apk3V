import { supabase } from './supabase';

export type StoryMediaType = 'image' | 'video';

export interface Story {
    id: string;
    author_id: string;
    media_url: string;
    media_type: StoryMediaType;
    caption: string;
    created_at: string;
    expires_at: string;
    author?: { username: string; pfp: string | null };
}

/** Sube un archivo al bucket 'stories' y crea la fila en public.stories. */
export async function createStory(file: File, caption: string): Promise<Story | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const isVideo = file.type.startsWith('video/');
    if (file.size > 30 * 1024 * 1024) {
        throw new Error('Máximo 30 MB');
    }
    const ext = (file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
    const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('stories').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
    });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabase.storage.from('stories').getPublicUrl(path);

    const { data, error } = await supabase
        .from('stories')
        .insert({
            author_id: session.user.id,
            media_url: pub.publicUrl,
            media_type: isVideo ? 'video' : 'image',
            caption: caption.trim().slice(0, 200),
        })
        .select('*')
        .single();
    if (error) throw new Error(error.message);
    return data as Story;
}

/** Trae stories activas agrupadas por autor (uno por autor en la barra). */
export async function fetchActiveStories(): Promise<{ author: { id: string; username: string; pfp: string | null }; stories: Story[] }[]> {
    const { data, error } = await supabase
        .from('stories')
        .select('*, author:profiles!stories_author_id_fkey(id, username, pfp)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
    if (error || !data) return [];
    const byAuthor = new Map<string, { author: any; stories: Story[] }>();
    for (const row of data as any[]) {
        const k = row.author_id;
        if (!byAuthor.has(k)) {
            byAuthor.set(k, { author: row.author || { id: k, username: 'Anónimo', pfp: null }, stories: [] });
        }
        byAuthor.get(k)!.stories.push(row);
    }
    return Array.from(byAuthor.values());
}

/** Marca una story como vista. */
export async function markStoryViewed(storyId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('story_views').upsert(
        { story_id: storyId, viewer_id: user.id },
        { onConflict: 'story_id,viewer_id' },
    );
}

/** Borra una story propia. */
export async function deleteStory(storyId: string): Promise<boolean> {
    const { error } = await supabase.from('stories').delete().eq('id', storyId);
    return !error;
}

/** Cuántos vieron mi story. */
export async function countStoryViews(storyId: string): Promise<number> {
    const { count } = await supabase
        .from('story_views')
        .select('viewer_id', { count: 'exact', head: true })
        .eq('story_id', storyId);
    return count || 0;
}
