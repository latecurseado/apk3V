import { useEffect, useState } from 'preact/hooks';

interface GifResult { id: string; preview: string; full: string; }

interface Props {
    onPick: (url: string) => void;
    onClose: () => void;
}

// Tenor v2 público (sin API key requiere algo, pero hay alternativas).
// Uso Giphy demo key (limitado pero funcional para PoC).
const GIPHY_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65';

export default function GifPicker({ onPick, onClose }: Props) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<GifResult[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const t = setTimeout(async () => {
            setLoading(true);
            const term = q.trim();
            const url = term
                ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(term)}&limit=20&rating=g`
                : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=g`;
            try {
                const res = await fetch(url);
                const j = await res.json();
                const data = j.data || [];
                setResults(data.map((g: any) => ({
                    id: g.id,
                    preview: g.images.fixed_width.url,
                    full: g.images.original.url,
                })));
            } catch (e) {
                console.warn('[gif]', e);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    return (
        <div class="gif-picker">
            <div class="gif-picker-head">
                <i class="fas fa-magnifying-glass"></i>
                <input
                    type="search"
                    placeholder="Buscar GIF..."
                    value={q}
                    onInput={(e: any) => setQ(e.currentTarget.value)}
                    autoFocus
                />
                <button onClick={onClose} class="disc-icon-btn small">
                    <i class="fas fa-xmark"></i>
                </button>
            </div>
            <div class="gif-grid">
                {loading && (
                    <>
                        {Array.from({ length: 12 }).map(() => (
                            <div class="skel gif-skel"></div>
                        ))}
                    </>
                )}
                {!loading && results.length === 0 && (
                    <div class="gif-empty">Sin resultados para "{q}"</div>
                )}
                {!loading && results.map(g => (
                    <button key={g.id} class="gif-thumb" onClick={() => onPick(g.full)}>
                        <img src={g.preview} alt="" loading="lazy" />
                    </button>
                ))}
            </div>
            <small class="gif-credit">Powered by Giphy</small>
        </div>
    );
}
