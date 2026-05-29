/**
 * WebRTC voice/video calls usando Supabase como signaling.
 *
 * Arquitectura:
 * 1. CALLER crea row en `call_sessions` (status=ringing) → CALLEE recibe via Realtime
 * 2. Caller envía SDP offer por broadcast en canal `call:<session_id>`
 * 3. Callee responde con SDP answer
 * 4. Ambos intercambian ICE candidates por el mismo canal
 * 5. Cuando termina, alguien marca status=ended → ambos cierran PeerConnection
 *
 * Sin servidor TURN propio · usa STUN gratis de Google (suficiente para LAN/4G/wifi).
 * Para usuarios detrás de NATs hostiles, hay que añadir TURN (Cloudflare ofrece gratis).
 */
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type CallKind = 'audio' | 'video';
export type CallStatus = 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'failed';

export interface CallSession {
    id: string;
    caller_id: string;
    callee_id: string;
    kind: CallKind;
    status: CallStatus;
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
}

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
];

export interface CallController {
    session: CallSession;
    pc: RTCPeerConnection;
    localStream: MediaStream | null;
    remoteStream: MediaStream;
    channel: RealtimeChannel;
    cleanup: () => void;
    toggleMute: () => boolean; // returns new muted state
    toggleVideo: () => boolean; // returns new video off state
    hangup: () => Promise<void>;
}

/** Crea una nueva llamada (caller). */
export async function startCall(calleeId: string, kind: CallKind): Promise<CallController | null> {
    const { data: { session: auth } } = await supabase.auth.getSession();
    if (!auth?.user) throw new Error('No autenticado');

    const { data: row, error } = await supabase
        .from('call_sessions')
        .insert({ caller_id: auth.user.id, callee_id: calleeId, kind, status: 'ringing' })
        .select('*')
        .single();
    if (error || !row) {
        console.error('[call] crear sesión:', error);
        return null;
    }

    return setupCall(row as CallSession, true);
}

/** Acepta una llamada entrante (callee). */
export async function acceptCall(sessionId: string): Promise<CallController | null> {
    const { data: row, error } = await supabase
        .from('call_sessions')
        .update({ status: 'accepted', started_at: new Date().toISOString() })
        .eq('id', sessionId)
        .select('*')
        .single();
    if (error || !row) {
        console.error('[call] aceptar:', error);
        return null;
    }
    return setupCall(row as CallSession, false);
}

/** Rechaza una llamada entrante. */
export async function rejectCall(sessionId: string): Promise<void> {
    await supabase.from('call_sessions').update({
        status: 'rejected',
        ended_at: new Date().toISOString(),
    }).eq('id', sessionId);
}

async function setupCall(session: CallSession, isCaller: boolean): Promise<CallController> {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const remoteStream = new MediaStream();
    let localStream: MediaStream | null = null;
    const pendingIce: RTCIceCandidateInit[] = [];

    // Obtener mic/cam
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: session.kind === 'video',
        });
        for (const track of localStream.getTracks()) {
            pc.addTrack(track, localStream);
        }
    } catch (e) {
        console.error('[call] getUserMedia falló:', e);
        // Continúa con sólo recepción (puede ser que el otro tenga mic y este no)
    }

    pc.ontrack = (ev) => {
        for (const track of ev.streams[0].getTracks()) {
            remoteStream.addTrack(track);
        }
    };

    pc.onconnectionstatechange = () => {
        console.log('[call] pc state:', pc.connectionState);
    };

    const channel = supabase.channel(`call:${session.id}`, {
        config: { broadcast: { ack: false, self: false } },
    });

    pc.onicecandidate = (ev) => {
        if (ev.candidate) {
            channel.send({
                type: 'broadcast',
                event: 'ice',
                payload: { candidate: ev.candidate.toJSON() },
            });
        }
    };

    const flushPendingIce = async () => {
        for (const c of pendingIce.splice(0)) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
            catch (e) { console.warn('[call] flushIce:', e); }
        }
    };

    // CALLER envía offer SOLO cuando recibe "ready" del callee.
    // Esto evita la race condition: si caller envía offer antes que callee
    // se suscriba al canal, el broadcast se pierde (no hay replay).
    const sendOffer = async () => {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: offer } });
        } catch (e) {
            console.error('[call] crear offer:', e);
        }
    };

    channel.on('broadcast', { event: 'ready' }, async () => {
        if (isCaller) await sendOffer();
    });

    channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (isCaller) return;
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            await flushPendingIce();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({ type: 'broadcast', event: 'answer', payload: { sdp: answer } });
        } catch (e) {
            console.error('[call] offer handler:', e);
        }
    });
    channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (!isCaller) return;
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            await flushPendingIce();
        } catch (e) {
            console.error('[call] answer handler:', e);
        }
    });
    channel.on('broadcast', { event: 'ice' }, async ({ payload }) => {
        const candidate = payload.candidate;
        if (!candidate) return;
        // Si remoteDescription aún no está set, bufferamos
        if (!pc.remoteDescription || !pc.remoteDescription.type) {
            pendingIce.push(candidate);
            return;
        }
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.warn('[call] addIceCandidate:', e);
        }
    });
    channel.on('broadcast', { event: 'bye' }, () => {
        cleanup();
    });

    await channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' && !isCaller) {
            // Callee notifica al caller que ya está listo para recibir la offer
            channel.send({ type: 'broadcast', event: 'ready', payload: {} });
        }
        if (status === 'SUBSCRIBED' && isCaller) {
            // Re-envía 'ready' periódicamente por si callee tarda en suscribirse
            // (esto es no-op si callee ya envió el suyo primero)
            setTimeout(() => {
                channel.send({ type: 'broadcast', event: 'caller-here', payload: {} });
            }, 500);
        }
    });

    // Si caller recibe "caller-here" eco de sí mismo no pasa nada.
    // Si callee ve "caller-here", responde con "ready" (cubre el caso en que
    // callee subscribió ANTES que el listener 'ready' del caller estuviera vivo).
    channel.on('broadcast', { event: 'caller-here' }, () => {
        if (!isCaller) {
            channel.send({ type: 'broadcast', event: 'ready', payload: {} });
        }
    });

    const cleanup = () => {
        try { pc.close(); } catch { /* */ }
        try { localStream?.getTracks().forEach(t => t.stop()); } catch { /* */ }
        try { channel.unsubscribe(); } catch { /* */ }
    };

    const toggleMute = (): boolean => {
        if (!localStream) return false;
        const a = localStream.getAudioTracks()[0];
        if (!a) return false;
        a.enabled = !a.enabled;
        return !a.enabled;
    };

    const toggleVideo = (): boolean => {
        if (!localStream) return false;
        const v = localStream.getVideoTracks()[0];
        if (!v) return false;
        v.enabled = !v.enabled;
        return !v.enabled;
    };

    const hangup = async () => {
        channel.send({ type: 'broadcast', event: 'bye', payload: {} });
        await supabase.from('call_sessions').update({
            status: 'ended',
            ended_at: new Date().toISOString(),
        }).eq('id', session.id);
        cleanup();
    };

    return {
        session,
        pc,
        localStream,
        remoteStream,
        channel,
        cleanup,
        toggleMute,
        toggleVideo,
        hangup,
    };
}

/** Suscribirse a llamadas entrantes. Llama `onIncoming` cuando alguien llama. */
export function subscribeIncomingCalls(userId: string, onIncoming: (session: CallSession) => void): () => void {
    const channel = supabase.channel(`incoming-calls:${userId}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'call_sessions', filter: `callee_id=eq.${userId}` },
            (payload) => {
                onIncoming(payload.new as CallSession);
            },
        )
        .subscribe();
    return () => { channel.unsubscribe(); };
}

/** Suscribirse a cambios en una sesión (status updates). */
export function subscribeSessionChanges(sessionId: string, onChange: (session: CallSession) => void): () => void {
    const channel = supabase.channel(`call-status:${sessionId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: `id=eq.${sessionId}` },
            (payload) => {
                onChange(payload.new as CallSession);
            },
        )
        .subscribe();
    return () => { channel.unsubscribe(); };
}
