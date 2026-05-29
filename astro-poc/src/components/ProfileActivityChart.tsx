import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';

interface MonthRow {
    month: string;
    thread_count: number;
    comment_count: number;
}

interface Props {
    userId: string;
}

const MONTH_LABELS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatMonth(yyyymm: string): string {
    const [y, m] = yyyymm.split('-');
    const idx = parseInt(m, 10) - 1;
    if (idx < 0 || idx > 11) return yyyymm;
    return `${MONTH_LABELS_ES[idx]} '${y.slice(2)}`;
}

/**
 * Gráfico de barras (sin libs externas) de actividad por mes.
 * 12 meses: hilos publicados + comentarios.
 */
export default function ProfileActivityChart({ userId }: Props) {
    const [rows, setRows] = useState<MonthRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            const { data } = await supabase.rpc('user_monthly_activity', { p_user_id: userId });
            if (!alive) return;
            setRows((data || []) as MonthRow[]);
            setLoading(false);
        })();
        return () => { alive = false; };
    }, [userId]);

    if (loading) {
        return (
            <section class="activity-chart">
                <h3><i class="fas fa-chart-column"></i> Actividad del año</h3>
                <div class="skel sk-line"></div>
                <div class="skel sk-line"></div>
            </section>
        );
    }

    const maxValue = Math.max(1, ...rows.map(r => r.thread_count + r.comment_count));
    const totalThreads = rows.reduce((sum, r) => sum + r.thread_count, 0);
    const totalComments = rows.reduce((sum, r) => sum + r.comment_count, 0);

    return (
        <section class="activity-chart">
            <header class="activity-chart-head">
                <h3><i class="fas fa-chart-column"></i> Actividad del año</h3>
                <div class="activity-legend">
                    <span><span class="activity-dot threads"></span> Hilos · {totalThreads}</span>
                    <span><span class="activity-dot comments"></span> Comentarios · {totalComments}</span>
                </div>
            </header>
            <div class="activity-bars">
                {rows.map(r => {
                    const total = r.thread_count + r.comment_count;
                    const heightPct = total === 0 ? 0 : Math.max((total / maxValue) * 100, 5);
                    const threadPct = total === 0 ? 0 : (r.thread_count / total) * 100;
                    return (
                        <div key={r.month} class="activity-month" title={`${formatMonth(r.month)}: ${r.thread_count} hilos · ${r.comment_count} comentarios`}>
                            <div class="activity-bar" style={`height: ${heightPct}%`}>
                                <div class="activity-bar-threads" style={`height: ${threadPct}%`}></div>
                            </div>
                            <small>{formatMonth(r.month).split(' ')[0]}</small>
                        </div>
                    );
                })}
            </div>
            {totalThreads + totalComments === 0 && (
                <p class="activity-empty">
                    <i class="far fa-clock"></i> Sin actividad en los últimos 12 meses.
                </p>
            )}
        </section>
    );
}
