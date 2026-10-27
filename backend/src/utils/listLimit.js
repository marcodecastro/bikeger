export const DEFAULT_LIST_LIMIT = 200;
export const MAX_LIST_LIMIT = 300;
export const MAX_LIST_SKIP = 10_000;

export function listLimit(value, fallback = DEFAULT_LIST_LIMIT) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, MAX_LIST_LIMIT);
}

export function listSkip(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, MAX_LIST_SKIP);
}
