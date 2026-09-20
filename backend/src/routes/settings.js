import { Router } from 'express';
import { getSettings } from '../models/Settings.js';
import { asyncHandler, httpError } from '../utils/asyncHandler.js';
import { fiscalCscId, fiscalCscToken, fiscalReadiness } from '../utils/nfcePayload.js';
import { whatsappCloudConfig } from '../utils/whatsappCloud.js';
import { isProduction } from '../utils/security.js';
import { normalizeStoreLogo } from '../utils/storeLogo.js';

export const settingsRouter = Router();

export const SETTINGS_WRITE_FIELDS = [
  'storeName',
  'storeLogo',
  'storePhone',
  'storeAddress',
  'storeCnpj',
  'receiptFooter',
  'printerWidth',
  'mpAccessToken',
  'mpPublicKey',
  'mechanicNames',
  'fiscalEnabled',
  'stateRegistration',
  'fiscalSeries',
  'fiscalEnvironment',
  'storeStreet',
  'storeNumber',
  'storeNeighborhood',
  'storeCity',
  'storeState',
  'storeZip',
  'taxRegime',
  'focusNfeToken',
  'fiscalCscId',
  'fiscalCscToken',
  'defaultNcm',
  'defaultCfop',
  'defaultIcmsCst',
  'readyNoticeTemplate',
  'openedNoticeTemplate',
  'paidNoticeTemplate',
  'quoteNoticeTemplate',
  'waitingPartsDays',
  'whatsappToken',
  'whatsappPhoneNumberId',
];

export function pickSettingsBody(body) {
  const picked = {};
  for (const key of SETTINGS_WRITE_FIELDS) {
    if (body?.[key] !== undefined) picked[key] = body[key];
  }
  return picked;
}

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json(toPublicSettings(settings));
  }),
);

settingsRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const body = pickSettingsBody(req.body);
    if (isMasked(body.mpAccessToken)) delete body.mpAccessToken;
    if (isMasked(body.fiscalCscToken)) delete body.fiscalCscToken;
    if (isMasked(body.focusNfeToken)) delete body.focusNfeToken;
    if (isMasked(body.whatsappToken)) delete body.whatsappToken;
    if (body.storeLogo !== undefined) body.storeLogo = normalizeStoreLogo(body.storeLogo);
    if (body.waitingPartsDays !== undefined) {
      const days = Number(body.waitingPartsDays);
      if (!Number.isInteger(days) || days < 1 || days > 30) {
        throw httpError(400, 'Dias de OS parada deve ser um inteiro de 1 a 30');
      }
      body.waitingPartsDays = days;
    }
    stripProductionSecrets(body);
    Object.assign(settings, body);
    await settings.save();
    res.json(toPublicSettings(settings));
  }),
);

function isMasked(value) {
  return Boolean(value && String(value).includes('•'));
}

export function maskSecret(value) {
  if (!value) return '';
  return '••••••••';
}

const PRODUCTION_SECRET_FIELDS = [
  'mpAccessToken',
  'focusNfeToken',
  'whatsappToken',
  'fiscalCscToken',
  'fiscalCscId',
];

function stripProductionSecrets(body) {
  if (!isProduction()) return;
  for (const field of PRODUCTION_SECRET_FIELDS) {
    if (body[field]) {
      throw httpError(400, `${field} em produção vai só no .env do servidor`);
    }
    delete body[field];
  }
}

export function toPublicSettings(settings) {
  const safe = settings.toObject();
  delete safe.mpAccessToken;
  delete safe.focusNfeToken;
  delete safe.whatsappToken;
  delete safe.fiscalCscToken;
  const readiness = fiscalReadiness(settings);
  const whatsapp = whatsappCloudConfig(settings);
  const cscId = fiscalCscId(settings);
  const cscToken = fiscalCscToken(settings);
  safe.hasMpToken = Boolean(String(process.env.MP_ACCESS_TOKEN || '').trim() || (!isProduction() && settings.mpAccessToken));
  safe.hasFocusNfe = readiness.hasToken;
  safe.hasCsc = Boolean(cscId && cscToken);
  if (isProduction()) safe.fiscalCscId = cscId;
  safe.tokenFromEnv = readiness.tokenFromEnv;
  safe.secretsFromEnv = isProduction();
  safe.fiscalReady = readiness.canEmit;
  safe.fiscalMissing = readiness.missing;
  safe.mpPublicKey = process.env.MP_PUBLIC_KEY || settings.mpPublicKey;
  safe.hasWhatsAppCloud = whatsapp.configured;
  safe.whatsappFromEnv = whatsapp.tokenFromEnv;
  return safe;
}
