import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { get } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ROLE_LABELS } from '../lib/permissions';
import { formatBRL } from '../lib/money';
import type { CashRegister, SearchResults } from '../types';
import { NoteMasterFooter } from './NoteMasterFooter';
import { StoreBrand } from './StoreBrand';

const links = [
  { to: '/', label: 'Painel', cap: 'dashboard' },
  { to: '/pdv', label: 'PDV', tag: 'balcão', cap: 'pos' },
  { to: '/oficina', label: 'Oficina', cap: 'workshop' },
  { to: '/agenda', label: 'Agenda', cap: 'agenda' },
  { to: '/vendas', label: 'Vendas', cap: 'sales' },
  { to: '/produtos', label: 'Produtos', cap: 'products.read' },
  { to: '/estoque', label: 'Estoque', cap: 'stock.read' },
  { to: '/compras', label: 'Compras', cap: 'stock.write' },
  { to: '/inventario', label: 'Inventário', cap: 'stock.write' },
  { to: '/clientes', label: 'Clientes', cap: 'customers.read' },
  { to: '/bikes', label: 'Bicicletas', cap: 'bikes' },
  { to: '/servicos', label: 'Serviços', cap: 'services.read' },
  { to: '/fornecedores', label: 'Fornecedores', cap: 'suppliers' },
  { to: '/caixa', label: 'Caixa', cap: 'cash' },
  { to: '/auditoria', label: 'Auditoria', cap: 'audit' },
  { to: '/relatorios', label: 'Relatório', cap: 'audit' },
  { to: '/equipe', label: 'Equipe', cap: 'users' },
  { to: '/ajustes', label: 'Ajustes', cap: 'settings' },
];

export function Layout() {
  const navigate = useNavigate();
  const { user, logout, can } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [register, setRegister] = useState<CashRegister | null>(null);
  const [storeName, setStoreName] = useState('BikeGer');
  const [storeLogo, setStoreLogo] = useState('');

  useEffect(() => {
    get<{ storeName?: string; storeLogo?: string }>('/auth/public-config')
      .then((config) => {
        const name = config.storeName?.trim() || 'BikeGer';
        setStoreName(name);
        setStoreLogo(config.storeLogo || '');
        document.title = name;
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!can('cash')) return;
    get<CashRegister | null>('/cash/current').then(setRegister).catch(() => undefined);
  }, [can]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const timer = window.setTimeout(() => {
      get<SearchResults>(`/search?q=${encodeURIComponent(query)}`)
        .then(setResults)
        .catch(() => undefined);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  function go(path: string) {
    setQuery('');
    setResults(null);
    navigate(path);
  }

  const visibleLinks = links.filter((link) => can(link.cap) || (link.cap === 'customers.read' && can('customers')));

  return (
    <div className="app">
      <aside className="sidebar">
        <StoreBrand name={storeName} logo={storeLogo} tagline="loja + oficina" />
        <nav className="nav">
          {visibleLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'}>
              {link.label}
              {link.tag ? <span className="tag">{link.tag}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <strong>{user?.name}</strong>
          <span className="muted">{user ? ROLE_LABELS[user.role] : ''}</span>
          {can('cash') ? (
            <span className="muted">
              {register ? `Caixa ${formatBRL(register.expectedCash)}` : 'Caixa fechado'}
            </span>
          ) : (
            <span className="muted">Oficina no turno</span>
          )}
          <button
            type="button"
            className="btn btn-ghost sidebar-exit"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div className="search">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar..."
              role="combobox"
              aria-expanded={Boolean(results)}
              aria-controls="global-search-results"
              aria-autocomplete="list"
            />
            {results ? (
              <div className="search-pop" id="global-search-results" role="listbox">
                <ResultGroup
                  title="Produtos"
                  items={results.products.map((item) => ({
                    key: item._id,
                    label: item.name,
                    extra: item.sku,
                    onClick: () => go(`/produtos/${item._id}`),
                  }))}
                />
                <ResultGroup
                  title="Clientes"
                  items={results.customers.map((item) => ({
                    key: item._id,
                    label: item.name,
                    extra: item.phone,
                    onClick: () => go(`/clientes/${item._id}`),
                  }))}
                />
                <ResultGroup
                  title="Oficina"
                  items={results.orders.map((item) => ({
                    key: item._id,
                    label: item.number,
                    extra: item.customer?.name,
                    onClick: () => go(`/oficina/${item._id}`),
                  }))}
                />
                {can('sales') ? (
                  <ResultGroup
                    title="Vendas"
                    items={results.sales.map((item) => ({
                      key: item._id,
                      label: item.number,
                      extra: item.customer?.name,
                      onClick: () => go(`/vendas/${item._id}`),
                    }))}
                  />
                ) : null}
                <ResultGroup
                  title="Bikes"
                  items={results.bikes.map((item) => ({
                    key: item._id,
                    label: `${item.brand} ${item.model}`,
                    extra: typeof item.customer === 'object' ? item.customer.name : '',
                    onClick: () => go(`/bikes/${item._id}`),
                  }))}
                />
              </div>
            ) : null}
          </div>
        </header>
        <Outlet />
        <NoteMasterFooter />
      </main>
    </div>
  );
}

interface ResultItem {
  key: string;
  label: string;
  extra?: string;
  onClick: () => void;
}

function ResultGroup({ title, items }: { title: string; items: ResultItem[] }) {
  if (!items.length) return null;
  return (
    <div className="search-group">
      <h4>{title}</h4>
      {items.map((item) => (
        <button type="button" key={item.key} className="search-item btn-ghost" onClick={item.onClick}>
          <span>{item.label}</span>
          <span className="muted">{item.extra}</span>
        </button>
      ))}
    </div>
  );
}
