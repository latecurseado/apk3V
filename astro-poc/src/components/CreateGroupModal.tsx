import { useState } from 'preact/hooks';
import { createGroup, createCommunity, type GroupKind } from '../lib/groups';
import { toast } from '../lib/toast';

interface Props {
    onClose: () => void;
    onCreated?: (groupId: string) => void;
}

const KIND_OPTIONS: { id: GroupKind; label: string; desc: string; icon: string; accent: string }[] = [
    {
        id: 'group',
        label: 'Grupo',
        desc: 'Chat con varios amigos · todos pueden escribir',
        icon: 'fa-user-group',
        accent: '#00d2ff',
    },
    {
        id: 'channel',
        label: 'Canal (creador)',
        desc: 'Tú publicas, tus seguidores leen · estilo broadcast',
        icon: 'fa-bullhorn',
        accent: '#ff0844',
    },
    {
        id: 'community',
        label: 'Comunidad',
        desc: 'Espacio con varios canales · crea un #General de inicio',
        icon: 'fa-users-rectangle',
        accent: '#a855f7',
    },
];

export default function CreateGroupModal({ onClose, onCreated }: Props) {
    const [kind, setKind] = useState<GroupKind>('group');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (name.trim().length < 2) { toast.error('Nombre muy corto'); return; }
        setBusy(true);
        const id = kind === 'community'
            ? await createCommunity({ name: name.trim(), description: description.trim(), is_public: isPublic })
            : await createGroup({ name: name.trim(), kind, is_public: isPublic, description: description.trim() });
        setBusy(false);
        if (!id) { toast.error('No se pudo crear'); return; }
        toast.success(kind === 'community' ? '¡Comunidad creada!' : kind === 'channel' ? '¡Canal creado!' : '¡Grupo creado!');
        onCreated?.(id);
        onClose();
    };

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal small create-group-modal" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-circle-plus"></i> Nuevo {kind === 'channel' ? 'canal' : kind === 'community' ? 'comunidad' : 'grupo'}</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    <p class="hub-section-lead" style="margin:0 0 12px;">¿Qué tipo quieres crear?</p>
                    <div class="group-kind-grid">
                        {KIND_OPTIONS.map(k => (
                            <button
                                key={k.id}
                                type="button"
                                class={`group-kind-card ${kind === k.id ? 'active' : ''}`}
                                onClick={() => setKind(k.id)}
                                style={`--accent:${k.accent}`}
                            >
                                <span class="group-kind-icon"><i class={`fas ${k.icon}`}></i></span>
                                <strong>{k.label}</strong>
                                <small>{k.desc}</small>
                            </button>
                        ))}
                    </div>

                    <label class="reel-caption">
                        <span><i class="fas fa-tag"></i> Nombre</span>
                        <input
                            type="text"
                            maxLength={60}
                            placeholder={kind === 'channel' ? 'ej. Noticias de Don Juan' : 'ej. Amigos del barrio'}
                            value={name}
                            onInput={(e: any) => setName(e.currentTarget.value)}
                            autoFocus
                        />
                    </label>

                    <label class="reel-caption">
                        <span><i class="fas fa-align-left"></i> Descripción (opcional)</span>
                        <textarea
                            rows={2}
                            maxLength={200}
                            placeholder="¿De qué se trata?"
                            value={description}
                            onInput={(e: any) => setDescription(e.currentTarget.value)}
                        />
                    </label>

                    <label class="settings-toggle">
                        <input type="checkbox" checked={isPublic} onChange={(e: any) => setIsPublic(e.currentTarget.checked)} />
                        <span>
                            <i class="fas fa-globe"></i> Público (cualquiera puede unirse)
                            <small class="auth-hint" style="display:block;margin-top:2px;">
                                Si está apagado, solo entras invitando manualmente
                            </small>
                        </span>
                    </label>
                </div>
                <footer class="compose-footer">
                    <button class="auth-btn ghost small" onClick={onClose} disabled={busy}>Cancelar</button>
                    <button class="auth-btn primary" onClick={submit} disabled={busy || !name.trim()}>
                        {busy
                            ? <><i class="fas fa-circle-notch fa-spin"></i> Creando…</>
                            : <><i class="fas fa-circle-plus"></i> Crear</>}
                    </button>
                </footer>
            </div>
        </div>
    );
}
