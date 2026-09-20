import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post } from '../lib/api';
import { OS_KANBAN, OS_STATUS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import type { Bike, Customer, WorkOrder } from '../types';
import { Modal } from '../components/Modal';
import { EntitySearch } from '../components/EntitySearch';
import { BikeFields } from '../components/BikeFields';

interface WorkOrderBoard {
  counts: Record<string, number>;
  columns: Record<string, WorkOrder[]>;
}

export function Workshop() {
  const navigate = useNavigate();
  const [board, setBoard] = useState<WorkOrderBoard | null>(null);
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerLabel, setCustomerLabel] = useState('');
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [bikeId, setBikeId] = useState('');
  const [complaint, setComplaint] = useState('');
  const [mechanic, setMechanic] = useState('');
  const [mechanicNames, setMechanicNames] = useState<string[]>(['Oficina']);
  const [scheduledAt, setScheduledAt] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState('mtb');
  const [error, setError] = useState('');

  const searchCustomers = useCallback(
    (q: string) => get<Customer[]>(`/customers?q=${encodeURIComponent(q)}`),
    [],
  );

  async function load() {
    setBoard(await get<WorkOrderBoard>('/work-orders/board'));
  }

  useEffect(() => {
    void load();
    get<{ mechanicNames: string[] }>('/work-orders/mechanics')
      .then((data) => setMechanicNames(data.mechanicNames || ['Oficina']))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!customerId) {
      setBikes([]);
      setBikeId('');
      setBrand('');
      setModel('');
      return;
    }
    get<Bike[]>(`/bikes?customer=${customerId}`).then(setBikes).catch(() => undefined);
  }, [customerId]);

  async function create() {
    try {
      setError('');
      let selectedBike = bikeId;
      if (!selectedBike && brand.trim() && model.trim() && customerId) {
        const created = await post<Bike>('/bikes', {
          customer: customerId,
          brand: brand.trim(),
          model: model.trim(),
          type,
        });
        selectedBike = created._id;
      }
      const order = await post<WorkOrder>('/work-orders', {
        customer: customerId,
        bike: selectedBike,
        complaint,
        mechanic,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        scheduleKind: 'servico',
      });
      navigate(`/oficina/${order._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir OS');
    }
  }

  const columns = OS_KANBAN;
  const counts = board?.counts || {};
  const lists = board?.columns || {};

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Oficina</h2>
          <p>Peça entra reservada. Marque a data na agenda e avise quando ficar pronta.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          Nova OS
        </button>
      </div>

      <div className="kanban">
        {columns.map((status) => (
          <div className="kanban-col" key={status}>
            <h3>
              {OS_STATUS[status]} · {counts[status] || 0}
            </h3>
            {(lists[status] || []).map((order) => (
              <Link className="os-card" key={order._id} to={`/oficina/${order._id}`}>
                <strong>{order.number}</strong>
                <span className="os-card-line">{order.customer?.name}</span>
                <span className="os-card-line">
                  {order.bike?.brand} {order.bike?.model}
                </span>
                <span className="os-card-price money">{formatBRL(order.total)}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>

      {open ? (
        <Modal title="Abrir ordem de serviço" onClose={() => setOpen(false)}>
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
            <label className="field">
              Bicicleta
              <select value={bikeId} onChange={(event) => setBikeId(event.target.value)}>
                <option value="">{bikes.length ? 'Selecione' : 'Nenhuma bike neste cliente'}</option>
                {bikes.map((bike) => (
                  <option key={bike._id} value={bike._id}>
                    {bike.brand} {bike.model}
                  </option>
                ))}
              </select>
            </label>
            {customerId && !bikeId ? (
              <>
                <p className="muted" style={{ margin: 0 }}>
                  {bikes.length
                    ? 'Ou cadastre outra bike agora, se a que chegou ainda não está na ficha.'
                    : 'Cadastre a bike para abrir a OS.'}
                </p>
                <BikeFields
                  brand={brand}
                  model={model}
                  type={type}
                  onBrand={setBrand}
                  onModel={setModel}
                  onType={setType}
                />
              </>
            ) : null}
            <label className="field">
              Relato
              <textarea value={complaint} onChange={(event) => setComplaint(event.target.value)} />
            </label>
            <label className="field">
              Mecânico
              <input
                value={mechanic}
                list="mechanic-names"
                onChange={(event) => setMechanic(event.target.value)}
              />
              <datalist id="mechanic-names">
                {mechanicNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <label className="field">
              Data na agenda
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </label>
            {error ? (
              <p className="error" role="alert" aria-live="polite">
                {error}
              </p>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => void create()}>
              Abrir OS
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
