import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import type { Supplier } from '../types';
import { Modal } from '../components/Modal';

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');

  async function load() {
    setSuppliers(await get<Supplier[]>('/suppliers'));
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Fornecedores</h2>
          <p>Quem abastece a prateleira. A peça aponta para o fornecedor no cadastro.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          Novo fornecedor
        </button>
      </div>
      <article className="card table-wrap">
        <table>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier._id}>
                <td>{supplier.name}</td>
                <td>{supplier.city}</td>
                <td>{supplier.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      {open ? (
        <Modal title="Fornecedor" onClose={() => setOpen(false)}>
          <div className="grid">
            <label className="field">
              Nome
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="field">
              Cidade
              <input value={city} onChange={(event) => setCity(event.target.value)} />
            </label>
            <label className="field">
              Telefone
              <input value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                await post('/suppliers', { name, phone, city });
                setOpen(false);
                await load();
              }}
            >
              Salvar
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
