import { OS_STATUS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import type { WorkOrder } from '../types';
import { Modal } from './Modal';

interface WorkOrderSheetProps {
  order: WorkOrder;
  storeName: string;
  storeLogo?: string;
  onClose: () => void;
}

export function WorkOrderSheet({ order, storeName, storeLogo, onClose }: WorkOrderSheetProps) {
  const title = ['diagnostico', 'orcamento'].includes(order.status) ? 'Orçamento' : 'Ordem de serviço';

  return (
    <Modal title={`${title} ${order.number}`} onClose={onClose}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Imprimir / PDF
        </button>
      </div>
      <div className="print-area os-sheet">
        <header className="os-sheet-head">
          {storeLogo ? <img src={storeLogo} alt="" className="os-sheet-logo" /> : null}
          <div>
            <strong>{storeName || 'BikeGer'}</strong>
            <h2>
              {title} {order.number}
            </h2>
            <p className="muted">
              {OS_STATUS[order.status] || order.status} ·{' '}
              {new Date(order.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </header>
        <p>
          <strong>Cliente:</strong> {order.customer?.name || '—'}
          {order.customer?.phone ? ` · ${order.customer.phone}` : ''}
        </p>
        <p>
          <strong>Bicicleta:</strong> {order.bike?.brand} {order.bike?.model}
          {order.bike?.serialNumber ? ` · série ${order.bike.serialNumber}` : ''}
        </p>
        {order.mechanic ? (
          <p>
            <strong>Mecânico:</strong> {order.mechanic}
          </p>
        ) : null}
        {order.complaint ? (
          <p>
            <strong>Relato:</strong> {order.complaint}
          </p>
        ) : null}
        {order.diagnosis ? (
          <p>
            <strong>Diagnóstico:</strong> {order.diagnosis}
          </p>
        ) : null}

        {order.services.length ? (
          <table>
            <thead>
              <tr>
                <th>Mão de obra</th>
                <th>Qtd</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.services.map((item) => (
                <tr key={item._id}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td className="money">{formatBRL(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {order.parts.length ? (
          <table>
            <thead>
              <tr>
                <th>Peças</th>
                <th>Qtd</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.parts.map((item) => (
                <tr key={item._id}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td className="money">{formatBRL(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <div className="os-sheet-totals">
          <p>Mão de obra {formatBRL(order.laborTotal)}</p>
          <p>Peças {formatBRL(order.partsTotal)}</p>
          {order.discount ? <p>Desconto {formatBRL(order.discount)}</p> : null}
          <p>
            <strong>Total {formatBRL(order.total)}</strong>
          </p>
        </div>

        <div className="os-sign">
          <p>Assinatura do cliente</p>
          <p>Assinatura da loja</p>
        </div>
      </div>
    </Modal>
  );
}
