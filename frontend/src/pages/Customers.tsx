import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Customer } from '../types';
import { Modal } from '../components/Modal';
import { BikeFields } from '../components/BikeFields';

export function Customers() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState('mtb');
  const [error, setError] = useState('');

  async function load() {
    const list = await get<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    setCustomers(list);
  }

  useEffect(() => {
    void load();
  }, [q]);

  async function create() {
    try {
      setError('');
      const customer = await post<Customer>('/customers', { name, phone, email, document });
      if (brand.trim() && model.trim()) {
        await post('/bikes', { customer: customer._id, brand: brand.trim(), model: model.trim(), type });
      }
      setOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setDocument('');
      setBrand('');
      setModel('');
      setType('mtb');
      await load();
      navigate(`/clientes/${customer._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o cliente');
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Clientes</h2>
          <p>Ficha com bikes, compras e OS. O histórico mora no cadastro, não em planilha.</p>
        </div>
        {can('customers') ? (
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            Novo cliente
          </button>
        ) : null}
      </div>
      <label className="field" style={{ maxWidth: 360, marginBottom: 16 }}>
        Buscar
        <input value={q} onChange={(event) => setQ(event.target.value)} />
      </label>
      <article className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Documento</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer._id}>
                <td>{customer.name}</td>
                <td>{customer.phone}</td>
                <td>{customer.document}</td>
                <td>
                  <Link to={`/clientes/${customer._id}`}>Ficha</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      {open ? (
        <Modal title="Novo cliente" onClose={() => setOpen(false)}>
          <div className="grid">
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
            <h3 style={{ margin: '8px 0 0' }}>Bicicleta (opcional)</h3>
            <p className="muted" style={{ margin: 0 }}>
              Se já souber a bike, cadastre agora. Dá para incluir depois na ficha.
            </p>
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
            <button type="button" className="btn btn-primary" onClick={() => void create()}>
              Salvar
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
