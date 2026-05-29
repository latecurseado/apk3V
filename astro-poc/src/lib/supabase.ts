import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_KEY;

if (!url || !key) {
    console.warn(
        '[supabase] Faltan PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_KEY en .env. ' +
        'Copia .env.example a .env y rellena los valores.'
    );
}

/**
 * En la app NATIVA (Capacitor) la sesión se guarda con Capacitor Preferences
 * (persistente y fiable) en vez del localStorage del webview, que a veces se
 * limpia y te "saca" al entrar. En web se usa el localStorage normal.
 */
const native = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();

const nativeStorage = native ? {
    async getItem(k: string): Promise<string | null> {
        const { Preferences } = await import('@capacitor/preferences');
        return (await Preferences.get({ key: k })).value;
    },
    async setItem(k: string, v: string): Promise<void> {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key: k, value: v });
    },
    async removeItem(k: string): Promise<void> {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.remove({ key: k });
    },
} : undefined;

export const supabase = createClient(url ?? '', key ?? '', {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        // En web detectamos el token en la URL (redirect de OAuth). En nativo NO:
        // el OAuth vuelve por deep-link y lo canjea NativeBridge a mano.
        detectSessionInUrl: !native,
        ...(nativeStorage ? { storage: nativeStorage as any } : {}),
    },
});
