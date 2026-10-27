export const OS_STATUS: Record<string, string> = {
  aberta: 'Aberta',
  diagnostico: 'Diagnóstico',
  orcamento: 'Orçamento',
  aguardando_pecas: 'Aguardando peças',
  em_servico: 'Em serviço',
  pronta: 'Pronta',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
};

export const OS_FLOW = [
  'aberta',
  'diagnostico',
  'orcamento',
  'aguardando_pecas',
  'em_servico',
  'pronta',
  'entregue',
];

export const OS_KANBAN = [...OS_FLOW.filter((status) => status !== 'entregue'), 'cancelada'];

export const OS_TERMINAL = ['entregue', 'cancelada'] as const;

export function isOsTerminal(status: string) {
  return (OS_TERMINAL as readonly string[]).includes(status);
}

export function allowedOsStatuses(from: string) {
  if (isOsTerminal(from)) return [from];
  const open = OS_FLOW.filter((status) => status !== 'entregue');
  if (from === 'pronta') return [...open, 'cancelada', 'entregue'];
  return [...open, 'cancelada'];
}

export const SALE_STATUS: Record<string, string> = {
  aberta: 'Aberta',
  paga: 'Paga',
  cancelada: 'Cancelada',
  devolvida: 'Devolvida',
};

export const STOCK_TYPES: Record<string, string> = {
  compra: 'Compra',
  ajuste: 'Ajuste',
  venda: 'Venda',
  venda_cancelada: 'Venda cancelada',
  os: 'OS',
  os_estorno: 'OS estorno',
  devolucao: 'Devolução',
  reserva: 'Reserva',
  reserva_liberada: 'Reserva liberada',
};

export const INVENTORY_STATUS: Record<string, string> = {
  aberta: 'Aberta',
  aplicada: 'Aplicada',
  cancelada: 'Cancelada',
};

export const PAYMENT_METHODS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  mercado_pago: 'Mercado Pago',
};

/** Dinheiro e cartão caem na hora. PIX/MP só pelo gateway. */
export const COUNTER_PAYMENT_METHODS = ['dinheiro', 'cartao_credito', 'cartao_debito'] as const;

export const BIKE_TYPES: Record<string, string> = {
  mtb: 'MTB',
  speed: 'Speed',
  urbana: 'Urbana',
  eletrica: 'Elétrica',
  infantil: 'Infantil',
  gravel: 'Gravel',
  bmx: 'BMX',
  outra: 'Outra',
};

export const CATEGORIES = [
  'Transmissão',
  'Freios',
  'Pneus',
  'Rodas',
  'Suspensão',
  'Pedivela',
  'Guidão',
  'Selim',
  'Acessórios',
  'Lubrificantes',
  'Ferramentas',
  'Segurança',
  'Vestuário',
];

export const UNITS = ['UN', 'PAR', 'KIT', 'M', 'L'];

export const BRAZIL_UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;
