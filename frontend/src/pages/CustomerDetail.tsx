import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post, put } from '../lib/api';
import type { Customer, CustomerHistory } from '../types';
import { useAuth } from '../lib/auth';
import { OS_STATUS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import { Modal } from '../components/Modal';
import { BikeFields } from '../components/BikeFields';
import {
  addressFromCustomer,
  addressPayload,
  emptyAddress,
  CustomerAddressFields,
  type CustomerAddressForm,
} from '../components/CustomerAddressFields';

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
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState('');
  const [formId, setFormId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState<CustomerAddressForm>(emptyAddress);
  const canEdit = can('customers');

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

  if (formId !== data.customer._id) {
    setFormId(data.customer._id);
    setName(data.customer.name || '');
    setPhone(data.customer.phone || '');
    setEmail(data.customer.email || '');
    setDocument(data.customer.document || '');
    setNotes(data.customer.notes || '');
    setAddress(addressFromCustomer(data.customer));
    setSaveError('');
    setSaved('');
  }

  async function addBike() {
    if (!data) return;
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

  async function saveCustomer() {
    if (!id || !data) return;
    try {
      setSaveError('');
      setSaved('');
      if (!name.trim()) {
        setSaveError('Informe o nome do cliente.');
        return;
      }
      const savedCustomer = await put<Customer>(`/customers/${id}`, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        document: document.trim(),
        notes: notes.trim(),
        address: addressPayload(address),
      });
      setName(savedCustomer.name || '');
      setPhone(savedCustomer.phone || '');
      setEmail(savedCustomer.email || '');
      setDocument(savedCustomer.document || '');
      setNotes(savedCustomer.notes || '');
      setAddress(addressFromCustomer(savedCustomer));
      setData((current) =>
        current ? { ...current, customer: { ...current.customer, ...savedCustomer } } : current,
      );
      setSaved('Cadastro atualizado.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Falha ao salvar o cliente');
    }
  }

  async function loadMore(kind: 'sales' | 'orders') {
    if (!id || !data || loadingMore) return;
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

      {canEdit ? (
        <article className="card" style={{ marginBottom: 16 }}>
          <h3>Cadastro</h3>
          <div className="grid grid-2">
            <label className="field">
              Nome
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="field">
              Telefone
              <input value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
            <label className="field">
              E-mail
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="field">
              CPF
              <input value={document} onChange={(event) => setDocument(event.target.value)} />
            </label>
            <h3 style={{ gridColumn: '1 / -1', margin: '8px 0 0' }}>Endereço</h3>
            <p className="muted" style={{ gridColumn: '1 / -1', margin: 0 }}>
              A NFC-e usa a UF para o CFOP. Sem cidade e CEP a SEFAZ recusa ou emite errado.
            </p>
            <CustomerAddressFields address={address} onChange={setAddress} />
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              Observações
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>
          {saveError ? (
            <p className="error" role="alert">
              {saveError}
            </p>
          ) : null}
          {saved ? (
            <p className="muted" role="status">
              {saved}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => void saveCustomer()}
          >
            Salvar alterações
          </button>
        </article>
      ) : null}

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
