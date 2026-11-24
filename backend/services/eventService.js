import { createAuthClient } from '../config/supabase.js';
import { ApiError } from '../utils/http.js';

function mapEvent(row) {
  return {
    id: row.id,
    title: row.title,
    shortTitle: row.short_title,
    category: row.category,
    tagline: row.tagline,
    date: row.date_display,
    dateISO: row.date_iso,
    venue: row.venue,
    city: row.city,
    poster: row.poster,
    hero: row.hero,
    description: row.description,
    ticketTypes: (row.ticket_types || []).map(type => ({ id: type.id, label: type.label, price: Number(type.price), available: type.available }))
  };
}

export async function checkDatabase() {
  const { error } = await createAuthClient().from('events').select('id').limit(1);
  if (error) throw new ApiError(503, 'Database is unavailable.', 'DATABASE_UNAVAILABLE');
  return { status: 'ok', service: 'ticketmaster-api', database: 'connected' };
}

export async function listEvents() {
  const { data, error } = await createAuthClient().from('events').select('*, ticket_types(*)').order('date_iso');
  if (error) throw new ApiError(503, 'Unable to load events right now. Please try again.', 'EVENTS_UNAVAILABLE');
  return (data || []).map(mapEvent);
}

export async function getEvent(id) {
  const { data, error } = await createAuthClient().from('events').select('*, ticket_types(*)').eq('id', id).maybeSingle();
  if (error) throw new ApiError(503, 'Unable to load this event right now.', 'EVENT_UNAVAILABLE');
  if (!data) throw new ApiError(404, 'Event not found.', 'EVENT_NOT_FOUND');
  return mapEvent(data);
}

export async function getReservedSeats(eventId) {
  const { data, error } = await createAuthClient().from('seat_reservations').select('seat_code').eq('event_id', eventId);
  if (error) throw new ApiError(503, 'Unable to check seat availability right now.', 'SEATS_UNAVAILABLE');
  return (data || []).map(row => row.seat_code);
}
