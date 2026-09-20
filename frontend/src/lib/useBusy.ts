import { useCallback, useRef, useState } from 'react';

function isRetryableConflict(error: unknown) {
  if (!(error instanceof Error)) return false;
  const status = 'status' in error ? Number((error as { status?: number }).status) : 0;
  return status === 409 && /mudou em outra tela/i.test(error.message);
}

export function useBusy() {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  const run = useCallback(async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
    if (locked.current) return undefined;
    locked.current = true;
    setBusy(true);
    try {
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          return await work();
        } catch (error) {
          lastError = error;
          if (attempt === 0 && isRetryableConflict(error)) continue;
          throw error;
        }
      }
      throw lastError;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
