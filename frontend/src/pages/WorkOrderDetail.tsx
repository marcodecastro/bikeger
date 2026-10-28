import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { del, get, patch, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  OS_STATUS,
  PAYMENT_METHODS,
  COUNTER_PAYMENT_METHODS,
  allowedOsStatuses,
  isOsQuoteStatus,
  isOsTerminal,
} from '../lib/labels';
import { formatBRL, subtractCents } from '../lib/money';
import { isOpenPixStatus, PIX_POLL_MS } from '../lib/paymentPoll';
import { useBusy } from '../lib/useBusy';
import type { CatalogService, FiscalDocument, MpPixPayment, Product, Receipt, WorkOrder } from '../types';
import { MoneyInput } from '../components/MoneyInput';
import { Modal } from '../components/Modal';
import { ReceiptModal } from '../components/ReceiptModal';
import { WorkOrderSheet } from '../components/WorkOrderSheet';
import { EntitySearch } from '../components/EntitySearch';

export function WorkOrderDetail() {
  const { can } = useAuth();
  const { id } = useParams();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [productId, setProductId] = useState('');
  const [productLabel, setProductLabel] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [serviceId, setServiceId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState(0);
  const [serviceQty, setServiceQty] = useState(1);
  const [payMethod, setPayMethod] = useState<(typeof COUNTER_PAYMENT_METHODS)[number]>('dinheiro');
  const [payAmount, setPayAmount] = useState(0);
  const [pix, setPix] = useState<MpPixPayment | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [storeName, setStoreName] = useState('BikeGer');
  const [storeLogo, setStoreLogo] = useState('');
  const [fiscal, setFiscal] = useState<FiscalDocument[]>([]);
  const [pendingNfce, setPendingNfce] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { busy, run } = useBusy();
  const pixRef = useRef(pix);
  const orderRef = useRef(order);
  pixRef.current = pix;
  orderRef.current = order;
  const [mechanicNames, setMechanicNames] = useState<string[]>([]);
  const complaintSnap = useRef('');
  const diagnosisSnap = useRef('');
  const mechanicSnap = useRef('');
  const searchProducts = useCallback(
    (q: string) => get<Product[]>(`/products?q=${encodeURIComponent(q)}&active=true`),
    [],
  );

  async function load() {
    if (!id) return;
    setOrder(await get<WorkOrder>(`/work-orders/${id}`));
    setFiscal(await get<FiscalDocument[]>(`/fiscal/workOrder/${id}`).catch(() => []));
  }

  useEffect(() => {
    void load();
    get<CatalogService[]>('/services?active=true').then(setServices).catch(() => undefined);
    get<{ mechanicNames: string[] }>('/work-orders/mechanics')
      .then((data) => setMechanicNames(data.mechanicNames || []))
      .catch(() => undefined);
    get<{ storeName?: string; storeLogo?: string }>('/auth/public-config')
      .then((config) => {
        setStoreName(config.storeName?.trim() || 'BikeGer');
        setStoreLogo(config.storeLogo || '');
      })
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
  const quoting = isOsQuoteStatus(order.status);
  const statusOptions = allowedOsStatuses(order.status).filter((status) => {
    if (status !== 'cancelada') return true;
    if (order.paidAmount <= 0) return true;
    return can('payments');
  });

  async function saveFields(body: Record<string, unknown>, restore: () => void) {
    try {
      await run(async () => {
        setError('');
        setOrder(await patch<WorkOrder>(`/work-orders/${id}`, body));
      });
    } catch (err) {
      restore();
      setError(err instanceof Error ? err.message : 'Falha ao salvar a OS');
    }
  }

  async function runOs(work: () => Promise<void>, fallback: string) {
    try {
      await run(async () => {
        setError('');
        await work();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    }
  }

  async function addPart() {
    await runOs(async () => {
      setOrder(
        await post<WorkOrder>(`/work-orders/${id}/parts`, {
          productId,
          quantity: partQty,
        }),
      );
      setProductId('');
      setProductLabel('');
    }, 'Falha ao lançar peça');
  }

  async function addService() {
    await runOs(async () => {
      const payload = serviceId
        ? { serviceId, quantity: serviceQty }
        : { name: serviceName.trim(), price: servicePrice, quantity: serviceQty };
      setOrder(await post<WorkOrder>(`/work-orders/${id}/services`, payload));
      setServiceId('');
      setServiceName('');
      setServicePrice(0);
      setServiceQty(1);
    }, 'Falha ao lançar serviço');
  }

  async function registerPayment() {
    await runOs(async () => {
      setOrder(
        await post(`/work-orders/${id}/payments`, {
          method: payMethod,
          amount: payAmount || openAmount,
        }),
      );
    }, 'Falha ao registrar pagamento');
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
          {quoting ? (
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
                    }>(`/notifications/work-orders/${id}/quote`);
                    await load();
                    if (notice.status === 'enviado') return;
                    if (notice.waUrl) {
                      window.open(notice.waUrl, '_blank');
                      await post(`/notifications/${notice._id}/sent`);
                      await load();
                    } else setError('Cliente sem telefone válido para WhatsApp.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Falha ao enviar o orçamento');
                  }
                })
              }
            >
              Enviar orçamento
            </button>
          ) : null}
          <button type="button" className="btn" onClick={() => setSheetOpen(true)}>
            Imprimir OS / PDF
          </button>
          <button
            type="button"
            className="btn"
            onClick={async () => setReceipt(await get<Receipt>(`/work-orders/${id}/receipt`))}
          >
            Cupom térmico (não é NFC-e)
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || order.total <= 0}
            aria-busy={busy}
            onClick={() =>
              void run(async () => {
                try {
                  setError('');
                  const doc = await post<FiscalDocument>(`/fiscal/workOrder/${id}`);
                  setFiscal((current) => [doc, ...current.filter((item) => item._id !== doc._id)]);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Falha ao gerar NFC-e');
                }
              })
            }
          >
            Gerar NFC-e
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
                void runOs(async () => {
                  if (status === 'cancelada') {
                    setOrder(await post<WorkOrder>(`/work-orders/${id}/cancel`));
                    return;
                  }
                  setOrder(await patch<WorkOrder>(`/work-orders/${id}`, { status }));
                }, 'Falha ao atualizar status');
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
              onFocus={() => {
                complaintSnap.current = order.complaint;
              }}
              onBlur={() => {
                if (closed || order.complaint === complaintSnap.current) return;
                void saveFields({ complaint: order.complaint }, () =>
                  setOrder((current) => (current ? { ...current, complaint: complaintSnap.current } : current)),
                );
              }}
              onChange={(event) => setOrder({ ...order, complaint: event.target.value })}
            />
          </label>
          <label className="field">
            Diagnóstico
            <textarea
              value={order.diagnosis}
              disabled={closed}
              onFocus={() => {
                diagnosisSnap.current = order.diagnosis;
              }}
              onBlur={() => {
                if (closed || order.diagnosis === diagnosisSnap.current) return;
                void saveFields({ diagnosis: order.diagnosis }, () =>
                  setOrder((current) => (current ? { ...current, diagnosis: diagnosisSnap.current } : current)),
                );
              }}
              onChange={(event) => setOrder({ ...order, diagnosis: event.target.value })}
            />
          </label>
          <label className="field">
            Mecânico
            <input
              value={order.mechanic}
              list="os-mechanic-names"
              disabled={closed}
              onFocus={() => {
                mechanicSnap.current = order.mechanic;
              }}
              onBlur={() => {
                if (closed || order.mechanic === mechanicSnap.current) return;
                void saveFields({ mechanic: order.mechanic }, () =>
                  setOrder((current) => (current ? { ...current, mechanic: mechanicSnap.current } : current)),
                );
              }}
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

      <article className="card" style={{ marginTop: 16 }}>
        <h3>Serviços e peças</h3>
        <p className="muted">
          {quoting
            ? 'Lance mão de obra e peça nesta mesma OS. O orçamento não reserva estoque; a reserva entra depois da aprovação.'
            : 'Peças nesta etapa reservam o estoque. Consumir baixa de verdade.'}
        </p>
        {!order.services.length && !order.parts.length ? (
          <p className="muted">Nenhum item ainda. Acrescente serviço e peça abaixo — os dois entram neste orçamento.</p>
        ) : null}

        <h4 style={{ marginTop: 16 }}>Mão de obra</h4>
        {order.services.map((item) => (
          <div className="cart-line" key={item._id}>
            <span>
              {item.quantity}x {item.name}
            </span>
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
            <label className="field">
              Serviço do catálogo
              <select
                value={serviceId}
                onChange={(event) => {
                  const next = event.target.value;
                  setServiceId(next);
                  const catalog = services.find((service) => service._id === next);
                  if (catalog) {
                    setServiceName(catalog.name);
                    setServicePrice(catalog.price);
                  }
                }}
              >
                <option value="">Avulso ou catálogo</option>
                {services.map((service) => (
                  <option key={service._id} value={service._id}>
                    {service.name} · {formatBRL(service.price)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Descrição
              <input
                value={serviceName}
                onChange={(event) => {
                  setServiceName(event.target.value);
                  if (serviceId) setServiceId('');
                }}
                placeholder="Ex.: Regulagem de câmbio"
              />
            </label>
            <MoneyInput label="Preço" valueCents={servicePrice} onChangeCents={setServicePrice} />
            <label className="field">
              Qtd
              <input
                className="qty-input"
                type="number"
                min={1}
                value={serviceQty}
                onChange={(event) => setServiceQty(Number(event.target.value) || 1)}
              />
            </label>
            <button
              type="button"
              className="btn"
              disabled={busy || (!serviceId && !serviceName.trim())}
              aria-busy={busy}
              onClick={() => void addService()}
            >
              Lançar serviço
            </button>
          </div>
        )}

        <h4 style={{ marginTop: 20 }}>Peças</h4>
        {order.parts.map((item) => (
          <div className="cart-line" key={item._id}>
            <span>
              {item.quantity}x {item.name}
              <div className="muted">
                {item.stockStatus === 'consumida'
                  ? 'consumida'
                  : item.stockStatus === 'orcamento'
                    ? 'orçamento'
                    : 'reservada'}
              </div>
            </span>
            <span className="money">{formatBRL(item.total)}</span>
            {closed || item.stockStatus === 'consumida' || item.stockStatus === 'orcamento' ? null : (
              <button
                type="button"
                className="btn"
                disabled={busy}
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
            <EntitySearch
              label="Peça do estoque"
              placeholder="Nome, SKU ou código"
              value={productId}
              selectedLabel={productLabel}
              fetchItems={searchProducts}
              getKey={(item) => item._id}
              getLabel={(item) => item.name}
              getExtra={(item) => `${item.sku} · ${item.availableStock ?? item.currentStock} livre`}
              onSelect={(item) => {
                setProductId(item?._id || '');
                setProductLabel(item?.name || '');
              }}
            />
            <input
              type="number"
              min={1}
              className="qty-input"
              value={partQty}
              onChange={(event) => setPartQty(Number(event.target.value))}
              aria-label="Quantidade da peça"
            />
            <button
              type="button"
              className="btn"
              disabled={busy || !productId}
              aria-busy={busy}
              onClick={() => void addPart()}
            >
              {quoting ? 'Incluir peça no orçamento' : 'Reservar peça'}
            </button>
          </div>
        )}
      </article>

      {can('payments') && !closed ? (
      <article className="card" style={{ marginTop: 16 }}>
        <h3>Recebimento</h3>
        <p className="muted">Dinheiro e cartão caem na hora. PIX só pelo Mercado Pago — senão o caixa mente.</p>
        <div className="row">
          <label className="field">
            Meio
            <select
              value={payMethod}
              onChange={(event) =>
                setPayMethod(event.target.value as (typeof COUNTER_PAYMENT_METHODS)[number])
              }
            >
              {COUNTER_PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_METHODS[value]}
                </option>
              ))}
            </select>
          </label>
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
                className="pix-qr"
                alt="QR Code PIX"
                src={`data:image/png;base64,${pix.qrCodeBase64}`}
              />
            ) : null}
            <p className="muted pix-payload">{pix.qrCode}</p>
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

      <article className="card" style={{ marginTop: 16 }}>
        <h3>Documento fiscal</h3>
        <p className="muted">Peça e mão de obra na mesma NFC-e. O cupom da térmica não substitui a nota.</p>
        {fiscal.length ? (
          fiscal.map((doc) => (
            <div className="stack-item stack-item-static" key={doc._id}>
              <div>
                <strong>{doc.status}</strong>
                <div className="muted">
                  {doc.errorMessage || doc.accessKey || doc.sefazStatus || doc.provider}
                </div>
              </div>
              <div className="row">
                <span className="money">{formatBRL(doc.amount)}</span>
                {doc.status === 'autorizada' ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() => setPendingNfce(doc._id)}
                  >
                    Cancelar NFC-e
                  </button>
                ) : null}
                {doc.status === 'pendente' || doc.status === 'rejeitada' ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() =>
                      void run(async () => {
                        try {
                          setError('');
                          const updated = await post<FiscalDocument>(`/fiscal/${doc._id}/emit`);
                          setFiscal((current) => current.map((item) => (item._id === updated._id ? updated : item)));
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Falha ao emitir NFC-e');
                        }
                      })
                    }
                  >
                    Emitir na SEFAZ
                  </button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p className="muted">Nenhum rascunho de NFC-e ainda. Sem token, CSC e emitente a SEFAZ recusa.</p>
        )}
      </article>

      {error ? (
        <p className="error" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
      {order.readyNotifiedAt ? (
        <p className="muted">Cliente avisado em {new Date(order.readyNotifiedAt).toLocaleString('pt-BR')}</p>
      ) : null}
      {receipt ? <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} /> : null}
      {sheetOpen ? (
        <WorkOrderSheet
          order={order}
          storeName={storeName}
          storeLogo={storeLogo}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
      {pendingNfce ? (
        <Modal title="Cancelar NFC-e" onClose={() => setPendingNfce(null)}>
          <p>A nota autorizada será cancelada na SEFAZ. Só siga se a oficina realmente precisa anular o documento fiscal desta OS.</p>
          {error ? <p className="error">{error}</p> : null}
          <div className="row" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              aria-busy={busy}
              onClick={() =>
                void run(async () => {
                  try {
                    setError('');
                    const updated = await post<FiscalDocument>(`/fiscal/${pendingNfce}/cancel`, {
                      justificativa: 'Cancelamento solicitado no painel BikeGer',
                    });
                    setFiscal((current) => current.map((item) => (item._id === updated._id ? updated : item)));
                    setPendingNfce(null);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Falha ao cancelar a NFC-e');
                  }
                })
              }
            >
              Confirmar cancelamento na SEFAZ
            </button>
          </div>
        </Modal>
      ) : null}
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
