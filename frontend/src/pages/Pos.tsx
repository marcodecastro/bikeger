import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { get, post } from '../lib/api';
import { PAYMENT_METHODS } from '../lib/labels';
import { addCartLine, cartTotals, setCartLineQuantity } from '../lib/cart';
import { formatBRL, multiplyCents } from '../lib/money';
import { isOpenPixStatus, PIX_POLL_MS } from '../lib/paymentPoll';
import {
  catalogServiceLine,
  clearPosDraft,
  emptyPosDraft,
  posDraftIsEmpty,
  productCartKey,
  readPosDraft,
  salePayloadItems,
  serviceCartKey,
  writePosDraft,
  type PosCartItem,
} from '../lib/posDraft';
import { useBusy } from '../lib/useBusy';
import type {
  CashRegister,
  CatalogService,
  Customer,
  MpPixPayment,
  Product,
  Receipt,
  Sale,
} from '../types';
import { MoneyInput } from '../components/MoneyInput';
import { ReceiptModal } from '../components/ReceiptModal';
import { EntitySearch } from '../components/EntitySearch';

export function Pos() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Product[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [draft] = useState(() => readPosDraft() || emptyPosDraft());
  const [cart, setCart] = useState<PosCartItem[]>(draft.cart);
  const [customerId, setCustomerId] = useState(draft.customerId);
  const [customerLabel, setCustomerLabel] = useState(draft.customerLabel);
  const [discount, setDiscount] = useState(draft.discount);
  const [method, setMethod] = useState(draft.method);
  const [cashReceived, setCashReceived] = useState(draft.cashReceived);
  const [serviceId, setServiceId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState(0);
  const [serviceQty, setServiceQty] = useState(1);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [cashOpen, setCashOpen] = useState<boolean | null>(null);
  const [pix, setPix] = useState<MpPixPayment | null>(draft.pix);
  const [pendingSaleId, setPendingSaleId] = useState(draft.pendingSaleId);
  const { busy, run } = useBusy();
  const pixRef = useRef(pix);
  pixRef.current = pix;
  const searchRef = useRef<HTMLInputElement>(null);

  const searchCustomers = useCallback((q: string) => get<Customer[]>(`/customers?q=${encodeURIComponent(q)}`), []);

  useEffect(() => {
    get<CashRegister | null>('/cash/current')
      .then((register) => setCashOpen(Boolean(register?._id)))
      .catch(() => setCashOpen(null));
    get<CatalogService[]>('/services?active=true').then(setServices).catch(() => undefined);
  }, []);

  useEffect(() => {
    const next = {
      cart,
      customerId,
      customerLabel,
      discount,
      method,
      cashReceived,
      pendingSaleId,
      pix,
    };
    if (posDraftIsEmpty(next)) clearPosDraft();
    else writePosDraft(next);
  }, [cart, customerId, customerLabel, discount, method, cashReceived, pendingSaleId, pix]);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      get<Product[]>(`/products?q=${encodeURIComponent(query)}&active=true`)
        .then(setHits)
        .catch(() => undefined);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!pendingSaleId || !pix?._id) return;
    const timer = window.setInterval(() => {
      const currentPix = pixRef.current;
      if (!currentPix || !isOpenPixStatus(currentPix.status)) return;
      void (async () => {
        try {
          const charges = await get<MpPixPayment[]>(`/payments?relatedType=sale&relatedId=${pendingSaleId}`);
          const same = charges.find((item) => item._id === currentPix._id) || charges[0];
          if (same && (same.status !== currentPix.status || same.paymentId !== currentPix.paymentId)) {
            setPix(same);
          }
        } catch {
          /* poll */
        }
        try {
          const sale = await get<Sale>(`/sales/${pendingSaleId}`);
          if (sale.status === 'paga') {
            const printed = await get<Receipt>(`/sales/${sale._id}/receipt`);
            clearPosDraft();
            setCart([]);
            setDiscount(0);
            setCashReceived(0);
            setPix(null);
            setPendingSaleId('');
            setReceipt(printed);
          }
        } catch {
          /* ignore */
        }
      })();
    }, PIX_POLL_MS);
    return () => window.clearInterval(timer);
  }, [pendingSaleId, pix?._id]);

  const { subtotal, total, change } = useMemo(
    () => cartTotals(cart, discount, method, cashReceived),
    [cart, discount, method, cashReceived],
  );

  function addProduct(product: Product) {
    const available = product.availableStock ?? product.currentStock;
    const key = productCartKey(product._id);
    setCart((current) => {
      const productLines = current.filter((item) => item.kind === 'produto');
      const result = addCartLine(
        productLines.map((item) => ({
          productId: item.product._id,
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          available: item.product.availableStock ?? item.product.currentStock,
        })),
        {
          productId: product._id,
          name: product.name,
          unitPrice: product.salePrice,
          available,
        },
      );
      if (result.error) {
        setError(result.error);
        return current;
      }
      setError('');
      const qty = result.lines.find((line) => line.productId === product._id)?.quantity ?? 1;
      const found = current.find((item) => item.key === key);
      if (!found) {
        return [
          ...current,
          { key, kind: 'produto' as const, product, quantity: 1, unitPrice: product.salePrice },
        ];
      }
      return current.map((item) => (item.key === key ? { ...item, quantity: qty } : item));
    });
    setQuery('');
    setHits([]);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  function addServiceLine() {
    const name = serviceName.trim();
    if (!serviceId && !name) {
      setError('Informe o serviço');
      return;
    }
    if (!serviceId && servicePrice <= 0) {
      setError('Informe o preço do serviço');
      return;
    }
    if (!Number.isInteger(serviceQty) || serviceQty < 1) {
      setError('Quantidade do serviço deve ser um inteiro positivo');
      return;
    }

    if (serviceId) {
      const catalog = services.find((service) => service._id === serviceId);
      if (!catalog) {
        setError('Serviço não encontrado no catálogo');
        return;
      }
      const line = catalogServiceLine(catalog, serviceQty);
      setCart((current) => {
        const found = current.find((item) => item.key === line.key);
        if (!found) return [...current, line];
        return current.map((item) =>
          item.key === line.key
            ? { ...item, quantity: item.quantity + serviceQty, unitPrice: catalog.price }
            : item,
        );
      });
    } else {
      const unitPrice = servicePrice;
      const key = serviceCartKey({ name, unitPrice });
      setCart((current) => {
        const found = current.find((item) => item.key === key);
        if (!found) {
          return [...current, { key, kind: 'servico', name, quantity: serviceQty, unitPrice }];
        }
        return current.map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + serviceQty } : item,
        );
      });
    }

    setError('');
    setServiceId('');
    setServiceName('');
    setServicePrice(0);
    setServiceQty(1);
  }

  async function lookupExact(event: FormEvent) {
    event.preventDefault();
    const code = query.trim();
    if (!code) return;
    try {
      const product = await get<Product>(`/products/lookup/${encodeURIComponent(code)}`);
      addProduct(product);
      return;
    } catch {
      /* pistola errou o código exato; tenta o primeiro resultado da busca */
    }
    try {
      const list = hits.length ? hits : await get<Product[]>(`/products?q=${encodeURIComponent(code)}&active=true`);
      if (list[0]) addProduct(list[0]);
      else setError('Peça não encontrada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Peça não encontrada');
    }
  }

  async function checkout() {
    await run(async () => {
      try {
        setError('');
        const sale = await post<Sale>('/sales', {
          customer: customerId || null,
          items: salePayloadItems(cart),
          discount,
          payments: [{ method, amount: total }],
          cashReceived: method === 'dinheiro' ? cashReceived : 0,
        });
        if (sale.status === 'paga') {
          const printed = await get<Receipt>(`/sales/${sale._id}/receipt`);
          clearPosDraft();
          setCart([]);
          setDiscount(0);
          setCashReceived(0);
          setReceipt(printed);
          return;
        }
        if (method === 'pix') {
          const created = await post<MpPixPayment>('/payments/pix', {
            relatedType: 'sale',
            relatedId: sale._id,
          });
          setPendingSaleId(sale._id);
          setPix(created);
          return;
        }
        if (method === 'mercado_pago') {
          const created = await post<{ initPoint?: string }>('/payments/preference', {
            relatedType: 'sale',
            relatedId: sale._id,
          });
          if (created.initPoint) window.location.assign(created.initPoint);
          return;
        }
        setError('Pagamento ainda em aberto. Confira o caixa e tente de novo.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao finalizar venda');
      }
    });
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Cupom de balcão</h2>
          <p>Peça e serviço no mesmo cupom. Cliente é opcional — sem cadastro sai como consumidor.</p>
        </div>
      </div>

      <div className="pos">
        <article className="card">
          <form onSubmit={lookupExact}>
            <label className="field">
              Busca / código de barras
              <input
                ref={searchRef}
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="SKU, código ou nome"
                enterKeyHint="search"
              />
            </label>
          </form>
          {hits.length > 0 ? (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <tbody>
                  {hits.slice(0, 8).map((product) => (
                    <tr key={product._id}>
                      <td>
                        <div className="pos-hit">
                          {product.images?.[0] ? (
                            <img className="pos-thumb" src={product.images[0]} alt="" />
                          ) : null}
                          <div>
                            <strong>{product.name}</strong>
                            <div className="muted">
                              {product.sku} · livre {product.availableStock ?? product.currentStock}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="money">{formatBRL(product.salePrice)}</td>
                      <td>
                        <button type="button" className="btn" onClick={() => addProduct(product)}>
                          Adicionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <h4 style={{ marginTop: 20 }}>Serviço</h4>
          <div className="row">
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
              onClick={addServiceLine}
            >
              Lançar serviço
            </button>
          </div>

          <div style={{ marginTop: 20 }}>
            {cart.length === 0 ? <p className="empty">Carrinho vazio.</p> : null}
            {cart.map((item) => (
              <div className="cart-line" key={item.key}>
                <div className="pos-hit">
                  {item.kind === 'produto' && item.product.images?.[0] ? (
                    <img className="pos-thumb" src={item.product.images[0]} alt="" />
                  ) : null}
                  <div>
                    <strong>{item.kind === 'produto' ? item.product.name : item.name}</strong>
                    <div className="muted">
                      {item.kind === 'produto' ? item.product.sku : 'Serviço'}
                    </div>
                  </div>
                </div>
                <input
                  className="qty-input"
                  type="number"
                  min={1}
                  value={item.quantity}
                  aria-label={`Quantidade ${item.kind === 'produto' ? item.product.name : item.name}`}
                  onChange={(event) => {
                    const quantity = Number(event.target.value);
                    if (item.kind === 'servico') {
                      if (!Number.isInteger(quantity) || quantity < 1) {
                        setError('Quantidade do serviço deve ser um inteiro positivo');
                        return;
                      }
                      setError('');
                      setCart((current) =>
                        current.map((line) => (line.key === item.key ? { ...line, quantity } : line)),
                      );
                      return;
                    }
                    setCart((current) => {
                      const productLines = current.filter((line) => line.kind === 'produto');
                      const result = setCartLineQuantity(
                        productLines.map((line) => ({
                          productId: line.product._id,
                          name: line.product.name,
                          quantity: line.quantity,
                          unitPrice: line.unitPrice,
                          available: line.product.availableStock ?? line.product.currentStock,
                        })),
                        item.product._id,
                        quantity,
                      );
                      if (result.error) {
                        setError(result.error);
                        return current;
                      }
                      setError('');
                      const nextQty =
                        result.lines.find((line) => line.productId === item.product._id)?.quantity ??
                        item.quantity;
                      return current.map((line) =>
                        line.key === item.key ? { ...line, quantity: nextQty } : line,
                      );
                    });
                  }}
                />
                <span className="money">{formatBRL(multiplyCents(item.unitPrice, item.quantity))}</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCart((current) => current.filter((line) => line.key !== item.key))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <EntitySearch
            label="Cliente (opcional)"
            placeholder="Nome, telefone ou documento"
            emptyLabel="Consumidor / sem cadastro"
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
          <MoneyInput label="Desconto" valueCents={discount} onChangeCents={setDiscount} />
          <label className="field">
            Pagamento
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {method === 'dinheiro' ? (
            <MoneyInput label="Recebido" valueCents={cashReceived} onChangeCents={setCashReceived} />
          ) : null}
          <div className="total-box">
            <div className="muted">Subtotal {formatBRL(subtotal)}</div>
            <div className="money big">{formatBRL(total)}</div>
            {method === 'dinheiro' ? <div>Troco {formatBRL(change)}</div> : null}
          </div>
          {cashOpen === false ? (
            <p className="error">Abra o caixa para finalizar a venda.</p>
          ) : null}
          {pix ? (
            <div style={{ marginTop: 16 }}>
              <p>PIX {pix.status}</p>
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
          {error ? (
            <p className="error" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 12 }}
            disabled={!cart.length || cashOpen === false || busy}
            aria-busy={busy}
            onClick={() => void checkout()}
          >
            {method === 'pix' ? 'Finalizar e gerar PIX' : 'Finalizar e imprimir'}
          </button>
        </article>
      </div>

      {receipt ? <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} /> : null}
    </section>
  );
}
