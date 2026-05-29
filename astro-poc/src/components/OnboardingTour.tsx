import { useEffect, useState } from 'preact/hooks';

interface Step {
    title: string;
    body: string;
    icon: string;
}

const STEPS: Step[] = [
    {
        icon: 'fa-house',
        title: '¡Bienvenido a Tres Valles!',
        body: 'Este es tu portal comunitario. Aquí ves un feed con los hilos más recientes de todos los foros.',
    },
    {
        icon: 'fa-comments',
        title: 'Foros y subforos',
        body: 'En la sección Foro hay 5 subforos oficiales (General, Noticias, Ayuda, Eventos, Negocios) y puedes crear los tuyos.',
    },
    {
        icon: 'fa-bolt',
        title: 'Entra como invitado',
        body: 'No necesitas crear cuenta. Pulsa "Entrar como invitado" para publicar, dar like, seguir gente y crear subforos.',
    },
    {
        icon: 'fa-magnifying-glass',
        title: 'Buscador global · Ctrl+K',
        body: 'Pulsa "/" o "Ctrl+K" en cualquier momento para buscar hilos, usuarios o foros al instante.',
    },
    {
        icon: 'fa-mountain',
        title: 'Explora Tres Valles',
        body: 'En "Explora" tienes historia, geografía, gastronomía, galería, videos, mapa interactivo y mucho más sobre el municipio.',
    },
];

const STORAGE_KEY = 'tv-onboarding-done';

export default function OnboardingTour() {
    const [active, setActive] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        try {
            const done = localStorage.getItem(STORAGE_KEY) === '1';
            if (!done) {
                const t = setTimeout(() => setActive(true), 800);
                return () => clearTimeout(t);
            }
        } catch { /* */ }
    }, []);

    const finish = () => {
        setActive(false);
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* */ }
    };

    const next = () => {
        if (step >= STEPS.length - 1) finish();
        else setStep(s => s + 1);
    };

    if (!active) return null;
    const s = STEPS[step];

    return (
        <div class="onboarding-overlay" onClick={finish}>
            <div class="onboarding-card" onClick={(e: any) => e.stopPropagation()}>
                <div class="onboarding-icon"><i class={`fas ${s.icon}`}></i></div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <div class="onboarding-progress">
                    {STEPS.map((_, i) => (
                        <span class={`onboarding-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}></span>
                    ))}
                </div>
                <div class="onboarding-actions">
                    <button class="auth-btn ghost small" onClick={finish}>Saltar</button>
                    <button class="auth-btn primary small" onClick={next}>
                        {step >= STEPS.length - 1 ? '¡Listo!' : 'Siguiente'} <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}
