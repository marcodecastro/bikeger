import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CATEGORIES } from '../lib/labels';
import { pageHasMore, pagedPath } from '../lib/listPage';
import { formatBRL } from '../lib/money';
import type { Product, ShelfLabel } from '../types';
import { LoadMore } from '../components/LoadMore';
import { ReceiptModal } from '../components/ReceiptModal';

export function Products() {
  const { can } = useAuth();
  const canEdit = can('products.write');
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [active, setActive] = useState('');
  const [label, setLabel] = useState<ShelfLabel | null>(null);
  const [loadError, setLoadError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  function extra() {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (stock === 'low') params.lowStock = 'true';
    if (active) params.active = active;
    return params;
  }

  useEffect(() => {
    const delay = q.trim() ? 160 : 0;
    const timer = window.setTimeout(() => {
      get<Product[]>(pagedPath('/products', 0, extra()))
        .then((list) => {
          setLoadError('');
          setProducts(list);
          setHasMore(pageHasMore(list));
        })
        .catch((err: unknown) => {
          setLoadError(err instanceof Error ? err.message : 'Falha ao carregar os produtos');
        });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [q, category, stock, active]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      setLoadError('');
      const list = await get<Product[]>(pagedPath('/products', products.length, extra()));
      setProducts((current) => [...current, ...list]);
      setHasMore(pageHasMore(list));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar os produtos');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Produtos</h2>
          <p>Peças e acessórios. Preços em centavos, estoque sempre atualizado pelas movimentações.</p>
        </div>
        {can('products.write') || can('settings') ? (
          <Link className="btn btn-primary" to="/produtos/novo">
            Nova peça
          </Link>
        ) : null}
      </div>
      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="row filters">
        <label className="field field-grow">
          Buscar
          <input value={q} onChange={(event) => setQ(event.target.value)} />
        </label>
        <label className="field">
          Categoria
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Todas</option>
            {CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Estoque
          <select value={stock} onChange={(event) => setStock(event.target.value)}>
            <option value="">Todos</option>
            <option value="low">Abaixo do mínimo</option>
          </select>
        </label>
        <label className="field">
          Situação
          <select value={active} onChange={(event) => setActive(event.target.value)}>
            <option value="">Todas</option>
            <option value="true">Ativas</option>
            <option value="false">Inativas</option>
          </select>
        </label>
      </div>

      <article className="card table-wrap">
        {products.length === 0 && !loadError ? (
          <p className="empty">Nenhuma peça encontrada.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produto</th>
                <th>Estoque</th>
                {can('sales') ? <th>Custo</th> : null}
                <th>Venda</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id}>
                  <td className="money">{product.sku}</td>
                  <td>
                    <Link to={`/produtos/${product._id}`}>{product.name}</Link>
                    <div className="muted">
                      {product.brand} · {product.category}
                      {product.active === false ? ' · inativa' : ''}
                    </div>
                  </td>
                  <td>
                    {product.currentStock} {product.unit}
                    {product.currentStock <= product.minStock ? (
                      <div className="badge warn">mín. {product.minStock}</div>
                    ) : null}
                  </td>
                  {can('sales') ? <td className="money">{formatBRL(product.costPrice ?? 0)}</td> : null}
                  <td className="money">{formatBRL(product.salePrice)}</td>
                  <td>
                    <div className="row">
                      <Link className="btn" to={`/produtos/${product._id}`}>
                        {canEdit ? 'Editar' : 'Abrir'}
                      </Link>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void get<ShelfLabel>(`/products/${product._id}/label`).then(setLabel)}
                      >
                        Etiqueta
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <LoadMore hasMore={hasMore} loading={loadingMore} onClick={() => void loadMore()} />
      </article>
      {label ? <ReceiptModal receipt={label} title="Etiqueta 40×30" onClose={() => setLabel(null)} /> : null}
    </section>
  );
}
