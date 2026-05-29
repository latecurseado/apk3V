import { useEffect, useRef, useState } from 'preact/hooks';
import { videos } from '../data/videos';

const ROTATE_MS = 12000;

export default function VideoCarousel() {
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);
    const stripRef = useRef<HTMLDivElement>(null);

    // Auto-rotate
    useEffect(() => {
        if (paused) return;
        const id = setInterval(() => {
            setActive(i => (i + 1) % videos.length);
        }, ROTATE_MS);
        return () => clearInterval(id);
    }, [paused]);

    // Scroll the thumbnail strip to keep the active card visible
    useEffect(() => {
        const strip = stripRef.current;
        if (!strip) return;
        const child = strip.children[active] as HTMLElement | undefined;
        if (child) {
            strip.scrollTo({
                left: child.offsetLeft - strip.offsetLeft - 12,
                behavior: 'smooth',
            });
        }
    }, [active]);

    const v = videos[active];

    return (
        <div class="video-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <div class="video-stage">
                <div class="video-frame">
                    <iframe
                        src={`https://www.youtube-nocookie.com/embed/${v.youtube_id}?rel=0`}
                        title={v.title}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>
                <div class="video-meta">
                    <h3>{v.title}</h3>
                    <p>{v.description}</p>
                    <small>
                        <a href={v.source_url} target="_blank" rel="noopener">{v.author}</a>
                        {v.year ? ` · ${v.year}` : ''}
                    </small>
                </div>
            </div>

            <div class="video-strip" ref={stripRef}>
                {videos.map((vid, i) => (
                    <button
                        key={vid.youtube_id}
                        class={`video-thumb ${i === active ? 'active' : ''}`}
                        onClick={() => setActive(i)}
                        title={vid.title}
                    >
                        <img
                            src={`https://i.ytimg.com/vi/${vid.youtube_id}/mqdefault.jpg`}
                            alt={vid.title}
                            loading="lazy"
                        />
                        <span class="video-thumb-title">{vid.title}</span>
                    </button>
                ))}
            </div>

            <div class="video-progress">
                {videos.map((_, i) => (
                    <span class={`video-dot ${i === active ? 'active' : ''}`} />
                ))}
            </div>
        </div>
    );
}
