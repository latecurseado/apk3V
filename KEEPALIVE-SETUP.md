# 🟢 Mantener Supabase siempre activa — Setup paso a paso

**Tiempo:** 10 minutos.
**Costo:** $0. Totalmente dentro del plan gratis de Cloudflare Workers.

---

## ¿Por qué necesitas esto?

Supabase plan **Free** pausa los proyectos sin actividad después de **7 días**. Tus datos NO se pierden, pero el proyecto queda dormido y los usuarios verían errores hasta que lo reactives manualmente.

Este Worker hace una consulta mínima a Supabase **una vez al día**. Eso cuenta como actividad y mantiene tu proyecto siempre activo.

---

## Paso 1 — Entrar al dashboard de Cloudflare

1. Abre **https://dash.cloudflare.com**
2. Login con tu cuenta (la misma que usas para Cloudflare Pages).

---

## Paso 2 — Crear el Worker

1. Menú lateral → **Workers & Pages**.
2. Click el botón azul **"Create"** (arriba a la derecha).
3. Verás dos pestañas: **"Pages"** y **"Workers"**.
4. Click en **"Workers"** → botón **"Create Worker"**.
5. Te muestra un campo para nombrar el Worker:
   - **Worker name**: `tresvalles-keepalive` (todo minúsculas, sin espacios).
6. Abajo verás un botón **"Deploy"**. Click.
7. Cloudflare crea un Worker básico de prueba.
8. Te muestra una URL del estilo:
   ```
   https://tresvalles-keepalive.tu-cuenta.workers.dev
   ```
   Guárdala — luego la usaremos para verificar.

---

## Paso 3 — Pegar el código del Worker

1. En la página del Worker recién creado, click **"Edit code"** (botón superior derecho).
2. Te abre un editor de código tipo VS Code en el navegador.
3. **Borra todo** el código de ejemplo que viene por defecto.
4. Abre el archivo [cloudflare-keepalive-worker.js](cloudflare-keepalive-worker.js) en tu PC con Bloc de notas.
5. **Copia todo** el contenido (Ctrl+A, Ctrl+C).
6. **Pega** en el editor de Cloudflare (Ctrl+V).
7. Arriba a la derecha, click **"Save and deploy"** (o **"Deploy"**).
8. Confirma con **"Save and deploy"** otra vez.

✅ El Worker ya está vivo. Pero todavía no se ejecuta solo — falta el cron.

---

## Paso 4 — Verificar que el Worker funciona

Antes de configurar el cron, verifica que la consulta a Supabase funciona:

1. Copia la URL de tu Worker (la del paso 2.8).
2. Pégala en una pestaña nueva del navegador.
3. Deberías ver una respuesta JSON parecida a:
   ```json
   {
       "timestamp": "2026-04-27T20:15:00.000Z",
       "ok": true,
       "status": 200,
       "preview": "[{\"id\":\"laretro\"}]"
   }
   ```
4. **Si `ok` es `true` y `status` es `200`** → el Worker conecta a Supabase correctamente.
5. **Si sale error** → mándame la respuesta JSON entera y arreglamos.

---

## Paso 5 — Configurar el cron trigger (lo más importante)

Aquí le decimos a Cloudflare que ejecute el Worker automáticamente cada día.

1. Vuelve a la página principal del Worker (no del editor).
2. En la barra de pestañas: **Settings** → **Triggers**.
   (En algunas versiones de Cloudflare aparece como pestaña directa: **"Triggers"**.)
3. Baja hasta la sección **"Cron Triggers"**.
4. Click en **"Add Cron Trigger"**.
5. Te abre un campo donde poner una expresión cron. Pon exactamente:
   ```
   0 13 * * *
   ```
   Esto significa: **todos los días a las 13:00 UTC** (= 7am hora de México).
6. Click **"Add Trigger"** o **"Save"**.
7. ¡Listo! El Worker se ejecutará automáticamente cada mañana.

> **¿Por qué cada día y no cada hora?** Porque Supabase pausa después de **7 días sin actividad**. Una vez al día sobra y deja margen. Hacerlo más seguido gastaría invocaciones del Worker innecesariamente (aunque tienes 100,000 al día gratis, así que tampoco es un problema).

---

## Paso 6 — Comprobar que el cron está activo

1. Vuelve a Workers & Pages → tu Worker → pestaña **Triggers**.
2. Debes ver:
   ```
   Cron Triggers
     0 13 * * *      Active
   ```
3. La pestaña **"Logs"** o **"Logs & analytics"** muestra cada ejecución pasada del Worker.

---

## ✅ Verificación final mañana

Mañana después de las 7am hora México:
1. Vuelve al Worker en Cloudflare.
2. Pestaña **Logs**.
3. Deberías ver una entrada `OK 200` con timestamp aproximado a las 13:00 UTC.

Si la ves → **¡tu BD ya nunca se va a dormir!** Olvídate del tema.

---

## Solución de problemas

### "Status 401 Unauthorized" al verificar

**Causa**: la `SUPABASE_KEY` del Worker está mal o no es la publishable.

**Solución**:
1. Verifica que la key del archivo `cloudflare-keepalive-worker.js` empieza por `sb_publishable_`.
2. Si es la legacy `eyJ...`, también funciona pero asegúrate que es la **anon public** (no la service_role).

### "Status 404" al verificar

**Causa**: la tabla `outlets` no existe en tu Supabase.

**Solución**: ejecutaste el `supabase-schema.sql` en Update inicial. Verifica que exista esa tabla en Table Editor. Si no, vuelve a ejecutarlo.

### Cron Triggers no aparece en Settings

**Causa**: tienes el plan más viejo de Cloudflare Workers que no incluía cron en free.

**Solución**: en 2024 Cloudflare añadió cron al plan free. Si no te aparece, prueba a renovar la pestaña o entra a través de **"Workers & Pages"** → tu Worker → **"Settings"** → **"Triggers"**.

---

## Bonus — Monitoreo extra (opcional)

Si quieres una capa más de seguridad, también puedes:

1. Crear cuenta gratis en **https://uptimerobot.com**.
2. Añadir un monitor HTTP a tu URL `https://tresvalles.pages.dev` cada **5 minutos**.
3. Si tu sitio cae, te llega email automático.

Eso no mantiene la BD activa (eso lo hace el Worker), pero te avisa si Cloudflare Pages tiene downtime.

---

## Resumen

```
1. Cloudflare → Workers & Pages → Create Worker → "tresvalles-keepalive"
2. Pega el código de cloudflare-keepalive-worker.js
3. Save and Deploy
4. Settings → Triggers → Add Cron Trigger: "0 13 * * *"
5. Listo, BD siempre activa.
```

Costo: $0. Mantenimiento: 0.
