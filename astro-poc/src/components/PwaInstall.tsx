import { useEffect, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';

interface BeforeInstallEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstall() {
    const [installEvent, setInstallEvent] = useState<BeforeInstallEvent | null>(null);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        // En la APP NATIVA (Capacitor) NO registramos service worker: los assets
        // ya van empaquetados, no aporta nada y su auto-recarga tiraba la sesión
        // ("entra y me saca"). En web sí, con auto-actualización.
        if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
            navigator.serviceWorker.register('/sw.js').then((reg) => {
                // Si aparece un SW nuevo, fuerza su activación y recarga al tomar control.
                reg.addEventListener('updatefound', () => {
                    const sw = reg.installing;
                    if (!sw) return;
                    sw.addEventListener('statechange', () => {
                        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                            // Hay una versión previa controlando → la nueva está lista.
                            reg.waiting?.postMessage?.('skip-waiting');
                        }
                    });
                });
                // Busca actualizaciones al cargar.
                reg.update?.();
            }).catch(e => console.warn('[sw]', e));

            // Solo recargamos si YA había un SW controlando (= es una
            // actualización, no la primera instalación → evita reload de más).
            const hadController = !!navigator.serviceWorker.controller;
            let reloaded = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (reloaded || !hadController) return;
                reloaded = true;
                window.location.reload();
            });
        }

        const onBeforeInstall = (e: Event) => {
            e.preventDefault();
            setInstallEvent(e as BeforeInstallEvent);
        };
        const onInstalled = () => { setInstalled(true); setInstallEvent(null); };

        window.addEventListener('beforeinstallprompt', onBeforeInstall);
        window.addEventListener('appinstalled', onInstalled);

        // Detectar si ya está instalada (PWA en standalone)
        if (window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true) {
            setInstalled(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstall);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    if (installed || !installEvent) return null;

    const install = async () => {
        await installEvent.prompt();
        const result = await installEvent.userChoice;
        if (result.outcome === 'accepted') setInstalled(true);
    };

    return (
        <button class="pwa-install-btn" onClick={install} title="Instalar como app">
            <i class="fas fa-download"></i>
            <span class="pwa-install-label">Instalar app</span>
        </button>
    );
}
