import { useEffect, useState } from 'preact/hooks';
import TagFeed from './TagFeed';

export default function TagFeedWrapper() {
    const [tag, setTag] = useState<string | null>(null);

    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        setTag(sp.get('q')?.toLowerCase() || 'general');
        const onPop = () => {
            const sp2 = new URLSearchParams(window.location.search);
            setTag(sp2.get('q')?.toLowerCase() || 'general');
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    if (!tag) return <div class="cms-loading">Cargando…</div>;
    return <TagFeed tag={tag} />;
}
