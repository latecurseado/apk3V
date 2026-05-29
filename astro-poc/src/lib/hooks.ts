import { useEffect, useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact';

/**
 * Auto-resize textarea según contenido (estilo Twitter compose).
 */
export function useAutoResize(ref: RefObject<HTMLTextAreaElement>, value: string, max = 400) {
    useEffect(() => {
        const ta = ref.current;
        if (!ta) return;
        ta.style.height = 'auto';
        const next = Math.min(ta.scrollHeight, max);
        ta.style.height = next + 'px';
    }, [value]);
}

/**
 * Infinite scroll vía IntersectionObserver sobre un "sentinel" al final
 * de la lista. Cuando entra al viewport, dispara `onMore()`.
 */
export function useInfiniteScroll(
    sentinelRef: RefObject<HTMLElement>,
    onMore: () => void | Promise<void>,
    enabled = true,
) {
    const loadingRef = useRef(false);
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el || !enabled) return;
        const io = new IntersectionObserver(async (entries) => {
            if (entries[0].isIntersecting && !loadingRef.current) {
                loadingRef.current = true;
                try { await onMore(); }
                finally { loadingRef.current = false; }
            }
        }, { rootMargin: '300px 0px' });
        io.observe(el);
        return () => io.disconnect();
    }, [sentinelRef.current, enabled, onMore]);
}

/**
 * Auto-save de borrador a localStorage cada 1.5s con debounce.
 * Devuelve `restored` para indicar si se cargó un draft previo.
 * Usar `clearDraft()` para borrar tras publicar.
 */
export function useDraft<T extends Record<string, any>>(
    key: string,
    value: T,
    onRestore: (saved: T) => void,
) {
    const restoredRef = useRef(false);

    // Restore on mount
    useEffect(() => {
        if (restoredRef.current) return;
        restoredRef.current = true;
        try {
            const raw = localStorage.getItem('tv-draft-' + key);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') onRestore(parsed as T);
            }
        } catch { /* */ }
    }, [key]);

    // Auto-save with debounce
    useEffect(() => {
        const t = setTimeout(() => {
            try { localStorage.setItem('tv-draft-' + key, JSON.stringify(value)); } catch { /* */ }
        }, 1500);
        return () => clearTimeout(t);
    }, [key, JSON.stringify(value)]);

    return {
        clearDraft: () => { try { localStorage.removeItem('tv-draft-' + key); } catch { /* */ } },
    };
}

/**
 * Hide topbar on scroll down (mobile). Vuelve al scroll up.
 */
export function useHideOnScroll(threshold = 80) {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        let lastY = window.scrollY;
        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const y = window.scrollY;
                const dy = y - lastY;
                if (y < threshold) {
                    document.documentElement.dataset.topbarHidden = '0';
                } else if (dy > 6) {
                    document.documentElement.dataset.topbarHidden = '1';
                } else if (dy < -6) {
                    document.documentElement.dataset.topbarHidden = '0';
                }
                lastY = y;
                ticking = false;
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [threshold]);
}

/**
 * Doble click handler — devuelve un onClick que solo dispara
 * `onDouble()` si el segundo click llega dentro de 300ms.
 */
export function useDoubleClick(onDouble: () => void, delay = 300) {
    const lastClick = useRef(0);
    return () => {
        const now = Date.now();
        if (now - lastClick.current < delay) {
            onDouble();
            lastClick.current = 0;
        } else {
            lastClick.current = now;
        }
    };
}

/**
 * Long-press para mobile. onPress se dispara después de `ms` manteniendo.
 */
export function useLongPress(onPress: () => void, ms = 500) {
    const timer = useRef<number | null>(null);
    const start = () => {
        timer.current = window.setTimeout(() => {
            onPress();
            if (navigator.vibrate) navigator.vibrate(10);
        }, ms);
    };
    const cancel = () => {
        if (timer.current !== null) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    };
    return {
        onMouseDown: start, onMouseUp: cancel, onMouseLeave: cancel,
        onTouchStart: start, onTouchEnd: cancel, onTouchCancel: cancel,
    };
}

/**
 * Pull-to-refresh para mobile. Solo dispara si el usuario hace pull
 * cuando el scroll está en 0 (arriba del todo).
 * Returns { isPulling, pullDistance }.
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
    const [isPulling, setIsPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const startY = useRef<number | null>(null);
    const refreshing = useRef(false);

    useEffect(() => {
        const TH = 80; // px to trigger
        const onTouchStart = (e: TouchEvent) => {
            if (window.scrollY > 0 || refreshing.current) return;
            startY.current = e.touches[0].clientY;
        };
        const onTouchMove = (e: TouchEvent) => {
            if (startY.current === null) return;
            const delta = e.touches[0].clientY - startY.current;
            if (delta > 0 && window.scrollY === 0) {
                setIsPulling(true);
                setPullDistance(Math.min(delta * 0.5, 120));
            }
        };
        const onTouchEnd = async () => {
            if (startY.current === null) return;
            const dist = pullDistance;
            startY.current = null;
            setIsPulling(false);
            setPullDistance(0);
            if (dist >= TH * 0.5 && !refreshing.current) {
                refreshing.current = true;
                try { await onRefresh(); }
                finally { refreshing.current = false; }
            }
        };
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchmove', onTouchMove, { passive: true });
        document.addEventListener('touchend', onTouchEnd);
        return () => {
            document.removeEventListener('touchstart', onTouchStart);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };
    }, [onRefresh, pullDistance]);

    return { isPulling, pullDistance };
}
