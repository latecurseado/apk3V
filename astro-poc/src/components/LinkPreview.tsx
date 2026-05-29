import { useEffect, useState } from 'preact/hooks';

/**
 * Detecta una URL en el texto y muestra un preview básico.
 * - YouTube: thumbnail + título
 * - Imágenes directas: render inline
 * - Otros links: card con favicon + domain + title
 *
 * Usa microlink.io API pública (rate-limited pero gratis sin key)
 * para metadata Open Graph. Si falla, muestra card básica.
 */

interface OGData { title?: string; description?: string; image?: string; logo?: string; }

const URL_RE = /(https?:\/\/[^\s<]+)/g;

function firstUrl(text: string): string | null {
    const m = text.match(URL_RE);
    return m ? m[0] : null;
}

function ytIdFromUrl(url: string): string | null {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
}

function isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(url);
}

export default function LinkPreview({ text }: { text: string }) {
    const [og, setOg] = useState<OGData | null>(null);
    const [loading, setLoading] = useState(false);

    const url = firstUrl(text);
    const ytId = url ? ytIdFromUrl(url) : null;
    const isImg = url ? isImageUrl(url) : false;
    const isYt = !!ytId;

    useEffect(() => {
        if (!url || isYt || isImg) return;
        // No microlink fetch en client por CORS/rate · solo extraemos dominio
        try {
            const u = new URL(url);
            setOg({
                title: u.hostname.replace('www.', ''),
                description: u.pathname.slice(0, 60),
            });
        } catch { /* */ }
    }, [url]);

    if (!url) return null;

    if (isYt) {
        return (
            <a class="link-preview youtube" href={url} target="_blank" rel="noopener" onClick={(e: any) => e.stopPropagation()}>
                <img src={`https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`} alt="YouTube" />
                <div class="link-preview-info">
                    <i class="fab fa-youtube"></i>
                    <small>youtube.com</small>
                </div>
            </a>
        );
    }

    if (isImg) {
        return (
            <a class="link-preview image" href={url} target="_blank" rel="noopener" onClick={(e: any) => e.stopPropagation()}>
                <img src={url} alt="link" loading="lazy" />
            </a>
        );
    }

    if (og) {
        return (
            <a class="link-preview generic" href={url} target="_blank" rel="noopener" onClick={(e: any) => e.stopPropagation()}>
                <div class="link-preview-icon">
                    <img src={`https://www.google.com/s2/favicons?domain=${og.title}&sz=32`} alt="" />
                </div>
                <div class="link-preview-info">
                    <strong>{og.title}</strong>
                    <small>{og.description}</small>
                </div>
            </a>
        );
    }

    return null;
}
