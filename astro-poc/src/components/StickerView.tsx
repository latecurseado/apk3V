import type { Sticker } from '../lib/stickers';

interface Props {
    sticker: Sticker;
    big?: boolean;
}

export default function StickerView({ sticker, big = false }: Props) {
    return (
        <div
            class={`sticker-view ${big ? 'big' : ''}`}
            style={`--c1:${sticker.color1};--c2:${sticker.color2}`}
            title={sticker.name}
        >
            <span class="sticker-glyph">{sticker.glyph}</span>
            {big && <small>{sticker.name}</small>}
        </div>
    );
}
