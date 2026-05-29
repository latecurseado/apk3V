import { useEffect } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';

/**
 * Puente nativo (Capacitor). NO hace nada en web (gateado por isNativePlatform).
 * - Deep-link de OAuth: al volver de Google (mx.tresvalles.app://login-callback)
 *   intercambia el code por sesión y cierra el navegador del sistema.
 * - Push nativo: pide permiso, registra el token (FCM/APNs) y lo guarda en
 *   `device_push_tokens` para que un sender FCM/APNs pueda enviar.
 * - Botón atrás de Android: cierra modales / navega atrás.
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

            // 3) Push notifications
            try {
                const { PushNotifications } = await import('@capacitor/push-notifications');
                let perm = await PushNotifications.checkPermissions();
                if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions();
                if (perm.receive === 'granted') {
                    await PushNotifications.register();
                    const regSub = await PushNotifications.addListener('registration', async (token) => {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) return;
                        await supabase.from('device_push_tokens').upsert({
                            user_id: user.id,
                            token: token.value,
                            platform: Capacitor.getPlatform(),
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'user_id,token' });
                    });
                    subs.push(regSub);
                    const tapSub = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                        const url = (action.notification?.data as any)?.url;
                        if (url) window.location.href = url;
                    });
                    subs.push(tapSub);
                }
            } catch (e) { console.warn('[native] push:', e); }
        })();

        return () => { subs.forEach(s => { try { s.remove(); } catch { /* */ } }); };
    }, []);

    return null;
}
