export const MAX_SEARCH_LENGTH = 80;

export function escapeRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function searchRegex(q) {
  const raw = Array.isArray(q) ? q[0] : q;
  const trimmed = String(raw ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
  if (!trimmed) return null;
  return new RegExp(escapeRegex(trimmed), 'i');
}
