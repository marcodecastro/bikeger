import { useCallback, useRef, useState } from 'react';

export function useBusy() {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  const run = useCallback(async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
    if (locked.current) return undefined;
    locked.current = true;
    setBusy(true);
    try {
      return await work();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
