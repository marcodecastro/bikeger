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
  stockStatus?: 'orcamento' | 'reservada' | 'consumida';
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
  partsWaitingSince?: string | null;
}

export interface CashMovement {
  _id?: string;
  registerId?: string;
  type: string;
  method?: string;
  amount: number;
  notes: string;
  createdAt: string;
  operator?: string;
}

export interface DayReport {
  registerId: string;
  openedAt: string;
  closedAt?: string | null;
  operator: string;
  openingAmount: number;
  countedCash: number;
  expectedCash: number;
  difference: number;
  byMethod: Record<string, number>;
  receivedTotal: number;
  sangria: number;
  suprimento: number;
  osTotal: number;
  osCount: number;
  estorno: number;
  fiscalEnabled: boolean;
  nfcePending: number;
  notes?: string;
  receipt?: Receipt;
  dayReport?: Receipt;
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
  dayReport?: Receipt;
  day?: DayReport;
}

export interface Settings {
  storeName: string;
  storeLogo?: string;
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
  openedNoticeTemplate?: string;
  paidNoticeTemplate?: string;
  quoteNoticeTemplate?: string;
  waitingPartsDays?: number;
  whatsappToken?: string;
  whatsappPhoneNumberId?: string;
  hasWhatsAppCloud?: boolean;
  whatsappFromEnv?: boolean;
  secretsFromEnv?: boolean;
}

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
  kind: 'archive' | 'dump-dir';
}

export interface BackupStatus {
  source: 'localhost' | 'cloud' | 'mongo';
  ephemeral: boolean;
  cloudUpload: boolean;
  retentionDays: number;
  backups: BackupFile[];
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
    logo?: string;
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
  kind?: 'os_pronta' | 'os_aberta' | 'os_paga' | 'os_orcamento';
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
  openOrderCount?: number;
  workshop: Record<string, number>;
  register: CashRegister | null;
  recentSales: Sale[];
  recentOrders: WorkOrder[];
  marginByCategory?: CategoryMargin[];
  monthMarginByCategory?: CategoryMargin[];
  pendingNotices?: ReadyNotice[];
  pendingApplyCount?: number;
  waitingParts?: WorkOrder[];
  waitingPartsDays?: number;
}

export interface SearchResults {
  products: Product[];
  customers: Customer[];
  orders: WorkOrder[];
  sales: Sale[];
  bikes: Bike[];
}

export interface PurchaseItem {
  _id?: string;
  product: string;
  sku: string;
  name: string;
  quantity: number;
  unitCost?: number;
  total: number;
}

export interface Purchase {
  _id: string;
  number: string;
  supplier: Supplier | string;
  status: string;
  notes: string;
  items: PurchaseItem[];
  itemsTotal: number;
  operator?: string;
  receivedAt?: string;
  createdAt: string;
}

export interface InventoryItem {
  _id?: string;
  product: string;
  sku: string;
  name: string;
  barcode?: string;
  systemQty: number;
  countedQty: number;
}

export interface InventoryCount {
  _id: string;
  number: string;
  status: 'aberta' | 'aplicada' | 'cancelada';
  notes?: string;
  items: InventoryItem[];
  operator?: string;
  appliedAt?: string | null;
  createdAt: string;
}

export interface MonthReport {
  year: number;
  month: number;
  from: string;
  to: string;
  sales: { count: number; revenue: number; cost: number; margin: number };
  workshop: {
    opened: number;
    delivered: number;
    revenue: number;
    openNow: number;
    byStatus: Record<string, number>;
  };
  stock: { skuCount: number; units: number; value: number; outQty: number; giro: number };
  purchases: { count: number; total: number };
}

export interface ShelfLabel {
  kind: string;
  width: number;
  height: number;
  text: string;
  escposBase64: string;
  labels: {
    productId: string;
    sku: string;
    name: string;
    barcode: string;
    price: number;
    text: string;
  }[];
  store: Receipt['store'];
}

export interface AuditEvent {
  _id: string;
  action: string;
  actorLogin: string;
  targetLogin?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
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
  salesCount: number;
  ordersCount: number;
  salesHasMore: boolean;
  ordersHasMore: boolean;
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
