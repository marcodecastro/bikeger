import { Router } from 'express';
import { getSettings } from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fiscalReadiness } from '../utils/nfcePayload.js';
import { whatsappCloudConfig } from '../utils/whatsappCloud.js';

export const settingsRouter = Router();

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
    const body = { ...req.body };
    delete body.hasMpToken;
    delete body.hasFocusNfe;
    delete body.hasCsc;
    delete body.fiscalReady;
    delete body.tokenFromEnv;
    delete body.hasWhatsAppCloud;
    delete body.whatsappFromEnv;
    if (isMasked(body.mpAccessToken)) delete body.mpAccessToken;
    if (isMasked(body.fiscalCscToken)) delete body.fiscalCscToken;
    if (isMasked(body.focusNfeToken)) delete body.focusNfeToken;
    if (isMasked(body.whatsappToken)) delete body.whatsappToken;
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

function toPublicSettings(settings) {
  const safe = settings.toObject();
  if (safe.mpAccessToken) safe.mpAccessToken = maskSecret(safe.mpAccessToken);
  if (safe.fiscalCscToken) safe.fiscalCscToken = maskSecret(safe.fiscalCscToken);
  if (safe.focusNfeToken) safe.focusNfeToken = maskSecret(safe.focusNfeToken);
  if (safe.whatsappToken) safe.whatsappToken = maskSecret(safe.whatsappToken);
  const readiness = fiscalReadiness(settings);
  const whatsapp = whatsappCloudConfig(settings);
  safe.hasMpToken = Boolean(process.env.MP_ACCESS_TOKEN || settings.mpAccessToken);
  safe.hasFocusNfe = readiness.hasToken;
  safe.hasCsc = Boolean(settings.fiscalCscId && settings.fiscalCscToken);
  safe.tokenFromEnv = readiness.tokenFromEnv;
  safe.fiscalReady = readiness.canEmit;
  safe.fiscalMissing = readiness.missing;
  safe.mpPublicKey = process.env.MP_PUBLIC_KEY || settings.mpPublicKey;
  safe.hasWhatsAppCloud = whatsapp.configured;
  safe.whatsappFromEnv = whatsapp.tokenFromEnv;
  return safe;
}
