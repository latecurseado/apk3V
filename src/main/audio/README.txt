SOUNDTRACK DE TRES VALLES
==========================

Coloca aquí tu archivo de música de fondo con el nombre EXACTO:

    soundtrack.mp3

Recomendaciones:
- Formato: MP3 (mejor compatibilidad), opcionalmente OGG o WAV
- Tamaño: <2 MB para que cargue rápido (~3 minutos a 96 kbps es buen punto)
- Que sea música ambiental / instrumental para no cansar al usuario
- Sin derechos de autor (libre o licencia adecuada)

Cuando publiques el sitio en Cloudflare Pages, el archivo se sirve
automáticamente desde:

    https://tresvalles.pages.dev/main/audio/soundtrack.mp3

El reproductor en index.html lo carga con:
    <audio src="main/audio/soundtrack.mp3" loop>

Y arranca al primer click/tecla/toque del usuario (los navegadores
bloquean autoplay con sonido sin interacción).
