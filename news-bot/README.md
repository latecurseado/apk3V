# Tres Valles News Bot

Cloudflare Worker que **busca noticias de Tres Valles, Veracruz** en RSS
públicos cada hora y las publica automáticamente como hilos del usuario
`noticias_bot` en el foro `#noticias` de Supabase.

**Sin login a Facebook. Sin scraping. Sin auth de terceros. 100% legal y gratis.**

## Cómo funciona

```
cron 7 * * * *  (cada hora en el minuto 7)
        │
        ▼
fetch 7 RSS feeds en paralelo
  · Google News (3 queries específicas)
  · Al Calor Político
  · Imagen del Golfo
  · El Dictamen
  · Formato 7
        │
        ▼
filtro ESTRICTO:
  · contiene "Tres Valles"
  · NO contiene "Rioja, España, Chile, Argentina…"
  · prefiere contexto "Veracruz, Papaloapan, Cuenca"
        │
        ▼
Supabase RPC bot_insert_news()
  · dedup por source_url (no duplica notas)
  · inserta en foro #noticias como autor noticias_bot
```

## Despliegue (5 minutos)

### 1. Instalar Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. Configurar Supabase (UNA sola vez)

Antes de desplegar el Worker, ejecuta este SQL en Supabase como **owner**:

```sql
-- Genera un secreto largo y aleatorio (cópialo, lo necesitarás para el Worker)
SELECT public.set_bot_secret('PEGA-AQUI-UN-STRING-DE-32+-CARACTERES-RANDOM');
```

Para generar uno fácil:
- `openssl rand -hex 32` en terminal
- O usa <https://www.random.org/strings/?num=1&len=32&digits=on&upperalpha=on&loweralpha=on>

### 3. Configurar secretos del Worker

```bash
cd news-bot

# La anon key de tu proyecto Supabase (Settings → API → anon public)
wrangler secret put SUPABASE_ANON_KEY
# Pega cuando lo pida.

# El MISMO secreto que pusiste en set_bot_secret()
wrangler secret put BOT_SECRET
# Pega cuando lo pida.
```

### 4. Desplegar

```bash
wrangler deploy
```

Listo. Ya corre cada hora automáticamente.

## Probar manualmente

```bash
# Forzar ejecución ahora mismo (devuelve JSON con stats)
curl https://tresvalles-news-bot.<TU-SUBDOMAIN>.workers.dev/run
```

Respuesta esperada:

```json
{
  "fetched": 87,
  "matched": 3,
  "inserted": 2,
  "skipped": 1,
  "errors": []
}
```

- `fetched`: items totales descargados de los RSS
- `matched`: cumplieron el filtro estricto de "Tres Valles"
- `inserted`: nuevos hilos creados
- `skipped`: ya existían (dedup funcionando)
- `errors`: lista de errores por fuente

## Ajustar los filtros

Edita `wrangler.toml`:

```toml
[vars]
STRICT_KEYWORDS = "Tres Valles,tres valles,..."
NEGATIVE_KEYWORDS = "Rioja,España,Chile,..."     # falsos positivos a excluir
POSITIVE_CONTEXT = "Veracruz,Papaloapan,..."     # señales de que sí es nuestro Tres Valles
```

Luego: `wrangler deploy`.

## Añadir más fuentes RSS

Edita `worker.js`, sección `RSS_SOURCES`:

```js
const RSS_SOURCES = [
    // ...existentes...
    { url: 'https://nuevomedio.com/feed/', name: 'Nuevo Medio' },
];
```

Tips:
- **Google News con query custom** es la mejor fuente (agrega muchos medios).
  URL pattern:
  `https://news.google.com/rss/search?q=TU+QUERY&hl=es-MX&gl=MX&ceid=MX:es-419`
- **Verifica que el feed funciona** abriéndolo en el navegador antes de añadir.
- **Evita feeds con autenticación o tokens** (no son automatizables).

## Logs y monitoreo

```bash
# Ver logs en vivo del Worker
wrangler tail
```

O en el dashboard de Cloudflare: Workers → tresvalles-news-bot → Logs.

## Costos

- **Cloudflare Workers**: hasta 100k req/día gratis. Este Worker corre 24
  req/día por el cron + algún test manual = nada de costo.
- **Cloudflare cron triggers**: ilimitados gratis.
- **Supabase**: la inserción usa la free tier normal del proyecto.

## Borrar todas las noticias del bot (cleanup)

```sql
DELETE FROM threads WHERE is_bot = true AND author_id = '00000000-0000-0000-0000-000000000001';
```

## Cambiar al usuario bot

Si quieres editar el avatar/bio del bot, hazlo desde el SQL editor:

```sql
UPDATE profiles
SET pfp = 'https://...nueva-imagen.png',
    bio = 'Nueva descripción del bot'
WHERE username = 'noticias_bot';
```

## Privacidad y términos de uso

- Los RSS que consume son **públicos** y diseñados para ser leídos por bots.
- El User-Agent identifica al bot honestamente: `TresVallesNewsBot/1.0`.
- Respeta los `cacheTtl` y no abusa de las fuentes (1 hit/hora por fuente).
- Cuando inserta un hilo, **siempre incluye link a la fuente original** —
  manda tráfico de vuelta al medio.
