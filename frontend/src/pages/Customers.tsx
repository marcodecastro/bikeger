import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Customer } from '../types';
import { Modal } from '../components/Modal';

export function Customers() {
  const { can } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');

  async function load() {
    const list = await get<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    setCustomers(list);
  }

  useEffect(() => {
    void load();
  }, [q]);

  async function create() {
    await post('/customers', { name, phone, email, document });
    setOpen(false);
    setName('');
    setPhone('');
    setEmail('');
    setDocument('');
    await load();
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
            <button type="button" className="btn btn-primary" onClick={() => void create()}>
              Salvar
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
