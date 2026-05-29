import type { DefaultSection } from './explora-default';

export const inicioDefault: DefaultSection[] = [
    {
        section_key: 'bienvenida',
        sort_order: 10,
        icon: 'fa-rocket',
        title: 'Bienvenido al portal',
        body: `
<p class="accent-lead">
    Tres Valles es el corazón agroindustrial de la Cuenca del Papaloapan. Este portal es el espacio donde la comunidad comparte historia, noticias y conversaciones.
</p>
<p class="hub-section-lead">
    Explora cada sección desde el menú superior. Si tienes algo que aportar, entra al
    <a href="/foro" style="color:var(--accent);">Foro</a> e inicia sesión como invitado para publicar.
</p>`.trim(),
    },
    {
        section_key: 'que-hacer',
        sort_order: 20,
        icon: 'fa-compass',
        title: '¿Por dónde empezar?',
        body: `
<ul class="hub-poi-list">
    <li><i class="fas fa-mountain"></i> <b>Explora Tres Valles</b>: historia, logo, geografía, gastronomía, mapa interactivo y bibliografía.</li>
    <li><i class="fas fa-comments"></i> <b>Foro comunitario</b>: hilos en vivo, comentarios y reacciones.</li>
    <li><i class="fas fa-newspaper"></i> <b>Noticias</b>: lo que pasa en el municipio (próximamente).</li>
</ul>`.trim(),
    },
];
