// ============================================================
// Tres Valles — Cloudflare Worker para mantener Supabase activa
// ============================================================
// Cloudflare Workers tiene cron triggers gratuitos.
// Este worker hace una consulta mínima a Supabase cada 24 horas
// para que el proyecto NO se pause por inactividad (free tier).
//
// Despliegue:
//   1. Cloudflare Dashboard → Workers & Pages → Create → Worker
//   2. Pega este código en el editor.
//   3. Guarda y despliega.
//   4. En la pestaña "Triggers" añade un Cron Trigger:
//        Cron expression: 0 13 * * *      (cada día a las 13:00 UTC = 7am Mexico)
//   5. ¡Listo! El Worker pinguea solo cada día.
//
// Costo: Cloudflare Workers Free tier permite hasta 100,000 invocaciones/día.
//        Este Worker se invoca 1 vez al día. Sobra 99,999.
// ============================================================

const SUPABASE_URL = 'https://iaqnnphzopxlkzylbals.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gotsvOCmL336D_8l3YJvpw_oOx5pAHx';

export default {
    // Disparado por cron expression (configurado en Cloudflare Dashboard)
    async scheduled(event, env, ctx) {
        const result = await pingSupabase();
        console.log('[keepalive]', result);
    },

    // También responde a HTTP para que puedas testearlo manualmente
    // visitando https://tu-worker.tu-cuenta.workers.dev
    async fetch(request, env, ctx) {
        const result = await pingSupabase();
        return new Response(JSON.stringify(result, null, 2), {
            headers: { 'content-type': 'application/json' }
        });
    }
};

async function pingSupabase() {
    const startedAt = new Date().toISOString();
    try {
        // Consulta mínima a la tabla `outlets` (siempre tiene 2 filas seed)
        // Usar HEAD para mínimo overhead, y devolver count.
        const url = `${SUPABASE_URL}/rest/v1/outlets?select=id&limit=1`;
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        const ok = res.ok;
        const status = res.status;
        const body = ok ? await res.text() : null;
        return {
            timestamp: startedAt,
            ok,
            status,
            preview: body ? body.slice(0, 100) : null
        };
    } catch (err) {
        return {
            timestamp: startedAt,
            ok: false,
            error: err.message || String(err)
        };
    }
}
