import { useEffect, useState } from 'react';
import { get, post, put } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatBRL } from '../lib/money';
import type { CatalogService } from '../types';
import { MoneyInput } from '../components/MoneyInput';
import { Modal } from '../components/Modal';

export function Services() {
  const { can } = useAuth();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [minutes, setMinutes] = useState(30);

  async function load() {
    setServices(await get<CatalogService[]>('/services'));
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    await post('/services', { name, price, estimatedMinutes: minutes });
    setOpen(false);
    await load();
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Serviços da oficina</h2>
          <p>Tabela padrão de mão de obra. O preço vira snapshot na OS.</p>
        </div>
        {can('products.write') ? (
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            Novo serviço
          </button>
        ) : null}
      </div>
      <article className="card table-wrap">
        <table>
          <tbody>
            {services.map((service) => (
              <tr key={service._id}>
                <td>
                  {service.name}
                  <div className="muted">{service.estimatedMinutes} min</div>
                </td>
                <td className="money">{formatBRL(service.price)}</td>
                {can('products.write') ? (
                  <td>
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
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      {open ? (
        <Modal title="Novo serviço" onClose={() => setOpen(false)}>
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
            <button type="button" className="btn btn-primary" onClick={() => void create()}>
              Salvar
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
