import { phoneToWhatsApp } from './notify.js';
import { fetchWithTimeout, whatsappTimeoutMs } from './fetchTimeout.js';

export function whatsappCloudConfig(settings = {}) {
  const token = String(process.env.WHATSAPP_TOKEN || settings.whatsappToken || '').trim();
  const phoneNumberId = String(
    process.env.WHATSAPP_PHONE_NUMBER_ID || settings.whatsappPhoneNumberId || '',
  ).trim();
  return {
    token,
    phoneNumberId,
    configured: Boolean(token && phoneNumberId),
    tokenFromEnv: Boolean(String(process.env.WHATSAPP_TOKEN || '').trim()),
  };
}

export async function sendWhatsAppCloud({
  token,
  phoneNumberId,
  phone,
  body,
  fetchImpl = fetch,
  timeoutMs = whatsappTimeoutMs(),
}) {
  const to = phoneToWhatsApp(phone);
  if (!to) {
    const error = new Error('Telefone inválido para a API do WhatsApp');
    error.status = 400;
    throw error;
  }

  const response = await fetchWithTimeout(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: false, body },
      }),
    },
    timeoutMs,
    fetchImpl,
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error?.message || data.message || `HTTP ${response.status}`;
    const error = new Error(`WhatsApp Cloud: ${detail}`);
    error.status = 502;
    throw error;
  }

  return {
    messageId: data.messages?.[0]?.id || '',
    to,
  };
}
