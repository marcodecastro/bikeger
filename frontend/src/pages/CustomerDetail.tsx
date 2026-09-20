import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { OS_STATUS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import type { CustomerHistory } from '../types';
import { Modal } from '../components/Modal';
import { BikeFields } from '../components/BikeFields';

export function CustomerDetail() {
  const { can } = useAuth();
  const { id } = useParams();
  const [data, setData] = useState<CustomerHistory | null>(null);
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState('mtb');

  const [error, setError] = useState('');

  async function load() {
    if (!id) return;
    setData(await get<CustomerHistory>(`/customers/${id}`));
  }

  useEffect(() => {
    void load();
  }, [id]);

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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar a bike');
    }
  }

  return (
    <section className="page">
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
