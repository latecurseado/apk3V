import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/forum';

interface NewsItem {
    id: string;
    content: string;
    created_at: string;
    source_url: string | null;
    source_name: string | null;
    source_image: string | null;
}

/**
 * Sidebar widget que muestra las últimas noticias del foro #noticias
 * (publicadas automáticamente por el news-bot).
 */
export default function NoticiasWidget() {
    const [items, setItems] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            const { data } = await supabase
                .from('threads')
                .select('id, content, created_at, source_url, source_name, source_image')
                .eq('is_bot', true)
                .eq('category', 'noticias')
                .order('created_at', { ascending: false })
                .limit(5);
            if (!alive) return;
            setItems((data || []) as NewsItem[]);
            setLoading(false);
        })();
        return () => { alive = false; };
    }, []);

    if (loading) {
        return (
            <section class="noticias-widget">
                <h3><i class="fas fa-newspaper"></i> Noticias de Tres Valles</h3>
                <div class="noticias-skel"><div class="skel sk-line"></div><div class="skel sk-line short"></div></div>
                <div class="noticias-skel"><div class="skel sk-line"></div><div class="skel sk-line short"></div></div>
            </section>
        );
    }

    if (items.length === 0) {
        return (
            <section class="noticias-widget">
                <h3><i class="fas fa-newspaper"></i> Noticias de Tres Valles</h3>
                <p class="noticias-empty">
                    <i class="fas fa-clock"></i>
                    El bot revisa cada hora. Pronto aparecerán noticias.
                </p>
            </section>
        );
    }

    const extractTitle = (content: string): string => {
        // Formato del bot: "📰 **Título**\n\n..."
        const m = content.match(/\*\*(.+?)\*\*/);
        if (m) return m[1].trim();
        // Fallback: primera línea sin emoji
        return content.split('\n')[0].replace(/^[^\w]*/, '').slice(0, 90);
    };

    return (
        <section class="noticias-widget">
            <h3><i class="fas fa-newspaper"></i> Noticias de Tres Valles</h3>
            <ul class="noticias-list">
                {items.map(it => (
                    <li key={it.id}>
                        <a
                            href={it.source_url || `/foro?f=noticias#hilo-${it.id}`}
                            target={it.source_url ? '_blank' : '_self'}
                            rel={it.source_url ? 'noopener' : undefined}
                            class="noticia-link"
                        >
                            {it.source_image && (
                                <img src={it.source_image} alt="" loading="lazy" class="noticia-thumb" />
                            )}
                            <div class="noticia-body">
                                <strong>{extractTitle(it.content)}</strong>
                                <small>
                                    {it.source_name && <span class="noticia-source">{it.source_name}</span>}
                                    <span>{timeAgo(it.created_at)}</span>
                                </small>
                            </div>
                            <i class="fas fa-arrow-up-right-from-square noticia-ext"></i>
                        </a>
                    </li>
                ))}
            </ul>
            <a href="/foro?f=noticias" class="noticias-more">
                Ver todas <i class="fas fa-chevron-right"></i>
            </a>
        </section>
    );
}
