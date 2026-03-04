import { apiClient } from './client';

export const userControlApi = {
  // Auth
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  register: (data: Record<string, unknown>) =>
    apiClient.post('/auth/register', data),

  // Users
  getUsers: (params?: Record<string, unknown>) =>
    apiClient.get('/users', { params }),
  getUser: (id: number) => apiClient.get(`/users/${id}`),
  createUser: (data: Record<string, unknown>) =>
    apiClient.post('/users', data),
  updateUser: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/users/${id}`, data),

  // Companies
  getCompanies: (params?: Record<string, unknown>) =>
    apiClient.get('/companies', { params }),
  getCompany: (id: number) => apiClient.get(`/companies/${id}`),
  createCompany: (data: Record<string, unknown>) =>
    apiClient.post('/companies', data),
  updateCompany: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/companies/${id}`, data),

  // Company Types
  getCompanyTypes: (params?: Record<string, unknown>) =>
    apiClient.get('/company-types', { params }),
  createCompanyType: (data: Record<string, unknown>) =>
    apiClient.post('/company-types', data),
  updateCompanyType: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/company-types/${id}`, data),

  // Company Groups
  getCompanyGroups: (params?: Record<string, unknown>) =>
    apiClient.get('/company-groups', { params }),
  createCompanyGroup: (data: Record<string, unknown>) =>
    apiClient.post('/company-groups', data),
  updateCompanyGroup: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/company-groups/${id}`, data),

  // Consortiums
  getConsortiums: (params?: Record<string, unknown>) =>
    apiClient.get('/consortiums', { params }),
  createConsortium: (data: Record<string, unknown>) =>
    apiClient.post('/consortiums', data),
  updateConsortium: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/consortiums/${id}`, data),

  // Contracts
  getContracts: (params?: Record<string, unknown>) =>
    apiClient.get('/contracts', { params }),
  getContract: (id: number) => apiClient.get(`/contracts/${id}`),
  createContract: (data: Record<string, unknown>) =>
    apiClient.post('/contracts', data),
  updateContract: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/contracts/${id}`, data),

  // Memberships
  getMemberships: (params?: Record<string, unknown>) =>
    apiClient.get('/memberships', { params }),
  createMembership: (data: Record<string, unknown>) =>
    apiClient.post('/memberships', data),
  updateMembership: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/memberships/${id}`, data),

  // Roles
  getRoles: (params?: Record<string, unknown>) =>
    apiClient.get('/roles', { params }),

  // Regions & States & Municipalities
  getRegions: () => apiClient.get('/regions'),
  getStates: (params?: Record<string, unknown>) =>
    apiClient.get('/states', { params }),
  getMunicipalities: (params?: Record<string, unknown>) =>
    apiClient.get('/municipalities', { params }),
  getMunicipalitiesByState: (stateId: number) =>
    apiClient.get(`/municipalities/by-state/${stateId}`),

  // System Modules
  getSystemModules: (params?: Record<string, unknown>) =>
    apiClient.get('/system-modules', { params }),

  // Access Control
  getPolicyGroups: () => apiClient.get('/access-control/policy-groups'),
  getRolePolicies: (roleId: number) =>
    apiClient.get(`/access-control/role-policies/${roleId}`),
  updateRolePolicies: (roleId: number, policyIds: number[]) =>
    apiClient.put(`/access-control/role-policies/${roleId}`, policyIds),
};
