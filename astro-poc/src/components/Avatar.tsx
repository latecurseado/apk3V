import DefaultAvatar from './DefaultAvatar';

interface Props {
    user: { id: string; username?: string | null; pfp?: string | null } | null;
    size?: number;
    className?: string;
}

/**
 * Componente smart de avatar. Si el user tiene `pfp` (foto real), la usa.
 * Si no, genera un avatar procedural cute con DiceBear (seed=user.id).
 */
export default function Avatar({ user, size = 38, className }: Props) {
    if (!user) {
        // Sin user → icono genérico
        return (
            <span class={`avatar-fallback ${className || ''}`} style={`width:${size}px;height:${size}px;`}>
                <i class="fas fa-user-secret"></i>
            </span>
        );
    }
    if (user.pfp && user.pfp.length > 0) {
        return (
            <img
                class={`avatar-pfp ${className || ''}`}
                src={user.pfp}
                alt={user.username || 'Avatar'}
                width={size} height={size}
                loading="lazy" decoding="async"
            />
        );
    }
    const seed = user.id || user.username || 'guest';
    return <DefaultAvatar seed={seed} size={size} className={className} />;
}
