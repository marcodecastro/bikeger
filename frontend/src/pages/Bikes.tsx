import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post } from '../lib/api';
import { BIKE_TYPES } from '../lib/labels';
import type { Bike, Customer } from '../types';
import { Modal } from '../components/Modal';
import { EntitySearch } from '../components/EntitySearch';
import { BikeFields } from '../components/BikeFields';

export function Bikes() {
  const navigate = useNavigate();
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerLabel, setCustomerLabel] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState('mtb');
  const [error, setError] = useState('');

  const searchCustomers = useCallback(
    (query: string) => get<Customer[]>(`/customers?q=${encodeURIComponent(query)}`),
    [],
  );

  async function load() {
    const list = await get<Bike[]>(`/bikes${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    setBikes(list);
  }

  useEffect(() => {
    void load().catch(() => undefined);
  }, [q]);

  async function create() {
    try {
      setError('');
      if (!customerId) {
        setError('Escolha o cliente dono da bike.');
        return;
      }
      if (!brand.trim() || !model.trim()) {
        setError('Informe marca e modelo.');
        return;
      }
      const bike = await post<Bike>('/bikes', {
        customer: customerId,
        brand: brand.trim(),
        model: model.trim(),
        type,
      });
      setOpen(false);
      navigate(`/bikes/${bike._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar a bike');
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Bicicletas</h2>
          <p>Cada bike tem dono, série e um histórico de peças trocadas na oficina.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          Nova bike
        </button>
      </div>
      <label className="field" style={{ maxWidth: 360, marginBottom: 16 }}>
        Buscar
        <input value={q} onChange={(event) => setQ(event.target.value)} />
      </label>
      <article className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Bike</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Série</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bikes.map((bike) => (
              <tr key={bike._id}>
                <td>
                  {bike.brand} {bike.model}
                </td>
                <td>{typeof bike.customer === 'object' ? bike.customer.name : ''}</td>
                <td>{BIKE_TYPES[bike.type] || bike.type}</td>
                <td>{bike.serialNumber}</td>
                <td>
                  <Link to={`/bikes/${bike._id}`}>Histórico</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      {open ? (
        <Modal title="Nova bicicleta" onClose={() => setOpen(false)}>
          <div className="grid">
            <EntitySearch
              label="Cliente"
              placeholder="Nome, telefone ou documento"
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
              Salvar bike
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
