export const FETCH_TIMEOUT_MESSAGE = 'A requisição demorou demais. Tente de novo.';

export const DEFAULT_HTTP_TIMEOUT_MS = 20_000;
export const DEFAULT_FISCAL_TIMEOUT_MS = 45_000;
export const DEFAULT_WHATSAPP_TIMEOUT_MS = 15_000;

function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function httpTimeoutMs() {
  return positiveInt(process.env.HTTP_TIMEOUT_MS, DEFAULT_HTTP_TIMEOUT_MS);
}

export function fiscalTimeoutMs() {
  return positiveInt(process.env.FOCUS_NFE_TIMEOUT_MS, DEFAULT_FISCAL_TIMEOUT_MS);
}

export function whatsappTimeoutMs() {
  return positiveInt(process.env.WHATSAPP_TIMEOUT_MS, DEFAULT_WHATSAPP_TIMEOUT_MS);
}

function isAbortLike(error) {
  return error?.name === 'TimeoutError' || error?.name === 'AbortError';
}

export async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = httpTimeoutMs(),
  fetchImpl = fetch,
) {
  const ms = Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : httpTimeoutMs();
  const timeout = AbortSignal.timeout(ms);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  const { signal: _ignored, ...rest } = options;

  try {
    return await fetchImpl(url, { ...rest, signal });
  } catch (error) {
    if (isAbortLike(error)) {
      throw new Error(FETCH_TIMEOUT_MESSAGE, { cause: error });
    }
    throw error;
  }
}
