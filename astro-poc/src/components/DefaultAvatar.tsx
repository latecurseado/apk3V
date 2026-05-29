/**
 * Avatar procedural cute usando DiceBear (URL-based, sin npm install).
 * Cada user UUID → SVG único determinístico. Cachea en navegador.
 *
 * Estilos disponibles: lorelei, adventurer, bottts-neutral, croodles,
 * fun-emoji, notionists, personas, pixel-art, micah, miniavs.
 */
interface Props {
    seed: string;            // UUID o username del user
    size?: number;           // px
    style?: 'lorelei' | 'adventurer' | 'bottts-neutral' | 'fun-emoji' | 'notionists' | 'personas' | 'pixel-art' | 'micah' | 'miniavs' | 'croodles';
    radius?: number;         // 0-50 (porcentaje del bg)
    className?: string;
}

const STYLES_BY_HASH = ['lorelei', 'adventurer', 'bottts-neutral', 'fun-emoji', 'notionists', 'micah'] as const;

function hashChoice(seed: string): typeof STYLES_BY_HASH[number] {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return STYLES_BY_HASH[h % STYLES_BY_HASH.length];
}

export default function DefaultAvatar({ seed, size = 38, style, radius = 50, className }: Props) {
    const chosenStyle = style || hashChoice(seed);
    const url = `https://api.dicebear.com/9.x/${chosenStyle}/svg?seed=${encodeURIComponent(seed)}&radius=${radius}`;
    return (
        <img
            class={`default-avatar ${className || ''}`}
            src={url}
            alt="Avatar"
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
        />
    );
}
