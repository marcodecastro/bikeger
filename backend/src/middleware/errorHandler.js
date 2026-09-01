import { isProduction, INTERNAL_ERROR_MESSAGE } from '../utils/security.js';

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  const publicMessage =
    status >= 500 && isProduction() ? INTERNAL_ERROR_MESSAGE : err.message || INTERNAL_ERROR_MESSAGE;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: true,
    message: publicMessage,
  });
}
