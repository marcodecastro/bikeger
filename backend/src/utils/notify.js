export function phoneToWhatsApp(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12) return '';
  return digits;
}

export function buildReadyMessage({
  template,
  storeName,
  customerName,
  bikeLabel,
  number,
}) {
  const fallback =
    '{nome}, a {bike} da OS {os} está pronta para retirada na {loja}.';
  return String(template || fallback)
    .replaceAll('{nome}', customerName || 'cliente')
    .replaceAll('{bike}', bikeLabel || 'bike')
    .replaceAll('{os}', number || '')
    .replaceAll('{loja}', storeName || 'BikeGer');
}

export function whatsappUrl(phone, text) {
  const digits = phoneToWhatsApp(phone);
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
