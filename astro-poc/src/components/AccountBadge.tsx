interface Props {
    accountType?: string | null;
    businessCategory?: string | null;
    role?: string | null;
    verified?: boolean | null;
    size?: 'sm' | 'md';
}

const CATEGORY_LABEL: Record<string, string> = {
    tienda: 'Tienda',
    restaurante: 'Restaurante',
    servicios: 'Servicios',
    profesional: 'Profesional',
    oficio: 'Oficio',
    turismo: 'Turismo',
    medios: 'Medios',
    otro: 'Negocio',
};

/**
 * Badge pequeño junto al @ del nombre · marca cuentas business, admin, bot.
 */
export default function AccountBadge({ accountType, businessCategory, role, verified, size = 'sm' }: Props) {
    const verifiedTick = verified ? (
        <span class={`acc-badge verified ${size}`} title="Cuenta verificada">
            <i class="fas fa-circle-check"></i>
        </span>
    ) : null;

    if (role === 'admin') {
        return <>{verifiedTick}<span class={`acc-badge admin ${size}`} title="Administrador"><i class="fas fa-shield-halved"></i> admin</span></>;
    }
    if (role === 'bot') {
        return <span class={`acc-badge bot ${size}`} title="Bot del sistema"><i class="fas fa-robot"></i> bot</span>;
    }
    if (accountType === 'business') {
        const label = CATEGORY_LABEL[businessCategory || 'otro'] || 'Negocio';
        return (
            <>
                {verifiedTick}
                <span class={`acc-badge business ${size}`} title={`Cuenta de negocio · ${label}`}>
                    <i class="fas fa-briefcase"></i> {label}
                </span>
            </>
        );
    }
    return verifiedTick;
}
