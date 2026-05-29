/* ============================================================
   Home customizer · "Personaliza tu inicio"
   - Estado QUIETO: widgets limpios, sin adornos (lienzo calmado).
   - Modo EDICIÓN: reordenar (drag @dnd-kit, accesible + táctil),
     quitar, y bandeja para añadir los ocultos. Animaciones Motion One.
   - Persistencia: localStorage + Supabase (sigue al usuario).

   NOTA SSR: los hooks de @dnd-kit (useSensors/useSortable) viven en un
   subcomponente que SOLO se monta en modo edición. Como `editing` arranca
   en false, el prerender de Astro nunca ejecuta @dnd-kit (que resolvería
   al React real y reventaría con dispatcher null).
   ============================================================ */
import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
    DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor,
    useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ComponentChildren } from 'preact';
import { useSession } from '../lib/auth';
import { WIDGET_MAP, ALL_WIDGET_IDS } from '../lib/widget-registry';
import {
    loadVisible, saveVisible, resetVisible, fetchRemoteVisible, saveRemoteVisible,
    CHANGED_EVENT,
} from '../lib/widget-prefs';
import { enterUp, pop } from '../lib/motion';
import ErrorBoundary from './ErrorBoundary';

interface Props {
    onEdit?: () => void;
}

type RenderBody = (id: string) => ComponentChildren;

/* ──────────── Una tarjeta-widget ordenable (solo en edición) ──────────── */
function SortableWidget({
    id, justAdded, onRemove, children,
}: {
    id: string;
    justAdded: boolean;
    onRemove: (id: string) => void;
    children: ComponentChildren;
}) {
    const meta = WIDGET_MAP[id];
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({ id });
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (justAdded) pop(ref.current);
    }, [justAdded]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    return (
        <div
            ref={(el) => { setNodeRef(el as any); ref.current = el as HTMLDivElement | null; }}
            style={style}
            class={`tvc-slot ${isDragging ? 'tvc-slot--drag' : ''}`}
        >
            <div class="tvc-slot-bar">
                <button
                    class="tvc-handle"
                    aria-label={`Reordenar ${meta?.label ?? ''}`}
                    {...attributes}
                    {...listeners}
                >
                    <i class="fas fa-grip-vertical"></i>
                </button>
                <span class="tvc-slot-name">
                    <i class={`fas ${meta?.icon ?? 'fa-cube'}`}></i> {meta?.label ?? id}
                </span>
                <button
                    class="tvc-remove"
                    aria-label={`Quitar ${meta?.label ?? ''}`}
                    title="Quitar de tu inicio"
                    onClick={() => onRemove(id)}
                >
                    <i class="fas fa-eye-slash"></i>
                </button>
            </div>
            <div class="tvc-slot-body" aria-hidden="true">
                {children}
            </div>
        </div>
    );
}

/* ──────────── Lista editable con DnD (SOLO cliente / modo edición) ──────────── */
function WidgetEditList({
    visible, justAdded, onReorder, onRemove, renderBody,
}: {
    visible: string[];
    justAdded: string | null;
    onReorder: (next: string[]) => void;
    onRemove: (id: string) => void;
    renderBody: RenderBody;
}) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const onDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const from = visible.indexOf(String(active.id));
        const to = visible.indexOf(String(over.id));
        if (from === -1 || to === -1) return;
        onReorder(arrayMove(visible, from, to));
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={visible} strategy={verticalListSortingStrategy}>
                <div class="tvc-list">
                    {visible.map((id) => (
                        <SortableWidget key={id} id={id} justAdded={justAdded === id} onRemove={onRemove}>
                            {renderBody(id)}
                        </SortableWidget>
                    ))}
                    {visible.length === 0 && (
                        <div class="tvc-empty">
                            <i class="fas fa-wind"></i>
                            <p>Tu inicio está vacío. Añade widgets abajo 👇</p>
                        </div>
                    )}
                </div>
            </SortableContext>
        </DndContext>
    );
}

export default function DynamicWidgets({ onEdit }: Props) {
    const { user, ready } = useSession();
    const [visible, setVisible] = useState<string[]>(ALL_WIDGET_IDS);
    const [editing, setEditing] = useState(false);
    const [justAdded, setJustAdded] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);

    /* Carga local inmediata + remota si hay sesión */
    useEffect(() => {
        const local = loadVisible();
        if (local) setVisible(local);
    }, []);
    useEffect(() => {
        if (!ready || !user) return;
        fetchRemoteVisible(user.id).then((remote) => {
            if (remote && remote.length) {
                setVisible(remote);
                saveVisible(remote, false); // cachea local sin re-emitir
            }
        });
    }, [user?.id, ready]);

    /* Sincroniza si otra isla cambia la config */
    useEffect(() => {
        const onChange = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (Array.isArray(detail)) setVisible(detail);
        };
        window.addEventListener(CHANGED_EVENT, onChange);
        return () => window.removeEventListener(CHANGED_EVENT, onChange);
    }, []);

    /* Anima el panel de edición al abrirlo */
    useEffect(() => {
        if (editing) enterUp(panelRef.current);
    }, [editing]);

    const persist = (next: string[]) => {
        setVisible(next);
        saveVisible(next);
        if (user) saveRemoteVisible(user.id, next);
    };

    const removeW = (id: string) => persist(visible.filter((x) => x !== id));
    const addW = (id: string) => {
        setJustAdded(id);
        persist([...visible, id]);
    };
    const reset = () => {
        resetVisible();
        setVisible([...ALL_WIDGET_IDS]);
        if (user) saveRemoteVisible(user.id, [...ALL_WIDGET_IDS]);
    };

    const available = ALL_WIDGET_IDS.filter((id) => !visible.includes(id));

    const renderBody: RenderBody = (id) => {
        const meta = WIDGET_MAP[id];
        if (!meta) return null;
        return <ErrorBoundary name={id}>{meta.render({ onEdit })}</ErrorBoundary>;
    };

    return (
        <div class="tvc-root">
            {/* ── Cabecera del customizer ── */}
            <div class="tvc-head">
                <span class="tvc-head-title">
                    <i class="fas fa-table-cells-large"></i> Tu inicio
                </span>
                <button
                    class={`tvc-edit-btn ${editing ? 'is-on' : ''}`}
                    onClick={() => setEditing((v) => !v)}
                >
                    {editing
                        ? (<><i class="fas fa-check"></i> Listo</>)
                        : (<><i class="fas fa-sliders"></i> Personalizar</>)}
                </button>
            </div>

            {/* ── Widgets ── */}
            {editing ? (
                <WidgetEditList
                    visible={visible}
                    justAdded={justAdded}
                    onReorder={persist}
                    onRemove={removeW}
                    renderBody={renderBody}
                />
            ) : (
                /* Modo quieto: widgets directos (conservan su propio espaciado,
                   y los que renderizan null simplemente desaparecen sin hueco). */
                visible.map((id) => (
                    <Fragment key={id}>{renderBody(id)}</Fragment>
                ))
            )}

            {/* ── Panel de edición: bandeja para añadir + reset ── */}
            {editing && (
                <div class="tvc-panel" ref={panelRef}>
                    <div class="tvc-panel-head">
                        <i class="fas fa-plus"></i> Añadir a tu inicio
                    </div>
                    {available.length === 0 ? (
                        <p class="tvc-panel-empty">Ya tienes todos los widgets activos. 🎉</p>
                    ) : (
                        <div class="tvc-tray">
                            {available.map((id) => {
                                const meta = WIDGET_MAP[id];
                                return (
                                    <button key={id} class="tvc-chip" onClick={() => addW(id)} title={meta?.description}>
                                        <span class="tvc-chip-ico"><i class={`fas ${meta?.icon}`}></i></span>
                                        <span class="tvc-chip-txt">
                                            <b>{meta?.label}</b>
                                            <small>{meta?.description}</small>
                                        </span>
                                        <i class="fas fa-plus tvc-chip-add"></i>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <button class="tvc-reset" onClick={reset}>
                        <i class="fas fa-rotate-left"></i> Restablecer al orden por defecto
                    </button>
                </div>
            )}
        </div>
    );
}
