import { useEffect } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

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

            // 1) OAuth deep-link (Google). Supabase nos devuelve a
            //    mx.tresvalles.app://login-callback?code=... (o ?error=...).
            const urlSub = await App.addListener('appUrlOpen', async ({ url }) => {
                if (!(url.includes('login-callback') || url.includes('code=') || url.includes('error='))) return;

                // Cierra el navegador del sistema cuanto antes.
                try { const { Browser } = await import('@capacitor/browser'); await Browser.close(); } catch { /* */ }

                // Extrae los parámetros del deep-link.
                let code: string | null = null;
                let errDesc: string | null = null;
                try {
                    const u = new URL(url);
                    code = u.searchParams.get('code');
                    errDesc = u.searchParams.get('error_description') || u.searchParams.get('error');
                } catch { /* esquema raro → regex de respaldo abajo */ }
                if (!code) { const m = url.match(/[?&#]code=([^&]+)/); if (m) code = decodeURIComponent(m[1]); }
                if (!errDesc) { const m = url.match(/[?&#]error_description=([^&]+)/); if (m) errDesc = decodeURIComponent(m[1].replace(/\+/g, ' ')); }

                if (errDesc) { toast.error('Google: ' + errDesc); return; }
                if (!code) { toast.error('No llegó el código de Google. Revisa la Redirect URL en Supabase.'); return; }

                // IMPORTANTE: se pasa SOLO el `code`, NO la URL completa.
                // exchangeCodeForSession manda el argumento tal cual como auth_code.
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) toast.error('No se pudo iniciar sesión: ' + error.message);
                else toast.success('¡Sesión iniciada!');
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
