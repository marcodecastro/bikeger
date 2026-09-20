import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import { formatBRL } from '../lib/money';
import type { Product, Purchase, Supplier } from '../types';
import { EntitySearch } from '../components/EntitySearch';
import { MoneyInput } from '../components/MoneyInput';

interface DraftLine {
  productId: string;
  label: string;
  quantity: number;
  unitCost: number;
}

export function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [productId, setProductId] = useState('');
  const [productLabel, setProductLabel] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const searchProducts = useCallback(
    (q: string) => get<Product[]>(`/products?q=${encodeURIComponent(q)}&active=true`),
    [],
  );

  async function load() {
    const [list, catalog] = await Promise.all([
      get<Purchase[]>('/purchases'),
      get<Supplier[]>('/suppliers'),
    ]);
    setPurchases(list);
    setSuppliers(catalog);
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, []);

  function addLine() {
    if (!productId || quantity < 1) return;
    setLines((current) => {
      const existing = current.find((line) => line.productId === productId);
      if (existing) {
        return current.map((line) =>
          line.productId === productId
            ? { ...line, quantity: line.quantity + quantity, unitCost }
            : line,
        );
      }
      return [...current, { productId, label: productLabel, quantity, unitCost }];
    });
    setProductId('');
    setProductLabel('');
    setQuantity(1);
  }

  async function receive() {
    setBusy(true);
    setError('');
    try {
      await post('/purchases', {
        supplierId,
        notes,
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost,
        })),
      });
      setLines([]);
      setNotes('');
      await load();
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
          <p className="muted">Bipe ou busque as peças da nota. O custo médio só muda depois de receber.</p>
        )}
        <label className="field" style={{ marginTop: 12 }}>
          Nota
          <input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
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

      <article className="card table-wrap" style={{ marginTop: 16 }}>
        <h3>Histórico</h3>
        {purchases.length === 0 ? (
          <p className="empty">Nenhuma compra ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Número</th>
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
                  <td>{typeof purchase.supplier === 'object' ? purchase.supplier.name : purchase.supplier}</td>
                  <td>{purchase.items.length}</td>
                  <td className="money">{formatBRL(purchase.itemsTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
