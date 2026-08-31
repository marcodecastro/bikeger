import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth, RequireRole } from './lib/auth';
import { Layout } from './components/Layout';
import { BikeDetail } from './pages/BikeDetail';
import { Bikes } from './pages/Bikes';
import { Cash } from './pages/Cash';
import { CustomerDetail } from './pages/CustomerDetail';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Pos } from './pages/Pos';
import { ProductForm } from './pages/ProductForm';
import { Products } from './pages/Products';
import { SaleDetail } from './pages/SaleDetail';
import { Sales } from './pages/Sales';
import { Services } from './pages/Services';
import { SettingsPage } from './pages/SettingsPage';
import { Stock } from './pages/Stock';
import { Suppliers } from './pages/Suppliers';
import { Users } from './pages/Users';
import { WorkOrderDetail } from './pages/WorkOrderDetail';
import { Workshop } from './pages/Workshop';
import { Agenda } from './pages/Agenda';
import { PaymentReturn } from './pages/PaymentReturn';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  );
}
