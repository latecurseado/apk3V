import { useEffect, useRef } from 'preact/hooks';
import { supabase } from '../lib/supabase';

const BUSINESS_ICONS: Record<string, string> = {
    tienda: 'fa-store',
    restaurante: 'fa-utensils',
    servicios: 'fa-handshake-simple',
    profesional: 'fa-user-tie',
    oficio: 'fa-screwdriver-wrench',
    turismo: 'fa-hotel',
    medios: 'fa-newspaper',
    otro: 'fa-briefcase',
};

const TRES_VALLES_CENTER: [number, number] = [18.237, -96.131];
const TRES_VALLES_BOUNDS: [[number, number], [number, number]] = [
    [18.180, -96.180],
    [18.295, -96.080],
];

// Puntos de interés básicos (réplica de los del sitio original)
const POI = [
    { name: 'Palacio Municipal',          lat: 18.2356, lng: -96.1308, icon: 'fa-building-columns', desc: 'Sede del H. Ayuntamiento' },
    { name: 'Parque Central Miguel Hidalgo', lat: 18.2361, lng: -96.1296, icon: 'fa-tree-city',     desc: 'Epicentro social y cultural' },
    { name: 'Parroquia de Cristo Rey',    lat: 18.2348, lng: -96.1318, icon: 'fa-church',           desc: 'Monumento religioso principal' },
    { name: 'Mercado Municipal',          lat: 18.2371, lng: -96.1284, icon: 'fa-store',            desc: 'Vena comercial de la ciudad' },
    { name: 'Hospital IMSS 43',           lat: 18.2412, lng: -96.1252, icon: 'fa-hospital',         desc: 'Atención médica regional' },
    { name: 'Ingenio Tres Valles',        lat: 18.2495, lng: -96.1185, icon: 'fa-industry',         desc: 'PIASA · pilar agroindustrial' },
];

export default function HubMap() {
    const mapEl = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const L = (await import('leaflet')).default;
            if (cancelled || !mapEl.current || mapRef.current) return;

            const map = L.map(mapEl.current, {
                center: TRES_VALLES_CENTER,
                zoom: 14,
                minZoom: 12,
                maxZoom: 18,
                maxBounds: TRES_VALLES_BOUNDS,
                maxBoundsViscosity: 0.9,
                zoomControl: true,
                attributionControl: true,
            });
            mapRef.current = map;

            // Capa CartoDB Dark Matter — combina con el tema oscuro
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap, &copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 19,
            }).addTo(map);

            // Markers con icono personalizado
            POI.forEach(p => {
                const divIcon = L.divIcon({
                    className: 'tv-poi-marker',
                    html: `<div class="tv-poi-inner"><i class="fas ${p.icon}"></i></div>`,
                    iconSize: [38, 38],
                    iconAnchor: [19, 19],
                });
                const marker = L.marker([p.lat, p.lng], { icon: divIcon }).addTo(map);
                marker.bindPopup(
                    `<div class="tv-popup"><b>${p.name}</b><br><small>${p.desc}</small></div>`,
                    { maxWidth: 240 }
                );
            });

            // Negocios de la comunidad (cuentas business con lat/lng)
            const { data: businesses } = await supabase
                .from('profiles')
                .select('id, username, business_name, business_category, business_lat, business_lng, business_address, business_phone, pfp')
                .eq('account_type', 'business')
                .not('business_lat', 'is', null)
                .not('business_lng', 'is', null)
                .limit(80);

            (businesses || []).forEach((b: any) => {
                if (typeof b.business_lat !== 'number' || typeof b.business_lng !== 'number') return;
                const icon = BUSINESS_ICONS[b.business_category] || 'fa-briefcase';
                const divIcon = L.divIcon({
                    className: 'tv-poi-marker business',
                    html: `<div class="tv-poi-inner business"><i class="fas ${icon}"></i></div>`,
                    iconSize: [36, 36],
                    iconAnchor: [18, 18],
                });
                const marker = L.marker([b.business_lat, b.business_lng], { icon: divIcon }).addTo(map);
                const name = b.business_name || b.username;
                marker.bindPopup(`
                    <div class="tv-popup business">
                        <b>${name}</b>
                        <br><small>${b.business_category || 'negocio'} · @${b.username}</small>
                        ${b.business_address ? `<br><small><i class="fas fa-location-dot"></i> ${b.business_address}</small>` : ''}
                        ${b.business_phone ? `<br><small><i class="fas fa-phone"></i> ${b.business_phone}</small>` : ''}
                        <br><a href="/perfil?u=${b.username}" class="tv-popup-link">Ver perfil →</a>
                    </div>
                `, { maxWidth: 260 });
            });

            // Refresh size al final del montaje (a veces Leaflet calcula mal)
            setTimeout(() => map.invalidateSize(), 150);
        })();

        return () => {
            cancelled = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    return <div ref={mapEl} class="hub-map" aria-label="Mapa interactivo de Tres Valles" />;
}
