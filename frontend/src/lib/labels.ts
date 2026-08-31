export const OS_STATUS: Record<string, string> = {
  aberta: 'Aberta',
  diagnostico: 'Diagnóstico',
  aguardando_pecas: 'Aguardando peças',
  em_servico: 'Em serviço',
  pronta: 'Pronta',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
};

export const OS_FLOW = [
  'aberta',
  'diagnostico',
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
  return Object.keys(OS_STATUS);
}

export const PAYMENT_METHODS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  mercado_pago: 'Mercado Pago',
};

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
