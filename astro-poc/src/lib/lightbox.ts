/**
 * Global lightbox store. Cualquier componente puede llamar a
 * `openLightbox(images, startIndex)` para abrir el visor unificado.
 */

export interface LightboxImage {
    url: string;
    caption?: string;
    alt?: string;
}

type Listener = (state: { open: boolean; images: LightboxImage[]; index: number }) => void;

let state = { open: false, images: [] as LightboxImage[], index: 0 };
const listeners = new Set<Listener>();

function emit() { listeners.forEach(fn => fn({ ...state })); }

export function openLightbox(images: LightboxImage[] | string[], startIndex = 0) {
    const norm: LightboxImage[] = images.map((it) =>
        typeof it === 'string' ? { url: it } : it
    );
    state = { open: true, images: norm, index: startIndex };
    emit();
}

export function closeLightbox() {
    state = { ...state, open: false };
    emit();
}

export function nextImage() {
    if (!state.open) return;
    state = { ...state, index: (state.index + 1) % state.images.length };
    emit();
}

export function prevImage() {
    if (!state.open) return;
    state = { ...state, index: (state.index - 1 + state.images.length) % state.images.length };
    emit();
}

export function subscribeLightbox(listener: Listener): () => void {
    listeners.add(listener);
    listener({ ...state });
    return () => { listeners.delete(listener); };
}
