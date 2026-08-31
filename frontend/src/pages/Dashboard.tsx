import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { OS_STATUS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import type { DashboardData } from '../types';

export function Dashboard() {
  const { can } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    get<DashboardData>('/dashboard')
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <section className="page">
        <p className="error">{error}. Confira se o MongoDB e a API estão no ar.</p>
      </section>
    );
  }

  if (!data) return <section className="page">Carregando painel...</section>;

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Painel da loja</h2>
          <p>Vendas, oficina e estoque no mesmo lugar. Valores sempre em centavos.</p>
        </div>
        {can('pos') ? (
          <Link className="btn btn-primary" to="/pdv">
            Abrir PDV
          </Link>
        ) : (
          <Link className="btn btn-primary" to="/oficina">
            Ir para oficina
          </Link>
        )}
      </div>

      <div className="grid grid-4">
        {can('sales') ? (
          <article className="card kpi">
            <span>Faturamento de hoje</span>
            <strong>{formatBRL(data.today.revenue)}</strong>
            <em>{data.today.salesCount} vendas pagas</em>
          </article>
        ) : (
          <article className="card kpi">
            <span>Seu turno</span>
            <strong>Oficina</strong>
            <em>Peça lançada já baixa o estoque</em>
          </article>
        )}
        {can('sales') ? (
          <article className="card kpi">
            <span>Margem estimada</span>
            <strong>{formatBRL(data.today.estimatedProfit)}</strong>
            <em>venda − custo das peças</em>
          </article>
        ) : (
          <article className="card kpi">
            <span>OS em andamento</span>
            <strong>{data.openOrders.length}</strong>
            <em>foque no diagnóstico e nas peças</em>
          </article>
        )}
        <article className="card kpi">
          <span>OS em andamento</span>
          <strong>{data.openOrders.length}</strong>
          <em>{data.workshop.pronta || 0} prontas para entrega</em>
        </article>
        <article className="card kpi">
          <span>Clientes</span>
          <strong>{data.customers}</strong>
          <em>{data.register ? 'Caixa aberto' : 'Caixa fechado'}</em>
        </article>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Estoque no osso</h3>
          {data.lowStock.length === 0 ? (
            <p className="empty">Nenhum item abaixo do mínimo.</p>
          ) : (
            <div className="stack-list">
              {data.lowStock.map((product) => (
                <Link className="stack-item" key={product._id} to={`/produtos/${product._id}`}>
                  <div className="stack-copy">
                    <strong>{product.name}</strong>
                    <span className="muted">{product.sku}</span>
                  </div>
                  <div className="stack-meta">
                    <b>
                      {product.currentStock}
                      <span className="muted"> {product.unit}</span>
                    </b>
                    <span className="badge warn">mín. {product.minStock}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <h3>Oficina agora</h3>
          {data.openOrders.length === 0 ? (
            <p className="empty">Nenhuma OS aberta.</p>
          ) : (
            <div className="stack-list">
              {data.openOrders.map((order) => (
                <Link className="stack-item" key={order._id} to={`/oficina/${order._id}`}>
                  <div className="stack-copy">
                    <strong>{order.number}</strong>
                    <span>{order.customer?.name}</span>
                    <span className="muted">
                      {order.bike?.brand} {order.bike?.model}
                    </span>
                  </div>
                  <div className="stack-meta">
                    <span className="badge info">{OS_STATUS[order.status] || order.status}</span>
                    <span className="money">{formatBRL(order.total)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </article>
      </div>

      {data.pendingNotices?.length ? (
        <article className="card" style={{ marginTop: 16 }}>
          <h3>Bikes prontas — avisar no WhatsApp</h3>
          {data.pendingNotices.map((notice) => (
            <div className="stack-item stack-item-static" key={notice._id}>
              <div className="stack-copy">
                <strong>{notice.workOrder?.number || 'OS'}</strong>
                <span className="muted">{notice.message}</span>
                {notice.errorMessage ? <span className="muted">{notice.errorMessage}</span> : null}
              </div>
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
          ))}
        </article>
      ) : null}

      {can('sales') && data.monthMarginByCategory?.length ? (
        <article className="card" style={{ marginTop: 16 }}>
          <h3>Margem por categoria — este mês</h3>
          <p className="muted">Venda menos custo, já descontada a devolução. Hoje no KPI acima.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Peças</th>
                  <th>Receita</th>
                  <th>Custo</th>
                  <th>Margem</th>
                </tr>
              </thead>
              <tbody>
                {(data.monthMarginByCategory || []).map((row) => (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    <td>{row.quantity}</td>
                    <td className="money">{formatBRL(row.revenue)}</td>
                    <td className="money">{formatBRL(row.cost)}</td>
                    <td className="money">{formatBRL(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.marginByCategory?.length ? (
            <p className="muted" style={{ marginTop: 12 }}>
              Hoje:{' '}
              {data.marginByCategory
                .map((row) => `${row.category} ${formatBRL(row.profit)}`)
                .join(' · ')}
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>
              Nenhuma venda paga hoje nesta conta.
            </p>
          )}
        </article>
      ) : null}
    </section>
  );
}
