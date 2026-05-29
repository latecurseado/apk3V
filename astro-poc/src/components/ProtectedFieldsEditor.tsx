import { useEffect, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

/** Renderiza el modal en <body> para que `position: fixed` no quede atrapado
 *  por la topbar (que tiene backdrop-filter → crea un containing block). */
const portal = (node: any) =>
    (typeof document !== 'undefined' ? createPortal(node, document.body) : node);

interface FieldState {
    value: any;
    changed_at: string | null;
    next_change_at: string | null;
    locked: boolean;
    cooldown_days: number;
}

interface Status {
    birthdate: FieldState;
    country: FieldState;
    account_type: FieldState;
}

const COUNTRIES = [
    { code: 'MX', name: 'México' },
    { code: 'US', name: 'Estados Unidos' },
    { code: 'ES', name: 'España' },
    { code: 'AR', name: 'Argentina' },
    { code: 'CO', name: 'Colombia' },
    { code: 'CL', name: 'Chile' },
    { code: 'PE', name: 'Perú' },
    { code: 'VE', name: 'Venezuela' },
    { code: 'EC', name: 'Ecuador' },
    { code: 'GT', name: 'Guatemala' },
    { code: 'CU', name: 'Cuba' },
    { code: 'DO', name: 'República Dominicana' },
    { code: 'BO', name: 'Bolivia' },
    { code: 'HN', name: 'Honduras' },
    { code: 'PY', name: 'Paraguay' },
    { code: 'SV', name: 'El Salvador' },
    { code: 'NI', name: 'Nicaragua' },
    { code: 'CR', name: 'Costa Rica' },
    { code: 'PA', name: 'Panamá' },
    { code: 'UY', name: 'Uruguay' },
    { code: 'BR', name: 'Brasil' },
    { code: 'OTHER', name: 'Otro' },
];

interface Props {
    onClose: () => void;
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return iso; }
}

function calcAge(birthdate: string): number {
    const d = new Date(birthdate);
    if (isNaN(d.getTime())) return -1;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
}

export default function ProtectedFieldsEditor({ onClose }: Props) {
    const [status, setStatus] = useState<Status | null>(null);
    const [loading, setLoading] = useState(true);

    // Drafts locales
    const [birthdate, setBirthdate] = useState('');
    const [country, setCountry] = useState('MX');
    const [accountType, setAccountType] = useState<'personal' | 'business'>('personal');

    // Estado per-campo
    const [savingField, setSavingField] = useState<string | null>(null);
    const [confirmUnlock, setConfirmUnlock] = useState<string | null>(null);

    const load = async () => {
        const { data, error } = await supabase.rpc('my_protected_fields_status');
        if (error) { console.error(error); return; }
        const s = data as Status;
        setStatus(s);
        if (s.birthdate.value) setBirthdate(typeof s.birthdate.value === 'string' ? s.birthdate.value.slice(0, 10) : '');
        if (s.country.value) setCountry(s.country.value);
        if (s.account_type.value) setAccountType(s.account_type.value);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const saveField = async (field: 'birthdate' | 'country' | 'account_type', value: string) => {
        setSavingField(field);
        const { data, error } = await supabase.rpc('update_protected_field', {
            p_field: field,
            p_value: value,
        });
        setSavingField(null);
        if (error) {
            toast.error('Error: ' + error.message);
            return;
        }
        const res = data as any;
        if (!res.ok) {
            if (res.error === 'cooldown') {
                toast.error(`Bloqueado hasta el ${formatDate(res.next_change_at)}`);
            } else if (res.error === 'invalid_value') {
                toast.error('Valor inválido');
            } else {
                toast.error('No se pudo: ' + res.error);
            }
            return;
        }
        toast.success('Guardado · próximo cambio: ' + formatDate(res.next_change_at));
        setConfirmUnlock(null);
        load();
    };

    const handleSave = (field: 'birthdate' | 'country' | 'account_type') => {
        const isFirstTime = status && !status[field].changed_at;
        if (!isFirstTime && confirmUnlock !== field) {
            setConfirmUnlock(field);
            return;
        }

        if (field === 'birthdate') {
            if (!birthdate) { toast.error('Falta fecha'); return; }
            const age = calcAge(birthdate);
            if (age < 13) { toast.error('Debes tener al menos 13 años'); return; }
            saveField('birthdate', birthdate);
        } else if (field === 'country') {
            saveField('country', country);
        } else if (field === 'account_type') {
            saveField('account_type', accountType);
        }
    };

    if (loading || !status) {
        return portal(
            <div class="modal-overlay" onClick={onClose}>
                <div class="modal small" onClick={(e: any) => e.stopPropagation()}>
                    <header class="modal-head">
                        <h3><i class="fas fa-shield-halved"></i> Datos protegidos</h3>
                        <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                    </header>
                    <div class="modal-body" style="text-align:center; padding:30px;">
                        <i class="fas fa-circle-notch fa-spin"></i> Cargando…
                    </div>
                </div>
            </div>
        );
    }

    const renderField = (
        field: 'birthdate' | 'country' | 'account_type',
        icon: string,
        label: string,
        explainer: string,
        children: any,
    ) => {
        const s = status[field];
        const isFirst = !s.changed_at;
        const isLocked = s.locked;
        const isConfirming = confirmUnlock === field;

        return (
            <div class={`pf-field ${isLocked ? 'locked' : ''}`}>
                <div class="pf-field-head">
                    <span class="pf-field-label">
                        <i class={`fas ${icon}`}></i>
                        {label}
                        {isLocked && <i class="fas fa-lock pf-lock-icon" title="Bloqueado por cooldown"></i>}
                    </span>
                </div>
                <p class="pf-field-explainer">{explainer}</p>
                {children}
                <div class="pf-field-meta">
                    {isFirst ? (
                        <small class="pf-meta-new">
                            <i class="fas fa-circle-info"></i>
                            Primera vez · puedes guardarlo libremente
                        </small>
                    ) : isLocked ? (
                        <small class="pf-meta-locked">
                            <i class="fas fa-lock"></i>
                            Cambiable a partir del <b>{formatDate(s.next_change_at!)}</b>
                            <span class="pf-cooldown-pill">{s.cooldown_days} días de cooldown</span>
                        </small>
                    ) : (
                        <small class="pf-meta-ok">
                            <i class="fas fa-circle-check"></i>
                            Disponible para cambiar · al guardar se bloqueará {s.cooldown_days} días
                        </small>
                    )}
                </div>
                {!isLocked && (
                    <div class="pf-field-actions">
                        {isConfirming && (
                            <div class="pf-confirm-warn">
                                <i class="fas fa-triangle-exclamation"></i>
                                <span>
                                    Estás cambiando un dato sensible. Una vez guardado quedará bloqueado por <b>{s.cooldown_days} días</b>. ¿Continuar?
                                </span>
                            </div>
                        )}
                        <button
                            class={`auth-btn ${isConfirming ? 'primary' : 'ghost'} small`}
                            onClick={() => handleSave(field)}
                            disabled={savingField === field}
                        >
                            {savingField === field
                                ? <><i class="fas fa-circle-notch fa-spin"></i> Guardando…</>
                                : isConfirming
                                    ? <><i class="fas fa-check"></i> Confirmar cambio</>
                                    : isFirst
                                        ? <><i class="fas fa-floppy-disk"></i> Guardar</>
                                        : <><i class="fas fa-pen"></i> Cambiar</>}
                        </button>
                        {isConfirming && (
                            <button class="auth-btn ghost small" onClick={() => setConfirmUnlock(null)}>
                                Cancelar
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return portal(
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal protected-fields" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-shield-halved"></i> Datos protegidos</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    <p class="hub-section-lead" style="margin: 0 0 14px;">
                        Estos datos sensibles se bloquean tras cambiarlos · sólo se pueden modificar tras el cooldown.
                    </p>

                    {renderField(
                        'birthdate',
                        'fa-cake-candles',
                        'Fecha de nacimiento',
                        'Define tu edad pública y verifica que tengas 13+. Cambiable cada 365 días.',
                        <input
                            type="date"
                            value={birthdate}
                            max={new Date().toISOString().slice(0, 10)}
                            disabled={status.birthdate.locked}
                            onInput={(e: any) => setBirthdate(e.currentTarget.value)}
                        />,
                    )}

                    {renderField(
                        'country',
                        'fa-globe',
                        'País',
                        'País de residencia. Cambiable cada 180 días.',
                        <select
                            value={country}
                            disabled={status.country.locked}
                            onChange={(e: any) => setCountry(e.currentTarget.value)}
                        >
                            {COUNTRIES.map(c => <option value={c.code}>{c.name}</option>)}
                        </select>,
                    )}

                    {renderField(
                        'account_type',
                        'fa-id-badge',
                        'Tipo de cuenta',
                        'Personal o negocio. Las cuentas de negocio aparecen en el mapa y muestran badge. Cambiable cada 30 días.',
                        <div class="pf-radio-group">
                            <label class={`pf-radio ${accountType === 'personal' ? 'active' : ''} ${status.account_type.locked ? 'disabled' : ''}`}>
                                <input
                                    type="radio"
                                    name="acctype"
                                    value="personal"
                                    checked={accountType === 'personal'}
                                    disabled={status.account_type.locked}
                                    onChange={() => setAccountType('personal')}
                                />
                                <i class="fas fa-user"></i>
                                <span>Personal</span>
                            </label>
                            <label class={`pf-radio ${accountType === 'business' ? 'active' : ''} ${status.account_type.locked ? 'disabled' : ''}`}>
                                <input
                                    type="radio"
                                    name="acctype"
                                    value="business"
                                    checked={accountType === 'business'}
                                    disabled={status.account_type.locked}
                                    onChange={() => setAccountType('business')}
                                />
                                <i class="fas fa-briefcase"></i>
                                <span>Negocio</span>
                            </label>
                        </div>,
                    )}

                    <small class="auth-hint pf-warn">
                        <i class="fas fa-circle-info"></i>
                        Si necesitas cambiar algo antes del cooldown (por error tipográfico, etc.), contacta a un administrador.
                    </small>
                </div>
            </div>
        </div>
    );
}
