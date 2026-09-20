import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BikeDetail } from './BikeDetail';
import type { BikeHistory } from '../types';

const get = vi.fn();
const put = vi.fn();

vi.mock('../lib/api', () => ({
  get: (...args: unknown[]) => get(...args),
  put: (...args: unknown[]) => put(...args),
}));

const history: BikeHistory = {
  bike: {
    _id: 'bike-1',
    customer: { _id: 'c1', name: 'Ana', phone: '11', email: '', document: '', notes: '', active: true },
    brand: 'Caloi',
    model: '10',
    color: 'azul',
    serialNumber: 'SN-1',
    frameSize: 'M',
    type: 'urbana',
    notes: '',
  },
  orders: [],
  partsReplaced: [],
  timeline: [],
  openOrders: 0,
};

describe('Ficha da bike', () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
    get.mockResolvedValue(history);
    put.mockResolvedValue({ ...history.bike, serialNumber: 'SN-99', color: 'verde', frameSize: 'L' });
  });

  it('salva série, cor e tamanho', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/bikes/bike-1']}>
        <Routes>
          <Route path="/bikes/:id" element={<BikeDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue('SN-1')).toBeInTheDocument();
    await user.clear(screen.getByDisplayValue('SN-1'));
    await user.type(screen.getByPlaceholderText('Número de série'), 'SN-99');
    await user.click(screen.getByRole('button', { name: 'Salvar ficha' }));
    expect(put).toHaveBeenCalledWith(
      '/bikes/bike-1',
      expect.objectContaining({ serialNumber: 'SN-99' }),
    );
  });
});
