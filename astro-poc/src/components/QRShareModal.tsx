import { useState } from 'preact/hooks';

interface Props {
    url: string;
    title?: string;
    onClose: () => void;
}

/**
 * Modal para compartir un link por QR + clipboard + share nativo.
 * Usa api.qrserver.com (público, sin auth) para generar el PNG.
 */
export default function QRShareModal({ url, title = 'Compartir', onClose }: Props) {
    const [copied, setCopied] = useState(false);

    const fullUrl = url.startsWith('http') ? url : new URL(url, window.location.origin).toString();
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&color=000000&bgcolor=ffffff&data=${encodeURIComponent(fullUrl)}`;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(fullUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* */ }
    };

    const nativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Tres Valles', url: fullUrl });
            } catch { /* user canceló */ }
        } else {
            copy();
        }
    };

    const downloadQR = () => {
        const a = document.createElement('a');
        a.href = qrSrc;
        a.download = `tres-valles-qr-${Date.now()}.png`;
        a.target = '_blank';
        a.click();
    };

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal qr-share-modal" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-qrcode"></i> {title}</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body qr-body">
                    <div class="qr-img-wrap">
                        <img src={qrSrc} alt="QR code" width={280} height={280} />
                    </div>
                    <div class="qr-url-row">
                        <input type="text" readOnly value={fullUrl} onClick={(e: any) => e.currentTarget.select()} />
                        <button class="auth-btn ghost small" onClick={copy}>
                            {copied
                                ? <><i class="fas fa-check"></i> Copiado</>
                                : <><i class="fas fa-link"></i> Copiar</>}
                        </button>
                    </div>
                    <div class="qr-actions">
                        <button class="auth-btn primary" onClick={nativeShare}>
                            <i class="fas fa-share-nodes"></i> Compartir
                        </button>
                        <button class="auth-btn ghost small" onClick={downloadQR}>
                            <i class="fas fa-download"></i> Descargar QR
                        </button>
                    </div>
                    <small class="auth-hint qr-hint">
                        <i class="fas fa-circle-info"></i>
                        Imprime o muestra el QR para que la gente del pueblo se conecte rápido.
                    </small>
                </div>
            </div>
        </div>
    );
}
