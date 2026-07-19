import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CAPTCHA_AFTER_FAILURES = 3;
const CUSTOMER_LOCK_AFTER_FAILURES = 6;
const ADMIN_LOCK_AFTER_FAILURES = 3;
const CUSTOMER_LOCK_MINUTES = 15;
const ADMIN_LOCK_MINUTES = 15;
const ATTEMPT_WINDOW_MINUTES = 30;

type LoginScope = 'customer' | 'admin';

type LoginAttempt = {
  failed_count: number;
  blocked_until: string | null;
  last_failed_at: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function secondsUntil(timestamp: string) {
  return Math.max(1, Math.ceil((new Date(timestamp).getTime() - Date.now()) / 1000));
}

function isAttemptWindowExpired(attempt: LoginAttempt | null) {
  if (!attempt?.last_failed_at) return false;
  const lastFailedAt = new Date(attempt.last_failed_at).getTime();
  return Date.now() - lastFailedAt > ATTEMPT_WINDOW_MINUTES * 60 * 1000;
}

function getFailureSettings(scope: LoginScope) {
  return scope === 'admin'
    ? { lockAfter: ADMIN_LOCK_AFTER_FAILURES, lockMinutes: ADMIN_LOCK_MINUTES }
    : { lockAfter: CUSTOMER_LOCK_AFTER_FAILURES, lockMinutes: CUSTOMER_LOCK_MINUTES };
}

async function verifyTurnstile(token: string, ip: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    return { ok: false, reason: 'captcha-not-configured' };
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret,
      response: token,
      remoteip: ip === 'unknown' ? undefined : ip,
    }),
  });

  if (!response.ok) return { ok: false, reason: 'captcha-request-failed' };

  const result = await response.json();
  return { ok: Boolean(result.success), reason: result['error-codes']?.join(',') || '' };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Metodo no permitido.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pepper = Deno.env.get('LOGIN_ATTEMPT_PEPPER') || serviceRoleKey || 'galerias-login';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({
      ok: false,
      code: 'SERVER_NOT_CONFIGURED',
      message: 'El inicio de sesion seguro no esta configurado.',
    });
  }

  let payload: {
    email?: string;
    password?: string;
    scope?: LoginScope;
    captchaToken?: string;
  };

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: 'BAD_REQUEST', message: 'Solicitud invalida.' });
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password || '';
  const scope: LoginScope = payload.scope === 'admin' ? 'admin' : 'customer';
  const ip = getClientIp(request);

  if (!email || !password) {
    return jsonResponse({
      ok: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Credenciales invalidas o usuario no confirmado.',
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const identifierHash = await sha256(`${pepper}:email:${email}`);
  const ipHash = await sha256(`${pepper}:ip:${ip}`);

  const { data: rawAttempt } = await adminClient
    .from('login_attempts')
    .select('failed_count, blocked_until, last_failed_at')
    .eq('scope', scope)
    .eq('identifier_hash', identifierHash)
    .eq('ip_hash', ipHash)
    .maybeSingle();

  let attempt = rawAttempt as LoginAttempt | null;

  if (isAttemptWindowExpired(attempt)) {
    await adminClient
      .from('login_attempts')
      .update({
        failed_count: 0,
        blocked_until: null,
        last_failed_at: null,
      })
      .eq('scope', scope)
      .eq('identifier_hash', identifierHash)
      .eq('ip_hash', ipHash);
    attempt = null;
  }

  if (attempt?.blocked_until && new Date(attempt.blocked_until).getTime() > Date.now()) {
    return jsonResponse({
      ok: false,
      code: 'LOGIN_LOCKED',
      message: 'Demasiados intentos. Intenta nuevamente en unos minutos.',
      retryAfterSeconds: secondsUntil(attempt.blocked_until),
    });
  }

  const failedCount = attempt?.failed_count || 0;
  const captchaRequired = scope === 'admin' || failedCount >= CAPTCHA_AFTER_FAILURES;

  if (captchaRequired) {
    if (!payload.captchaToken) {
      return jsonResponse({
        ok: false,
        code: 'CAPTCHA_REQUIRED',
        message: 'Completa la verificacion de seguridad.',
      });
    }

    const captcha = await verifyTurnstile(payload.captchaToken, ip);
    if (!captcha.ok) {
      return jsonResponse({
        ok: false,
        code: 'CAPTCHA_REQUIRED',
        message: 'No se pudo validar la verificacion de seguridad. Intentalo otra vez.',
      });
    }
  }

  async function recordFailure() {
    const currentFailedCount = isAttemptWindowExpired(attempt) ? 0 : failedCount;
    const nextCount = currentFailedCount + 1;
    const settings = getFailureSettings(scope);
    const blockedUntil = nextCount >= settings.lockAfter ? minutesFromNow(settings.lockMinutes) : null;

    await adminClient
      .from('login_attempts')
      .upsert({
        scope,
        identifier_hash: identifierHash,
        ip_hash: ipHash,
        failed_count: nextCount,
        blocked_until: blockedUntil,
        last_failed_at: new Date().toISOString(),
      }, { onConflict: 'scope,identifier_hash,ip_hash' });

    return { nextCount, blockedUntil };
  }

  function invalidCredentialsResponse(failure?: { nextCount: number; blockedUntil: string | null }) {
    return jsonResponse({
      ok: false,
      code: failure?.blockedUntil
        ? 'LOGIN_LOCKED'
        : failure && failure.nextCount >= CAPTCHA_AFTER_FAILURES
          ? 'CAPTCHA_REQUIRED'
          : 'INVALID_CREDENTIALS',
      message: failure?.blockedUntil
        ? 'Demasiados intentos. Intenta nuevamente en unos minutos.'
        : 'Credenciales invalidas o usuario no confirmado.',
      retryAfterSeconds: failure?.blockedUntil ? secondsUntil(failure.blockedUntil) : undefined,
    });
  }

  if (scope === 'customer') {
    const { data: publicProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('email', email)
      .maybeSingle();

    // Do not test admin passwords through the public customer login.
    if (publicProfile?.role === 'admin' || publicProfile?.role === 'staff') {
      const failure = await recordFailure();
      return invalidCredentialsResponse(failure);
    }
  }

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user || !authData.session) {
    const failure = await recordFailure();
    return invalidCredentialsResponse(failure);
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id,email,full_name,role,status')
    .eq('id', authData.user.id)
    .single();

  const role = profile?.role === 'admin' || profile?.role === 'staff' ? 'admin' : 'user';
  const isActive = !profile?.status || profile.status === 'active';
  const scopeAllowed = scope === 'admin' ? role === 'admin' : role !== 'admin';

  if (profileError || !isActive || !scopeAllowed) {
    await recordFailure();

    return jsonResponse({
      ok: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Credenciales invalidas o usuario no confirmado.',
    });
  }

  await adminClient
    .from('login_attempts')
    .delete()
    .eq('scope', scope)
    .eq('identifier_hash', identifierHash)
    .eq('ip_hash', ipHash);

  return jsonResponse({
    ok: true,
    session: authData.session,
    user: {
      id: authData.user.id,
      email: profile.email || authData.user.email,
      name: profile.full_name || authData.user.user_metadata?.full_name || '',
      role,
      status: profile.status || 'active',
    },
  });
});
