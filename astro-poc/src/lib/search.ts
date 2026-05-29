import { supabase } from './supabase';
import type { Profile, Thread, Forum } from './forum';

export interface SearchResults {
    threads: Thread[];
    profiles: Profile[];
    forums: Forum[];
    total: number;
}

const EMPTY: SearchResults = { threads: [], profiles: [], forums: [], total: 0 };

export async function search(q: string, opts: { limit?: number } = {}): Promise<SearchResults> {
    const term = q.trim();
    if (term.length < 1) return EMPTY;
    const limit = opts.limit ?? 8;

    // FTS si término >= 3 chars; fallback ilike para queries cortas
    const useFts = term.length >= 3 && !/[%_]/.test(term);
    const threadsQuery = useFts
        ? supabase.rpc('search_threads_fts', { p_query: term, p_limit: limit })
              .then(async ({ data }: any) => {
                  if (!data || data.length === 0) return { data: [] };
                  const ids = data.map((r: any) => r.id);
                  return await supabase
                      .from('threads')
                      .select('*, author:profiles!threads_author_id_fkey(id, username, pfp, role, account_type, business_category, verified)')
                      .in('id', ids);
              })
        : supabase
              .from('threads')
              .select('*, author:profiles!threads_author_id_fkey(id, username, pfp, role, account_type, business_category, verified)')
              .ilike('content', `%${term}%`)
              .order('created_at', { ascending: false })
              .limit(limit);

    const [threadsRes, profilesRes, forumsRes] = await Promise.all([
        threadsQuery,
        supabase
            .from('profiles')
            .select('id, username, pfp, role')
            .ilike('username', `%${term}%`)
            .order('username', { ascending: true })
            .limit(limit),
        supabase
            .from('forums')
            .select('*')
            .or(`name.ilike.%${term}%,slug.ilike.%${term}%,description.ilike.%${term}%`)
            .order('is_system', { ascending: false })
            .order('sort_order', { ascending: true })
            .limit(limit),
    ]);

    const threads = ((threadsRes.data || []) as any[]).map(r => ({
        id: r.id, author_id: r.author_id, content: r.content,
        category: r.category, forum_id: r.forum_id, created_at: r.created_at,
        is_bot: !!r.is_bot, author: r.author,
        likes_count: 0, liked_by_me: false, comments_count: 0,
    })) as Thread[];

    const profiles = (profilesRes.data || []) as Profile[];
    const forums = (forumsRes.data || []) as Forum[];

    return {
        threads,
        profiles,
        forums,
        total: threads.length + profiles.length + forums.length,
    };
}

/**
 * Resalta el término buscado dentro de un texto.
 * Devuelve HTML seguro (escapado) con <mark> alrededor de las coincidencias.
 */
export function highlight(text: string, q: string): string {
    const term = q.trim();
    if (!term) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const re = new RegExp(`(${escapeRegex(term)})`, 'gi');
    return escaped.replace(re, '<mark>$1</mark>');
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]!);
}
function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
