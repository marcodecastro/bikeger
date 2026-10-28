import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Audit } from './Audit';

const get = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
}));

describe('Auditoria', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    get.mockReset();
    get.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('filtra por ação e quem', async () => {
    render(<Audit />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    fireEvent.change(screen.getByLabelText('Ação'), { target: { value: 'cash.closed' } });
    fireEvent.change(screen.getByLabelText('Quem'), { target: { value: 'dono' } });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(get).toHaveBeenCalledWith(expect.stringContaining('action=cash.closed'));
    expect(get).toHaveBeenCalledWith(expect.stringContaining('q=dono'));
  });
});
