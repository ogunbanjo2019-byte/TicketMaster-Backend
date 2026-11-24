export class ApiError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;
  const status = Number(error.status || error.statusCode || 500);
  if (status >= 500) console.error('[TicketMaster API]', error);
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Something went wrong. Please try again.'
    : (error.message || 'Something went wrong. Please try again.');
  res.status(status >= 400 && status <= 599 ? status : 500).json({ error: message, code: error.code || 'INTERNAL_ERROR' });
}