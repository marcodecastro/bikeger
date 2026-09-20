import { isProduction, INTERNAL_ERROR_MESSAGE } from '../utils/security.js';
import { logError } from '../utils/logger.js';

const CLIENT_ERROR_NAMES = new Set(['CastError', 'ValidationError', 'BSONError', 'BSONTypeError']);

export function httpStatusFromError(err) {
  if (err?.status) return err.status;
  if (err?.name === 'VersionError') return 409;
  if (err?.code === 11000) return 409;
  if (CLIENT_ERROR_NAMES.has(err?.name)) return 400;
  return 500;
}

function publicMessageFromError(err, status) {
  if (status >= 500 && isProduction()) return INTERNAL_ERROR_MESSAGE;
  if (err?.name === 'CastError') return 'Identificador inválido';
  if (err?.name === 'ValidationError') {
    const first = err.errors && Object.values(err.errors)[0];
    return first?.message || 'Dados inválidos';
  }
  if (err?.name === 'VersionError') return 'O registro mudou em outra tela. Atualize e tente de novo.';
  if (err?.code === 11000) {
    if (err.keyPattern && Object.prototype.hasOwnProperty.call(err.keyPattern, 'document')) {
      return 'Já existe um cliente com este CPF';
    }
    if (err.keyPattern && Object.prototype.hasOwnProperty.call(err.keyPattern, 'barcode')) {
      return 'Já existe um produto com este código de barras';
    }
    return 'Registro duplicado';
  }
  return err?.message || INTERNAL_ERROR_MESSAGE;
}

export function errorHandler(err, req, res, _next) {
  const status = httpStatusFromError(err);
  const publicMessage = publicMessageFromError(err, status);

  if (status >= 500) {
    logError(err, req);
  }

  res.status(status).json({
    error: true,
    message: publicMessage,
    requestId: req?.id,
  });
}
