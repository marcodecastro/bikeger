import { useEffect, useState } from 'react';
import { get } from '../lib/api';
import { OS_STATUS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import type { MonthReport } from '../types';

function currentMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function Reports() {
  const initial = currentMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [report, setReport] = useState<MonthReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    get<MonthReport>(`/reports/month?year=${year}&month=${month}`)
      .then(setReport)
      .catch((err: Error) => setError(err.message));
  }, [year, month]);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Relatório do mês</h2>
          <p>Faturamento, margem, oficina e giro. Tudo em centavos, só o dono vê.</p>
        </div>
        <div className="row">
          <label className="field">
            Mês
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            />
          </label>
          <label className="field">
            Ano
            <input type="number" min={2020} value={year} onChange={(event) => setYear(Number(event.target.value))} />
          </label>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {!report ? (
        <p>Carregando...</p>
      ) : (
        <>
          <div className="grid grid-4">
            <article className="card kpi">
              <span>Vendas pagas</span>
              <strong>{formatBRL(report.sales.revenue)}</strong>
              <em>{report.sales.count} cupons</em>
            </article>
            <article className="card kpi">
              <span>Margem das peças</span>
              <strong>{formatBRL(report.sales.margin)}</strong>
              <em>venda − custo</em>
            </article>
            <article className="card kpi">
              <span>OS no mês</span>
              <strong>{formatBRL(report.workshop.revenue)}</strong>
              <em>
                {report.workshop.opened} abertas · {report.workshop.delivered} entregues
              </em>
            </article>
            <article className="card kpi">
              <span>Estoque a custo</span>
              <strong>{formatBRL(report.stock.value)}</strong>
              <em>
                {report.stock.units} un · giro {report.stock.giro.toFixed(2)}
              </em>
            </article>
          </div>

          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <article className="card">
              <h3>Oficina agora</h3>
              {Object.entries(report.workshop.byStatus).map(([status, qty]) => (
                <div className="stack-item stack-item-static" key={status}>
                  <span>{OS_STATUS[status] || status}</span>
                  <b>{qty}</b>
                </div>
              ))}
            </article>
            <article className="card">
              <h3>Compras recebidas</h3>
              <p className="money" style={{ fontSize: 28 }}>
                {formatBRL(report.purchases.total)}
              </p>
              <p className="muted">
                {report.purchases.count} lote(s) · {report.stock.outQty} peças saíram (venda + OS)
              </p>
            </article>
          </div>
        </>
      )}
    </section>
  );
}
