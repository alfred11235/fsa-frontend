import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import { useAuth } from './AuthProvider';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ServiceOrdersPage from './pages/ServiceOrdersPage';
import NetworkPage from './pages/NetworkPage';
import MapPage from './pages/MapPage';
import {
  CompaniesPage,
  CompanyGroupsPage,
  CompanyTypesPage,
  ConsortiumsPage,
  ContractsPage,
  UsersPage,
  MembershipsPage,
  RolesPage,
  PoliciesPage,
  PolicyGroupsPage,
  AccessControlPage,
  StatesPage,
  RegionsPage,
  MunicipalitiesPage,
  ProjectionsPage,
  SystemModulesPage,
  HistoriesPage,
} from '@fsa/user-control';

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

        {/* Empresas */}
        <Route path="empresas" element={<CompaniesPage />} />
        <Route path="grupos-de-empresas" element={<CompanyGroupsPage />} />
        <Route path="tipos-de-empresas" element={<CompanyTypesPage />} />
        <Route path="consorcios" element={<ConsortiumsPage />} />

        {/* Contratos */}
        <Route path="contratos" element={<ContractsPage />} />

        {/* Gestão de Usuários */}
        <Route path="usuarios" element={<UsersPage />} />
        <Route path="grupos-de-usuarios" element={<RolesPage />} />
        <Route path="filiacoes" element={<MembershipsPage />} />

        {/* Segurança */}
        <Route path="politicas" element={<PoliciesPage />} />
        <Route path="grupos-de-politicas" element={<PolicyGroupsPage />} />
        <Route path="controle-de-acesso" element={<AccessControlPage />} />

        {/* Estados */}
        <Route path="estados" element={<StatesPage />} />
        <Route path="regioes" element={<RegionsPage />} />
        <Route path="municipios" element={<MunicipalitiesPage />} />
        <Route path="projecoes" element={<ProjectionsPage />} />

        {/* Módulos de Sistema */}
        <Route path="modulos-de-sistema" element={<SystemModulesPage />} />

        {/* Auditoria */}
        <Route path="auditoria" element={<HistoriesPage />} />

        {/* Other modules */}
        <Route path="service-orders/*" element={<ServiceOrdersPage />} />
        <Route path="network/*" element={<NetworkPage />} />
        <Route path="map/*" element={<MapPage />} />
      </Route>
    </Routes>
  );
}
