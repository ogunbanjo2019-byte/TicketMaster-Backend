import { createAuthClient, createUserClient, config } from '../config/supabase.js';
import { ApiError } from '../utils/http.js';

function mapAuthError(error) {
  const message = error?.message || 'Authentication request failed.';
  if (/already registered|already exists|already been registered/i.test(message)) return new ApiError(409, 'An account with that email already exists. Sign in instead.', 'ACCOUNT_EXISTS');
  if (/invalid login credentials|email not confirmed/i.test(message)) return new ApiError(401, /not confirmed/i.test(message) ? 'Please confirm your email address before signing in.' : 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
  if (/password should be at least|password.*(weak|short)/i.test(message)) return new ApiError(400, 'Choose a stronger password with at least 8 characters.', 'WEAK_PASSWORD');
  if (/rate limit/i.test(message)) return new ApiError(429, 'Too many attempts. Please wait a little and try again.', 'RATE_LIMITED');
  return new ApiError(error?.status || 400, message, 'AUTH_REQUEST_FAILED');
}

function publicUser(user) {
  const metadata = user.user_metadata || {};
  return { id: user.id, firstName: metadata.first_name || '', lastName: metadata.last_name || '', email: user.email || '' };
}

function authPayload(data) {
  return {
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: publicUser(data.user)
  };
}

export async function signUp({ firstName, lastName, email, phone, password }) {
  const supabase = createAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${config.appUrl}/?mode=login`,
      data: { first_name: firstName, last_name: lastName, phone: phone || '' }
    }
  });
  if (error) throw mapAuthError(error);
  if (!data.user) throw new ApiError(400, 'Could not create that account. Check the details and try again.', 'SIGNUP_FAILED');
  if (!data.session) {
    return { requiresEmailVerification: true, message: 'Check your email for a confirmation link, then sign in to continue.' };
  }
  return authPayload(data);
}

export async function signIn({ email, password }) {
  const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password });
  if (error) throw mapAuthError(error);
  if (!data.session || !data.user) throw new ApiError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
  return authPayload(data);
}

export async function refreshSession(refreshToken) {
  const { data, error } = await createAuthClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error) throw new ApiError(401, 'Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  if (!data.session || !data.user) throw new ApiError(401, 'Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  return authPayload(data);
}

export async function requestPasswordReset(email) {
  const { error } = await createAuthClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${config.appUrl}/?mode=reset`
  });
  if (error) throw mapAuthError(error);
  return { ok: true, message: 'If an account exists for that email, a password reset link will be sent.' };
}

export async function updatePassword({ accessToken, refreshToken, password }) {
  const supabase = createUserClient(accessToken);
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (sessionError || !sessionData.session) throw new ApiError(400, 'This password reset link is invalid or has expired. Request a new one.', 'INVALID_RECOVERY_LINK');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw mapAuthError(error);
  return { ok: true };
}

export async function signOut(accessToken, refreshToken) {
  const supabase = createUserClient(accessToken);
  if (refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (!sessionError) await supabase.auth.signOut();
  }
  return { ok: true };
}

export { publicUser };
