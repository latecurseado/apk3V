import { useEffect } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';

/**
 * Puente nativo (Capacitor). NO hace nada en web (gateado por isNativePlatform).
 * - Deep-link de OAuth: al volver de Google (mx.tresvalles.app://login-callback)
 *   intercambia el code por sesión y cierra el navegador del sistema.
 * - Botón atrás de Android: cierra modales / navega atrás.
 *
 * NOTA: el push nativo se quitó por ahora — sin `google-services.json` (Firebase)
 * el plugin reventaba la app al iniciar. Se reactiva cuando se configure Firebase.
 */
export default function NativeBridge() {
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        // App nativa: se comporta como app (sin zoom de pellizco / doble-tap),
        // y marca <html> para aplicar safe-areas (notch) por CSS.
        document.documentElement.classList.add('is-native');
        const vp = document.querySelector('meta[name="viewport"]');
        if (vp) vp.setAttribute('content',
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');

        const subs: Array<{ remove: () => void }> = [];

        (async () => {
            const { App } = await import('@capacitor/app');

            // 1) OAuth deep-link
            const urlSub = await App.addListener('appUrlOpen', async ({ url }) => {
                if (url.includes('login-callback') || url.includes('code=')) {
                    try { await supabase.auth.exchangeCodeForSession(url); } catch (e) { console.warn('[native] oauth:', e); }
                    try { const { Browser } = await import('@capacitor/browser'); await Browser.close(); } catch { /* */ }
                }
            });
            subs.push(urlSub);

            // 2) Botón atrás de Android
            const backSub = await App.addListener('backButton', ({ canGoBack }) => {
                const overlay = document.querySelector('.modal-overlay');
                if (overlay) { (overlay as HTMLElement).click(); return; }
                if (canGoBack) window.history.back();
                else App.exitApp();
            });
            subs.push(backSub);

            // (Push nativo desactivado hasta configurar Firebase · evitaba el crash al inicio)
        })();

        return () => { subs.forEach(s => { try { s.remove(); } catch { /* */ } }); };
    }, []);

    return null;
}
