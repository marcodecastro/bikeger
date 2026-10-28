import { useEffect, useState } from 'react';
import { get } from '../lib/api';
import { dayEndIso, dayStartIso, pageHasMore, pagedPath } from '../lib/listPage';
import type { AuditEvent } from '../types';
import { LoadMore } from '../components/LoadMore';

export const ACTION_LABELS: Record<string, string> = {
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
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  function extra() {
    const params: Record<string, string> = {};
    if (action) params.action = action;
    if (q.trim()) params.q = q.trim();
    if (from) params.from = dayStartIso(from);
    if (to) params.to = dayEndIso(to);
    return params;
  }

  useEffect(() => {
    const delay = q.trim() ? 160 : 0;
    const timer = window.setTimeout(() => {
      get<AuditEvent[]>(pagedPath('/audit', 0, extra()))
        .then((list) => {
          setError('');
          setEvents(list);
          setHasMore(pageHasMore(list));
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Falha ao carregar a auditoria');
        });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [action, q, from, to]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      setError('');
      const list = await get<AuditEvent[]>(pagedPath('/audit', events.length, extra()));
      setEvents((current) => [...current, ...list]);
      setHasMore(pageHasMore(list));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a auditoria');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Auditoria</h2>
          <p>Quem mexeu no dinheiro, na senha e na nota. Não é SIEM — é o livro de ontem.</p>
        </div>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="row filters">
        <label className="field">
          Ação
          <select value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="">Todas</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-grow">
          Quem
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="dono, balcão..." />
        </label>
        <label className="field">
          De
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field">
          Até
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>

      <article className="card table-wrap">
        {events.length === 0 && !error ? (
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
        <LoadMore hasMore={hasMore} loading={loadingMore} onClick={() => void loadMore()} />
      </article>
    </section>
  );
}
