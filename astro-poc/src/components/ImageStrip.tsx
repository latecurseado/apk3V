import { useEffect, useState } from 'preact/hooks';
import { gallery } from '../data/gallery';
import { openLightbox } from '../lib/lightbox';

export default function ImageStrip() {
    const open = (i: number) => {
        openLightbox(
            gallery.map(g => ({
                url: `/gallery/${encodeURIComponent(g.file)}`,
                caption: g.caption,
                alt: g.caption,
            })),
            i,
        );
    };
    return (
        <div class="image-strip">
            {gallery.map((img, i) => (
                <button
                    key={img.file}
                    class="image-thumb"
                    onClick={() => open(i)}
                    title={img.caption}
                >
                    <img
                        class="lazy-blur"
                        src={`/gallery/${encodeURIComponent(img.file)}`}
                        alt={img.caption}
                        loading="lazy"
                        decoding="async"
                        onLoad={(e: any) => e.currentTarget.classList.add('loaded')}
                    />
                </button>
            ))}
        </div>
    );
}
