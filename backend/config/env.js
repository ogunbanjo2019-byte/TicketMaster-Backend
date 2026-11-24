import 'dotenv/config';

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

export function getConfig() {
  const missing = required.filter(key => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Copy .env.example to .env and add your Supabase project values.`);
  }

  const appUrl = (process.env.APP_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
  let parsedUrl;
  try { parsedUrl = new URL(appUrl); }
  catch { throw new Error('APP_URL must be a valid absolute URL.'); }
  if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
    throw new Error('APP_URL must use HTTPS in production.');
  }

  let supabaseUrl;
  try { supabaseUrl = new URL(process.env.SUPABASE_URL.trim()); }
  catch { throw new Error('SUPABASE_URL must be a valid project URL.'); }
  if (!['https:', 'http:'].includes(supabaseUrl.protocol)) throw new Error('SUPABASE_URL must use HTTP or HTTPS.');

  return Object.freeze({
    port: Number(process.env.PORT || 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    appUrl,
    supabaseUrl: supabaseUrl.origin,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY.trim(),
    frontendDir: process.env.FRONTEND_DIR || undefined
  });
}
