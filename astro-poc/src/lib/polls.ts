import { supabase } from './supabase';

export interface PollOption { id: string; text: string; sort_order: number; votes: number; mine: boolean; }
export interface Poll {
    id: string;
    thread_id: string;
    question: string;
    allow_multiple: boolean;
    ends_at: string | null;
    options: PollOption[];
    total_votes: number;
}

export async function fetchPollForThread(threadId: string, currentUserId: string | null): Promise<Poll | null> {
    const { data: poll } = await supabase.from('polls').select('*').eq('thread_id', threadId).maybeSingle();
    if (!poll) return null;
    const [optsRes, votesRes] = await Promise.all([
        supabase.from('poll_options').select('*').eq('poll_id', poll.id).order('sort_order'),
        supabase.from('poll_votes').select('option_id, user_id').eq('poll_id', poll.id),
    ]);
    const opts = (optsRes.data || []) as any[];
    const votes = (votesRes.data || []) as any[];
    const voteCounts: Record<string, number> = {};
    const myVotes = new Set<string>();
    votes.forEach(v => {
        voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1;
        if (v.user_id === currentUserId) myVotes.add(v.option_id);
    });
    return {
        id: poll.id, thread_id: poll.thread_id, question: poll.question,
        allow_multiple: poll.allow_multiple, ends_at: poll.ends_at,
        options: opts.map(o => ({ id: o.id, text: o.text, sort_order: o.sort_order,
            votes: voteCounts[o.id] || 0, mine: myVotes.has(o.id) })),
        total_votes: votes.length,
    };
}

export async function createPoll(threadId: string, question: string, options: string[], allowMultiple = false): Promise<boolean> {
    const { data: poll, error: e1 } = await supabase.from('polls')
        .insert({ thread_id: threadId, question, allow_multiple: allowMultiple })
        .select().single();
    if (e1 || !poll) { console.error('[polls] create:', e1); return false; }
    const rows = options.filter(o => o.trim()).map((text, i) => ({ poll_id: poll.id, text: text.trim(), sort_order: i }));
    const { error: e2 } = await supabase.from('poll_options').insert(rows);
    if (e2) { console.error('[polls] options:', e2); return false; }
    return true;
}

export async function voteOnPoll(pollId: string, optionId: string, allowMultiple: boolean): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;
    const userId = session.user.id;
    if (!allowMultiple) {
        // Borrar votos previos de este user en este poll
        await supabase.from('poll_votes').delete()
            .eq('poll_id', pollId).eq('user_id', userId);
    } else {
        // Si ya votó por esta opción, retirar el voto
        const { data: existing } = await supabase.from('poll_votes').select('user_id')
            .eq('poll_id', pollId).eq('option_id', optionId).eq('user_id', userId).maybeSingle();
        if (existing) {
            await supabase.from('poll_votes').delete()
                .eq('poll_id', pollId).eq('option_id', optionId).eq('user_id', userId);
            return true;
        }
    }
    const { error } = await supabase.from('poll_votes').insert({
        poll_id: pollId, option_id: optionId, user_id: userId,
    });
    if (error) console.error('[polls] vote:', error);
    return !error;
}
