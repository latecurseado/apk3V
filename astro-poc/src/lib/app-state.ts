import { supabase } from './supabase';

export interface AppState {
    maintenance_mode: boolean;
    maintenance_message: string;
    maintenance_until: string | null;
}

const DEFAULT_STATE: AppState = {
    maintenance_mode: false,
    maintenance_message: '',
    maintenance_until: null,
};

export async function fetchAppState(): Promise<AppState> {
    try {
        const { data, error } = await supabase.rpc('get_app_state');
        if (error || !data) return DEFAULT_STATE;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return DEFAULT_STATE;
        return {
            maintenance_mode: !!row.maintenance_mode,
            maintenance_message: row.maintenance_message || '',
            maintenance_until: row.maintenance_until || null,
        };
    } catch (e) {
        console.warn('[app-state]', e);
        return DEFAULT_STATE;
    }
}

export async function setMaintenance(enabled: boolean, message?: string, until?: string | null): Promise<{ ok: boolean; reason?: string }> {
    const { error } = await supabase.rpc('set_maintenance', {
        p_enabled: enabled,
        p_message: message ?? null,
        p_until: until ?? null,
    });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
}

export function subscribeAppState(onChange: (state: AppState) => void): () => void {
    const ch = supabase
        .channel('tv-app-settings')
        .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'app_settings' }, async () => {
            const fresh = await fetchAppState();
            onChange(fresh);
        })
        .subscribe();
    return () => { supabase.removeChannel(ch); };
}

/* ───── Owner check ───── */

export async function checkIsOwner(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from('profiles').select('is_owner').eq('id', user.id).maybeSingle();
    return !!(data as any)?.is_owner;
}
