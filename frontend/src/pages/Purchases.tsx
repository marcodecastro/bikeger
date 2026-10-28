import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import { dayEndIso, dayStartIso, pageHasMore, pagedPath } from '../lib/listPage';
import { formatBRL } from '../lib/money';
import type { NeededPart, Product, Purchase, Supplier } from '../types';
import { EntitySearch } from '../components/EntitySearch';
import { LoadMore } from '../components/LoadMore';
import { MoneyInput } from '../components/MoneyInput';

interface DraftLine {
  productId: string;
  label: string;
  quantity: number;
  unitCost: number;
}

export function Purchases() {
  const [searchParams] = useSearchParams();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [productId, setProductId] = useState('');
  const [productLabel, setProductLabel] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [scan, setScan] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  function extra() {
    const params: Record<string, string> = {};
    if (q.trim()) params.q = q.trim();
    if (filterSupplier) params.supplier = filterSupplier;
    if (from) params.from = dayStartIso(from);
    if (to) params.to = dayEndIso(to);
    return params;
  }

  const searchProducts = useCallback(
    (q: string) => get<Product[]>(`/products?q=${encodeURIComponent(q)}&active=true`),
    [],
  );

  async function loadSuppliers() {
    setSuppliers(await get<Supplier[]>('/suppliers'));
  }

  useEffect(() => {
    void loadSuppliers().catch((err: Error) => setLoadError(err.message));
  }, []);

  useEffect(() => {
    if (searchParams.get('fromOs') !== '1') return;
    const supplier = searchParams.get('supplier') || '';
    const path = supplier
      ? `/purchases/needed?supplier=${encodeURIComponent(supplier)}`
      : '/purchases/needed';
    get<NeededPart[]>(path)
      .then((items) => {
        if (!items.length) {
          setError('Nenhuma peça pendente nas OS aguardando.');
          return;
        }
        setLines(
          items.map((item) => ({
            productId: item.productId,
            label: item.name,
            quantity: item.quantity,
            unitCost: item.unitCost ?? 0,
          })),
        );
        if (supplier) setSupplierId(supplier);
        else if (items[0]?.supplierId && items.every((item) => item.supplierId === items[0].supplierId)) {
          setSupplierId(items[0].supplierId);
        }
        setNotes('OS aguardando peça');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Falha ao montar o pedido das OS');
      });
  }, [searchParams]);

  useEffect(() => {
    const delay = q.trim() ? 160 : 0;
    const timer = window.setTimeout(() => {
      get<Purchase[]>(pagedPath('/purchases', 0, extra()))
        .then((list) => {
          setLoadError('');
          setPurchases(list);
          setHasMore(pageHasMore(list));
        })
        .catch((err: unknown) => {
          setLoadError(err instanceof Error ? err.message : 'Falha ao carregar as compras');
        });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [q, filterSupplier, from, to]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      setLoadError('');
      const list = await get<Purchase[]>(pagedPath('/purchases', purchases.length, extra()));
      setPurchases((current) => [...current, ...list]);
      setHasMore(pageHasMore(list));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar as compras');
    } finally {
      setLoadingMore(false);
    }
  }

  function upsertLine(next: DraftLine) {
    setLines((current) => {
      const existing = current.find((line) => line.productId === next.productId);
      if (existing) {
        return current.map((line) =>
          line.productId === next.productId
            ? { ...line, quantity: line.quantity + next.quantity, unitCost: next.unitCost }
            : line,
        );
      }
      return [...current, next];
    });
  }

  function addLine() {
    if (!productId || quantity < 1) return;
    upsertLine({ productId, label: productLabel, quantity, unitCost });
    setProductId('');
    setProductLabel('');
    setQuantity(1);
  }

  async function scanCode(event: FormEvent) {
    event.preventDefault();
    const code = scan.trim();
    if (!code) return;
    try {
      setError('');
      const product = await get<Product>(`/products/lookup/${encodeURIComponent(code)}`);
      upsertLine({
        productId: product._id,
        label: product.name,
        quantity: 1,
        unitCost: product.costPrice ?? 0,
      });
      setScan('');
      window.setTimeout(() => scanRef.current?.focus(), 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Peça não encontrada');
    }
  }

  async function receive() {
    setBusy(true);
    setError('');
    try {
      await post('/purchases', {
        supplierId,
        notes,
        invoiceNumber,
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost,
        })),
      });
      setLines([]);
      setNotes('');
      setInvoiceNumber('');
      const list = await get<Purchase[]>(pagedPath('/purchases', 0, extra()));
      setPurchases(list);
      setHasMore(pageHasMore(list));
      await loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao receber a compra');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Compras</h2>
          <p>A caixa da distribuidora entra de uma vez. Custo médio em centavos, kardex por linha.</p>
        </div>
      </div>

      <article className="card">
        <h3>Receber lote</h3>
        <label className="field">
          Fornecedor
          <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">Selecione</option>
            {suppliers.map((supplier) => (
              <option key={supplier._id} value={supplier._id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <form className="row" style={{ marginTop: 12 }} onSubmit={(event) => void scanCode(event)}>
          <label className="field field-grow">
            Código de barras ou SKU
            <input
              ref={scanRef}
              value={scan}
              onChange={(event) => setScan(event.target.value)}
              placeholder="Bipe e Enter"
              autoComplete="off"
            />
          </label>
        </form>
        <div className="row" style={{ marginTop: 12 }}>
          <EntitySearch
            label="Peça"
            placeholder="Nome, SKU ou código"
            value={productId}
            selectedLabel={productLabel}
            fetchItems={searchProducts}
            getKey={(item) => item._id}
            getLabel={(item) => item.name}
            getExtra={(item) => `${item.sku} · ${item.currentStock} em estoque`}
            onSelect={(item) => {
              setProductId(item?._id || '');
              setProductLabel(item?.name || '');
              if (item?.costPrice) setUnitCost(item.costPrice);
            }}
          />
          <label className="field">
            Qtd
            <input
              className="qty-input"
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </label>
          <MoneyInput label="Custo unitário" valueCents={unitCost} onChangeCents={setUnitCost} />
          <button type="button" className="btn" onClick={addLine} disabled={!productId}>
            Incluir
          </button>
        </div>
        {lines.length ? (
          <div className="stack-list" style={{ marginTop: 12 }}>
            {lines.map((line) => (
              <div className="stack-item stack-item-static" key={line.productId}>
                <div className="stack-copy">
                  <strong>
                    {line.quantity}x {line.label}
                  </strong>
                  <span className="muted">{formatBRL(line.unitCost)} a unidade</span>
                </div>
                <div className="stack-meta">
                  <b>{formatBRL(line.unitCost * line.quantity)}</b>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setLines((current) => current.filter((item) => item.productId !== line.productId))}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Bipe o código e Enter. Ou busque pelo nome. O custo médio só muda depois de receber.</p>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <label className="field field-grow">
            NF do fornecedor
            <input
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value)}
              placeholder="Número da nota"
            />
          </label>
          <label className="field field-grow">
            Observação
            <input value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 12 }}
          disabled={busy || !supplierId || !lines.length}
          onClick={() => void receive()}
        >
          Receber no estoque
        </button>
      </article>

      {loadError ? (
        <p className="error" role="alert" style={{ marginTop: 12 }}>
          {loadError}
        </p>
      ) : null}

      <article className="card table-wrap" style={{ marginTop: 16 }}>
        <h3>Histórico</h3>
        <div className="row filters">
          <label className="field field-grow">
            NF ou lote
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="NF-123 ou CP-00001"
            />
          </label>
          <label className="field">
            Fornecedor da lista
            <select value={filterSupplier} onChange={(event) => setFilterSupplier(event.target.value)}>
              <option value="">Todos</option>
              {suppliers.map((supplier) => (
                <option key={supplier._id} value={supplier._id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            De
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="field">
            Até
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
        {purchases.length === 0 && !loadError ? (
          <p className="empty">Nenhuma compra ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Lote</th>
                <th>NF</th>
                <th>Fornecedor</th>
                <th>Itens</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase._id}>
                  <td>{new Date(purchase.receivedAt || purchase.createdAt).toLocaleString('pt-BR')}</td>
                  <td className="money">{purchase.number}</td>
                  <td>{purchase.invoiceNumber || purchase.notes || '—'}</td>
                  <td>{typeof purchase.supplier === 'object' ? purchase.supplier.name : purchase.supplier}</td>
                  <td>{purchase.items.length}</td>
                  <td className="money">{formatBRL(purchase.itemsTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <LoadMore hasMore={hasMore} loading={loadingMore} onClick={() => void loadMore()} />
      </article>
    </section>
  );
}
