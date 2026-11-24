import * as orderService from '../services/orderService.js';
import { ApiError } from '../utils/http.js';

export async function list(req, res) {
  res.json(await orderService.listOrders(req));
}

export async function create(req, res) {
  const { eventId, ticketType } = req.body;
  const quantity = Number(req.body.quantity);
  const rawSeats = Array.isArray(req.body.seats) ? req.body.seats : [];
  const seats = rawSeats
    .map(seat => String(seat || '').trim().toUpperCase())
    .filter(Boolean);

  if (typeof eventId !== 'string' || !eventId.trim() || typeof ticketType !== 'string' || !ticketType.trim()) {
    throw new ApiError(400, 'Choose a valid event and ticket type.', 'INVALID_TICKET');
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 6) {
    throw new ApiError(400, 'Choose between 1 and 6 tickets.', 'INVALID_QUANTITY');
  }
  if (seats.length > 0 && seats.length !== quantity) {
    throw new ApiError(400, 'Selected seats must match the ticket quantity.', 'SEAT_QUANTITY_MISMATCH');
  }

  res.status(201).json(await orderService.createOrder(req, { eventId: eventId.trim(), ticketType: ticketType.trim(), quantity, seats }));
}