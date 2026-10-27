import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Customers } from './Customers';

const get = vi.fn();
const can = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  post: vi.fn(),
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ can }),
}));

describe('Clientes', () => {
  beforeEach(() => {
    get.mockReset();
    can.mockReset();
    can.mockReturnValue(true);
    get.mockResolvedValue([
      { _id: 'c1', name: 'Ana Souza', phone: '11', document: '123', email: '' },
    ]);
  });

  it('oferece Editar na ficha do cliente', async () => {
    render(
      <MemoryRouter>
        <Customers />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/clientes/c1');
    expect(screen.getByRole('link', { name: 'Ana Souza' })).toHaveAttribute('href', '/clientes/c1');
    expect(screen.queryByRole('link', { name: 'Ficha' })).not.toBeInTheDocument();
  });

  it('mostra o erro quando a lista não carrega', async () => {
    get.mockRejectedValue(new Error('Falha ao listar clientes'));
    render(
      <MemoryRouter>
        <Customers />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao listar clientes');
  });
});
