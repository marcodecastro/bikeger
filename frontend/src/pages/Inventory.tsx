import { useEffect, useRef, useState, type FormEvent } from 'react';
import { get, patch, post } from '../lib/api';
import { INVENTORY_STATUS } from '../lib/labels';
import { useBusy } from '../lib/useBusy';
import type { InventoryCount } from '../types';
import { Modal } from '../components/Modal';

function diffOf(item: InventoryCount['items'][number]) {
  return item.countedQty - item.systemQty;
}

export function Inventory() {
  const [count, setCount] = useState<InventoryCount | null>(null);
  const [history, setHistory] = useState<InventoryCount[]>([]);
  const [opened, setOpened] = useState<InventoryCount | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [pending, setPending] = useState<null | 'apply' | 'cancel'>(null);
  const { busy, run } = useBusy();
  const inputRef = useRef<HTMLInputElement>(null);

  async function reloadHistory() {
    const list = await get<InventoryCount[]>('/inventory?limit=50');
    setHistory(list);
    return list;
  }

  async function load() {
    try {
      setLoadError('');
      const list = await reloadHistory();
      const open = list.find((item) => item.status === 'aberta') || null;
      setCount((current) => open || (current?.status === 'aplicada' ? current : null));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar o inventário');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function openSession() {
    await run(async () => {
      try {
        setError('');
        const next = await post<InventoryCount>('/inventory', {});
        setCount(next);
        setOpened(null);
        await reloadHistory();
        inputRef.current?.focus();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao abrir a contagem');
      }
    });
  }

  async function scan(event: FormEvent) {
    event.preventDefault();
    if (!count || !code.trim()) return;
    await run(async () => {
      try {
        setError('');
        const next = await post<InventoryCount>(`/inventory/${count._id}/scan`, {
          code: code.trim(),
          quantity: 1,
        });
        setCount(next);
        setCode('');
        inputRef.current?.focus();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Peça não encontrada');
      }
    });
  }

  async function setQty(productId: string, countedQty: number) {
    if (!count) return;
    try {
      setError('');
      setCount(await patch<InventoryCount>(`/inventory/${count._id}/items/${productId}`, { countedQty }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gravar a quantidade');
    }
  }

  async function confirmPending() {
    if (!count || !pending) return;
    await run(async () => {
      try {
        setError('');
        if (pending === 'apply') {
          const next = await post<InventoryCount>(`/inventory/${count._id}/apply`, {});
          setCount(next);
        } else {
          await post<InventoryCount>(`/inventory/${count._id}/cancel`, {});
          setCount(null);
        }
        setPending(null);
        await reloadHistory();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : pending === 'apply'
              ? 'Falha ao aplicar o inventário'
              : 'Falha ao cancelar a contagem',
        );
      }
    });
  }

  const viewing = opened && opened._id !== count?._id ? opened : null;

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Inventário</h2>
          <p>Bipe a gôndola. O sistema compara com o estoque e gera ajuste no kardex — sem editar ficha na mão.</p>
        </div>
        {count?.status === 'aberta' ? (
          <div className="row">
            <button type="button" className="btn" disabled={busy} onClick={() => setPending('cancel')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setPending('apply')}>
              Aplicar no estoque
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void openSession()}>
            Nova contagem
          </button>
        )}
      </div>
      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {count?.status === 'aberta' ? (
        <article className="card">
          <p className="muted">
            {count.number} · {count.items.length} SKU · {count.operator || 'sem operador'}
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
          <CountItems count={count} editable onQty={setQty} />
        </article>
      ) : count?.status === 'aplicada' ? (
        <article className="card">
          <p>
            {count.number} aplicada em {count.appliedAt ? new Date(count.appliedAt).toLocaleString('pt-BR') : 'agora'}
            {count.operator ? ` · ${count.operator}` : ''}.
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

      <article className="card" style={{ marginTop: 16 }}>
        <h3>Contagens anteriores</h3>
        {history.length === 0 && !loadError ? (
          <p className="empty">Nenhuma contagem ainda.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Status</th>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>SKU</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item._id}>
                    <td>{item.number}</td>
                    <td>
                      <span className={item.status === 'cancelada' ? 'badge danger' : item.status === 'aplicada' ? 'badge ok' : 'badge info'}>
                        {INVENTORY_STATUS[item.status] || item.status}
                      </span>
                    </td>
                    <td>
                      {item.appliedAt
                        ? new Date(item.appliedAt).toLocaleString('pt-BR')
                        : new Date(item.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td>{item.operator || '—'}</td>
                    <td>{item.items.length}</td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => setOpened(item)}>
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {viewing ? (
        <article className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>
              {viewing.number} · {INVENTORY_STATUS[viewing.status]}
              {viewing.operator ? ` · ${viewing.operator}` : ''}
            </h3>
            <button type="button" className="btn" onClick={() => setOpened(null)}>
              Fechar
            </button>
          </div>
          <CountItems count={viewing} />
        </article>
      ) : null}

      {pending ? (
        <Modal
          title={pending === 'apply' ? 'Aplicar inventário' : 'Cancelar contagem'}
          onClose={() => setPending(null)}
        >
          <p>
            {pending === 'apply'
              ? `A contagem ${count?.number} vira a verdade do estoque. Cada diferença gera ajuste no kardex.`
              : `Cancelar ${count?.number}? Nada entra no kardex.`}
          </p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="row" style={{ marginTop: 16 }}>
            <button
              type="button"
              className={pending === 'apply' ? 'btn btn-primary' : 'btn btn-danger'}
              disabled={busy}
              aria-busy={busy}
              onClick={() => void confirmPending()}
            >
              {pending === 'apply' ? 'Confirmar e aplicar' : 'Confirmar cancelamento'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function CountItems({
  count,
  editable,
  onQty,
}: {
  count: InventoryCount;
  editable?: boolean;
  onQty?: (productId: string, countedQty: number) => void;
}) {
  if (count.items.length === 0) {
    return <p className="empty">{editable ? 'Nada contado ainda.' : 'Nenhum SKU nesta contagem.'}</p>;
  }
  return (
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
                  {editable && onQty ? (
                    <input
                      className="qty-input"
                      type="number"
                      min={0}
                      value={item.countedQty}
                      onChange={(event) => onQty(item.product, Number(event.target.value))}
                    />
                  ) : (
                    item.countedQty
                  )}
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
  );
}
