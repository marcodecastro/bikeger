import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { useBusy } from './useBusy';

describe('useBusy', () => {
  it('ignora a segunda chamada enquanto a primeira não termina', async () => {
    const { result } = renderHook(() => useBusy());
    let resolveFirst!: () => void;
    const firstWork = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    let ran = 0;
    let first!: Promise<number | undefined>;
    let second!: Promise<number | undefined>;

    await act(async () => {
      first = result.current.run(async () => {
        ran += 1;
        await firstWork;
        return 1;
      });
      second = result.current.run(async () => {
        ran += 1;
        return 2;
      });
    });

    expect(result.current.busy).toBe(true);
    expect(await second).toBeUndefined();

    await act(async () => {
      resolveFirst();
      await first;
    });

    expect(ran).toBe(1);
    expect(await first).toBe(1);
    expect(result.current.busy).toBe(false);
  });

  it('repete uma vez se a OS mudou em outra tela', async () => {
    const { result } = renderHook(() => useBusy());
    const conflict = new ApiError('A OS mudou em outra tela. Atualize e tente de novo.', 409);
    let attempts = 0;

    let done!: Promise<string | undefined>;
    await act(async () => {
      done = result.current.run(async () => {
        attempts += 1;
        if (attempts === 1) throw conflict;
        return 'ok';
      });
    });

    await expect(done).resolves.toBe('ok');
    expect(attempts).toBe(2);
  });
});
