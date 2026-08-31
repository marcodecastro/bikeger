import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatBRL } from '../lib/money';
import type { Product, StockMovement } from '../types';
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

  async function load() {
    const [list, catalog] = await Promise.all([
      get<StockMovement[]>('/stock'),
      get<Product[]>('/products'),
    ]);
    setMovements(list);
    setProducts(catalog);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    if (open === 'entrada') {
      await post('/stock/entrada', { productId, quantity, notes });
    } else {
      await post('/stock/ajuste', { productId, newQuantity, notes });
    }
    setOpen(null);
    await load();
  }

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
                      {movement.type}
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
                  {movement.type}
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
            <button type="button" className="btn btn-primary" onClick={() => void submit()}>
              Confirmar
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
