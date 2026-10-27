import { afterEach, describe, expect, it } from 'vitest';
import { clearPosDraft, POS_DRAFT_KEY, readPosDraft, writePosDraft } from './posDraft';
import type { Product } from '../types';

const product: Product = {
  _id: 'p1',
  sku: 'COR-01',
  barcode: '789',
  name: 'Corrente SRAM',
  description: '',
  category: 'Transmissão',
  brand: 'SRAM',
  model: '',
  unit: 'UN',
  costPrice: 8000,
  salePrice: 15990,
  currentStock: 3,
  minStock: 1,
  location: '',
  active: true,
  images: [],
};

describe('rascunho do PDV', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('grava e lê o carrinho', () => {
    writePosDraft({
      cart: [{ product, quantity: 2, unitPrice: 15990 }],
      customerId: 'c1',
      customerLabel: 'Ana',
      discount: 100,
      method: 'dinheiro',
      cashReceived: 20000,
      pendingSaleId: '',
      pix: null,
    });
    const draft = readPosDraft();
    expect(draft?.cart[0]?.product.name).toBe('Corrente SRAM');
    expect(draft?.cart[0]?.quantity).toBe(2);
    expect(draft?.customerLabel).toBe('Ana');
  });

  it('ignora JSON inválido e limpa a chave', () => {
    localStorage.setItem(POS_DRAFT_KEY, '{nao-json');
    expect(readPosDraft()).toBeNull();
    clearPosDraft();
    expect(localStorage.getItem(POS_DRAFT_KEY)).toBeNull();
  });
});
