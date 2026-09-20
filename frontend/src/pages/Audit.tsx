import { useEffect, useState } from 'react';
import { get } from '../lib/api';
import type { AuditEvent } from '../types';

const ACTION_LABELS: Record<string, string> = {
  'user.password_changed': 'Troca de senha',
  'cash.opened': 'Abertura de caixa',
  'cash.closed': 'Fechamento de caixa',
  'cash.sangria': 'Sangria',
  'cash.suprimento': 'Suprimento',
  'payment.apply_failed': 'PIX não baixou no livro',
  'payment.outbox_drained': 'Reaplicação de PIX',
  'workOrder.cancelled_paid': 'Cancelamento de OS paga',
  'workOrder.parts_waiting': 'OS parada aguardando peças',
  'fiscal.authorized': 'NFC-e autorizada',
  'fiscal.rejected': 'NFC-e rejeitada',
};

function metaText(meta: Record<string, unknown> | undefined) {
  if (!meta || typeof meta !== 'object') return '';
  return Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

export function Audit() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    get<AuditEvent[]>('/audit')
      .then(setEvents)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Auditoria</h2>
          <p>Quem mexeu no dinheiro, na senha e na nota. Não é SIEM — é o livro de ontem.</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <article className="card table-wrap">
        {events.length === 0 ? (
          <p className="empty">Nenhum evento ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ação</th>
                <th>Quem</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event._id}>
                  <td>{new Date(event.createdAt).toLocaleString('pt-BR')}</td>
                  <td>{ACTION_LABELS[event.action] || event.action}</td>
                  <td>{event.actorLogin || event.targetLogin || '—'}</td>
                  <td className="muted">{metaText(event.meta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
