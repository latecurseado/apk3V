import { useEffect, useState } from 'preact/hooks';
import {
    blockUser, unblockUser, isBlocked,
    muteUser, unmuteUser, isMuted,
    sendFriendRequest, acceptFriendRequest, rejectFriendRequest, checkFriendRequestStatus,
} from '../lib/social';
import ReportModal from './ReportModal';
import QRShareModal from './QRShareModal';
import { toast } from '../lib/toast';

interface Props {
    targetId: string;
    targetUsername: string;
    onBlocked?: (blocked: boolean) => void;
}

export default function ProfileActionsMenu({ targetId, targetUsername, onBlocked }: Props) {
    const [open, setOpen] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const [muted, setMuted] = useState(false);
    const [frStatus, setFrStatus] = useState<{ requestId: string | null; direction: 'sent' | 'received' | null; status: string | null }>({ requestId: null, direction: null, status: null });
    const [reportOpen, setReportOpen] = useState(false);
    const [qrOpen, setQrOpen] = useState(false);

    useEffect(() => {
        let alive = true;
        Promise.all([isBlocked(targetId), isMuted(targetId), checkFriendRequestStatus(targetId)])
            .then(([b, m, fr]) => {
                if (!alive) return;
                setBlocked(b); setMuted(m); setFrStatus(fr);
            });
        return () => { alive = false; };
    }, [targetId]);

    const toggleBlock = async () => {
        const next = !blocked;
        const ok = next ? await blockUser(targetId) : await unblockUser(targetId);
        if (ok) {
            setBlocked(next);
            onBlocked?.(next);
            toast.success(next ? `@${targetUsername} bloqueado` : `@${targetUsername} desbloqueado`);
            setOpen(false);
        }
    };

    const toggleMute = async () => {
        const next = !muted;
        const ok = next ? await muteUser(targetId) : await unmuteUser(targetId);
        if (ok) {
            setMuted(next);
            toast.success(next ? `@${targetUsername} silenciado` : `@${targetUsername} desilenciado`);
            setOpen(false);
        }
    };

    const sendFR = async () => {
        const id = await sendFriendRequest(targetUsername);
        if (id) {
            toast.success(`Solicitud enviada a @${targetUsername}`);
            setFrStatus({ requestId: id, direction: 'sent', status: 'pending' });
        } else {
            toast.error('No se pudo enviar');
        }
        setOpen(false);
    };

    const acceptFR = async () => {
        if (!frStatus.requestId) return;
        const ok = await acceptFriendRequest(frStatus.requestId);
        if (ok) {
            toast.success(`¡Ahora son amigos!`);
            setFrStatus({ ...frStatus, status: 'accepted' });
        }
        setOpen(false);
    };

    const rejectFR = async () => {
        if (!frStatus.requestId) return;
        const ok = await rejectFriendRequest(frStatus.requestId);
        if (ok) {
            toast.success('Solicitud rechazada');
            setFrStatus({ requestId: null, direction: null, status: null });
        }
        setOpen(false);
    };

    return (
        <>
            <div class="profile-actions-menu-wrap">
                <button class="auth-btn ghost small" onClick={() => setOpen(o => !o)} title="Más acciones">
                    <i class="fas fa-ellipsis"></i>
                </button>
                {open && (
                    <div class="profile-actions-dropdown">
                        {/* Solicitud de amistad */}
                        {frStatus.status === 'pending' && frStatus.direction === 'received' ? (
                            <>
                                <button onClick={acceptFR}>
                                    <i class="fas fa-user-check"></i> Aceptar solicitud
                                </button>
                                <button onClick={rejectFR}>
                                    <i class="fas fa-user-xmark"></i> Rechazar solicitud
                                </button>
                            </>
                        ) : frStatus.status === 'pending' && frStatus.direction === 'sent' ? (
                            <span class="profile-action-info">
                                <i class="fas fa-user-clock"></i> Solicitud enviada · esperando
                            </span>
                        ) : frStatus.status === 'accepted' ? (
                            <span class="profile-action-info">
                                <i class="fas fa-user-check"></i> Son amigos
                            </span>
                        ) : (
                            <button onClick={sendFR}>
                                <i class="fas fa-user-plus"></i> Solicitud de amistad
                            </button>
                        )}

                        <button onClick={() => { setQrOpen(true); setOpen(false); }}>
                            <i class="fas fa-qrcode"></i> Compartir perfil (QR)
                        </button>

                        <hr class="profile-action-sep" />

                        <button onClick={toggleMute}>
                            <i class={`fas ${muted ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
                            {muted ? 'Desilenciar' : 'Silenciar'}
                        </button>
                        <button onClick={toggleBlock} class="danger">
                            <i class={`fas ${blocked ? 'fa-circle-check' : 'fa-ban'}`}></i>
                            {blocked ? 'Desbloquear' : 'Bloquear'}
                        </button>
                        <button onClick={() => { setReportOpen(true); setOpen(false); }} class="danger">
                            <i class="fas fa-flag"></i> Reportar
                        </button>
                    </div>
                )}
            </div>

            {reportOpen && (
                <ReportModal
                    targetType="profile"
                    targetId={targetId}
                    onClose={() => setReportOpen(false)}
                />
            )}

            {qrOpen && (
                <QRShareModal
                    url={`/perfil?u=${targetUsername}`}
                    title={`Compartir perfil de @${targetUsername}`}
                    onClose={() => setQrOpen(false)}
                />
            )}
        </>
    );
}
