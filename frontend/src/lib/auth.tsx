import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { get, post } from './api';
import { can, homeFor, type AuthUser, type Role } from './permissions';

const TOKEN_KEY = 'bikeger.token';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  login: (loginName: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  can: (capability: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => getToken());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function onUnauthorized() {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
    window.addEventListener('bikeger:unauthorized', onUnauthorized);
    return () => window.removeEventListener('bikeger:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }
    get<AuthUser>('/auth/me')
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      ready,
      async login(loginName, password) {
        const result = await post<{ token: string; user: AuthUser }>('/auth/login', {
          login: loginName,
          password,
        });
        localStorage.setItem(TOKEN_KEY, result.token);
        setToken(result.token);
        setUser(result.user);
        return result.user;
      },
      logout() {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      },
      can(capability) {
        return can(user?.role, capability, user?.capabilities);
      },
    }),
    [user, token, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro do AuthProvider');
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <section className="page">Entrando...</section>;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return children;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role !== 'dono' && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return children;
}
