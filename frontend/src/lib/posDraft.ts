import type { MpPixPayment, Product } from '../types';

export const POS_DRAFT_KEY = 'bikeger.pos.draft';

export interface PosCartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export interface PosDraft {
  cart: PosCartItem[];
  customerId: string;
  customerLabel: string;
  discount: number;
  method: string;
  cashReceived: number;
  pendingSaleId: string;
  pix: MpPixPayment | null;
}

const empty: PosDraft = {
  cart: [],
  customerId: '',
  customerLabel: '',
  discount: 0,
  method: 'pix',
  cashReceived: 0,
  pendingSaleId: '',
  pix: null,
};

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false;
  const item = value as Product;
  return Boolean(item._id && item.name && Number.isInteger(item.salePrice));
}

function isCartItem(value: unknown): value is PosCartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as PosCartItem;
  return isProduct(item.product) && Number.isInteger(item.quantity) && item.quantity > 0 && Number.isInteger(item.unitPrice);
}

function integerOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? value : 0;
}

export function emptyPosDraft(): PosDraft {
  return { ...empty, cart: [] };
}

export function readPosDraft(): PosDraft | null {
  try {
    const raw = localStorage.getItem(POS_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PosDraft>;
    if (!Array.isArray(parsed.cart) || !parsed.cart.every(isCartItem)) return null;
    return {
      cart: parsed.cart,
      customerId: typeof parsed.customerId === 'string' ? parsed.customerId : '',
      customerLabel: typeof parsed.customerLabel === 'string' ? parsed.customerLabel : '',
      discount: integerOrZero(parsed.discount),
      method: typeof parsed.method === 'string' && parsed.method ? parsed.method : 'pix',
      cashReceived: integerOrZero(parsed.cashReceived),
      pendingSaleId: typeof parsed.pendingSaleId === 'string' ? parsed.pendingSaleId : '',
      pix: parsed.pix && typeof parsed.pix === 'object' ? parsed.pix : null,
    };
  } catch {
    return null;
  }
}

export function writePosDraft(draft: PosDraft) {
  localStorage.setItem(POS_DRAFT_KEY, JSON.stringify(draft));
}

export function clearPosDraft() {
  localStorage.removeItem(POS_DRAFT_KEY);
}

export function posDraftIsEmpty(draft: PosDraft) {
  return (
    draft.cart.length === 0 &&
    !draft.customerId &&
    !draft.discount &&
    !draft.cashReceived &&
    !draft.pendingSaleId &&
    !draft.pix
  );
}
