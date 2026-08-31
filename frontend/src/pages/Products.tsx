import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CATEGORIES } from '../lib/labels';
import { formatBRL } from '../lib/money';
import type { Product } from '../types';

export function Products() {
  const { can } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    get<Product[]>(`/products?${params.toString()}`).then(setProducts).catch(() => undefined);
  }, [q, category]);

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

      <div className="row" style={{ marginBottom: 16 }}>
        <label className="field" style={{ minWidth: 240 }}>
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
      </div>

      <article className="card table-wrap">
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
                  {product.name}
                  <div className="muted">
                    {product.brand} · {product.category}
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
                  <Link to={`/produtos/${product._id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}
