/* ============================================================
   Registro ÚNICO de widgets del inicio.
   Fuente de verdad para: el renderer (DynamicWidgets) y la UI del
   customizer (bandeja de "añadir"). Cada widget se describe una vez.
   ============================================================ */
import StreakWidget from '../components/StreakWidget';
import NoticiasWidget from '../components/NoticiasWidget';
import TrendingWidget from '../components/TrendingWidget';
import EventsWidget from '../components/EventsWidget';
import HashtagsWidget from '../components/HashtagsWidget';
import OnlineUsersWidget from '../components/OnlineUsersWidget';
import ProfileCompleteness from '../components/ProfileCompleteness';

export interface WidgetMeta {
    id: string;
    label: string;
    icon: string;          // clase Font Awesome, ej. 'fa-fire'
    description: string;
    render: (ctx: { onEdit?: () => void }) => any;
    authOnly?: boolean;    // solo tiene sentido con sesión iniciada
}

export const WIDGET_REGISTRY: WidgetMeta[] = [
    {
        id: 'completeness', label: 'Tu perfil', icon: 'fa-circle-user',
        description: 'Tu progreso para completar el perfil', authOnly: true,
        render: ({ onEdit }) => <ProfileCompleteness onEdit={onEdit} />,
    },
    {
        id: 'streak', label: 'Racha', icon: 'fa-fire',
        description: 'Tus días seguidos en el pueblo', authOnly: true,
        render: () => <StreakWidget />,
    },
    {
        id: 'noticias', label: 'Noticias', icon: 'fa-newspaper',
        description: 'Lo último de Tres Valles',
        render: () => <NoticiasWidget />,
    },
    {
        id: 'trending', label: 'Tendencias', icon: 'fa-arrow-trend-up',
        description: 'Los hilos calientes ahora mismo',
        render: () => <TrendingWidget />,
    },
    {
        id: 'events', label: 'Eventos', icon: 'fa-calendar-day',
        description: 'Qué se arma en el pueblo',
        render: () => <EventsWidget />,
    },
    {
        id: 'hashtags', label: 'Etiquetas', icon: 'fa-hashtag',
        description: 'Los temas del momento',
        render: () => <HashtagsWidget />,
    },
    {
        id: 'online', label: 'En línea', icon: 'fa-circle-dot',
        description: 'Quién anda conectado ahora',
        render: () => <OnlineUsersWidget />,
    },
];

export const WIDGET_MAP: Record<string, WidgetMeta> =
    Object.fromEntries(WIDGET_REGISTRY.map(w => [w.id, w]));

export const ALL_WIDGET_IDS: string[] = WIDGET_REGISTRY.map(w => w.id);
