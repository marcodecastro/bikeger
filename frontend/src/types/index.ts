export interface Supplier {
  _id: string;
  name: string;
  tradeName?: string;
  document?: string;
  phone?: string;
  email?: string;
  city?: string;
  notes?: string;
  active: boolean;
}

export interface Product {
  _id: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  unit: string;
  costPrice?: number;
  salePrice: number;
  currentStock: number;
  reservedStock?: number;
  availableStock?: number;
  minStock: number;
  ncm?: string;
  cfop?: string;
  icmsOrigin?: string;
  icmsCst?: string;
  location: string;
  supplier?: Supplier | string | null;
  active: boolean;
  images: string[];
}

export interface StockMovement {
  _id: string;
  product: Product | string;
  sku: string;
  name: string;
  type: string;
  direction: 'entrada' | 'saida';
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost?: number;
  unitPrice: number;
  notes: string;
  createdAt: string;
}

export interface Customer {
  _id: string;
  name: string;
  phone: string;
  email: string;
  document: string;
  address?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  notes?: string;
  active: boolean;
}

export interface Bike {
  _id: string;
  customer: Customer | string;
  brand: string;
  model: string;
  year?: number | null;
  color: string;
  serialNumber: string;
  frameSize: string;
  type: string;
  notes: string;
  photoUrl?: string;
}

export interface CatalogService {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  estimatedMinutes: number;
  active: boolean;
}

export interface SaleItem {
  _id?: string;
  product: string;
  sku: string;
  name: string;
  quantity: number;
  unitCost?: number;
  unitPrice: number;
  total: number;
  returnedQuantity?: number;
}

export interface PaymentItem {
  _id?: string;
  method: string;
  amount: number;
  status: string;
  mercadoPagoId?: string;
}

export interface Sale {
  _id: string;
  number: string;
  customer?: Customer | null;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  payments: PaymentItem[];
  paidAmount: number;
  cashReceived: number;
  change: number;
  status: 'aberta' | 'paga' | 'cancelada' | 'devolvida';
  notes?: string;
  createdAt: string;
  returns?: {
    items: { name: string; quantity: number; total: number }[];
    amount: number;
    reason: string;
    method: string;
    createdAt?: string;
  }[];
}

export interface WorkOrderPart {
  _id: string;
  product: string;
  sku: string;
  name: string;
  quantity: number;
  unitCost?: number;
  unitPrice: number;
  total: number;
  stockStatus?: 'reservada' | 'consumida';
}

export interface WorkOrderService {
  _id: string;
  service?: string | null;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface WorkOrder {
  _id: string;
  number: string;
  customer: Customer;
  bike: Bike;
  status: string;
  complaint: string;
  diagnosis: string;
  mechanic: string;
  services: WorkOrderService[];
  parts: WorkOrderPart[];
  laborTotal: number;
  partsTotal: number;
  discount: number;
  total: number;
  payments: PaymentItem[];
  paidAmount: number;
  notes: string;
  createdAt: string;
  deliveredAt?: string | null;
  readyAt?: string | null;
  scheduledAt?: string | null;
  scheduleKind?: 'diagnostico' | 'servico' | 'retirada';
  readyNotifiedAt?: string | null;
}

export interface CashMovement {
  type: string;
  method?: string;
  amount: number;
  notes: string;
  createdAt: string;
}

export interface CashSummary {
  byMethod: Record<string, number>;
  expectedCash: number;
  receivedTotal: number;
  openingAmount: number;
}

export interface CashRegister {
  _id: string;
  openedAt: string;
  closedAt?: string | null;
  openingAmount: number;
  countedCash: number;
  expectedCash: number;
  difference: number;
  status: 'aberto' | 'fechado';
  movements: CashMovement[];
  operator: string;
  summary?: CashSummary;
}

export interface Settings {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  storeCnpj: string;
  receiptFooter: string;
  printerWidth: number;
  mpAccessToken?: string;
  mpPublicKey?: string;
  hasMpToken?: boolean;
  hasFocusNfe?: boolean;
  focusNfeToken?: string;
  tokenFromEnv?: boolean;
  fiscalReady?: boolean;
  fiscalMissing?: string[];
  mechanicNames: string[];
  fiscalEnabled?: boolean;
  stateRegistration?: string;
  fiscalSeries?: string;
  fiscalEnvironment?: 'homologacao' | 'producao';
  storeStreet?: string;
  storeNumber?: string;
  storeNeighborhood?: string;
  storeCity?: string;
  storeState?: string;
  storeZip?: string;
  taxRegime?: string;
  fiscalCscId?: string;
  fiscalCscToken?: string;
  defaultNcm?: string;
  defaultCfop?: string;
  defaultIcmsCst?: string;
  hasCsc?: boolean;
  readyNoticeTemplate?: string;
  whatsappToken?: string;
  whatsappPhoneNumberId?: string;
  hasWhatsAppCloud?: boolean;
  whatsappFromEnv?: boolean;
}

export interface FiscalDocument {
  _id: string;
  relatedType: string;
  relatedId: string;
  kind: string;
  status: string;
  amount: number;
  number?: string;
  accessKey?: string;
  errorMessage?: string;
  provider?: string;
  danfeUrl?: string;
  qrcodeUrl?: string;
  sefazStatus?: string;
  protocol?: string;
}

export interface Receipt {
  text: string;
  escposBase64: string;
  width: number;
  store: {
    name: string;
    phone: string;
    address: string;
    cnpj: string;
  };
}

export interface CategoryMargin {
  category: string;
  revenue: number;
  cost: number;
  profit: number;
  quantity: number;
}

export interface ReadyNotice {
  _id: string;
  status: string;
  message: string;
  waUrl?: string;
  phone?: string;
  provider?: 'wa.me' | 'cloud';
  errorMessage?: string;
  workOrder?: WorkOrder;
  customer?: Customer | null;
}

export interface AgendaDay {
  date: string;
  key: string;
  items: WorkOrder[];
}

export interface AgendaData {
  from: string;
  to: string;
  days: AgendaDay[];
  unscheduledReady: WorkOrder[];
}

export interface DashboardData {
  today: { salesCount: number; revenue: number; estimatedProfit: number };
  customers: number;
  lowStock: Product[];
  openOrders: WorkOrder[];
  workshop: Record<string, number>;
  register: CashRegister | null;
  recentSales: Sale[];
  recentOrders: WorkOrder[];
  marginByCategory?: CategoryMargin[];
  monthMarginByCategory?: CategoryMargin[];
  pendingNotices?: ReadyNotice[];
}

export interface SearchResults {
  products: Product[];
  customers: Customer[];
  orders: WorkOrder[];
  sales: Sale[];
  bikes: Bike[];
}

export interface MpPixPayment {
  _id: string;
  status: string;
  amount: number;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  paymentId: string;
}

export interface CustomerHistory {
  customer: Customer;
  bikes: Bike[];
  sales: Sale[];
  orders: WorkOrder[];
  lifetimeValue: number;
  salesTotal: number;
  ordersTotal: number;
  visitCount: number;
}

export interface BikeHistory {
  bike: Bike;
  orders: WorkOrder[];
  partsReplaced: {
    date: string;
    workOrder: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
  timeline: {
    id: string;
    number: string;
    status: string;
    date: string;
    complaint: string;
    diagnosis: string;
    mechanic: string;
    services: string[];
    parts: string[];
    total: number;
  }[];
  openOrders: number;
}
