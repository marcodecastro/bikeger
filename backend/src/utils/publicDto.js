function asObject(doc) {
  if (!doc) return doc;
  if (typeof doc.toObject === 'function') return doc.toObject();
  return { ...doc };
}

export function toPublicPayment(doc) {
  if (!doc) return doc;
  const payment = asObject(doc);
  return {
    _id: payment._id,
    provider: payment.provider,
    preferenceId: payment.preferenceId || '',
    paymentId: payment.paymentId || '',
    status: payment.status,
    amount: payment.amount,
    relatedType: payment.relatedType,
    relatedId: payment.relatedId,
    qrCode: payment.qrCode || '',
    qrCodeBase64: payment.qrCodeBase64 || '',
    ticketUrl: payment.ticketUrl || '',
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

export function toPublicCheckout(result) {
  if (!result) return result;
  return {
    payment: toPublicPayment(result.payment || result),
    initPoint: result.initPoint || result.ticketUrl || '',
    sandboxInitPoint: result.sandboxInitPoint || '',
  };
}

export function toPublicFiscal(doc) {
  if (!doc) return doc;
  const fiscal = asObject(doc);
  return {
    _id: fiscal._id,
    relatedType: fiscal.relatedType,
    relatedId: fiscal.relatedId,
    kind: fiscal.kind,
    status: fiscal.status,
    amount: fiscal.amount,
    number: fiscal.number || '',
    series: fiscal.series || '',
    accessKey: fiscal.accessKey || '',
    protocol: fiscal.protocol || '',
    provider: fiscal.provider || '',
    errorMessage: fiscal.errorMessage || '',
    danfeUrl: fiscal.danfeUrl || '',
    qrcodeUrl: fiscal.qrcodeUrl || '',
    sefazStatus: fiscal.sefazStatus || '',
    createdAt: fiscal.createdAt,
    updatedAt: fiscal.updatedAt,
  };
}
