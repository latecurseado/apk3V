import { useEffect, useState } from 'preact/hooks';
import { fetchPollForThread, voteOnPoll, type Poll } from '../lib/polls';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

export default function PollDisplay({ threadId, currentUserId }: { threadId: string; currentUserId: string | null }) {
    const [poll, setPoll] = useState<Poll | null | undefined>(undefined); // undefined = cargando
    const [voting, setVoting] = useState(false);

    const refresh = async () => {
        const p = await fetchPollForThread(threadId, currentUserId);
        setPoll(p);
    };

    useEffect(() => { refresh(); }, [threadId, currentUserId]);

    useEffect(() => {
        const ch = supabase.channel(`poll-${threadId}`)
            .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'poll_votes' }, refresh)
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [threadId, currentUserId]);

    if (poll === undefined) return null; // todavía cargando, no mostrar nada
    if (poll === null) return null; // no hay encuesta en este hilo

    const hasVoted = poll.options.some(o => o.mine);
    const expired = poll.ends_at ? new Date(poll.ends_at) < new Date() : false;

    const vote = async (optId: string) => {
        if (!currentUserId) { toast.info('Inicia sesión para votar.'); return; }
        if (expired) { toast.info('Esta encuesta ya cerró.'); return; }
        setVoting(true);
        const ok = await voteOnPoll(poll.id, optId, poll.allow_multiple);
        if (ok) toast.success('Voto registrado'); else toast.error('Error al votar');
        await refresh();
        setVoting(false);
    };

    return (
        <div class="poll">
            <div class="poll-header">
                <i class="fas fa-square-poll-vertical"></i>
                <strong>{poll.question}</strong>
                {poll.allow_multiple && <span class="poll-tag">Múltiple</span>}
                {expired && <span class="poll-tag closed">Cerrada</span>}
            </div>
            <div class="poll-options">
                {poll.options.map(o => {
                    const pct = poll.total_votes > 0 ? (o.votes / poll.total_votes) * 100 : 0;
                    return (
                        <button
                            key={o.id}
                            class={`poll-opt ${o.mine ? 'voted' : ''}`}
                            onClick={() => vote(o.id)}
                            disabled={voting || expired}
                        >
                            <div class="poll-opt-bar" style={`width: ${pct}%;`}></div>
                            <span class="poll-opt-text">
                                {o.mine && <i class="fas fa-circle-check"></i>}
                                {o.text}
                            </span>
                            <span class="poll-opt-stats">
                                {o.votes} · {pct.toFixed(0)}%
                            </span>
                        </button>
                    );
                })}
            </div>
            <div class="poll-footer">
                {poll.total_votes} voto{poll.total_votes !== 1 ? 's' : ''}
                {!hasVoted && !expired && currentUserId && ' · click para votar'}
            </div>
        </div>
    );
}
