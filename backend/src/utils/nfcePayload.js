import { centsToMpAmount } from './money.js';

const PAYMENT_CODES = {
  dinheiro: '01',
  pix: '17',
  cartao_credito: '03',
  cartao_debito: '04',
  mercado_pago: '99',
};

const HOMOLOG_ITEM =
  'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';

export function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function isoOffset(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hours}:${minutes}`;
}

export function paymentCode(method) {
  return PAYMENT_CODES[method] || '99';
}

export function focusNfeToken(settings) {
  return String(process.env.FOCUS_NFE_TOKEN || settings?.focusNfeToken || '').trim();
}

export function fiscalReadiness(settings) {
  const token = focusNfeToken(settings);
  const missing = missingEmitenteFields(settings);
  if (!token) missing.unshift('FOCUS_NFE_TOKEN');
  return {
    hasToken: Boolean(token),
    tokenFromEnv: Boolean(String(process.env.FOCUS_NFE_TOKEN || '').trim()),
    canEmit: Boolean(token && missingEmitenteFields(settings).length === 0),
    missing,
  };
}

export function missingEmitenteFields(settings) {
  const missing = [];
  if (digits(settings.storeCnpj).length !== 14) missing.push('CNPJ do emitente');
  if (!digits(settings.stateRegistration)) missing.push('Inscrição estadual');
  if (!settings.storeStreet) missing.push('Logradouro');
  if (!settings.storeNumber) missing.push('Número');
  if (!settings.storeNeighborhood) missing.push('Bairro');
  if (!settings.storeCity) missing.push('Município');
  if (!settings.storeState || String(settings.storeState).length !== 2) missing.push('UF');
  if (digits(settings.storeZip).length !== 8) missing.push('CEP');
  if (!settings.fiscalCscId) missing.push('CSC ID');
  if (!settings.fiscalCscToken) missing.push('CSC token');
  return missing;
}

export function buildNfcePayload({ settings, charge, customer, issuedAt = new Date() }) {
  const missing = missingEmitenteFields(settings);
  if (missing.length) {
    throw new Error(`Cadastro fiscal incompleto: ${missing.join(', ')}`);
  }

  const destDoc = digits(customer?.document);
  const sameUf = !customer?.address?.state || customer.address.state === settings.storeState;
  const homolog = settings.fiscalEnvironment !== 'producao';

  const items = charge.items.map((item, index) => {
    const unit = centsToMpAmount(item.unitPrice);
    const gross = centsToMpAmount(item.total ?? item.unitPrice * item.quantity);
    let descricao = item.name;
    if (homolog && index === 0) descricao = `${HOMOLOG_ITEM} ${item.name}`.slice(0, 120);

    return {
      numero_item: String(index + 1),
      codigo_produto: item.sku || `ITEM${index + 1}`,
      descricao,
      codigo_ncm: digits(item.ncm || settings.defaultNcm || '87149990').padStart(8, '0').slice(0, 8),
      cfop: String(item.cfop || settings.defaultCfop || '5102'),
      unidade_comercial: (item.unit || 'UN').toLowerCase(),
      unidade_tributavel: (item.unit || 'UN').toLowerCase(),
      quantidade_comercial: item.quantity,
      quantidade_tributavel: item.quantity,
      valor_unitario_comercial: unit,
      valor_unitario_tributavel: unit,
      valor_bruto: gross,
      icms_origem: String(item.icmsOrigin ?? '0'),
      icms_situacao_tributaria: String(item.icmsCst || settings.defaultIcmsCst || '102'),
    };
  });

  const payments = (charge.payments || []).filter((payment) => payment.status !== 'recusado');
  const formas_pagamento = (payments.length ? payments : [{ method: 'dinheiro', amount: charge.amount }]).map(
    (payment) => ({
      forma_pagamento: paymentCode(payment.method),
      valor_pagamento: centsToMpAmount(payment.amount),
      ...(payment.method === 'cartao_credito' || payment.method === 'cartao_debito'
        ? { tipo_integracao: '2' }
        : {}),
    }),
  );

  const payload = {
    natureza_operacao: 'VENDA AO CONSUMIDOR',
    data_emissao: isoOffset(issuedAt),
    tipo_documento: '1',
    finalidade_emissao: '1',
    presenca_comprador: '1',
    modalidade_frete: '9',
    local_destino: sameUf ? '1' : '2',
    cnpj_emitente: digits(settings.storeCnpj),
    nome_emitente: settings.storeName,
    inscricao_estadual_emitente: digits(settings.stateRegistration),
    logradouro_emitente: settings.storeStreet,
    numero_emitente: settings.storeNumber,
    bairro_emitente: settings.storeNeighborhood,
    municipio_emitente: settings.storeCity,
    uf_emitente: String(settings.storeState).toUpperCase(),
    cep_emitente: digits(settings.storeZip),
    telefone_emitente: digits(settings.storePhone),
    regime_tributario_emitente: String(settings.taxRegime || '1'),
    serie: settings.fiscalSeries || '1',
    indicador_inscricao_estadual_destinatario: '9',
    items,
    formas_pagamento,
    informacoes_adicionais_contribuinte: 'Documento emitido pelo BikeGer. Consulte a chave no portal da SEFAZ.',
  };

  if (customer?.name && destDoc) {
    payload.nome_destinatario = customer.name;
    if (destDoc.length === 14) payload.cnpj_destinatario = destDoc;
    else if (destDoc.length === 11) payload.cpf_destinatario = destDoc;
  }

  return payload;
}
