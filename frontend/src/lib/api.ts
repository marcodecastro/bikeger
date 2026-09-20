export const REQUEST_TIMEOUT_MS = 60_000;
export const REQUEST_TIMEOUT_MESSAGE = 'A requisição demorou demais. Tente de novo.';
export const OS_CONFLICT_RE = /mudou em outra tela/i;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isRetryableConflict(error: unknown) {
  if (!(error instanceof Error)) return false;
  const status = error instanceof ApiError ? error.status : 0;
  return status === 409 && OS_CONFLICT_RE.test(error.message);
}

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

export function apiBase() {
  const origin = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (!origin) return '/api';
  return origin.endsWith('/api') ? origin : `${origin}/api`;
}

export async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, signal: userSignal, headers, ...rest } = options ?? {};

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
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
    throw new ApiError(data.message || 'Erro na requisição', res.status);
  }

  return data;
}

export function get<T>(path: string) {
  return request<T>(path);
}

export function post<T>(path: string, body?: unknown, options?: RequestOptions) {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, ...options });
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

export const BACKUP_TIMEOUT_MS = 120_000;

export async function downloadFile(path: string, filename: string) {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      headers: authHeader(),
      signal: requestSignal(BACKUP_TIMEOUT_MS),
    });
  } catch (error) {
    if (isTimeoutError(error)) throw new Error(REQUEST_TIMEOUT_MESSAGE);
    throw error;
  }

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    window.dispatchEvent(new Event('bikeger:unauthorized'));
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(data.message || 'Falha ao baixar o arquivo', res.status);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function postBackupUpload<T>(file: File, confirm: string) {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/backups/restore-upload`, {
      method: 'POST',
      headers: {
        ...authHeader(),
        'Content-Type': file.type || 'application/gzip',
        'X-Backup-Confirm': confirm,
      },
      body: file,
      signal: requestSignal(BACKUP_TIMEOUT_MS),
    });
  } catch (error) {
    if (isTimeoutError(error)) throw new Error(REQUEST_TIMEOUT_MESSAGE);
    throw error;
  }

  if (res.status === 401) {
    window.dispatchEvent(new Event('bikeger:unauthorized'));
  }

  const data = (await res.json().catch(() => ({}))) as { message?: string } & T;
  if (!res.ok) {
    throw new ApiError(data.message || 'Falha ao restaurar o backup', res.status);
  }
  return data;
}
