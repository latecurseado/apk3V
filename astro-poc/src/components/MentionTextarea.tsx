import { useEffect, useRef, useState } from 'preact/hooks';
import { searchProfiles } from '../lib/friends';
import { useAutoResize } from '../lib/hooks';
import type { Profile } from '../lib/forum';

interface Props {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    rows?: number;
    maxLength?: number;
    disabled?: boolean;
    onSubmitShortcut?: () => void;
}

/**
 * Textarea con autocomplete de menciones @usuario.
 * Cuando escribes "@", aparece dropdown con coincidencias.
 */
export default function MentionTextarea({
    value, onChange, placeholder, rows = 3, maxLength = 2000, disabled, onSubmitShortcut,
}: Props) {
    const taRef = useRef<HTMLTextAreaElement>(null);
    const [suggest, setSuggest] = useState<Profile[]>([]);
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const [activeIdx, setActiveIdx] = useState(0);
    useAutoResize(taRef, value, 360);

    // Detecta si está escribiendo una mención
    useEffect(() => {
        const ta = taRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const before = value.slice(0, pos);
        const m = before.match(/(?:^|\s)@([a-zA-Z0-9_]{1,30})$/);
        if (m) {
            setMentionStart(pos - m[1].length - 1);
            const q = m[1];
            const t = setTimeout(async () => {
                const list = await searchProfiles(q, 6);
                setSuggest(list);
                setActiveIdx(0);
            }, 150);
            return () => clearTimeout(t);
        } else {
            setSuggest([]);
            setMentionStart(null);
        }
    }, [value]);

    const insertMention = (p: Profile) => {
        const ta = taRef.current;
        if (!ta || mentionStart === null) return;
        const pos = ta.selectionStart;
        const next = value.slice(0, mentionStart) + `@${p.username} ` + value.slice(pos);
        onChange(next);
        setSuggest([]);
        setMentionStart(null);
        requestAnimationFrame(() => {
            const newPos = mentionStart + (p.username?.length || 0) + 2;
            ta.focus();
            ta.setSelectionRange(newPos, newPos);
        });
    };

    const expandSlashCommand = (cmd: string): string | null => {
        switch (cmd) {
            case '/cita':     return '> Cita aquí — sustituye este texto\n';
            case '/code':     return '```\ncódigo aquí\n```\n';
            case '/lista':    return '- item 1\n- item 2\n- item 3\n';
            case '/encuesta': return '[encuesta: editar opciones desde el ícono de encuesta]';
            case '/saludo':   return '¡Buenas, comunidad de Tres Valles! 👋\n\n';
            case '/info':     return 'ℹ️ ';
            case '/alerta':   return '⚠️ **Aviso:** ';
            default: return null;
        }
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (suggest.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(suggest.length - 1, i + 1)); return; }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1));                 return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(suggest[activeIdx]); return; }
            if (e.key === 'Escape') { setSuggest([]); return; }
        }
        // Slash commands: al pulsar espacio después de "/cmd" → expandir
        if (e.key === ' ') {
            const ta = taRef.current;
            if (ta) {
                const pos = ta.selectionStart;
                const before = value.slice(0, pos);
                const m = before.match(/(^|\n)(\/[a-z]+)$/i);
                if (m) {
                    const expanded = expandSlashCommand(m[2].toLowerCase());
                    if (expanded) {
                        e.preventDefault();
                        const next = before.slice(0, before.length - m[2].length) + expanded + value.slice(pos);
                        onChange(next);
                        requestAnimationFrame(() => {
                            const newPos = before.length - m[2].length + expanded.length;
                            ta.focus();
                            ta.setSelectionRange(newPos, newPos);
                        });
                        return;
                    }
                }
            }
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmitShortcut?.();
        }
    };

    return (
        <div class="mention-wrap">
            <textarea
                ref={taRef}
                placeholder={placeholder}
                value={value}
                onInput={(e: any) => onChange(e.currentTarget.value)}
                onKeyDown={onKeyDown}
                rows={rows}
                maxLength={maxLength}
                disabled={disabled}
            />
            {suggest.length > 0 && (
                <div class="mention-dropdown">
                    {suggest.map((p, i) => (
                        <button
                            key={p.id}
                            class={`mention-item ${i === activeIdx ? 'active' : ''}`}
                            onClick={() => insertMention(p)}
                        >
                            <span class="mention-avatar"><i class="fas fa-user"></i></span>
                            <span>@{p.username}</span>
                            {p.role === 'admin' && <small>Admin</small>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
