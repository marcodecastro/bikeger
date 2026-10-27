import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import { formatBRL } from '../lib/money';
import type { Sale } from '../types';

function saleTotalLabel(cents: number) {
  try {
    return formatBRL(cents);
  } catch {
    return '—';
  }
}

export function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    get<Sale[]>('/sales')
      .then((list) => {
        setLoadError('');
        setSales(list);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Falha ao carregar as vendas');
      });
  }, []);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Vendas</h2>
          <p>Cada cupom já baixou estoque. Cancelar devolve as peças ao kardex.</p>
        </div>
        <Link className="btn btn-primary" to="/pdv">
          Nova venda
        </Link>
      </div>
      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}
      <article className="card table-wrap">
        {sales.length === 0 && !loadError ? (
          <p className="empty">Nenhuma venda ainda. Abra o PDV para registrar o primeiro cupom.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Status</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale._id}>
                  <td>
                    <Link to={`/vendas/${sale._id}`}>{sale.number}</Link>
                  </td>
                  <td>{sale.customer?.name || 'Balcão'}</td>
                  <td>
                    <span className={sale.status === 'cancelada' ? 'badge danger' : 'badge ok'}>
                      {sale.status}
                    </span>
                  </td>
                  <td className="money">{saleTotalLabel(sale.total)}</td>
                  <td>
                    <Link className="btn btn-ghost" to={`/vendas/${sale._id}`}>
                      Abrir cupom
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
