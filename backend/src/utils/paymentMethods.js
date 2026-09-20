export const GATEWAY_PAYMENT_METHODS = ['pix', 'mercado_pago'];
export const PRESENT_PAYMENT_METHODS = ['dinheiro', 'cartao_credito', 'cartao_debito'];

export function isGatewayPaymentMethod(method) {
  return GATEWAY_PAYMENT_METHODS.includes(method);
}

/** No PDV, PIX e Mercado Pago só viram aprovado pelo webhook. Dinheiro e cartão caem na hora. */
export function initialSalePaymentStatus(method) {
  return isGatewayPaymentMethod(method) ? 'pendente' : 'aprovado';
}
