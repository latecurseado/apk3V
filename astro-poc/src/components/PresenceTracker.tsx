import { useEffect } from 'preact/hooks';
import { useSession } from '../lib/auth';
import { trackMyPresence } from '../lib/presence';

/**
 * Componente sin UI. Solo se monta en BaseLayout y reporta mi presencia
 * al canal global `tv-presence` cuando hay sesión activa.
 */
export default function PresenceTracker() {
    const { user } = useSession();
    useEffect(() => {
        if (!user) return;
        trackMyPresence(user.id);
    }, [user?.id]);
    return null;
}
