import { ApiError } from '../utils/http.js';

function check(result, message = 'Could not save your account details. Please try again.') {
  if (result.error) {
    console.error('[TicketMaster database]', result.error);
    if (result.error.code === '23503') throw new ApiError(404, 'The selected event or ticket could not be found.', 'RECORD_NOT_FOUND');
    throw new ApiError(503, message, 'DATABASE_UNAVAILABLE');
  }
  return result.data;
}

export async function getProfile(req) {
  const { data, error } = await req.supabase.from('profiles').select('firstName:first_name,lastName:last_name,email,phone,location').eq('id', req.auth.id).maybeSingle();
  if (error) throw new ApiError(503, 'Could not load your profile.', 'DATABASE_UNAVAILABLE');
  if (!data) throw new ApiError(404, 'Profile not found.', 'PROFILE_NOT_FOUND');
  return data;
}

export async function updateProfile(req, { firstName, lastName, email, phone, location }) {
  const authEmail = req.auth.email || '';
  if (String(email || '').trim().toLowerCase() !== authEmail.toLowerCase()) {
    throw new ApiError(400, 'Your sign-in email is verified by Supabase. Email changes are not available from this form yet.', 'EMAIL_CHANGE_UNAVAILABLE');
  }
  const result = await req.supabase.from('profiles').update({ first_name: firstName.trim(), last_name: lastName.trim(), phone: String(phone || '').trim(), location: String(location || 'New York City, NY').trim() }).eq('id', req.auth.id).select('firstName:first_name,lastName:last_name,email,phone,location').single();
  return check(result);
}

export async function listFavorites(req) {
  const { data, error } = await req.supabase.from('favorites').select('event_id').order('created_at', { ascending: false });
  if (error) throw new ApiError(503, 'Could not load favorites.', 'DATABASE_UNAVAILABLE');
  return (data || []).map(item => item.event_id);
}

export async function setFavorite(req, eventId, saved) {
  if (saved) {
    const result = await req.supabase.from('favorites').upsert({ user_id: req.auth.id, event_id: eventId }, { onConflict: 'user_id,event_id', ignoreDuplicates: true });
    check(result);
  } else {
    check(await req.supabase.from('favorites').delete().eq('user_id', req.auth.id).eq('event_id', eventId));
  }
  return { favorites: await listFavorites(req) };
}

export async function listNotifications(req) {
  const { data, error } = await req.supabase.from('notifications').select('id,icon,tone,title,detail,time,read').order('created_at', { ascending: false });
  if (error) throw new ApiError(503, 'Could not load notifications.', 'DATABASE_UNAVAILABLE');
  return data || [];
}

export async function markNotificationsRead(req) {
  check(await req.supabase.from('notifications').update({ read: true }).eq('user_id', req.auth.id));
  return { ok: true };
}

export async function createTransfer(req, body) {
  const { data: order, error: orderError } = await req.supabase.from('orders').select('id,title').eq('id', body.orderId).eq('user_id', req.auth.id).maybeSingle();
  if (orderError) throw new ApiError(503, 'Could not load that ticket.', 'DATABASE_UNAVAILABLE');
  if (!order) throw new ApiError(404, 'Ticket order not found.', 'ORDER_NOT_FOUND');
  const transfer = {
    user_id: req.auth.id,
    order_id: body.orderId,
    recipient_first_name: body.recipientFirstName.trim(),
    recipient_last_name: body.recipientLastName.trim(),
    recipient_contact: body.recipientContact.trim(),
    message: String(body.message || '').slice(0, 250)
  };
  const { data, error } = await req.supabase.from('transfers').insert(transfer).select('id,orderId:order_id,recipientFirstName:recipient_first_name,recipientLastName:recipient_last_name,recipientContact:recipient_contact,message,status,createdAt:created_at').single();
  check({ data, error }, 'Could not create the transfer. Please try again.');
  await req.supabase.from('notifications').insert({ user_id: req.auth.id, icon: '↗', tone: 'blue', title: 'Ticket transfer is on its way', detail: `Invitation sent to ${transfer.recipient_first_name}.`, time: 'Just now' });
  return data;
}

export async function listListings(req) {
  const { data, error } = await req.supabase.from('listings').select('id,orderId:order_id,title,askingPrice:asking_price,quantity,status,createdAt:created_at').order('created_at', { ascending: false });
  if (error) throw new ApiError(503, 'Could not load resale listings.', 'DATABASE_UNAVAILABLE');
  return data || [];
}

export async function createListing(req, { orderId, askingPrice, quantity }) {
  const { data: order, error: orderError } = await req.supabase.from('orders').select('id,title,quantity').eq('id', orderId).eq('user_id', req.auth.id).maybeSingle();
  if (orderError) throw new ApiError(503, 'Could not load that ticket.', 'DATABASE_UNAVAILABLE');
  if (!order) throw new ApiError(404, 'Ticket order not found.', 'ORDER_NOT_FOUND');
  if (quantity > order.quantity) throw new ApiError(400, 'You cannot list more tickets than you own.', 'INVALID_QUANTITY');
  const { data, error } = await req.supabase.from('listings').insert({ user_id: req.auth.id, order_id: orderId, title: order.title, asking_price: askingPrice, quantity }).select('id,orderId:order_id,title,askingPrice:asking_price,quantity,status,createdAt:created_at').single();
  return check({ data, error }, 'Could not publish the resale listing. Please try again.');
}