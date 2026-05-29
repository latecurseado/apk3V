import { useEffect, useState } from 'preact/hooks';
import { fetchThreadSettings, updateThreadSettings, type DmThreadSettings } from '../lib/dms';
import { toast } from '../lib/toast';

const COLOR_PRESETS = ['', '#00d2ff', '#ff0844', '#10b981', '#f59e0b', '#a855f7', '#ec4899'];
const EXPIRE_OPTIONS = [
    { val: 0,    label: 'Permanentes' },
    { val: 1,    label: '1 hora' },
    { val: 24,   label: '24 horas' },
    { val: 168,  label: '7 días' },
    { val: 720,  label: '30 días' },
];

interface Props {
    threadId: string;
    onClose: () => void;
    onChange?: (settings: DmThreadSettings) => void;
}

export default function ChatSettingsModal({ threadId, onClose, onChange }: Props) {
    const [settings, setSettings] = useState<DmThreadSettings | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchThreadSettings(threadId).then(setSettings); }, [threadId]);

    if (!settings) return null;

    const update = async (patch: Partial<DmThreadSettings>) => {
        const next = { ...settings, ...patch };
        setSettings(next);
        setSaving(true);
        const ok = await updateThreadSettings(threadId, patch);
        setSaving(false);
        if (ok) { onChange?.(next); }
        else toast.error('No se guardó');
    };

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal small" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-sliders"></i> Ajustes de la conversación</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    <div class="form-grid">
                        <label class="settings-toggle">
                            <input type="checkbox" checked={settings.muted}
                                onChange={(e: any) => update({ muted: e.currentTarget.checked })} />
                            <span><i class="fas fa-bell-slash"></i> Silenciar notificaciones</span>
                        </label>

                        <label>
                            <span><i class="fas fa-palette"></i> Color de acento</span>
                            <div class="color-grid">
                                {COLOR_PRESETS.map(c => (
                                    <button
                                        key={c || 'default'}
                                        type="button"
                                        class={`color-opt ${c === settings.accent_color ? 'active' : ''}`}
                                        onClick={() => update({ accent_color: c })}
                                        style={c ? `background: ${c};` : `background: linear-gradient(135deg, #444, #222); border: 2px dashed var(--border-strong);`}
                                        title={c || 'Por defecto'}
                                    >
                                        {c === settings.accent_color && <i class="fas fa-check"></i>}
                                    </button>
                                ))}
                            </div>
                        </label>

                        <label>
                            <span><i class="fas fa-image"></i> Fondo de chat (URL imagen)</span>
                            <input type="url" value={settings.background_url}
                                placeholder="https://imagen.com/bg.jpg · vacío para quitar"
                                onInput={(e: any) => update({ background_url: e.currentTarget.value })} />
                        </label>

                        <label>
                            <span><i class="far fa-clock"></i> Mensajes desaparecen después de</span>
                            <select value={settings.auto_delete_after_hours}
                                onChange={(e: any) => update({ auto_delete_after_hours: parseInt(e.currentTarget.value, 10) })}>
                                {EXPIRE_OPTIONS.map(o => (
                                    <option value={o.val}>{o.label}</option>
                                ))}
                            </select>
                            <small class="auth-hint">
                                Se aplica solo a nuevos mensajes. Los anteriores se conservan.
                            </small>
                        </label>

                        {saving && <small class="auth-hint"><i class="fas fa-circle-notch fa-spin"></i> Guardando…</small>}
                    </div>
                </div>
            </div>
        </div>
    );
}
