import { useEffect, useState } from 'preact/hooks';

type Theme = 'dark' | 'light';

function getInitial(): Theme {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('tv-theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function apply(theme: Theme) {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('tv-theme', theme); } catch { /* */ }
}

export default function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>('dark');

    useEffect(() => {
        const initial = getInitial();
        setTheme(initial);
        apply(initial);
    }, []);

    const toggle = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        apply(next);
    };

    return (
        <button
            class="theme-toggle"
            onClick={toggle}
            title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            aria-label="Cambiar tema"
        >
            <i class={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>
    );
}
