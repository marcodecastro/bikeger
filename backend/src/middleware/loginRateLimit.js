import { LoginAttempt } from '../models/LoginAttempt.js';
import {
  createMongoRateStore,
  createRateLimiter,
  envMaxAttempts,
  envWindowMs,
} from '../utils/rateLimit.js';

export const LOGIN_RATE_MESSAGE =
  'Muitas tentativas de login. Espere alguns minutos e tente de novo.';

export const loginRateLimit = createRateLimiter({
  windowMs: envWindowMs(),
  max: envMaxAttempts(),
  message: LOGIN_RATE_MESSAGE,
  store: createMongoRateStore(LoginAttempt),
});
