import { useState } from 'preact/hooks';
import { createReport, REASON_LABELS, type ReportReason, type ReportTarget } from '../lib/reports';
import { toast } from '../lib/toast';

interface Props {
    targetType: ReportTarget;
    targetId: string;
    onClose: () => void;
}

export default function ReportModal({ targetType, targetId, onClose }: Props) {
    const [reason, setReason] = useState<ReportReason>('spam');
    const [details, setDetails] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        const ok = await createReport({
            target_type: targetType,
            target_id: targetId,
            reason,
            details: details.trim(),
        });
        setBusy(false);
        if (ok) {
            toast.success('Reporte enviado · admins lo revisarán');
            onClose();
        } else {
            toast.error('No se pudo enviar');
        }
    };

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal small report-modal" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-flag"></i> Reportar contenido</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    <p class="hub-section-lead" style="margin:0 0 10px;">
                        ¿Por qué reportas esto?
                    </p>
                    <div class="report-reasons">
                        {(Object.entries(REASON_LABELS) as Array<[ReportReason, string]>).map(([k, lbl]) => (
                            <label key={k} class={`report-reason ${reason === k ? 'active' : ''}`}>
                                <input type="radio" name="reason" value={k} checked={reason === k}
                                    onChange={() => setReason(k)} />
                                <span>{lbl}</span>
                            </label>
                        ))}
                    </div>
                    <label class="reel-caption" style="margin-top: 12px;">
                        <span><i class="fas fa-pen"></i> Detalles (opcional)</span>
                        <textarea
                            rows={3}
                            maxLength={500}
                            placeholder="Cuéntanos más para ayudar a la revisión…"
                            value={details}
                            onInput={(e: any) => setDetails(e.currentTarget.value)}
                        />
                        <small class="auth-hint">{details.length}/500</small>
                    </label>
                </div>
                <footer class="compose-footer">
                    <button class="auth-btn ghost small" onClick={onClose} disabled={busy}>Cancelar</button>
                    <button class="auth-btn primary" onClick={submit} disabled={busy}>
                        {busy
                            ? <><i class="fas fa-circle-notch fa-spin"></i> Enviando…</>
                            : <><i class="fas fa-flag"></i> Reportar</>}
                    </button>
                </footer>
            </div>
        </div>
    );
}
