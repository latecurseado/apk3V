import { useEffect, useRef, useState } from 'preact/hooks';
import { useSession, signOut, userLabel } from '../lib/auth';
import { fetchProfileById, type ProfileFull } from '../lib/profile';
import { toast } from '../lib/toast';
import AuthModal from './AuthModal';

export default function AuthMenu() {
    const { user, ready } = useSession();
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState<'login' | 'signup' | 'guest'>('login');
    const [menuOpen, setMenuOpen] = useState(false);
    const [profile, setProfile] = useState<ProfileFull | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) { setProfile(null); return; }
        fetchProfileById(user.id).then(setProfile);
    }, [user?.id]);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const doSignOut = async () => {
        await signOut();
        setMenuOpen(false);
        toast.success('Sesión cerrada');
    };

    if (!ready) {
        return <span class="auth-menu-loading"><i class="fas fa-circle-notch fa-spin"></i></span>;
    }

    // Sin sesión → botón "Entrar"
    if (!user) {
        return (
            <>
                <div class="auth-menu-wrap">
                    <button class="auth-btn ghost small auth-cta-secondary" onClick={() => { setModalTab('signup'); setModalOpen(true); }}>
                        Registrarse
                    </button>
                    <button class="auth-btn primary small auth-cta-primary" onClick={() => { setModalTab('login'); setModalOpen(true); }}>
                        <i class="fas fa-right-to-bracket"></i> <span class="auth-cta-label">Entrar</span>
                    </button>
                </div>
                {modalOpen && <AuthModal onClose={() => setModalOpen(false)} initialTab={modalTab} />}
            </>
        );
    }

    // Con sesión → avatar + dropdown menu
    const label = profile?.username || userLabel(user);
    const isAnon = !user.email;
    const username = profile?.username || null;

    return (
        <div class="auth-menu-wrap" ref={wrapRef}>
            <button class="auth-menu-trigger" onClick={() => setMenuOpen(o => !o)}>
                <span class="auth-menu-avatar">
                    {profile?.pfp ? <img src={profile.pfp} alt={label} /> : <i class="fas fa-user"></i>}
                </span>
                <span class="auth-menu-name">{label}</span>
                <i class="fas fa-chevron-down auth-menu-caret"></i>
            </button>

            {menuOpen && (
                <div class="auth-menu-dropdown">
                    <div class="auth-menu-head">
                        <span class="auth-menu-avatar big">
                            {profile?.pfp ? <img src={profile.pfp} /> : <i class="fas fa-user"></i>}
                        </span>
                        <div>
                            <strong>{label}</strong>
                            <small>{user.email || 'Sesión de invitado'}</small>
                        </div>
                    </div>
                    <a class="auth-menu-item" href={username ? `/perfil?u=${username}` : '/perfil'} onClick={() => setMenuOpen(false)}>
                        <i class="fas fa-user"></i> Mi perfil
                    </a>
                    <a class="auth-menu-item" href="/perfil" onClick={() => setMenuOpen(false)}>
                        <i class="fas fa-pen"></i> Editar perfil
                    </a>
                    <a class="auth-menu-item" href="/chat" onClick={() => setMenuOpen(false)}>
                        <i class="fas fa-message"></i> Mis mensajes
                    </a>
                    {isAnon && (
                        <button class="auth-menu-item highlight" onClick={() => { setModalTab('signup'); setModalOpen(true); setMenuOpen(false); }}>
                            <i class="fas fa-star"></i> Convertir en cuenta real
                        </button>
                    )}
                    <hr class="auth-menu-sep" />
                    <button class="auth-menu-item danger" onClick={doSignOut}>
                        <i class="fas fa-right-from-bracket"></i> Cerrar sesión
                    </button>
                </div>
            )}

            {modalOpen && <AuthModal onClose={() => setModalOpen(false)} initialTab={modalTab} />}
        </div>
    );
}
