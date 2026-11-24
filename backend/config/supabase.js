import { createClient } from '@supabase/supabase-js';
import { getConfig } from './env.js';

const config = getConfig();
const authOptions = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };

export function createAuthClient() {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, authOptions);
}

export function createUserClient(accessToken) {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    ...authOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

export { config };