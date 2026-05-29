import { useLocale } from '../lib/i18n';

export default function LocaleToggle() {
    const [locale, setLocale] = useLocale();
    const next = locale === 'es' ? 'en' : 'es';
    return (
        <button
            class="locale-toggle"
            onClick={() => setLocale(next)}
            title={`Cambiar a ${next === 'en' ? 'English' : 'Español'}`}
            aria-label="Cambiar idioma"
        >
            <i class="fas fa-language"></i>
            <span>{locale.toUpperCase()}</span>
        </button>
    );
}
