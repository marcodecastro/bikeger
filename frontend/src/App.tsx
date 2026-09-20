import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth, RequireRole } from './lib/auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Pos = lazy(() => import('./pages/Pos').then((m) => ({ default: m.Pos })));
const Workshop = lazy(() => import('./pages/Workshop').then((m) => ({ default: m.Workshop })));
const WorkOrderDetail = lazy(() =>
  import('./pages/WorkOrderDetail').then((m) => ({ default: m.WorkOrderDetail })),
);
const Agenda = lazy(() => import('./pages/Agenda').then((m) => ({ default: m.Agenda })));
const Sales = lazy(() => import('./pages/Sales').then((m) => ({ default: m.Sales })));
const SaleDetail = lazy(() => import('./pages/SaleDetail').then((m) => ({ default: m.SaleDetail })));
const Products = lazy(() => import('./pages/Products').then((m) => ({ default: m.Products })));
const ProductForm = lazy(() => import('./pages/ProductForm').then((m) => ({ default: m.ProductForm })));
const Stock = lazy(() => import('./pages/Stock').then((m) => ({ default: m.Stock })));
const Purchases = lazy(() => import('./pages/Purchases').then((m) => ({ default: m.Purchases })));
const Inventory = lazy(() => import('./pages/Inventory').then((m) => ({ default: m.Inventory })));
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const Customers = lazy(() => import('./pages/Customers').then((m) => ({ default: m.Customers })));
const CustomerDetail = lazy(() =>
  import('./pages/CustomerDetail').then((m) => ({ default: m.CustomerDetail })),
);
const Bikes = lazy(() => import('./pages/Bikes').then((m) => ({ default: m.Bikes })));
const BikeDetail = lazy(() => import('./pages/BikeDetail').then((m) => ({ default: m.BikeDetail })));
const Services = lazy(() => import('./pages/Services').then((m) => ({ default: m.Services })));
const Suppliers = lazy(() => import('./pages/Suppliers').then((m) => ({ default: m.Suppliers })));
const Cash = lazy(() => import('./pages/Cash').then((m) => ({ default: m.Cash })));
const Audit = lazy(() => import('./pages/Audit').then((m) => ({ default: m.Audit })));
const Users = lazy(() => import('./pages/Users').then((m) => ({ default: m.Users })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const PaymentReturn = lazy(() =>
  import('./pages/PaymentReturn').then((m) => ({ default: m.PaymentReturn })),
);

function PageFallback() {
  return <section className="page">Carregando...</section>;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/pdv"
                element={
                  <RequireRole roles={['dono', 'balcao']}>
                    <Pos />
                  </RequireRole>
                }
              />
              <Route path="/oficina" element={<Workshop />} />
              <Route path="/oficina/:id" element={<WorkOrderDetail />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route
                path="/vendas"
                element={
                  <RequireRole roles={['dono', 'balcao']}>
                    <Sales />
                  </RequireRole>
                }
              />
              <Route
                path="/vendas/:id"
                element={
                  <RequireRole roles={['dono', 'balcao']}>
                    <SaleDetail />
                  </RequireRole>
                }
              />
              <Route path="/produtos" element={<Products />} />
              <Route path="/produtos/:id" element={<ProductForm />} />
              <Route path="/estoque" element={<Stock />} />
              <Route
                path="/compras"
                element={
                  <RequireRole roles={['dono']}>
                    <Purchases />
                  </RequireRole>
                }
              />
              <Route
                path="/inventario"
                element={
                  <RequireRole roles={['dono']}>
                    <Inventory />
                  </RequireRole>
                }
              />
              <Route path="/clientes" element={<Customers />} />
              <Route path="/clientes/:id" element={<CustomerDetail />} />
              <Route path="/bikes" element={<Bikes />} />
              <Route path="/bikes/:id" element={<BikeDetail />} />
              <Route path="/servicos" element={<Services />} />
              <Route
                path="/fornecedores"
                element={
                  <RequireRole roles={['dono']}>
                    <Suppliers />
                  </RequireRole>
                }
              />
              <Route
                path="/caixa"
                element={
                  <RequireRole roles={['dono', 'balcao']}>
                    <Cash />
                  </RequireRole>
                }
              />
              <Route
                path="/auditoria"
                element={
                  <RequireRole roles={['dono']}>
                    <Audit />
                  </RequireRole>
                }
              />
              <Route
                path="/relatorios"
                element={
                  <RequireRole roles={['dono']}>
                    <Reports />
                  </RequireRole>
                }
              />
              <Route
                path="/equipe"
                element={
                  <RequireRole roles={['dono']}>
                    <Users />
                  </RequireRole>
                }
              />
              <Route
                path="/ajustes"
                element={
                  <RequireRole roles={['dono']}>
                    <SettingsPage />
                  </RequireRole>
                }
              />
              <Route path="/pagamentos/retorno" element={<PaymentReturn />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
