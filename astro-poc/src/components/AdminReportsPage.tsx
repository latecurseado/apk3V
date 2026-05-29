import { useEffect, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { fetchReports, updateReport, REASON_LABELS, type Report, type ReportStatus } from '../lib/reports';
import { toast } from '../lib/toast';
import { timeAgo } from '../lib/forum';

const STATUS_TABS: { id: ReportStatus | 'all'; label: string; icon: string }[] = [
    { id: 'pending',    label: 'Pendientes', icon: 'fa-hourglass-half' },
    { id: 'reviewing',  label: 'Revisando',  icon: 'fa-magnifying-glass' },
    { id: 'resolved',   label: 'Resueltos',  icon: 'fa-circle-check' },
    { id: 'dismissed',  label: 'Descartados', icon: 'fa-circle-xmark' },
    { id: 'all',        label: 'Todos',      icon: 'fa-globe' },
];

export default function AdminReportsPage() {
    const { user, ready } = useSession();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [status, setStatus] = useState<ReportStatus | 'all'>('pending');
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ready) return;
        if (!user) { setIsAdmin(false); return; }
        supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => {
            setIsAdmin(data?.role === 'admin');
        });
    }, [user?.id, ready]);

    useEffect(() => {
        if (!isAdmin) return;
        setLoading(true);
        fetchReports(status, 80).then(r => { setReports(r); setLoading(false); });
    }, [status, isAdmin]);

    if (!ready || isAdmin === null) {
        return <div class="forum-loading"><i class="fas fa-circle-notch fa-spin"></i> Cargando…</div>;
    }
    if (!isAdmin) {
        return (
            <div class="stub-state">
                <i class="fas fa-lock"></i>
                <h2>Solo admins</h2>
                <p>Esta página es para administradores. Vuelve al inicio.</p>
                <a class="auth-btn primary" href="/"><i class="fas fa-home"></i> Inicio</a>
            </div>
        );
    }

    const act = async (id: string, next: ReportStatus) => {
        const note = next === 'resolved' ? prompt('Nota de resolución (opcional):') || '' : '';
        const ok = await updateReport(id, { status: next, resolution_note: note });
        if (ok) {
            toast.success('Reporte actualizado');
            setReports(rs => rs.filter(r => r.id !== id || status === 'all'));
        } else {
            toast.error('Error al actualizar');
        }
    };

    return (
        <div class="admin-reports">
            <header class="admin-reports-head">
                <h1><i class="fas fa-shield-halved"></i> Centro de moderación</h1>
                <p>Revisa reportes de contenido enviados por la comunidad.</p>
            </header>

            <nav class="search-tabs">
                {STATUS_TABS.map(t => (
                    <button
                        key={t.id}
                        class={`search-tab ${status === t.id ? 'active' : ''}`}
                        onClick={() => setStatus(t.id)}
                    >
                        <i class={`fas ${t.icon}`}></i>
                        <span>{t.label}</span>
                    </button>
                ))}
            </nav>

            {loading && <div class="forum-loading"><i class="fas fa-circle-notch fa-spin"></i></div>}

            {!loading && reports.length === 0 && (
                <div class="forum-empty">
                    <i class="fas fa-circle-check"></i>
                    <p>Sin reportes en esta categoría.</p>
                </div>
            )}

            <div class="reports-list">
                {reports.map(r => (
                    <article class={`report-card ${r.status}`} key={r.id}>
                        <header>
                            <span class={`report-status-pill ${r.status}`}>{r.status}</span>
                            <strong>{REASON_LABELS[r.reason]}</strong>
                            <small>{timeAgo(r.created_at)}</small>
                        </header>
                        <div class="report-meta">
                            <span><i class="fas fa-cube"></i> Tipo: <b>{r.target_type}</b></span>
                            {r.target_id && <span><i class="fas fa-fingerprint"></i> ID: <code>{r.target_id.slice(0, 8)}…</code></span>}
                            <span><i class="fas fa-user"></i> Por: <b>@{r.reporter?.username || 'anon'}</b></span>
                        </div>
                        {r.details && (
                            <p class="report-details">{r.details}</p>
                        )}
                        <div class="report-targets">
                            {r.target_type === 'thread' && r.target_id && (
                                <a class="auth-btn ghost small" href={`/hilo?id=${r.target_id}`} target="_blank" rel="noopener">
                                    <i class="fas fa-arrow-up-right-from-square"></i> Ver hilo
                                </a>
                            )}
                            {r.target_type === 'profile' && r.target_id && (
                                <a class="auth-btn ghost small" href={`/perfil?u=${r.target_id}`} target="_blank" rel="noopener">
                                    <i class="fas fa-arrow-up-right-from-square"></i> Ver perfil
                                </a>
                            )}
                        </div>
                        {r.resolution_note && (
                            <div class="report-resolution">
                                <i class="fas fa-comment-dots"></i> {r.resolution_note}
                            </div>
                        )}
                        {(r.status === 'pending' || r.status === 'reviewing') && (
                            <footer class="report-actions">
                                {r.status === 'pending' && (
                                    <button class="auth-btn ghost small" onClick={() => act(r.id, 'reviewing')}>
                                        <i class="fas fa-magnifying-glass"></i> Revisar
                                    </button>
                                )}
                                <button class="auth-btn primary small" onClick={() => act(r.id, 'resolved')}>
                                    <i class="fas fa-circle-check"></i> Resolver
                                </button>
                                <button class="auth-btn ghost small" onClick={() => act(r.id, 'dismissed')}>
                                    <i class="fas fa-circle-xmark"></i> Descartar
                                </button>
                            </footer>
                        )}
                    </article>
                ))}
            </div>
        </div>
    );
}
