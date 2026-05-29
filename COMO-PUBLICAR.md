# Cómo poner Tres Valles en internet desde tu PC

Esta guía te lleva de cero a una URL pública (`https://algo.trycloudflare.com`)
que cualquiera puede abrir desde fuera. **Gratis, sin abrir puertos del router,
con HTTPS automático y tu IP real oculta.**

---

## Paso 1 — Instalar Python (una sola vez)

Necesitas un servidor HTTP local. La forma más fácil en Windows:

1. Abre PowerShell o CMD y escribe:
   ```
   python
   ```
2. Te abrirá la **Microsoft Store** automáticamente. Pulsa "Obtener" / "Instalar".
3. Cuando termine, cierra la Store y abre una **terminal nueva**. Verifica:
   ```
   python --version
   ```
   Debe imprimir algo como `Python 3.12.x`.

> Alternativa: descargar de https://www.python.org/downloads/ y marcar
> *"Add Python to PATH"* durante la instalación.

---

## Paso 2 — Descargar `cloudflared` (una sola vez)

Es un único `.exe`, no instala nada en tu sistema.

1. Abre: https://github.com/cloudflare/cloudflared/releases/latest
2. Descarga el archivo **`cloudflared-windows-amd64.exe`**.
3. Renómbralo a **`cloudflared.exe`**.
4. Cópialo dentro de esta carpeta (junto a `launch-public.bat`):
   ```
   C:\Users\USER\Desktop\pagina\cloudflared.exe
   ```

> ¿Por qué Cloudflare Tunnel y no abrir puertos del router?
> - No expone tu IP real (Cloudflare hace de proxy).
> - HTTPS automático.
> - No tienes que tocar la configuración del router.
> - Protección DDoS gratuita.
> - La URL gratuita cambia cada vez (para una URL fija, registra un dominio
>   y enlázalo, pero eso es opcional).

---

## Paso 3 — Lanzar todo (cada vez que quieras estar en línea)

**Opción A — un solo clic:**
Doble clic en `launch-public.bat`. Se abrirán dos ventanas:
- **Tres Valles - Servidor**: el servidor local (no la cierres)
- **Tres Valles - Tunel publico**: muestra la URL pública

**Opción B — paso a paso (si Opción A falla):**
Abre dos PowerShell separadas en esta carpeta:
```powershell
# Ventana 1
.\start-server.bat

# Ventana 2 (cuando la primera ya esté escuchando)
.\start-tunnel.bat
```

En la ventana del túnel verás algo así:

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://random-words-1234.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

Esa es **tu URL pública**. Cópiala y compártela.

---

## Paso 4 — Apagar

- Cierra la ventana del túnel → la URL pública deja de funcionar (la próxima
  vez que arranques tendrás una URL distinta porque es modo "quick tunnel").
- Cierra la ventana del servidor → tu PC deja de servir nada.
- O simplemente pulsa **Ctrl+C** en cada ventana.

---

## Recordatorio de seguridad

Aunque ya cerramos los hallazgos críticos (XSS, contraseñas, paleta), ten en cuenta:

- **Tus datos viven en `localStorage` del navegador del visitante**, no en tu PC.
  Cada visitante tiene su propia "base de datos" — no hay datos compartidos.
- **No subas archivos sensibles** a esta carpeta. Cloudflare sirve todo lo que
  haya en `src/`. Cualquiera con la URL puede leerlos.
- **Si el túnel se queda abierto 24/7**, considera migrar a un dominio propio
  con autenticación (Cloudflare Access). El "quick tunnel" gratuito está
  pensado para demos, no para producción permanente.
- El sitio actual no tiene backend (todo es JavaScript del lado del cliente),
  así que el riesgo en tu PC es mínimo: solo se sirven archivos estáticos.

---

## Si quieres una URL fija (opcional)

1. Crea cuenta gratuita en https://dash.cloudflare.com/ y registra un dominio
   (o usa uno que ya tengas).
2. Ejecuta:
   ```
   cloudflared tunnel login
   cloudflared tunnel create tresvalles
   cloudflared tunnel route dns tresvalles tresvalles.tudominio.com
   ```
3. Crea `~/.cloudflared/config.yml` apuntando al puerto 8000.
4. Ejecuta `cloudflared tunnel run tresvalles` en lugar de `start-tunnel.bat`.

Detalles: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

---

## Troubleshooting

| Problema | Solución |
|---|---|
| "python no se reconoce" | Cierra y abre la terminal de nuevo después de instalar; o reinicia el PC. |
| "cloudflared no se reconoce" | Asegúrate que `cloudflared.exe` está en la carpeta del proyecto. |
| URL del túnel no carga | Espera 30 segundos tras arrancar (Cloudflare propaga el túnel). |
| Service Worker no se registra | Solo funciona en `https://` o `localhost:` — desde la URL del túnel debería ir bien (es HTTPS). |
| Puerto 8000 ocupado | Edita `start-server.bat` y `start-tunnel.bat`, cambia 8000 por otro puerto (8080, 3000, etc.). |
