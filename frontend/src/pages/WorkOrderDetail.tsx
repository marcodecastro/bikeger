import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { del, get, patch, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { OS_STATUS, PAYMENT_METHODS, allowedOsStatuses, isOsTerminal } from '../lib/labels';
import { formatBRL, subtractCents } from '../lib/money';
import { isOpenPixStatus, PIX_POLL_MS } from '../lib/paymentPoll';
import { useBusy } from '../lib/useBusy';
import type { CatalogService, MpPixPayment, Product, Receipt, WorkOrder } from '../types';
import { MoneyInput } from '../components/MoneyInput';
import { ReceiptModal } from '../components/ReceiptModal';

export function WorkOrderDetail() {
  const { can } = useAuth();
  const { id } = useParams();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [productId, setProductId] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [serviceId, setServiceId] = useState('');
  const [payMethod, setPayMethod] = useState('pix');
  const [payAmount, setPayAmount] = useState(0);
  const [pix, setPix] = useState<MpPixPayment | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const { busy, run } = useBusy();
  const pixRef = useRef(pix);
  const orderRef = useRef(order);
  pixRef.current = pix;
  orderRef.current = order;
  const [mechanicNames, setMechanicNames] = useState<string[]>([]);

  async function load() {
    if (!id) return;
    setOrder(await get<WorkOrder>(`/work-orders/${id}`));
  }

  useEffect(() => {
    void load();
    get<Product[]>('/products?active=true').then(setProducts).catch(() => undefined);
    get<CatalogService[]>('/services?active=true').then(setServices).catch(() => undefined);
    get<{ mechanicNames: string[] }>('/work-orders/mechanics')
      .then((data) => setMechanicNames(data.mechanicNames || []))
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    if (!id || !pix?._id) return;

    const timer = window.setInterval(() => {
      const currentPix = pixRef.current;
      const currentOrder = orderRef.current;
      if (!currentPix || !currentOrder) return;
      if (currentOrder.paidAmount >= currentOrder.total) return;
      if (!isOpenPixStatus(currentPix.status)) return;

      void (async () => {
        try {
          const charges = await get<MpPixPayment[]>(`/payments?relatedType=workOrder&relatedId=${id}`);
          const same = charges.find((item) => item._id === currentPix._id) || charges[0];
          if (
            same &&
            (same.status !== currentPix.status || same.paymentId !== currentPix.paymentId)
          ) {
            setPix(same);
          }
        } catch {
          /* a listagem pode falhar; o pago da OS ainda vale */
        }
        try {
          const next = await get<WorkOrder>(`/work-orders/${id}`);
          setOrder((current) => {
            if (!current) return next;
            if (
              current.paidAmount === next.paidAmount &&
              current.payments.length === next.payments.length &&
              current.status === next.status
            ) {
              return current;
            }
            return next;
          });
        } catch {
          /* ignore */
        }
      })();
    }, PIX_POLL_MS);

    return () => window.clearInterval(timer);
  }, [id, pix?._id]);

  if (!order) return <section className="page">Carregando OS...</section>;

  const openAmount = subtractCents(order.total, order.paidAmount);
  const closed = isOsTerminal(order.status);
  const statusOptions = allowedOsStatuses(order.status);

  async function addPart() {
    await run(async () => {
      try {
        setError('');
        setOrder(
          await post<WorkOrder>(`/work-orders/${id}/parts`, {
            productId,
            quantity: partQty,
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao lançar peça');
      }
    });
  }

  async function addService() {
    await run(async () => {
      try {
        setError('');
        setOrder(await post<WorkOrder>(`/work-orders/${id}/services`, { serviceId, quantity: 1 }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao lançar serviço');
      }
    });
  }

  async function registerPayment() {
    await run(async () => {
      try {
        setError('');
        setOrder(
          await post(`/work-orders/${id}/payments`, {
            method: payMethod,
            amount: payAmount || openAmount,
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao registrar pagamento');
      }
    });
  }

  async function createPix() {
    await run(async () => {
      try {
        setError('');
        const created = await post<MpPixPayment>('/payments/pix', {
          relatedType: 'workOrder',
          relatedId: id,
        });
        setPix(created);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao gerar PIX');
      }
    });
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>{order.number}</h2>
          <p>
            <Link to={`/clientes/${order.customer?._id}`}>{order.customer?.name}</Link>
            {' · '}
            <Link to={`/bikes/${order.bike?._id}`}>
              {order.bike?.brand} {order.bike?.model}
            </Link>
          </p>
        </div>
        <div className="row">
          <span className="badge info">{OS_STATUS[order.status]}</span>
          {order.status === 'pronta' ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              aria-busy={busy}
              onClick={() =>
                void run(async () => {
                  try {
                    setError('');
                    const notice = await post<{
                      _id: string;
                      waUrl?: string;
                      status: string;
                      provider?: string;
                    }>(`/notifications/work-orders/${id}/ready`);
                    if (notice.status === 'enviado') {
                      await load();
                      return;
                    }
                    if (notice.waUrl) {
                      window.open(notice.waUrl, '_blank');
                      await post(`/notifications/${notice._id}/sent`);
                      await load();
                    } else setError('Cliente sem telefone válido para WhatsApp.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Falha ao avisar o cliente');
                  }
                })
              }
            >
              Avisar no WhatsApp
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={async () => setReceipt(await get<Receipt>(`/work-orders/${id}/receipt`))}
          >
            Cupom térmico (não é NFC-e)
          </button>
        </div>
      </div>

      <div className="grid grid-2">
        <article className="card">
          <label className="field">
            Status
            <select
              value={order.status}
              disabled={closed || busy}
              aria-busy={busy}
              onChange={(event) => {
                const status = event.target.value;
                void run(async () => {
                  try {
                    setError('');
                    if (status === 'cancelada') {
                      setOrder(await post<WorkOrder>(`/work-orders/${id}/cancel`));
                      return;
                    }
                    setOrder(await patch<WorkOrder>(`/work-orders/${id}`, { status }));
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Falha ao atualizar status');
                  }
                });
              }}
            >
              {statusOptions.map((value) => (
                <option key={value} value={value}>
                  {OS_STATUS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Relato do cliente
            <textarea
              value={order.complaint}
              disabled={closed}
              onBlur={() => void patch(`/work-orders/${id}`, { complaint: order.complaint })}
              onChange={(event) => setOrder({ ...order, complaint: event.target.value })}
            />
          </label>
          <label className="field">
            Diagnóstico
            <textarea
              value={order.diagnosis}
              disabled={closed}
              onBlur={() => void patch(`/work-orders/${id}`, { diagnosis: order.diagnosis })}
              onChange={(event) => setOrder({ ...order, diagnosis: event.target.value })}
            />
          </label>
          <label className="field">
            Mecânico
            <input
              value={order.mechanic}
              list="os-mechanic-names"
              disabled={closed}
              onBlur={() => void patch(`/work-orders/${id}`, { mechanic: order.mechanic })}
              onChange={(event) => setOrder({ ...order, mechanic: event.target.value })}
            />
            <datalist id="os-mechanic-names">
              {mechanicNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="field">
            Tipo na agenda
            <select
              value={order.scheduleKind || 'servico'}
              disabled={closed}
              onChange={async (event) =>
                setOrder(
                  await patch<WorkOrder>(`/work-orders/${id}`, { scheduleKind: event.target.value }),
                )
              }
            >
              <option value="diagnostico">Diagnóstico</option>
              <option value="servico">Serviço</option>
              <option value="retirada">Retirada</option>
            </select>
          </label>
          <label className="field">
            Data na agenda
            <input
              type="datetime-local"
              value={toLocalInput(order.scheduledAt)}
              disabled={closed}
              onChange={async (event) =>
                setOrder(
                  await patch<WorkOrder>(`/work-orders/${id}`, {
                    scheduledAt: event.target.value ? new Date(event.target.value).toISOString() : '',
                  }),
                )
              }
            />
          </label>
        </article>

        <article className="card">
          <h3>Totais</h3>
          <p>Mão de obra {formatBRL(order.laborTotal)}</p>
          <p>Peças {formatBRL(order.partsTotal)}</p>
          <p className="money" style={{ fontSize: 28 }}>
            {formatBRL(order.total)}
          </p>
          <p className="muted">Pago {formatBRL(order.paidAmount)} · em aberto {formatBRL(openAmount)}</p>
        </article>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Serviços</h3>
          {order.services.map((item) => (
            <div className="cart-line" key={item._id}>
              <span>{item.name}</span>
              <span className="money">{formatBRL(item.total)}</span>
              {closed ? null : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      try {
                        setError('');
                        setOrder(await del(`/work-orders/${id}/services/${item._id}`));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Falha ao remover serviço');
                      }
                    })
                  }
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {closed ? null : (
          <div className="row" style={{ marginTop: 12 }}>
            <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
              <option value="">Serviço do catálogo</option>
              {services.map((service) => (
                <option key={service._id} value={service._id}>
                  {service.name} · {formatBRL(service.price)}
                </option>
              ))}
            </select>
            <button type="button" className="btn" disabled={busy} aria-busy={busy} onClick={() => void addService()}>
              Lançar
            </button>
          </div>
          )}
        </article>

        <article className="card">
          <h3>Peças (reserva, depois consumo)</h3>
          {order.parts.map((item) => (
            <div className="cart-line" key={item._id}>
              <span>
                {item.quantity}x {item.name}
                <div className="muted">{item.stockStatus === 'consumida' ? 'consumida' : 'reservada'}</div>
              </span>
              <span className="money">{formatBRL(item.total)}</span>
              {closed || item.stockStatus === 'consumida' ? null : (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  aria-busy={busy}
                  onClick={() =>
                    void run(async () => {
                      try {
                        setError('');
                        setOrder(await post(`/work-orders/${id}/parts/${item._id}/consume`));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Falha ao consumir peça');
                      }
                    })
                  }
                >
                  Consumir
                </button>
              )}
              {closed ? null : (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    try {
                      setError('');
                      setOrder(await del(`/work-orders/${id}/parts/${item._id}`));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Falha ao remover peça');
                    }
                  })
                }
              >
                ×
              </button>
              )}
            </div>
          ))}
          {closed ? null : (
          <div className="row" style={{ marginTop: 12 }}>
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Peça do estoque</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name} ({product.availableStock ?? product.currentStock} livre)
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              style={{ width: 70 }}
              value={partQty}
              onChange={(event) => setPartQty(Number(event.target.value))}
            />
            <button type="button" className="btn" disabled={busy} aria-busy={busy} onClick={() => void addPart()}>
              Reservar peça
            </button>
          </div>
          )}
        </article>
      </div>

      {can('payments') && !closed ? (
      <article className="card" style={{ marginTop: 16 }}>
        <h3>Recebimento</h3>
        <div className="row">
          <select value={payMethod} onChange={(event) => setPayMethod(event.target.value)}>
            {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <MoneyInput label="Valor" valueCents={payAmount || openAmount} onChangeCents={setPayAmount} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void registerPayment()}
          >
            Registrar
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void createPix()}
          >
            PIX Mercado Pago
          </button>
        </div>
        {pix ? (
          <div style={{ marginTop: 16 }}>
            <p>Status: {pix.status}</p>
            {pix.qrCodeBase64 ? (
              <img
                alt="QR Code PIX"
                src={`data:image/png;base64,${pix.qrCodeBase64}`}
                style={{ width: 180, background: '#fff', padding: 8, borderRadius: 8 }}
              />
            ) : null}
            <p className="muted">{pix.qrCode}</p>
            {isOpenPixStatus(pix.status) ? (
              <p className="muted">O status atualiza sozinho quando o PIX cair.</p>
            ) : null}
          </div>
        ) : null}
      </article>
      ) : (
        <article className="card" style={{ marginTop: 16 }}>
          <h3>Recebimento</h3>
          <p className="muted">Pago {formatBRL(order.paidAmount)} · em aberto {formatBRL(openAmount)}</p>
          {closed ? (
            <p className="muted">OS encerrada. Peças, serviços e recebimento não mudam mais.</p>
          ) : (
            <p className="muted">O balcão registra o pagamento na entrega.</p>
          )}
        </article>
      )}

      {error ? <p className="error">{error}</p> : null}
      {order.readyNotifiedAt ? (
        <p className="muted">Cliente avisado em {new Date(order.readyNotifiedAt).toLocaleString('pt-BR')}</p>
      ) : null}
      {receipt ? <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} /> : null}
    </section>
  );
}

function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
