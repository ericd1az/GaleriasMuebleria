import { useCallback, useState } from 'react';
import { User, Key, Mail, ShieldAlert, LogOut, Heart, Sofa, UserPlus, CheckCircle2 } from 'lucide-react';
import TurnstileCaptcha from '../components/TurnstileCaptcha';
import { getProductPriceLabel } from '../lib/catalogApi';
import { isSupabaseConfigured } from '../lib/supabaseClient';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
const SECURE_LOGIN_ENABLED = import.meta.env.VITE_SECURE_LOGIN_ENABLED === 'true';
const LOGIN_CAPTCHA_ENABLED = Boolean(TURNSTILE_SITE_KEY && SECURE_LOGIN_ENABLED);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BLOCKED_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
]);

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function validatePasswordStrength(password, email) {
  if (password.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (!/[a-z]/.test(password)) return 'La contraseña debe incluir una letra minúscula.';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir una letra mayúscula.';
  if (!/\d/.test(password)) return 'La contraseña debe incluir un número.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'La contraseña debe incluir un símbolo.';

  const localPart = email.split('@')[0];
  if (localPart && password.toLowerCase().includes(localPart.toLowerCase())) {
    return 'La contraseña no debe contener tu correo.';
  }

  return '';
}

function validateRegistration({ fullName, email, password, confirmPassword, acceptTerms, captchaToken }) {
  if (!isSupabaseConfigured) return 'El registro real requiere Supabase configurado.';
  if (fullName.trim().length < 3) return 'Escribe tu nombre completo.';
  if (!EMAIL_PATTERN.test(email)) return 'Escribe un correo válido.';

  const domain = email.split('@')[1];
  if (BLOCKED_EMAIL_DOMAINS.has(domain)) {
    return 'Usa un correo personal o empresarial, no un correo temporal.';
  }

  const passwordError = validatePasswordStrength(password, email);
  if (passwordError) return passwordError;
  if (password !== confirmPassword) return 'Las contraseñas no coinciden.';
  if (!acceptTerms) return 'Acepta el uso de tus datos para crear la cuenta.';
  if (TURNSTILE_SITE_KEY && !captchaToken) return 'Completa la verificación de seguridad.';

  return '';
}

async function validarCredenciales(email, password, loginFn, captchaToken) {
  const exitoReal = await loginFn(email, password, captchaToken);
  if (exitoReal) return { email };
  throw new Error('Credenciales inválidas.');
}

export default function Account({
  currentUser,
  authNotice,
  login,
  register,
  logout,
  favorites = [],
  toggleFavorite,
  products = [],
  setView,
  setSelectedProduct,
}) {
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [loginCaptchaToken, setLoginCaptchaToken] = useState('');
  const [loginCaptchaResetKey, setLoginCaptchaResetKey] = useState(0);
  const [loginCaptchaRequired, setLoginCaptchaRequired] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loginCargando, setLoginCargando] = useState(false);
  const [registroCargando, setRegistroCargando] = useState(false);
  const visibleSuccessMessage = successMessage || authNotice;

  const handleCaptchaVerify = useCallback((token) => {
    setCaptchaToken(token);
  }, []);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken('');
    setCaptchaResetKey((value) => value + 1);
  }, []);

  const resetLoginCaptcha = useCallback(() => {
    setLoginCaptchaToken('');
    setLoginCaptchaResetKey((value) => value + 1);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (LOGIN_CAPTCHA_ENABLED && loginCaptchaRequired && !loginCaptchaToken) {
      setError('Completa la verificación de seguridad.');
      return;
    }

    setLoginCargando(true);
    try {
      await validarCredenciales(normalizeEmail(email), password, login, loginCaptchaToken);
      setLoginCaptchaRequired(false);
      resetLoginCaptcha();
    } catch (err) {
      if (err.code === 'CAPTCHA_REQUIRED' && LOGIN_CAPTCHA_ENABLED) {
        setLoginCaptchaRequired(true);
        resetLoginCaptcha();
      }

      setError(err.code === 'CAPTCHA_REQUIRED' && SECURE_LOGIN_ENABLED && !TURNSTILE_SITE_KEY
        ? 'Falta configurar VITE_TURNSTILE_SITE_KEY para completar el login seguro.'
        : err.message);
    } finally {
      setLoginCargando(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const cleanEmail = normalizeEmail(registerEmail);
    const validationError = validateRegistration({
      fullName: registerName,
      email: cleanEmail,
      password: registerPassword,
      confirmPassword,
      acceptTerms,
      captchaToken,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    setRegistroCargando(true);
    try {
      await register({
        fullName: registerName.trim(),
        email: cleanEmail,
        password: registerPassword,
        captchaToken,
      });
      setSuccessMessage('Revisa tu correo. Si la cuenta es nueva o faltaba confirmarla, recibirás un enlace para activarla. Si ya tienes cuenta, inicia sesión con tu contraseña actual.');
      setEmail(cleanEmail);
      setAuthMode('login');
      setRegisterName('');
      setRegisterEmail('');
      setRegisterPassword('');
      setConfirmPassword('');
      setAcceptTerms(false);
      resetCaptcha();
    } catch (err) {
      setError(err.message);
      resetCaptcha();
    } finally {
      setRegistroCargando(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto px-6 pb-20 pt-6">
      {visibleSuccessMessage && (
        <div className="max-w-3xl mx-auto mb-8 bg-[#F2F2F2] border border-[#E8E8E8] p-4 flex gap-3 text-[#0A0A0A] text-sm items-start text-left">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{visibleSuccessMessage}</span>
        </div>
      )}

      {!currentUser ? (
        <div className="max-w-md mx-auto space-y-8">
          <div className="text-center space-y-3">
            <h1 className="font-display text-5xl sm:text-6xl font-light text-[#0A0A0A]">Acceso</h1>
            <p className="text-[#888888] text-sm font-light">Ingresa o crea una cuenta verificada para guardar tus consultas.</p>
          </div>

          <div className="grid grid-cols-2 border border-[#E8E8E8]">
            {[
              { id: 'login', label: 'Acceder', icon: <User className="w-4 h-4" /> },
              { id: 'register', label: 'Crear cuenta', icon: <UserPlus className="w-4 h-4" /> },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAuthMode(item.id);
                  setError('');
                  setSuccessMessage('');
                }}
                className={`h-12 inline-flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-widest focus:outline-none border-r last:border-r-0 border-[#E8E8E8] ${
                  authMode === item.id ? 'bg-[#0A0A0A] text-white' : 'bg-white text-[#888888] hover:text-[#0A0A0A]'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-[#F2F2F2] border border-[#E8E8E8] p-4 flex gap-3 text-[#0A0A0A] text-sm items-start text-left">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="border border-[#E8E8E8] p-8 text-left">
            {authMode === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-7">
              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-medium text-[#888888] uppercase tracking-widest flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </label>
                <input type="email" required placeholder="ejemplo@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-medium text-[#888888] uppercase tracking-widest flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  Contraseña
                </label>
                <input type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              {LOGIN_CAPTCHA_ENABLED && loginCaptchaRequired && (
                <TurnstileCaptcha
                  siteKey={TURNSTILE_SITE_KEY}
                  resetKey={loginCaptchaResetKey}
                  onVerify={setLoginCaptchaToken}
                  onExpire={resetLoginCaptcha}
                  onError={resetLoginCaptcha}
                />
              )}

              <button
                type="submit"
                disabled={loginCargando}
                className="btn-primary w-full py-3.5 font-medium text-xs uppercase tracking-widest transition-all duration-300 active:scale-[0.98] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loginCargando ? 'Verificando...' : 'Acceder a mi Cuenta'}
              </button>
            </form>
            ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-6">
              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-medium text-[#888888] uppercase tracking-widest flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Nombre completo
                </label>
                <input type="text" required placeholder="Tu nombre" value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-medium text-[#888888] uppercase tracking-widest flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </label>
                <input type="email" required placeholder="ejemplo@correo.com" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-medium text-[#888888] uppercase tracking-widest flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Contraseña
                  </label>
                  <input type="password" required placeholder="••••••••••" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-medium text-[#888888] uppercase tracking-widest flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Confirmar
                  </label>
                  <input type="password" required placeholder="••••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>

              <p className="text-[11px] leading-6 text-[#888888] font-light">
                Usa al menos 10 caracteres con mayúscula, minúscula, número y símbolo.
              </p>

              <label className="flex items-start gap-3 text-xs text-[#3D3D3D] font-light leading-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 w-4 h-4"
                />
                <span>Acepto que Galerias use mis datos para crear y proteger mi cuenta.</span>
              </label>

              {TURNSTILE_SITE_KEY && (
                <TurnstileCaptcha
                  siteKey={TURNSTILE_SITE_KEY}
                  resetKey={captchaResetKey}
                  onVerify={handleCaptchaVerify}
                  onExpire={resetCaptcha}
                  onError={resetCaptcha}
                />
              )}

              <button
                type="submit"
                disabled={registroCargando}
                className="btn-primary w-full py-3.5 font-medium text-xs uppercase tracking-widest transition-all duration-300 active:scale-[0.98] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {registroCargando ? 'Enviando enlace...' : 'Crear cuenta y enviar enlace'}
              </button>
            </form>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-10 text-left">
          <div className="border border-[#E8E8E8] p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 border border-[#C8C8C8] flex items-center justify-center text-[#0A0A0A] font-display text-3xl">
                {currentUser.email[0].toUpperCase()}
              </div>
              <div className="space-y-1">
                <h1 className="font-display text-4xl font-light text-[#0A0A0A]">
                  {currentUser.role === 'admin' ? 'Administrador Galerias' : 'Cliente Galerias'}
                </h1>
                <p className="text-[#888888] text-sm flex flex-wrap items-center gap-2">
                  <span className="font-light text-[#3D3D3D]">{currentUser.email}</span>
                  <span>·</span>
                  <span className="px-2.5 py-0.5 border border-[#E8E8E8] text-xs font-light text-[#0A0A0A]">
                    {currentUser.role === 'admin' ? 'Administrador' : 'Usuario'}
                  </span>
                </p>
              </div>
            </div>

            <button onClick={logout} className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#C8C8C8] text-[#0A0A0A] font-medium text-xs hover:bg-[#F2F2F2] transition-colors focus:outline-none uppercase tracking-widest">
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>

          {currentUser.role !== 'admin' && (
            <div className="w-full max-w-3xl mx-auto space-y-5">
              <h2 className="font-display text-4xl font-light text-[#0A0A0A]">Favoritos</h2>

              {products.filter(p => favorites.includes(p.id)).length > 0 ? (
                <div className="space-y-0 border-y border-[#E8E8E8] divide-y divide-[#E8E8E8]">
                  {products.filter(p => favorites.includes(p.id)).map((prod) => (
                    <div key={prod.id} className="py-5 flex gap-4 items-center">
                      <div className="w-16 h-16 overflow-hidden bg-[#F2F2F2] flex-shrink-0 flex items-center justify-center">
                        {prod.image ? (
                          <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                        ) : (
                          <Sofa className="w-8 h-8 text-[#C8C8C8] stroke-[1.5]" />
                        )}
                      </div>
                      <div className="flex-grow min-w-0 text-left">
                        <h3 className="font-display text-2xl font-light text-[#0A0A0A] truncate">{prod.name}</h3>
                        <p className="text-[#888888] text-[10px] font-light uppercase tracking-widest">{prod.category}</p>
                        <p className="text-[#0A0A0A] font-medium text-sm mt-1">{getProductPriceLabel(prod)}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => { setSelectedProduct(prod); setView('product-detail'); }} className="px-3 py-1.5 border border-[#C8C8C8] text-[10px] font-medium uppercase tracking-widest transition-colors hover:bg-[#F2F2F2]">
                          Ver
                        </button>
                        <button onClick={() => toggleFavorite(prod.id)} className="p-1.5 text-[#0A0A0A] hover:bg-[#F2F2F2] transition-colors flex items-center justify-center" title="Eliminar de favoritos">
                          <Heart className="w-4 h-4 fill-[#0A0A0A] text-[#0A0A0A]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-[#E8E8E8] p-12 text-center space-y-4">
                  <div className="w-12 h-12 border border-[#C8C8C8] flex items-center justify-center mx-auto text-[#888888]">
                    <Heart className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-3xl font-light text-[#0A0A0A]">Sin favoritos</h3>
                  <p className="text-[#888888] text-xs leading-relaxed max-w-xs mx-auto">
                    Aún no has marcado ningún mueble como favorito. Explora el catálogo y pulsa el corazón.
                  </p>
                </div>
              )}
            </div>
          )}

          {currentUser.role === 'admin' && (
            <div className="bg-[#F2F2F2] border border-[#E8E8E8] p-6 text-left space-y-3">
              <h2 className="font-display text-3xl font-light text-[#0A0A0A]">Acciones de Administrador</h2>
              <p className="text-[#3D3D3D] text-xs leading-6">
                Tienes acceso a métricas, consultas y administración del catálogo de productos.
              </p>
              <div className="pt-2">
                <button onClick={() => { window.location.href = '/eric_diaz/admin/'; }} className="btn-primary inline-flex items-center justify-center px-4 py-2.5 font-medium text-xs transition-colors focus:outline-none uppercase tracking-widest">
                  Ir al Dashboard
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
