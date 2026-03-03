import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import { useAuth } from './AuthProvider';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UserControlPage';
import ServiceOrdersPage from './pages/ServiceOrdersPage';
import NetworkPage from './pages/NetworkPage';
import MapPage from './pages/MapPage';

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
        <Route path="user-control/*" element={<UsersPage />} />
        <Route path="service-orders/*" element={<ServiceOrdersPage />} />
        <Route path="network/*" element={<NetworkPage />} />
        <Route path="map/*" element={<MapPage />} />
      </Route>
    </Routes>
  );
}
