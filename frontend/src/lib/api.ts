const API = '/api';

export const REQUEST_TIMEOUT_MS = 60_000;
export const REQUEST_TIMEOUT_MESSAGE = 'A requisição demorou demais. Tente de novo.';

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('bikeger.token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isTimeoutError(error: unknown) {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  return name === 'AbortError' || name === 'TimeoutError';
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

function requestSignal(timeoutMs: number, userSignal?: AbortSignal | null) {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!userSignal) return timeout;
  return AbortSignal.any([timeout, userSignal]);
}

export async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, signal: userSignal, headers, ...rest } = options ?? {};

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...rest,
      signal: requestSignal(timeoutMs, userSignal),
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
        ...(headers as Record<string, string> | undefined),
      },
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error(REQUEST_TIMEOUT_MESSAGE);
    }
    throw error;
  }

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    window.dispatchEvent(new Event('bikeger:unauthorized'));
  }

  const data = (await res.json().catch(() => ({}))) as { message?: string } & T;

  if (!res.ok) {
    throw new Error(data.message || 'Erro na requisição');
  }

  return data;
}

export function get<T>(path: string) {
  return request<T>(path);
}

export function post<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

export function put<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
}

export function patch<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
}

export function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}
