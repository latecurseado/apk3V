# Tres Valles Push Sender

Cloudflare Worker que envía notificaciones push (Web Push VAPID) a los
usuarios cuando reciben una `notification` nueva en Supabase.

## Setup (10 min · una sola vez)

### 1. Generar VAPID keys

```bash
npx web-push generate-vapid-keys
```

Te dará:
```
Public Key:  BPaste...87chars
Private Key: pegaaqui...43chars
```

### 2. Frontend — clave pública

Edita `astro-poc/src/lib/push.ts` y reemplaza:
```ts
const VAPID_PUBLIC_KEY = 'BPaste...87chars';  // ← la pública
```

O mejor, en `astro-poc/.env`:
```
PUBLIC_VAPID_KEY=BPaste...87chars
```

### 3. Supabase — añadir columna pushed_at

Re-ejecuta `supabase-all.sql` (ya incluye el `ALTER TABLE notifications`).

### 4. Worker — secrets

```bash
cd push-sender
wrangler login
wrangler secret put SUPABASE_SERVICE_KEY   # service_role key (Settings → API)
wrangler secret put VAPID_PUBLIC_KEY       # la misma del frontend
wrangler secret put VAPID_PRIVATE_KEY      # privada de paso 1
```

### 5. Deploy

```bash
wrangler deploy
```

## Cómo funciona

```
Cada minuto (cron * * * * *):
  1. Lee notifications con pushed_at IS NULL de los últimos 5 min
  2. Para cada notif, busca push_subscriptions del recipient_id
  3. Encripta payload (AES128GCM, RFC 8291)
  4. Firma JWT VAPID (ES256)
  5. POST al endpoint (FCM/Mozilla/Apple)
  6. Marca pushed_at=now() en la notif
  7. Si endpoint da 410/404 → borra esa suscripción
```

## Test manual

```bash
curl https://tresvalles-push-sender.<TU-SUBDOMAIN>.workers.dev/run
```

Devuelve:
```json
{
  "fetched": 3,
  "sent": 5,
  "failed": 0,
  "dropped": 0,
  "errors": []
}
```

## Probar el flujo completo

1. Loguéate en el portal en un dispositivo
2. Activa push (banner en feed o Settings → Notificaciones push)
3. Desde OTRO dispositivo/cuenta, dale like a tu hilo / coméntalo / mándate DM
4. Espera ≤1 min · debe llegar la notificación

## Costos

- Cloudflare Workers: gratis (cron ilimitados, 100k req/día)
- Supabase: parte del free tier normal
- Web Push: gratis (FCM/Mozilla/Apple son free)

## Troubleshooting

**No llegan notificaciones**:
- Comprueba que el frontend muestra "Notificaciones activadas" en Settings
- Revisa logs: `wrangler tail`
- Comprueba que `pushed_at` se está marcando:
  `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;`
- Si `pushed_at IS NOT NULL` y aún no llega: revisa el endpoint en
  `push_subscriptions` y si el navegador tiene permiso activo

**Error "VAPID_PUBLIC_KEY debe ser 65 bytes"**:
- La pública debe empezar con `0x04` y ser uncompressed P-256 (65 bytes raw,
  87 chars en base64url). Re-genera con `npx web-push generate-vapid-keys`.

**Error 401 / 403 en el endpoint**:
- JWT mal firmado · verifica que las VAPID keys son del MISMO par
- `VAPID_SUBJECT` debe ser `mailto:tu@email.com` (con `mailto:`)
