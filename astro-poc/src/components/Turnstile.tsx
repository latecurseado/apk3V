import { useEffect, useRef } from 'preact/hooks';

declare global {
    interface Window {
        turnstile?: {
            render: (el: HTMLElement, opts: any) => string;
            remove: (widgetId: string) => void;
        };
        onTurnstileLoad?: () => void;
    }
}

interface Props {
    siteKey: string;        // Cloudflare Dashboard → Turnstile → Site key (público)
    onVerify: (token: string) => void;
    theme?: 'light' | 'dark' | 'auto';
}

/**
 * Widget Cloudflare Turnstile (alternativa a Google reCAPTCHA · gratis · privacy-friendly).
 * Sin SDK npm · script directo de challenges.cloudflare.com.
 */
export default function Turnstile({ siteKey, onVerify, theme = 'auto' }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);

    useEffect(() => {
        if (!ref.current) return;

        const renderWidget = () => {
            if (!window.turnstile || !ref.current) return;
            try {
                widgetId.current = window.turnstile.render(ref.current, {
                    sitekey: siteKey,
                    theme,
                    callback: (token: string) => onVerify(token),
                });
            } catch (e) {
                console.warn('[turnstile] render error:', e);
            }
        };

        if (window.turnstile) {
            renderWidget();
        } else {
            // Carga el script una sola vez
            const existing = document.querySelector('script[data-turnstile]');
            if (!existing) {
                const s = document.createElement('script');
                s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
                s.async = true;
                s.defer = true;
                s.setAttribute('data-turnstile', '1');
                document.head.appendChild(s);
                s.onload = renderWidget;
            } else {
                // Espera a que cargue
                const check = setInterval(() => {
                    if (window.turnstile) { clearInterval(check); renderWidget(); }
                }, 200);
                setTimeout(() => clearInterval(check), 5000);
            }
        }

        return () => {
            if (widgetId.current && window.turnstile) {
                try { window.turnstile.remove(widgetId.current); } catch { /* */ }
            }
        };
    }, [siteKey]);

    return <div ref={ref} class="turnstile-widget" />;
}
