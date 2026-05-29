import { useEffect, useRef, useState } from 'preact/hooks';
import {
    subscribeLightbox, closeLightbox, nextImage, prevImage,
    type LightboxImage,
} from '../lib/lightbox';

export default function LightboxHost() {
    const [state, setState] = useState<{ open: boolean; images: LightboxImage[]; index: number }>({
        open: false, images: [], index: 0,
    });
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);

    useEffect(() => subscribeLightbox(setState), []);

    useEffect(() => {
        if (!state.open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeLightbox();
            else if (e.key === 'ArrowRight') nextImage();
            else if (e.key === 'ArrowLeft') prevImage();
        };
        document.addEventListener('keydown', onKey);
        // Prevenir scroll del body mientras está abierto
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [state.open]);

    if (!state.open || state.images.length === 0) return null;
    const current = state.images[state.index];
    const total = state.images.length;

    const onTouchStart = (e: TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - (touchStartY.current ?? 0);
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) nextImage(); else prevImage();
        } else if (dy > 100 && Math.abs(dy) > Math.abs(dx)) {
            closeLightbox(); // swipe down to close
        }
        touchStartX.current = null;
        touchStartY.current = null;
    };

    return (
        <div
            class="lb2-overlay"
            onClick={closeLightbox}
            onTouchStart={onTouchStart as any}
            onTouchEnd={onTouchEnd as any}
        >
            <button class="lb2-close" onClick={(e: any) => { e.stopPropagation(); closeLightbox(); }} aria-label="Cerrar">
                <i class="fas fa-xmark"></i>
            </button>

            {total > 1 && (
                <>
                    <button class="lb2-nav lb2-prev" onClick={(e: any) => { e.stopPropagation(); prevImage(); }} aria-label="Anterior">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button class="lb2-nav lb2-next" onClick={(e: any) => { e.stopPropagation(); nextImage(); }} aria-label="Siguiente">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </>
            )}

            <img
                class="lb2-img"
                src={current.url}
                alt={current.alt || current.caption || ''}
                onClick={(e: any) => e.stopPropagation()}
            />

            <div class="lb2-info" onClick={(e: any) => e.stopPropagation()}>
                {current.caption && <p class="lb2-caption">{current.caption}</p>}
                {total > 1 && <small class="lb2-counter">{state.index + 1} / {total}</small>}
            </div>
        </div>
    );
}
