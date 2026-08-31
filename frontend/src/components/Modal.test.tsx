import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('fecha com Escape e expõe o título para leitores de tela', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal title="Abrir ordem de serviço" onClose={onClose}>
        <button type="button">Confirmar</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Abrir ordem de serviço' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prende o Tab dentro do diálogo', async () => {
    const user = userEvent.setup();
    render(
      <Modal title="Cupom térmico" onClose={() => undefined}>
        <button type="button">Imprimir 80mm</button>
        <button type="button">Baixar ESC/POS</button>
      </Modal>,
    );

    const close = screen.getByRole('button', { name: 'Fechar' });
    const print = screen.getByRole('button', { name: 'Imprimir 80mm' });
    const download = screen.getByRole('button', { name: 'Baixar ESC/POS' });

    expect(close).toHaveFocus();
    await user.tab();
    expect(print).toHaveFocus();
    await user.tab();
    expect(download).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(download).toHaveFocus();
  });
});
