import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';

const POLL_MS = 20000;

export default function VisitCounter() {
    const [count, setCount] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pulse, setPulse] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let lastCount: number | null = null;

        const tick = async (initial: boolean) => {
            try {
                const counted = sessionStorage.getItem('tv_visit_counted') === '1';
                // Solo bumpea la primera vez en la sesión; las siguientes solo leen.
                const fn = (initial && !counted) ? 'bump_site_views' : 'get_site_views';
                const { data, error } = await supabase.rpc(fn);
                if (cancelled) return;
                if (error) throw error;
                if (initial && !counted) {
                    try { sessionStorage.setItem('tv_visit_counted', '1'); } catch { /* */ }
                }
                const n = typeof data === 'number' ? data : null;
                setCount(n);
                if (n !== null && lastCount !== null && n !== lastCount) {
                    setPulse(true);
                    setTimeout(() => setPulse(false), 800);
                }
                lastCount = n;
                setError(null);
            } catch (e) {
                if (!cancelled) {
                    const msg = e instanceof Error ? e.message : String(e);
                    console.error('[VisitCounter]', msg);
                    setError(msg);
                }
            }
        };

        tick(true);
        const id = setInterval(() => tick(false), POLL_MS);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    const display = error
        ? '—'
        : count === null
            ? '…'
            : count.toLocaleString('es-MX');

    return (
        <span class={`visit-counter ${pulse ? 'pulse' : ''}`} title={error ?? 'Total de visitas registradas · actualiza cada 20s'}>
            <i class="fas fa-eye vc-icon" aria-hidden="true"></i>
            <span class="vc-num">{display}</span>
            <span class="vc-label">visitas</span>
        </span>
    );
}
