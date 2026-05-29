import { useState } from 'preact/hooks';
import { STICKER_PACK, STICKER_CATEGORIES, type Sticker } from '../lib/stickers';

interface Props {
    onPick: (sticker: Sticker) => void;
    onClose: () => void;
}

export default function StickerPicker({ onPick, onClose }: Props) {
    const [cat, setCat] = useState<Sticker['category']>('tres_valles');
    const [q, setQ] = useState('');

    const filtered = STICKER_PACK.filter(s => {
        const matchesCat = cat ? s.category === cat : true;
        const matchesQ = q.trim()
            ? s.name.toLowerCase().includes(q.trim().toLowerCase())
            : true;
        return (q.trim() ? matchesQ : matchesCat);
    });

    return (
        <div class="sticker-picker">
            <div class="sticker-picker-head">
                <i class="fas fa-icons"></i>
                <input
                    type="search"
                    placeholder="Buscar sticker…"
                    value={q}
                    onInput={(e: any) => setQ(e.currentTarget.value)}
                    autoFocus
                />
                <button onClick={onClose} class="disc-icon-btn small" title="Cerrar">
                    <i class="fas fa-xmark"></i>
                </button>
            </div>

            {!q.trim() && (
                <div class="sticker-tabs">
                    {STICKER_CATEGORIES.map(c => (
                        <button
                            key={c.id}
                            class={`sticker-tab ${cat === c.id ? 'active' : ''}`}
                            onClick={() => setCat(c.id)}
                            title={c.label}
                        >
                            <i class={`fas ${c.icon}`}></i>
                            <small>{c.label}</small>
                        </button>
                    ))}
                </div>
            )}

            <div class="sticker-grid">
                {filtered.map(s => (
                    <button
                        key={s.slug}
                        class="sticker-thumb"
                        onClick={() => onPick(s)}
                        title={s.name}
                        style={`--c1:${s.color1};--c2:${s.color2}`}
                    >
                        <span class="sticker-glyph">{s.glyph}</span>
                    </button>
                ))}
                {filtered.length === 0 && (
                    <div class="sticker-empty">Sin resultados</div>
                )}
            </div>

            <small class="sticker-credit">
                <i class="fas fa-tree"></i> Stickers Tres Valles · pack local
            </small>
        </div>
    );
}
