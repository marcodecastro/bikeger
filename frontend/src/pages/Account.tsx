import { useState, type FormEvent } from 'react';
import { post } from '../lib/api';
import { useAuth } from '../lib/auth';

export function Account() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirm) {
      setError('A confirmação não bate com a nova senha.');
      setSaved('');
      return;
    }
    setBusy(true);
    try {
      setError('');
      setSaved('');
      await post('/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      setSaved('Senha alterada. Use a nova da próxima vez que entrar.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao trocar a senha');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Minha senha</h2>
          <p>
            {user?.name} ({user?.login}). A senha demo não deve ficar no dia a dia da loja.
          </p>
        </div>
      </div>
      <article className="card" style={{ maxWidth: 420 }}>
        <form className="grid" onSubmit={(event) => void save(event)}>
          <label className="field">
            Senha atual
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label className="field">
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label className="field">
            Confirmar nova senha
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </label>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="muted" role="status">
              {saved}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Salvar senha
          </button>
        </form>
      </article>
    </section>
  );
}
