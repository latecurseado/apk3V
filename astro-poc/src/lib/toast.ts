/**
 * Toast system minimal — sin librería.
 * Uso desde cualquier sitio:
 *   import { toast } from '../lib/toast';
 *   toast.success('Guardado!');
 *   toast.error('Falló');
 *   toast.info('Mensaje');
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
    id: number;
    kind: ToastKind;
    message: string;
    expiresAt: number;
}

type Listener = (toasts: ToastItem[]) => void;

let nextId = 1;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
    listeners.forEach(fn => fn(toasts.slice()));
}

function add(kind: ToastKind, message: string, durationMs = 3500) {
    const id = nextId++;
    const expiresAt = Date.now() + durationMs;
    toasts = [...toasts, { id, kind, message, expiresAt }];
    emit();
    window.setTimeout(() => {
        toasts = toasts.filter(t => t.id !== id);
        emit();
    }, durationMs);
}

export const toast = {
    success: (msg: string, ms?: number) => add('success', msg, ms),
    error:   (msg: string, ms?: number) => add('error',   msg, ms ?? 5000),
    info:    (msg: string, ms?: number) => add('info',    msg, ms),
};

export function subscribeToasts(listener: Listener): () => void {
    listeners.add(listener);
    listener(toasts.slice());
    return () => { listeners.delete(listener); };
}
