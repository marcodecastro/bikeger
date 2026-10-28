import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReceiptModal } from './ReceiptModal';
import type { ShelfLabel } from '../types';

const label: ShelfLabel = {
  kind: 'label-40x30',
  width: 40,
  height: 30,
  text: 'Corrente',
  escposBase64: btoa('x'),
  labels: [
    {
      productId: 'p1',
      sku: 'COR-01',
      name: 'Corrente SRAM',
      barcode: '789',
      price: 9000,
      image: 'https://cdn.example/peca.webp',
      text: 'Corrente SRAM',
    },
  ],
  store: { name: 'BikeGer', phone: '', address: '', cnpj: '', logo: '' },
};

describe('Etiqueta 40×30', () => {
  it('mostra a foto da peça na plaquinha', () => {
    render(<ReceiptModal receipt={label} onClose={() => undefined} title="Etiqueta 40×30" />);
    expect(screen.getByRole('img', { name: 'Corrente SRAM' })).toHaveAttribute(
      'src',
      'https://cdn.example/peca.webp',
    );
  });
});
