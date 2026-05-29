import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import { toast } from '../lib/toast';

interface Status {
    emoji: string;
    text: string;
}

const QUICK_STATUSES = [
    { emoji: '☕', text: 'Tomando café' },
    { emoji: '💻', text: 'Trabajando' },
    { emoji: '🌴', text: 'De vacaciones' },
    { emoji: '🎓', text: 'Estudiando' },
    { emoji: '🚴', text: 'En la calle' },
    { emoji: '🛏️', text: 'Descansando' },
    { emoji: '🎉', text: 'Fiesta' },
    { emoji: '🍔', text: 'Comiendo' },
    { emoji: '🎵', text: 'Escuchando música' },
    { emoji: '🎮', text: 'Jugando' },
    { emoji: '👀', text: 'Observando' },
    { emoji: '🤐', text: 'No molestar' },
];

interface Props {
    onClose: () => void;
    onSaved?: () => void;
}

export default function StatusEditor({ onClose, onSaved }: Props) {
    const { user } = useSession();
    const [status, setStatus] = useState<Status>({ emoji: '', text: '' });
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!user) return;
        (async () => {
            const { data } = await supabase
                .from('profiles')
                .select('custom_status, custom_status_emoji')
                .eq('id', user.id)
                .single();
            if (data) {
                setStatus({
                    emoji: data.custom_status_emoji || '',
                    text: data.custom_status || '',
                });
            }
        })();
    }, [user?.id]);

    const save = async () => {
        if (!user) return;
        setBusy(true);
        const { error } = await supabase.from('profiles').update({
            custom_status: status.text.slice(0, 60),
            custom_status_emoji: status.emoji.slice(0, 4),
        }).eq('id', user.id);
        setBusy(false);
        if (error) { toast.error('No se pudo guardar'); return; }
        toast.success('Estado actualizado');
        onSaved?.();
        onClose();
    };

    const clear = async () => {
        if (!user) return;
        setStatus({ emoji: '', text: '' });
        setBusy(true);
        await supabase.from('profiles').update({
            custom_status: '',
            custom_status_emoji: '',
        }).eq('id', user.id);
        setBusy(false);
        toast.success('Estado borrado');
        onSaved?.();
    };

    if (!user) return null;

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal small status-editor" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-comment-dots"></i> Mi estado</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    <div class="status-preview">
                        <span class="status-preview-emoji">{status.emoji || '💬'}</span>
                        <strong>{status.text || 'Sin estado'}</strong>
                    </div>

                    <div class="form-grid">
                        <label>
                            <span><i class="fas fa-face-smile"></i> Emoji</span>
                            <input
                                type="text"
                                maxLength={4}
                                value={status.emoji}
                                placeholder="🙂"
                                onInput={(e: any) => setStatus(s => ({ ...s, emoji: e.currentTarget.value }))}
                            />
                        </label>
                        <label>
                            <span><i class="fas fa-pen"></i> Mensaje (max 60 chars)</span>
                            <input
                                type="text"
                                maxLength={60}
                                value={status.text}
                                placeholder="¿Qué pasa?"
                                onInput={(e: any) => setStatus(s => ({ ...s, text: e.currentTarget.value }))}
                            />
                        </label>
                    </div>

                    <h4 class="status-quick-title">Rápidos</h4>
                    <div class="status-quick-grid">
                        {QUICK_STATUSES.map(q => (
                            <button
                                key={q.emoji}
                                class="status-quick-btn"
                                onClick={() => setStatus(q)}
                            >
                                <span>{q.emoji}</span>
                                <small>{q.text}</small>
                            </button>
                        ))}
                    </div>
                </div>
                <footer class="compose-footer">
                    <button class="auth-btn ghost small" onClick={clear} disabled={busy}>
                        <i class="fas fa-eraser"></i> Borrar
                    </button>
                    <button class="auth-btn primary" onClick={save} disabled={busy}>
                        <i class="fas fa-floppy-disk"></i> Guardar
                    </button>
                </footer>
            </div>
        </div>
    );
}
