import { supabase } from './supabase';

export type AttachmentType = 'image' | 'video' | 'file';

export interface Attachment {
    url: string;
    type: AttachmentType;
    name: string;
    size: number;
}

const MAX_BYTES_DEFAULT = 8 * 1024 * 1024;   // 8 MB · imágenes/docs
const MAX_BYTES_VIDEO   = 50 * 1024 * 1024;  // 50 MB · video/reels
const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]);
const ALLOWED_VIDEO_TYPES = new Set([
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska',
]);
const ALLOWED_DOC_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/markdown',
    'application/zip', 'application/x-zip-compressed',
]);

function classifyType(mime: string): AttachmentType {
    if (ALLOWED_IMAGE_TYPES.has(mime)) return 'image';
    if (ALLOWED_VIDEO_TYPES.has(mime) || mime.startsWith('video/')) return 'video';
    return 'file';
}

export async function uploadAttachment(file: File): Promise<{ ok: boolean; attachment?: Attachment; reason?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { ok: false, reason: 'Necesitas sesión' };
    const isVideo = file.type.startsWith('video/');
    const limit = isVideo ? MAX_BYTES_VIDEO : MAX_BYTES_DEFAULT;
    if (file.size > limit) {
        return { ok: false, reason: `Máximo ${Math.round(limit / 1024 / 1024)} MB` };
    }
    // Sólo bloqueamos tipos completamente desconocidos para evitar abuso del bucket público
    if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)
        && !file.type.startsWith('video/')
        && !ALLOWED_DOC_TYPES.has(file.type)
        && !file.type.startsWith('audio/')) {
        return { ok: false, reason: `Tipo no permitido: ${file.type}` };
    }
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('attachments').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
    });
    if (error) return { ok: false, reason: error.message };
    const { data } = supabase.storage.from('attachments').getPublicUrl(path);
    return {
        ok: true,
        attachment: {
            url: data.publicUrl,
            type: classifyType(file.type),
            name: file.name,
            size: file.size,
        },
    };
}

export async function updateThreadAttachments(threadId: string, attachments: Attachment[]): Promise<boolean> {
    const { error } = await supabase.from('threads').update({ attachments }).eq('id', threadId);
    if (error) console.error('[attach] update:', error);
    return !error;
}
