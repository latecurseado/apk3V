import { videos } from '../data/videos';

/**
 * Tira horizontal de Shorts estilo YouTube — se embebe dentro del feed
 * de Inicio. Click en una tarjeta → abre el visor TikTok-style en /reels
 * directamente en ese video.
 */
export default function ShortsStrip() {
    if (!videos || videos.length === 0) return null;

    return (
        <section class="shorts-strip-section">
            <header class="shorts-strip-head">
                <h3>
                    <span class="shorts-logo">
                        <i class="fas fa-bolt"></i>
                    </span>
                    Shorts
                </h3>
                <a class="shorts-strip-more" href="/reels">
                    Ver todos <i class="fas fa-chevron-right"></i>
                </a>
            </header>

            <div class="shorts-strip">
                {videos.map((v, i) => (
                    <a
                        class="short-card"
                        href={`/reels?v=${i}`}
                        key={v.youtube_id}
                        title={v.title}
                    >
                        <div class="short-card-thumb">
                            <img
                                class="lazy-blur"
                                src={`https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`}
                                alt={v.title}
                                loading="lazy"
                                decoding="async"
                                onLoad={(e: any) => e.currentTarget.classList.add('loaded')}
                            />
                            <div class="short-card-overlay">
                                <span class="short-card-play">
                                    <i class="fas fa-play"></i>
                                </span>
                                <h4>{v.title}</h4>
                            </div>
                        </div>
                        <div class="short-card-meta">
                            <small>@{v.author}{v.year ? ` · ${v.year}` : ''}</small>
                        </div>
                    </a>
                ))}
            </div>
        </section>
    );
}
