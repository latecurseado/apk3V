import { useEffect, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import {
    isPushSupported, getPushPermission, isSubscribed,
    subscribeToPush, unsubscribeFromPush,
} from '../lib/push';
import { toast } from '../lib/toast';

const DISMISSED_KEY = 'tv-push-dismissed-at';
const DISMISS_DAYS = 7;

/**
 * Banner discreto que aparece tras login si el navegador soporta push y el
 * usuario aún no se ha suscrito. Si se descarta, espera 7 días para volver.
 */
export default function PushOptIn() {
    const { user, ready } = useSession();
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!ready || !user) { setShow(false); return; }
        if (!isPushSupported()) { setShow(false); return; }

        const perm = getPushPermission();
        if (perm === 'denied') { setShow(false); return; }

        (async () => {
            const subscribed = await isSubscribed();
            if (subscribed) { setShow(false); return; }

            // Verificar dismiss reciente
            try {
                const last = localStorage.getItem(DISMISSED_KEY);
                if (last) {
                    const ms = Date.now() - parseInt(last, 10);
                    if (ms < DISMISS_DAYS * 24 * 3600 * 1000) {
                        setShow(false);
                        return;
                    }
                }
            } catch { /* */ }

            setShow(true);
        })();
    }, [user?.id, ready]);

    const enable = async () => {
        setBusy(true);
        const ok = await subscribeToPush();
        setBusy(false);
        if (ok) {
            toast.success('Notificaciones activadas');
            setShow(false);
        } else {
            const perm = getPushPermission();
            if (perm === 'denied') {
                toast.error('Permiso denegado. Habilítalo en ajustes del navegador.');
            } else {
                toast.error('No se pudo activar. Intenta de nuevo.');
            }
        }
    };

    const dismiss = () => {
        try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* */ }
        setShow(false);
    };

    if (!show) return null;

    return (
        <div class="push-optin">
            <div class="push-optin-icon">
                <i class="fas fa-bell"></i>
            </div>
            <div class="push-optin-body">
                <strong>Recibe avisos en tiempo real</strong>
                <small>Mensajes, menciones, likes y comentarios · puedes desactivar cuando quieras.</small>
            </div>
            <div class="push-optin-actions">
                <button class="auth-btn ghost small" onClick={dismiss} disabled={busy}>
                    Ahora no
                </button>
                <button class="auth-btn primary small" onClick={enable} disabled={busy}>
                    {busy
                        ? <><i class="fas fa-circle-notch fa-spin"></i> Activando…</>
                        : <><i class="fas fa-bell"></i> Activar</>}
                </button>
            </div>
        </div>
    );
}

/** Toggle individual para usar dentro del SettingsMenu. */
export function PushToggle() {
    const [enabled, setEnabled] = useState(false);
    const [supported, setSupported] = useState(true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isPushSupported()) { setSupported(false); return; }
        isSubscribed().then(setEnabled);
    }, []);

    if (!supported) {
        return <small class="auth-hint">Tu navegador no soporta notificaciones push.</small>;
    }

    const onChange = async () => {
        setBusy(true);
        if (enabled) {
            await unsubscribeFromPush();
            setEnabled(false);
            toast.success('Notificaciones desactivadas');
        } else {
            const ok = await subscribeToPush();
            setEnabled(ok);
            if (ok) toast.success('Notificaciones activadas');
            else toast.error('No se pudo activar');
        }
        setBusy(false);
    };

    return (
        <label class="settings-toggle">
            <input type="checkbox" checked={enabled} onChange={onChange} disabled={busy} />
            <span>
                <i class="fas fa-bell"></i> Notificaciones push
                {busy && <i class="fas fa-circle-notch fa-spin" style="margin-left:6px;"></i>}
            </span>
        </label>
    );
}
