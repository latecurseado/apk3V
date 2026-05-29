import { useEffect, useState } from 'preact/hooks';

/**
 * Top progress bar tipo YouTube/Linear/NProgress.
 * Se activa con ViewTransitions de Astro (astro:before-preparation / astro:after-swap).
 */
export default function NavProgress() {
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let timer: any;
        const start = () => {
            setVisible(true);
            setProgress(15);
            let val = 15;
            timer = setInterval(() => {
                val = Math.min(val + Math.random() * 12, 88);
                setProgress(val);
            }, 200);
        };
        const finish = () => {
            clearInterval(timer);
            setProgress(100);
            setTimeout(() => { setVisible(false); setProgress(0); }, 250);
        };
        document.addEventListener('astro:before-preparation', start);
        document.addEventListener('astro:after-swap', finish);
        // También para clicks dentro de SPA islands
        document.addEventListener('astro:page-load', finish);
        return () => {
            document.removeEventListener('astro:before-preparation', start);
            document.removeEventListener('astro:after-swap', finish);
            document.removeEventListener('astro:page-load', finish);
            clearInterval(timer);
        };
    }, []);

    if (!visible) return null;
    return <div class="nav-progress" style={`width: ${progress}%`}></div>;
}
