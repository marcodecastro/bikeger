export function phoneToWhatsApp(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12) return '';
  return digits;
}

export const DEFAULT_OS_NOTICE_TEMPLATES = {
  os_pronta: '{nome}, a {bike} da OS {os} está pronta para retirada na {loja}.',
  os_aberta: '{nome}, a {bike} entrou na oficina ({os}) na {loja}.',
  os_paga: '{nome}, a {bike} da OS {os} já está paga e pode retirar na {loja}.',
  os_orcamento: '{nome}, o orçamento da {bike} na OS {os} ficou em {valor}. Pode fazer? {loja}',
};

export function buildOsNoticeMessage({
  template,
  fallback,
  storeName,
  customerName,
  bikeLabel,
  number,
  amountLabel = '',
}) {
  return String(template || fallback || DEFAULT_OS_NOTICE_TEMPLATES.os_pronta)
    .replaceAll('{nome}', customerName || 'cliente')
    .replaceAll('{bike}', bikeLabel || 'bike')
    .replaceAll('{os}', number || '')
    .replaceAll('{loja}', storeName || 'BikeGer')
    .replaceAll('{valor}', amountLabel || '');
}

export function buildReadyMessage(params) {
  return buildOsNoticeMessage({
    ...params,
    fallback: DEFAULT_OS_NOTICE_TEMPLATES.os_pronta,
  });
}

export function whatsappUrl(phone, text) {
  const digits = phoneToWhatsApp(phone);
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
