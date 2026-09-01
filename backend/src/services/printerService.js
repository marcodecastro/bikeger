import { formatBRL } from '../utils/money.js';
import { getSettings } from '../models/Settings.js';

const ESC = '\x1B';
const GS = '\x1D';

function line(width, left, right = '') {
  const space = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(space)}${right}`;
}

function dashed(width) {
  return '-'.repeat(width);
}

function wrap(text, width) {
  const words = String(text).split(/\s+/);
  const rows = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > width) {
      if (current) rows.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) rows.push(current);
  return rows;
}

export async function buildReceipt({ kind, number, customerName, items, totals, payments, extraLines = [] }) {
  const settings = await getSettings();
  const width = settings.printerWidth === 58 ? 32 : 42;

  const rows = [];
  rows.push(settings.storeName);
  if (settings.storeAddress) rows.push(...wrap(settings.storeAddress, width));
  if (settings.storePhone) rows.push(settings.storePhone);
  if (settings.storeCnpj) rows.push(`CNPJ ${settings.storeCnpj}`);
  rows.push(dashed(width));
  rows.push(kind === 'os' ? `ORDEM DE SERVICO ${number}` : `CUPOM DE VENDA ${number}`);
  rows.push(new Date().toLocaleString('pt-BR'));
  if (customerName) rows.push(`Cliente: ${customerName}`);
  rows.push(dashed(width));

  for (const item of items) {
    rows.push(`${item.quantity}x ${item.name}`);
    rows.push(line(width, `  ${formatBRL(item.unitPrice)}`, formatBRL(item.total)));
  }

  rows.push(dashed(width));
  if (totals.laborTotal !== undefined) {
    rows.push(line(width, 'Servicos', formatBRL(totals.laborTotal)));
    rows.push(line(width, 'Pecas', formatBRL(totals.partsTotal)));
  }
  rows.push(line(width, 'Subtotal', formatBRL(totals.subtotal ?? totals.total)));
  if (totals.discount) rows.push(line(width, 'Desconto', formatBRL(totals.discount)));
  rows.push(line(width, 'TOTAL', formatBRL(totals.total)));
  rows.push(dashed(width));

  for (const payment of payments || []) {
    rows.push(line(width, payment.method, formatBRL(payment.amount)));
  }

  for (const extra of extraLines) {
    rows.push(...wrap(extra, width));
  }

  rows.push('');
  rows.push(...wrap(settings.receiptFooter, width));
  rows.push('');
  rows.push('BikeGer — loja + oficina');
  rows.push('');

  const text = rows.join('\n');
  const escpos =
    ESC +
    '@' +
    ESC +
    'a' +
    '\x01' +
    text
      .split('\n')
      .map((row, index) => (index < 3 ? row : ESC + 'a' + '\x00' + row))
      .join('\n') +
    '\n\n\n' +
    GS +
    'V' +
    '\x00';

  return {
    text,
    escposBase64: Buffer.from(escpos, 'binary').toString('base64'),
    width: settings.printerWidth,
    store: {
      name: settings.storeName,
      phone: settings.storePhone,
      address: settings.storeAddress,
      cnpj: settings.storeCnpj,
    },
  };
}
