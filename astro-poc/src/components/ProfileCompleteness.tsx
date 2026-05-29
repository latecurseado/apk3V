import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';

const TIPS = [
    { field: 'pfp',       label: 'Sube foto de perfil',     icon: 'fa-image',          weight: 15 },
    { field: 'banner',    label: 'Añade banner',            icon: 'fa-panorama',       weight: 10 },
    { field: 'bio',       label: 'Escribe una bio (>20 chars)', icon: 'fa-feather-pointed', weight: 15 },
    { field: 'location',  label: 'Tu ubicación',            icon: 'fa-location-dot',   weight: 10 },
    { field: 'birthdate', label: 'Fecha de nacimiento',     icon: 'fa-cake-candles',   weight: 10 },
    { field: 'work',      label: 'En qué trabajas',         icon: 'fa-briefcase',      weight: 10 },
    { field: 'website',   label: 'Tu sitio web o link',     icon: 'fa-link',           weight: 5 },
];

export default function ProfileCompleteness({ onEdit }: { onEdit?: () => void }) {
    const { user, ready } = useSession();
    const [pct, setPct] = useState<number | null>(null);
    const [missing, setMissing] = useState<typeof TIPS>([]);

    useEffect(() => {
        if (!ready || !user) return;
        let alive = true;
        (async () => {
            const [{ data: completeness }, { data: profile }] = await Promise.all([
                supabase.rpc('profile_completeness', { p_user_id: user.id }),
                supabase.from('profiles')
                    .select('pfp, banner, bio, location, birthdate, work, website, social_links')
                    .eq('id', user.id)
                    .single(),
            ]);
            if (!alive) return;
            setPct(typeof completeness === 'number' ? completeness : 0);
            if (profile) {
                const missingFields = TIPS.filter(t => {
                    const v = (profile as any)[t.field];
                    if (t.field === 'bio') return !v || (v as string).length < 20;
                    return !v || (typeof v === 'string' && !v.trim());
                });
                setMissing(missingFields);
            }
        })();
        return () => { alive = false; };
    }, [user?.id, ready]);

    if (!user || pct === null || pct >= 100) return null;

    const color = pct < 30 ? '#ef4444' : pct < 60 ? '#f59e0b' : pct < 90 ? '#00d2ff' : '#10b981';

    return (
        <section class="completeness-widget">
            <header class="completeness-head">
                <h3><i class="fas fa-chart-pie"></i> Perfil al {pct}%</h3>
                {onEdit && (
                    <button class="auth-btn ghost small" onClick={onEdit}>
                        <i class="fas fa-pen"></i> Completar
                    </button>
                )}
            </header>
            <div class="completeness-bar">
                <div class="completeness-fill" style={`width: ${pct}%; background: ${color};`}></div>
            </div>
            {missing.length > 0 && (
                <ul class="completeness-tips">
                    {missing.slice(0, 4).map(t => (
                        <li key={t.field}>
                            <i class={`fas ${t.icon}`}></i>
                            <span>{t.label}</span>
                            <small>+{t.weight}%</small>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
