import { FiscalDocument } from '../models/FiscalDocument.js';
import { Sale } from '../models/Sale.js';
import { WorkOrder } from '../models/WorkOrder.js';
import { Product } from '../models/Product.js';
import '../models/Customer.js';
import { getSettings } from '../models/Settings.js';
import { assertCents } from '../utils/money.js';
import { httpError } from '../utils/asyncHandler.js';
import { buildNfcePayload, focusNfeToken, missingEmitenteFields } from '../utils/nfcePayload.js';
import { fetchWithTimeout, fiscalTimeoutMs } from '../utils/fetchTimeout.js';

function focusHost(settings) {
  return settings.fiscalEnvironment === 'producao'
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
}

function focusAuth(token) {
  return `Basic ${Buffer.from(`${token}:`).toString('base64')}`;
}

export const OPEN_FISCAL_STATUSES = ['pendente', 'processando', 'autorizada'];
const CLAIMABLE_FISCAL_STATUSES = ['pendente', 'rejeitada'];

function applyFocusResult(doc, payload) {
  doc.raw = payload;
  doc.sefazStatus = payload.status_sefaz || payload.status || '';
  doc.accessKey = payload.chave_nfe || payload.chave || doc.accessKey || '';
  doc.protocol = payload.protocolo || payload.numero_protocolo || doc.protocol || '';
  doc.number = String(payload.numero || doc.number || '');
  doc.danfeUrl = payload.caminho_danfe || doc.danfeUrl || '';
  doc.qrcodeUrl = payload.qrcode_url || doc.qrcodeUrl || '';

  if (payload.status === 'autorizado' || payload.status === 'autorizada') {
    doc.status = 'autorizada';
    doc.errorMessage = '';
    return;
  }
  if (payload.status === 'cancelado') {
    doc.status = 'cancelada';
    doc.errorMessage = payload.mensagem_sefaz || '';
    return;
  }
  if (payload.status === 'erro_autorizacao' || payload.status === 'erro_cancelamento') {
    doc.status = payload.status === 'erro_cancelamento' ? doc.status : 'rejeitada';
    doc.errorMessage = payload.mensagem_sefaz || payload.mensagem || 'SEFAZ recusou a operação';
    return;
  }
  if (payload.codigo) {
    doc.status = 'rejeitada';
    doc.errorMessage = payload.mensagem || payload.codigo;
  }
}

async function defaultSendToFocus({ settings, token, doc, payload }) {
  const response = await fetchWithTimeout(
    `${focusHost(settings)}/v2/nfce?ref=${doc._id}`,
    {
      method: 'POST',
      headers: {
        Authorization: focusAuth(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    fiscalTimeoutMs(),
  );
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

function findOpenFiscal(relatedType, relatedId) {
  return FiscalDocument.findOne({
    relatedType,
    relatedId,
    status: { $in: OPEN_FISCAL_STATUSES },
  }).sort({ createdAt: -1 });
}

export async function enqueueFiscalDocument({ relatedType, relatedId, sendToFocus }) {
  const existing = await findOpenFiscal(relatedType, relatedId);
  if (existing) return existing;

  const charge = await resolveCharge(relatedType, relatedId);
  const settings = await getSettings();
  const token = focusNfeToken(settings);
  const missing = missingEmitenteFields(settings);

  let doc;
  try {
    doc = await FiscalDocument.create({
      relatedType,
      relatedId,
      kind: 'nfce',
      status: 'pendente',
      amount: charge.amount,
      series: settings.fiscalSeries || '1',
      provider: token ? 'focusnfe' : 'interno',
      errorMessage: !settings.fiscalEnabled
        ? 'NFC-e desligada em Ajustes. O cupom térmico não substitui o documento fiscal.'
        : !token
          ? 'Defina o FOCUS_NFE_TOKEN em Ajustes (ou no .env). Até lá o rascunho fica pendente.'
          : missing.length
            ? `Cadastro fiscal incompleto: ${missing.join(', ')}`
            : '',
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const recovered = await findOpenFiscal(relatedType, relatedId);
    if (!recovered) throw error;
    return recovered;
  }

  if (settings.fiscalEnabled && token && !missing.length) {
    return emitFiscalDocument(doc._id, { sendToFocus });
  }

  return doc;
}

export async function emitFiscalDocument(id, { sendToFocus } = {}) {
  const doc = await FiscalDocument.findById(id);
  if (!doc) throw httpError(404, 'Documento fiscal não encontrado');
  if (doc.status === 'autorizada') return doc;
  if (doc.status === 'cancelada') throw httpError(400, 'NFC-e cancelada não pode ser reemitida nesta referência');
  if (doc.status === 'processando') return doc;

  const settings = await getSettings();
  const token = focusNfeToken(settings);
  const missing = missingEmitenteFields(settings);

  if (!token) {
    doc.status = 'pendente';
    doc.errorMessage =
      'Defina o FOCUS_NFE_TOKEN em Ajustes para emitir NFC-e de verdade. Até lá o documento fica pendente — o cupom da térmica não é nota.';
    await doc.save();
    return doc;
  }

  if (missing.length) {
    doc.status = 'pendente';
    doc.errorMessage = `Cadastro fiscal incompleto: ${missing.join(', ')}. CSC e endereço do emitente são obrigatórios na SEFAZ.`;
    await doc.save();
    return doc;
  }

  const charge = await resolveCharge(doc.relatedType, doc.relatedId);
  const payload = buildNfcePayload({ settings, charge, customer: charge.customer });

  const claimed = await FiscalDocument.findOneAndUpdate(
    { _id: id, status: { $in: CLAIMABLE_FISCAL_STATUSES } },
    { $set: { status: 'processando', provider: 'focusnfe', errorMessage: '' } },
    { new: true },
  );
  if (!claimed) {
    const current = await FiscalDocument.findById(id);
    if (!current) throw httpError(404, 'Documento fiscal não encontrado');
    if (current.status === 'cancelada') {
      throw httpError(400, 'NFC-e cancelada não pode ser reemitida nesta referência');
    }
    return current;
  }

  try {
    const result = await (sendToFocus || defaultSendToFocus)({ settings, token, doc: claimed, payload });
    applyFocusResult(claimed, result.body || {});

    if (!result.ok && claimed.status === 'processando') {
      claimed.status = 'rejeitada';
      claimed.errorMessage = result.body?.mensagem || result.body?.message || `HTTP ${result.status}`;
    }

    await claimed.save();
    return claimed;
  } catch (error) {
    claimed.status = 'rejeitada';
    claimed.errorMessage = error.message;
    await claimed.save();
    return claimed;
  }
}

export async function cancelFiscalDocument(id, justificativa = '') {
  const doc = await FiscalDocument.findById(id);
  if (!doc) throw httpError(404, 'Documento fiscal não encontrado');
  if (doc.status === 'cancelada') return doc;
  if (doc.status !== 'autorizada') {
    doc.status = 'cancelada';
    doc.errorMessage = 'Rascunho encerrado sem autorização SEFAZ.';
    await doc.save();
    return doc;
  }

  const reason = String(justificativa || 'Cancelamento da venda no BikeGer.').trim();
  const padded = reason.length < 15 ? `${reason} — cancelamento no PDV.`.slice(0, 255) : reason.slice(0, 255);

  const settings = await getSettings();
  const token = focusNfeToken(settings);
  if (!token) {
    throw httpError(503, 'FOCUS_NFE_TOKEN em Ajustes é necessário para cancelar NFC-e autorizada na SEFAZ');
  }

  const response = await fetchWithTimeout(
    `${focusHost(settings)}/v2/nfce/${doc._id}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: focusAuth(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ justificativa: padded }),
    },
    fiscalTimeoutMs(),
  );

  const body = await response.json().catch(() => ({}));
  applyFocusResult(doc, body);

  if (body.status === 'cancelado' || response.ok) {
    doc.status = 'cancelada';
    doc.errorMessage = body.mensagem_sefaz || '';
  } else {
    doc.errorMessage = body.mensagem_sefaz || body.mensagem || 'SEFAZ recusou o cancelamento';
  }

  await doc.save();
  return doc;
}

export async function cancelAuthorizedFor(relatedType, relatedId, justificativa) {
  const docs = await FiscalDocument.find({
    relatedType,
    relatedId,
    status: { $in: OPEN_FISCAL_STATUSES },
  });
  const results = [];
  for (const doc of docs) {
    results.push(await cancelFiscalDocument(doc._id, justificativa));
  }
  return results;
}

export async function listFiscalDocuments(relatedType, relatedId) {
  return FiscalDocument.find({ relatedType, relatedId }).sort({ createdAt: -1 });
}

async function resolveCharge(relatedType, relatedId) {
  if (relatedType === 'sale') {
    const sale = await Sale.findById(relatedId).populate('customer');
    if (!sale) throw httpError(404, 'Venda não encontrada');
    assertCents(sale.total, 'total da venda');
    const products = await Product.find({ _id: { $in: sale.items.map((item) => item.product) } });
    const byId = new Map(products.map((product) => [String(product._id), product]));
    return {
      amount: sale.total,
      customer: sale.customer,
      payments: sale.payments,
      items: sale.items.map((item) => {
        const product = byId.get(String(item.product));
        return {
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          unit: product?.unit,
          ncm: product?.ncm,
          cfop: product?.cfop,
          icmsOrigin: product?.icmsOrigin,
          icmsCst: product?.icmsCst,
        };
      }),
    };
  }

  const order = await WorkOrder.findById(relatedId).populate('customer');
  if (!order) throw httpError(404, 'OS não encontrada');
  assertCents(order.total, 'total da OS');
  const products = await Product.find({ _id: { $in: order.parts.map((item) => item.product) } });
  const byId = new Map(products.map((product) => [String(product._id), product]));
  return {
    amount: order.total,
    customer: order.customer,
    payments: order.payments,
    items: [
      ...order.parts.map((item) => {
        const product = byId.get(String(item.product));
        return {
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          unit: product?.unit,
          ncm: product?.ncm,
          cfop: product?.cfop,
          icmsOrigin: product?.icmsOrigin,
          icmsCst: product?.icmsCst,
        };
      }),
      ...order.services.map((item) => ({
        sku: 'SERV',
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.total,
        unit: 'UN',
        ncm: '00000000',
        cfop: '5933',
        icmsOrigin: '0',
        icmsCst: '102',
      })),
    ],
  };
}
