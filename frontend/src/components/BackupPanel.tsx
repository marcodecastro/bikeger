import { useEffect, useState } from 'react';
import { downloadFile, get, post, postBackupUpload, BACKUP_TIMEOUT_MS } from '../lib/api';
import { useBusy } from '../lib/useBusy';
import type { BackupFile, BackupStatus } from '../types';

export const RESTORE_CONFIRM = 'RESTAURAR';

const SOURCE_LABEL: Record<BackupStatus['source'], string> = {
  localhost: 'Mongo local (localhost)',
  cloud: 'Mongo na nuvem (Atlas)',
  mongo: 'Mongo conectado',
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupPanel() {
  const { busy, run } = useBusy();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setStatus(await get<BackupStatus>('/backups'));
  }

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Falha ao listar backups');
    });
  }, []);

  async function createBackup() {
    try {
      await run(async () => {
        setError('');
        setMessage('');
        const created = await post<{ filename: string; cloudUpload?: boolean; cloudError?: string }>(
          '/backups',
          undefined,
          { timeoutMs: BACKUP_TIMEOUT_MS },
        );
        await load();
        setMessage(
          created.cloudUpload
            ? `Backup ${created.filename} gravado e enviado à nuvem.`
            : `Backup ${created.filename} gravado. Baixe o arquivo e guarde fora do servidor.`,
        );
        if (created.cloudError) setError(created.cloudError);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no backup');
    }
  }

  async function download(item: BackupFile) {
    try {
      await run(async () => {
        setError('');
        await downloadFile(`/backups/${encodeURIComponent(item.name)}/file`, item.name);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao baixar o backup');
    }
  }

  async function restoreNamed(item: BackupFile) {
    try {
      await run(async () => {
        setError('');
        setMessage('');
        await post(`/backups/${encodeURIComponent(item.name)}/restore`, { confirm }, { timeoutMs: BACKUP_TIMEOUT_MS });
        setConfirm('');
        setMessage(`Restore de ${item.name} concluído. Recarregue o painel.`);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao restaurar');
    }
  }

  async function restoreUpload() {
    if (!file) {
      setError('Escolha o arquivo .json.gz do backup.');
      return;
    }
    try {
      await run(async () => {
        setError('');
        setMessage('');
        await postBackupUpload(file, confirm);
        setConfirm('');
        setFile(null);
        setMessage('Restore do arquivo concluído. Recarregue o painel.');
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao restaurar');
    }
  }

  const source = status ? SOURCE_LABEL[status.source] : 'banco conectado';

  return (
    <article className="card" style={{ marginBottom: 16 }}>
      <h3>Backup e restore</h3>
      <p className="muted">
        Gera um arquivo do {source}. No Render o disco some no deploy — baixe o .json.gz e guarde no
        Drive. Restore substitui os dados deste banco.
      </p>
      {status?.ephemeral ? (
        <p className="muted">Este servidor é produção: a pasta local é temporária. Sempre baixe o backup.</p>
      ) : null}
      {status?.cloudUpload ? (
        <p className="muted">Cópia automática na nuvem está configurada (BACKUP_CLOUD_PUT_URL).</p>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createBackup()}>
          Gerar backup agora
        </button>
      </div>

      {status?.backups.length ? (
        <table>
          <thead>
            <tr>
              <th>Arquivo</th>
              <th>Tamanho</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {status.backups.map((item) => (
              <tr key={item.name}>
                <td>
                  {item.name}
                  <div className="muted">{new Date(item.createdAt).toLocaleString('pt-BR')}</div>
                </td>
                <td>{formatBytes(item.size)}</td>
                <td>
                  {item.kind === 'archive' ? (
                    <button type="button" className="btn" disabled={busy} onClick={() => void download(item)}>
                      Baixar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || confirm !== RESTORE_CONFIRM}
                    onClick={() => void restoreNamed(item)}
                  >
                    Restaurar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Nenhum backup neste servidor ainda.</p>
      )}

      <label className="field" style={{ marginTop: 12 }}>
        Arquivo para restore (.json.gz)
        <input
          type="file"
          accept=".gz,.json,application/gzip,application/json"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
      </label>
      <label className="field">
        Digite {RESTORE_CONFIRM} para autorizar o restore
        <input value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" />
      </label>
      <button
        type="button"
        className="btn"
        disabled={busy || confirm !== RESTORE_CONFIRM}
        onClick={() => void restoreUpload()}
      >
        Restaurar arquivo
      </button>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="muted">{message}</p> : null}
    </article>
  );
}
