import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import { useAuth } from './AuthProvider';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OpenMaintenanceRequestPage from './pages/OpenMaintenanceRequestPage';
import OccurrenceListPage from './pages/OccurrenceListPage';
import GenerateServiceOrderPage from './pages/GenerateServiceOrderPage';
import ServiceOrdersByStatusPage from './pages/ServiceOrdersByStatusPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="solicitacoes/manutencao/abrir" element={<OpenMaintenanceRequestPage />} />
        <Route path="solicitacoes/manutencao/lista" element={<OccurrenceListPage />} />
        <Route path="ordens-de-servico/manutencao/gerar" element={<GenerateServiceOrderPage />} />
        <Route path="ordens-de-servico/manutencao/status/:statusCode" element={<ServiceOrdersByStatusPage />} />
      </Route>
    </Routes>
  );
}
