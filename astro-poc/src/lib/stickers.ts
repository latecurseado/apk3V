/**
 * Stickers Tres Valles · pack temático local.
 *
 * Cada sticker es un emoji compuesto + gradient + nombre · sin imágenes
 * externas (queda totalmente offline-capable). Si quieres usar SVGs reales,
 * reemplaza `glyph` por `image: '/stickers/cañeros.png'` y ajusta el render.
 *
 * Mensajes con sticker se serializan como: `[[sticker:slug]]` en el content,
 * y el renderer del chat detecta ese patrón para mostrarlo grande.
 */

export interface Sticker {
    slug: string;
    name: string;
    glyph: string;       // emoji o secuencia de emojis
    color1: string;
    color2: string;
    category: 'tres_valles' | 'reacciones' | 'fiesta' | 'comida';
}

export const STICKER_PACK: Sticker[] = [
    // Tres Valles · íconos locales
    { slug: 'cañeros',     name: 'Cañeros',          glyph: '🌾',         color1: '#22c55e', color2: '#a3e635', category: 'tres_valles' },
    { slug: 'ingenio',     name: 'Ingenio azucarero', glyph: '🏭',         color1: '#94a3b8', color2: '#cbd5e1', category: 'tres_valles' },
    { slug: 'papaloapan',  name: 'Río Papaloapan',   glyph: '🌊',         color1: '#0ea5e9', color2: '#38bdf8', category: 'tres_valles' },
    { slug: 'jarocho',     name: 'Jarocho',          glyph: '🤠',         color1: '#dc2626', color2: '#f97316', category: 'tres_valles' },
    { slug: 'café',        name: 'Café veracruzano', glyph: '☕',         color1: '#78350f', color2: '#b45309', category: 'tres_valles' },
    { slug: 'guayabera',   name: 'Guayabera',        glyph: '👔',         color1: '#e5e7eb', color2: '#fbbf24', category: 'tres_valles' },
    { slug: 'mango',       name: 'Mango maduro',     glyph: '🥭',         color1: '#f59e0b', color2: '#dc2626', category: 'comida' },
    { slug: 'piña',        name: 'Piña tropical',    glyph: '🍍',         color1: '#eab308', color2: '#65a30d', category: 'comida' },
    { slug: 'tamal',       name: 'Tamal de elote',   glyph: '🌽',         color1: '#facc15', color2: '#65a30d', category: 'comida' },
    { slug: 'pejelagarto', name: 'Pejelagarto',      glyph: '🐊',         color1: '#15803d', color2: '#84cc16', category: 'comida' },
    { slug: 'mojarra',     name: 'Mojarra al mojo',  glyph: '🐟',         color1: '#0891b2', color2: '#fb923c', category: 'comida' },

    // Fiesta · carnaval, son
    { slug: 'carnaval',    name: 'Carnaval',         glyph: '🎭',         color1: '#a855f7', color2: '#ec4899', category: 'fiesta' },
    { slug: 'son_jarocho', name: 'Son jarocho',      glyph: '🎻',         color1: '#dc2626', color2: '#f59e0b', category: 'fiesta' },
    { slug: 'fiesta',      name: '¡A bailar!',       glyph: '💃',         color1: '#ec4899', color2: '#f97316', category: 'fiesta' },
    { slug: 'cervecita',   name: 'Una cheve',        glyph: '🍺',         color1: '#f59e0b', color2: '#fde68a', category: 'fiesta' },

    // Reacciones cotidianas en mexicano
    { slug: 'orale',       name: '¡Órale!',          glyph: '😲',         color1: '#facc15', color2: '#fb923c', category: 'reacciones' },
    { slug: 'chido',       name: '¡Qué chido!',      glyph: '👌',         color1: '#22c55e', color2: '#14b8a6', category: 'reacciones' },
    { slug: 'nojoda',      name: '¡No joda!',        glyph: '🙄',         color1: '#94a3b8', color2: '#e5e7eb', category: 'reacciones' },
    { slug: 'fuego',       name: '¡Fuego!',          glyph: '🔥',         color1: '#dc2626', color2: '#f59e0b', category: 'reacciones' },
    { slug: 'guacala',     name: '¡Guácala!',        glyph: '🤢',         color1: '#65a30d', color2: '#22c55e', category: 'reacciones' },
    { slug: 'risa',        name: 'JAJAJA',           glyph: '😂',         color1: '#facc15', color2: '#fbbf24', category: 'reacciones' },
    { slug: 'amor',        name: 'Te quiero',        glyph: '❤️',         color1: '#dc2626', color2: '#ec4899', category: 'reacciones' },
    { slug: 'aplauso',     name: 'Aplausos',         glyph: '👏',         color1: '#facc15', color2: '#fb923c', category: 'reacciones' },
];

const SLUG_MAP: Record<string, Sticker> = Object.fromEntries(STICKER_PACK.map(s => [s.slug, s]));

export function getSticker(slug: string): Sticker | null {
    return SLUG_MAP[slug] || null;
}

/** Detecta si el contenido es SOLO un sticker (`[[sticker:slug]]` opcionalmente con whitespace). */
export function parseStickerOnly(content: string): Sticker | null {
    const trimmed = content.trim();
    const m = trimmed.match(/^\[\[sticker:([a-z0-9_]+)\]\]$/i);
    if (!m) return null;
    return getSticker(m[1]) || null;
}

/** Busca todos los stickers embebidos en un texto. */
export function findStickers(content: string): { sticker: Sticker; start: number; end: number }[] {
    const out: { sticker: Sticker; start: number; end: number }[] = [];
    const re = /\[\[sticker:([a-z0-9_]+)\]\]/gi;
    let m;
    while ((m = re.exec(content)) !== null) {
        const s = getSticker(m[1]);
        if (s) out.push({ sticker: s, start: m.index, end: m.index + m[0].length });
    }
    return out;
}

export function stickerMarker(slug: string): string {
    return `[[sticker:${slug}]]`;
}

export const STICKER_CATEGORIES: { id: Sticker['category']; label: string; icon: string }[] = [
    { id: 'tres_valles', label: 'Tres Valles', icon: 'fa-tree' },
    { id: 'reacciones',  label: 'Reacciones',  icon: 'fa-face-smile' },
    { id: 'fiesta',      label: 'Fiesta',      icon: 'fa-music' },
    { id: 'comida',      label: 'Comida',      icon: 'fa-utensils' },
];
