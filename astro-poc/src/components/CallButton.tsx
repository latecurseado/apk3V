import { useState } from 'preact/hooks';
import { startCall } from '../lib/calls';
import { toast } from '../lib/toast';

interface Props {
    calleeId: string;
    calleeName: string;
    iconOnly?: boolean;
}

/**
 * Botones para iniciar llamada de voz o video con un usuario.
 * Despacha 'callStarted' al window cuando la sesión arranca · CallHost lo recibe.
 */
export default function CallButton({ calleeId, calleeName, iconOnly = false }: Props) {
    const [busy, setBusy] = useState<null | 'audio' | 'video'>(null);

    const start = async (kind: 'audio' | 'video') => {
        if (busy) return;
        setBusy(kind);
        try {
            const ctrl = await startCall(calleeId, kind);
            if (!ctrl) { toast.error('No se pudo iniciar la llamada'); return; }
            window.dispatchEvent(new CustomEvent('callStarted', {
                detail: { controller: ctrl, label: calleeName },
            }));
        } catch (e: any) {
            if (e.name === 'NotAllowedError') {
                toast.error('Permiso de micrófono/cámara denegado');
            } else {
                toast.error('Error: ' + (e.message || 'desconocido'));
            }
        } finally {
            setBusy(null);
        }
    };

    return (
        <div class="call-btn-group">
            <button
                class="call-trigger audio"
                onClick={() => start('audio')}
                disabled={!!busy}
                title="Llamar (voz)"
            >
                <i class={`fas ${busy === 'audio' ? 'fa-circle-notch fa-spin' : 'fa-phone'}`}></i>
                {!iconOnly && <span>Llamar</span>}
            </button>
            <button
                class="call-trigger video"
                onClick={() => start('video')}
                disabled={!!busy}
                title="Videollamada"
            >
                <i class={`fas ${busy === 'video' ? 'fa-circle-notch fa-spin' : 'fa-video'}`}></i>
                {!iconOnly && <span>Video</span>}
            </button>
        </div>
    );
}
