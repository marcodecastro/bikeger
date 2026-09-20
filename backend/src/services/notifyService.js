import { Notification } from '../models/Notification.js';
import { WorkOrder } from '../models/WorkOrder.js';
import { formatBRL } from '../utils/money.js';
import { getSettings } from '../models/Settings.js';
import { httpError } from '../utils/asyncHandler.js';
import {
  buildOsNoticeMessage,
  DEFAULT_OS_NOTICE_TEMPLATES,
  whatsappUrl,
} from '../utils/notify.js';
import { sendWhatsAppCloud, whatsappCloudConfig } from '../utils/whatsappCloud.js';
import { isWorkOrderQuoteStatus } from '../utils/workOrderStatus.js';

const TEMPLATE_FIELDS = {
  os_pronta: 'readyNoticeTemplate',
  os_aberta: 'openedNoticeTemplate',
  os_paga: 'paidNoticeTemplate',
  os_orcamento: 'quoteNoticeTemplate',
};

export async function enqueueReadyNotice(orderId, options) {
  return enqueueOsNotice(orderId, 'os_pronta', options);
}

export async function enqueueOpenedNotice(orderId, options) {
  return enqueueOsNotice(orderId, 'os_aberta', options);
}

export async function enqueuePaidNotice(orderId, options) {
  return enqueueOsNotice(orderId, 'os_paga', options);
}

export async function enqueueQuoteNotice(orderId, options) {
  const order = await WorkOrder.findById(orderId);
  if (!order) throw httpError(404, 'OS não encontrada');
  if (order.status === 'aberta' || isWorkOrderQuoteStatus(order.status)) {
    if (order.status !== 'orcamento') {
      const { updateWorkOrder } = await import('./workOrderService.js');
      await updateWorkOrder(orderId, { status: 'orcamento' });
    }
  }
  return enqueueOsNotice(orderId, 'os_orcamento', { ...options, allowRepeat: true });
}

export async function enqueueOsNotice(orderId, kind, { send = sendWhatsAppCloud, allowRepeat = false } = {}) {
  if (!TEMPLATE_FIELDS[kind]) throw httpError(400, 'Tipo de aviso inválido');

  const order = await WorkOrder.findById(orderId).populate('customer').populate('bike');
  if (!order) throw httpError(404, 'OS não encontrada');

  if (!allowRepeat) {
    const existing = await Notification.findOne({
      kind,
      workOrder: order._id,
      status: { $in: ['pendente', 'enviado'] },
    }).sort({ createdAt: -1 });
    if (existing && existing.status === 'enviado') return existing;
    if (existing && existing.status === 'pendente') {
      return deliverNotice(existing, { send });
    }
  }

  const settings = await getSettings();
  const bikeLabel = order.bike ? `${order.bike.brand} ${order.bike.model}`.trim() : 'bike';
  const message = buildOsNoticeMessage({
    template: settings[TEMPLATE_FIELDS[kind]],
    fallback: DEFAULT_OS_NOTICE_TEMPLATES[kind],
    storeName: settings.storeName,
    customerName: order.customer?.name,
    bikeLabel,
    number: order.number,
    amountLabel: formatBRL(order.total || 0),
  });
  const phone = order.customer?.phone || '';
  const waUrl = whatsappUrl(phone, message);

  const notice = await Notification.create({
    kind,
    workOrder: order._id,
    customer: order.customer?._id || null,
    message,
    phone,
    waUrl,
    provider: 'wa.me',
    status: waUrl ? 'pendente' : 'sem_telefone',
  });

  if (notice.status !== 'pendente') return notice;
  return deliverNotice(notice, { send, settings });
}

async function deliverNotice(notice, { send, settings } = {}) {
  const cfg = whatsappCloudConfig(settings || (await getSettings()));
  if (!cfg.configured) return notice;

  try {
    const result = await send({
      token: cfg.token,
      phoneNumberId: cfg.phoneNumberId,
      phone: notice.phone,
      body: notice.message,
    });
    notice.provider = 'cloud';
    notice.cloudMessageId = result.messageId || '';
    notice.errorMessage = '';
    notice.status = 'enviado';
    notice.sentAt = new Date();
    await notice.save();
    if (notice.kind === 'os_pronta') {
      await WorkOrder.findByIdAndUpdate(notice.workOrder, { readyNotifiedAt: notice.sentAt });
    }
  } catch (error) {
    notice.provider = 'wa.me';
    notice.errorMessage = error.message || 'Falha na API do WhatsApp';
    await notice.save();
  }

  return notice;
}

export async function listNotices({ status } = {}) {
  const filter = {};
  if (status) filter.status = status;
  return Notification.find(filter)
    .populate({ path: 'workOrder', populate: [{ path: 'customer' }, { path: 'bike' }] })
    .populate('customer')
    .sort({ createdAt: -1 })
    .limit(80);
}

export async function markNoticeSent(id) {
  const notice = await Notification.findById(id);
  if (!notice) throw httpError(404, 'Aviso não encontrado');
  notice.status = 'enviado';
  notice.sentAt = new Date();
  if (!notice.provider) notice.provider = 'wa.me';
  await notice.save();

  if (notice.kind === 'os_pronta') {
    await WorkOrder.findByIdAndUpdate(notice.workOrder, { readyNotifiedAt: notice.sentAt });
  }
  return notice;
}
