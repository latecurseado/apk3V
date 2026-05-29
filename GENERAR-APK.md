# 📱 Generar APK de Tres Valles — Guía completa

**Tiempo total:** ~10 minutos.
**Dificultad:** baja, todo desde el navegador. No necesitas instalar nada.
**Resultado:** un archivo `.apk` que se instala en cualquier Android desde 6.0 (Marshmallow, 2015) en adelante.

---

## 📋 Antes de empezar — Checklist

Necesitas tener:

- [x] Tu sitio publicado en Cloudflare Pages, con el ZIP nuevo subido (versión `tv-v18`).
- [x] Tu URL pública funcionando: **https://tresvalles.pages.dev**
- [x] Una cuenta de email donde recibir notificaciones.
- [x] Un dispositivo Android (físico) o un PC con cable USB para mandarlo.
- [x] (Opcional) Cuenta gratuita de PWABuilder (acelera futuras builds, no es obligatorio).

> ⚠️ **No necesitas Google Play Developer Account** ($25 USD). Eso solo lo necesitas si quieres publicar en Play Store. Para instalar el APK directamente desde un archivo, basta con generarlo.

---

## 🌐 PARTE 1 — Generar el APK con PWABuilder

### Paso 1.1 — Abrir PWABuilder

1. Abre Chrome, Edge, o Brave (mejor Chrome para esto).
2. En la barra de direcciones, escribe:
   ```
   https://www.pwabuilder.com
   ```
3. Pulsa Enter.
4. Verás una página azul/morada con el texto **"PWA Builder"** y una caja blanca grande en el centro que dice **"Enter your URL"**.

### Paso 1.2 — Pegar tu URL

1. Click dentro de la caja blanca.
2. Escribe o pega:
   ```
   https://tresvalles.pages.dev
   ```
3. Pulsa Enter, o el botón **"Start"** que está al lado.

### Paso 1.3 — Esperar el análisis

PWABuilder ahora analiza tu sitio durante ~30 segundos. En la pantalla verás:
- Un loader circular.
- Texto cambiante: "Analyzing your PWA…", "Checking manifest…", "Verifying service worker…".

Cuando termine, te lleva a una **página de resultados** con tres tarjetas grandes en horizontal.

### Paso 1.4 — Verificar la auditoría

Las tres tarjetas que ves son:

| Tarjeta | Lo que verifica | Lo que debe salir |
|---|---|---|
| **Manifest** | Nombre, iconos, colores | ✅ Verde · puntuación alta (90+) |
| **Service Worker** | Cache, offline | ✅ Verde · "Has Service Worker" |
| **Security** | HTTPS válido | ✅ Verde · "Hosted on HTTPS" |

**Si alguna sale en amarillo o rojo:**
- Click en la tarjeta para ver detalles.
- Toma captura de pantalla.
- Pásamela aquí en el chat y lo arreglo en 5 minutos.

**Si todas salen en verde:** ¡seguimos al paso 2!

### Paso 1.5 — "Package For Stores"

1. En la **esquina superior derecha** de la página de resultados verás un botón con texto:
   ```
   Package For Stores
   ```
   o solo un icono de caja con flecha.
2. Click.
3. Te lleva a una nueva página titulada **"Package your PWA"** con varias tarjetas grandes:
   - **Android** (logo verde de Android)
   - **iOS** (manzana)
   - **Windows** (ventana)
   - **Meta Quest** (auriculares VR)

### Paso 1.6 — Seleccionar Android

1. Click en la tarjeta **Android** (la verde, debería ser la primera).
2. Verás un texto explicativo: *"Generate an Android package for your PWA"*.
3. Abajo hay un botón **"Generate Package"** (o **"Configure"**). Click.

### Paso 1.7 — Rellenar el formulario

Ahora te aparece un formulario grande con muchos campos. Rellénalos exactamente así:

#### Sección "Package Information"

| Campo | Qué poner |
|---|---|
| **Package ID** | `com.tresvalles.portal` |
| **App name** | `Tres Valles` |
| **Launcher name** | `Tres Valles` (o déjalo igual al App name) |
| **App version** | `1.0.0` |
| **App version code** | `1` |
| **Host** | `tresvalles.pages.dev` (sin https://) |
| **Start URL** | `/` |

> **Sobre el Package ID**: debe ser único globalmente (estilo dominio invertido). `com.tresvalles.portal` es el correcto. **NO** uses guiones ni mayúsculas. Una vez generes el APK, este ID **no se puede cambiar** sin crear una app totalmente distinta.

#### Sección "Display"

| Campo | Qué poner |
|---|---|
| **Display mode** | `Standalone` (default) |
| **Orientation** | `Default` o `Portrait` |
| **Theme color** | `#00d2ff` |
| **Background color** | `#0a0a0c` |
| **Status bar color** | `#0a0a0c` |
| **Navigation bar color** | `#0a0a0c` |
| **Navigation bar dividers color** | `#0a0a0c` |
| **Navigation bar light color** | `#FFFFFF` |

#### Sección "Splash screen"

- **Splash background color**: `#0a0a0c`
- **Splash text color** (si aparece): `#00d2ff`

#### Sección "Icon"

- Lo más probable es que ya esté tomado de tu manifest. Si te pide una URL del icono manualmente, pon:
  ```
  https://tresvalles.pages.dev/main/icons/icon-512.png
  ```
- Marca la casilla **"Use maskable icon"** si aparece.

#### Sección "Signing key" (¡importante!)

Aquí PWABuilder te ofrece dos opciones:

##### Opción A: "Generate new signing key" (recomendado para primera vez)

- Selecciona **"Generate new signing key"**.
- Si te pide datos de la clave, rellena:
  - **Key alias**: `tresvalles`
  - **Key password**: una contraseña fuerte que recuerdes — **GUÁRDALA**.
  - **Keystore password**: otra contraseña fuerte — **GUÁRDALA**.
  - **Country code**: `MX`
  - **Organization**: `Tres Valles Portal`

> ⚠️ **CRÍTICO**: Estos datos + el archivo `.keystore` que descargarás son **tu identidad de desarrollador para esta app**. Si los pierdes, **no podrás actualizar la app NUNCA** sin que Android la trate como una app totalmente distinta. Cópialos a:
> 1. Tu Google Drive personal (carpeta privada).
> 2. Un USB.
> 3. Un password manager (Bitwarden, 1Password, etc.).

##### Opción B: "Use existing signing key" (solo si ya tienes una)

- Solo si has generado una versión anterior y ya tienes el `.keystore`.

### Paso 1.8 — Generar el paquete

1. Click en el botón grande **"Generate"** (o **"Package"**, abajo del todo).
2. Verás un loader. **No cierres la pestaña.** Tarda 1-3 minutos.
3. Cuando termine, te aparece un mensaje:
   ```
   ✅ Your Android package is ready!
   ```
   con un botón **"Download"**.
4. Click en **"Download"**.
5. Tu navegador descarga un archivo ZIP, normalmente llamado:
   ```
   PWABuilder.zip
   ```
   o
   ```
   tres-valles.zip
   ```
6. **Guárdalo en una carpeta que recuerdes**, por ejemplo `C:\Users\USER\Desktop\tres-valles-android\`.

---

## 📦 PARTE 2 — Inspeccionar el ZIP descargado

### Paso 2.1 — Descomprimir

1. Click derecho en el ZIP descargado → **"Extraer todo…"** → elige carpeta destino.
2. Dentro encontrarás algo así:
   ```
   tres-valles-android/
   ├── app-release-signed.apk     ← LO QUE TE INTERESA
   ├── app-release-bundle.aab     ← Para Play Store (opcional)
   ├── signing.keystore           ← LA CLAVE — guárdala segura
   ├── signing-key-info.txt       ← Datos de la clave
   ├── README.md                  ← Instrucciones de Google
   └── ... (otros archivos auxiliares)
   ```

### Paso 2.2 — Asegurar la clave de firma

1. Copia los archivos `signing.keystore` y `signing-key-info.txt` a:
   - **Tu Google Drive** (carpeta privada).
   - O **un USB** que guardes en cajón.
   - O **iCloud / OneDrive**.
2. Estos archivos son tu identidad. **NO los borres ni se los des a nadie**.

### Paso 2.3 — Identificar el APK

El archivo que vas a instalar en el móvil es:
```
app-release-signed.apk
```

Tamaño aproximado: 2-5 MB. (El sitio web es pequeño, el wrapper TWA pesa poco).

---

## 📲 PARTE 3 — Instalar el APK en tu Android

Tienes 4 formas de pasarlo. Elige la más cómoda.

### Método 1: Cable USB (más rápido si tienes cable)

1. Conecta el móvil al PC con un cable USB.
2. En el móvil, desbloquea la pantalla.
3. Aparece notificación: *"Cargando dispositivo USB"* — toca y selecciona **"Transferir archivos"** (MTP).
4. En el PC, abre el explorador → tu móvil aparece como dispositivo nuevo.
5. Entra a la carpeta **"Download"** del móvil.
6. Pega el archivo `app-release-signed.apk` ahí.
7. Desconecta el USB.
8. En el móvil, abre la app **"Mis archivos"** o **"Files"** o **"Explorador"**.
9. Ve a Descargas → toca `app-release-signed.apk`.
10. Salta al **Paso 3.5**.

### Método 2: Google Drive

1. En el PC, sube `app-release-signed.apk` a tu Google Drive.
2. En el móvil, abre la app de Drive.
3. Localiza el archivo → toca para descargar.
4. Una vez descargado, Drive te pregunta si abrirlo. Toca **"Abrir"** o ve a Descargas y abre desde ahí.
5. Salta al **Paso 3.5**.

### Método 3: Email (a tí mismo)

1. En el PC, escribe un email a tu propia dirección.
2. Adjunta `app-release-signed.apk`.
3. Manda.
4. En el móvil, abre el email → toca el adjunto → descargar.
5. Una vez descargado, ábrelo.
6. Salta al **Paso 3.5**.

### Método 4: WhatsApp Web → tú mismo

1. En el PC, abre WhatsApp Web.
2. Abre el chat con **tu propio número** (o un familiar).
3. Adjunta `app-release-signed.apk` como **documento**.
4. Manda.
5. En el móvil, recibe el archivo → descarga → abre.
6. Salta al **Paso 3.5**.

### Paso 3.5 — Permitir instalar desde fuente desconocida

La primera vez que abras un APK fuera de Play Store, Android te dirá algo como:

> *"Por seguridad, tu teléfono no permite instalar aplicaciones desconocidas desde esta fuente."*

Solución:
1. Toca el botón **"Configuración"** o **"Ajustes"** que aparece al lado del aviso.
2. Te lleva a una pantalla con un toggle: *"Permitir desde esta fuente"* o *"Instalar apps desconocidas"*.
3. **Activa el toggle.**
4. Vuelve atrás (botón ←).
5. La instalación continúa.

> ⚠️ **Recuerda desactivar el toggle después** si no quieres que esa app (Drive, Files, WhatsApp, lo que usaste) pueda instalar otros APK en el futuro. Es una buena práctica de seguridad.

### Paso 3.6 — Instalar

1. Verás una pantalla titulada **"¿Quieres instalar esta aplicación?"** con el icono de Tres Valles.
2. Abajo dice *"Esta aplicación no necesita acceso especial"* o lista los permisos que pide.
3. Toca **"Instalar"**.
4. Espera ~5 segundos.
5. Aparece **"Aplicación instalada"** con dos botones:
   - **"Listo"** — vuelve atrás.
   - **"Abrir"** — abre la app.
6. Toca **"Abrir"** para probarla.

---

## ✅ PARTE 4 — Verificar que funciona

Al abrir Tres Valles desde el icono en tu launcher:

- [x] Se abre **a pantalla completa**, sin barra de Chrome arriba.
- [x] Ves el **splash screen** (pantalla negra con la "T" cyan-rosa) durante 1-2 segundos.
- [x] Carga el sitio con **todos los estilos**: navbar, sidebar, fondo oscuro, gradients.
- [x] Puedes hacer **login** con tu cuenta. Funciona igual que en Chrome.
- [x] Las **publicaciones aparecen** del muro real (Supabase).
- [x] El **bottom nav bar** está abajo con los 5 iconos.
- [x] **Compartir desde Facebook**: abre la app de Facebook → comparte un post → en el menú compartir debe aparecer "Tres Valles" como destino.

---

## 🐛 Troubleshooting

### "App not installed" / "No se pudo instalar"

**Causa**: ya tenías una versión anterior con clave distinta.

**Solución**:
1. Mantén pulsado el icono de Tres Valles → **Desinstalar**.
2. Vuelve a abrir el `.apk` → instalar.

### "Tu URL no es válida" o "Could not detect manifest"

**Causa**: PWABuilder no carga `https://tresvalles.pages.dev/manifest.json`.

**Solución**:
1. Verifica desde el navegador que esa URL responde.
2. Si no, vuelve a hacer deploy en Cloudflare Pages del último ZIP.

### App se abre pero queda en blanco

**Causa**: el service worker está cacheando una versión rota.

**Solución dentro de la app**:
1. Mantén pulsado el icono → **Configuración** (o info de la app).
2. **Almacenamiento** → **Borrar caché**.
3. Vuelve a abrir.

### App se abre con la barra de Chrome encima (no fullscreen)

**Causa**: el archivo `.well-known/assetlinks.json` no está bien configurado en tu sitio. Solo crítico si quieres subir a Play Store.

**Solución para uso personal**: ignóralo, la app funciona igual.
**Solución para Play Store**: te paso un mini-guide cuando llegue el momento.

### El icono se ve cortado o pequeño

**Causa**: el icono no es maskable.

**Solución**: ya está marcado como maskable en el manifest, regenera el APK con la última versión deployada.

### Compartir desde Facebook no muestra "Tres Valles"

**Causa**: solo funciona si la app se instaló DESPUÉS de añadir `share_target` al manifest.

**Solución**:
1. Desinstala la app.
2. Asegúrate que el deploy de Cloudflare tiene el ZIP `tv-v15` o superior.
3. Genera un APK nuevo en PWABuilder.
4. Reinstala.

---

## 🚀 (Opcional) PARTE 5 — Subir a Google Play Store

Solo si quieres que la app sea descargable por cualquier persona desde Play Store.

### Pre-requisito: cuenta de Google Play Developer

- Costo: **$25 USD pago único** (lifetime).
- Registro: https://play.google.com/console
- Necesitas tarjeta de crédito y verificación de identidad (foto de DNI).

### Asset Links — paso obligatorio

Para que Android verifique que tu sitio "te representa" cuando la app se abre:

1. Crea una carpeta `.well-known` en `src/`:
   ```
   src/.well-known/assetlinks.json
   ```
2. PWABuilder generó este archivo en el ZIP (o te dice qué poner). El contenido es algo como:
   ```json
   [{
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
           "namespace": "android_app",
           "package_name": "com.tresvalles.portal",
           "sha256_cert_fingerprints": ["<huella SHA-256 de tu keystore>"]
       }
   }]
   ```
3. Re-deploya a Cloudflare Pages.
4. Verifica accediendo a `https://tresvalles.pages.dev/.well-known/assetlinks.json` — debe descargar el JSON.

### Subida a Play Console

1. https://play.google.com/console → **"Create app"**.
2. Rellena:
   - **App name**: `Tres Valles`
   - **Default language**: Spanish (Mexico)
   - **App or game**: `App`
   - **Free or paid**: `Free`
3. Acepta declaraciones.
4. Sigue los pasos del wizard:
   - **App content**: privacy policy, target audience, ads, etc.
   - **Main store listing**: descripción corta + larga + screenshots + icono.
   - **Production**: sube el `.aab` (no el .apk).
5. Envía a revisión.
6. Tarda 2-7 días la primera vez.
7. Aprobado → tu app aparece en Play Store buscando "Tres Valles".

---

## 📞 Si algo falla

Vuelve aquí al chat y mándame:
- **Captura de la pantalla del error.**
- **Texto exacto del mensaje.**
- **En qué paso te quedaste** (paso 1.4, 2.1, etc.).

Lo arreglo en el momento.

---

## 📊 Resumen ultra-rápido (TL;DR)

```
1. https://pwabuilder.com → pega https://tresvalles.pages.dev → Start
2. Package For Stores → Android
3. Rellena: package_id=com.tresvalles.portal, name=Tres Valles, version=1.0.0
4. Generate signing key → guarda el keystore
5. Generate → Download
6. Pasa el .apk al móvil (USB / Drive / email)
7. Abre el .apk → permite "fuentes desconocidas" → Instalar
8. Listo, app instalada.
```

Tiempo total: **~10 minutos**.
