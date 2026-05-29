import { supabase } from './supabase';
import { exploraDefault } from '../data/explora-default';
import { inicioDefault } from '../data/inicio-default';

export interface Section {
    id: string;
    page_slug: string;
    section_key: string;
    title: string;
    icon: string;
    sort_order: number;
    body: string;
    updated_at: string;
    updated_by: string | null;
}

export async function fetchSections(pageSlug: string): Promise<Section[]> {
    const { data, error } = await supabase
        .from('content_sections')
        .select('*')
        .eq('page_slug', pageSlug)
        .order('sort_order', { ascending: true });
    if (error) {
        console.error('[cms] fetchSections:', error);
        return [];
    }
    return (data || []) as Section[];
}

export async function updateSection(
    id: string,
    patch: Partial<Pick<Section, 'title' | 'icon' | 'body' | 'sort_order'>>,
): Promise<{ ok: boolean; reason?: string }> {
    const { error } = await supabase.from('content_sections').update(patch).eq('id', id);
    if (error) {
        console.error('[cms] updateSection:', error);
        return { ok: false, reason: error.message };
    }
    return { ok: true };
}

export async function deleteSection(id: string): Promise<boolean> {
    const { error } = await supabase.from('content_sections').delete().eq('id', id);
    if (error) console.error('[cms] deleteSection:', error);
    return !error;
}

export async function insertSection(
    s: { page_slug: string; section_key: string; title: string; icon: string; sort_order: number; body: string },
): Promise<{ ok: boolean; reason?: string }> {
    const { error } = await supabase.from('content_sections').insert(s);
    if (error) {
        console.error('[cms] insertSection:', error);
        return { ok: false, reason: error.message };
    }
    return { ok: true };
}

export async function isAdmin(): Promise<boolean> {
    const { data, error } = await supabase.rpc('am_i_admin');
    if (error) {
        console.warn('[cms] am_i_admin:', error);
        return false;
    }
    return data === true;
}

/**
 * Convierte un título a un section_key válido (sin acentos, espacios, etc.).
 * Si ya existe en `existing`, le añade un sufijo numérico.
 */
export function slugify(title: string, existing: Set<string> = new Set()): string {
    const base = title
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'seccion';
    if (!existing.has(base)) return base;
    let i = 2;
    while (existing.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
}

/**
 * Sube o baja una sección intercambiando `sort_order` con la vecina.
 */
export async function moveSection(
    sections: Section[],
    id: string,
    direction: 'up' | 'down',
): Promise<boolean> {
    const idx = sections.findIndex(s => s.id === id);
    if (idx === -1) return false;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return false;
    const a = sections[idx];
    const b = sections[swapIdx];
    const [r1, r2] = await Promise.all([
        supabase.from('content_sections').update({ sort_order: b.sort_order }).eq('id', a.id),
        supabase.from('content_sections').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    return !r1.error && !r2.error;
}

/**
 * Inserta todas las secciones por defecto de Explora si la tabla está vacía
 * para esa página. Solo funciona si el usuario actual es admin (RLS).
 */
export async function seedExploraDefaults() {
    return seedDefaults('explora', exploraDefault);
}

export async function seedInicioDefaults() {
    return seedDefaults('inicio', inicioDefault);
}

async function seedDefaults(
    pageSlug: string,
    rows: Array<{ section_key: string; title: string; icon: string; sort_order: number; body: string }>,
): Promise<{ ok: boolean; inserted: number; reason?: string }> {
    const existing = await fetchSections(pageSlug);
    if (existing.length > 0) {
        return { ok: false, inserted: 0, reason: 'Ya hay secciones en la BD para esta página' };
    }
    const payload = rows.map(r => ({ ...r, page_slug: pageSlug }));
    const { error } = await supabase.from('content_sections').insert(payload);
    if (error) {
        console.error('[cms] seedDefaults', pageSlug, ':', error);
        return { ok: false, inserted: 0, reason: error.message };
    }
    return { ok: true, inserted: payload.length };
}
