import { useEffect, useRef, useState } from 'preact/hooks';

interface Props {
    value: number;
    duration?: number;
    class?: string;
}

function prefersReduced(): boolean {
    try {
        if (document.documentElement.dataset.rm === '1') return true;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

/** Número que cuenta hasta su valor con easing. Respeta "reducir movimiento". */
export default function CountUp({ value, duration = 650, class: cls }: Props) {
    const [display, setDisplay] = useState(value);
    const prevRef = useRef(value);
    const rafRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        const from = prevRef.current;
        const to = value;
        prevRef.current = value;
        if (prefersReduced() || from === to) { setDisplay(to); return; }
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
            setDisplay(Math.round(from + (to - from) * eased));
            if (t < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [value]);

    return <span class={`tv-countup ${cls || ''}`}>{display.toLocaleString('es-MX')}</span>;
}
