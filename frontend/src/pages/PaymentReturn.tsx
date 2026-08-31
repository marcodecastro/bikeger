import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { post } from '../lib/api';
import {
  mpPaymentId,
  mpPaymentStatus,
  parsePaymentReference,
  paymentReturnCopy,
} from '../lib/paymentPoll';

export function PaymentReturn() {
  const [params] = useSearchParams();
  const [syncError, setSyncError] = useState('');
  const [synced, setSynced] = useState(false);

  const status = mpPaymentStatus(params);
  const paymentId = mpPaymentId(params);
  const copy = paymentReturnCopy(status);
  const documentLink = parsePaymentReference(params.get('external_reference'));

  useEffect(() => {
    if (!paymentId) return;
    let cancelled = false;
    post(`/payments/${paymentId}/sync`)
      .then(() => {
        if (!cancelled) setSynced(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSyncError(err instanceof Error ? err.message : 'Não foi possível sincronizar o pagamento');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
        <span className={`badge ${copy.tone}`}>{status || 'sem status'}</span>
      </div>

      <article className="card">
        {paymentId ? <p className="muted">Pagamento Mercado Pago {paymentId}</p> : null}
        {synced ? <p>O BikeGer já pediu a confirmação deste pagamento na API.</p> : null}
        {syncError ? <p className="error">{syncError}</p> : null}
        <div className="row" style={{ marginTop: 16 }}>
          {documentLink ? (
            <Link className="btn btn-primary" to={documentLink.href}>
              {documentLink.label}
            </Link>
          ) : null}
          <Link className="btn" to="/">
            Ir ao painel
          </Link>
        </div>
      </article>
    </section>
  );
}
