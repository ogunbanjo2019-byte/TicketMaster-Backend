import * as flightService from '../services/flightService.js';
import { ApiError } from '../utils/http.js';

export async function places(req, res) {
  const query = String(req.query.q || '').trim();
  if (query.length > 80) throw new ApiError(400, 'Search text must be 80 characters or fewer.', 'PLACE_QUERY_TOO_LONG');
  res.json({ places: await flightService.suggestPlaces(query) });
}

export async function search(req, res) {
  res.json(await flightService.searchFlights(req.body || {}));
}
