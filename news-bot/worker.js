/**
 * Tres Valles News Bot — Cloudflare Worker
 * ----------------------------------------
 * Corre por cron cada hora. Fetch RSS de fuentes que cubren Veracruz/Cuenca
 * del Papaloapan, filtra ESTRICTAMENTE por menciones de "Tres Valles", e
 * inserta como hilos del usuario bot en el foro #noticias de Supabase.
 *
 * Sin login a Facebook · sin scraping · sin auth de terceros · 100% RSS público.
 *
 * Despliegue:
 *   wrangler login
 *   wrangler secret put SUPABASE_ANON_KEY
 *   wrangler secret put BOT_SECRET
 *   wrangler deploy
 *
 * Probar manualmente:
 *   curl https://tresvalles-news-bot.<tu-subdomain>.workers.dev/run
 */

// Fuentes RSS que cubren Veracruz, ordenadas por relevancia para Tres Valles
const RSS_SOURCES = [
    // Google News búsqueda específica · LA MEJOR fuente (agrega muchos medios)
    {
        url: 'https://news.google.com/rss/search?q=%22Tres+Valles%22+Veracruz&hl=es-MX&gl=MX&ceid=MX:es-419',
        name: 'Google News',
    },
    {
        url: 'https://news.google.com/rss/search?q=%22Tres+Valles%22+Papaloapan&hl=es-MX&gl=MX&ceid=MX:es-419',
        name: 'Google News',
    },
    {
        url: 'https://news.google.com/rss/search?q=Tres+Valles+Veracruz+caña&hl=es-MX&gl=MX&ceid=MX:es-419',
        name: 'Google News',
    },
    // Periódicos regionales de Veracruz con RSS público
    {
        url: 'https://www.alcalorpolitico.com/informacion/rss.xml',
        name: 'Al Calor Político',
    },
    {
        url: 'https://imagendelgolfo.mx/feed',
        name: 'Imagen del Golfo',
    },
    {
        url: 'https://www.eldictamen.mx/feed/',
        name: 'El Dictamen',
    },
    {
        url: 'https://formato7.com/feed/',
        name: 'Formato 7',
    },
];

export default {
    /** Manual trigger via HTTP (útil para testing) */
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (url.pathname === '/run') {
            const result = await runJob(env);
            return new Response(JSON.stringify(result, null, 2), {
                headers: { 'content-type': 'application/json' },
            });
        }
        return new Response(
            '🤖 Tres Valles News Bot · POST /run para ejecutar manualmente. ' +
            'Programado para correr cada hora vía cron.',
            { headers: { 'content-type': 'text/plain; charset=utf-8' } },
        );
    },

    /** Cron trigger automático */
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runJob(env));
    },
};

async function runJob(env) {
    const positiveCtx = env.POSITIVE_CONTEXT.split(',').map(s => s.trim().toLowerCase());
    const negativeKw = env.NEGATIVE_KEYWORDS.split(',').map(s => s.trim().toLowerCase());
    const strictKw = env.STRICT_KEYWORDS.split(',').map(s => s.trim().toLowerCase());

    const stats = { fetched: 0, matched: 0, inserted: 0, skipped: 0, errors: [] };
    const items = [];

    // 1) Fetch todos los RSS en paralelo
    const fetches = RSS_SOURCES.map(async src => {
        try {
            const res = await fetch(src.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; TresVallesNewsBot/1.0; +https://tresvalles.pages.dev)',
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                },
                cf: { cacheTtl: 60, cacheEverything: false },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const xml = await res.text();
            const parsed = parseRss(xml);
            stats.fetched += parsed.length;
            for (const it of parsed) {
                it._source = src.name;
                items.push(it);
            }
        } catch (e) {
            stats.errors.push(`${src.name}: ${e.message}`);
        }
    });
    await Promise.all(fetches);

    // 2) Filtrar ESTRICTAMENTE
    const candidates = [];
    for (const it of items) {
        const haystack = `${it.title} ${it.description} ${it.content}`.toLowerCase();

        // Debe contener al menos una keyword estricta ("tres valles")
        const hasStrict = strictKw.some(k => haystack.includes(k));
        if (!hasStrict) continue;

        // Si tiene keyword negativa, descartar (evita Rioja, Chile, etc.)
        const hasNegative = negativeKw.some(k => haystack.includes(k));
        if (hasNegative) {
            // Solo descarto si NO hay contexto positivo que lo salve
            const hasPositive = positiveCtx.some(k => haystack.includes(k));
            if (!hasPositive) continue;
        }

        // Bonus: si menciona contexto positivo (Veracruz, Papaloapan…), prioridad alta
        const hasContext = positiveCtx.some(k => haystack.includes(k));
        if (!hasContext && hasNegative) continue;

        candidates.push(it);
    }
    stats.matched = candidates.length;

    // 3) Insertar en Supabase vía RPC bot_insert_news (que hace dedup por source_url)
    for (const it of candidates) {
        try {
            const content = buildThreadContent(it);
            const insertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/bot_insert_news`, {
                method: 'POST',
                headers: {
                    'apikey': env.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    p_secret: env.BOT_SECRET,
                    p_content: content,
                    p_source_url: it.link,
                    p_source_name: it._source,
                    p_source_image: it.image || '',
                }),
            });
            if (!insertRes.ok) {
                const txt = await insertRes.text();
                stats.errors.push(`insert ${it.link}: ${insertRes.status} ${txt.slice(0, 100)}`);
                continue;
            }
            const result = await insertRes.json();
            if (result === null) {
                stats.skipped++; // ya existía
            } else {
                stats.inserted++;
            }
        } catch (e) {
            stats.errors.push(`insert ${it.link}: ${e.message}`);
        }
    }

    return stats;
}

/** Construye el contenido del hilo en formato markdown ligero */
function buildThreadContent(item) {
    const title = (item.title || '').trim();
    const desc = (item.description || '').trim()
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400);
    const src = item._source ? ` · ${item._source}` : '';
    const dateStr = item.pubDate ? new Date(item.pubDate).toLocaleString('es-MX') : '';
    return `📰 **${title}**\n\n${desc}${desc ? '\n\n' : ''}🔗 ${item.link}${src}${dateStr ? ` · ${dateStr}` : ''}`;
}

/** Parser RSS / Atom minimalista. Devuelve array de items normalizados. */
function parseRss(xml) {
    const items = [];
    // Soporta tanto <item> (RSS) como <entry> (Atom)
    const itemRe = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = itemRe.exec(xml)) !== null) {
        const block = m[2];
        const title       = extractTag(block, 'title');
        const link        = extractLink(block);
        const description = extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content');
        const pubDate     = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
        const content     = extractTag(block, 'content:encoded') || extractTag(block, 'content') || '';
        const image       = extractImage(block);
        if (title && link) {
            items.push({
                title: cleanText(title),
                link: cleanLink(link),
                description: description || '',
                content,
                pubDate,
                image,
            });
        }
    }
    return items;
}

function extractTag(block, tag) {
    // Soporta CDATA, self-closing y atributos
    const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
    const m = block.match(re);
    return m ? m[1].trim() : '';
}

function extractLink(block) {
    // RSS: <link>URL</link>
    let m = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    if (m && m[1].trim()) return m[1].trim();
    // Atom: <link href="..."/>
    m = block.match(/<link[^>]+href=["']([^"']+)["']/i);
    if (m) return m[1].trim();
    return '';
}

function extractImage(block) {
    // <enclosure url="..." type="image/..."/>
    let m = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\//i);
    if (m) return m[1];
    // <media:content url="..."/>
    m = block.match(/<media:content[^>]+url=["']([^"']+)["']/i);
    if (m) return m[1];
    // <media:thumbnail url="..."/>
    m = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
    if (m) return m[1];
    // <img src="..."/> dentro del description/content
    m = block.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m) return m[1];
    return '';
}

function cleanText(s) {
    return s
        .replace(/<!\[CDATA\[/g, '')
        .replace(/\]\]>/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

function cleanLink(s) {
    return s
        .replace(/<!\[CDATA\[/g, '')
        .replace(/\]\]>/g, '')
        .trim();
}
