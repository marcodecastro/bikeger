import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import { PAYMENT_METHODS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import { useBusy } from '../lib/useBusy';
import type { CashMovement, CashRegister, DayReport, Receipt } from '../types';
import { MoneyInput } from '../components/MoneyInput';
import { ReceiptModal } from '../components/ReceiptModal';

export function Cash() {
  const [current, setCurrent] = useState<CashRegister | null>(null);
  const [history, setHistory] = useState<CashRegister[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [opening, setOpening] = useState(0);
  const [counted, setCounted] = useState(0);
  const [movementType, setMovementType] = useState('sangria');
  const [movementAmount, setMovementAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const { busy, run } = useBusy();

  async function load() {
    const [open, list, ledger] = await Promise.all([
      get<CashRegister | null>('/cash/current'),
      get<CashRegister[]>('/cash'),
      get<CashMovement[]>('/cash/movements?limit=80'),
    ]);
    setCurrent(open);
    setHistory(list);
    setMovements(ledger);
  }

  useEffect(() => {
    void load();
  }, []);

  async function openCash() {
    await run(async () => {
      try {
        setError('');
        await post('/cash/open', { openingAmount: opening, operator: 'balcão' });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao abrir o caixa');
      }
    });
  }

  async function launchMovement() {
    await run(async () => {
      try {
        setError('');
        await post('/cash/movement', {
          type: movementType,
          amount: movementAmount,
          notes,
        });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao lançar movimento');
      }
    });
  }

  async function closeCash() {
    await run(async () => {
      try {
        setError('');
        const closed = await post<CashRegister>('/cash/close', { countedCash: counted });
        if (closed.dayReport) setReceipt(closed.dayReport);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao fechar o caixa');
      }
    });
  }

  async function printDayReport(id: string) {
    const report = await get<DayReport & { receipt: Receipt }>(`/cash/${id}/day-report`);
    setReceipt(report.receipt);
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Caixa</h2>
          <p>Dinheiro físico separado do PIX e do cartão. Fechamento com diferença em centavos.</p>
        </div>
      </div>

      {!current ? (
        <article className="card">
          <h3>Abrir o dia</h3>
          <MoneyInput label="Fundo de caixa" valueCents={opening} onChangeCents={setOpening} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void openCash()}
          >
            Abrir caixa
          </button>
          {error ? <p className="error">{error}</p> : null}
        </article>
      ) : (
        <div className="grid grid-2">
          <article className="card">
            <h3>Livro do dia</h3>
            <p className="kpi">
              <span>Dinheiro no gaveteiro</span>
              <strong>{formatBRL(current.expectedCash)}</strong>
              <em>Fundo {formatBRL(current.openingAmount)}</em>
            </p>
            <div className="stack-list" style={{ marginTop: 12 }}>
              {Object.entries(current.summary?.byMethod || {}).map(([method, amount]) => (
                <div className="stack-item stack-item-static" key={method}>
                  <span>{PAYMENT_METHODS[method] || method}</span>
                  <span className="money">{formatBRL(amount)}</span>
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              Recebido no dia {formatBRL(current.summary?.receivedTotal || 0)} — PIX e cartão entram
              aqui, não no gaveteiro.
            </p>
          </article>
          <article className="card">
            <h3>Sangria / suprimento</h3>
            <select value={movementType} onChange={(event) => setMovementType(event.target.value)}>
              <option value="sangria">Sangria</option>
              <option value="suprimento">Suprimento</option>
            </select>
            <MoneyInput label="Valor" valueCents={movementAmount} onChangeCents={setMovementAmount} />
            <label className="field">
              Motivo
              <input value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <button
              type="button"
              className="btn"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void launchMovement()}
            >
              Lançar
            </button>
            <hr style={{ borderColor: 'var(--line)', margin: '20px 0' }} />
            <MoneyInput label="Dinheiro contado no fechamento" valueCents={counted} onChangeCents={setCounted} />
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void closeCash()}
            >
              Fechar caixa
            </button>
          </article>
        </div>
      )}

      <article className="card table-wrap" style={{ marginTop: 16 }}>
        <h3>Histórico</h3>
        <table>
          <thead>
            <tr>
              <th>Abertura</th>
              <th>Status</th>
              <th>Gaveteiro</th>
              <th>PIX</th>
              <th>Cartão</th>
              <th>Diferença</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {history.map((register) => (
              <tr key={register._id}>
                <td>{new Date(register.openedAt).toLocaleString('pt-BR')}</td>
                <td>{register.status}</td>
                <td>gaveteiro {formatBRL(register.expectedCash)}</td>
                <td>PIX {formatBRL(register.summary?.byMethod?.pix || 0)}</td>
                <td>cartão {formatBRL((register.summary?.byMethod?.cartao_credito || 0) + (register.summary?.byMethod?.cartao_debito || 0))}</td>
                <td className="money">{formatBRL(register.difference)}</td>
                <td>
                  {register.status === 'fechado' ? (
                    <button type="button" className="btn btn-ghost" onClick={() => void printDayReport(register._id)}>
                      Relatório
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="card table-wrap" style={{ marginTop: 16 }}>
        <h3>Movimentos</h3>
        <p className="muted">Livro consultável: PIX da semana, sangria do mês — não só o array do caixa aberto.</p>
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Tipo</th>
              <th>Meio</th>
              <th>Valor</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {(movements || []).map((movement) => (
              <tr key={movement._id}>
                <td>{new Date(movement.createdAt).toLocaleString('pt-BR')}</td>
                <td>{movement.type}</td>
                <td>{PAYMENT_METHODS[movement.method || ''] || movement.method || '—'}</td>
                <td className="money">{formatBRL(movement.amount)}</td>
                <td className="muted">{movement.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      {receipt ? <ReceiptModal title="Relatório do dia" receipt={receipt} onClose={() => setReceipt(null)} /> : null}
    </section>
  );
}
