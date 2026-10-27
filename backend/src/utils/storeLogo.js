import { httpError } from './asyncHandler.js';

export const STORE_LOGO_TOO_BIG_MESSAGE = 'Logo até 250 KB (PNG, JPEG ou WebP).';
export const STORE_LOGO_INVALID_MESSAGE = 'Use PNG, JPEG, WebP ou um link https da logo.';
export const STORE_LOGO_MAX_CHARS = 350_000;

const DATA_URL = /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i;
const HTTPS_URL = /^https:\/\/[^\s]+$/i;

export function normalizeStoreLogo(value) {
  return normalizeImageValue(value, {
    tooBig: STORE_LOGO_TOO_BIG_MESSAGE,
    invalid: STORE_LOGO_INVALID_MESSAGE,
  });
}

export const PRODUCT_IMAGE_MAX = 4;
export const PRODUCT_IMAGE_INVALID_MESSAGE = 'Use PNG, JPEG, WebP ou um link https da foto.';
export const PRODUCT_IMAGE_TOO_BIG_MESSAGE = 'Cada foto até 250 KB (PNG, JPEG ou WebP).';
export const PRODUCT_IMAGES_TOO_MANY_MESSAGE = 'Até 4 fotos por peça.';

export function normalizeImageValue(value, { tooBig = STORE_LOGO_TOO_BIG_MESSAGE, invalid = STORE_LOGO_INVALID_MESSAGE } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length > STORE_LOGO_MAX_CHARS) throw httpError(400, tooBig);
  if (DATA_URL.test(raw) || HTTPS_URL.test(raw)) return raw;
  throw httpError(400, invalid);
}

export function normalizeProductImages(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw httpError(400, 'Informe as fotos como uma lista');
  if (value.length > PRODUCT_IMAGE_MAX) throw httpError(400, PRODUCT_IMAGES_TOO_MANY_MESSAGE);
  return value
    .map((item) =>
      normalizeImageValue(item, {
        tooBig: PRODUCT_IMAGE_TOO_BIG_MESSAGE,
        invalid: PRODUCT_IMAGE_INVALID_MESSAGE,
      }),
    )
    .filter(Boolean);
}
