import { httpError } from './asyncHandler.js';

export const STORE_LOGO_TOO_BIG_MESSAGE = 'Logo até 250 KB (PNG, JPEG ou WebP).';
export const STORE_LOGO_INVALID_MESSAGE = 'Use PNG, JPEG, WebP ou um link https da logo.';
export const STORE_LOGO_MAX_CHARS = 350_000;

const DATA_URL = /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i;
const HTTPS_URL = /^https:\/\/[^\s]+$/i;

export function normalizeStoreLogo(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length > STORE_LOGO_MAX_CHARS) throw httpError(400, STORE_LOGO_TOO_BIG_MESSAGE);
  if (DATA_URL.test(raw) || HTTPS_URL.test(raw)) return raw;
  throw httpError(400, STORE_LOGO_INVALID_MESSAGE);
}
