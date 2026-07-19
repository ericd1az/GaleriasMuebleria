import { isSupabaseConfigured, supabase } from './supabaseClient';

const SECURE_LOGIN_ENABLED = import.meta.env.VITE_SECURE_LOGIN_ENABLED === 'true';

function mapProfileToCurrentUser(profile, authUser) {
  const rawRole = profile?.role || 'customer';
  const role = rawRole === 'admin' || rawRole === 'staff' ? 'admin' : 'user';

  return {
    id: authUser?.id || profile?.id,
    email: profile?.email || authUser?.email,
    name: profile?.full_name || authUser?.user_metadata?.full_name || '',
    role,
    status: profile?.status || 'active',
  };
}

function getEmailRedirectTo() {
  const redirectBase = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
  return `${redirectBase}?auth=confirmed#/account`;
}

async function getProfile(authUser) {
  if (!authUser) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,status')
    .eq('id', authUser.id)
    .single();

  if (error) {
    throw error;
  }

  return mapProfileToCurrentUser(data, authUser);
}

export async function getCurrentAuthUser() {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) return null;

  return getProfile(data.session.user);
}

function createAuthError(message, code, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

async function signInWithSecureFunction({ email, password, scope = 'customer', captchaToken = '' }) {
  const { data, error } = await supabase.functions.invoke('secure-login', {
    body: {
      email,
      password,
      scope,
      captchaToken,
    },
  });

  if (error) {
    throw createAuthError('No se pudo validar el inicio de sesion.', 'SECURE_LOGIN_UNAVAILABLE');
  }

  if (!data?.ok) {
    throw createAuthError(
      data?.message || 'Credenciales invalidas o usuario no confirmado.',
      data?.code || 'INVALID_CREDENTIALS',
      {
        retryAfterSeconds: data?.retryAfterSeconds,
      },
    );
  }

  if (!data.session?.access_token || !data.session?.refresh_token) {
    throw createAuthError('No se pudo crear la sesion.', 'SESSION_MISSING');
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  if (sessionError) {
    throw createAuthError('No se pudo guardar la sesion.', 'SESSION_SET_FAILED');
  }

  return data.user;
}

export async function signInWithSupabase(email, password, options = {}) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no esta configurado.');
  }

  if (SECURE_LOGIN_ENABLED) {
    return signInWithSecureFunction({
      email,
      password,
      scope: options.scope || 'customer',
      captchaToken: options.captchaToken || '',
    });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error('Credenciales invalidas o usuario no confirmado.');
  }

  return getProfile(data.user);
}
export async function signUpWithSupabase({ email, password, fullName, captchaToken }) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado.');
  }

  const options = {
    emailRedirectTo: getEmailRedirectTo(),
    data: {
      full_name: fullName,
    },
  };

  if (captchaToken) {
    options.captchaToken = captchaToken;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options,
  });

  if (error) {
    throw new Error(error.message || 'No se pudo crear la cuenta.');
  }

  return {
    email: data.user?.email || email,
    needsConfirmation: !data.session,
  };
}

export async function signOutFromSupabase() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}
