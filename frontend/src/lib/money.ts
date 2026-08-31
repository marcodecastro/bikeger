export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function assertCents(value: number, field = 'valor'): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isInteger(value)) {
    throw new MoneyError(
      `${field} deve ser um inteiro em centavos (ex.: 24990 para R$ 249,90).`,
    );
  }
  return value;
}

export function addCents(...values: number[]): number {
  return values.reduce((total, value) => total + assertCents(value), 0);
}

export function subtractCents(left: number, right: number): number {
  return assertCents(left, 'minuendo') - assertCents(right, 'subtraendo');
}

export function multiplyCents(unitCents: number, quantity: number): number {
  assertCents(unitCents, 'preço unitário');
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new MoneyError('quantidade deve ser um inteiro não negativo');
  }
  return unitCents * quantity;
}

export function formatBRL(cents: number): string {
  const safe = assertCents(cents);
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  return `${sign}R$ ${reais.toLocaleString('pt-BR')},${String(centavos).padStart(2, '0')}`;
}

export function parseBRLToCents(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isInteger(input)) {
      throw new MoneyError('Não use decimais. Informe 159,90 ou 15990 centavos.');
    }
    return input;
  }

  const raw = String(input ?? '')
    .trim()
    .replace(/R\$\s?/gi, '');

  if (!raw) return 0;

  const negative = raw.startsWith('-');
  const unsigned = raw.replace(/^-/, '');

  let reaisPart: string;
  let centsPart = '00';

  if (unsigned.includes(',')) {
    const [reais, cents] = unsigned.split(',');
    reaisPart = reais.replace(/\./g, '');
    centsPart = (cents || '00').replace(/\D/g, '').padEnd(2, '0').slice(0, 2);
  } else if (unsigned.includes('.')) {
    const [reais, cents] = unsigned.split('.');
    reaisPart = reais.replace(/\./g, '');
    centsPart = (cents || '00').replace(/\D/g, '').padEnd(2, '0').slice(0, 2);
  } else {
    reaisPart = unsigned.replace(/\D/g, '');
  }

  if (!reaisPart) return 0;

  const cents = Number(reaisPart) * 100 + Number(centsPart);
  return negative ? -cents : cents;
}
