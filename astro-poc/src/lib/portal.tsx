import { createPortal } from 'preact/compat';

/**
 * Renderiza un modal/overlay en <body> para que `position: fixed` NUNCA quede
 * atrapado por un ancestro con `backdrop-filter`/`transform`/`filter` (la topbar,
 * tarjetas con hover-lift, etc.), que crean un containing block y descolocan el
 * modal. Uso: `return portal(<div class="modal-overlay">…</div>);`
 */
export function portal(node: any) {
    return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
}
