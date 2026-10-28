import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPosDraft,
  POS_DRAFT_KEY,
  productCartKey,
  readPosDraft,
  salePayloadItems,
  writePosDraft,
} from './posDraft';
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
      cart: [
        { key: productCartKey(product._id), kind: 'produto', product, quantity: 2, unitPrice: 15990 },
        {
          key: 'servico:avulso:regulagem:4500',
          kind: 'servico',
          name: 'Regulagem',
          quantity: 1,
          unitPrice: 4500,
        },
      ],
      customerId: 'c1',
      customerLabel: 'Ana',
      discount: 100,
      method: 'dinheiro',
      cashReceived: 20000,
      pendingSaleId: '',
      pix: null,
    });
    const draft = readPosDraft();
    expect(draft?.cart[0]?.kind).toBe('produto');
    if (draft?.cart[0]?.kind === 'produto') expect(draft.cart[0].product.name).toBe('Corrente SRAM');
    expect(draft?.cart[0]?.quantity).toBe(2);
    expect(draft?.cart[1]?.kind).toBe('servico');
    expect(draft?.customerLabel).toBe('Ana');
    expect(salePayloadItems(draft!.cart)).toEqual([
      { kind: 'produto', product: 'p1', quantity: 2, unitPrice: 15990 },
      { kind: 'servico', serviceId: undefined, name: 'Regulagem', price: 4500, quantity: 1 },
    ]);
  });

  it('ignora JSON inválido e limpa a chave', () => {
    localStorage.setItem(POS_DRAFT_KEY, '{nao-json');
    expect(readPosDraft()).toBeNull();
    clearPosDraft();
    expect(localStorage.getItem(POS_DRAFT_KEY)).toBeNull();
  });
});
