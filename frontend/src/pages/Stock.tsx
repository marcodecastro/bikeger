import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { STOCK_TYPES } from '../lib/labels';
import { dayEndIso, dayStartIso, pageHasMore, pagedPath } from '../lib/listPage';
import { formatBRL } from '../lib/money';
import type { Product, StockMovement } from '../types';
import { LoadMore } from '../components/LoadMore';
import { Modal } from '../components/Modal';

export function Stock() {
  const { can } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState<'entrada' | 'ajuste' | null>(null);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [newQuantity, setNewQuantity] = useState(0);
  const [notes, setNotes] = useState('');
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function extra() {
    const params: Record<string, string> = {};
    if (q.trim()) params.q = q.trim();
    if (type) params.type = type;
    if (from) params.from = dayStartIso(from);
    if (to) params.to = dayEndIso(to);
    return params;
  }

  async function loadCatalog() {
    try {
      setProducts(await get<Product[]>('/products?limit=300&skip=0'));
    } catch {
      /* o kardex ainda carrega sem o catálogo do modal */
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    const delay = q.trim() ? 160 : 0;
    const timer = window.setTimeout(() => {
      get<StockMovement[]>(pagedPath('/stock', 0, extra()))
        .then((list) => {
          setLoadError('');
          setMovements(list);
          setHasMore(pageHasMore(list));
        })
        .catch((err: unknown) => {
          setLoadError(err instanceof Error ? err.message : 'Falha ao carregar o kardex');
        });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [q, type, from, to]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      setLoadError('');
      const list = await get<StockMovement[]>(pagedPath('/stock', movements.length, extra()));
      setMovements((current) => [...current, ...list]);
      setHasMore(pageHasMore(list));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar o kardex');
    } finally {
      setLoadingMore(false);
    }
  }

  async function submit() {
    try {
      setError('');
      if (open === 'entrada') {
        await post('/stock/entrada', { productId, quantity, notes });
      } else {
        await post('/stock/ajuste', { productId, newQuantity, notes });
      }
      setOpen(null);
      const list = await get<StockMovement[]>(pagedPath('/stock', 0, extra()));
      setMovements(list);
      setHasMore(pageHasMore(list));
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gravar o movimento');
    }
  }

  const filtered = Boolean(q.trim() || type || from || to);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Kardex</h2>
          <p>Toda saída de venda ou OS aparece aqui. O estoque atual nunca é editado na mão sem ajuste.</p>
        </div>
        {can('products.write') ? (
          <div className="row">
            <button type="button" className="btn" onClick={() => setOpen('ajuste')}>
              Ajuste
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setOpen('entrada')}>
              Entrada
            </button>
          </div>
        ) : null}
      </div>
      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="row filters">
        <label className="field field-grow">
          SKU ou peça
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="SKU ou nome" />
        </label>
        <label className="field">
          Tipo
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Todos</option>
            {Object.entries(STOCK_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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

      <article className="card">
        <div className="desktop-only table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Tipo</th>
                <th>Peça</th>
                <th>Qtd</th>
                <th>Antes → depois</th>
                <th>Preço</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement._id}>
                  <td>{new Date(movement.createdAt).toLocaleString('pt-BR')}</td>
                  <td>
                    <span className={movement.direction === 'saida' ? 'badge danger' : 'badge ok'}>
                      {STOCK_TYPES[movement.type] || movement.type}
                    </span>
                  </td>
                  <td>
                    {movement.name}
                    <div className="muted">{movement.sku}</div>
                  </td>
                  <td>
                    {movement.direction === 'saida' ? '-' : '+'}
                    {movement.quantity}
                  </td>
                  <td>
                    {movement.quantityBefore} → {movement.quantityAfter}
                  </td>
                  <td className="money">{formatBRL(movement.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {movements.length === 0 && !loadError ? (
          <p className="empty">{filtered ? 'Nenhum movimento neste filtro.' : 'Nenhum movimento ainda.'}</p>
        ) : null}

        <div className="mobile-only stack-list">
          {movements.map((movement) => (
            <article className="stack-item stack-item-static" key={movement._id}>
              <div className="stack-copy">
                <strong>{movement.name}</strong>
                <span className="muted">{movement.sku}</span>
                <span className="muted">{new Date(movement.createdAt).toLocaleString('pt-BR')}</span>
              </div>
              <div className="stack-meta">
                <span className={movement.direction === 'saida' ? 'badge danger' : 'badge ok'}>
                  {STOCK_TYPES[movement.type] || movement.type}
                </span>
                <b>
                  {movement.direction === 'saida' ? '-' : '+'}
                  {movement.quantity}
                </b>
                <span className="muted">
                  {movement.quantityBefore} → {movement.quantityAfter}
                </span>
                <span className="money">{formatBRL(movement.unitPrice)}</span>
              </div>
            </article>
          ))}
        </div>
        <LoadMore hasMore={hasMore} loading={loadingMore} onClick={() => void loadMore()} />
      </article>

      {open ? (
        <Modal title={open === 'entrada' ? 'Entrada de mercadoria' : 'Ajuste de estoque'} onClose={() => setOpen(null)}>
          <div className="grid">
            <label className="field">
              Produto
              <select value={productId} onChange={(event) => setProductId(event.target.value)}>
                <option value="">Selecione</option>
                {products.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name} ({product.currentStock})
                  </option>
                ))}
              </select>
            </label>
            {open === 'entrada' ? (
              <label className="field">
                Quantidade
                <input
                  type="number"
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                />
              </label>
            ) : (
              <label className="field">
                Novo estoque
                <input
                  type="number"
                  value={newQuantity}
                  onChange={(event) => setNewQuantity(Number(event.target.value))}
                />
              </label>
            )}
            <label className="field">
              Observação
              <input value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => void submit()}>
              Confirmar
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
