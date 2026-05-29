import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/forum';

interface EventItem {
    id: string;
    content: string;
    created_at: string;
    detected_date: Date | null;
    title: string;
}

const DATE_RE = /\b([0-3]?\d)[\/\-\s]+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|0?[1-9]|1[0-2])(?:[\/\-\s]+(?:de\s+)?(\d{2,4}))?\b/i;
const MONTHS: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

function parseEventDate(text: string): Date | null {
    const m = text.match(DATE_RE);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const monStr = m[2].toLowerCase();
    let month: number;
    if (MONTHS[monStr] !== undefined) month = MONTHS[monStr];
    else month = parseInt(monStr, 10) - 1;
    if (isNaN(month) || month < 0 || month > 11) return null;
    let year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day, 19, 0); // default 19:00
    if (isNaN(d.getTime())) return null;
    // Si la fecha ya pasó por más de 1 día y no había año explícito, asume el siguiente año
    if (!m[3] && d.getTime() < Date.now() - 24 * 3600 * 1000) {
        d.setFullYear(year + 1);
    }
    return d;
}

function countdown(target: Date): string {
    const ms = target.getTime() - Date.now();
    if (ms <= 0) return '¡ahora!';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    if (d > 0) return `en ${d}d ${h}h`;
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `en ${h}h ${m}m`;
    return `en ${m}m`;
}

/**
 * Lee hilos recientes del foro #eventos · extrae fechas del contenido (regex
 * en español) · ordena por proximidad y muestra los 4 más cercanos.
 */
export default function EventsWidget() {
    const [events, setEvents] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            const { data } = await supabase
                .from('threads')
                .select('id, content, created_at')
                .eq('category', 'eventos')
                .order('created_at', { ascending: false })
                .limit(30);
            if (!alive) return;
            const parsed: EventItem[] = (data || []).map((row: any) => {
                const plain = row.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                const date = parseEventDate(plain);
                const titleMatch = plain.match(/\*\*(.+?)\*\*/) || plain.match(/^([^\n.!?]+)/);
                return {
                    id: row.id,
                    content: plain,
                    created_at: row.created_at,
                    detected_date: date,
                    title: titleMatch ? titleMatch[1].slice(0, 60) : plain.slice(0, 60),
                };
            });
            // Solo futuros (o sin fecha pero recientes)
            const filtered = parsed.filter(e => !e.detected_date || e.detected_date.getTime() > Date.now() - 12 * 3600 * 1000);
            // Ordena: con fecha primero (los más próximos), luego sin fecha por reciencia
            filtered.sort((a, b) => {
                if (a.detected_date && b.detected_date) return a.detected_date.getTime() - b.detected_date.getTime();
                if (a.detected_date) return -1;
                if (b.detected_date) return 1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
            setEvents(filtered.slice(0, 4));
            setLoading(false);
        })();
        return () => { alive = false; };
    }, []);

    if (loading) {
        return (
            <section class="events-widget">
                <h3><i class="fas fa-calendar-days"></i> Próximos eventos</h3>
                <div class="skel sk-line"></div>
                <div class="skel sk-line short"></div>
            </section>
        );
    }
    if (events.length === 0) {
        return (
            <section class="events-widget">
                <h3><i class="fas fa-calendar-days"></i> Próximos eventos</h3>
                <p class="events-empty">
                    No hay eventos por ahora.
                    <a href="/foro?f=eventos">Publica uno →</a>
                </p>
            </section>
        );
    }

    return (
        <section class="events-widget">
            <h3><i class="fas fa-calendar-days"></i> Próximos eventos</h3>
            <ul class="events-list">
                {events.map(e => (
                    <li key={e.id}>
                        <a href={`/hilo?id=${e.id}`} class="event-link">
                            <div class="event-date">
                                {e.detected_date ? (
                                    <>
                                        <strong>{e.detected_date.getDate()}</strong>
                                        <small>{e.detected_date.toLocaleString('es-MX', { month: 'short' }).replace('.', '')}</small>
                                    </>
                                ) : (
                                    <i class="far fa-calendar"></i>
                                )}
                            </div>
                            <div class="event-body">
                                <strong>{e.title}</strong>
                                <small>
                                    {e.detected_date
                                        ? <><i class="far fa-clock"></i> {countdown(e.detected_date)}</>
                                        : <>publicado {timeAgo(e.created_at)}</>}
                                </small>
                            </div>
                        </a>
                    </li>
                ))}
            </ul>
            <a href="/foro?f=eventos" class="events-more">
                Ver todos los eventos <i class="fas fa-chevron-right"></i>
            </a>
        </section>
    );
}
