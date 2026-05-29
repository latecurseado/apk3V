import { useEffect, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface Streak {
    current_streak: number;
    longest_streak: number;
}

const KEY = 'tv-streak-ticked-today';

/**
 * Widget de racha diaria. Llama tick_streak() una vez por día
 * y muestra current/longest.
 */
export default function StreakWidget() {
    const { user, ready } = useSession();
    const [streak, setStreak] = useState<Streak | null>(null);

    useEffect(() => {
        if (!ready || !user) return;
        let alive = true;
        (async () => {
            const today = new Date().toISOString().slice(0, 10);
            const last = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();

            if (last !== today) {
                const { data } = await supabase.rpc('tick_streak');
                if (alive && data && data[0]) {
                    setStreak(data[0]);
                    try { localStorage.setItem(KEY, today); } catch { /* */ }
                    return;
                }
            }
            // Lee el valor actual sin actualizar
            const { data } = await supabase
                .from('user_streaks')
                .select('current_streak, longest_streak')
                .eq('user_id', user.id)
                .maybeSingle();
            if (alive && data) setStreak(data as Streak);
        })();
        return () => { alive = false; };
    }, [user?.id, ready]);

    if (!user || !streak || streak.current_streak === 0) return null;

    const isLongest = streak.current_streak >= streak.longest_streak;

    return (
        <a class="streak-widget" href="/perfil" title={`Racha actual: ${streak.current_streak} días · récord: ${streak.longest_streak}`}>
            <span class="streak-flame">
                <i class="fas fa-fire"></i>
            </span>
            <div class="streak-body">
                <strong>{streak.current_streak}</strong>
                <small>{streak.current_streak === 1 ? 'día' : 'días'} seguidos</small>
            </div>
            {isLongest && streak.current_streak > 1 && (
                <span class="streak-trophy" title="¡Tu récord personal!">
                    <i class="fas fa-trophy"></i>
                </span>
            )}
        </a>
    );
}
