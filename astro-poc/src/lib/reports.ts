import { supabase } from './supabase';

export type ReportTarget = 'thread' | 'comment' | 'profile' | 'dm' | 'reel' | 'marketplace' | 'story';
export type ReportReason = 'spam' | 'acoso' | 'contenido_sexual' | 'violencia' | 'desinformacion' | 'suplantacion' | 'otros';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

export interface Report {
    id: string;
    reporter_id: string;
    target_type: ReportTarget;
    target_id: string | null;
    reason: ReportReason;
    details: string;
    status: ReportStatus;
    resolved_by: string | null;
    resolution_note: string;
    created_at: string;
    resolved_at: string | null;
    reporter?: { username: string };
}

export const REASON_LABELS: Record<ReportReason, string> = {
    spam: 'Spam o publicidad',
    acoso: 'Acoso o bullying',
    contenido_sexual: 'Contenido sexual o inapropiado',
    violencia: 'Violencia o amenazas',
    desinformacion: 'Información falsa',
    suplantacion: 'Suplantación de identidad',
    otros: 'Otros',
};

export async function createReport(input: {
    target_type: ReportTarget;
    target_id?: string;
    reason: ReportReason;
    details?: string;
}): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_type: input.target_type,
        target_id: input.target_id || null,
        reason: input.reason,
        details: input.details || '',
    });
    if (error) console.error('[reports] create:', error);
    return !error;
}

export async function fetchReports(status: ReportStatus | 'all' = 'pending', limit = 50): Promise<Report[]> {
    let q = supabase
        .from('reports')
        .select('*, reporter:profiles!reports_reporter_id_fkey(username)')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) { console.error('[reports] fetch:', error); return []; }
    return (data || []) as Report[];
}

export async function updateReport(id: string, patch: { status: ReportStatus; resolution_note?: string }): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    const updates: any = { status: patch.status };
    if (patch.resolution_note) updates.resolution_note = patch.resolution_note;
    if (patch.status === 'resolved' || patch.status === 'dismissed') {
        updates.resolved_at = new Date().toISOString();
        if (user) updates.resolved_by = user.id;
    }
    const { error } = await supabase.from('reports').update(updates).eq('id', id);
    return !error;
}
