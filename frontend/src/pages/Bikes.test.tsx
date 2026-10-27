import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Bikes } from './Bikes';

const get = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: vi.fn(),
}));

describe('Bicicletas', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue([
      {
        _id: 'bike-1',
        brand: 'Caloi',
        model: '10',
        type: 'urbana',
        serialNumber: 'SN-1',
        customer: { name: 'Ana Ribeiro' },
      },
    ]);
  });

  it('oferece Editar na ficha da bike', async () => {
    render(
      <MemoryRouter>
        <Bikes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/bikes/bike-1');
    expect(screen.getByRole('link', { name: 'Caloi 10' })).toHaveAttribute('href', '/bikes/bike-1');
    expect(screen.queryByRole('link', { name: 'Histórico' })).not.toBeInTheDocument();
  });

  it('mostra o erro quando a lista não carrega', async () => {
    get.mockRejectedValue(new Error('Falha ao listar bikes'));
    render(
      <MemoryRouter>
        <Bikes />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao listar bikes');
  });
});
