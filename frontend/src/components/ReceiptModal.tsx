import type { Receipt } from '../types';
import { Modal } from './Modal';

interface ReceiptModalProps {
  receipt: Receipt;
  onClose: () => void;
}

export function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  function printReceipt() {
    window.print();
  }

  function downloadEscPos() {
    const bytes = Uint8Array.from(atob(receipt.escposBase64), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cupom-bikeger.bin';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal title="Cupom térmico" onClose={onClose}>
      <div className="print-area receipt">{receipt.text}</div>
      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" onClick={printReceipt}>
          Imprimir 80mm
        </button>
        <button type="button" className="btn" onClick={downloadEscPos}>
          Baixar ESC/POS
        </button>
      </div>
      <p className="muted">
        O botão de imprimir usa o layout de 80mm. O arquivo ESC/POS serve para impressoras
        térmicas conectadas via utilitário local ou spooler.
      </p>
    </Modal>
  );
}
