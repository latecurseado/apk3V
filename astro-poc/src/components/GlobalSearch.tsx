import { useEffect, useRef, useState } from 'preact/hooks';
import { search, highlight, type SearchResults } from '../lib/search';

export default function GlobalSearch() {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<SearchResults | null>(null);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Cmd/Ctrl + K abre el buscador
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                inputRef.current?.select();
                setOpen(true);
            }
            if (e.key === 'Escape') {
                setOpen(false);
                inputRef.current?.blur();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Cerrar al hacer click fuera
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    // Búsqueda debounced
    useEffect(() => {
        const term = q.trim();
        if (term.length < 1) { setResults(null); return; }
        setLoading(true);
        const id = setTimeout(async () => {
            const res = await search(term);
            setResults(res);
            setLoading(false);
            setActiveIdx(-1);
        }, 220);
        return () => clearTimeout(id);
    }, [q]);

    // Aplanar resultados para navegación con flechas
    const flatItems: Array<{ kind: 'thread'|'profile'|'forum'; href: string; label: string }> = [];
    if (results) {
        results.forums.forEach(f => flatItems.push({ kind: 'forum', href: `/foro?f=${f.slug}`, label: f.name }));
        results.profiles.forEach(p => flatItems.push({ kind: 'profile', href: `#`, label: p.username || 'Anónimo' }));
        results.threads.forEach(t => {
            const slug = t.category || 'general';
            flatItems.push({ kind: 'thread', href: `/foro?f=${slug}`, label: t.content.slice(0, 60) });
        });
    }

    const submitFirst = () => {
        if (flatItems.length === 0) {
            window.location.href = `/buscar?q=${encodeURIComponent(q.trim())}`;
            return;
        }
        const target = flatItems[activeIdx >= 0 ? activeIdx : 0];
        window.location.href = target.href;
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx(i => Math.min(flatItems.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx(i => Math.max(-1, i - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (q.trim()) submitFirst();
        }
    };

    const showDropdown = open && q.trim().length > 0;

    return (
        <div class="gs-wrap" ref={wrapperRef}>
            <div class="gs-input-wrap">
                <i class="fas fa-magnifying-glass gs-icon"></i>
                <input
                    ref={inputRef}
                    type="search"
                    class="gs-input"
                    placeholder="Buscar hilos, usuarios, foros…"
                    value={q}
                    onInput={(e: any) => { setQ(e.currentTarget.value); setOpen(true); }}
                    onFocus={() => q.trim() && setOpen(true)}
                    onKeyDown={onKeyDown}
                    aria-label="Buscar"
                />
                {q && (
                    <button class="gs-clear" onClick={() => { setQ(''); setResults(null); inputRef.current?.focus(); }} aria-label="Limpiar">
                        <i class="fas fa-xmark"></i>
                    </button>
                )}
                <kbd class="gs-hint">Ctrl+K</kbd>
            </div>

            {showDropdown && (
                <div class="gs-dropdown" role="listbox">
                    {loading && (
                        <div class="gs-empty"><i class="fas fa-circle-notch fa-spin"></i> Buscando…</div>
                    )}
                    {!loading && results && results.total === 0 && (
                        <div class="gs-empty">
                            <i class="fas fa-circle-info"></i> Nada para <b>"{q}"</b>
                        </div>
                    )}
                    {!loading && results && results.total > 0 && (
                        <>
                            {results.forums.length > 0 && (
                                <div class="gs-group">
                                    <div class="gs-group-head"><i class="fas fa-hashtag"></i> Foros</div>
                                    {results.forums.map((f, i) => (
                                        <a
                                            key={f.id}
                                            href={`/foro?f=${f.slug}`}
                                            class={`gs-item ${activeIdx === i ? 'active' : ''}`}
                                        >
                                            <span class="gs-item-icon"><i class={`fas ${f.icon}`}></i></span>
                                            <div class="gs-item-body">
                                                <strong dangerouslySetInnerHTML={{ __html: highlight(f.name, q) }} />
                                                {f.description && (
                                                    <small dangerouslySetInnerHTML={{ __html: highlight(f.description.slice(0, 90), q) }} />
                                                )}
                                            </div>
                                            {f.is_system && <span class="gs-tag">Oficial</span>}
                                        </a>
                                    ))}
                                </div>
                            )}
                            {results.profiles.length > 0 && (
                                <div class="gs-group">
                                    <div class="gs-group-head"><i class="fas fa-user-group"></i> Usuarios</div>
                                    {results.profiles.map((p, j) => {
                                        const i = results.forums.length + j;
                                        return (
                                            <a
                                                key={p.id}
                                                href="#"
                                                class={`gs-item ${activeIdx === i ? 'active' : ''}`}
                                            >
                                                <span class="gs-item-icon round"><i class="fas fa-user"></i></span>
                                                <div class="gs-item-body">
                                                    <strong dangerouslySetInnerHTML={{ __html: highlight(p.username || 'Anónimo', q) }} />
                                                    <small>{p.role === 'admin' ? 'Admin' : 'Miembro'}</small>
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                            )}
                            {results.threads.length > 0 && (
                                <div class="gs-group">
                                    <div class="gs-group-head"><i class="fas fa-comment"></i> Hilos</div>
                                    {results.threads.map((t, k) => {
                                        const i = results.forums.length + results.profiles.length + k;
                                        const author = t.author?.username || 'Anónimo';
                                        const slug = t.category || 'general';
                                        return (
                                            <a
                                                key={t.id}
                                                href={`/foro?f=${slug}`}
                                                class={`gs-item ${activeIdx === i ? 'active' : ''}`}
                                            >
                                                <span class="gs-item-icon round"><i class="fas fa-comment"></i></span>
                                                <div class="gs-item-body">
                                                    <strong dangerouslySetInnerHTML={{ __html: highlight(t.content.slice(0, 80), q) }} />
                                                    <small>por <b>{author}</b> en #{slug}</small>
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                            )}
                            <a class="gs-see-all" href={`/buscar?q=${encodeURIComponent(q.trim())}`}>
                                <i class="fas fa-magnifying-glass-plus"></i> Ver todos los resultados
                            </a>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
