import { useEffect, useState } from 'react';
import { get, post, put } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatBRL } from '../lib/money';
import type { CatalogService } from '../types';
import { MoneyInput } from '../components/MoneyInput';
import { Modal } from '../components/Modal';

export function Services() {
  const { can } = useAuth();
  const canEdit = can('products.write') || can('services.write');
  const [services, setServices] = useState<CatalogService[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogService | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  async function load() {
    try {
      setLoadError('');
      setServices(await get<CatalogService[]>('/services'));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar os serviços');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setName('');
    setPrice(0);
    setMinutes(30);
    setError('');
    setOpen(true);
  }

  function openEdit(service: CatalogService) {
    setEditing(service);
    setName(service.name);
    setPrice(service.price);
    setMinutes(service.estimatedMinutes);
    setError('');
    setOpen(true);
  }

  async function save() {
    try {
      setError('');
      const payload = { name: name.trim(), price, estimatedMinutes: minutes };
      if (editing) await put(`/services/${editing._id}`, payload);
      else await post('/services', payload);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o serviço');
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Serviços da oficina</h2>
          <p>Tabela padrão de mão de obra. O preço vira snapshot na OS.</p>
        </div>
        {canEdit ? (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Novo serviço
          </button>
        ) : null}
      </div>
      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}
      <article className="card table-wrap">
        {services.length === 0 && !loadError ? (
          <p className="empty">Nenhum serviço cadastrado.</p>
        ) : (
          <table>
            <tbody>
              {services.map((service) => (
                <tr key={service._id}>
                  <td>
                    {canEdit ? (
                      <button type="button" className="linkish" onClick={() => openEdit(service)}>
                        {service.name}
                      </button>
                    ) : (
                      service.name
                    )}
                    <div className="muted">{service.estimatedMinutes} min</div>
                  </td>
                  <td className="money">{formatBRL(service.price)}</td>
                  {canEdit ? (
                    <td>
                      <div className="row">
                        <button type="button" className="btn" onClick={() => openEdit(service)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={async () => {
                            await put(`/services/${service._id}`, { active: !service.active });
                            await load();
                          }}
                        >
                          {service.active ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
      {open ? (
        <Modal title={editing ? 'Editar serviço' : 'Novo serviço'} onClose={() => setOpen(false)}>
          <div className="grid">
            <label className="field">
              Nome
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <MoneyInput label="Preço" valueCents={price} onChangeCents={setPrice} />
            <label className="field">
              Minutos
              <input type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
            </label>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => void save()}>
              {editing ? 'Salvar alterações' : 'Cadastrar serviço'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
