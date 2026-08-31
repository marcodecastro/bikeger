import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import { formatBRL } from '../lib/money';
import type { Sale } from '../types';

export function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    get<Sale[]>('/sales').then(setSales).catch(() => undefined);
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
      <article className="card table-wrap">
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
                <td>{sale.number}</td>
                <td>{sale.customer?.name || 'Balcão'}</td>
                <td>
                  <span className={sale.status === 'cancelada' ? 'badge danger' : 'badge ok'}>
                    {sale.status}
                  </span>
                </td>
                <td className="money">{formatBRL(sale.total)}</td>
                <td>
                  <Link to={`/vendas/${sale._id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}
