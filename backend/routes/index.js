import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as auth from '../controllers/authController.js';
import * as events from '../controllers/eventController.js';
import * as orders from '../controllers/orderController.js';
import * as account from '../controllers/accountController.js';
import * as eventService from '../services/eventService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/http.js';

const api = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many authentication attempts. Please wait and try again.' } });
const wrap = asyncHandler;

api.get('/health', wrap(async (_req, res) => res.json({ ...(await eventService.checkDatabase()), timestamp: new Date().toISOString() })));
api.post('/auth/signup', authLimiter, wrap(auth.signUp));
api.post('/auth/login', authLimiter, wrap(auth.signIn));
api.post('/auth/refresh', authLimiter, wrap(auth.refresh));
api.post('/auth/forgot-password', authLimiter, wrap(auth.forgotPassword));
api.post('/auth/update-password', authLimiter, wrap(auth.updatePassword));
api.get('/auth/session', requireAuth, wrap(auth.session));
api.post('/auth/logout', requireAuth, wrap(auth.logout));

api.get('/events', wrap(events.list));
api.get('/events/:id', wrap(events.get));
api.get('/events/:id/seats', wrap(events.seats));
api.get('/qr', asyncHandler(async (req, res) => {
  const { default: QRCode } = await import('qrcode');
  const value = String(req.query.data || 'TicketPro ticket').slice(0, 180);
  const svg = await QRCode.toString(value, { type: 'svg', width: 190, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111a35', light: '#ffffff' } });
  res.type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
}));

api.use(requireAuth);
api.get('/favorites', wrap(account.getFavorites));
api.post('/favorites/:id', wrap(account.setFavorite));
api.get('/orders', wrap(orders.list));
api.post('/orders', wrap(orders.create));
api.get('/notifications', wrap(account.getNotifications));
api.post('/notifications/read', wrap(account.readNotifications));
api.post('/transfers', wrap(account.createTransfer));
api.get('/listings', wrap(account.getListings));
api.post('/listings', wrap(account.createListing));
api.get('/profile', wrap(account.getProfile));
api.put('/profile', wrap(account.updateProfile));

export default api;