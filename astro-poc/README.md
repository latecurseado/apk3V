# Tres Valles · PoC con Astro + Preact

Prueba de concepto para evaluar **Astro + islas de Preact** como reemplazo
del sitio vanilla en `../src/`. Esta carpeta es **independiente**: no toca
tu sitio actual.

## Qué demuestra

- **Página estática** (`src/pages/index.astro`) — renderizada a HTML puro
  en build time. Sin JS de framework cargado.
- **Una isla interactiva** (`src/components/VisitCounter.tsx`) — el contador
  de visitas, escrito en Preact. Solo esa porción descarga JavaScript.
- **Cliente Supabase compartido** (`src/lib/supabase.ts`) — lee
  `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_KEY` desde `.env`.

## Cómo correrlo

Necesitas **Node.js 18 o superior**. Para verificar:

```bash
node --version
```

Si no lo tienes, instálalo desde https://nodejs.org/ (descarga LTS).

Luego en esta carpeta:

```bash
npm install
copy .env.example .env
# Edita .env con tu PUBLIC_SUPABASE_KEY real (la misma que ya usa tu sitio)
npm run dev
```

Abre **http://localhost:4321**

## Build para producción

```bash
npm run build
```

Genera la carpeta `dist/` con HTML/CSS/JS estáticos. Esa carpeta es la que
subes a Cloudflare Pages (no esta carpeta entera). Para probar el build:

```bash
npm run preview
```

## Estructura del PoC

```
astro-poc/
  package.json
  astro.config.mjs        # Astro + integración Preact
  tsconfig.json           # TypeScript para .tsx con Preact
  .env.example            # Plantilla de variables de entorno
  src/
    pages/
      index.astro         # Página de inicio (HTML estático)
    layouts/
      BaseLayout.astro    # Plantilla común (head, header, footer)
    components/
      VisitCounter.tsx    # ISLA Preact (contador con Supabase RPC)
    lib/
      supabase.ts         # Cliente Supabase
    styles/
      global.css          # Tema oscuro + variables (subset del sitio actual)
```

## Diferencias clave vs. el sitio actual

| Aspecto | Sitio vanilla actual | Astro PoC |
|---|---|---|
| Lenguaje | JS plano | TypeScript (opcional) |
| Tamaño bundle inicial | ~480 KB (script.js completo) | ~15 KB (solo la isla) |
| Build step | Ninguno | `npm run build` |
| Deploy | Sube `src/` | Sube `dist/` |
| Routing | Hash routing en `App.ui.navigate` | File-based (`src/pages/*`) |
| Re-render | `innerHTML` imperativo | Hooks declarativos (Preact) |
| Server | `python -m http.server` | `npm run dev` (Vite) |

## Si te gusta y quieres seguir

El siguiente paso lógico sería portar **una sección completa** del sitio
actual al PoC para validar a escala. Por ejemplo, la sección de "Explora
Tres Valles" tiene mucho contenido estático (historia, geografía, logo,
bibliografía) que en Astro queda en `.astro` puros sin JS — y unas pocas
islas para mapa, directorio de negocios y galería.

Después: foro, noticias y mensajes (todos requieren islas con Supabase).
