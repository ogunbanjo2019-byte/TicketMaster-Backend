import * as authService from '../services/authService.js';
import { ApiError } from '../utils/http.js';

const emailPattern = /^\S+@\S+\.\S+$/;
const passwordValid = password => typeof password === 'string' && password.length >= 8 && password.length <= 128;

export async function signUp(req, res) {
  const firstName = String(req.body.firstName || '').trim();
  const lastName = String(req.body.lastName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;
  if (!firstName || !lastName || !emailPattern.test(email)) throw new ApiError(400, 'Enter your first name, last name, and a valid email address.', 'INVALID_SIGNUP');
  if (!passwordValid(password)) throw new ApiError(400, 'Choose a password with at least 8 characters.', 'INVALID_PASSWORD');
  res.status(201).json(await authService.signUp({ firstName, lastName, email, phone: req.body.phone, password }));
}

export async function signIn(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;
  if (!emailPattern.test(email) || typeof password !== 'string' || !password) throw new ApiError(400, 'Enter a valid email address and password.', 'INVALID_LOGIN');
  res.json(await authService.signIn({ email, password }));
}

export async function refresh(req, res) {
  const refreshToken = String(req.body.refreshToken || '');
  if (!refreshToken) throw new ApiError(400, 'A refresh token is required.', 'REFRESH_TOKEN_REQUIRED');
  res.json(await authService.refreshSession(refreshToken));
}

export async function logout(req, res) {
  res.json(await authService.signOut(req.accessToken, String(req.body.refreshToken || '')));
}

export function session(req, res) {
  res.json({ user: authService.publicUser(req.auth) });
}

export async function forgotPassword(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!emailPattern.test(email)) throw new ApiError(400, 'Enter a valid email address.', 'INVALID_EMAIL');
  res.json(await authService.requestPasswordReset(email));
}

export async function updatePassword(req, res) {
  const accessToken = String(req.body.accessToken || '');
  const refreshToken = String(req.body.refreshToken || '');
  const password = req.body.password;
  if (!accessToken || !refreshToken) throw new ApiError(400, 'This password reset link is incomplete. Request a new one.', 'INVALID_RECOVERY_LINK');
  if (!passwordValid(password)) throw new ApiError(400, 'Choose a password with at least 8 characters.', 'INVALID_PASSWORD');
  res.json(await authService.updatePassword({ accessToken, refreshToken, password }));
}