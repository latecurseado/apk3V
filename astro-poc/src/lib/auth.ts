import { useEffect, useState } from 'preact/hooks';
import type { Session, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

/**
 * Login con Google que funciona en web Y en la app nativa (Capacitor).
 * - Web: redirect normal al origin.
 * - Nativo: abre el flujo en el navegador del sistema y vuelve por deep-link
 *   (mx.tresvalles.app://login-callback). El intercambio del code lo hace
 *   NativeBridge al recibir `appUrlOpen`.
 *
 * IMPORTANTE (config externa del usuario):
 *  - Supabase → Authentication → URL Configuration → Redirect URLs:
 *      añade `mx.tresvalles.app://login-callback`
 *  - Google Cloud → OAuth client → Authorized redirect URIs ya las maneja Supabase.
 */
export async function signInWithGoogle() {
    if (Capacitor.isNativePlatform()) {
        const { Browser } = await import('@capacitor/browser');
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: 'mx.tresvalles.app://login-callback', skipBrowserRedirect: true },
        });
        if (error) return { error };
        if (data?.url) await Browser.open({ url: data.url });
        return { error: null };
    }
    return await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
    });
}

export function useSession() {
    const [session, setSession] = useState<Session | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setReady(true);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
            setSession(s);
        });
        return () => sub.subscription.unsubscribe();
    }, []);

    return { session, user: session?.user ?? null, ready };
}

export async function signInAnonymously() {
    return await supabase.auth.signInAnonymously();
}

export async function signInWithEmail(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
}

export interface SignupExtras {
    username: string;
    birthdate?: string;        // YYYY-MM-DD
    country?: string;          // ISO-2 (MX, US, …)
    country_name?: string;     // 'México', 'Estados Unidos'…
    account_type?: 'personal' | 'business';
    business_name?: string;
    business_category?: string;
}

export async function signUpWithEmail(email: string, password: string, extras: SignupExtras | string) {
    // Backwards compat: si llega un string es el username viejo
    const meta: any = typeof extras === 'string' ? { username: extras } : { ...extras };
    const result = await supabase.auth.signUp({
        email,
        password,
        options: { data: meta },
    });
    // Si el signup OK y tenemos campos extra, intenta actualizar el profile
    // (el trigger handle_new_user crea la fila con username · aquí completamos).
    if (!result.error && result.data?.user && typeof extras !== 'string') {
        const patch: any = {};
        if (extras.birthdate) patch.birthdate = extras.birthdate;
        if (extras.country) patch.country = extras.country;
        if (extras.country_name) patch.country_name = extras.country_name;
        if (extras.account_type) patch.account_type = extras.account_type;
        if (extras.business_name) patch.business_name = extras.business_name;
        if (extras.business_category) patch.business_category = extras.business_category;
        if (Object.keys(patch).length > 0) {
            setTimeout(async () => {
                await supabase.from('profiles').update(patch).eq('id', result.data!.user!.id);
            }, 800);
        }
    }
    return result;
}

export async function signOut() {
    return await supabase.auth.signOut();
}

export function userLabel(user: User | null): string {
    if (!user) return 'Invitado';
    const meta = user.user_metadata as { username?: string; full_name?: string } | undefined;
    if (meta?.username) return meta.username;
    if (meta?.full_name) return meta.full_name;
    if (user.email) return user.email.split('@')[0];
    return 'Invitado #' + user.id.slice(0, 6);
}
