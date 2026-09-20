import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { OS_STATUS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import type { CustomerHistory } from '../types';
import { Modal } from '../components/Modal';
import { BikeFields } from '../components/BikeFields';

const HISTORY_PAGE = 50;

function historyPath(id: string, salesLimit: number, ordersLimit: number) {
  const params = new URLSearchParams();
  params.set('salesLimit', String(salesLimit));
  params.set('ordersLimit', String(ordersLimit));
  return `/customers/${id}?${params}`;
}

export function CustomerDetail() {
  const { can } = useAuth();
  const { id } = useParams();
  const [data, setData] = useState<CustomerHistory | null>(null);
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState('mtb');
  const [loadingMore, setLoadingMore] = useState<'sales' | 'orders' | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  async function load(salesLimit = HISTORY_PAGE, ordersLimit = HISTORY_PAGE) {
    if (!id) return;
    try {
      setLoadError('');
      setData(await get<CustomerHistory>(historyPath(id, salesLimit, ordersLimit)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar a ficha');
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  if (!data && loadError) {
    return (
      <section className="page">
        <p className="error" role="alert">
          {loadError}
        </p>
      </section>
    );
  }

  if (!data) return <section className="page">Carregando ficha...</section>;

  async function addBike() {
    try {
      setError('');
      if (!brand.trim() || !model.trim()) {
        setError('Informe marca e modelo da bike.');
        return;
      }
      await post('/bikes', { customer: id, brand: brand.trim(), model: model.trim(), type });
      setOpen(false);
      setBrand('');
      setModel('');
      setType('mtb');
      await load(Math.max(HISTORY_PAGE, data.sales.length), Math.max(HISTORY_PAGE, data.orders.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar a bike');
    }
  }

  async function loadMore(kind: 'sales' | 'orders') {
    if (!id || loadingMore) return;
    try {
      setLoadingMore(kind);
      const salesLimit = kind === 'sales' ? data.sales.length + HISTORY_PAGE : Math.max(HISTORY_PAGE, data.sales.length);
      const ordersLimit = kind === 'orders' ? data.orders.length + HISTORY_PAGE : Math.max(HISTORY_PAGE, data.orders.length);
      await load(salesLimit, ordersLimit);
    } finally {
      setLoadingMore(null);
    }
  }

  return (
    <section className="page">
      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}
      <div className="page-head">
        <div>
          <h2>{data.customer.name}</h2>
          <p>
            {data.customer.phone} · {data.customer.email}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Cadastrar bike
        </button>
      </div>

      <div className="grid grid-3">
        <article className="card kpi">
          <span>Valor de vida</span>
          <strong>{formatBRL(data.lifetimeValue)}</strong>
        </article>
        <article className="card kpi">
          <span>Em compras</span>
          <strong>{formatBRL(data.salesTotal)}</strong>
        </article>
        <article className="card kpi">
          <span>Em oficina</span>
          <strong>{formatBRL(data.ordersTotal)}</strong>
        </article>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Bicicletas</h3>
          {data.bikes.map((bike) => (
            <div key={bike._id} className="cart-line">
              <div>
                <Link to={`/bikes/${bike._id}`}>
                  {bike.brand} {bike.model}
                </Link>
                <div className="muted">
                  {bike.color} · {bike.serialNumber || 's/ série'}
                </div>
              </div>
              <span className="badge">{bike.type}</span>
            </div>
          ))}
        </article>
        <article className="card">
          <h3>Ordens de serviço</h3>
          {data.orders.map((order) => (
            <div key={order._id} className="cart-line">
              <div>
                <Link to={`/oficina/${order._id}`}>{order.number}</Link>
                <div className="muted">{OS_STATUS[order.status]}</div>
              </div>
              <span className="money">{formatBRL(order.total)}</span>
            </div>
          ))}
          {data.ordersHasMore ? (
            <button
              type="button"
              className="btn"
              disabled={loadingMore === 'orders'}
              onClick={() => void loadMore('orders')}
            >
              Ver mais OS
            </button>
          ) : null}
        </article>
      </div>

      {can('sales') ? (
      <article className="card table-wrap" style={{ marginTop: 16 }}>
        <h3>Compras no balcão</h3>
        <table>
          <tbody>
            {data.sales.map((sale) => (
              <tr key={sale._id}>
                <td>
                  <Link to={`/vendas/${sale._id}`}>{sale.number}</Link>
                </td>
                <td>{new Date(sale.createdAt).toLocaleDateString('pt-BR')}</td>
                <td className="money">{formatBRL(sale.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.salesHasMore ? (
          <button
            type="button"
            className="btn"
            disabled={loadingMore === 'sales'}
            onClick={() => void loadMore('sales')}
          >
            Ver mais compras
          </button>
        ) : null}
      </article>
      ) : null}

      {open ? (
        <Modal title="Nova bicicleta" onClose={() => setOpen(false)}>
          <div className="grid">
            <BikeFields
              brand={brand}
              model={model}
              type={type}
              onBrand={setBrand}
              onModel={setModel}
              onType={setType}
            />
            {error ? (
              <p className="error" role="alert" aria-live="polite">
                {error}
              </p>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => void addBike()}>
              Salvar bike
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
