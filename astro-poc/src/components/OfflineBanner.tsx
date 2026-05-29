import { useEffect, useState } from 'preact/hooks';

/**
 * Banner que aparece cuando el navegador pierde conexión.
 * Se oculta automáticamente al volver.
 */
export default function OfflineBanner() {
    const [online, setOnline] = useState(true);
    const [justBack, setJustBack] = useState(false);

    useEffect(() => {
        setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
        const goOff = () => setOnline(false);
        const goOn = () => {
            setOnline(true);
            setJustBack(true);
            setTimeout(() => setJustBack(false), 2500);
        };
        window.addEventListener('offline', goOff);
        window.addEventListener('online', goOn);
        return () => {
            window.removeEventListener('offline', goOff);
            window.removeEventListener('online', goOn);
        };
    }, []);

    if (online && !justBack) return null;

    return (
        <div class={`offline-banner ${online ? 'back' : 'off'}`} role="status">
            {online ? (
                <>
                    <i class="fas fa-circle-check"></i>
                    Conexión restaurada
                </>
            ) : (
                <>
                    <i class="fas fa-circle-exclamation"></i>
                    Sin conexión · trabajando en modo offline
                </>
            )}
        </div>
    );
}
