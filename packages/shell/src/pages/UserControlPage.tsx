import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  UsersPage,
  CompaniesPage,
  ContractsPage,
  MembershipsPage,
  CompanyTypesPage,
  CompanyGroupsPage,
  ConsortiumsPage,
  AccessControlPage,
} from '@fsa/user-control';

const tabs = [
  { to: 'users', label: 'Users' },
  { to: 'companies', label: 'Companies' },
  { to: 'contracts', label: 'Contracts' },
  { to: 'memberships', label: 'Memberships' },
  { to: 'company-types', label: 'Company Types' },
  { to: 'company-groups', label: 'Company Groups' },
  { to: 'consortiums', label: 'Consortiums' },
  { to: 'access-control', label: 'Access Control' },
];

export default function UserControlPage() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-px">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Routes>
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="memberships" element={<MembershipsPage />} />
        <Route path="company-types" element={<CompanyTypesPage />} />
        <Route path="company-groups" element={<CompanyGroupsPage />} />
        <Route path="consortiums" element={<ConsortiumsPage />} />
        <Route path="access-control" element={<AccessControlPage />} />
      </Routes>
    </div>
  );
}
