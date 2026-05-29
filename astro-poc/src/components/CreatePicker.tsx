import { useEffect, useState } from 'preact/hooks';
import ComposeModal from './ComposeModal';
import ReelUploader from './ReelUploader';
import DocUploader from './DocUploader';
import { useSession } from '../lib/auth';
import { requireAuthOrPrompt } from '../lib/auth-gate';
import { fetchForums, type Forum, type Thread } from '../lib/forum';

type Mode = 'menu' | 'hilo' | 'foto' | 'video' | 'reel' | 'doc';

interface Props {
    trigger?: 'button' | 'fab';
    label?: string;
    defaultForum?: Forum | null;
    onPosted?: (thread: Thread) => void;
}

const OPTIONS = [
    {
        id: 'hilo' as const,
        icon: 'fa-pen-to-square',
        title: 'Hilo',
        desc: 'Texto, encuesta, link · con o sin imagen',
        accent: '#00d2ff',
    },
    {
        id: 'foto' as const,
        icon: 'fa-image',
        title: 'Foto',
        desc: 'Sube 1-4 imágenes con un caption corto',
        accent: '#a855f7',
    },
    {
        id: 'video' as const,
        icon: 'fa-video',
        title: 'Video',
        desc: 'Sube un archivo de video o pega link de YouTube',
        accent: '#ff0844',
    },
    {
        id: 'reel' as const,
        icon: 'fa-mobile-screen',
        title: 'Reel',
        desc: 'Video corto vertical · sube un .mp4',
        accent: '#f59e0b',
    },
    {
        id: 'doc' as const,
        icon: 'fa-file-lines',
        title: 'Documento',
        desc: 'PDF, Word, Excel, hoja de texto…',
        accent: '#10b981',
    },
];

/**
 * Botón "Crear" que abre un selector con tarjetas para cada tipo de
 * contenido: Hilo, Foto, Video, Reel, Documento. Cada opción dispara
 * el flujo correspondiente (modal o uploader dedicado).
 */
export default function CreatePicker({
    trigger = 'button',
    label = 'Crear',
    defaultForum,
    onPosted,
}: Props) {
    const { user } = useSession();
    const [mode, setMode] = useState<Mode>('menu');
    const [open, setOpen] = useState(false);
    const [forums, setForums] = useState<Forum[]>([]);
    const [composerPreset, setComposerPreset] = useState<'plain' | 'image' | 'video'>('plain');

    useEffect(() => {
        fetchForums().then(setForums);
    }, []);

    const handleOpen = () => {
        if (!requireAuthOrPrompt('crear contenido', user?.id ?? null)) return;
        setMode('menu');
        setOpen(true);
    };

    const pick = (id: typeof OPTIONS[number]['id']) => {
        if (id === 'hilo') { setComposerPreset('plain'); setMode('hilo'); }
        else if (id === 'foto') { setComposerPreset('image'); setMode('hilo'); }
        else if (id === 'video') { setComposerPreset('video'); setMode('hilo'); }
        else if (id === 'reel') setMode('reel');
        else if (id === 'doc') setMode('doc');
    };

    const close = () => {
        setOpen(false);
        setMode('menu');
        setComposerPreset('plain');
    };

    return (
        <>
            {trigger === 'fab' ? (
                <button class="create-fab" onClick={handleOpen} aria-label={label} title={label}>
                    <i class="fas fa-plus"></i>
                </button>
            ) : (
                <button class="create-btn" onClick={handleOpen}>
                    <i class="fas fa-plus"></i> <span>{label}</span>
                </button>
            )}

            {open && mode === 'menu' && (
                <div class="modal-overlay" onClick={close}>
                    <div class="modal create-sheet" onClick={(e: any) => e.stopPropagation()}>
                        <header class="modal-head">
                            <h3><i class="fas fa-wand-magic-sparkles"></i> ¿Qué quieres crear?</h3>
                            <button class="modal-close" onClick={close} aria-label="Cerrar">
                                <i class="fas fa-xmark"></i>
                            </button>
                        </header>
                        <div class="create-grid">
                            {OPTIONS.map(o => (
                                <button
                                    key={o.id}
                                    class="create-card"
                                    onClick={() => pick(o.id)}
                                    style={`--accent: ${o.accent}`}
                                >
                                    <span class="create-card-icon">
                                        <i class={`fas ${o.icon}`}></i>
                                    </span>
                                    <strong>{o.title}</strong>
                                    <small>{o.desc}</small>
                                </button>
                            ))}
                        </div>
                        <footer class="create-foot">
                            <small><i class="fas fa-circle-info"></i> Elige el formato que mejor encaje con lo que quieres compartir.</small>
                        </footer>
                    </div>
                </div>
            )}

            {open && mode === 'hilo' && (
                <ComposeModal
                    onClose={close}
                    defaultForum={defaultForum}
                    onPosted={(t) => { onPosted?.(t); close(); }}
                    preset={composerPreset}
                />
            )}

            {open && mode === 'reel' && (
                <ReelUploader
                    forums={forums}
                    onClose={close}
                    onPosted={(t) => { onPosted?.(t); close(); }}
                />
            )}

            {open && mode === 'doc' && (
                <DocUploader
                    forums={forums}
                    onClose={close}
                    onPosted={(t) => { onPosted?.(t); close(); }}
                />
            )}
        </>
    );
}
