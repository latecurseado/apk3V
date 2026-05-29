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
            //    mx.tresvalles.app://login-callback con ?code= (PKCE),
            //    o #access_token= (implicit), o ?error= si algo falló.
            const urlSub = await App.addListener('appUrlOpen', async ({ url }) => {
                if (!/login-callback|[?&#](code|error|access_token)=/.test(url)) return;

                // Cierra el navegador del sistema cuanto antes.
                try { const { Browser } = await import('@capacitor/browser'); await Browser.close(); } catch { /* */ }

                // ¿Error explícito de Google/Supabase?
                const errM = url.match(/[?&#]error_description=([^&]+)/) || url.match(/[?&#]error=([^&]+)/);
                if (errM) { toast.error('Google: ' + decodeURIComponent(errM[1].replace(/\+/g, ' '))); return; }

                // Flujo PKCE: ?code=... → canjear por sesión (se pasa SOLO el code).
                let code: string | null = null;
                try { code = new URL(url).searchParams.get('code'); } catch { /* esquema raro */ }
                if (!code) { const m = url.match(/[?&#]code=([^&]+)/); if (m) code = decodeURIComponent(m[1]); }
                if (code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) toast.error('No se pudo iniciar sesión: ' + error.message);
                    else toast.success('¡Sesión iniciada!');
                    return;
                }

                // Flujo implicit (respaldo): #access_token=...&refresh_token=...
                const at = url.match(/[#&]access_token=([^&]+)/);
                const rt = url.match(/[#&]refresh_token=([^&]+)/);
                if (at && rt) {
                    const { error } = await supabase.auth.setSession({
                        access_token: decodeURIComponent(at[1]),
                        refresh_token: decodeURIComponent(rt[1]),
                    });
                    if (error) toast.error('No se pudo iniciar sesión: ' + error.message);
                    else toast.success('¡Sesión iniciada!');
                    return;
                }

                toast.error('No llegó el código de Google. Revisa la Redirect URL en Supabase.');
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
