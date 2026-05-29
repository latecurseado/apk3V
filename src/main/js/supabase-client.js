// ============================================================
// Tres Valles — Cliente Supabase
// Conecta el frontend a la base de datos Postgres + Auth + Realtime.
// La migración desde localStorage es incremental: este módulo expone
// el cliente vía window.SB; el resto del código de App lo consume
// poco a poco. Mientras tanto, localStorage sigue funcionando como
// caché de lectura para que la PWA no se rompa offline.
// ============================================================

(function () {
    const SUPABASE_URL = 'https://iaqnnphzopxlkzylbals.supabase.co';
    // Publishable key — segura para frontend (no es la service_role).
    const SUPABASE_KEY = 'sb_publishable_gotsvOCmL336D_8l3YJvpw_oOx5pAHx';

    if (!window.supabase || !window.supabase.createClient) {
        console.error('[SB] @supabase/supabase-js no se cargó. Revisa la conexión o el bloqueo de scripts.');
        window.SB = null;
        return;
    }

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage,
            storageKey: 'tv-sb-session'
        },
        realtime: {
            params: { eventsPerSecond: 10 }
        }
    });

    window.SB = client;
    console.log('[SB] Cliente Supabase listo · proyecto:', SUPABASE_URL);
})();
