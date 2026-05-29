import { useEffect, useRef, useState } from 'preact/hooks';
import { toast } from '../lib/toast';
import { detectPlaces, placeMapUrl, PLACES_TV, type PlaceTv } from '../lib/places-tv';

interface Msg {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    at: number;
    error?: boolean;
    places?: PlaceTv[];
    image?: string;     // data URL de imagen adjunta (preview en burbuja)
    docName?: string;   // nombre de doc adjunto
}

const STORAGE_KEY = 'tv-bot-chat-v3';
const VOICE_PREF_KEY = 'tv-bot-voice-on';
const POLLINATIONS_URL = 'https://text.pollinations.ai/';

const SYSTEM_PROMPT = `Eres "TresVallesBot", asistente virtual del portal comunitario de Tres Valles, Veracruz, México.

CONTEXTO:
- Tres Valles está en la Cuenca del Papaloapan, sur de Veracruz.
- Famoso por: caña de azúcar (zafra), Ingenio Tres Valles (PIASA), río Papaloapan, son jarocho, comida ribereña.
- Lugares clave que SÍ conoces (úsalos cuando ayuden):
  ${PLACES_TV.map(p => `  · ${p.name} — ${p.description}`).join('\n')}
- El portal tiene: Foros temáticos, Chat (DMs/grupos/canales), Reels, Stories 24h, Mapa de negocios, Galería, Marketplace, Eventos, Notificaciones, Marcadores, Perfil con badges.

CAPACIDADES:
- Puedes VER imágenes que el usuario suba (descríbelas, analízalas, ayuda con lo que pregunten).
- Puedes leer documentos de texto que peguen o suban.
- Ayuda en TODO lo posible: redactar textos, explicar, traducir, dar ideas, resolver dudas del sitio.

REGLAS:
- Responde SIEMPRE en español mexicano, cálido y respetuoso.
- Sé conciso por defecto: 2-3 oraciones. Detallar SOLO si el usuario pide más.
- Si recomiendas un lugar, MENCIONA su nombre EXACTO (ej: "Palacio Municipal", "Mercado Municipal", "Parque Central Miguel Hidalgo", "Río Papaloapan").
- Cómo hacer cosas del sitio → pasos claros.
- Si NO sabes algo con certeza, dilo. NUNCA inventes.
- No consejos médicos/legales/financieros graves → sugiere profesional.
- Sin política partidista ni opiniones polémicas.`;

const QUICK_PROMPTS = [
    '¿Qué lugares debería conocer en Tres Valles?',
    '¿Cómo publico un hilo?',
    'Ayúdame a redactar un anuncio',
    '¿Cómo subo un reel?',
];

interface Props {
    onClose: () => void;
    embedded?: boolean;
}

/* ───────── Voice helpers ───────── */
function speak(text: string, voiceEnabled: boolean, onEnd?: () => void) {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) { onEnd?.(); return; }
    try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'es-MX';
        utter.rate = 1.05;
        utter.pitch = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const esVoice = voices.find(v => v.lang.startsWith('es')) || voices[0];
        if (esVoice) utter.voice = esVoice;
        if (onEnd) utter.onend = onEnd;
        window.speechSynthesis.speak(utter);
    } catch { onEnd?.(); }
}

function getRecognition(): any {
    if (typeof window === 'undefined') return null;
    const W = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = 'es-MX';
    rec.continuous = false;
    rec.interimResults = false;
    return rec;
}

/* Redimensiona imagen a máx 1024px y devuelve data URL JPEG comprimido */
function resizeImage(file: File, maxDim = 1024, quality = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                    if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
                    else { width = Math.round(width * maxDim / height); height = maxDim; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('no canvas')); return; }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function BotChatView({ onClose, embedded = false }: Props) {
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [voiceOn, setVoiceOn] = useState(false);
    const [voiceChatMode, setVoiceChatMode] = useState(false); // manos libres continuo
    const [listening, setListening] = useState(false);
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const [pendingDoc, setPendingDoc] = useState<{ name: string; text: string } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const recogRef = useRef<any>(null);
    const introSentRef = useRef(false);
    const voiceChatRef = useRef(false);

    useEffect(() => { voiceChatRef.current = voiceChatMode; }, [voiceChatMode]);

    /* ───── Init ───── */
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setMessages(parsed);
            }
            if (localStorage.getItem(VOICE_PREF_KEY) === '1') setVoiceOn(true);
        } catch { /* */ }

        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = () => { /* preload voices */ };
        }
        return () => {
            if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
            if (recogRef.current) { try { recogRef.current.stop(); } catch { /* */ } }
        };
    }, []);

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))); } catch { /* */ }
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        try { localStorage.setItem(VOICE_PREF_KEY, voiceOn ? '1' : '0'); } catch { /* */ }
    }, [voiceOn]);

    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

    /* ───── Presentación automática ───── */
    useEffect(() => {
        if (messages.length === 0 && !introSentRef.current) {
            introSentRef.current = true;
            setTimeout(() => {
                const introText = '¡Hola! Soy TresVallesBot. Puedo ayudarte con el portal, info de Tres Valles, redactar textos, y hasta VER imágenes o leer documentos que me pases. ¿En qué te ayudo?';
                setMessages([{ id: crypto.randomUUID(), role: 'assistant', text: introText, at: Date.now() }]);
                speak(introText, voiceOn);
            }, 400);
        }
        // eslint-disable-next-line
    }, []);

    /* ───── Core send ───── */
    const send = async (text: string) => {
        const img = pendingImage;
        const doc = pendingDoc;
        if (!text.trim() && !img && !doc) return;

        const userMsg: Msg = {
            id: crypto.randomUUID(),
            role: 'user',
            text: text || (img ? '(imagen)' : doc ? `(documento: ${doc.name})` : ''),
            at: Date.now(),
            image: img || undefined,
            docName: doc?.name,
        };
        const next = [...messages, userMsg];
        setMessages(next);
        setInput('');
        setPendingImage(null);
        setPendingDoc(null);
        setBusy(true);

        try {
            // Construye el payload de mensajes para Pollinations
            const apiMessages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }];
            for (const m of next) {
                if (m.role === 'user' && m.image && m === userMsg) {
                    // Mensaje con imagen → formato vision (OpenAI compatible)
                    apiMessages.push({
                        role: 'user',
                        content: [
                            { type: 'text', text: text || 'Describe y analiza esta imagen. Ayúdame con lo que veas.' },
                            { type: 'image_url', image_url: { url: m.image } },
                        ],
                    });
                } else if (m.role === 'user' && m.docName && m === userMsg && doc) {
                    apiMessages.push({
                        role: 'user',
                        content: `${text || 'Analiza este documento:'}\n\n--- ${doc.name} ---\n${doc.text.slice(0, 6000)}`,
                    });
                } else {
                    apiMessages.push({ role: m.role, content: m.text });
                }
            }

            const res = await fetch(POLLINATIONS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages,
                    model: 'openai',
                    stream: false,
                    seed: Math.floor(Math.random() * 1_000_000),
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const reply = (await res.text()).trim() || 'Sin respuesta, intenta de nuevo.';
            const places = detectPlaces(reply);
            const assistantMsg: Msg = {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: reply,
                at: Date.now(),
                places: places.length > 0 ? places : undefined,
            };
            setMessages(m => [...m, assistantMsg]);

            // Voz · si voiceChatMode, al terminar de hablar vuelve a escuchar (manos libres)
            speak(reply, voiceOn || voiceChatRef.current, () => {
                if (voiceChatRef.current) {
                    setTimeout(() => startListening(), 300);
                }
            });
        } catch (err: any) {
            setMessages(m => [...m, {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: 'Disculpa, no pude responder. Intenta en un momento. (' + (err.message || 'error') + ')',
                at: Date.now(),
                error: true,
            }]);
        } finally {
            setBusy(false);
        }
    };

    const onSubmit = (e: any) => {
        e.preventDefault();
        if ((!input.trim() && !pendingImage && !pendingDoc) || busy) return;
        send(input);
    };
    const onKeyDown = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e); }
    };

    /* ───── Adjuntar imagen ───── */
    const onImagePick = async (e: any) => {
        const f = e.target.files?.[0] as File | undefined;
        e.target.value = '';
        if (!f) return;
        if (!f.type.startsWith('image/')) { toast.error('Solo imágenes'); return; }
        try {
            const dataUrl = await resizeImage(f);
            setPendingImage(dataUrl);
            toast.success('Imagen lista · escribe tu pregunta o envía');
        } catch {
            toast.error('No se pudo procesar la imagen');
        }
    };

    /* ───── Adjuntar documento de texto ───── */
    const onDocPick = async (e: any) => {
        const f = e.target.files?.[0] as File | undefined;
        e.target.value = '';
        if (!f) return;
        const okTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html'];
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        const textExt = ['txt', 'md', 'csv', 'json', 'html', 'log', 'xml'];
        if (!okTypes.includes(f.type) && !textExt.includes(ext)) {
            toast.error('Por ahora solo docs de texto (.txt .md .csv .json)');
            return;
        }
        if (f.size > 1024 * 1024) { toast.error('Máximo 1 MB de texto'); return; }
        try {
            const text = await f.text();
            setPendingDoc({ name: f.name, text });
            toast.success(`"${f.name}" listo · pregunta sobre él`);
        } catch {
            toast.error('No se pudo leer el documento');
        }
    };

    /* ───── Voz: input ───── */
    const startListening = () => {
        if (!recogRef.current) recogRef.current = getRecognition();
        if (!recogRef.current) { toast.error('Tu navegador no soporta reconocimiento de voz'); return; }
        const rec = recogRef.current;
        setListening(true);
        rec.onresult = (ev: any) => {
            const transcript = ev.results[0]?.[0]?.transcript;
            if (transcript) { setInput(''); send(transcript); }
        };
        rec.onerror = (ev: any) => {
            setListening(false);
            if (ev.error === 'not-allowed') toast.error('Permite el micrófono');
            else if (ev.error !== 'aborted' && ev.error !== 'no-speech') toast.error('Voz: ' + ev.error);
            // En voice chat mode, reintenta si fue no-speech
            if (voiceChatRef.current && ev.error === 'no-speech') {
                setTimeout(() => { if (voiceChatRef.current) startListening(); }, 500);
            }
        };
        rec.onend = () => setListening(false);
        try { rec.start(); } catch { setListening(false); }
    };
    const stopListening = () => {
        if (recogRef.current) { try { recogRef.current.stop(); } catch { /* */ } }
        setListening(false);
    };

    const toggleVoice = () => {
        const next = !voiceOn;
        setVoiceOn(next);
        if (!next && window.speechSynthesis) window.speechSynthesis.cancel();
        if (next) speak('Voz activada.', true);
    };

    const toggleVoiceChat = () => {
        const next = !voiceChatMode;
        setVoiceChatMode(next);
        if (next) {
            setVoiceOn(true);
            toast.success('Modo voz: habla y te responderé en voz · manos libres');
            speak('Modo conversación por voz activado. Háblame cuando quieras.', true, () => {
                setTimeout(() => startListening(), 300);
            });
        } else {
            stopListening();
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            toast.info('Modo voz desactivado');
        }
    };

    const clearHistory = () => {
        if (!confirm('¿Borrar la conversación?')) return;
        setMessages([]); introSentRef.current = false;
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        setTimeout(() => {
            introSentRef.current = true;
            const t = '¡Listo, empezamos de nuevo! ¿En qué te ayudo?';
            setMessages([{ id: crypto.randomUUID(), role: 'assistant', text: t, at: Date.now() }]);
            speak(t, voiceOn);
        }, 200);
    };

    const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const speechAvailable = typeof window !== 'undefined' && !!window.speechSynthesis;
    const recogAvailable = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    return (
        <div class={`bot-chat-view ${voiceChatMode ? 'voice-mode' : ''}`}>
            <header class="bot-chat-header">
                {!embedded && (
                    <button class="bot-back-btn" onClick={onClose} title="Volver"><i class="fas fa-arrow-left"></i></button>
                )}
                <div class="bot-chat-identity">
                    <div class={`bot-avatar header ${voiceChatMode ? 'pulsing' : ''}`}><i class="fas fa-robot"></i></div>
                    <div class="bot-chat-title">
                        <strong>TresVallesBot <span class="bot-mini-tag">bot</span></strong>
                        <small>
                            <span class={busy || listening ? 'bot-typing-dot' : 'bot-online-dot'}></span>
                            {listening ? '🎙️ escuchando…' : busy ? 'pensando…' : voiceChatMode ? 'modo voz · manos libres' : 'Asistente · 24/7'}
                        </small>
                    </div>
                </div>
                <div class="bot-header-actions">
                    {speechAvailable && (
                        <button class={`bot-icon-btn ${voiceOn ? 'on' : ''}`} onClick={toggleVoice}
                            title={voiceOn ? 'Apagar lectura en voz' : 'Leer respuestas en voz'}>
                            <i class={`fas ${voiceOn ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
                        </button>
                    )}
                    {messages.length > 0 && (
                        <button class="bot-icon-btn" onClick={clearHistory} title="Borrar historial"><i class="fas fa-trash"></i></button>
                    )}
                </div>
            </header>

            <div class="chat-messages bot-chat-messages" ref={scrollRef}>
                {messages.map((m, i) => (
                    <div class={`chat-msg ${m.role === 'user' ? 'mine' : 'other'} ${m.error ? 'err' : ''}`} key={m.id}>
                        {m.role === 'assistant' && <div class="chat-msg-avatar bot-msg-avatar"><i class="fas fa-robot"></i></div>}
                        <div class="chat-msg-bubble">
                            {m.image && <img src={m.image} alt="adjunto" class="bot-msg-image" />}
                            {m.docName && <div class="bot-msg-doc"><i class="fas fa-file-lines"></i> {m.docName}</div>}
                            {m.text && <div class="chat-msg-text">{m.text}</div>}
                            {m.places && m.places.length > 0 && (
                                <div class="bot-place-cards">
                                    {m.places.map(p => (
                                        <a key={p.slug} class="bot-place-card" href={placeMapUrl(p)}>
                                            <span class="bot-place-icon"><i class={`fas ${p.icon}`}></i></span>
                                            <div class="bot-place-info"><strong>{p.name}</strong><small>{p.description}</small></div>
                                            <span class="bot-place-cta"><i class="fas fa-map-location-dot"></i> Mapa</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                            <small class="chat-msg-time">
                                {fmtTime(m.at)}
                                {m.role === 'assistant' && speechAvailable && (
                                    <button class="bot-replay-btn" onClick={() => speak(m.text, true)} title="Escuchar"><i class="fas fa-play"></i></button>
                                )}
                            </small>
                        </div>
                        {i === 0 && m.role === 'assistant' && messages.length === 1 && (
                            <div class="bot-quick-prompts">
                                {QUICK_PROMPTS.map(q => (
                                    <button key={q} class="bot-quick-prompt" onClick={() => send(q)} disabled={busy}>{q}</button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {busy && (
                    <div class="chat-msg other">
                        <div class="chat-msg-avatar bot-msg-avatar"><i class="fas fa-robot"></i></div>
                        <div class="chat-msg-bubble typing"><span></span><span></span><span></span></div>
                    </div>
                )}
            </div>

            {/* Chips de adjuntos pendientes */}
            {(pendingImage || pendingDoc) && (
                <div class="bot-pending-attach">
                    {pendingImage && (
                        <div class="bot-attach-chip">
                            <img src={pendingImage} alt="" />
                            <span>Imagen lista</span>
                            <button onClick={() => setPendingImage(null)}><i class="fas fa-xmark"></i></button>
                        </div>
                    )}
                    {pendingDoc && (
                        <div class="bot-attach-chip">
                            <i class="fas fa-file-lines"></i>
                            <span>{pendingDoc.name}</span>
                            <button onClick={() => setPendingDoc(null)}><i class="fas fa-xmark"></i></button>
                        </div>
                    )}
                </div>
            )}

            <form class="chat-composer bot-chat-composer" onSubmit={onSubmit}>
                {/* Adjuntar imagen */}
                <label class="bot-attach-btn" title="Subir imagen (el bot la ve)">
                    <input type="file" accept="image/*" onChange={onImagePick} hidden />
                    <i class="fas fa-image"></i>
                </label>
                {/* Adjuntar documento */}
                <label class="bot-attach-btn" title="Subir documento de texto">
                    <input type="file" accept=".txt,.md,.csv,.json,.html,.log,.xml,text/plain" onChange={onDocPick} hidden />
                    <i class="fas fa-paperclip"></i>
                </label>
                {/* Mic */}
                {recogAvailable && (
                    <button type="button" class={`bot-mic-btn ${listening ? 'listening' : ''}`}
                        onClick={listening ? stopListening : startListening}
                        title={listening ? 'Detener' : 'Hablar'}>
                        <i class={`fas ${listening ? 'fa-stop' : 'fa-microphone'}`}></i>
                    </button>
                )}
                <textarea
                    ref={inputRef}
                    placeholder={listening ? '🎙️ Escuchándote…' : pendingImage ? 'Pregunta sobre la imagen…' : pendingDoc ? 'Pregunta sobre el doc…' : 'Escríbele al bot…'}
                    value={input}
                    onInput={(e: any) => setInput(e.currentTarget.value)}
                    onKeyDown={onKeyDown}
                    rows={1}
                    disabled={busy || listening}
                    maxLength={800}
                />
                <button type="submit" class="chat-send-btn" disabled={busy || (!input.trim() && !pendingImage && !pendingDoc)}>
                    <i class="fas fa-paper-plane"></i>
                </button>
            </form>

            <div class="bot-bottom-row">
                {recogAvailable && speechAvailable && (
                    <button class={`bot-voicechat-toggle ${voiceChatMode ? 'on' : ''}`} onClick={toggleVoiceChat}>
                        <i class={`fas ${voiceChatMode ? 'fa-phone-slash' : 'fa-headset'}`}></i>
                        {voiceChatMode ? 'Salir del modo voz' : 'Chat de voz'}
                    </button>
                )}
                <small class="bot-disclaimer">
                    <i class="fas fa-circle-info"></i> Pollinations.ai · puede equivocarse
                </small>
            </div>
        </div>
    );
}
