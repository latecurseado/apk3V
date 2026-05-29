import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';

interface HashTag {
    tag: string;
    count: number;
}

const HASHTAG_RE = /#([a-zA-Z0-9_áéíóúñü]{2,30})/gi;

export default function HashtagsWidget() {
    const [tags, setTags] = useState<HashTag[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
            const { data } = await supabase
                .from('threads')
                .select('content')
                .gte('created_at', since)
                .limit(200);
            if (!alive) return;
            const counter = new Map<string, number>();
            for (const row of (data || []) as any[]) {
                const plain = row.content.replace(/<[^>]+>/g, ' ');
                const matches = plain.matchAll(HASHTAG_RE);
                const seenInThread = new Set<string>();
                for (const m of matches) {
                    const k = m[1].toLowerCase();
                    if (seenInThread.has(k)) continue;
                    seenInThread.add(k);
                    counter.set(k, (counter.get(k) || 0) + 1);
                }
            }
            const sorted = Array.from(counter.entries())
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 8);
            setTags(sorted);
            setLoading(false);
        })();
        return () => { alive = false; };
    }, []);

    if (loading) {
        return (
            <section class="hashtags-widget">
                <h3><i class="fas fa-hashtag"></i> Tags populares</h3>
                <div class="skel sk-line"></div>
            </section>
        );
    }
    if (tags.length === 0) return null;

    const maxCount = tags[0].count;

    return (
        <section class="hashtags-widget">
            <h3><i class="fas fa-hashtag"></i> Tags populares · 7d</h3>
            <div class="hashtags-cloud">
                {tags.map((t, i) => {
                    // tamaño relativo según count (mejor con más detalle visual)
                    const size = 0.78 + (t.count / maxCount) * 0.55;
                    return (
                        <a
                            key={t.tag}
                            href={`/tag?t=${encodeURIComponent(t.tag)}`}
                            class={`hashtag-pill rank-${i}`}
                            style={`font-size: ${size}rem`}
                        >
                            #{t.tag}
                            <span class="hashtag-count">{t.count}</span>
                        </a>
                    );
                })}
            </div>
        </section>
    );
}
