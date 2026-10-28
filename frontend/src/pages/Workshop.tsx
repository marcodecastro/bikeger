import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post } from '../lib/api';
import { OS_KANBAN, OS_STATUS } from '../lib/labels';
import { pageHasMore, pagedPath } from '../lib/listPage';
import { formatBRL } from '../lib/money';
import { useBusy } from '../lib/useBusy';
import type { Bike, Customer, WorkOrder } from '../types';
import { LoadMore } from '../components/LoadMore';
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
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [hits, setHits] = useState<WorkOrder[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { busy, run } = useBusy();
  const filtered = Boolean(q.trim() || status);

  function extra() {
    const params: Record<string, string> = {};
    if (q.trim()) params.q = q.trim();
    if (status) params.status = status;
    return params;
  }

  const searchCustomers = useCallback(
    (q: string) => get<Customer[]>(`/customers?q=${encodeURIComponent(q)}`),
    [],
  );

  async function load() {
    try {
      setLoadError('');
      setBoard(await get<WorkOrderBoard>('/work-orders/board'));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar a oficina');
    }
  }

  useEffect(() => {
    void load();
    get<{ mechanicNames: string[] }>('/work-orders/mechanics')
      .then((data) => setMechanicNames(data.mechanicNames || ['Oficina']))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!filtered) {
      setHits([]);
      setHasMore(false);
      return;
    }
    const delay = q.trim() ? 160 : 0;
    const timer = window.setTimeout(() => {
      get<WorkOrder[]>(pagedPath('/work-orders', 0, extra()))
        .then((list) => {
          setLoadError('');
          setHits(list);
          setHasMore(pageHasMore(list));
        })
        .catch((err: unknown) => {
          setLoadError(err instanceof Error ? err.message : 'Falha ao buscar as OS');
        });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [q, status, filtered]);

  useEffect(() => {
    if (!customerId) {
      setBikes([]);
      setBikeId('');
      setBrand('');
      setModel('');
      return;
    }
    get<Bike[]>(`/bikes?customer=${customerId}`)
      .then(setBikes)
      .catch((err: unknown) => {
        setBikes([]);
        setError(err instanceof Error ? err.message : 'Falha ao carregar as bikes');
      });
  }, [customerId]);

  async function create() {
    await run(async () => {
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
    });
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      setLoadError('');
      const list = await get<WorkOrder[]>(pagedPath('/work-orders', hits.length, extra()));
      setHits((current) => [...current, ...list]);
      setHasMore(pageHasMore(list));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao buscar as OS');
    } finally {
      setLoadingMore(false);
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
      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="row filters">
        <label className="field field-grow">
          Buscar OS
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="OS-00042, cliente, bike ou mecânico"
          />
        </label>
        <label className="field">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Quadro</option>
            {Object.entries(OS_STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered ? (
        <article className="card">
          {hits.length === 0 && !loadError ? (
            <p className="empty">Nenhuma OS encontrada.</p>
          ) : (
            <div className="stack-list">
              {hits.map((order) => (
                <Link className="stack-item" key={order._id} to={`/oficina/${order._id}`}>
                  <div className="stack-copy">
                    <strong>{order.number}</strong>
                    <span>{order.customer?.name}</span>
                    <span className="muted">
                      {order.bike?.brand} {order.bike?.model}
                    </span>
                  </div>
                  <div className="stack-meta">
                    <span className="badge info">{OS_STATUS[order.status] || order.status}</span>
                    <span className="money">{formatBRL(order.total)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <LoadMore hasMore={hasMore} loading={loadingMore} onClick={() => void loadMore()} />
        </article>
      ) : (
        <div className="kanban">
          {columns.map((columnStatus) => (
            <div className="kanban-col" key={columnStatus}>
              <h3>
                {OS_STATUS[columnStatus]} · {counts[columnStatus] || 0}
              </h3>
              {(lists[columnStatus] || []).map((order) => (
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
      )}

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
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void create()}
            >
              Abrir OS
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
