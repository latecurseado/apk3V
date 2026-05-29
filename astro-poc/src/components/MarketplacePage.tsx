import { useEffect, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import { fetchItems, CATEGORY_LABELS, type MarketItem, type ItemCategory } from '../lib/marketplace';
import { timeAgo } from '../lib/forum';
import { requireAuthOrPrompt } from '../lib/auth-gate';
import MarketplaceComposer from './MarketplaceComposer';
import Avatar from './Avatar';
import AccountBadge from './AccountBadge';

export default function MarketplacePage() {
    const { user } = useSession();
    const [items, setItems] = useState<MarketItem[]>([]);
    const [category, setCategory] = useState<ItemCategory | 'all'>('all');
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(true);
    const [composerOpen, setComposerOpen] = useState(false);

    const refresh = async () => {
        setLoading(true);
        const data = await fetchItems({
            category: category === 'all' ? undefined : category,
            q: q.trim() || undefined,
        });
        setItems(data);
        setLoading(false);
    };

    useEffect(() => { refresh(); }, [category]);

    useEffect(() => {
        const id = setTimeout(() => refresh(), 250);
        return () => clearTimeout(id);
    }, [q]);

    const create = () => {
        if (!requireAuthOrPrompt('publicar artículos', user?.id ?? null)) return;
        setComposerOpen(true);
    };

    const fmtPrice = (price: number, currency = 'MXN') => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
    };

    return (
        <div class="marketplace-page">
            <header class="marketplace-head">
                <div>
                    <h1><i class="fas fa-store"></i> Marketplace</h1>
                    <p>Compra-venta local · de la gente de Tres Valles</p>
                </div>
                <button class="auth-btn primary" onClick={create}>
                    <i class="fas fa-plus"></i> Publicar artículo
                </button>
            </header>

            <div class="marketplace-filters">
                <div class="chat-search" style="max-width: 400px;">
                    <i class="fas fa-magnifying-glass"></i>
                    <input
                        type="search"
                        placeholder="Buscar bici, sillón, lavadora..."
                        value={q}
                        onInput={(e: any) => setQ(e.currentTarget.value)}
                    />
                </div>
                <nav class="search-tabs">
                    <button class={`search-tab ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>
                        <i class="fas fa-globe"></i> <span>Todos</span>
                    </button>
                    {(Object.entries(CATEGORY_LABELS) as Array<[ItemCategory, typeof CATEGORY_LABELS['otros']]>).map(([k, info]) => (
                        <button
                            key={k}
                            class={`search-tab ${category === k ? 'active' : ''}`}
                            onClick={() => setCategory(k)}
                        >
                            <i class={`fas ${info.icon}`}></i> <span>{info.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {loading && <div class="forum-loading"><i class="fas fa-circle-notch fa-spin"></i> Cargando…</div>}

            {!loading && items.length === 0 && (
                <div class="forum-empty">
                    <i class="fas fa-store-slash"></i>
                    <p>Aún no hay artículos {category !== 'all' ? `en ${CATEGORY_LABELS[category].label}` : ''}. ¡Publica el primero!</p>
                </div>
            )}

            <div class="marketplace-grid">
                {items.map(item => (
                    <a class="market-card" key={item.id} href={`#item-${item.id}`}>
                        <div class="market-card-img">
                            {item.images[0]?.url
                                ? <img src={item.images[0].url} alt={item.title} loading="lazy" />
                                : <i class={`fas ${CATEGORY_LABELS[item.category].icon}`}></i>}
                            {item.condition === 'nuevo' && <span class="market-condition new">Nuevo</span>}
                            {item.condition === 'seminuevo' && <span class="market-condition semi">Seminuevo</span>}
                        </div>
                        <div class="market-card-body">
                            <strong class="market-price">{fmtPrice(item.price, item.currency)}</strong>
                            <h3 class="market-title">{item.title}</h3>
                            <small class="market-meta">
                                {item.location && <><i class="fas fa-location-dot"></i> {item.location} · </>}
                                {timeAgo(item.created_at)}
                            </small>
                            {item.seller && (
                                <div class="market-seller">
                                    <Avatar user={item.seller as any} size={22} />
                                    <small>@{item.seller.username}</small>
                                    <AccountBadge
                                        accountType={item.seller.account_type as any}
                                        businessCategory={item.seller.business_category as any}
                                    />
                                </div>
                            )}
                        </div>
                    </a>
                ))}
            </div>

            {composerOpen && (
                <MarketplaceComposer
                    onClose={() => setComposerOpen(false)}
                    onPosted={() => { setComposerOpen(false); refresh(); }}
                />
            )}
        </div>
    );
}
