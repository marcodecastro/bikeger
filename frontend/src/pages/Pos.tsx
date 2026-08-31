import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { get, post } from '../lib/api';
import { PAYMENT_METHODS } from '../lib/labels';
import { addCartLine, cartTotals } from '../lib/cart';
import { formatBRL, multiplyCents } from '../lib/money';
import { useBusy } from '../lib/useBusy';
import type { CashRegister, Customer, Product, Receipt, Sale } from '../types';
import { MoneyInput } from '../components/MoneyInput';
import { ReceiptModal } from '../components/ReceiptModal';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export function Pos() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState('pix');
  const [cashReceived, setCashReceived] = useState(0);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [cashOpen, setCashOpen] = useState<boolean | null>(null);
  const { busy, run } = useBusy();

  useEffect(() => {
    get<Customer[]>('/customers').then(setCustomers).catch(() => undefined);
    get<CashRegister | null>('/cash/current')
      .then((register) => setCashOpen(Boolean(register?._id)))
      .catch(() => setCashOpen(null));
  }, []);

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

  const { subtotal, total, change } = useMemo(
    () => cartTotals(cart, discount, method, cashReceived),
    [cart, discount, method, cashReceived],
  );

  function addProduct(product: Product) {
    const available = product.availableStock ?? product.currentStock;
    setCart((current) => {
      const result = addCartLine(
        current.map((item) => ({
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
      const found = current.find((item) => item.product._id === product._id);
      if (!found) return [...current, { product, quantity: 1, unitPrice: product.salePrice }];
      return current.map((item) =>
        item.product._id === product._id ? { ...item, quantity: qty } : item,
      );
    });
    setQuery('');
    setHits([]);
  }

  async function lookupExact(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    try {
      const product = await get<Product>(`/products/lookup/${encodeURIComponent(query.trim())}`);
      addProduct(product);
    } catch {
      if (hits[0]) addProduct(hits[0]);
    }
  }

  async function checkout() {
    await run(async () => {
      try {
        setError('');
        const sale = await post<Sale>('/sales', {
          customer: customerId || null,
          items: cart.map((item) => ({
            product: item.product._id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          discount,
          payments: [{ method, amount: total, status: 'aprovado' }],
          cashReceived: method === 'dinheiro' ? cashReceived : 0,
        });
        const printed = await get<Receipt>(`/sales/${sale._id}/receipt`);
        setCart([]);
        setDiscount(0);
        setCashReceived(0);
        setReceipt(printed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao finalizar venda');
      }
    });
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>PDV</h2>
          <p>Leia o código de barras ou busque a peça. O estoque sai na hora da venda.</p>
        </div>
      </div>

      <div className="pos">
        <article className="card">
          <form onSubmit={lookupExact}>
            <label className="field">
              Busca / código de barras
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="SKU, código ou nome"
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
                        <strong>{product.name}</strong>
                        <div className="muted">
                          {product.sku} · livre {product.availableStock ?? product.currentStock}
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

          <div style={{ marginTop: 20 }}>
            {cart.length === 0 ? <p className="empty">Carrinho vazio.</p> : null}
            {cart.map((item) => (
              <div className="cart-line" key={item.product._id}>
                <div>
                  <strong>{item.product.name}</strong>
                  <div className="muted">{item.product.sku}</div>
                </div>
                <input
                  style={{ width: 70 }}
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) => {
                    const quantity = Number(event.target.value);
                    setCart((current) =>
                      current.map((line) =>
                        line.product._id === item.product._id ? { ...line, quantity } : line,
                      ),
                    );
                  }}
                />
                <span className="money">{formatBRL(multiplyCents(item.unitPrice, item.quantity))}</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setCart((current) => current.filter((line) => line.product._id !== item.product._id))
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <label className="field">
            Cliente
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Balcão / avulso</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
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
          {error ? <p className="error">{error}</p> : null}
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 12 }}
            disabled={!cart.length || cashOpen === false || busy}
            aria-busy={busy}
            onClick={() => void checkout()}
          >
            Finalizar e imprimir
          </button>
        </article>
      </div>

      {receipt ? <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} /> : null}
    </section>
  );
}
