import { useEffect, useRef, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
    acceptCall, rejectCall, subscribeIncomingCalls, subscribeSessionChanges,
    type CallController, type CallSession,
} from '../lib/calls';
import { toast } from '../lib/toast';

interface IncomingState {
    session: CallSession;
    callerName: string;
    callerPfp: string;
}

/** Tono de marcado tipo teléfono ("biip biip" cada ~2.5s) con Web Audio. */
function startRingback(): { stop: () => void } {
    try {
        const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC();
        let stopped = false;
        const pair = () => {
            if (stopped) return;
            [0, 0.4].forEach((offset) => {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = 480;
                osc.connect(g); g.connect(ctx.destination);
                const t = ctx.currentTime + offset;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
                osc.start(t); osc.stop(t + 0.32);
            });
        };
        pair();
        const iv = window.setInterval(pair, 2500);
        return { stop: () => { stopped = true; clearInterval(iv); try { ctx.close(); } catch { /* */ } } };
    } catch {
        return { stop: () => { /* */ } };
    }
}

/**
 * Host global de llamadas WebRTC.
 * - Escucha llamadas entrantes (subscribeIncomingCalls)
 * - Muestra modal ringing con accept/reject
 * - Cuando hay llamada activa, muestra la ventana de llamada
 *
 * Se comunica con CallButton (que inicia llamadas) vía window.dispatchEvent('callStarted').
 */
export default function CallHost() {
    const { user } = useSession();
    const [incoming, setIncoming] = useState<IncomingState | null>(null);
    const [active, setActive] = useState<CallController | null>(null);
    const [callerLabel, setCallerLabel] = useState('');
    const ringRef = useRef<HTMLAudioElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const [muted, setMuted] = useState(false);
    const [videoOff, setVideoOff] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [isCaller, setIsCaller] = useState(false);
    const [connected, setConnected] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const tickRef = useRef<number | null>(null);
    const ringbackRef = useRef<{ stop: () => void } | null>(null);

    /* ───── Llamada entrante ───── */
    useEffect(() => {
        if (!user) return;
        const unsub = subscribeIncomingCalls(user.id, async (s) => {
            // Si ya hay una llamada activa, ignoramos (o podríamos auto-rechazar)
            if (active || incoming) return;
            const { data: prof } = await supabase
                .from('profiles')
                .select('username, pfp')
                .eq('id', s.caller_id)
                .single();
            setIncoming({
                session: s,
                callerName: prof?.username || 'Alguien',
                callerPfp: prof?.pfp || '',
            });
            // Sonar ringtone
            ringRef.current?.play().catch(() => { /* autoplay bloqueado */ });
            if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
        });
        return () => { unsub(); };
    }, [user?.id, active, incoming]);

    /* ───── Cuando hay llamada activa, observar status ───── */
    useEffect(() => {
        if (!active) return;
        const unsub = subscribeSessionChanges(active.session.id, (s) => {
            if (s.status === 'ended' || s.status === 'rejected' || s.status === 'failed') {
                end();
            }
        });
        return () => { unsub(); };
    }, [active]);

    /* ───── Listener de eventos globales: callStarted (desde CallButton) ───── */
    useEffect(() => {
        const onStart = (e: any) => {
            const ctrl = e.detail?.controller as CallController | undefined;
            const label = e.detail?.label as string | undefined;
            if (ctrl) {
                setActive(ctrl);
                setCallerLabel(label || 'Llamada');
                setIsCaller(true);       // soy quien llama → tono de marcado + "Llamando…"
                setConnected(false);
                setMinimized(false);
            }
        };
        window.addEventListener('callStarted', onStart);
        return () => window.removeEventListener('callStarted', onStart);
    }, []);

    /* ───── Streams a elementos <video>/<audio> ───── */
    useEffect(() => {
        if (!active) return;
        if (active.localStream && localVideoRef.current && active.session.kind === 'video') {
            localVideoRef.current.srcObject = active.localStream;
        }
        if (active.remoteStream) {
            if (active.session.kind === 'video' && remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = active.remoteStream;
            }
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = active.remoteStream;
            }
        }
    }, [active]);

    /* ───── Estado de conexión (para "Llamando…" vs cronómetro) ───── */
    useEffect(() => {
        if (!active) { setConnected(false); return; }
        const pc = active.pc;
        const onState = () => { if (pc.connectionState === 'connected') setConnected(true); };
        pc.addEventListener('connectionstatechange', onState);
        onState();
        return () => pc.removeEventListener('connectionstatechange', onState);
    }, [active]);

    /* ───── Cronómetro · arranca al conectar ───── */
    useEffect(() => {
        if (!active || !connected) { setElapsed(0); return; }
        setElapsed(0);
        tickRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);
        return () => { if (tickRef.current) clearInterval(tickRef.current); };
    }, [active, connected]);

    /* ───── Tono de marcado (ringback "biip biip") mientras llama y aún no conecta ───── */
    useEffect(() => {
        const stop = () => { try { ringbackRef.current?.stop(); } catch { /* */ } ringbackRef.current = null; };
        if (active && isCaller && !connected) {
            if (!ringbackRef.current) ringbackRef.current = startRingback();
        } else { stop(); }
        return stop;
    }, [active, isCaller, connected]);

    const accept = async () => {
        if (!incoming) return;
        ringRef.current?.pause();
        const ctrl = await acceptCall(incoming.session.id);
        if (ctrl) {
            setActive(ctrl);
            setCallerLabel(incoming.callerName);
            setIsCaller(false);      // yo contesto → sin tono de marcado
            setConnected(false);
            setMinimized(false);
        } else {
            toast.error('No se pudo aceptar la llamada');
        }
        setIncoming(null);
    };

    const reject = async () => {
        if (!incoming) return;
        ringRef.current?.pause();
        await rejectCall(incoming.session.id);
        setIncoming(null);
    };

    const end = async () => {
        if (active) {
            try { await active.hangup(); } catch { /* */ }
            setActive(null);
        }
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
        try { ringbackRef.current?.stop(); } catch { /* */ }
        ringbackRef.current = null;
        setMuted(false);
        setVideoOff(false);
        setMinimized(false);
        setIsCaller(false);
        setConnected(false);
    };

    const onToggleMute = () => {
        if (!active) return;
        const isMuted = active.toggleMute();
        setMuted(isMuted);
    };

    const onToggleVideo = () => {
        if (!active) return;
        const isOff = active.toggleVideo();
        setVideoOff(isOff);
    };

    const fmtTime = (s: number) => {
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${r.toString().padStart(2, '0')}`;
    };

    return (
        <>
            {/* Ringtone simple: tone repetitivo generado · sin archivo externo */}
            <audio ref={ringRef} loop preload="auto">
                <source src="data:audio/wav;base64,UklGRiQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQADAACAgICAg4WIiYqJh4WCgH9+f4GDhYeIiYiHhYJ/fXt7fX+ChYeJiYiGg4B+e3p6e36ChomKiYeEgH16eHd5fIGFiIqLiYWBfXp3dnd6foOHiouJh4N/e3h2dnh8gYWIioqIhYF9eXd2d3uAhIeKiomGg397eHd3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYiKioiFgX55d3Z3eX2BhYg=" type="audio/wav" />
            </audio>

            {/* Audio del remoto · siempre presente cuando hay llamada (incluso si es video) */}
            {active && <audio ref={remoteAudioRef} autoPlay playsInline />}

            {/* ── Modal de llamada entrante ── */}
            {incoming && (
                <div class="call-incoming-overlay">
                    <div class="call-incoming">
                        <div class="call-pulse-ring">
                            {incoming.callerPfp
                                ? <img src={incoming.callerPfp} alt="" />
                                : <i class="fas fa-user"></i>}
                        </div>
                        <h3>{incoming.callerName}</h3>
                        <p>
                            <i class={`fas ${incoming.session.kind === 'video' ? 'fa-video' : 'fa-phone'}`}></i>
                            Llamada entrante · {incoming.session.kind === 'video' ? 'video' : 'voz'}
                        </p>
                        <div class="call-incoming-actions">
                            <button class="call-btn reject" onClick={reject} aria-label="Rechazar">
                                <i class="fas fa-phone-slash"></i>
                            </button>
                            <button class="call-btn accept" onClick={accept} aria-label="Aceptar">
                                <i class={`fas ${incoming.session.kind === 'video' ? 'fa-video' : 'fa-phone'}`}></i>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Ventana de llamada activa ── */}
            {active && (
                <div
                    class={`call-window ${active.session.kind === 'video' ? 'video' : 'audio'} ${minimized ? 'minimized' : ''} ${connected ? 'connected' : 'ringing'}`}
                    onClick={minimized ? () => setMinimized(false) : undefined}
                >
                    <header class="call-window-head">
                        <button
                            class="call-min-btn"
                            onClick={(e: any) => { e.stopPropagation(); setMinimized(m => !m); }}
                            title={minimized ? 'Expandir' : 'Minimizar'}
                            aria-label={minimized ? 'Expandir llamada' : 'Minimizar llamada'}
                        >
                            <i class={`fas ${minimized ? 'fa-up-right-and-down-left-from-center' : 'fa-chevron-down'}`}></i>
                        </button>
                        <strong>{callerLabel}</strong>
                        <span class="call-timer">
                            {connected ? fmtTime(elapsed) : (isCaller ? 'Llamando…' : 'Conectando…')}
                        </span>
                        {minimized && (
                            <button
                                class="call-min-end"
                                onClick={(e: any) => { e.stopPropagation(); end(); }}
                                title="Colgar"
                                aria-label="Colgar"
                            >
                                <i class="fas fa-phone-slash"></i>
                            </button>
                        )}
                    </header>

                    {active.session.kind === 'video' ? (
                        <div class="call-video-area">
                            <video ref={remoteVideoRef} autoPlay playsInline class="call-remote-video" />
                            <video ref={localVideoRef} autoPlay playsInline muted class="call-local-video" />
                            {videoOff && (
                                <div class="call-video-off-overlay">
                                    <i class="fas fa-video-slash"></i>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div class="call-audio-area">
                            <div class="call-audio-avatar">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="call-audio-bars">
                                <span></span><span></span><span></span><span></span><span></span>
                            </div>
                        </div>
                    )}

                    <footer class="call-window-controls">
                        <button class={`call-ctrl ${muted ? 'on' : ''}`} onClick={onToggleMute} title={muted ? 'Activar mic' : 'Silenciar'}>
                            <i class={`fas ${muted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                        </button>
                        {active.session.kind === 'video' && (
                            <button class={`call-ctrl ${videoOff ? 'on' : ''}`} onClick={onToggleVideo} title={videoOff ? 'Activar cam' : 'Apagar cam'}>
                                <i class={`fas ${videoOff ? 'fa-video-slash' : 'fa-video'}`}></i>
                            </button>
                        )}
                        <button class="call-ctrl end" onClick={end} title="Colgar">
                            <i class="fas fa-phone-slash"></i>
                        </button>
                    </footer>
                </div>
            )}
        </>
    );
}
