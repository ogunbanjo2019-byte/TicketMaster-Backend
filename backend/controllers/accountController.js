import * as accountService from '../services/accountService.js';
import { ApiError } from '../utils/http.js';

const emailPattern = /^\S+@\S+\.\S+$/;

export async function getProfile(req, res) { res.json(await accountService.getProfile(req)); }
export async function updateProfile(req, res) {
  const firstName = String(req.body.firstName || '').trim();
  const lastName = String(req.body.lastName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!firstName || !lastName || !emailPattern.test(email)) throw new ApiError(400, 'Enter a valid name and email address.', 'INVALID_PROFILE');
  res.json(await accountService.updateProfile(req, { firstName, lastName, email, phone: req.body.phone, location: req.body.location }));
}
export async function getFavorites(req, res) { res.json(await accountService.listFavorites(req)); }
export async function setFavorite(req, res) {
  if (typeof req.body.saved !== 'boolean') throw new ApiError(400, 'Favorite state must be true or false.', 'INVALID_FAVORITE');
  res.json(await accountService.setFavorite(req, req.params.id, req.body.saved));
}
export async function getNotifications(req, res) { res.json(await accountService.listNotifications(req)); }
export async function readNotifications(req, res) { res.json(await accountService.markNotificationsRead(req)); }
export async function createTransfer(req, res) {
  const { orderId, recipientFirstName, recipientLastName, recipientContact } = req.body;
  if (![orderId, recipientFirstName, recipientLastName, recipientContact].every(value => typeof value === 'string' && value.trim())) {
    throw new ApiError(400, 'Complete the recipient details before sending.', 'INVALID_TRANSFER');
  }
  res.status(201).json(await accountService.createTransfer(req, req.body));
}
export async function getListings(req, res) { res.json(await accountService.listListings(req)); }
export async function createListing(req, res) {
  const orderId = String(req.body.orderId || '').trim();
  const askingPrice = Number(req.body.askingPrice);
  const quantity = Number(req.body.quantity || 1);
  if (!orderId || !Number.isFinite(askingPrice) || askingPrice <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 6) {
    throw new ApiError(400, 'Enter a valid asking price and quantity.', 'INVALID_LISTING');
  }
  res.status(201).json(await accountService.createListing(req, { orderId, askingPrice, quantity }));
}
