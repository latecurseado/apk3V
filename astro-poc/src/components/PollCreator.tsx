import { useState } from 'preact/hooks';

export interface PollDraft {
    question: string;
    options: string[];
    allowMultiple: boolean;
}

export default function PollCreator({ value, onChange, onRemove }: {
    value: PollDraft;
    onChange: (v: PollDraft) => void;
    onRemove: () => void;
}) {
    const setOption = (i: number, text: string) => {
        const next = [...value.options];
        next[i] = text;
        onChange({ ...value, options: next });
    };

    const addOption = () => {
        if (value.options.length >= 6) return;
        onChange({ ...value, options: [...value.options, ''] });
    };

    const removeOption = (i: number) => {
        if (value.options.length <= 2) return;
        onChange({ ...value, options: value.options.filter((_, j) => j !== i) });
    };

    return (
        <div class="poll-creator">
            <div class="poll-creator-head">
                <strong><i class="fas fa-square-poll-vertical"></i> Encuesta</strong>
                <button class="poll-creator-x" onClick={onRemove} title="Quitar encuesta">
                    <i class="fas fa-xmark"></i>
                </button>
            </div>
            <input
                type="text"
                placeholder="Tu pregunta…"
                value={value.question}
                onInput={(e: any) => onChange({ ...value, question: e.currentTarget.value })}
                maxLength={140}
            />
            {value.options.map((opt, i) => (
                <div class="poll-creator-opt" key={i}>
                    <input
                        type="text"
                        placeholder={`Opción ${i + 1}`}
                        value={opt}
                        onInput={(e: any) => setOption(i, e.currentTarget.value)}
                        maxLength={80}
                    />
                    {value.options.length > 2 && (
                        <button onClick={() => removeOption(i)} title="Quitar"><i class="fas fa-xmark"></i></button>
                    )}
                </div>
            ))}
            <div class="poll-creator-actions">
                {value.options.length < 6 && (
                    <button class="poll-creator-add" onClick={addOption}>
                        <i class="fas fa-plus"></i> Añadir opción
                    </button>
                )}
                <label class="poll-creator-multi">
                    <input
                        type="checkbox"
                        checked={value.allowMultiple}
                        onChange={(e: any) => onChange({ ...value, allowMultiple: e.currentTarget.checked })}
                    />
                    <span>Permitir múltiple</span>
                </label>
            </div>
        </div>
    );
}
