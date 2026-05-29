import { useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { signInAnonymously, signInWithEmail, signUpWithEmail, signInWithGoogle, type SignupExtras } from '../lib/auth';
import { toast } from '../lib/toast';
import { portal } from '../lib/portal';
import Turnstile from './Turnstile';

// Test key oficial de Cloudflare · siempre pasa. Reemplaza por tu site key real en producción
// desde Cloudflare Dashboard → Turnstile → Add site.
const TURNSTILE_SITE_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_TURNSTILE_SITE_KEY)
    || '1x00000000000000000000AA'; // <-- reemplazar en producción

type Tab = 'login' | 'signup' | 'guest';
type AccountType = 'personal' | 'business';
type Step = 1 | 2;

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

const BUSINESS_CATEGORIES = [
    { id: 'tienda',       label: 'Tienda / comercio' },
    { id: 'restaurante',  label: 'Restaurante / comida' },
    { id: 'servicios',    label: 'Servicios' },
    { id: 'profesional',  label: 'Profesional (dentista, abogado, etc.)' },
    { id: 'oficio',       label: 'Oficio (plomero, albañil, etc.)' },
    { id: 'turismo',      label: 'Turismo / hotelería' },
    { id: 'medios',       label: 'Medios / influencer' },
    { id: 'otro',         label: 'Otro' },
];

function calcAge(birthdate: string): number {
    if (!birthdate) return -1;
    const d = new Date(birthdate);
    if (isNaN(d.getTime())) return -1;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
}

export default function AuthModal({ onClose, initialTab = 'login' }: {
    onClose: () => void;
    initialTab?: Tab;
}) {
    const [tab, setTab] = useState<Tab>(initialTab);
    const [step, setStep] = useState<Step>(1);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [birthdate, setBirthdate] = useState('');
    const [country, setCountry] = useState('MX');
    const [accountType, setAccountType] = useState<AccountType>('personal');
    const [businessName, setBusinessName] = useState('');
    const [businessCategory, setBusinessCategory] = useState('tienda');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);

    const doLogin = async () => {
        setBusy(true); setErr(null);
        const { error } = await signInWithEmail(email.trim(), password);
        setBusy(false);
        if (error) { setErr(error.message); return; }
        toast.success('¡Bienvenido de vuelta!');
        onClose();
    };

    const validateStep1 = (): string | null => {
        if (username.trim().length < 2) return 'Username muy corto (mínimo 2)';
        if (username.length > 30) return 'Username muy largo (máximo 30)';
        if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Usa solo letras, números y _';
        if (!email.includes('@')) return 'Correo inválido';
        if (password.length < 6) return 'Contraseña: al menos 6 caracteres';
        if (!birthdate) return 'Falta tu fecha de nacimiento';
        const age = calcAge(birthdate);
        if (age < 13) return 'Debes tener al menos 13 años';
        if (age > 120) return 'Fecha de nacimiento inválida';
        return null;
    };

    const goStep2 = () => {
        const v = validateStep1();
        if (v) { setErr(v); return; }
        setErr(null);
        setStep(2);
    };

    const doSignup = async () => {
        if (accountType === 'business' && businessName.trim().length < 2) {
            setErr('Falta el nombre del negocio');
            return;
        }
        if (!captchaToken) {
            setErr('Verifica el captcha antes de continuar');
            return;
        }
        setBusy(true); setErr(null);
        const countryObj = COUNTRIES.find(c => c.code === country);
        const extras: SignupExtras = {
            username: username.trim(),
            birthdate,
            country,
            country_name: countryObj?.name || '',
            account_type: accountType,
        };
        if (accountType === 'business') {
            extras.business_name = businessName.trim();
            extras.business_category = businessCategory;
        }
        const { error } = await signUpWithEmail(email.trim(), password, extras);
        setBusy(false);
        if (error) { setErr(error.message); return; }
        toast.success(accountType === 'business'
            ? '¡Cuenta de negocio creada! Completa tu perfil para empezar.'
            : 'Cuenta creada. Revisa tu correo si está activada la verificación.');
        onClose();
    };

    const doAnon = async () => {
        setBusy(true); setErr(null);
        const { error } = await signInAnonymously();
        setBusy(false);
        if (error) {
            setErr(error.message + '\n\n¿Está habilitado "Anonymous Sign-Ins" en Supabase Dashboard → Auth → Providers?');
            return;
        }
        toast.success('Entraste como invitado');
        onClose();
    };

    const doGoogle = async () => {
        setBusy(true); setErr(null);
        const { error } = await signInWithGoogle();
        if (error) { setErr(error.message); setBusy(false); }
    };

    const doForgot = async () => {
        const target = email.trim();
        if (!target) { setErr('Escribe tu correo arriba primero'); return; }
        setBusy(true); setErr(null);
        const { error } = await supabase.auth.resetPasswordForEmail(target, {
            redirectTo: window.location.origin + '/perfil',
        });
        setBusy(false);
        if (error) { setErr(error.message); return; }
        toast.success('Te mandamos un correo para restablecer contraseña');
    };

    return portal(
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal small auth-modal" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3>
                        <i class="fas fa-right-to-bracket"></i>
                        {tab === 'login' && 'Iniciar sesión'}
                        {tab === 'signup' && (step === 1 ? 'Crear cuenta' : 'Tipo de cuenta')}
                        {tab === 'guest' && 'Entrar como invitado'}
                    </h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>

                <nav class="auth-tabs">
                    <button class={tab === 'login'  ? 'active' : ''} onClick={() => { setTab('login');  setErr(null); setStep(1); }}>Entrar</button>
                    <button class={tab === 'signup' ? 'active' : ''} onClick={() => { setTab('signup'); setErr(null); setStep(1); }}>Registrarse</button>
                    <button class={tab === 'guest'  ? 'active' : ''} onClick={() => { setTab('guest');  setErr(null); }}>Invitado</button>
                </nav>

                <div class="modal-body auth-body">
                    {tab === 'login' && (
                        <form class="form-grid" onSubmit={(e: any) => { e.preventDefault(); doLogin(); }}>
                            <label><span>Correo</span>
                                <input type="email" autoComplete="email" required
                                    value={email} onInput={(e: any) => setEmail(e.currentTarget.value)} />
                            </label>
                            <label><span>Contraseña</span>
                                <input type="password" autoComplete="current-password" required minLength={6}
                                    value={password} onInput={(e: any) => setPassword(e.currentTarget.value)} />
                            </label>
                            <button type="button" class="auth-forgot" onClick={doForgot} disabled={busy}>
                                ¿Olvidaste tu contraseña?
                            </button>
                            {err && <p class="cms-err"><i class="fas fa-triangle-exclamation"></i> {err}</p>}
                            <button type="submit" class="auth-btn primary" disabled={busy || !email || !password}>
                                <i class="fas fa-right-to-bracket"></i> {busy ? 'Entrando…' : 'Entrar'}
                            </button>
                        </form>
                    )}

                    {tab === 'signup' && step === 1 && (
                        <form class="form-grid" onSubmit={(e: any) => { e.preventDefault(); goStep2(); }}>
                            <div class="signup-progress">
                                <span class="active">1. Datos</span>
                                <span>2. Tipo de cuenta</span>
                            </div>
                            <label><span><i class="fas fa-at"></i> Username público</span>
                                <input type="text" autoComplete="username" required minLength={2} maxLength={30}
                                    placeholder="ej. juan_perez"
                                    value={username} onInput={(e: any) => setUsername(e.currentTarget.value)} />
                            </label>
                            <label><span><i class="fas fa-envelope"></i> Correo</span>
                                <input type="email" autoComplete="email" required
                                    value={email} onInput={(e: any) => setEmail(e.currentTarget.value)} />
                            </label>
                            <label><span><i class="fas fa-lock"></i> Contraseña</span>
                                <input type="password" autoComplete="new-password" required minLength={6}
                                    value={password} onInput={(e: any) => setPassword(e.currentTarget.value)} />
                                <small class="auth-hint">Mínimo 6 caracteres</small>
                            </label>
                            <label><span><i class="fas fa-cake-candles"></i> Fecha de nacimiento</span>
                                <input type="date" required
                                    value={birthdate}
                                    max={new Date().toISOString().slice(0, 10)}
                                    onInput={(e: any) => setBirthdate(e.currentTarget.value)} />
                                <small class="auth-hint">Debes tener al menos 13 años para registrarte</small>
                            </label>
                            <label><span><i class="fas fa-globe"></i> País</span>
                                <select value={country} onChange={(e: any) => setCountry(e.currentTarget.value)}>
                                    {COUNTRIES.map(c => <option value={c.code}>{c.name}</option>)}
                                </select>
                            </label>
                            {err && <p class="cms-err"><i class="fas fa-triangle-exclamation"></i> {err}</p>}
                            <button type="submit" class="auth-btn primary" disabled={busy}>
                                Siguiente <i class="fas fa-arrow-right"></i>
                            </button>
                        </form>
                    )}

                    {tab === 'signup' && step === 2 && (
                        <form class="form-grid" onSubmit={(e: any) => { e.preventDefault(); doSignup(); }}>
                            <div class="signup-progress">
                                <span>1. Datos</span>
                                <span class="active">2. Tipo de cuenta</span>
                            </div>
                            <p class="hub-section-lead" style="margin:0 0 6px;">¿Para qué usarás Tres Valles?</p>
                            <div class="account-type-grid">
                                <button type="button" class={`account-type-card ${accountType === 'personal' ? 'active' : ''}`}
                                    onClick={() => setAccountType('personal')}>
                                    <i class="fas fa-user"></i>
                                    <strong>Personal</strong>
                                    <small>Para conectar con tu gente, publicar, comentar.</small>
                                </button>
                                <button type="button" class={`account-type-card ${accountType === 'business' ? 'active' : ''}`}
                                    onClick={() => setAccountType('business')}>
                                    <i class="fas fa-briefcase"></i>
                                    <strong>Negocio</strong>
                                    <small>Promociona tu tienda, servicio, restaurante. Aparece en el mapa.</small>
                                </button>
                            </div>

                            {accountType === 'business' && (
                                <>
                                    <label><span><i class="fas fa-store"></i> Nombre del negocio</span>
                                        <input type="text" required minLength={2} maxLength={80}
                                            placeholder="ej. Carnicería Don Juan"
                                            value={businessName} onInput={(e: any) => setBusinessName(e.currentTarget.value)} />
                                    </label>
                                    <label><span><i class="fas fa-tag"></i> Categoría</span>
                                        <select value={businessCategory} onChange={(e: any) => setBusinessCategory(e.currentTarget.value)}>
                                            {BUSINESS_CATEGORIES.map(c => <option value={c.id}>{c.label}</option>)}
                                        </select>
                                    </label>
                                    <p class="auth-hint" style="margin:0;">
                                        <i class="fas fa-circle-info"></i>
                                        Las cuentas de negocio muestran un badge especial y pueden aparecer en el mapa de Explora.
                                    </p>
                                </>
                            )}

                            <div class="turnstile-wrap">
                                <Turnstile siteKey={TURNSTILE_SITE_KEY} onVerify={setCaptchaToken} theme="dark" />
                                {!captchaToken && <small class="auth-hint">Verifica que no eres un bot ↑</small>}
                            </div>

                            {err && <p class="cms-err"><i class="fas fa-triangle-exclamation"></i> {err}</p>}
                            <div style="display:flex; gap:8px;">
                                <button type="button" class="auth-btn ghost small" onClick={() => setStep(1)} disabled={busy} style="flex:1;">
                                    <i class="fas fa-arrow-left"></i> Atrás
                                </button>
                                <button type="submit" class="auth-btn primary" disabled={busy || !captchaToken} style="flex:2;">
                                    <i class="fas fa-user-plus"></i> {busy ? 'Creando…' : 'Crear cuenta'}
                                </button>
                            </div>
                        </form>
                    )}

                    {tab === 'guest' && (
                        <div class="form-grid">
                            <p class="hub-section-lead" style="margin:0 0 12px;">
                                Entra con 1 click sin crear cuenta. Tendrás un username temporal (<b>Invitado #abc123</b>) y podrás publicar, dar like, seguir y crear subforos.
                            </p>
                            <p class="hub-section-lead" style="margin:0 0 12px;font-size:0.82rem;">
                                <b>Nota:</b> si cierras sesión perderás el acceso. Para conservar tu actividad, mejor regístrate.
                            </p>
                            {err && <p class="cms-err"><i class="fas fa-triangle-exclamation"></i> {err}</p>}
                            <button class="auth-btn primary" onClick={doAnon} disabled={busy}>
                                <i class="fas fa-bolt"></i> {busy ? 'Entrando…' : 'Entrar como invitado'}
                            </button>
                        </div>
                    )}

                    <div class="auth-divider"><span>o</span></div>
                    <button class="auth-btn google" onClick={doGoogle} disabled={busy}>
                        <i class="fab fa-google"></i> Continuar con Google
                    </button>
                    <small class="auth-foot">
                        Al continuar aceptas las normas de la comunidad de Tres Valles.
                    </small>
                </div>
            </div>
        </div>
    );
}
