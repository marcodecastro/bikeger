import { formatBRL } from '../utils/money.js';
import { getSettings } from '../models/Settings.js';

const ESC = '\x1B';
const GS = '\x1D';
const NBSP = '\u00a0';

const PAYMENT_LABELS = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Credito',
  cartao_debito: 'Debito',
  mercado_pago: 'Mercado Pago',
};

function money(cents) {
  return formatBRL(cents).replace(/R\$\s+/, `R$${NBSP}`);
}

function line(width, left, right = '') {
  const rightText = String(right);
  const maxLeft = Math.max(0, width - rightText.length - (rightText ? 1 : 0));
  let leftText = String(left);
  if (leftText.length > maxLeft) {
    leftText = maxLeft <= 1 ? leftText.slice(0, maxLeft) : `${leftText.slice(0, maxLeft - 1)}.`;
  }
  const space = Math.max(rightText ? 1 : 0, width - leftText.length - rightText.length);
  return `${leftText}${' '.repeat(space)}${rightText}`;
}

function dashed(width) {
  return '-'.repeat(width);
}

function wrap(text, width) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const rows = [];
  let current = '';
  for (const word of words) {
    if (word.length > width) {
      if (current) {
        rows.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += width) rows.push(word.slice(i, i + width));
      continue;
    }
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

function center(text, width) {
  const value = String(text);
  if (value.length >= width) return value.slice(0, width);
  const pad = Math.floor((width - value.length) / 2);
  return `${' '.repeat(pad)}${value}`;
}

function itemRows(width, item) {
  const label = `${item.quantity}x ${item.name}`;
  const amount = money(item.total);
  const nameRows = wrap(label, width);
  const rows = [];
  if (nameRows.length === 1 && nameRows[0].length + 1 + amount.length <= width) {
    rows.push(line(width, nameRows[0], amount));
  } else {
    rows.push(...nameRows);
    rows.push(line(width, '', amount));
  }
  if (item.quantity > 1) {
    rows.push(line(width, `  ${item.quantity} x ${money(item.unitPrice)}`, ''));
  }
  return rows;
}

function storeFooter(settings, tagline) {
  const name = String(settings.storeName || 'Loja').trim() || 'Loja';
  return [name, tagline].filter(Boolean);
}

function toEscPos(text) {
  return (
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
    '\x00'
  );
}

function receiptPayload(settings, width, text) {
  return {
    text,
    escposBase64: Buffer.from(toEscPos(text), 'binary').toString('base64'),
    width: settings.printerWidth,
    columns: width,
    store: {
      name: settings.storeName,
      phone: settings.storePhone,
      address: settings.storeAddress,
      cnpj: settings.storeCnpj,
      logo: settings.storeLogo || '',
    },
  };
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
  if (kind === 'os') rows.push(`ORDEM DE SERVICO ${number}`);
  else if (!customerName) rows.push(`CUPOM NAO FISCAL ${number}`);
  else rows.push(`CUPOM DE VENDA ${number}`);
  rows.push(new Date().toLocaleString('pt-BR'));
  if (customerName) rows.push(`Cliente: ${customerName}`);
  else if (kind !== 'os') rows.push('Consumidor');
  rows.push(dashed(width));

  for (const item of items) {
    rows.push(...itemRows(width, item));
  }

  rows.push(dashed(width));
  if (totals.laborTotal !== undefined) {
    rows.push(line(width, 'Servicos', money(totals.laborTotal)));
    rows.push(line(width, 'Pecas', money(totals.partsTotal)));
  }
  rows.push(line(width, 'Subtotal', money(totals.subtotal ?? totals.total)));
  if (totals.discount) rows.push(line(width, 'Desconto', money(totals.discount)));
  rows.push(line(width, 'TOTAL', money(totals.total)));
  rows.push(dashed(width));

  for (const payment of payments || []) {
    const label = PAYMENT_LABELS[payment.method] || payment.method;
    rows.push(line(width, label, money(payment.amount)));
  }

  for (const extra of extraLines) {
    rows.push(...wrap(String(extra).replace(/R\$\s+/g, `R$${NBSP}`), width));
  }

  rows.push('');
  if (settings.receiptFooter) rows.push(...wrap(settings.receiptFooter, width));
  rows.push('');
  rows.push('');
  rows.push(...wrap('Cuidamos da sua bike para você focar apenas no caminho.', width));
  rows.push(center('Obrigado pela preferência!', width));
  rows.push('');

  return receiptPayload(settings, width, rows.join('\n'));
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
  rows.push(line(width, 'Fundo', money(day.openingAmount || 0)));
  rows.push(line(width, 'Dinheiro contado', money(day.countedCash || 0)));
  rows.push(line(width, 'Gaveteiro esperado', money(day.expectedCash || 0)));
  rows.push(line(width, 'Diferenca', money(difference)));
  rows.push(differenceLabel);
  rows.push(dashed(width));
  rows.push(line(width, 'PIX', money(day.byMethod?.pix || 0)));
  rows.push(line(width, 'Cartao', money(card)));
  rows.push(line(width, 'Dinheiro recebido', money(day.byMethod?.dinheiro || 0)));
  rows.push(line(width, 'Mercado Pago', money(day.byMethod?.mercado_pago || 0)));
  rows.push(line(width, 'Sangria', money(day.sangria || 0)));
  rows.push(line(width, 'Suprimento', money(day.suprimento || 0)));
  rows.push(line(width, `OS (${day.osCount || 0})`, money(day.osTotal || 0)));
  if (day.estorno) rows.push(line(width, 'Estorno', money(day.estorno)));
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
  rows.push(...storeFooter(settings, 'fechamento do dia'));
  rows.push('');

  return receiptPayload(settings, width, rows.join('\n'));
}

export async function buildShelfLabels(products) {
  const settings = await getSettings();
  const labels = (products || []).map((product) => {
    const name = String(product.name || '').trim();
    const sku = String(product.sku || '').trim();
    const barcode = String(product.barcode || sku).trim();
    const image = Array.isArray(product.images) ? String(product.images[0] || '').trim() : '';
    const rows = [
      settings.storeName,
      ...wrap(name, 24).slice(0, 2),
      sku,
      money(product.salePrice || 0),
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
      image,
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
