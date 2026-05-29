import { useEffect, useMemo, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import {
    fetchSections, updateSection, deleteSection, insertSection,
    seedExploraDefaults, seedInicioDefaults,
    isAdmin as checkAdmin, moveSection, slugify,
    type Section,
} from '../lib/cms';
import { sanitizeCmsHtml } from '../lib/sanitize';
import RichEditor from './RichEditor';

interface Props {
    pageSlug: string;            // 'explora' | 'inicio' | ...
    emptyMessage?: string;
    seedLabel?: string;
}

export default function PageSections({ pageSlug, emptyMessage, seedLabel }: Props) {
    const { user, ready } = useSession();
    const [isAdmin, setIsAdmin] = useState(false);
    const [sections, setSections] = useState<Section[] | null>(null);
    const [seeding, setSeeding] = useState(false);
    const [seedErr, setSeedErr] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!user) { setIsAdmin(false); return; }
        checkAdmin().then(setIsAdmin);
    }, [user?.id]);

    useEffect(() => {
        fetchSections(pageSlug).then(setSections);
    }, [pageSlug]);

    useEffect(() => {
        const channel = supabase
            .channel(`tv-cms-${pageSlug}`)
            .on(
                'postgres_changes' as any,
                { event: '*', schema: 'public', table: 'content_sections', filter: `page_slug=eq.${pageSlug}` },
                async () => {
                    const fresh = await fetchSections(pageSlug);
                    setSections(fresh);
                },
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [pageSlug]);

    const doSeed = async () => {
        setSeeding(true);
        setSeedErr(null);
        const res = pageSlug === 'inicio'
            ? await seedInicioDefaults()
            : await seedExploraDefaults();
        setSeeding(false);
        if (!res.ok) {
            setSeedErr(res.reason || 'Error desconocido');
            return;
        }
        const fresh = await fetchSections(pageSlug);
        setSections(fresh);
    };

    const doMove = async (id: string, direction: 'up' | 'down') => {
        if (!sections) return;
        await moveSection(sections, id, direction);
    };

    const doCreate = async () => {
        if (!sections) return;
        const title = window.prompt('Título de la nueva sección', 'Nueva sección');
        if (!title || !title.trim()) return;
        const existing = new Set(sections.map(s => s.section_key));
        const key = slugify(title, existing);
        const nextOrder = sections.length > 0 ? Math.max(...sections.map(s => s.sort_order)) + 10 : 10;
        setCreating(true);
        const res = await insertSection({
            page_slug: pageSlug,
            section_key: key,
            title: title.trim(),
            icon: 'fa-circle-info',
            sort_order: nextOrder,
            body: '<p class="hub-section-lead">Edita esta sección para añadir contenido.</p>',
        });
        setCreating(false);
        if (!res.ok) alert('No se pudo crear: ' + (res.reason || 'error desconocido'));
    };

    if (sections === null) {
        return <div class="cms-loading">Cargando contenido…</div>;
    }

    if (sections.length === 0) {
        return (
            <div class="cms-empty">
                <i class="fas fa-database"></i>
                <h3>Sin contenido todavía</h3>
                {!ready && <p>Verificando sesión…</p>}
                {ready && !isAdmin && (
                    <p>
                        {emptyMessage || `La tabla content_sections para "${pageSlug}" está vacía. Un admin debe inicializar.`}
                    </p>
                )}
                {ready && isAdmin && (
                    <>
                        <p>Eres admin. Inicializa el contenido por defecto.</p>
                        <button class="auth-btn primary" onClick={doSeed} disabled={seeding}>
                            <i class="fas fa-rocket"></i> {seeding ? 'Insertando…' : (seedLabel || 'Inicializar contenido por defecto')}
                        </button>
                        {seedErr && <p class="cms-err"><i class="fas fa-triangle-exclamation"></i> {seedErr}</p>}
                    </>
                )}
            </div>
        );
    }

    return (
        <>
            {isAdmin && (
                <div class="cms-admin-banner">
                    <i class="fas fa-shield-halved"></i>
                    <span>Modo edición activo. Edita, reordena con ↑↓ o crea nuevas secciones.</span>
                </div>
            )}
            {sections.map((s, i) => (
                <SectionView
                    key={s.id}
                    section={s}
                    canEdit={isAdmin}
                    isFirst={i === 0}
                    isLast={i === sections.length - 1}
                    onMove={(dir) => doMove(s.id, dir)}
                />
            ))}
            {isAdmin && (
                <div class="cms-create-row">
                    <button class="auth-btn primary" onClick={doCreate} disabled={creating}>
                        <i class="fas fa-plus"></i> {creating ? 'Creando…' : 'Crear nueva sección'}
                    </button>
                </div>
            )}
        </>
    );
}

function SectionView({
    section, canEdit, isFirst, isLast, onMove,
}: {
    section: Section;
    canEdit: boolean;
    isFirst: boolean;
    isLast: boolean;
    onMove: (dir: 'up' | 'down') => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(section.title);
    const [draftIcon, setDraftIcon] = useState(section.icon);
    const [draftBody, setDraftBody] = useState(section.body);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const safeHtml = useMemo(() => sanitizeCmsHtml(section.body), [section.body]);

    const openEditor = () => {
        setDraftTitle(section.title);
        setDraftIcon(section.icon);
        setDraftBody(section.body);
        setEditing(true);
        setErr(null);
    };

    const save = async () => {
        setSaving(true);
        const res = await updateSection(section.id, {
            title: draftTitle,
            icon: draftIcon,
            body: draftBody,
        });
        setSaving(false);
        if (!res.ok) { setErr(res.reason || 'Error desconocido'); return; }
        setEditing(false);
    };

    const remove = async () => {
        if (!confirm(`¿Eliminar la sección "${section.title}"? No se puede deshacer.`)) return;
        await deleteSection(section.id);
    };

    return (
        <section class="hub-section" id={`hub-${section.section_key}`}>
            <h2>
                <i class={`fas ${section.icon}`}></i>
                <span class="cms-section-title">{section.title}</span>
                {canEdit && !editing && (
                    <span class="cms-actions">
                        <button class="cms-btn" onClick={() => onMove('up')} disabled={isFirst} title="Mover arriba">
                            <i class="fas fa-arrow-up"></i>
                        </button>
                        <button class="cms-btn" onClick={() => onMove('down')} disabled={isLast} title="Mover abajo">
                            <i class="fas fa-arrow-down"></i>
                        </button>
                        <button class="cms-btn" onClick={openEditor} title="Editar">
                            <i class="fas fa-pencil"></i>
                        </button>
                        <button class="cms-btn danger" onClick={remove} title="Borrar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </span>
                )}
            </h2>

            {editing ? (
                <div class="cms-editor">
                    <div class="cms-editor-row">
                        <label class="grow">
                            <span>Título</span>
                            <input type="text" value={draftTitle}
                                onInput={(e: any) => setDraftTitle(e.currentTarget.value)} />
                        </label>
                        <label class="shrink">
                            <span>Icono</span>
                            <input type="text" value={draftIcon} placeholder="fa-landmark"
                                onInput={(e: any) => setDraftIcon(e.currentTarget.value)} />
                        </label>
                    </div>
                    <label>
                        <span>Contenido</span>
                        <RichEditor value={draftBody} onChange={setDraftBody} />
                    </label>
                    {err && <p class="cms-err"><i class="fas fa-triangle-exclamation"></i> {err}</p>}
                    <div class="cms-editor-actions">
                        <button class="auth-btn ghost" onClick={() => setEditing(false)} disabled={saving}>
                            Cancelar
                        </button>
                        <button class="auth-btn primary" onClick={save} disabled={saving || !draftTitle.trim()}>
                            <i class="fas fa-floppy-disk"></i> {saving ? 'Guardando…' : 'Guardar'}
                        </button>
                    </div>
                </div>
            ) : (
                <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
            )}

            {canEdit && !editing && (
                <small class="cms-meta">
                    <i class="fas fa-clock"></i> Editado {new Date(section.updated_at).toLocaleString('es-MX')}
                </small>
            )}
        </section>
    );
}
