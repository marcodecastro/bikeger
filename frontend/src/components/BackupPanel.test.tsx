import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupPanel, RESTORE_CONFIRM } from './BackupPanel';

const get = vi.fn();
const post = vi.fn();
const downloadFile = vi.fn();
const postBackupUpload = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    downloadFile: (...args: unknown[]) => downloadFile(...args),
    postBackupUpload: (...args: unknown[]) => postBackupUpload(...args),
  };
});

describe('Backup e restore', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    downloadFile.mockReset();
    postBackupUpload.mockReset();
    get.mockResolvedValue({
      source: 'localhost',
      ephemeral: false,
      cloudUpload: false,
      retentionDays: 14,
      backups: [],
    });
    post.mockResolvedValue({ filename: 'bikeger-2026-09-20T20-44-00.json.gz', cloudUpload: false });
  });

  it('gera backup e exige RESTAURAR para restaurar arquivo', async () => {
    const user = userEvent.setup();
    render(<BackupPanel />);

    expect(await screen.findByRole('button', { name: 'Gerar backup agora' })).toBeInTheDocument();
    expect(screen.getByText(/Mongo local/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurar arquivo' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Gerar backup agora' }));
    expect(post).toHaveBeenCalledWith('/backups', undefined, expect.objectContaining({ timeoutMs: 120_000 }));
    expect(await screen.findByText(/Backup bikeger-2026-09-20T20-44-00.json.gz gravado/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Digite RESTAURAR/), RESTORE_CONFIRM);
    expect(screen.getByRole('button', { name: 'Restaurar arquivo' })).toBeEnabled();
  });
});
