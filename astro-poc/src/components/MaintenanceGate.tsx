import { useEffect, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import {
    fetchAppState, subscribeAppState, checkIsOwner, setMaintenance,
    type AppState,
} from '../lib/app-state';
import { toast } from '../lib/toast';
import AuthModal from './AuthModal';

export default function MaintenanceGate() {
    const { user, ready } = useSession();
    const [state, setState] = useState<AppState | null>(null);
    const [isOwner, setIsOwner] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    const [showOwnerPanel, setShowOwnerPanel] = useState(false);

    // Carga inicial + realtime
    useEffect(() => {
        fetchAppState().then(setState);
        const unsub = subscribeAppState(setState);
        return unsub;
    }, []);

    // Check si soy owner cuando hay sesión
    useEffect(() => {
        if (!user) { setIsOwner(false); return; }
        checkIsOwner().then(setIsOwner);
    }, [user?.id]);

    // Si el owner activa mientras estoy adentro y NO soy owner → blur
    if (!state) return null;
    if (!state.maintenance_mode) {
        // Sin mantenimiento — pero si soy owner, muestro botón flotante para controlarlo
        return isOwner ? <OwnerFloatingBtn onClick={() => setShowOwnerPanel(true)} state={state} showPanel={showOwnerPanel} onClosePanel={() => setShowOwnerPanel(false)} /> : null;
    }

    // Modo mantenimiento activo
    const messageText = state.maintenance_message || 'El sitio está temporalmente bloqueado.';
    const untilDate = state.maintenance_until ? new Date(state.maintenance_until) : null;

    // Si soy owner → puedo seguir usando la app + banner para desactivar
    if (isOwner) {
        return (
            <>
                <div class="owner-maint-banner">
                    <i class="fas fa-shield-halved"></i>
                    <span><b>Modo mantenimiento ACTIVO</b> — solo tú (owner) puedes ver el sitio</span>
                    <button class="auth-btn primary small" onClick={async () => {
                        if (!confirm('¿Reactivar el sitio para todos?')) return;
                        const r = await setMaintenance(false);
                        if (r.ok) toast.success('Sitio reactivado');
                        else toast.error('Error: ' + (r.reason || ''));
                    }}>
                        <i class="fas fa-unlock"></i> Desactivar
                    </button>
                </div>
                {showOwnerPanel && <OwnerPanel state={state} onClose={() => setShowOwnerPanel(false)} />}
            </>
        );
    }

    // No-owner → pantalla de bloqueo total
    return (
        <div class="maint-blocker">
            <div class="maint-card">
                <div class="maint-icon"><i class="fas fa-lock"></i></div>
                <h1>Sitio bloqueado</h1>
                <p class="maint-message">{messageText}</p>
                {untilDate && (
                    <p class="maint-until">
                        <i class="far fa-clock"></i>
                        Vuelve disponible: <b>{untilDate.toLocaleString('es-MX', {
                            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                        })}</b>
                    </p>
                )}
                <div class="maint-actions">
                    {!user && ready && (
                        <button class="auth-btn ghost small" onClick={() => setShowLogin(true)}>
                            <i class="fas fa-right-to-bracket"></i> Soy administrador
                        </button>
                    )}
                    {user && !isOwner && (
                        <p class="maint-foot">
                            <i class="fas fa-circle-info"></i>
                            Sesión activa como <b>{user.email || 'invitado'}</b> — pero solo el owner puede desbloquear.
                        </p>
                    )}
                </div>
                <small class="maint-brand">Tres Valles · Portal Comunitario</small>
            </div>
            {showLogin && <AuthModal onClose={() => setShowLogin(false)} initialTab="login" />}
        </div>
    );
}

/* ────────── Botón flotante del owner (cuando NO hay mantenimiento) ────────── */
function OwnerFloatingBtn({ onClick, state, showPanel, onClosePanel }: {
    onClick: () => void;
    state: AppState;
    showPanel: boolean;
    onClosePanel: () => void;
}) {
    return (
        <>
            <button class="owner-fab" onClick={onClick} title="Panel de owner — bloquear sitio">
                <i class="fas fa-shield-halved"></i>
            </button>
            {showPanel && <OwnerPanel state={state} onClose={onClosePanel} />}
        </>
    );
}

/* ────────── Panel del owner — activar mantenimiento ────────── */
function OwnerPanel({ state, onClose }: { state: AppState; onClose: () => void }) {
    const [message, setMessage] = useState(state.maintenance_message || 'Estamos haciendo mejoras. Volvemos pronto.');
    const [untilDate, setUntilDate] = useState('');
    const [busy, setBusy] = useState(false);

    const activate = async () => {
        if (!confirm('¿Activar modo mantenimiento? Todos los usuarios verán la pantalla de bloqueo. Solo tú podrás seguir usando el sitio.')) return;
        setBusy(true);
        const until = untilDate ? new Date(untilDate).toISOString() : null;
        const r = await setMaintenance(true, message, until);
        setBusy(false);
        if (r.ok) { toast.success('Sitio bloqueado'); onClose(); }
        else toast.error('Error: ' + (r.reason || ''));
    };

    const deactivate = async () => {
        setBusy(true);
        const r = await setMaintenance(false);
        setBusy(false);
        if (r.ok) { toast.success('Sitio reactivado'); onClose(); }
        else toast.error('Error: ' + (r.reason || ''));
    };

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal small" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-shield-halved"></i> Panel del owner</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    <p class="hub-section-lead" style="margin:0 0 14px;">
                        <i class="fas fa-info-circle" style="color:var(--accent);"></i>
                        {' '}Activa modo mantenimiento para bloquear el sitio a todos los usuarios.
                        <b> Solo tú</b> (owner) seguirás teniendo acceso.
                    </p>

                    <div class="form-grid">
                        <label>
                            <span>Mensaje para visitantes</span>
                            <textarea rows={3}
                                value={message}
                                onInput={(e: any) => setMessage(e.currentTarget.value)}
                                placeholder="Estamos haciendo mejoras. Volvemos pronto." />
                        </label>
                        <label>
                            <span>Auto-desbloquear el (opcional)</span>
                            <input type="datetime-local" value={untilDate}
                                onInput={(e: any) => setUntilDate(e.currentTarget.value)} />
                            <small class="auth-hint">Si lo dejas vacío, queda bloqueado hasta que tú lo desactives manualmente.</small>
                        </label>
                    </div>

                    <div class="owner-panel-status">
                        Estado actual:
                        {state.maintenance_mode ? (
                            <span class="owner-status active">🔒 BLOQUEADO</span>
                        ) : (
                            <span class="owner-status inactive">✅ Operativo</span>
                        )}
                    </div>

                    <div class="form-actions">
                        <button class="auth-btn ghost small" onClick={onClose} disabled={busy}>Cancelar</button>
                        {state.maintenance_mode ? (
                            <button class="auth-btn primary small" onClick={deactivate} disabled={busy}>
                                <i class="fas fa-unlock"></i> Desbloquear sitio
                            </button>
                        ) : (
                            <button class="auth-btn danger small" onClick={activate} disabled={busy || !message.trim()}>
                                <i class="fas fa-lock"></i> {busy ? 'Bloqueando…' : 'Bloquear sitio'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
