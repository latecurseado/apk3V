/**
 * Lugares de interés de Tres Valles · usados por el bot para sugerir
 * ubicaciones precisas con coordenadas y link al mapa.
 */

export interface PlaceTv {
    slug: string;
    name: string;
    lat: number;
    lng: number;
    icon: string;
    type: 'gobierno' | 'cultura' | 'comercio' | 'salud' | 'industria' | 'naturaleza' | 'religion' | 'recreacion';
    description: string;
    keywords: string[]; // términos que cuando aparecen en respuesta del bot, lo enlazamos
}

export const PLACES_TV: PlaceTv[] = [
    {
        slug: 'palacio-municipal',
        name: 'Palacio Municipal',
        lat: 18.2356, lng: -96.1308,
        icon: 'fa-building-columns', type: 'gobierno',
        description: 'Sede del H. Ayuntamiento de Tres Valles · trámites y servicios oficiales',
        keywords: ['palacio municipal', 'ayuntamiento', 'alcaldía', 'presidencia municipal'],
    },
    {
        slug: 'parque-central',
        name: 'Parque Central Miguel Hidalgo',
        lat: 18.2361, lng: -96.1296,
        icon: 'fa-tree-city', type: 'recreacion',
        description: 'Epicentro social y cultural del pueblo · kiosko, bancas, eventos',
        keywords: ['parque', 'parque central', 'kiosko', 'plaza', 'hidalgo'],
    },
    {
        slug: 'parroquia-cristo-rey',
        name: 'Parroquia de Cristo Rey',
        lat: 18.2348, lng: -96.1318,
        icon: 'fa-church', type: 'religion',
        description: 'Templo católico principal de Tres Valles · misas dominicales',
        keywords: ['iglesia', 'parroquia', 'cristo rey', 'misa', 'templo'],
    },
    {
        slug: 'mercado-municipal',
        name: 'Mercado Municipal',
        lat: 18.2371, lng: -96.1284,
        icon: 'fa-store', type: 'comercio',
        description: 'Mercado tradicional · frutas, verduras, comida típica, abarrotes',
        keywords: ['mercado', 'mercado municipal', 'comida', 'frutas', 'verduras'],
    },
    {
        slug: 'imss-43',
        name: 'Hospital IMSS HGZ 43',
        lat: 18.2412, lng: -96.1252,
        icon: 'fa-hospital', type: 'salud',
        description: 'Hospital General de Zona 43 del IMSS · atención médica regional',
        keywords: ['hospital', 'imss', 'doctor', 'urgencias', 'clínica'],
    },
    {
        slug: 'ingenio-tres-valles',
        name: 'Ingenio Tres Valles · PIASA',
        lat: 18.2495, lng: -96.1185,
        icon: 'fa-industry', type: 'industria',
        description: 'Pilar agroindustrial · zafra de caña · uno de los ingenios más grandes de Veracruz',
        keywords: ['ingenio', 'piasa', 'azúcar', 'caña', 'zafra', 'fábrica'],
    },
    {
        slug: 'rio-papaloapan',
        name: 'Río Papaloapan',
        lat: 18.2289, lng: -96.1100,
        icon: 'fa-water', type: 'naturaleza',
        description: 'Río de la cuenca · pesca, paseos, gastronomía ribereña',
        keywords: ['papaloapan', 'rio', 'agua', 'pesca', 'ribera'],
    },
];

/** Detecta menciones de lugares en un texto y devuelve los matchs. */
export function detectPlaces(text: string): PlaceTv[] {
    const lower = text.toLowerCase();
    const found = new Set<string>();
    const result: PlaceTv[] = [];
    for (const p of PLACES_TV) {
        for (const kw of p.keywords) {
            if (lower.includes(kw) && !found.has(p.slug)) {
                found.add(p.slug);
                result.push(p);
                break;
            }
        }
    }
    return result;
}

export function placeMapUrl(p: PlaceTv): string {
    return `/explora?lat=${p.lat}&lng=${p.lng}&place=${p.slug}#hub-mapa`;
}
