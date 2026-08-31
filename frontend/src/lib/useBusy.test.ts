import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
