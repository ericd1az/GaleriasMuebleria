import { useCallback, useEffect, useState } from 'react';
import AdminDashboard from './pages/AdminDashboard';
import { Sparkles, ArrowLeft, Loader2, Mail, Key, ShieldAlert, LogIn } from 'lucide-react';
import './index.css';
import { getCurrentAuthUser, signInWithSupabase, signOutFromSupabase } from './lib/authApi';
import { fetchAdminProducts, fetchProductInquiries } from './lib/adminApi';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { clearAdminAccessVerified, markAdminAccessVerified } from './lib/adminAccess';
import TurnstileCaptcha from './components/TurnstileCaptcha';
import { companyInfo } from './data/companyInfo';
import logoEmpresa from './assets/branding/logoempresa.png';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
const SECURE_LOGIN_ENABLED = import.meta.env.VITE_SECURE_LOGIN_ENABLED === 'true';
const ADMIN_CAPTCHA_ENABLED = Boolean(TURNSTILE_SITE_KEY && SECURE_LOGIN_ENABLED);

function AdminLogin({
  email,
  password,
  captchaToken,
  captchaResetKey,
  onEmailChange,
  onPasswordChange,
  onCaptchaVerify,
  onCaptchaReset,
  onSubmit,
  isSubmitting,
  error,
}) {
  return (
    <main className="animate-fade-in max-w-5xl mx-auto px-6 pb-20 pt-6">
      <div className="max-w-md mx-auto space-y-8">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center">
            <img src={logoEmpresa} alt={companyInfo.displayName} className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-[#888888]">Portal privado</p>
            <h1 className="font-display text-4xl font-light text-[#0A0A0A] mt-2">Administradores</h1>
          </div>
          <p className="text-[#888888] text-xs leading-6 font-light">
            Acceso exclusivo para cuentas autorizadas de Galerias.
          </p>
        </div>

        {error && (
          <div className="bg-[#F2F2F2] border border-[#E8E8E8] p-4 flex gap-3 text-[#0A0A0A] text-sm items-start">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="border border-[#E8E8E8] p-8 text-left">
          <form onSubmit={onSubmit} className="space-y-7">
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] font-medium text-[#888888] uppercase tracking-widest flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                Email administrador
              </label>
              <input
                type="email"
                required
                autoComplete="username"
                placeholder="admin@correo.com"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] font-medium text-[#888888] uppercase tracking-widest flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                Contrasena
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="**********"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
            />
          </div>

          {ADMIN_CAPTCHA_ENABLED && (
            <TurnstileCaptcha
              siteKey={TURNSTILE_SITE_KEY}
              resetKey={captchaResetKey}
              onVerify={onCaptchaVerify}
              onExpire={onCaptchaReset}
              onError={onCaptchaReset}
            />
          )}

          <button
            type="submit"
            disabled={isSubmitting || (ADMIN_CAPTCHA_ENABLED && !captchaToken)}
            className="btn-primary w-full py-3.5 font-medium text-xs uppercase tracking-widest transition-all duration-300 active:scale-[0.98] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
              <LogIn className="w-4 h-4" />
              {isSubmitting ? 'Verificando...' : 'Entrar al panel'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function AdminApp() {
  const [products, setProducts] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminCaptchaToken, setAdminCaptchaToken] = useState('');
  const [adminCaptchaResetKey, setAdminCaptchaResetKey] = useState(0);
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  }, []);

  const resetAdminCaptcha = useCallback(() => {
    setAdminCaptchaToken('');
    setAdminCaptchaResetKey((value) => value + 1);
  }, []);

  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      if (!isSupabaseConfigured) {
        clearAdminAccessVerified();
        setCurrentUser(null);
        setProducts([]);
        setInquiries([]);
        setLoadError('Supabase no esta configurado para el panel admin.');
        return;
      }

      const user = await getCurrentAuthUser();

      if (!user) {
        clearAdminAccessVerified();
        setCurrentUser(null);
        setProducts([]);
        setInquiries([]);
        return;
      }

      if (user.role !== 'admin') {
        await signOutFromSupabase();
        clearAdminAccessVerified();
        setCurrentUser(null);
        setProducts([]);
        setInquiries([]);
        setLoadError('Esta ruta es solo para administradores.');
        return;
      }

      markAdminAccessVerified();
      setCurrentUser(user);

      const [loadedProducts, loadedInquiries] = await Promise.all([
        fetchAdminProducts(),
        fetchProductInquiries(),
      ]);

      setProducts(loadedProducts);
      setInquiries(loadedInquiries);
    } catch (err) {
      setCurrentUser(null);
      setProducts([]);
      setInquiries([]);
      setLoadError(err.message);
      showToast('No se pudo cargar el panel admin.');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    setAdminLoginError('');
    setLoadError('');

    if (SECURE_LOGIN_ENABLED && !TURNSTILE_SITE_KEY) {
      setAdminLoginError('Falta configurar VITE_TURNSTILE_SITE_KEY para el login seguro.');
      return;
    }

    if (ADMIN_CAPTCHA_ENABLED && !adminCaptchaToken) {
      setAdminLoginError('Completa la verificacion de seguridad.');
      return;
    }

    setAdminLoginLoading(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase no esta configurado para el panel admin.');
      }

      const user = await signInWithSupabase(adminEmail.trim().toLowerCase(), adminPassword, {
        scope: 'admin',
        captchaToken: adminCaptchaToken,
      });

      if (user.role !== 'admin') {
        await signOutFromSupabase();
        clearAdminAccessVerified();
        setCurrentUser(null);
        throw new Error('Esta cuenta no tiene permisos de administrador.');
      }

      markAdminAccessVerified();
      setAdminPassword('');
      setAdminEmail('');
      resetAdminCaptcha();
      showToast('Sesion de administrador iniciada.');
      await loadAdminData();
    } catch (err) {
      setAdminLoginError(err.message || 'No se pudo iniciar sesion.');
      resetAdminCaptcha();
    } finally {
      setAdminLoginLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAdminData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAdminData]);

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A]">
      <div className="sticky top-0 z-50 h-20 bg-white border-b border-[#E8E8E8] px-6 py-4 flex justify-between items-center">
        <button
          onClick={() => {
            window.location.href = '/eric_diaz/';
          }}
          className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-[#888888] hover:text-[#0A0A0A] transition-colors focus:outline-none"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la Tienda
        </button>
        <div className="flex h-12 w-12 items-center justify-center">
          <img src={logoEmpresa} alt={companyInfo.displayName} className="h-full w-full object-contain" />
        </div>
      </div>

      {isLoading ? (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#0A0A0A]" />
          <p className="text-[#888888] text-sm font-light">Cargando panel administrativo...</p>
        </div>
      ) : currentUser?.role === 'admin' ? (
        <AdminDashboard
          currentUser={currentUser}
          products={products}
          inquiries={inquiries}
        />
      ) : (
        <AdminLogin
          email={adminEmail}
          password={adminPassword}
          captchaToken={adminCaptchaToken}
          captchaResetKey={adminCaptchaResetKey}
          onEmailChange={setAdminEmail}
          onPasswordChange={setAdminPassword}
          onCaptchaVerify={setAdminCaptchaToken}
          onCaptchaReset={resetAdminCaptcha}
          onSubmit={handleAdminLogin}
          isSubmitting={adminLoginLoading}
          error={adminLoginError || loadError}
        />
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 text-white text-xs font-medium px-5 py-3.5 border border-white/10 animate-fade-in-up bg-[#0A0A0A] flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-white/70" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
