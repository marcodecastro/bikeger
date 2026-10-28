import type { CatalogService, MpPixPayment, Product } from '../types';

export const POS_DRAFT_KEY = 'bikeger.pos.draft';

export type PosCartItem =
  | {
      key: string;
      kind: 'produto';
      product: Product;
      quantity: number;
      unitPrice: number;
    }
  | {
      key: string;
      kind: 'servico';
      serviceId?: string;
      name: string;
      quantity: number;
      unitPrice: number;
    };

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
  const item = value as Partial<PosCartItem> & { product?: Product };
  if (!Number.isInteger(item.quantity) || (item.quantity ?? 0) <= 0 || !Number.isInteger(item.unitPrice)) {
    return false;
  }
  if (item.kind === 'servico') {
    return Boolean(item.key && item.name && typeof item.name === 'string');
  }
  // legado: só produto sem kind
  if (!item.kind || item.kind === 'produto') {
    if (!isProduct(item.product)) return false;
    return true;
  }
  return false;
}

function normalizeCartItem(item: PosCartItem): PosCartItem {
  if (item.kind === 'servico') return item;
  return {
    key: item.key || `produto:${item.product._id}`,
    kind: 'produto',
    product: item.product,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  };
}

function integerOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? value : 0;
}

export function emptyPosDraft(): PosDraft {
  return { ...empty, cart: [] };
}

export function productCartKey(productId: string) {
  return `produto:${productId}`;
}

export function serviceCartKey(opts: { serviceId?: string; name: string; unitPrice: number }) {
  if (opts.serviceId) return `servico:${opts.serviceId}`;
  return `servico:avulso:${opts.name.trim().toLowerCase()}:${opts.unitPrice}`;
}

export function readPosDraft(): PosDraft | null {
  try {
    const raw = localStorage.getItem(POS_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PosDraft>;
    if (!Array.isArray(parsed.cart) || !parsed.cart.every(isCartItem)) return null;
    return {
      cart: parsed.cart.map((item) => normalizeCartItem(item as PosCartItem)),
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

export function salePayloadItems(cart: PosCartItem[]) {
  return cart.map((item) => {
    if (item.kind === 'servico') {
      return {
        kind: 'servico' as const,
        serviceId: item.serviceId || undefined,
        name: item.name,
        price: item.unitPrice,
        quantity: item.quantity,
      };
    }
    return {
      kind: 'produto' as const,
      product: item.product._id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    };
  });
}

export function catalogServiceLine(service: CatalogService, quantity = 1): PosCartItem {
  return {
    key: serviceCartKey({ serviceId: service._id, name: service.name, unitPrice: service.price }),
    kind: 'servico',
    serviceId: service._id,
    name: service.name,
    quantity,
    unitPrice: service.price,
  };
}
