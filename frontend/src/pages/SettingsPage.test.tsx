import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

const get = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  put: vi.fn(),
}));

describe('Ajustes', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('mostra o erro quando os ajustes não carregam', async () => {
    get.mockRejectedValue(new Error('Não autenticado'));
    render(<SettingsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Não autenticado');
    expect(screen.queryByText('Carregando ajustes...')).not.toBeInTheDocument();
  });
});
