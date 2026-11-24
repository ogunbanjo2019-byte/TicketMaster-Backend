import * as orderService from '../services/orderService.js';
import { ApiError } from '../utils/http.js';

export async function list(req, res) { res.json(await orderService.listOrders(req)); }
export async function create(req, res) {
  const { eventId, ticketType } = req.body;
  const quantity = Number(req.body.quantity);
  const seats = [];
  if (typeof eventId !== 'string' || !eventId || typeof ticketType !== 'string' || !ticketType) throw new ApiError(400, 'Choose a valid event and ticket type.', 'INVALID_TICKET');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 6) throw new ApiError(400, 'Choose between 1 and 6 tickets.', 'INVALID_QUANTITY');
  res.status(201).json(await orderService.createOrder(req, { eventId, ticketType, quantity, seats }));
}