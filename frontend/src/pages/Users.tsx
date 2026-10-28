import { useEffect, useState } from 'react';
import { get, patch, post } from '../lib/api';
import { ROLE_LABELS, type AuthUser, type Role } from '../lib/permissions';
import { Modal } from '../components/Modal';

const emptyForm = {
  name: '',
  login: '',
  password: '',
  role: 'balcao' as Role,
};

export function Users() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  async function load() {
    try {
      setLoadError('');
      setUsers(await get<AuthUser[]>('/users'));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar a equipe');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function set<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  }

  function openEdit(user: AuthUser) {
    setEditing(user);
    setForm({
      name: user.name,
      login: user.login,
      password: '',
      role: user.role,
    });
    setError('');
    setOpen(true);
  }

  async function save() {
    try {
      setError('');
      if (!form.name.trim()) {
        setError('Informe o nome.');
        return;
      }
      if (!editing && !form.login.trim()) {
        setError('Informe o login.');
        return;
      }
      if (editing) {
        const payload: { name: string; role: Role; password?: string } = {
          name: form.name.trim(),
          role: form.role,
        };
        if (form.password) payload.password = form.password;
        await patch(`/users/${editing.id}`, payload);
      } else {
        await post('/users', {
          name: form.name.trim(),
          login: form.login.trim(),
          password: form.password,
          role: form.role,
        });
      }
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o usuário');
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Equipe</h2>
          <p>Cada pessoa entra com um perfil. O mecânico não vê custo nem caixa.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          Novo usuário
        </button>
      </div>
      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}
      <article className="card table-wrap">
        {users.length === 0 && !loadError ? (
          <p className="empty">Nenhum usuário cadastrado.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Perfil</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td className="money">{user.login}</td>
                  <td>
                    <span className="badge">{ROLE_LABELS[user.role]}</span>
                  </td>
                  <td>
                    <span className={user.active ? 'badge ok' : 'badge danger'}>
                      {user.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="row">
                      <button type="button" className="btn" onClick={() => openEdit(user)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={async () => {
                          try {
                            setLoadError('');
                            await patch(`/users/${user.id}`, { active: !user.active });
                            await load();
                          } catch (err) {
                            setLoadError(
                              err instanceof Error ? err.message : 'Falha ao alterar a situação',
                            );
                          }
                        }}
                      >
                        {user.active ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
      {open ? (
        <Modal title={editing ? 'Editar usuário' : 'Novo usuário'} onClose={() => setOpen(false)}>
          <div className="grid">
            <label className="field">
              Nome
              <input value={form.name} onChange={(event) => set('name', event.target.value)} />
            </label>
            <label className="field">
              Login
              <input
                value={form.login}
                onChange={(event) => set('login', event.target.value)}
                disabled={Boolean(editing)}
              />
            </label>
            <label className="field">
              {editing ? 'Nova senha (opcional)' : 'Senha'}
              <input
                type="password"
                minLength={8}
                value={form.password}
                onChange={(event) => set('password', event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <p className="muted">
              {editing
                ? 'Deixe em branco para manter a senha atual. Mínimo 8 caracteres se for trocar.'
                : 'Mínimo 8 caracteres. Na primeira entrada a pessoa troca essa senha.'}
            </p>
            <label className="field">
              Perfil
              <select value={form.role} onChange={(event) => set('role', event.target.value as Role)}>
                <option value="dono">Dono</option>
                <option value="balcao">Balcão</option>
                <option value="mecanico">Mecânico</option>
              </select>
            </label>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => void save()}>
              {editing ? 'Salvar alterações' : 'Cadastrar usuário'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
