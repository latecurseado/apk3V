/* ============================================================
   Helpers de movimiento · Motion One (paquete `motion`).
   UN solo lenguaje de animación para toda la app. Todo respeta
   "reducir movimiento" (data-rm="1" o prefers-reduced-motion):
   si está activo, las funciones no hacen nada (estado final directo).
   Principio: animación = feedback a la acción. Feedback corto y suave.
   ============================================================ */
import { animate } from 'motion';

const EASE_SOFT = [0.22, 1, 0.36, 1] as const; // salida suave
const EASE_IN = [0.4, 0, 1, 1] as const;

export function reducedMotion(): boolean {
    try {
        if (typeof document !== 'undefined' && document.documentElement.dataset.rm === '1') return true;
        return typeof window !== 'undefined'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

/** Entrada suave desde abajo (chrome, paneles, tarjetas nuevas). */
export function enterUp(el: Element | null | undefined, delay = 0): void {
    if (!el || reducedMotion()) return;
    animate(el, { opacity: [0, 1], y: [8, 0] }, { duration: 0.28, ease: EASE_SOFT as any, delay });
}

/** Pop táctil con leve rebote (al añadir/confirmar algo). */
export function pop(el: Element | null | undefined): void {
    if (!el || reducedMotion()) return;
    animate(el, { scale: [0.92, 1.03, 1] }, { duration: 0.34, ease: EASE_SOFT as any });
}

/** Salida hacia arriba; resuelve cuando termina (para quitar tras animar). */
export function exitUp(el: Element | null | undefined): Promise<void> {
    if (!el || reducedMotion()) return Promise.resolve();
    return animate(el, { opacity: [1, 0], y: [0, -6], scale: [1, 0.96] },
        { duration: 0.16, ease: EASE_IN as any }).finished.then(() => undefined);
}
