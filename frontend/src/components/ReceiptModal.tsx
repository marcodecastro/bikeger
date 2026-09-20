import type { Receipt, ShelfLabel } from '../types';
import { Modal } from './Modal';
import { formatBRL } from '../lib/money';

interface ReceiptModalProps {
  receipt: Receipt | ShelfLabel;
  onClose: () => void;
  title?: string;
}

function isShelfLabel(receipt: Receipt | ShelfLabel): receipt is ShelfLabel {
  return 'labels' in receipt && Array.isArray(receipt.labels);
}

export function ReceiptModal({ receipt, onClose, title = 'Cupom térmico' }: ReceiptModalProps) {
  const shelf = isShelfLabel(receipt);

  function printReceipt() {
    window.print();
  }

  function downloadEscPos() {
    const bytes = Uint8Array.from(atob(receipt.escposBase64), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = shelf ? 'etiqueta-bikeger.bin' : 'cupom-bikeger.bin';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal title={title} onClose={onClose}>
      {shelf ? (
        <div className="print-area label-sheet">
          {receipt.labels.map((label) => (
            <div className="label-40x30" key={label.productId}>
              {receipt.store?.name ? <strong>{receipt.store.name}</strong> : null}
              <div>{label.name}</div>
              <div className="muted">{label.sku}</div>
              <div className="money">{formatBRL(label.price)}</div>
              <div className="money">{label.barcode}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="print-area receipt">
          {receipt.store?.logo ? (
            <img className="receipt-logo" src={receipt.store.logo} alt={receipt.store.name || 'Logo'} />
          ) : null}
          {receipt.text}
        </div>
      )}
      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" onClick={printReceipt}>
          {shelf ? 'Imprimir 40×30' : 'Imprimir 80mm'}
        </button>
        <button type="button" className="btn" onClick={downloadEscPos}>
          Baixar ESC/POS
        </button>
      </div>
      <p className="muted">
        {shelf
          ? 'A plaquinha usa 40×30 mm. O arquivo ESC/POS vai para a térmica de etiqueta.'
          : 'O botão de imprimir usa o layout de 80mm. O arquivo ESC/POS serve para impressoras térmicas conectadas via utilitário local ou spooler.'}
      </p>
    </Modal>
  );
}
