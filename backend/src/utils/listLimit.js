export const DEFAULT_LIST_LIMIT = 200;
export const MAX_LIST_LIMIT = 300;

export function listLimit(value, fallback = DEFAULT_LIST_LIMIT) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, MAX_LIST_LIMIT);
}
