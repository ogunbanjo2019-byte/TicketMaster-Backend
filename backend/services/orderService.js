import { ApiError } from '../utils/http.js';

function mapOrder(row) {
  if (!row) return row;
  return {
    id: row.id,
    eventId: row.eventId ?? row.event_id,
    title: row.title,
    date: row.date,
    venue: row.venue,
    ticketType: row.ticketType ?? row.ticket_type,
    quantity: row.quantity,
    seats: row.seats,
    seat: row.seat,
    subtotal: Number(row.subtotal),
    serviceFee: Number(row.serviceFee ?? row.service_fee),
    facilityFee: Number(row.facilityFee ?? row.facility_fee),
    total: Number(row.total),
    status: row.status,
    code: row.code,
    createdAt: row.createdAt ?? row.created_at
  };
}

export async function listOrders(req) {
  const { data, error } = await req.supabase.from('orders').select('id,eventId:event_id,title,date,venue,ticketType:ticket_type,quantity,seats,seat,subtotal,serviceFee:service_fee,facilityFee:facility_fee,total,status,code,createdAt:created_at').order('created_at', { ascending: false });
  if (error) throw new ApiError(503, 'Could not load your tickets.', 'DATABASE_UNAVAILABLE');
  return (data || []).map(mapOrder);
}

export async function createOrder(req, { eventId, ticketType, quantity, seats }) {
  const { data, error } = await req.supabase.rpc('create_ticket_order', {
    p_event_id: eventId,
    p_ticket_type: ticketType,
    p_quantity: quantity,
    p_seats: seats
  });
  if (error) {
    const message = error.message || '';
    if (/choose a valid event or ticket/i.test(message)) throw new ApiError(400, 'Choose a valid event and ticket type.', 'INVALID_TICKET');
    if (/different seat/i.test(message)) throw new ApiError(400, 'Choose a different seat for every ticket.', 'INVALID_SEATS');
    if (/section/i.test(message)) throw new ApiError(400, message, 'INVALID_SEAT_SECTION');
    if (/just reserved|duplicate key/i.test(message)) throw new ApiError(409, 'One of those seats was just reserved. Please choose again.', 'SEAT_TAKEN');
    console.error('[TicketMaster order]', error);
    throw new ApiError(503, 'Could not complete this order. Please try again.', 'ORDER_FAILED');
  }
  return mapOrder(data);
}
