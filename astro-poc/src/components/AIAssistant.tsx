import { useEffect, useRef, useState } from 'preact/hooks';
import { useSession, userLabel } from '../lib/auth';

interface Msg {
    role: 'user' | 'assistant' | 'system';
    text: string;
    error?: boolean;
}

const SYSTEM_PROMPT = `Eres "TresVallesBot", asistente virtual del portal comunitario de Tres Valles, Veracruz, México.

CONTEXTO:
- Tres Valles es un municipio en la Cuenca del Papaloapan, Veracruz. Conocido por la caña de azúcar (zafra), agricultura, río Papaloapan.
- El portal tiene: Foro, Chat (DMs), Reels, Mapa de negocios, Galería, Eventos.

REGLAS:
- Responde SIEMPRE en español mexicano, cálido y respetuoso.
- Sé conciso: 2-3 oraciones máximo, a menos que el usuario pida más detalle.
- Si te preguntan cómo hacer algo del sitio (publicar, dar like, mandar DM, etc.) da instrucciones paso a paso.
- Si te preguntan algo de Tres Valles que NO sabes con certeza, di "no lo sé seguro, te recomiendo preguntar en el foro #ayuda" — nunca inventes datos.
- Si te piden noticias actuales, di "revisa la sección de Noticias del sidebar, el bot las actualiza cada hora".
- No des consejos médicos, legales o financieros graves; sugiere consultar un profesional.
- No insultes, no discutas política partidista, no des opiniones polémicas.`;

const STORAGE_KEY = 'tv-ai-history';
const VOICE_KEY = 'tv-ai-voice';
const GREET_KEY = 'tv-ai-greeted';

/** Recomendaciones/reacciones que el robot suelta en burbujas cada tanto. */
const BOT_TIPS = [
    '¿Ya viste los Cortos? 👀 hay videos del pueblo',
    'Échate un cuento en #general 💬',
    'Personaliza tu inicio con el botón ⚙️ Personalizar',
    'El Tianguis tiene compra-venta local 🛒',
    'Pásate por las Noticias de Tres Valles 📰',
    'Sigue raza para llenar tu feed "Tu raza" 🤝',
    '¿Dudas del sitio? Pregúntame, para eso estoy 🤖',
    'Sube una historia, dura 24h 📸',
    'Explora el mapa y la galería del municipio 🗺️',
];

/** Quita emojis/símbolos para que el TTS no los lea ("cara sonriente", etc.). */
function forSpeech(text: string): string {
    return text
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Asistente IA flotante (chibi-robot) usando Pollinations.ai · gratis, sin login.
 * Extras:
 *  - Saluda al entrar (una vez por sesión, por tu nombre si hay sesión).
 *  - Voz: lee las respuestas en voz alta (Web Speech API), configurable y silenciable.
 */
export default function AIAssistant() {
    const { user, ready } = useSession();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [voiceOn, setVoiceOn] = useState(false);
    const [bubble, setBubble] = useState<string | null>(null);  // texto que dice el robot
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
    const voiceOnRef = useRef(false);
    const openRef = useRef(false);
    const bubbleTimer = useRef<number | undefined>(undefined);

    /** Muestra una burbuja de texto sobre el robot (auto-oculta). */
    const showBubble = (text: string, ms = 7000) => {
        if (openRef.current) return;
        setBubble(text);
        if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
        bubbleTimer.current = window.setTimeout(() => setBubble(null), ms);
    };

    const ttsAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

    const greetingText = user
        ? `¡Qué onda, ${userLabel(user)}! 👋 Soy tu asistente de Tres Valles. ¿En qué te echo la mano?`
        : '¡Hola! 👋 Soy el asistente de Tres Valles. Pregúntame lo que necesites del sitio o de la zona.';

    /* Carga historial + preferencia de voz */
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setMessages(parsed);
            }
            const v = localStorage.getItem(VOICE_KEY) === '1';
            setVoiceOn(v);
            voiceOnRef.current = v;
        } catch { /* */ }
    }, []);

    /* Carga lista de voces del navegador (asíncrona) */
    useEffect(() => {
        if (!ttsAvailable) return;
        const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
        load();
        window.speechSynthesis.addEventListener?.('voiceschanged', load);
        return () => {
            try { window.speechSynthesis.removeEventListener?.('voiceschanged', load); } catch { /* */ }
        };
    }, [ttsAvailable]);

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))); } catch { /* */ }
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        openRef.current = open;
        if (open) {
            setBubble(null);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    /* Saludo al entrar · una vez por sesión */
    useEffect(() => {
        if (!ready) return;
        let already = false;
        try { already = sessionStorage.getItem(GREET_KEY) === '1'; } catch { /* */ }
        if (already) return;
        const t = setTimeout(() => {
            try { sessionStorage.setItem(GREET_KEY, '1'); } catch { /* */ }
            showBubble(greetingText, 8500);
            if (voiceOnRef.current) speak(greetingText);
        }, 1400);
        return () => clearTimeout(t);
    }, [ready]);

    /* El robot suelta recomendaciones cada tanto (mientras el chat esté cerrado). */
    useEffect(() => {
        let i = 0;
        const tick = () => {
            if (!openRef.current) {
                const tip = BOT_TIPS[i % BOT_TIPS.length];
                i++;
                showBubble(tip, 6500);
            }
        };
        const first = window.setTimeout(tick, 22000);          // primer tip a los ~22s
        const interval = window.setInterval(tick, 55000);       // luego cada ~55s
        return () => { clearTimeout(first); clearInterval(interval); };
    }, []);

    /* El chibi reacciona a la página: mira al cursor y se tapa los ojos
       cuando escribes una contraseña. */
    useEffect(() => {
        // Solo se desactiva con NUESTRO toggle de animaciones (no con el del SO),
        // porque seguir el cursor es una función pedida explícitamente.
        const reduce = () => {
            try { return document.documentElement.dataset.rm === '1'; } catch { return false; }
        };
        let mx = 0, my = 0, raf = 0, pending = false;
        const apply = () => {
            pending = false;
            if (reduce()) return; // sin movimiento → ojos al frente
            document.querySelectorAll<HTMLElement>('.chibi').forEach((c) => {
                const r = c.getBoundingClientRect();
                if (!r.width) return;
                const dx = mx - (r.left + r.width / 2);
                const dy = my - (r.top + r.height / 2);
                const dist = Math.hypot(dx, dy) || 1;
                const max = 1.5; // poquito · que reaccione sin exagerar
                c.style.setProperty('--gaze-x', (dx / dist * max).toFixed(2) + 'px');
                c.style.setProperty('--gaze-y', (dy / dist * max).toFixed(2) + 'px');
            });
        };
        const onMove = (e: MouseEvent) => {
            mx = e.clientX; my = e.clientY;
            if (!pending) { pending = true; raf = requestAnimationFrame(apply); }
        };
        const isPw = (el: any): boolean =>
            !!el && el.tagName === 'INPUT' && el.getAttribute('type') === 'password';
        const setNoPeek = (on: boolean) =>
            document.querySelectorAll('.chibi').forEach(c => c.classList.toggle('no-peek', on));
        const onFocusIn = (e: FocusEvent) => { if (isPw(e.target)) setNoPeek(true); };
        const onFocusOut = (e: FocusEvent) => { if (isPw(e.target)) setNoPeek(false); };

        window.addEventListener('mousemove', onMove, { passive: true });
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
        // Si ya hay un password enfocado al montar (raro), respétalo
        if (isPw(document.activeElement)) setNoPeek(true);
        return () => {
            window.removeEventListener('mousemove', onMove);
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('focusout', onFocusOut);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []);

    const speak = (text: string) => {
        if (!voiceOnRef.current || !ttsAvailable) return;
        try {
            const synth = window.speechSynthesis;
            synth.cancel();
            const clean = forSpeech(text);
            if (!clean) return;
            const u = new SpeechSynthesisUtterance(clean);
            u.lang = 'es-MX';
            const voices = voicesRef.current.length ? voicesRef.current : synth.getVoices();
            const v = voices.find((vc) => /es[-_]MX/i.test(vc.lang))
                || voices.find((vc) => vc.lang.toLowerCase().startsWith('es'));
            if (v) u.voice = v;
            u.rate = 1.02;
            u.pitch = 1.08;
            synth.speak(u);
        } catch { /* */ }
    };

    const toggleVoice = () => {
        setVoiceOn((prev) => {
            const next = !prev;
            voiceOnRef.current = next;
            try { localStorage.setItem(VOICE_KEY, next ? '1' : '0'); } catch { /* */ }
            if (ttsAvailable) {
                window.speechSynthesis.cancel();
                if (next) speak('Listo, te leeré las respuestas en voz alta.');
            }
            return next;
        });
    };

    const send = async (text: string) => {
        const userMsg: Msg = { role: 'user', text };
        const next = [...messages, userMsg];
        setMessages(next);
        setInput('');
        setBusy(true);

        try {
            const payload = {
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...next.map((m) => ({ role: m.role, content: m.text })),
                ],
                model: 'openai',
                stream: false,
                seed: Math.floor(Math.random() * 1000000),
            };
            const res = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const reply = (await res.text()).trim() || 'Sin respuesta, intenta de nuevo.';
            setMessages((m) => [...m, { role: 'assistant', text: reply }]);
            speak(reply);
        } catch (err: any) {
            setMessages((m) => [...m, {
                role: 'assistant',
                text: 'Disculpa, no pude responder ahora. Intenta de nuevo en un momento. (' + (err.message || 'error') + ')',
                error: true,
            }]);
        } finally {
            setBusy(false);
        }
    };

    const onSubmit = (e: any) => {
        e.preventDefault();
        const t = input.trim();
        if (!t || busy) return;
        send(t);
    };

    const onKeyDown = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e);
        }
    };

    const clearHistory = () => {
        if (!confirm('¿Borrar la conversación con el asistente?')) return;
        setMessages([]);
        if (ttsAvailable) window.speechSynthesis.cancel();
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    };

    const quickQuestions = [
        '¿Cómo publico un hilo?',
        '¿Cómo activo el modo claro?',
        'Dame ideas para conocer Tres Valles',
        '¿Cómo funcionan los Reels?',
    ];

    const Chibi = () => (
        <span class="chibi" aria-hidden="true">
            <span class="chibi-antenna"></span>
            <span class="chibi-head">
                <span class="chibi-face">
                    <span class="chibi-eye left"><span class="chibi-pupil"></span></span>
                    <span class="chibi-eye right"><span class="chibi-pupil"></span></span>
                    <span class="chibi-mouth"></span>
                </span>
                <span class="chibi-hand left"></span>
                <span class="chibi-hand right"></span>
            </span>
        </span>
    );

    return (
        <>
            {!open && bubble && (
                <div
                    class="ai-greeting"
                    role="status"
                    onClick={() => setOpen(true)}
                >
                    <button
                        class="ai-greeting-x"
                        onClick={(e: any) => { e.stopPropagation(); setBubble(null); }}
                        aria-label="Cerrar"
                    >
                        <i class="fas fa-xmark"></i>
                    </button>
                    <span>{bubble}</span>
                </div>
            )}

            {!open && (
                <button
                    class="ai-bubble"
                    onClick={() => setOpen(true)}
                    aria-label="Asistente virtual"
                    title="Asistente · pregunta lo que quieras"
                >
                    <Chibi />
                    {messages.length === 0 && <span class="ai-bubble-badge">?</span>}
                </button>
            )}

            {open && (
                <div class="ai-panel">
                    <header class="ai-panel-head">
                        <div class="ai-panel-title">
                            <span class="ai-panel-mascot"><Chibi /></span>
                            <div>
                                <strong>TresVallesBot</strong>
                                <small>Asistente · gratis · sin login</small>
                            </div>
                        </div>
                        <div class="ai-panel-actions">
                            {ttsAvailable && (
                                <button
                                    class={`ai-icon-btn ${voiceOn ? 'on' : ''}`}
                                    onClick={toggleVoice}
                                    title={voiceOn ? 'Silenciar voz' : 'Leer respuestas en voz alta'}
                                    aria-pressed={voiceOn}
                                >
                                    <i class={`fas ${voiceOn ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
                                </button>
                            )}
                            {messages.length > 0 && (
                                <button class="ai-icon-btn" onClick={clearHistory} title="Borrar conversación">
                                    <i class="fas fa-trash"></i>
                                </button>
                            )}
                            <button class="ai-icon-btn" onClick={() => setOpen(false)} title="Cerrar">
                                <i class="fas fa-xmark"></i>
                            </button>
                        </div>
                    </header>

                    <div class="ai-messages" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div class="ai-welcome">
                                <p>
                                    <i class="fas fa-hand-sparkles"></i> {user ? `¡Qué onda, ${userLabel(user)}!` : '¡Hola!'} Soy tu asistente del portal de Tres Valles.
                                    Pregúntame cómo usar el sitio, info de la zona, o lo que necesites.
                                    {ttsAvailable && (
                                        <> Puedo leerte las respuestas en voz alta con el botón <i class="fas fa-volume-high"></i> de arriba.</>
                                    )}
                                </p>
                                <div class="ai-quick-q">
                                    {quickQuestions.map((q) => (
                                        <button
                                            key={q}
                                            class="ai-quick-q-btn"
                                            onClick={() => send(q)}
                                            disabled={busy}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} class={`ai-msg ai-msg-${m.role}${m.error ? ' err' : ''}`}>
                                {m.role === 'assistant' && (
                                    <span class="ai-msg-avatar"><i class="fas fa-robot"></i></span>
                                )}
                                <div class="ai-msg-bubble">{m.text}</div>
                            </div>
                        ))}
                        {busy && (
                            <div class="ai-msg ai-msg-assistant">
                                <span class="ai-msg-avatar"><i class="fas fa-robot"></i></span>
                                <div class="ai-msg-bubble typing">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}
                    </div>

                    <form class="ai-input-row" onSubmit={onSubmit}>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onInput={(e: any) => setInput(e.currentTarget.value)}
                            onKeyDown={onKeyDown}
                            placeholder="Pregunta algo… (Enter para enviar)"
                            rows={1}
                            disabled={busy}
                            maxLength={500}
                        />
                        <button type="submit" disabled={busy || !input.trim()} class="ai-send-btn">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </form>

                    <footer class="ai-foot">
                        <small>
                            <i class="fas fa-circle-info"></i>
                            Powered by Pollinations.ai · puede equivocarse, verifica info importante.
                        </small>
                    </footer>
                </div>
            )}
        </>
    );
}
