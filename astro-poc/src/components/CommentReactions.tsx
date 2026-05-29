import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '🙏'];

interface ReactionCount {
    emoji: string;
    count: number;
    mine: boolean;
}

interface Props {
    commentId: string;
}

export default function CommentReactions({ commentId }: Props) {
    const { user } = useSession();
    const [reactions, setReactions] = useState<ReactionCount[]>([]);
    const [showPicker, setShowPicker] = useState(false);

    const load = async () => {
        const { data } = await supabase
            .from('comment_reactions')
            .select('emoji, user_id')
            .eq('comment_id', commentId);
        const counts = new Map<string, { count: number; mine: boolean }>();
        for (const r of (data || []) as any[]) {
            const cur = counts.get(r.emoji) || { count: 0, mine: false };
            cur.count++;
            if (r.user_id === user?.id) cur.mine = true;
            counts.set(r.emoji, cur);
        }
        setReactions(Array.from(counts.entries()).map(([emoji, c]) => ({ emoji, ...c })));
    };

    useEffect(() => { load(); }, [commentId, user?.id]);

    const toggle = async (emoji: string) => {
        if (!user) return;
        const existing = reactions.find(r => r.emoji === emoji && r.mine);
        if (existing) {
            await supabase.from('comment_reactions')
                .delete()
                .eq('user_id', user.id).eq('comment_id', commentId).eq('emoji', emoji);
        } else {
            await supabase.from('comment_reactions').insert({
                user_id: user.id, comment_id: commentId, emoji,
            });
        }
        setShowPicker(false);
        load();
    };

    return (
        <div class="comment-reactions">
            {reactions.map(r => (
                <button
                    key={r.emoji}
                    class={`comment-rx-pill ${r.mine ? 'mine' : ''}`}
                    onClick={() => toggle(r.emoji)}
                    title={r.mine ? 'Quitar reacción' : 'Añadir reacción'}
                >
                    <span>{r.emoji}</span>
                    <small>{r.count}</small>
                </button>
            ))}
            {user && (
                <div class="comment-rx-add-wrap">
                    <button class="comment-rx-add" onClick={() => setShowPicker(s => !s)} title="Reaccionar">
                        <i class="far fa-face-smile"></i>
                    </button>
                    {showPicker && (
                        <div class="comment-rx-picker">
                            {QUICK_EMOJIS.map(e => (
                                <button key={e} onClick={() => toggle(e)}>{e}</button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
