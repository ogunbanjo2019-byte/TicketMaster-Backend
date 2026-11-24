import { ApiError } from '../utils/http.js';

const DUFFEL_API = 'https://api.duffel.com';
const AFRICAN_COUNTRY_CODES = new Set([
  'AO', 'BF', 'BI', 'BJ', 'BW', 'CD', 'CF', 'CG', 'CI', 'CM', 'CV', 'DJ',
  'DZ', 'EG', 'EH', 'ER', 'ET', 'GA', 'GH', 'GM', 'GN', 'GQ', 'GW', 'KE',
  'KM', 'LR', 'LS', 'LY', 'MA', 'MG', 'ML', 'MR', 'MU', 'MW', 'MZ', 'NA',
  'NE', 'NG', 'RE', 'RW', 'SC', 'SD', 'SH', 'SL', 'SN', 'SO', 'SS', 'ST',
  'SZ', 'TD', 'TG', 'TN', 'TZ', 'UG', 'YT', 'ZA', 'ZM', 'ZW'
]);

function testToken() {
  const token = process.env.DUFFEL_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new ApiError(503, 'Flight search is not configured yet. Add a Duffel test token to the backend environment.', 'DUFFEL_NOT_CONFIGURED');
  }
  if (!token.startsWith('duffel_test_')) {
    throw new ApiError(503, 'This application only accepts a Duffel test-mode token. Use a token beginning with duffel_test_.', 'DUFFEL_TEST_TOKEN_REQUIRED');
  }
  return token;
}

async function duffelRequest(path, { method = 'GET', body } = {}) {
  const token = testToken();
  let response;
  try {
    response = await fetch(`${DUFFEL_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Duffel-Version': 'v2',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(35000)
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new ApiError(504, 'Duffel took too long to respond. Try the search again.', 'DUFFEL_TIMEOUT');
    }
    throw new ApiError(502, 'Could not connect to Duffel. Try again in a moment.', 'DUFFEL_UNAVAILABLE');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const requestId = response.headers.get('x-request-id');
    console.error('[Duffel API]', { status: response.status, requestId });
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(502, 'Duffel rejected the test token. Check that Render has the correct test-mode read/write token.', 'DUFFEL_TOKEN_REJECTED');
    }
    if (response.status === 429) {
      throw new ApiError(429, 'Duffel is rate-limiting requests. Wait a moment and try again.', 'DUFFEL_RATE_LIMITED');
    }
    if (response.status >= 500) {
      throw new ApiError(502, 'Duffel is temporarily unavailable. Try again shortly.', 'DUFFEL_PROVIDER_ERROR');
    }
    const details = payload.errors?.[0]?.message;
    throw new ApiError(400, details || 'Duffel could not process that flight request. Check the selected places and dates.', 'DUFFEL_REQUEST_INVALID');
  }
  return payload.data;
}

function cleanPlace(place) {
  const code = String(place?.iata_code || '').toUpperCase();
  const countryCode = String(place?.iata_country_code || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(code) || !/^[A-Z]{2}$/.test(countryCode)) return null;
  if (AFRICAN_COUNTRY_CODES.has(countryCode)) return null;
  const city = place.city_name || place.city?.name || '';
  const label = place.type === 'city'
    ? `${city || place.name} (${code}), ${countryCode}`
    : `${place.name} (${code})${city ? ` · ${city}` : ''}, ${countryCode}`;
  return {
    code,
    countryCode,
    type: place.type === 'city' ? 'city' : 'airport',
    cityName: city,
    name: place.name,
    label
  };
}

export async function suggestPlaces(query) {
  const search = String(query || '').trim();
  if (search.length < 2 || search.length > 80) return [];
  const params = new URLSearchParams({ query: search });
  const result = await duffelRequest(`/places/suggestions?${params}`);
  const seen = new Set();
  return (Array.isArray(result) ? result : [])
    .map(cleanPlace)
    .filter(place => {
      if (!place) return false;
      const key = `${place.type}:${place.code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function requireNonAfricanPlace(codeValue, countryValue, fieldName) {
  const code = String(codeValue || '').trim().toUpperCase();
  const countryCode = String(countryValue || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code) || !/^[A-Z]{2}$/.test(countryCode)) {
    throw new ApiError(400, `Choose a ${fieldName} from the place suggestions.`, 'INVALID_FLIGHT_PLACE');
  }
  if (AFRICAN_COUNTRY_CODES.has(countryCode)) {
    throw new ApiError(400, 'Flights to and from African countries are not available in this app.', 'AFRICA_ROUTE_NOT_ALLOWED');
  }
  return code;
}

export async function searchFlights(input = {}) {
  const origin = requireNonAfricanPlace(input.originCode, input.originCountryCode, 'departure place');
  const destination = requireNonAfricanPlace(input.destinationCode, input.destinationCountryCode, 'destination');
  if (origin === destination) throw new ApiError(400, 'Choose a different destination from your departure place.', 'SAME_FLIGHT_PLACE');

  const departureDate = input.departureDate;
  if (!validDate(departureDate) || departureDate < new Date().toISOString().slice(0, 10)) {
    throw new ApiError(400, 'Choose a valid departure date that is today or later.', 'INVALID_DEPARTURE_DATE');
  }

  const tripType = input.tripType === 'one-way' ? 'one-way' : 'round-trip';
  const slices = [{ origin, destination, departure_date: departureDate }];
  if (tripType === 'round-trip') {
    const returnDate = input.returnDate;
    if (!validDate(returnDate) || returnDate < departureDate) {
      throw new ApiError(400, 'Choose a valid return date on or after your departure date.', 'INVALID_RETURN_DATE');
    }
    slices.push({ origin: destination, destination: origin, departure_date: returnDate });
  }

  const adults = Number(input.adults);
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) {
    throw new ApiError(400, 'Choose between 1 and 9 adult passengers.', 'INVALID_PASSENGER_COUNT');
  }

  const cabinClass = ['economy', 'premium_economy', 'business', 'first'].includes(input.cabinClass)
    ? input.cabinClass
    : 'economy';
  const query = new URLSearchParams({ return_offers: 'true', supplier_timeout: '15000' });
  const offerRequest = await duffelRequest(`/air/offer_requests?${query}`, {
    method: 'POST',
    body: {
      data: {
        slices,
        passengers: Array.from({ length: adults }, () => ({ type: 'adult' })),
        cabin_class: cabinClass
      }
    }
  });

  if (offerRequest?.live_mode === true || (offerRequest?.offers || []).some(offer => offer.live_mode === true)) {
    throw new ApiError(502, 'Duffel returned live-mode data unexpectedly. Search stopped for safety.', 'DUFFEL_LIVE_MODE_BLOCKED');
  }
  return {
    mode: 'test',
    offerRequestId: offerRequest.id,
    offers: Array.isArray(offerRequest.offers) ? offerRequest.offers : [],
    search: { origin, destination, departureDate, returnDate: tripType === 'round-trip' ? input.returnDate : null, tripType, adults, cabinClass }
  };
}
