const WEAK_SECRETS = new Set([
  '',
  'bikeger-dev-secret',
  'bikeger-troque-esta-chave',
  'troque-esta-chave',
  'gere-uma-chave-longa-aleatoria',
  'gere-uma-chave-longa-aleatoria-local',
]);

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function assertJwtConfig() {
  const secret = process.env.JWT_SECRET || '';
  if (isProduction() && WEAK_SECRETS.has(secret)) {
    throw new Error(
      'JWT_SECRET forte é obrigatório em produção. Defina uma chave longa no .env — não use o valor de exemplo.',
    );
  }
  if (!secret || WEAK_SECRETS.has(secret)) {
    console.warn(
      'JWT_SECRET fraco ou ausente. Aceitável só em desenvolvimento. Em produção o servidor recusa subir.',
    );
  }
}

export function tokenSecret() {
  const secret = process.env.JWT_SECRET;
  if (isProduction()) {
    if (!secret || WEAK_SECRETS.has(secret)) {
      throw new Error('JWT_SECRET inválido em produção');
    }
    return secret;
  }
  return secret && !WEAK_SECRETS.has(secret) ? secret : 'bikeger-dev-secret';
}

export function shouldSeedDemoUsers() {
  if (isProduction()) return false;
  if (process.env.ALLOW_DEMO_USERS === 'false') return false;
  return true;
}

export const SEED_BLOCKED_MESSAGE =
  'npm run seed recusa apagar o banco em produção (NODE_ENV=production).';

export function assertSeedAllowed() {
  if (isProduction()) {
    throw new Error(SEED_BLOCKED_MESSAGE);
  }
}

export const FRONTEND_URL_REQUIRED_MESSAGE =
  'FRONTEND_URL é obrigatório em produção. Sem isso o CORS aceitaria qualquer origem.';

export const INTERNAL_ERROR_MESSAGE = 'Erro interno do servidor';

export const DEV_FRONTEND_ORIGIN = 'http://localhost:5174';
export const PRODUCTION_FRONTEND_ORIGIN = 'https://bikeger.vercel.app';
export const PRODUCTION_API_ORIGIN = 'https://bikeger.onrender.com';

function stripSlash(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function configuredFrontendOrigins() {
  return String(process.env.FRONTEND_URL || '')
    .split(',')
    .map(stripSlash)
    .filter((origin) => origin && origin !== '*' && origin !== 'true');
}

export function frontendOrigin() {
  const listed = configuredFrontendOrigins();
  if (listed.length) return listed[0];
  if (isProduction()) return PRODUCTION_FRONTEND_ORIGIN;
  return '';
}

function isLocalhostUrl(url) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

export function assertFrontendUrl() {
  if (!isProduction()) return;
  const raw = stripSlash(process.env.FRONTEND_URL);
  if (raw === '*' || raw === 'true' || isLocalhostUrl(raw)) {
    throw new Error(FRONTEND_URL_REQUIRED_MESSAGE);
  }
  const origin = frontendOrigin();
  if (!origin || isLocalhostUrl(origin)) {
    throw new Error(FRONTEND_URL_REQUIRED_MESSAGE);
  }
}

export const API_PUBLIC_URL_REQUIRED_MESSAGE =
  'API_PUBLIC_URL é obrigatório em produção. Sem isso o webhook do Mercado Pago apontaria para localhost.';

export const REPLICA_SET_REQUIRED_MESSAGE =
  'MongoDB em produção precisa de replica set. Sem isso as transações de venda/OS não são honestas. Suba com docker compose (rs0), no mesmo espírito do API_PUBLIC_URL.';

export function assertPublicApiUrl() {
  if (!isProduction()) return;
  const url = publicApiUrl();
  if (!url || url === '*' || isLocalhostUrl(url)) {
    throw new Error(API_PUBLIC_URL_REQUIRED_MESSAGE);
  }
}

export function assertReplicaSet(support) {
  if (!isProduction()) return;
  if (!support?.transactions) {
    throw new Error(REPLICA_SET_REQUIRED_MESSAGE);
  }
}

export function assertBootConfig() {
  assertJwtConfig();
  assertFrontendUrl();
  assertPublicApiUrl();
}

export function corsOrigin() {
  const origin = frontendOrigin();
  if (origin && origin !== '*' && origin !== 'true') return origin;
  return DEV_FRONTEND_ORIGIN;
}

export function isAllowedFrontendOrigin(origin) {
  if (!origin) return true;
  if (configuredFrontendOrigins().includes(origin)) return true;
  if (origin === corsOrigin()) return true;
  if (!isProduction()) return false;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'https:') return false;
    if (hostname === 'bikeger.vercel.app') return true;
    return hostname.startsWith('bikeger-') && hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

export function corsAllowedOrigin() {
  if (!isProduction()) return corsOrigin();
  return (origin, callback) => {
    callback(null, isAllowedFrontendOrigin(origin));
  };
}

export function paymentReturnUrl() {
  return `${corsOrigin()}/pagamentos/retorno`;
}

export function checkoutBackUrls() {
  const url = paymentReturnUrl();
  return { success: url, failure: url, pending: url };
}

export function redactMongoUri(value) {
  return String(value || '').replace(/mongodb(\+srv)?:\/\/([^@\s/]+)@/gi, 'mongodb$1://***@');
}

export function publicApiUrl() {
  const url = stripSlash(process.env.API_PUBLIC_URL);
  if (url) return url;
  if (isProduction()) return PRODUCTION_API_ORIGIN;
  return `http://localhost:${process.env.PORT || 4000}`;
}
