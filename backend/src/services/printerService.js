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
  rows.push('notemaster');
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
      logo: settings.storeLogo || '',
    },
  };
}

export async function buildDayReportReceipt(day) {
  const settings = await getSettings();
  const width = settings.printerWidth === 58 ? 32 : 42;
  const card = addMethod(day.byMethod?.cartao_credito, day.byMethod?.cartao_debito);
  const difference = day.difference || 0;
  const differenceLabel =
    difference === 0 ? 'bateu' : difference > 0 ? 'sobrou no gaveteiro' : 'faltou no gaveteiro';

  const rows = [];
  rows.push(settings.storeName);
  if (settings.storeAddress) rows.push(...wrap(settings.storeAddress, width));
  rows.push(dashed(width));
  rows.push('RELATORIO DO DIA');
  rows.push(new Date(day.closedAt || Date.now()).toLocaleString('pt-BR'));
  if (day.operator) rows.push(`Operador: ${day.operator}`);
  rows.push(dashed(width));
  rows.push(line(width, 'Fundo', formatBRL(day.openingAmount || 0)));
  rows.push(line(width, 'Dinheiro contado', formatBRL(day.countedCash || 0)));
  rows.push(line(width, 'Gaveteiro esperado', formatBRL(day.expectedCash || 0)));
  rows.push(line(width, 'Diferenca', formatBRL(difference)));
  rows.push(differenceLabel);
  rows.push(dashed(width));
  rows.push(line(width, 'PIX', formatBRL(day.byMethod?.pix || 0)));
  rows.push(line(width, 'Cartao', formatBRL(card)));
  rows.push(line(width, 'Dinheiro recebido', formatBRL(day.byMethod?.dinheiro || 0)));
  rows.push(line(width, 'Mercado Pago', formatBRL(day.byMethod?.mercado_pago || 0)));
  rows.push(line(width, 'Sangria', formatBRL(day.sangria || 0)));
  rows.push(line(width, 'Suprimento', formatBRL(day.suprimento || 0)));
  rows.push(line(width, `OS (${day.osCount || 0})`, formatBRL(day.osTotal || 0)));
  if (day.estorno) rows.push(line(width, 'Estorno', formatBRL(day.estorno)));
  rows.push(dashed(width));
  if (day.fiscalEnabled) {
    rows.push(`NFC-e pendente: ${day.nfcePending || 0}`);
  } else {
    rows.push('NFC-e desligada (opcional)');
  }
  if (day.notes) {
    rows.push(dashed(width));
    rows.push(...wrap(day.notes, width));
  }
  rows.push('');
  rows.push('BikeGer — fechamento');
  rows.push('notemaster');
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
      logo: settings.storeLogo || '',
    },
  };
}

export async function buildShelfLabels(products) {
  const settings = await getSettings();
  const labels = (products || []).map((product) => {
    const name = String(product.name || '').trim();
    const sku = String(product.sku || '').trim();
    const barcode = String(product.barcode || sku).trim();
    const rows = [
      settings.storeName,
      ...wrap(name, 24).slice(0, 2),
      sku,
      formatBRL(product.salePrice || 0),
      barcode,
    ];
    const text = rows.filter(Boolean).join('\n');
    const escpos =
      ESC +
      '@' +
      ESC +
      'a' +
      '\x01' +
      text +
      '\n\n' +
      GS +
      'V' +
      '\x00';
    return {
      productId: String(product._id),
      sku,
      name,
      barcode,
      price: product.salePrice || 0,
      text,
      escposBase64: Buffer.from(escpos, 'binary').toString('base64'),
    };
  });

  const joined = labels.map((label) => label.text).join('\n\n----\n\n');
  const escpos =
    ESC +
    '@' +
    labels.map((label) => Buffer.from(label.escposBase64, 'base64').toString('binary')).join('') +
    GS +
    'V' +
    '\x00';

  return {
    kind: 'label-40x30',
    width: 40,
    height: 30,
    text: joined,
    escposBase64: Buffer.from(escpos, 'binary').toString('base64'),
    labels,
    store: {
      name: settings.storeName,
      phone: settings.storePhone,
      address: settings.storeAddress,
      cnpj: settings.storeCnpj,
      logo: settings.storeLogo || '',
    },
  };
}

function addMethod(a = 0, b = 0) {
  return (a || 0) + (b || 0);
}
