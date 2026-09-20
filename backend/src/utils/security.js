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

export function frontendOrigin() {
  return String(process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
}

export function assertFrontendUrl() {
  if (!isProduction()) return;
  const origin = frontendOrigin();
  if (!origin || origin === '*' || origin === 'true') {
    throw new Error(FRONTEND_URL_REQUIRED_MESSAGE);
  }
}

export const API_PUBLIC_URL_REQUIRED_MESSAGE =
  'API_PUBLIC_URL é obrigatório em produção. Sem isso o webhook do Mercado Pago apontaria para localhost.';

export const REPLICA_SET_REQUIRED_MESSAGE =
  'MongoDB em produção precisa de replica set. Sem isso as transações de venda/OS não são honestas. Suba com docker compose (rs0), no mesmo espírito do API_PUBLIC_URL.';

export function assertPublicApiUrl() {
  if (!isProduction()) return;
  const url = String(process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (!url || url === '*' || /localhost|127\.0\.0\.1/i.test(url)) {
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
  const url = String(process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (url) return url;
  if (isProduction()) throw new Error(API_PUBLIC_URL_REQUIRED_MESSAGE);
  return `http://localhost:${process.env.PORT || 4000}`;
}
