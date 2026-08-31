import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post } from '../lib/api';
import { OS_KANBAN, OS_STATUS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import type { Bike, Customer, WorkOrder } from '../types';
import { Modal } from '../components/Modal';

export function Workshop() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [bikeId, setBikeId] = useState('');
  const [complaint, setComplaint] = useState('');
  const [mechanic, setMechanic] = useState('');
  const [mechanicNames, setMechanicNames] = useState<string[]>(['Oficina']);
  const [scheduledAt, setScheduledAt] = useState('');

  async function load() {
    setOrders(await get<WorkOrder[]>('/work-orders'));
  }

  useEffect(() => {
    void load();
    get<Customer[]>('/customers').then(setCustomers).catch(() => undefined);
    get<{ mechanicNames: string[] }>('/work-orders/mechanics')
      .then((data) => setMechanicNames(data.mechanicNames || ['Oficina']))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!customerId) {
      setBikes([]);
      return;
    }
    get<Bike[]>(`/bikes?customer=${customerId}`).then(setBikes).catch(() => undefined);
  }, [customerId]);

  async function create() {
    const order = await post<WorkOrder>('/work-orders', {
      customer: customerId,
      bike: bikeId,
      complaint,
      mechanic,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      scheduleKind: 'servico',
    });
    navigate(`/oficina/${order._id}`);
  }

      const columns = OS_KANBAN;

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
              {OS_STATUS[status]} · {orders.filter((order) => order.status === status).length}
            </h3>
            {orders
              .filter((order) => order.status === status)
              .map((order) => (
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
            <label className="field">
              Cliente
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">Selecione</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Bicicleta
              <select value={bikeId} onChange={(event) => setBikeId(event.target.value)}>
                <option value="">Selecione</option>
                {bikes.map((bike) => (
                  <option key={bike._id} value={bike._id}>
                    {bike.brand} {bike.model}
                  </option>
                ))}
              </select>
            </label>
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
            <button type="button" className="btn btn-primary" onClick={() => void create()}>
              Abrir OS
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
