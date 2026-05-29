import { useEffect, useRef, useState } from 'preact/hooks';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

interface Props {
    value: string;
    onChange: (html: string) => void;
}

/**
 * Editor WYSIWYG con Tiptap + toggle a modo HTML crudo.
 * - Modo rico: bold, italic, h2, h3, listas, link, paragraph
 * - Modo HTML: textarea para los casos donde el admin necesita
 *   meter clases como .stat-pill, .accent-lead, etc. (que Tiptap
 *   no produce por defecto).
 */
export default function RichEditor({ value, onChange }: Props) {
    const [mode, setMode] = useState<'rich' | 'html'>('rich');
    const editorRef = useRef<HTMLDivElement>(null);
    const editorInstance = useRef<Editor | null>(null);

    // Inicializa Tiptap cuando entra en modo rich
    useEffect(() => {
        if (mode !== 'rich' || !editorRef.current) return;
        const editor = new Editor({
            element: editorRef.current,
            extensions: [
                StarterKit.configure({
                    heading: { levels: [2, 3] },
                }),
                Link.configure({
                    openOnClick: false,
                    autolink: true,
                    HTMLAttributes: { target: '_blank', rel: 'noopener' },
                }),
            ],
            content: value,
            onUpdate: ({ editor }) => {
                onChange(editor.getHTML());
            },
            editorProps: {
                attributes: {
                    class: 'tiptap-content',
                    spellcheck: 'true',
                },
            },
        });
        editorInstance.current = editor;
        return () => {
            editor.destroy();
            editorInstance.current = null;
        };
    }, [mode]);

    // Si el contenido externo cambia mientras estamos en rich, sincroniza
    useEffect(() => {
        const ed = editorInstance.current;
        if (!ed) return;
        const current = ed.getHTML();
        if (current !== value) {
            ed.commands.setContent(value, { emitUpdate: false });
        }
    }, [value]);

    const cmd = (fn: (e: Editor) => void) => () => {
        const ed = editorInstance.current;
        if (ed) fn(ed);
    };

    const insertLink = () => {
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
    };

    const isActive = (name: string, attrs?: any) =>
        editorInstance.current?.isActive(name, attrs) ? 'active' : '';

    return (
        <div class="rich-editor">
            <div class="rich-toolbar">
                <div class="rich-toolbar-group">
                    <button class={`rt-btn ${mode === 'rich' ? 'active' : ''}`} onClick={() => setMode('rich')}>
                        <i class="fas fa-wand-magic-sparkles"></i> Rico
                    </button>
                    <button class={`rt-btn ${mode === 'html' ? 'active' : ''}`} onClick={() => setMode('html')}>
                        <i class="fas fa-code"></i> HTML
                    </button>
                </div>
                {mode === 'rich' && (
                    <div class="rich-toolbar-group">
                        <button class={`rt-btn ${isActive('bold')}`} onClick={cmd(e => e.chain().focus().toggleBold().run())} title="Negrita (Ctrl+B)">
                            <i class="fas fa-bold"></i>
                        </button>
                        <button class={`rt-btn ${isActive('italic')}`} onClick={cmd(e => e.chain().focus().toggleItalic().run())} title="Cursiva (Ctrl+I)">
                            <i class="fas fa-italic"></i>
                        </button>
                        <button class={`rt-btn ${isActive('heading', { level: 2 })}`} onClick={cmd(e => e.chain().focus().toggleHeading({ level: 2 }).run())} title="Encabezado 2">
                            H2
                        </button>
                        <button class={`rt-btn ${isActive('heading', { level: 3 })}`} onClick={cmd(e => e.chain().focus().toggleHeading({ level: 3 }).run())} title="Encabezado 3">
                            H3
                        </button>
                        <button class={`rt-btn ${isActive('bulletList')}`} onClick={cmd(e => e.chain().focus().toggleBulletList().run())} title="Lista">
                            <i class="fas fa-list-ul"></i>
                        </button>
                        <button class={`rt-btn ${isActive('orderedList')}`} onClick={cmd(e => e.chain().focus().toggleOrderedList().run())} title="Lista numerada">
                            <i class="fas fa-list-ol"></i>
                        </button>
                        <button class={`rt-btn ${isActive('blockquote')}`} onClick={cmd(e => e.chain().focus().toggleBlockquote().run())} title="Cita">
                            <i class="fas fa-quote-right"></i>
                        </button>
                        <button class={`rt-btn ${isActive('link')}`} onClick={insertLink} title="Enlace">
                            <i class="fas fa-link"></i>
                        </button>
                        <button class="rt-btn" onClick={cmd(e => e.chain().focus().undo().run())} title="Deshacer">
                            <i class="fas fa-rotate-left"></i>
                        </button>
                        <button class="rt-btn" onClick={cmd(e => e.chain().focus().redo().run())} title="Rehacer">
                            <i class="fas fa-rotate-right"></i>
                        </button>
                    </div>
                )}
            </div>

            {mode === 'rich' ? (
                <div class="rich-surface" ref={editorRef} />
            ) : (
                <textarea
                    class="rich-html-area"
                    rows={18}
                    value={value}
                    onInput={(e: any) => onChange(e.currentTarget.value)}
                />
            )}
            <small class="rich-hint">
                {mode === 'rich'
                    ? 'Cambia a "HTML" si necesitas insertar clases como .stat-pill o .accent-lead.'
                    : 'HTML crudo permitido. Cuidado: lo escrito aquí se sanitiza, pero clases custom sí se respetan.'}
            </small>
        </div>
    );
}
