import { supabase } from './supabase';

export type ItemCategory = 'electronica' | 'muebles' | 'vehiculos' | 'ropa' | 'servicios' | 'comida' | 'animales' | 'inmuebles' | 'herramientas' | 'otros';
export type ItemCondition = 'nuevo' | 'seminuevo' | 'usado';
export type ItemStatus = 'active' | 'sold' | 'paused' | 'removed';

export interface MarketItem {
    id: string;
    seller_id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    category: ItemCategory;
    condition: ItemCondition;
    location: string;
    images: { url: string; name?: string }[];
    status: ItemStatus;
    contact_dm: boolean;
    contact_phone: string;
    views: number;
    created_at: string;
    seller?: { id: string; username: string; pfp: string | null; account_type?: string; business_category?: string };
}

export const CATEGORY_LABELS: Record<ItemCategory, { label: string; icon: string }> = {
    electronica:  { label: 'Electrónica',  icon: 'fa-mobile-screen' },
    muebles:      { label: 'Muebles',      icon: 'fa-couch' },
    vehiculos:    { label: 'Vehículos',    icon: 'fa-car' },
    ropa:         { label: 'Ropa',         icon: 'fa-shirt' },
    servicios:    { label: 'Servicios',    icon: 'fa-handshake-simple' },
    comida:       { label: 'Comida',       icon: 'fa-utensils' },
    animales:     { label: 'Animales',     icon: 'fa-paw' },
    inmuebles:    { label: 'Inmuebles',    icon: 'fa-house' },
    herramientas: { label: 'Herramientas', icon: 'fa-screwdriver-wrench' },
    otros:        { label: 'Otros',        icon: 'fa-box' },
};

export async function fetchItems(filters: { category?: ItemCategory; sellerId?: string; q?: string; limit?: number } = {}): Promise<MarketItem[]> {
    let q = supabase
        .from('marketplace_items')
        .select('*, seller:profiles!marketplace_items_seller_id_fkey(id, username, pfp, account_type, business_category)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(filters.limit ?? 40);
    if (filters.category) q = q.eq('category', filters.category);
    if (filters.sellerId) q = q.eq('seller_id', filters.sellerId);
    if (filters.q && filters.q.trim()) {
        q = q.or(`title.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
    }
    const { data, error } = await q;
    if (error) { console.error('[marketplace] fetch:', error); return []; }
    return ((data || []) as any[]).map(it => ({
        ...it,
        images: Array.isArray(it.images) ? it.images : [],
    }));
}

export async function fetchItem(id: string): Promise<MarketItem | null> {
    const { data } = await supabase
        .from('marketplace_items')
        .select('*, seller:profiles!marketplace_items_seller_id_fkey(id, username, pfp, account_type, business_category)')
        .eq('id', id)
        .maybeSingle();
    if (!data) return null;
    return { ...(data as any), images: Array.isArray((data as any).images) ? (data as any).images : [] };
}

export async function createItem(item: {
    title: string; description: string; price: number; category: ItemCategory;
    condition: ItemCondition; location: string; images: any[]; contact_phone?: string;
}): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from('marketplace_items').insert({
        seller_id: user.id,
        ...item,
    }).select('id').single();
    if (error) { console.error('[marketplace] create:', error); return null; }
    return data?.id ?? null;
}

export async function updateItemStatus(id: string, status: ItemStatus): Promise<boolean> {
    const { error } = await supabase.from('marketplace_items').update({ status }).eq('id', id);
    return !error;
}

export async function deleteItem(id: string): Promise<boolean> {
    const { error } = await supabase.from('marketplace_items').delete().eq('id', id);
    return !error;
}
