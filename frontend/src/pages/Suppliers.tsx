import { useEffect, useState } from 'react';
import { get, post, put } from '../lib/api';
import type { Supplier } from '../types';
import { Modal } from '../components/Modal';

const emptyForm = {
  name: '',
  phone: '',
  city: '',
  document: '',
  email: '',
};

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  async function load() {
    try {
      setLoadError('');
      setSuppliers(await get<Supplier[]>('/suppliers'));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar os fornecedores');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function set<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name || '',
      phone: supplier.phone || '',
      city: supplier.city || '',
      document: supplier.document || '',
      email: supplier.email || '',
    });
    setError('');
    setOpen(true);
  }

  async function save() {
    try {
      setError('');
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        document: form.document.trim(),
        email: form.email.trim(),
      };
      if (editing) await put(`/suppliers/${editing._id}`, payload);
      else await post('/suppliers', payload);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o fornecedor');
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Fornecedores</h2>
          <p>Quem abastece a prateleira. A peça aponta para o fornecedor no cadastro.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          Novo fornecedor
        </button>
      </div>
      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}
      <article className="card table-wrap">
        {suppliers.length === 0 && !loadError ? (
          <p className="empty">Nenhum fornecedor cadastrado.</p>
        ) : (
          <table>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier._id}>
                  <td>
                    <button type="button" className="linkish" onClick={() => openEdit(supplier)}>
                      {supplier.name}
                    </button>
                  </td>
                  <td>{supplier.city}</td>
                  <td>{supplier.phone}</td>
                  <td>
                    <button type="button" className="btn" onClick={() => openEdit(supplier)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
      {open ? (
        <Modal title={editing ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={() => setOpen(false)}>
          <div className="grid">
            <label className="field">
              Nome
              <input value={form.name} onChange={(event) => set('name', event.target.value)} />
            </label>
            <label className="field">
              Cidade
              <input value={form.city} onChange={(event) => set('city', event.target.value)} />
            </label>
            <label className="field">
              Telefone
              <input value={form.phone} onChange={(event) => set('phone', event.target.value)} />
            </label>
            <label className="field">
              CNPJ
              <input value={form.document} onChange={(event) => set('document', event.target.value)} />
            </label>
            <label className="field">
              E-mail
              <input value={form.email} onChange={(event) => set('email', event.target.value)} />
            </label>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => void save()}>
              {editing ? 'Salvar alterações' : 'Cadastrar fornecedor'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
