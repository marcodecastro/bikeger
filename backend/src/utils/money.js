/**
 * Dinheiro no BikeGer é SEMPRE inteiro em centavos.
 * costPrice: 15990  →  R$ 159,90
 *
 * Nunca some, multiplique ou armazene reais com ponto flutuante.
 * A conversão para decimal só acontece na borda do Mercado Pago.
 */

export class MoneyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MoneyError';
    this.status = 400;
  }
}

export function assertCents(value, field = 'valor') {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isInteger(value)) {
    throw new MoneyError(
      `${field} deve ser um inteiro em centavos (ex.: 24990 para R$ 249,90). Recebido: ${value}`,
    );
  }
  return value;
}

export function addCents(...values) {
  return values.reduce((total, value) => total + assertCents(value), 0);
}

export function subtractCents(left, right) {
  return assertCents(left, 'minuendo') - assertCents(right, 'subtraendo');
}

export function multiplyCents(unitCents, quantity) {
  assertCents(unitCents, 'preço unitário');
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0) {
    throw new MoneyError('quantidade deve ser um inteiro não negativo');
  }
  return unitCents * quantity;
}

export function formatBRL(cents) {
  const safe = assertCents(cents);
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  return `${sign}R$ ${reais.toLocaleString('pt-BR')},${String(centavos).padStart(2, '0')}`;
}

export function parseBRLToCents(input) {
  if (typeof input === 'number') {
    if (!Number.isInteger(input)) {
      throw new MoneyError(
        'Não envie decimais. Use centavos inteiros ou texto no formato 159,90',
      );
    }
    return input;
  }

  const raw = String(input ?? '')
    .trim()
    .replace(/R\$\s?/gi, '');

  if (!raw) return 0;

  const negative = raw.startsWith('-');
  const unsigned = raw.replace(/^-/, '');

  let reaisPart;
  let centsPart = '00';

  if (unsigned.includes(',')) {
    const [reais, cents] = unsigned.split(',');
    reaisPart = reais.replace(/\./g, '');
    centsPart = (cents || '00').replace(/\D/g, '').padEnd(2, '0').slice(0, 2);
  } else if (/^\d+$/.test(unsigned.replace(/\./g, ''))) {
    const onlyDigits = unsigned.replace(/\./g, '');
    if (unsigned.includes('.')) {
      const [reais, cents] = unsigned.split('.');
      reaisPart = reais;
      centsPart = (cents || '00').replace(/\D/g, '').padEnd(2, '0').slice(0, 2);
    } else {
      reaisPart = onlyDigits;
    }
  } else {
    throw new MoneyError(`Valor monetário inválido: ${input}`);
  }

  if (!/^\d+$/.test(reaisPart) || !/^\d+$/.test(centsPart)) {
    throw new MoneyError(`Valor monetário inválido: ${input}`);
  }

  const cents = Number(reaisPart) * 100 + Number(centsPart);
  return negative ? -cents : cents;
}

/** Somente na borda da API do Mercado Pago. */
export function centsToMpAmount(cents) {
  assertCents(cents, 'valor Mercado Pago');
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return Number(`${cents < 0 ? '-' : ''}${whole}.${fraction}`);
}

/** Converte o decimal do Mercado Pago de volta para centavos. */
export function mpAmountToCents(amount) {
  const [reais, cents = '00'] = String(amount).split('.');
  return parseBRLToCents(`${reais},${cents.slice(0, 2).padEnd(2, '0')}`);
}
