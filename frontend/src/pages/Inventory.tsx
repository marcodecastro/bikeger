import { useEffect, useRef, useState, type FormEvent } from 'react';
import { get, patch, post } from '../lib/api';
import type { InventoryCount } from '../types';

function diffOf(item: InventoryCount['items'][number]) {
  return item.countedQty - item.systemQty;
}

export function Inventory() {
  const [count, setCount] = useState<InventoryCount | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function openSession() {
    setBusy(true);
    setError('');
    try {
      const next = await post<InventoryCount>('/inventory', {});
      setCount(next);
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir a contagem');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    get<InventoryCount[]>('/inventory?status=aberta')
      .then((list) => {
        if (list[0]) setCount(list[0]);
      })
      .catch(() => undefined);
  }, []);

  async function scan(event: FormEvent) {
    event.preventDefault();
    if (!count || !code.trim()) return;
    setBusy(true);
    setError('');
    try {
      const next = await post<InventoryCount>(`/inventory/${count._id}/scan`, {
        code: code.trim(),
        quantity: 1,
      });
      setCount(next);
      setCode('');
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Peça não encontrada');
    } finally {
      setBusy(false);
    }
  }

  async function setQty(productId: string, countedQty: number) {
    if (!count) return;
    setCount(await patch<InventoryCount>(`/inventory/${count._id}/items/${productId}`, { countedQty }));
  }

  async function apply() {
    if (!count) return;
    if (!window.confirm('Aplicar a contagem no kardex? O estoque físico vira a verdade.')) return;
    setBusy(true);
    setError('');
    try {
      setCount(await post<InventoryCount>(`/inventory/${count._id}/apply`, {}));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aplicar o inventário');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!count) return;
    if (!window.confirm('Cancelar esta contagem? Nada entra no kardex.')) return;
    setBusy(true);
    setError('');
    try {
      await post<InventoryCount>(`/inventory/${count._id}/cancel`, {});
      setCount(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cancelar a contagem');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Inventário</h2>
          <p>Bipe a gôndola. O sistema compara com o estoque e gera ajuste no kardex — sem editar ficha na mão.</p>
        </div>
        {count?.status === 'aberta' ? (
          <div className="row">
            <button type="button" className="btn" disabled={busy} onClick={() => void cancel()}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void apply()}>
              Aplicar no estoque
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => void openSession()}>
            Nova contagem
          </button>
        )}
      </div>

      {count?.status === 'aberta' ? (
        <article className="card">
          <p className="muted">
            {count.number} · {count.items.length} SKU
          </p>
          <form className="row" onSubmit={(event) => void scan(event)}>
            <label className="field field-grow">
              Código de barras ou SKU
              <input
                ref={inputRef}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoFocus
                autoComplete="off"
                inputMode="numeric"
                placeholder="Bipe e Enter"
              />
            </label>
            <button type="submit" className="btn" disabled={busy || !code.trim()}>
              Contar +1
            </button>
          </form>
          {error ? <p className="error">{error}</p> : null}
          {count.items.length === 0 ? (
            <p className="empty">Nada contado ainda.</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Peça</th>
                    <th>Sistema</th>
                    <th>Contado</th>
                    <th>Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {count.items.map((item) => {
                    const diff = diffOf(item);
                    return (
                      <tr key={item.product}>
                        <td>
                          {item.name}
                          <div className="muted">
                            {item.sku}
                            {item.barcode ? ` · ${item.barcode}` : ''}
                          </div>
                        </td>
                        <td>{item.systemQty}</td>
                        <td>
                          <input
                            className="qty-input"
                            type="number"
                            min={0}
                            value={item.countedQty}
                            onChange={(event) => void setQty(item.product, Number(event.target.value))}
                          />
                        </td>
                        <td className={diff === 0 ? 'muted' : diff < 0 ? 'error' : ''}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ) : count?.status === 'aplicada' ? (
        <article className="card">
          <p>
            {count.number} aplicada em {count.appliedAt ? new Date(count.appliedAt).toLocaleString('pt-BR') : 'agora'}.
          </p>
          <button type="button" className="btn" onClick={() => void openSession()}>
            Começar outra
          </button>
        </article>
      ) : (
        <article className="card">
          <p className="muted">Abra uma contagem para bipar a prateleira no celular.</p>
        </article>
      )}
    </section>
  );
}
