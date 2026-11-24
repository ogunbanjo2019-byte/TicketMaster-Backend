import { createUserClient } from '../config/supabase.js';
import { ApiError } from '../utils/http.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.get('authorization') || '';
    const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!token) throw new ApiError(401, 'Please sign in to continue.', 'AUTH_REQUIRED');

    const supabase = createUserClient(token);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) throw new ApiError(401, 'Your session has expired. Please sign in again.', 'SESSION_EXPIRED');

    req.auth = data.user;
    req.accessToken = token;
    req.supabase = supabase;
    next();
  } catch (error) {
    next(error);
  }
}