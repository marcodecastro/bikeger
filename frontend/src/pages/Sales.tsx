import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import { SALE_STATUS } from '../lib/labels';
import { dayEndIso, dayStartIso, pageHasMore, pagedPath } from '../lib/listPage';
import { formatBRL } from '../lib/money';
import type { Customer, Sale } from '../types';
import { EntitySearch } from '../components/EntitySearch';
import { LoadMore } from '../components/LoadMore';

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
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerLabel, setCustomerLabel] = useState('');

  const searchCustomers = useCallback(
    (query: string) => get<Customer[]>(`/customers?q=${encodeURIComponent(query)}`),
    [],
  );

  function extra() {
    const params: Record<string, string> = {};
    if (q.trim()) params.q = q.trim();
    if (status) params.status = status;
    if (customerId) params.customer = customerId;
    if (from) params.from = dayStartIso(from);
    if (to) params.to = dayEndIso(to);
    return params;
  }

  useEffect(() => {
    const delay = q.trim() ? 160 : 0;
    const timer = window.setTimeout(() => {
      get<Sale[]>(pagedPath('/sales', 0, extra()))
        .then((list) => {
          setLoadError('');
          setSales(list);
          setHasMore(pageHasMore(list));
        })
        .catch((err: unknown) => {
          setLoadError(err instanceof Error ? err.message : 'Falha ao carregar as vendas');
        });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [q, status, from, to, customerId]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      setLoadError('');
      const list = await get<Sale[]>(pagedPath('/sales', sales.length, extra()));
      setSales((current) => [...current, ...list]);
      setHasMore(pageHasMore(list));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar as vendas');
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = Boolean(q.trim() || status || from || to || customerId);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Vendas</h2>
          <p>Cada cupom já baixou estoque. Cancelar devolve as peças ao kardex.</p>
        </div>
        <Link className="btn btn-primary" to="/pdv">
          Novo cupom
        </Link>
      </div>
      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="row filters">
        <label className="field field-grow">
          Cupom
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="VD-00001" />
        </label>
        <EntitySearch
          label="Cliente"
          placeholder="Nome, telefone ou documento"
          emptyLabel="Todos"
          value={customerId}
          selectedLabel={customerLabel}
          fetchItems={searchCustomers}
          getKey={(item) => item._id}
          getLabel={(item) => item.name}
          getExtra={(item) => item.phone}
          onSelect={(item) => {
            setCustomerId(item?._id || '');
            setCustomerLabel(item?.name || '');
          }}
        />
        <label className="field">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            {Object.entries(SALE_STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
        {sales.length === 0 && !loadError ? (
          <p className="empty">
            {filtered
              ? 'Nenhuma venda neste filtro.'
              : 'Nenhuma venda ainda. Abra o PDV para registrar o primeiro cupom.'}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Quando</th>
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
                  <td>
                    {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td>{sale.customer?.name || 'Balcão'}</td>
                  <td>
                    <span className={sale.status === 'cancelada' ? 'badge danger' : 'badge ok'}>
                      {SALE_STATUS[sale.status] || sale.status}
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
        <LoadMore hasMore={hasMore} loading={loadingMore} onClick={() => void loadMore()} />
      </article>
    </section>
  );
}
