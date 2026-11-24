import * as eventService from '../services/eventService.js';

export async function list(_req, res) { res.json(await eventService.listEvents()); }
export async function get(req, res) { res.json(await eventService.getEvent(req.params.id)); }
export async function seats(req, res) { res.json({ reservedSeats: await eventService.getReservedSeats(req.params.id) }); }