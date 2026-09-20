import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { get } from '../lib/api';
import { useAuth } from '../lib/auth';
import { homeFor, ROLE_BLURBS, ROLE_LABELS, type Role } from '../lib/permissions';
import { NoteMasterFooter } from '../components/NoteMasterFooter';
import { StoreBrand } from '../components/StoreBrand';

const PROFILES: { role: Role; login: string }[] = [
  { role: 'dono', login: 'dono' },
  { role: 'balcao', login: 'balcao' },
  { role: 'mecanico', login: 'mecanico' },
];

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [demoUsers, setDemoUsers] = useState(false);
  const [storeName, setStoreName] = useState('BikeGer');
  const [storeLogo, setStoreLogo] = useState('');

  useEffect(() => {
    get<{ demoUsers: boolean; storeName?: string; storeLogo?: string }>('/auth/public-config')
      .then((config) => {
        setDemoUsers(config.demoUsers);
        const name = config.storeName?.trim() || 'BikeGer';
        setStoreName(name);
        setStoreLogo(config.storeLogo || '');
        document.title = name;
      })
      .catch(() => undefined);
  }, []);

  if (user) return <Navigate to={from || homeFor(user.role)} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setError('');
      const signed = await login(loginName, password);
      navigate(from || homeFor(signed.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar');
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <StoreBrand name={storeName} logo={storeLogo} tagline="entre com o perfil do turno" />

        {demoUsers ? (
          <div className="login-roles">
            {PROFILES.map((profile) => (
              <button
                type="button"
                key={profile.role}
                className={`login-role ${loginName === profile.login ? 'active' : ''}`}
                onClick={() => setLoginName(profile.login)}
              >
                <strong>{ROLE_LABELS[profile.role]}</strong>
                <span>{ROLE_BLURBS[profile.role]}</span>
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={(event) => void submit(event)}>
          <label className="field">
            Login
            <input
              value={loginName}
              onChange={(event) => setLoginName(event.target.value)}
              autoComplete="username"
              autoFocus
            />
          </label>
          <label className="field">
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>
            Entrar
          </button>
        </form>
        {demoUsers ? (
          <p className="muted" style={{ marginTop: 16 }}>
            Ambiente de desenvolvimento: senha <span className="money">bikeger</span> para dono,
            balcao e mecanico. Em produção essas contas não são criadas.
          </p>
        ) : null}
      </div>
      <NoteMasterFooter />
    </div>
  );
}
