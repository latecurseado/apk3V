/**
 * Tres Valles · Cleanup Worker
 * -----------------------------
 * Cron diario: limpia datos expirados y huérfanos para mantener la DB sana.
 *
 * - Stories expiradas (>24h)
 * - DM messages con expires_at vencido (disappearing messages)
 * - Notificaciones leídas con >30 días
 * - Rate limits con >24h
 * - Invitados (is_guest=true) inactivos por más de 30 días
 * - Reports resueltos con >90 días
 *
 * Deploy:
 *   wrangler login
 *   wrangler secret put SUPABASE_SERVICE_KEY
 *   wrangler deploy
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (url.pathname === '/run') {
            return new Response(JSON.stringify(await runJob(env), null, 2), {
                headers: { 'content-type': 'application/json' },
            });
        }
        return new Response('Tres Valles cleanup · cron diario.', {
            headers: { 'content-type': 'text/plain' },
        });
    },
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runJob(env));
    },
};

async function runJob(env) {
    const stats = {};
    const headers = {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
    };

    // 1) RPC purge_expired_stories
    try {
        const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/purge_expired_stories`, { method: 'POST', headers });
        stats.stories_purged = r.ok ? await r.json() : `err ${r.status}`;
    } catch (e) { stats.stories_purged = 'err: ' + e.message; }

    // 2) RPC purge_expired_dms
    try {
        const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/purge_expired_dms`, { method: 'POST', headers });
        stats.dms_purged = r.ok ? await r.json() : `err ${r.status}`;
    } catch (e) { stats.dms_purged = 'err: ' + e.message; }

    // 3) Notificaciones leídas con >30 días
    try {
        const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const r = await fetch(
            `${env.SUPABASE_URL}/rest/v1/notifications?read=eq.true&created_at=lt.${cutoff}`,
            { method: 'DELETE', headers },
        );
        stats.old_notifs_deleted = r.ok ? 'ok' : `err ${r.status}`;
    } catch (e) { stats.old_notifs_deleted = 'err: ' + e.message; }

    // 4) Rate limits con window_start >24h
    try {
        const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const r = await fetch(
            `${env.SUPABASE_URL}/rest/v1/rate_limits?window_start=lt.${cutoff}`,
            { method: 'DELETE', headers },
        );
        stats.rate_limits_deleted = r.ok ? 'ok' : `err ${r.status}`;
    } catch (e) { stats.rate_limits_deleted = 'err: ' + e.message; }

    // 5) Reportes resueltos / descartados con >90 días
    try {
        const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
        const r = await fetch(
            `${env.SUPABASE_URL}/rest/v1/reports?status=in.(resolved,dismissed)&resolved_at=lt.${cutoff}`,
            { method: 'DELETE', headers },
        );
        stats.old_reports_deleted = r.ok ? 'ok' : `err ${r.status}`;
    } catch (e) { stats.old_reports_deleted = 'err: ' + e.message; }

    // 6) Push subscriptions con last_used >60 días (probablemente endpoint muerto)
    try {
        const cutoff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
        const r = await fetch(
            `${env.SUPABASE_URL}/rest/v1/push_subscriptions?last_used=lt.${cutoff}`,
            { method: 'DELETE', headers },
        );
        stats.stale_push_subs_deleted = r.ok ? 'ok' : `err ${r.status}`;
    } catch (e) { stats.stale_push_subs_deleted = 'err: ' + e.message; }

    stats.ran_at = new Date().toISOString();
    return stats;
}
