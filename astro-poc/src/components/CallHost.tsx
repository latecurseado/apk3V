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
    const [elapsed, setElapsed] = useState(0);
    const tickRef = useRef<number | null>(null);

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

    /* ───── Cronómetro ───── */
    useEffect(() => {
        if (!active) { setElapsed(0); return; }
        setElapsed(0);
        tickRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);
        return () => { if (tickRef.current) clearInterval(tickRef.current); };
    }, [active]);

    const accept = async () => {
        if (!incoming) return;
        ringRef.current?.pause();
        const ctrl = await acceptCall(incoming.session.id);
        if (ctrl) {
            setActive(ctrl);
            setCallerLabel(incoming.callerName);
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
        setMuted(false);
        setVideoOff(false);
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
                <div class={`call-window ${active.session.kind === 'video' ? 'video' : 'audio'}`}>
                    <header class="call-window-head">
                        <strong>{callerLabel}</strong>
                        <span class="call-timer">{fmtTime(elapsed)}</span>
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
