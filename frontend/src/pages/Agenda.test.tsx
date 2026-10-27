import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agenda } from './Agenda';

const get = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: vi.fn(),
}));

describe('Agenda', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('mostra o erro quando a semana não carrega', async () => {
    get.mockRejectedValue(new Error('Falha ao listar a agenda'));
    render(
      <MemoryRouter>
        <Agenda />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao listar a agenda');
    expect(screen.queryByText('Carregando agenda...')).not.toBeInTheDocument();
  });
});
