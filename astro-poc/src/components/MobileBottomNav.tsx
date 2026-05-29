import { useEffect, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import { countUnread } from '../lib/notifications';
import { requireAuthOrPrompt } from '../lib/auth-gate';
import { supabase } from '../lib/supabase';

interface Props {
    onCompose: () => void;
}

export default function MobileBottomNav({ onCompose }: Props) {
    const { user } = useSession();
    const [unread, setUnread] = useState(0);
    const [path, setPath] = useState('');

    useEffect(() => {
        setPath(window.location.pathname);
        const onPop = () => setPath(window.location.pathname);
        window.addEventListener('popstate', onPop);
        document.addEventListener('astro:page-load', onPop);
        return () => {
            window.removeEventListener('popstate', onPop);
            document.removeEventListener('astro:page-load', onPop);
        };
    }, []);

    useEffect(() => {
        if (!user) { setUnread(0); return; }
        countUnread().then(setUnread);
        const ch = supabase
            .channel(`mob-notifs-${user.id}`)
            .on('postgres_changes' as any,
                { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
                async () => setUnread(await countUnread()))
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [user?.id]);

    // Normaliza /perfil/index.html y /perfil/ → /perfil (por el fix de navegación nativa).
    const norm = (p: string) => p.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
    const isActive = (p: string) => norm(path) === norm(p);

    const handleCompose = () => {
        if (!requireAuthOrPrompt('publicar', user?.id ?? null)) return;
        onCompose();
    };

    return (
        <nav class="mob-nav" aria-label="Navegación principal móvil">
            <a class={`mob-item ${isActive('/') ? 'active' : ''}`} href="/">
                <i class="fas fa-house"></i>
                <span>La Plaza</span>
            </a>
            <a class={`mob-item ${isActive('/buscar') ? 'active' : ''}`} href="/buscar">
                <i class="fas fa-magnifying-glass"></i>
                <span>Buscar</span>
            </a>
            <button class="mob-item mob-create" onClick={handleCompose} aria-label="Crear publicación">
                <span class="mob-create-btn"><i class="fas fa-plus"></i></span>
            </button>
            <a class={`mob-item ${isActive('/chat') ? 'active' : ''}`} href="/chat">
                <i class="fas fa-message"></i>
                <span>El Recado</span>
                {unread > 0 && <span class="mob-badge">{unread > 9 ? '9+' : unread}</span>}
            </a>
            <a class={`mob-item ${isActive('/perfil') ? 'active' : ''}`} href="/perfil">
                <i class="fas fa-user"></i>
                <span>Mi Rancho</span>
            </a>
        </nav>
    );
}
