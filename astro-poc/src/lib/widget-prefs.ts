/* ============================================================
   Preferencias del inicio · qué widgets se ven y en qué orden.
   Modelo: `visible: string[]` = lista ordenada de los widgets MOSTRADOS.
   Lo "disponible para añadir" se deriva = ALL_WIDGET_IDS − visible.
   Persistencia: localStorage (cache/offline) + Supabase (profiles.home_widgets)
   para que la config siga al usuario entre dispositivos.
   ============================================================ */
import { supabase } from './supabase';
import { ALL_WIDGET_IDS } from './widget-registry';

const LS_KEY = 'tv-home-widgets-v2';
export const CHANGED_EVENT = 'tvWidgetsChanged';

function sanitize(list: unknown): string[] | null {
    if (!Array.isArray(list)) return null;
    const valid = list.filter(
        (x): x is string => typeof x === 'string' && ALL_WIDGET_IDS.includes(x),
    );
    // dedupe preservando orden
    return Array.from(new Set(valid));
}

/** Lee la config local (o null si no hay nada guardado válido). */
export function loadVisible(): string[] | null {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        return sanitize(JSON.parse(raw));
    } catch {
        return null;
    }
}

/** Guarda local y avisa a otras islas. `broadcast=false` para no re-emitir. */
export function saveVisible(visible: string[], broadcast = true): void {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(visible));
    } catch { /* localStorage bloqueado */ }
    if (broadcast && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: visible }));
    }
}

export function resetVisible(): void {
    try { localStorage.removeItem(LS_KEY); } catch { /* */ }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: [...ALL_WIDGET_IDS] }));
    }
}

/** Trae la config remota del perfil (o null si no hay/está vacía). */
export async function fetchRemoteVisible(userId: string): Promise<string[] | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('home_widgets')
        .eq('id', userId)
        .maybeSingle();
    if (error || !data) return null;
    return sanitize((data as { home_widgets?: unknown }).home_widgets);
}

/** Persiste la config en el perfil. Silencioso ante error (la local ya guardó). */
export async function saveRemoteVisible(userId: string, visible: string[]): Promise<void> {
    try {
        await supabase.from('profiles').update({ home_widgets: visible }).eq('id', userId);
    } catch { /* offline · la copia local es suficiente */ }
}
