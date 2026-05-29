import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocale } from '../lib/i18n';
import { PushToggle } from './PushOptIn';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import ProtectedFieldsEditor from './ProtectedFieldsEditor';

type Theme = 'dark' | 'light';

function readTheme(): Theme {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('tv-theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(t: Theme) {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('tv-theme', t); } catch { /* */ }
}

export default function SettingsMenu() {
    const { user } = useSession();
    const [open, setOpen] = useState(false);
    const [theme, setTheme] = useState<Theme>('dark');
    const [locale, setLocale] = useLocale();
    const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
    const [reduceMotion, setReduceMotion] = useState(false);
    const [dnd, setDnd] = useState(false);
    const [showProtected, setShowProtected] = useState(false);
    const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setTheme(readTheme());
        try {
            const fs = localStorage.getItem('tv-fs') as 'sm' | 'md' | 'lg' | null;
            if (fs) { setFontSize(fs); document.documentElement.dataset.fs = fs; }
            const rm = localStorage.getItem('tv-rm') === '1';
            setReduceMotion(rm);
            if (rm) document.documentElement.dataset.rm = '1';
            const dn = localStorage.getItem('tv-density');
            if (dn === 'compact') { setDensity('compact'); document.documentElement.dataset.density = 'compact'; }
        } catch { /* */ }
    }, []);

    const changeDensity = (d: 'comfortable' | 'compact') => {
        setDensity(d);
        if (d === 'compact') document.documentElement.dataset.density = 'compact';
        else delete document.documentElement.dataset.density;
        try { localStorage.setItem('tv-density', d); } catch { /* */ }
    };

    // DND: lee del perfil al cargar
    useEffect(() => {
        if (!user) return;
        supabase.from('profiles').select('dnd_mode').eq('id', user.id).single()
            .then(({ data }) => { if (data) setDnd(!!data.dnd_mode); });
    }, [user?.id]);

    const toggleDnd = async () => {
        if (!user) return;
        const next = !dnd;
        setDnd(next);
        await supabase.from('profiles').update({ dnd_mode: next }).eq('id', user.id);
    };

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const changeTheme = (t: Theme) => { setTheme(t); applyTheme(t); };
    const changeFontSize = (fs: 'sm' | 'md' | 'lg') => {
        setFontSize(fs);
        document.documentElement.dataset.fs = fs;
        try { localStorage.setItem('tv-fs', fs); } catch { /* */ }
    };
    const toggleReduceMotion = () => {
        const next = !reduceMotion;
        setReduceMotion(next);
        if (next) document.documentElement.dataset.rm = '1';
        else delete document.documentElement.dataset.rm;
        try { localStorage.setItem('tv-rm', next ? '1' : '0'); } catch { /* */ }
    };

    return (
        <div class="settings-menu-wrap" ref={wrapRef}>
            <button class="settings-trigger" onClick={() => setOpen(o => !o)} title="Ajustes" aria-label="Ajustes">
                <i class="fas fa-gear"></i>
            </button>
            {open && (
                <div class="settings-menu-dropdown">
                    <h4><i class="fas fa-palette"></i> Tema</h4>
                    <div class="settings-row">
                        <button class={`settings-pill ${theme === 'dark' ? 'active' : ''}`} onClick={() => changeTheme('dark')}>
                            <i class="fas fa-moon"></i> Oscuro
                        </button>
                        <button class={`settings-pill ${theme === 'light' ? 'active' : ''}`} onClick={() => changeTheme('light')}>
                            <i class="fas fa-sun"></i> Claro
                        </button>
                    </div>

                    <h4><i class="fas fa-language"></i> Idioma</h4>
                    <div class="settings-row">
                        <button class={`settings-pill ${locale === 'es' ? 'active' : ''}`} onClick={() => setLocale('es')}>🇲🇽 Español</button>
                        <button class={`settings-pill ${locale === 'en' ? 'active' : ''}`} onClick={() => setLocale('en')}>🇺🇸 English</button>
                    </div>

                    <h4><i class="fas fa-text-height"></i> Tamaño texto</h4>
                    <div class="settings-row">
                        <button class={`settings-pill ${fontSize === 'sm' ? 'active' : ''}`} onClick={() => changeFontSize('sm')}>A−</button>
                        <button class={`settings-pill ${fontSize === 'md' ? 'active' : ''}`} onClick={() => changeFontSize('md')}>A</button>
                        <button class={`settings-pill ${fontSize === 'lg' ? 'active' : ''}`} onClick={() => changeFontSize('lg')}>A+</button>
                    </div>

                    <h4><i class="fas fa-down-left-and-up-right-to-center"></i> Densidad</h4>
                    <div class="settings-row">
                        <button class={`settings-pill ${density === 'comfortable' ? 'active' : ''}`} onClick={() => changeDensity('comfortable')}>
                            <i class="fas fa-up-right-and-down-left-from-center"></i> Cómoda
                        </button>
                        <button class={`settings-pill ${density === 'compact' ? 'active' : ''}`} onClick={() => changeDensity('compact')}>
                            <i class="fas fa-compress"></i> Compacta
                        </button>
                    </div>


                    <h4><i class="fas fa-universal-access"></i> Accesibilidad</h4>
                    <label class="settings-toggle">
                        <input type="checkbox" checked={reduceMotion} onChange={toggleReduceMotion} />
                        <span>Reducir animaciones</span>
                    </label>

                    <h4><i class="fas fa-bell"></i> Notificaciones</h4>
                    <PushToggle />
                    {user && (
                        <label class="settings-toggle" style="margin-top:6px;">
                            <input type="checkbox" checked={dnd} onChange={toggleDnd} />
                            <span>
                                <i class="fas fa-moon"></i> No molestar
                                <small class="auth-hint" style="display:block;margin-top:2px;">
                                    Oculta tu estado en línea y silencia pushes
                                </small>
                            </span>
                        </label>
                    )}

                    {user && (
                        <>
                            <h4><i class="fas fa-shield-halved"></i> Datos protegidos</h4>
                            <button
                                class="settings-pill block"
                                onClick={() => { setShowProtected(true); setOpen(false); }}
                                style="width:100%; justify-content:flex-start; gap:8px;"
                            >
                                <i class="fas fa-lock"></i>
                                Edad · país · tipo cuenta
                                <i class="fas fa-chevron-right" style="margin-left:auto;"></i>
                            </button>
                            <small class="auth-hint" style="display:block; margin-top:4px;">
                                Datos sensibles con cooldown · primera vez gratis, luego bloqueados por X días
                            </small>
                        </>
                    )}

                    <div class="settings-foot">
                        <a href="https://es.wikipedia.org/wiki/Tres_Valles_(Veracruz)" target="_blank" rel="noopener">
                            <i class="fas fa-circle-info"></i> Sobre Tres Valles
                        </a>
                    </div>
                </div>
            )}

            {showProtected && (
                <ProtectedFieldsEditor onClose={() => setShowProtected(false)} />
            )}
        </div>
    );
}
