import { useEffect, useState } from 'preact/hooks';

interface Weather {
    temp: number;
    code: number;
    isDay: number;
    wind: number;
}

const WMO: Record<number, { icon: string; label: string }> = {
    0:  { icon: 'fa-sun',           label: 'Despejado' },
    1:  { icon: 'fa-sun',           label: 'Mayormente despejado' },
    2:  { icon: 'fa-cloud-sun',     label: 'Parcialmente nublado' },
    3:  { icon: 'fa-cloud',         label: 'Nublado' },
    45: { icon: 'fa-smog',          label: 'Niebla' },
    48: { icon: 'fa-smog',          label: 'Niebla helada' },
    51: { icon: 'fa-cloud-rain',    label: 'Llovizna ligera' },
    53: { icon: 'fa-cloud-rain',    label: 'Llovizna' },
    55: { icon: 'fa-cloud-showers-heavy', label: 'Llovizna intensa' },
    61: { icon: 'fa-cloud-rain',    label: 'Lluvia ligera' },
    63: { icon: 'fa-cloud-showers-heavy', label: 'Lluvia' },
    65: { icon: 'fa-cloud-showers-heavy', label: 'Lluvia intensa' },
    80: { icon: 'fa-cloud-showers-water', label: 'Chubascos' },
    81: { icon: 'fa-cloud-showers-water', label: 'Chubascos fuertes' },
    82: { icon: 'fa-cloud-showers-water', label: 'Chubascos violentos' },
    95: { icon: 'fa-cloud-bolt',    label: 'Tormenta' },
    96: { icon: 'fa-cloud-bolt',    label: 'Tormenta con granizo' },
    99: { icon: 'fa-cloud-bolt',    label: 'Tormenta severa' },
};

const TRES_VALLES = { lat: 18.237, lon: -96.131 };
const REFRESH_MS = 10 * 60 * 1000;

export default function WeatherWidget() {
    const [w, setW] = useState<Weather | null>(null);
    const [err, setErr] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${TRES_VALLES.lat}&longitude=${TRES_VALLES.lon}&current=temperature_2m,weather_code,is_day,wind_speed_10m&timezone=auto`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('weather fetch failed');
                const j = await res.json();
                if (cancelled) return;
                setW({
                    temp: Math.round(j.current.temperature_2m),
                    code: j.current.weather_code,
                    isDay: j.current.is_day,
                    wind: Math.round(j.current.wind_speed_10m),
                });
                setErr(false);
            } catch (e) {
                if (!cancelled) setErr(true);
                console.warn('[weather]', e);
            }
        };
        load();
        const id = setInterval(load, REFRESH_MS);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    if (err && !w) {
        return null;
    }
    if (!w) {
        return <span class="weather-widget loading"><i class="fas fa-circle-notch fa-spin"></i></span>;
    }

    const meta = WMO[w.code] ?? { icon: 'fa-cloud', label: 'Tres Valles' };

    return (
        <span class="weather-widget" title={`${meta.label} · viento ${w.wind} km/h · Tres Valles`}>
            <i class={`fas ${meta.icon}`}></i>
            <span class="weather-temp">{w.temp}°</span>
            <span class="weather-label">{meta.label}</span>
        </span>
    );
}
