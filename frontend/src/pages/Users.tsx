import { useEffect, useState } from 'react';
import { get, patch, post } from '../lib/api';
import { ROLE_LABELS, type AuthUser, type Role } from '../lib/permissions';
import { Modal } from '../components/Modal';

export function Users() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('balcao');
  const [error, setError] = useState('');

  async function load() {
    setUsers(await get<AuthUser[]>('/users'));
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    try {
      setError('');
      await post('/users', { name, login, password, role });
      setOpen(false);
      setName('');
      setLogin('');
      setPassword('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar usuário');
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Equipe</h2>
          <p>Cada pessoa entra com um perfil. O mecânico não vê custo nem caixa.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          Novo usuário
        </button>
      </div>
      <article className="card table-wrap">
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
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={async () => {
                      await patch(`/users/${user.id}`, { active: !user.active });
                      await load();
                    }}
                  >
                    {user.active ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      {open ? (
        <Modal title="Novo usuário" onClose={() => setOpen(false)}>
          <div className="grid">
            <label className="field">
              Nome
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="field">
              Login
              <input value={login} onChange={(event) => setLogin(event.target.value)} />
            </label>
            <label className="field">
              Senha
              <input
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <p className="muted">Mínimo 8 caracteres. A senha de demo da loja continua valendo só no seed local.</p>
            <label className="field">
              Perfil
              <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                <option value="dono">Dono</option>
                <option value="balcao">Balcão</option>
                <option value="mecanico">Mecânico</option>
              </select>
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="button" className="btn btn-primary" onClick={() => void create()}>
              Salvar
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
