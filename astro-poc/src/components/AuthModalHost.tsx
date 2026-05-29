import { useEffect, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import { AUTH_REQUIRED_EVENT } from '../lib/auth-gate';
import AuthModal from './AuthModal';

export default function AuthModalHost() {
    const { user } = useSession();
    const [open, setOpen] = useState(false);
    const [action, setAction] = useState<string>('continuar');

    useEffect(() => {
        const onRequest = (e: Event) => {
            const detail = (e as CustomEvent).detail as { action?: string } | undefined;
            // Solo abrir si NO hay sesión (por si se disparó stale)
            if (!user) {
                setAction(detail?.action || 'continuar');
                setOpen(true);
            }
        };
        window.addEventListener(AUTH_REQUIRED_EVENT, onRequest);
        return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onRequest);
    }, [user?.id]);

    // Si el user inicia sesión durante el modal, ciérralo
    useEffect(() => { if (user && open) setOpen(false); }, [user?.id, open]);

    if (!open) return null;
    return (
        <>
            <AuthModal onClose={() => setOpen(false)} initialTab="login" />
            {action !== 'continuar' && (
                <div class="auth-required-toast">
                    <i class="fas fa-info-circle"></i>
                    <span>Inicia sesión para <b>{action}</b></span>
                </div>
            )}
        </>
    );
}
