import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request, REQUEST_TIMEOUT_MESSAGE } from './api';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('request', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ok: true })),
    );
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolve o JSON quando a API responde', async () => {
    await expect(request<{ ok: boolean }>('/health')).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/health$/),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('propaga a mensagem de 409 da API', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: 'Nenhum caixa aberto. Abra o caixa para registrar este movimento.' }, 409),
    );
    await expect(request('/sales', { method: 'POST' })).rejects.toThrow(/Nenhum caixa aberto/);
  });

  it('aborta quando o servidor não responde a tempo', async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          if (signal.aborted) {
            reject(signal.reason);
            return;
          }
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );

    await expect(request('/sales', { timeoutMs: 40 })).rejects.toThrow(REQUEST_TIMEOUT_MESSAGE);
  });
});
