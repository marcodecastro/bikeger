export const LIST_PAGE = 50;

export function pagedPath(path: string, skip: number, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  params.set('limit', String(LIST_PAGE));
  params.set('skip', String(skip));
  return `${path}?${params.toString()}`;
}

export function pageHasMore(list: unknown[]) {
  return list.length === LIST_PAGE;
}

export function dayStartIso(date: string) {
  if (!date) return '';
  return new Date(`${date}T00:00:00`).toISOString();
}

export function dayEndIso(date: string) {
  if (!date) return '';
  return new Date(`${date}T23:59:59.999`).toISOString();
}
