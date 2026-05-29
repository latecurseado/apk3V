import { useEffect, useState } from 'preact/hooks';
import { search, highlight, type SearchResults } from '../lib/search';
import { timeAgo } from '../lib/forum';
import Avatar from './Avatar';

type Tab = 'todos' | 'hilos' | 'usuarios' | 'foros' | 'noticias';

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'todos',     label: 'Todos',     icon: 'fa-globe' },
    { id: 'hilos',     label: 'Hilos',     icon: 'fa-comment' },
    { id: 'usuarios',  label: 'Usuarios',  icon: 'fa-user-group' },
    { id: 'foros',     label: 'Foros',     icon: 'fa-hashtag' },
    { id: 'noticias',  label: 'Noticias',  icon: 'fa-newspaper' },
];

export default function SearchPage() {
    const [q, setQ] = useState('');
    const [tab, setTab] = useState<Tab>('todos');
    const [results, setResults] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        setQ(sp.get('q') || '');
        const t = sp.get('tab') as Tab | null;
        if (t && TABS.some(x => x.id === t)) setTab(t);
    }, []);

    useEffect(() => {
        const term = q.trim();
        if (!term) { setResults(null); return; }
        setLoading(true);
        const id = setTimeout(async () => {
            setResults(await search(term, { limit: 30 }));
            setLoading(false);
            const url = new URL(window.location.href);
            url.searchParams.set('q', term);
            url.searchParams.set('tab', tab);
            window.history.replaceState({}, '', url);
        }, 250);
        return () => clearTimeout(id);
    }, [q, tab]);

    // Filtra noticias del set de hilos (is_bot + category=noticias)
    const newsHits = results?.threads.filter((t: any) => t.is_bot && t.category === 'noticias') || [];
    const threadHits = results?.threads.filter((t: any) => !t.is_bot) || [];

    const counts = {
        todos: results?.total || 0,
        hilos: threadHits.length,
        usuarios: results?.profiles.length || 0,
        foros: results?.forums.length || 0,
        noticias: newsHits.length,
    };

    return (
        <div class="search-page">
            <div class="search-page-input">
                <i class="fas fa-magnifying-glass"></i>
                <input
                    type="search"
                    placeholder="Buscar en todo Tres Valles…"
                    value={q}
                    onInput={(e: any) => setQ(e.currentTarget.value)}
                    autoFocus
                />
            </div>

            {q.trim() && (
                <nav class="search-tabs">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            class={`search-tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            <i class={`fas ${t.icon}`}></i>
                            <span>{t.label}</span>
                            {counts[t.id] > 0 && <span class="search-tab-count">{counts[t.id]}</span>}
                        </button>
                    ))}
                </nav>
            )}

            {!q.trim() && (
                <div class="search-empty-state">
                    <i class="fas fa-magnifying-glass"></i>
                    <h3>Busca hilos, usuarios, foros o noticias</h3>
                    <p>Escribe arriba para empezar. Pulsa <kbd>Ctrl+K</kbd> desde cualquier página.</p>
                </div>
            )}

            {loading && <div class="forum-loading"><i class="fas fa-circle-notch fa-spin"></i> Buscando…</div>}

            {!loading && results && q.trim() && (
                <div class="search-results">
                    <h2 class="search-summary">
                        {results.total} resultados para <span>"{q}"</span>
                    </h2>

                    {(tab === 'todos' || tab === 'foros') && results.forums.length > 0 && (
                        <section class="search-section">
                            <h3><i class="fas fa-hashtag"></i> Foros · {results.forums.length}</h3>
                            <div class="search-grid">
                                {results.forums.map(f => (
                                    <a key={f.id} class="search-card" href={`/foro?f=${f.slug}`}>
                                        <div class="search-card-icon"><i class={`fas ${f.icon}`}></i></div>
                                        <strong dangerouslySetInnerHTML={{ __html: highlight(f.name, q) }} />
                                        <p dangerouslySetInnerHTML={{ __html: highlight((f.description || '').slice(0, 100), q) }} />
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}

                    {(tab === 'todos' || tab === 'usuarios') && results.profiles.length > 0 && (
                        <section class="search-section">
                            <h3><i class="fas fa-user-group"></i> Usuarios · {results.profiles.length}</h3>
                            <div class="search-grid users">
                                {results.profiles.map(p => (
                                    <a class="search-card user" key={p.id} href={`/perfil?u=${p.username}`}>
                                        <div class="search-card-avatar">
                                            <Avatar user={p as any} size={48} />
                                        </div>
                                        <strong dangerouslySetInnerHTML={{ __html: highlight(p.username || 'Anónimo', q) }} />
                                        <small>{p.role === 'admin' ? 'Admin' : 'Miembro'}</small>
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}

                    {(tab === 'todos' || tab === 'hilos') && threadHits.length > 0 && (
                        <section class="search-section">
                            <h3><i class="fas fa-comment"></i> Hilos · {threadHits.length}</h3>
                            <div class="search-thread-list">
                                {threadHits.map((t: any) => {
                                    const author = t.author?.username || 'Anónimo';
                                    const slug = t.category || 'general';
                                    return (
                                        <a key={t.id} class="search-thread" href={`/hilo?id=${t.id}`}>
                                            <header>
                                                <strong>{author}</strong>
                                                <small>{timeAgo(t.created_at)} · en #{slug}</small>
                                            </header>
                                            <div dangerouslySetInnerHTML={{ __html: highlight(t.content.slice(0, 240), q) }} />
                                        </a>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {(tab === 'todos' || tab === 'noticias') && newsHits.length > 0 && (
                        <section class="search-section">
                            <h3><i class="fas fa-newspaper"></i> Noticias · {newsHits.length}</h3>
                            <div class="search-thread-list">
                                {newsHits.map((t: any) => (
                                    <a key={t.id} class="search-thread news" href={t.source_url || `/hilo?id=${t.id}`} target={t.source_url ? '_blank' : '_self'} rel="noopener">
                                        <header>
                                            <strong>📰 {t.source_name || 'Noticia'}</strong>
                                            <small>{timeAgo(t.created_at)}</small>
                                        </header>
                                        <div dangerouslySetInnerHTML={{ __html: highlight(t.content.slice(0, 240), q) }} />
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}

                    {results.total === 0 && (
                        <div class="search-empty-state">
                            <i class="fas fa-circle-exclamation"></i>
                            <h3>Sin resultados</h3>
                            <p>No encontré nada para <b>"{q}"</b>. Prueba con otra palabra.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
