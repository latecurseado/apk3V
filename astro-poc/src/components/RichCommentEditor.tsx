import { useEffect, useRef, useState } from 'preact/hooks';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import { supabase } from '../lib/supabase';

interface Props {
    placeholder?: string;
    submitLabel?: string;
    onSubmit: (html: string) => void | Promise<void>;
    onCancel?: () => void;
    autoFocus?: boolean;
    initialExpanded?: boolean;
    submitting?: boolean;
    compact?: boolean;
}

function makeMentionSuggestion() {
    let popup: HTMLDivElement | null = null;
    let items: Array<{ id: string; label: string; pfp: string | null }> = [];
    let selectedIndex = 0;
    let currentCommand: ((opts: any) => void) | null = null;

    const renderPopup = (rect: DOMRect | null) => {
        if (!popup) {
            popup = document.createElement('div');
            popup.className = 'mention-dropdown';
            document.body.appendChild(popup);
        }
        popup.innerHTML = items.length === 0
            ? '<div class="mention-empty">Sin coincidencias</div>'
            : items.map((it, i) => `
                <button class="mention-item ${i === selectedIndex ? 'active' : ''}" data-idx="${i}">
                    <span class="mention-avatar">${it.pfp ? `<img src="${it.pfp}" alt="">` : `<i class="fas fa-user"></i>`}</span>
                    <strong>@${it.label}</strong>
                </button>
            `).join('');
        if (rect) {
            popup.style.position = 'fixed';
            popup.style.top = `${rect.bottom + 6}px`;
            popup.style.left = `${rect.left}px`;
            popup.style.display = 'block';
        }
        popup.querySelectorAll('.mention-item').forEach(btn => {
            btn.addEventListener('mousedown', (e: any) => {
                e.preventDefault();
                const idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
                pickItem(idx);
            });
        });
    };

    const hidePopup = () => {
        if (popup) { popup.remove(); popup = null; }
    };

    const pickItem = (idx: number) => {
        const item = items[idx];
        if (!item || !currentCommand) return;
        currentCommand({ id: item.id, label: item.label });
        hidePopup();
    };

    return {
        char: '@',
        async items({ query }: { query: string }) {
            if (!query) return [];
            const { data } = await supabase
                .from('profiles')
                .select('id, username, pfp')
                .ilike('username', `${query}%`)
                .limit(8);
            return (data || []).map((p: any) => ({
                id: p.id,
                label: p.username,
                pfp: p.pfp,
            }));
        },
        render() {
            return {
                onStart: (props: any) => {
                    items = props.items;
                    selectedIndex = 0;
                    currentCommand = props.command;
                    const rect = props.clientRect ? props.clientRect() : null;
                    renderPopup(rect);
                },
                onUpdate: (props: any) => {
                    items = props.items;
                    currentCommand = props.command;
                    if (selectedIndex >= items.length) selectedIndex = 0;
                    const rect = props.clientRect ? props.clientRect() : null;
                    renderPopup(rect);
                },
                onKeyDown: (props: any) => {
                    if (props.event.key === 'ArrowDown') {
                        selectedIndex = (selectedIndex + 1) % Math.max(items.length, 1);
                        renderPopup(null);
                        return true;
                    }
                    if (props.event.key === 'ArrowUp') {
                        selectedIndex = (selectedIndex - 1 + items.length) % Math.max(items.length, 1);
                        renderPopup(null);
                        return true;
                    }
                    if (props.event.key === 'Enter' || props.event.key === 'Tab') {
                        if (items.length > 0) {
                            pickItem(selectedIndex);
                            return true;
                        }
                    }
                    if (props.event.key === 'Escape') {
                        hidePopup();
                        return true;
                    }
                    return false;
                },
                onExit: () => {
                    hidePopup();
                },
            };
        },
    };
}

/**
 * Editor de comentarios/respuestas expandible.
 * Colapsado: muestra una pill estilo input.
 * Expandido: Tiptap con toolbar completa (negrita, cursiva, subrayado, tachado,
 *   código, encabezados, listas, cita, alineación, resaltado, link, deshacer/rehacer).
 *
 * Devuelve HTML al onSubmit. Quien lo use es responsable de sanitizar antes
 * de renderizar (sanitizeCommentHtml).
 */
export default function RichCommentEditor({
    placeholder = 'Escribe tu comentario…',
    submitLabel = 'Comentar',
    onSubmit,
    onCancel,
    autoFocus = false,
    initialExpanded = false,
    submitting = false,
    compact = false,
}: Props) {
    const [expanded, setExpanded] = useState(initialExpanded || autoFocus);
    const [html, setHtml] = useState('');
    const editorRef = useRef<HTMLDivElement>(null);
    const editorInstance = useRef<Editor | null>(null);
    const [, forceTick] = useState(0);

    useEffect(() => {
        if (!expanded || !editorRef.current) return;
        const editor = new Editor({
            element: editorRef.current,
            extensions: [
                StarterKit.configure({
                    heading: { levels: [2, 3] },
                }),
                Underline,
                Link.configure({
                    openOnClick: false,
                    autolink: true,
                    HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
                }),
                TextAlign.configure({
                    types: ['heading', 'paragraph'],
                    alignments: ['left', 'center', 'right', 'justify'],
                }),
                Highlight.configure({ multicolor: false }),
                Typography,
                Placeholder.configure({ placeholder }),
                Mention.configure({
                    HTMLAttributes: { class: 'tiptap-mention' },
                    renderText({ node }) { return `@${node.attrs.label ?? node.attrs.id}`; },
                    renderHTML({ node, options }) {
                        return [
                            'a',
                            {
                                ...options.HTMLAttributes,
                                href: `/perfil?u=${node.attrs.label || node.attrs.id}`,
                                'data-mention-id': node.attrs.id,
                            },
                            `@${node.attrs.label ?? node.attrs.id}`,
                        ];
                    },
                    suggestion: makeMentionSuggestion(),
                }),
            ],
            content: '',
            autofocus: autoFocus ? 'end' : false,
            onUpdate: ({ editor: ed }) => {
                setHtml(ed.getHTML());
                forceTick(t => t + 1);
            },
            onSelectionUpdate: () => forceTick(t => t + 1),
            editorProps: {
                attributes: {
                    class: 'rce-content',
                    spellcheck: 'true',
                },
                handleKeyDown(_view, event) {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        doSubmit();
                        return true;
                    }
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        cancel();
                        return true;
                    }
                    return false;
                },
            },
        });
        editorInstance.current = editor;
        return () => {
            editor.destroy();
            editorInstance.current = null;
        };
    }, [expanded]);

    const cmd = (fn: (e: Editor) => void) => (ev: any) => {
        ev?.preventDefault?.();
        const ed = editorInstance.current;
        if (ed) { fn(ed); forceTick(t => t + 1); }
    };

    const insertLink = (ev: any) => {
        ev?.preventDefault?.();
        const ed = editorInstance.current;
        if (!ed) return;
        const previous = ed.getAttributes('link').href || '';
        const url = window.prompt('URL del enlace', previous);
        if (url === null) return;
        if (url === '') {
            ed.chain().focus().unsetLink().run();
            return;
        }
        ed.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        forceTick(t => t + 1);
    };

    const doSubmit = async () => {
        const ed = editorInstance.current;
        if (!ed) return;
        const content = ed.getHTML().trim();
        const plain = ed.getText().trim();
        if (!plain) return;
        await onSubmit(content);
        ed.commands.clearContent();
        setHtml('');
        if (!initialExpanded) setExpanded(false);
    };

    const cancel = () => {
        editorInstance.current?.commands.clearContent();
        setHtml('');
        if (!initialExpanded) setExpanded(false);
        onCancel?.();
    };

    const isActive = (name: string, attrs?: any) =>
        editorInstance.current?.isActive(name, attrs) ? 'active' : '';

    const plainEmpty = !editorInstance.current || !editorInstance.current.getText().trim();

    if (!expanded) {
        return (
            <button
                type="button"
                class={`rce-collapsed${compact ? ' compact' : ''}`}
                onClick={() => setExpanded(true)}
            >
                <i class="fas fa-pen"></i>
                <span>{placeholder}</span>
            </button>
        );
    }

    return (
        <div class={`rich-comment-editor${compact ? ' compact' : ''}`}>
            <div class="rce-toolbar">
                <div class="rce-tg">
                    <button class={`rce-btn ${isActive('bold')}`} onMouseDown={cmd(e => e.chain().focus().toggleBold().run())} title="Negrita (Ctrl+B)">
                        <i class="fas fa-bold"></i>
                    </button>
                    <button class={`rce-btn ${isActive('italic')}`} onMouseDown={cmd(e => e.chain().focus().toggleItalic().run())} title="Cursiva (Ctrl+I)">
                        <i class="fas fa-italic"></i>
                    </button>
                    <button class={`rce-btn ${isActive('underline')}`} onMouseDown={cmd(e => e.chain().focus().toggleUnderline().run())} title="Subrayado (Ctrl+U)">
                        <i class="fas fa-underline"></i>
                    </button>
                    <button class={`rce-btn ${isActive('strike')}`} onMouseDown={cmd(e => e.chain().focus().toggleStrike().run())} title="Tachado">
                        <i class="fas fa-strikethrough"></i>
                    </button>
                    <button class={`rce-btn ${isActive('code')}`} onMouseDown={cmd(e => e.chain().focus().toggleCode().run())} title="Código en línea">
                        <i class="fas fa-code"></i>
                    </button>
                    <button class={`rce-btn ${isActive('highlight')}`} onMouseDown={cmd(e => e.chain().focus().toggleHighlight().run())} title="Resaltado">
                        <i class="fas fa-highlighter"></i>
                    </button>
                </div>

                <div class="rce-tg">
                    <button class={`rce-btn ${isActive('heading', { level: 2 })}`} onMouseDown={cmd(e => e.chain().focus().toggleHeading({ level: 2 }).run())} title="Encabezado 2">
                        <span class="rce-htxt">H2</span>
                    </button>
                    <button class={`rce-btn ${isActive('heading', { level: 3 })}`} onMouseDown={cmd(e => e.chain().focus().toggleHeading({ level: 3 }).run())} title="Encabezado 3">
                        <span class="rce-htxt">H3</span>
                    </button>
                </div>

                <div class="rce-tg">
                    <button class={`rce-btn ${isActive({ textAlign: 'left' } as any) || (editorInstance.current?.isActive({ textAlign: 'left' }) ? 'active' : '')}`}
                        onMouseDown={cmd(e => e.chain().focus().setTextAlign('left').run())} title="Alinear izquierda">
                        <i class="fas fa-align-left"></i>
                    </button>
                    <button class={`rce-btn ${editorInstance.current?.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
                        onMouseDown={cmd(e => e.chain().focus().setTextAlign('center').run())} title="Centrar">
                        <i class="fas fa-align-center"></i>
                    </button>
                    <button class={`rce-btn ${editorInstance.current?.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
                        onMouseDown={cmd(e => e.chain().focus().setTextAlign('right').run())} title="Alinear derecha">
                        <i class="fas fa-align-right"></i>
                    </button>
                    <button class={`rce-btn ${editorInstance.current?.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
                        onMouseDown={cmd(e => e.chain().focus().setTextAlign('justify').run())} title="Justificar">
                        <i class="fas fa-align-justify"></i>
                    </button>
                </div>

                <div class="rce-tg">
                    <button class={`rce-btn ${isActive('bulletList')}`} onMouseDown={cmd(e => e.chain().focus().toggleBulletList().run())} title="Lista">
                        <i class="fas fa-list-ul"></i>
                    </button>
                    <button class={`rce-btn ${isActive('orderedList')}`} onMouseDown={cmd(e => e.chain().focus().toggleOrderedList().run())} title="Lista numerada">
                        <i class="fas fa-list-ol"></i>
                    </button>
                    <button class={`rce-btn ${isActive('blockquote')}`} onMouseDown={cmd(e => e.chain().focus().toggleBlockquote().run())} title="Cita">
                        <i class="fas fa-quote-right"></i>
                    </button>
                    <button class={`rce-btn ${isActive('link')}`} onMouseDown={insertLink} title="Enlace">
                        <i class="fas fa-link"></i>
                    </button>
                </div>

                <div class="rce-tg rce-tg-end">
                    <button class="rce-btn" onMouseDown={cmd(e => e.chain().focus().undo().run())} title="Deshacer (Ctrl+Z)">
                        <i class="fas fa-rotate-left"></i>
                    </button>
                    <button class="rce-btn" onMouseDown={cmd(e => e.chain().focus().redo().run())} title="Rehacer (Ctrl+Y)">
                        <i class="fas fa-rotate-right"></i>
                    </button>
                </div>
            </div>

            <div class="rce-surface" ref={editorRef} />

            <div class="rce-foot">
                <small class="rce-hint">
                    <kbd>Ctrl</kbd>+<kbd>↵</kbd> publicar · <kbd>Esc</kbd> cancelar
                </small>
                <div class="rce-actions">
                    <button type="button" class="rce-cancel" onClick={cancel} disabled={submitting}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        class="rce-submit"
                        onClick={doSubmit}
                        disabled={submitting || plainEmpty}
                    >
                        {submitting
                            ? <><i class="fas fa-circle-notch fa-spin"></i> {submitLabel}…</>
                            : <><i class="fas fa-paper-plane"></i> {submitLabel}</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
