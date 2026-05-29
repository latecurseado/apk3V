import { useEffect, useState } from 'preact/hooks';
import { subscribeToasts, type ToastItem } from '../lib/toast';

const ICON: Record<ToastItem['kind'], string> = {
    success: 'fa-circle-check',
    error:   'fa-circle-xmark',
    info:    'fa-circle-info',
};

export default function Toaster() {
    const [items, setItems] = useState<ToastItem[]>([]);
    useEffect(() => subscribeToasts(setItems), []);
    return (
        <div class="toaster" role="status" aria-live="polite">
            {items.map(t => (
                <div class={`toast toast-${t.kind}`} key={t.id}>
                    <i class={`fas ${ICON[t.kind]}`}></i>
                    <span>{t.message}</span>
                </div>
            ))}
        </div>
    );
}
