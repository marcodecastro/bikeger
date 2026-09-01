import helmet from 'helmet';

export function securityHeaders() {
  return helmet({
    // O painel no Vite (5174) lê a API (4000). same-origin bloquearia o fetch.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}
