/**
 * Gate de autenticación tipo Instagram.
 * Cualquier interacción que requiera sesión llama a `requireAuth(action)`.
 * Si NO hay sesión activa, dispara un evento global que abre el AuthModal
 * y devuelve false (la acción se cancela).
 * Si SÍ hay sesión, devuelve true (la acción procede).
 *
 * El AuthModalHost en BaseLayout escucha estos eventos y muestra el modal.
 */
import { supabase } from './supabase';

export const AUTH_REQUIRED_EVENT = 'tv:auth-required';

interface AuthRequiredDetail {
    action: string;
    initialTab?: 'login' | 'signup' | 'guest';
}

export function requireAuth(action: string = 'continuar'): Promise<boolean> {
    return new Promise(async (resolve) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) { resolve(true); return; }
        // Disparar evento global; el host del modal lo escucha
        const detail: AuthRequiredDetail = { action, initialTab: 'login' };
        window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, { detail }));
        resolve(false);
    });
}

/**
 * Versión sincrónica para uso en handlers donde NO podemos await.
 * Si sospechas que no hay sesión, llama esto inmediatamente — abre el modal.
 * Útil para botones de "like", "comment", etc.
 */
export function requireAuthOrPrompt(action: string = 'continuar', currentUserId: string | null): boolean {
    if (currentUserId) return true;
    const detail: AuthRequiredDetail = { action, initialTab: 'login' };
    window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, { detail }));
    return false;
}
