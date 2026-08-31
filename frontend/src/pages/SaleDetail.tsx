import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import { PAYMENT_METHODS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import { useBusy } from '../lib/useBusy';
import type { FiscalDocument, Receipt, Sale } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';
import { Modal } from '../components/Modal';

export function SaleDetail() {
  const { id } = useParams();
  const [sale, setSale] = useState<Sale | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [fiscal, setFiscal] = useState<FiscalDocument[]>([]);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<null | { kind: 'sale' } | { kind: 'nfce'; docId: string }>(null);
  const { busy, run } = useBusy();

  async function load() {
    if (!id) return;
    setSale(await get<Sale>(`/sales/${id}`));
    setFiscal(await get<FiscalDocument[]>(`/fiscal/sale/${id}`).catch(() => []));
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [id]);

  if (!sale) return <section className="page">{error || 'Carregando venda...'}</section>;

  const canReturn = sale.status === 'paga';

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>{sale.number}</h2>
          <p>
            {sale.customer?.name || 'Cliente avulso'} · {sale.status}
          </p>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={async () => setReceipt(await get<Receipt>(`/sales/${id}/receipt`))}
          >
            Cupom térmico (não é NFC-e)
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            aria-busy={busy}
            onClick={() =>
              void run(async () => {
                try {
                  const doc = await post<FiscalDocument>(`/fiscal/sale/${id}`);
                  setFiscal([doc, ...fiscal.filter((item) => item._id !== doc._id)]);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Falha ao gerar NFC-e');
                }
              })
            }
          >
            Gerar NFC-e
          </button>
          {sale.status !== 'cancelada' && sale.status !== 'devolvida' ? (
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              aria-busy={busy}
              onClick={() => setPending({ kind: 'sale' })}
            >
              Cancelar e estornar estoque
            </button>
          ) : null}
        </div>
      </div>
      <article className="card">
        <table>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item._id || item.sku + item.name}>
                <td>
                  {item.quantity}x {item.name}
                  {item.returnedQuantity ? (
                    <div className="muted">devolvido {item.returnedQuantity}</div>
                  ) : null}
                </td>
                <td className="money">{formatBRL(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="money" style={{ fontSize: 28 }}>
          {formatBRL(sale.total)}
        </p>
        {sale.payments.map((payment) => (
          <p key={payment._id}>
            {PAYMENT_METHODS[payment.method] || payment.method}: {formatBRL(payment.amount)}
          </p>
        ))}
      </article>

      {canReturn ? (
        <article className="card" style={{ marginTop: 16 }}>
          <h3>Devolução</h3>
          <p className="muted">A peça volta ao estoque. Devolução total tenta cancelar a NFC-e na SEFAZ.</p>
          {sale.items.map((item) => {
            const open = item.quantity - (item.returnedQuantity || 0);
            const key = item._id || item.sku;
            return (
              <label className="field" key={key}>
                {item.name} (aberto {open})
                <input
                  type="number"
                  min={0}
                  max={open}
                  value={returnQty[key] ?? 0}
                  onChange={(event) =>
                    setReturnQty((current) => ({ ...current, [key]: Number(event.target.value) }))
                  }
                />
              </label>
            );
          })}
          <label className="field">
            Motivo
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            aria-busy={busy}
            onClick={() =>
              void run(async () => {
                try {
                  setError('');
                  const items = sale.items
                    .map((item) => ({
                      itemId: item._id,
                      quantity: returnQty[item._id || item.sku] || 0,
                    }))
                    .filter((item) => item.quantity > 0);
                  setSale(await post(`/sales/${id}/return`, { items, reason }));
                  setReturnQty({});
                  setReason('');
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Falha na devolução');
                }
              })
            }
          >
            Registrar devolução
          </button>
        </article>
      ) : null}

      {sale.returns?.length ? (
        <article className="card" style={{ marginTop: 16 }}>
          <h3>Devoluções</h3>
          {sale.returns.map((entry, index) => (
            <div className="stack-item stack-item-static" key={`${entry.reason}-${index}`}>
              <div>
                <strong>{formatBRL(entry.amount)}</strong>
                <div className="muted">{entry.reason}</div>
              </div>
              <span>{PAYMENT_METHODS[entry.method] || entry.method}</span>
            </div>
          ))}
        </article>
      ) : null}

      <article className="card" style={{ marginTop: 16 }}>
        <h3>Documento fiscal</h3>
        <p className="muted">O cupom da térmica não substitui NFC-e.</p>
        {error ? <p className="error">{error}</p> : null}
        {fiscal.length ? (
          fiscal.map((doc) => (
            <div className="stack-item stack-item-static" key={doc._id}>
              <div>
                <strong>{doc.status}</strong>
                <div className="muted">
                  {doc.errorMessage || doc.accessKey || doc.sefazStatus || doc.provider}
                </div>
              </div>
              <div className="row">
                <span className="money">{formatBRL(doc.amount)}</span>
                {doc.status === 'autorizada' ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() => setPending({ kind: 'nfce', docId: doc._id })}
                  >
                    Cancelar NFC-e
                  </button>
                ) : null}
                {doc.status === 'pendente' || doc.status === 'rejeitada' ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() =>
                      void run(async () => {
                        try {
                          setError('');
                          const updated = await post<FiscalDocument>(`/fiscal/${doc._id}/emit`);
                          setFiscal(fiscal.map((item) => (item._id === updated._id ? updated : item)));
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Falha ao emitir NFC-e');
                        }
                      })
                    }
                  >
                    Emitir na SEFAZ
                  </button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p className="muted">
            Nenhum rascunho de NFC-e ainda. Sem token, CSC e endereço do emitente a SEFAZ recusa.
          </p>
        )}
      </article>
      {receipt ? <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} /> : null}
      {pending ? (
        <Modal
          title={pending.kind === 'sale' ? 'Cancelar venda' : 'Cancelar NFC-e'}
          onClose={() => setPending(null)}
        >
          <p>
            {pending.kind === 'sale'
              ? `A venda ${sale.number} devolve as peças ao estoque e estorna o caixa. Uma NFC-e já autorizada precisa ser cancelada à parte na SEFAZ.`
              : 'A nota autorizada será cancelada na SEFAZ. Só siga se a loja realmente precisa anular o documento fiscal.'}
          </p>
          {error ? <p className="error">{error}</p> : null}
          <div className="row" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              aria-busy={busy}
              onClick={() =>
                void run(async () => {
                  try {
                    setError('');
                    if (pending.kind === 'sale') {
                      setSale(await post(`/sales/${id}/cancel`, { notes: 'Cancelamento no painel' }));
                      await load();
                    } else {
                      const updated = await post<FiscalDocument>(`/fiscal/${pending.docId}/cancel`, {
                        justificativa: 'Cancelamento solicitado no painel BikeGer',
                      });
                      setFiscal(fiscal.map((item) => (item._id === updated._id ? updated : item)));
                    }
                    setPending(null);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : pending.kind === 'sale'
                          ? 'Falha ao cancelar a venda'
                          : 'Falha ao cancelar a NFC-e',
                    );
                  }
                })
              }
            >
              {pending.kind === 'sale' ? 'Confirmar e estornar' : 'Confirmar cancelamento na SEFAZ'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
