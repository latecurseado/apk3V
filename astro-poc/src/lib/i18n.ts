/**
 * i18n minimal. Strings disponibles en español + inglés.
 * Uso:
 *   import { t, setLocale, useLocale } from '../lib/i18n';
 *   <p>{t('foro.publicar')}</p>
 */
import { useEffect, useState } from 'preact/hooks';

type Locale = 'es' | 'en';
type Dict = Record<string, string>;

const ES: Dict = {
    'nav.inicio':      'Inicio',
    'nav.foro':        'Foro',
    'nav.videos':      'Videos',
    'nav.explora':     'Explora',
    'nav.chat':        'Chat',
    'nav.perfil':      'Perfil',
    'foro.publicar':   'Publicar',
    'foro.comentar':   'Comentar',
    'foro.compartir':  'Compartir',
    'common.cancelar': 'Cancelar',
    'common.guardar':  'Guardar',
    'common.borrar':   'Borrar',
    'common.editar':   'Editar',
    'common.buscar':   'Buscar',
    'common.cargando': 'Cargando…',
    'auth.entrar':     'Entrar como invitado',
    'auth.salir':      'Cerrar sesión',
    'profile.seguir':    'Seguir',
    'profile.siguiendo': 'Siguiendo',
    'profile.mensaje':   'Mensaje',
    'profile.editar':    'Editar perfil',
};

const EN: Dict = {
    'nav.inicio':      'Home',
    'nav.foro':        'Forum',
    'nav.videos':      'Videos',
    'nav.explora':     'Explore',
    'nav.chat':        'Chat',
    'nav.perfil':      'Profile',
    'foro.publicar':   'Post',
    'foro.comentar':   'Comment',
    'foro.compartir':  'Share',
    'common.cancelar': 'Cancel',
    'common.guardar':  'Save',
    'common.borrar':   'Delete',
    'common.editar':   'Edit',
    'common.buscar':   'Search',
    'common.cargando': 'Loading…',
    'auth.entrar':     'Sign in as guest',
    'auth.salir':      'Sign out',
    'profile.seguir':    'Follow',
    'profile.siguiendo': 'Following',
    'profile.mensaje':   'Message',
    'profile.editar':    'Edit profile',
};

const DICTS: Record<Locale, Dict> = { es: ES, en: EN };

let currentLocale: Locale = 'es';
const listeners = new Set<(l: Locale) => void>();

function detectInitial(): Locale {
    if (typeof window === 'undefined') return 'es';
    try {
        const stored = localStorage.getItem('tv-locale') as Locale | null;
        if (stored === 'es' || stored === 'en') return stored;
    } catch { /* */ }
    const browser = (typeof navigator !== 'undefined' ? navigator.language : 'es') || 'es';
    return browser.toLowerCase().startsWith('en') ? 'en' : 'es';
}

if (typeof window !== 'undefined') {
    currentLocale = detectInitial();
}

export function getLocale(): Locale { return currentLocale; }

export function setLocale(l: Locale): void {
    currentLocale = l;
    try { localStorage.setItem('tv-locale', l); } catch { /* */ }
    if (typeof document !== 'undefined') document.documentElement.lang = l === 'en' ? 'en' : 'es-MX';
    listeners.forEach(fn => fn(l));
}

export function t(key: string): string {
    return DICTS[currentLocale][key] || DICTS.es[key] || key;
}

export function useLocale(): [Locale, (l: Locale) => void] {
    const [locale, setLocaleState] = useState<Locale>(currentLocale);
    useEffect(() => {
        listeners.add(setLocaleState);
        return () => { listeners.delete(setLocaleState); };
    }, []);
    return [locale, setLocale];
}
