import { useEffect, useState } from 'preact/hooks';

const SHORTCUTS: Array<{ keys: string[]; action: string; group: string }> = [
    { keys: ['/'],          action: 'Foco buscador',           group: 'Navegación' },
    { keys: ['Ctrl', 'K'],  action: 'Abrir buscador global',   group: 'Navegación' },
    { keys: ['G', 'H'],     action: 'Ir a Inicio',             group: 'Navegación' },
    { keys: ['G', 'E'],     action: 'Ir a Explora',            group: 'Navegación' },
    { keys: ['G', 'B'],     action: 'Ir a Buscar',             group: 'Navegación' },
    { keys: ['G', 'P'],     action: 'Ir a Perfil',             group: 'Navegación' },
    { keys: ['N'],          action: 'Nuevo hilo',              group: 'Crear' },
    { keys: ['Ctrl', '↵'],  action: 'Enviar (en composer)',    group: 'Crear' },
    { keys: ['Esc'],        action: 'Cerrar modal',            group: 'General' },
    { keys: ['Ctrl', '/'],  action: 'Mostrar esta ayuda',      group: 'General' },
    { keys: ['↑', '↓'],     action: 'Navegar reels',           group: 'Reels' },
    { keys: ['Space'],      action: 'Pausa/reanuda reel',      group: 'Reels' },
    { keys: ['L'],          action: 'Like reel',               group: 'Reels' },
    { keys: ['M'],          action: 'Mute reel',               group: 'Reels' },
    { keys: ['2× tap'],     action: 'Like rápido en hilo',     group: 'Hilos' },
    { keys: ['Hold ♥'],     action: 'Reactions picker',        group: 'Hilos' },
    { keys: ['?'],          action: 'Abrir esta ayuda',        group: 'General' },
];

export default function KeyboardShortcuts() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const isTyping = (el: Element | null) => {
            if (!el) return false;
            const t = (el as HTMLElement).tagName;
            return t === 'INPUT' || t === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
        };
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                setOpen(o => !o);
            } else if (e.key === '?' && !isTyping(document.activeElement)) {
                e.preventDefault();
                setOpen(o => !o);
            } else if (e.key === 'Escape' && open) {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    if (!open) return null;

    const grouped: Record<string, typeof SHORTCUTS> = {};
    SHORTCUTS.forEach(s => {
        if (!grouped[s.group]) grouped[s.group] = [];
        grouped[s.group].push(s);
    });

    return (
        <div class="modal-overlay" onClick={() => setOpen(false)}>
            <div class="modal kbd-modal" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-keyboard"></i> Atajos de teclado</h3>
                    <button class="modal-close" onClick={() => setOpen(false)}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body kbd-body">
                    {Object.entries(grouped).map(([group, list]) => (
                        <div class="kbd-group" key={group}>
                            <h4>{group}</h4>
                            {list.map((s, i) => (
                                <div class="kbd-row" key={i}>
                                    <span class="kbd-keys">
                                        {s.keys.map((k, j) => (
                                            <>
                                                {j > 0 && <span class="kbd-plus">+</span>}
                                                <kbd>{k}</kbd>
                                            </>
                                        ))}
                                    </span>
                                    <span class="kbd-action">{s.action}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
