import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../lib/api';
import { OS_STATUS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import type { AgendaData, ReadyNotice } from '../types';

const KIND: Record<string, string> = {
  diagnostico: 'Diagnóstico',
  servico: 'Serviço',
  retirada: 'Retirada',
};

function weekdayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function Agenda() {
  const [weekStart, setWeekStart] = useState(() => new Date().toISOString());
  const [agenda, setAgenda] = useState<AgendaData | null>(null);
  const [notices, setNotices] = useState<ReadyNotice[]>([]);

  async function load(from = weekStart) {
    const [board, pending] = await Promise.all([
      get<AgendaData>(`/agenda?from=${encodeURIComponent(from)}`),
      get<ReadyNotice[]>('/notifications?status=pendente'),
    ]);
    setAgenda(board);
    setNotices(pending);
    setWeekStart(board.from);
  }

  useEffect(() => {
    void load().catch(() => undefined);
  }, []);

  const title = useMemo(() => {
    if (!agenda) return 'Agenda';
    const start = new Date(agenda.from).toLocaleDateString('pt-BR');
    const end = new Date(new Date(agenda.to).getTime() - 1).toLocaleDateString('pt-BR');
    return `${start} — ${end}`;
  }, [agenda]);

  if (!agenda) return <section className="page">Carregando agenda...</section>;

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Agenda</h2>
          <p>Diagnóstico, serviço e retirada. Aviso no WhatsApp quando a bike ficar pronta.</p>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => void load(new Date(new Date(agenda.from).getTime() - 7 * 86400000).toISOString())}
          >
            Semana anterior
          </button>
          <button type="button" className="btn" onClick={() => void load(new Date().toISOString())}>
            Hoje
          </button>
          <button type="button" className="btn" onClick={() => void load(agenda.to)}>
            Próxima
          </button>
        </div>
      </div>

      <p className="muted">{title}</p>

      {notices.length ? (
        <article className="card" style={{ marginBottom: 16 }}>
          <h3>Avisar cliente — OS pronta</h3>
          {notices.map((notice) => (
            <div className="stack-item stack-item-static" key={notice._id}>
              <div>
                <strong>{notice.workOrder?.number || 'OS'}</strong>
                <div className="muted">{notice.message}</div>
                {notice.errorMessage ? <div className="muted">{notice.errorMessage}</div> : null}
              </div>
              <div className="row">
                {notice.waUrl ? (
                  <a
                    className="btn btn-primary"
                    href={notice.waUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => void post(`/notifications/${notice._id}/sent`)}
                  >
                    WhatsApp
                  </a>
                ) : (
                  <span className="badge warn">sem telefone</span>
                )}
              </div>
            </div>
          ))}
        </article>
      ) : null}

      <div className="agenda-week">
        {agenda.days.map((day) => (
          <article className="card agenda-day" key={day.key}>
            <h3>{weekdayLabel(day.date)}</h3>
            {day.items.length === 0 ? <p className="empty">Livre</p> : null}
            {day.items.map((order) => (
              <Link className="os-card" key={order._id} to={`/oficina/${order._id}`}>
                <strong>{order.number}</strong>
                <span className="os-card-line">{order.customer?.name}</span>
                <span className="os-card-line">
                  {order.bike?.brand} {order.bike?.model}
                </span>
                <span className="muted">{KIND[order.scheduleKind || 'servico']}</span>
                <span className="badge info">{OS_STATUS[order.status] || order.status}</span>
              </Link>
            ))}
          </article>
        ))}
      </div>

      {agenda.unscheduledReady.length ? (
        <article className="card" style={{ marginTop: 16 }}>
          <h3>Prontas sem horário de retirada</h3>
          {agenda.unscheduledReady.map((order) => (
            <Link className="stack-item" key={order._id} to={`/oficina/${order._id}`}>
              <div className="stack-copy">
                <strong>{order.number}</strong>
                <span>{order.customer?.name}</span>
              </div>
              <span className="money">{formatBRL(order.total)}</span>
            </Link>
          ))}
        </article>
      ) : null}
    </section>
  );
}
