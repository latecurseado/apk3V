import { useState } from 'preact/hooks';
import { uploadAttachment, type Attachment } from '../lib/attachments';
import { toast } from '../lib/toast';

export default function AttachmentPicker({ value, onChange }: {
    value: Attachment[];
    onChange: (next: Attachment[]) => void;
}) {
    const [uploading, setUploading] = useState(false);

    const handleFiles = async (e: any) => {
        const files = Array.from(e.target.files || []) as File[];
        if (files.length === 0) return;
        if (value.length + files.length > 4) {
            toast.error('Máximo 4 archivos por hilo');
            return;
        }
        setUploading(true);
        const uploaded: Attachment[] = [];
        for (const file of files) {
            const res = await uploadAttachment(file);
            if (res.ok && res.attachment) uploaded.push(res.attachment);
            else toast.error(`${file.name}: ${res.reason || 'error'}`);
        }
        setUploading(false);
        if (uploaded.length > 0) {
            onChange([...value, ...uploaded]);
            toast.success(`${uploaded.length} archivo${uploaded.length > 1 ? 's' : ''} adjuntado${uploaded.length > 1 ? 's' : ''}`);
        }
        e.target.value = '';
    };

    const removeAt = (i: number) => {
        onChange(value.filter((_, idx) => idx !== i));
    };

    return (
        <div class="attach-picker">
            {value.length > 0 && (
                <div class="attach-preview-row">
                    {value.map((a, i) => (
                        <div class="attach-preview" key={a.url}>
                            {a.type === 'image' ? (
                                <img src={a.url} alt={a.name} />
                            ) : (
                                <div class="attach-file">
                                    <i class="fas fa-paperclip"></i>
                                    <small>{a.name}</small>
                                </div>
                            )}
                            <button class="attach-x" onClick={() => removeAt(i)} title="Quitar">
                                <i class="fas fa-xmark"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <label class="attach-btn" title="Adjuntar archivos">
                <i class={`fas ${uploading ? 'fa-circle-notch fa-spin' : 'fa-paperclip'}`}></i>
                <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFiles}
                    disabled={uploading || value.length >= 4}
                    style="display: none;"
                />
            </label>
        </div>
    );
}
