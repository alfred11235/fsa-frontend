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

  // Roles CRUD
  createRole: (data: Record<string, unknown>) =>
    apiClient.post('/roles', data),
  updateRole: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/roles/${id}`, data),

  // Regions CRUD
  createRegion: (data: Record<string, unknown>) =>
    apiClient.post('/regions', data),
  updateRegion: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/regions/${id}`, data),

  // States CRUD
  createState: (data: Record<string, unknown>) =>
    apiClient.post('/states', data),
  updateState: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/states/${id}`, data),

  // Municipalities CRUD
  createMunicipality: (data: Record<string, unknown>) =>
    apiClient.post('/municipalities', data),
  updateMunicipality: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/municipalities/${id}`, data),

  // Policies
  getPolicies: (params?: Record<string, unknown>) =>
    apiClient.get('/policies', { params }),
  createPolicy: (data: Record<string, unknown>) =>
    apiClient.post('/policies', data),
  updatePolicy: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/policies/${id}`, data),

  // Policy Groups CRUD
  getPolicyGroupsPaged: (params?: Record<string, unknown>) =>
    apiClient.get('/policy-groups', { params }),
  createPolicyGroup: (data: Record<string, unknown>) =>
    apiClient.post('/policy-groups', data),
  updatePolicyGroup: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/policy-groups/${id}`, data),

  // System Modules CRUD
  createSystemModule: (data: Record<string, unknown>) =>
    apiClient.post('/system-modules', data),
  updateSystemModule: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/system-modules/${id}`, data),

  // Projections
  getProjections: (params?: Record<string, unknown>) =>
    apiClient.get('/projections', { params }),
  createProjection: (data: Record<string, unknown>) =>
    apiClient.post('/projections', data),
  updateProjection: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/projections/${id}`, data),

  // Municipality Data
  getMunicipalityData: (params?: Record<string, unknown>) =>
    apiClient.get('/municipality-data', { params }),
  createMunicipalityData: (data: Record<string, unknown>) =>
    apiClient.post('/municipality-data', data),
  updateMunicipalityData: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/municipality-data/${id}`, data),

  // Access Control
  getPolicyGroups: () => apiClient.get('/access-control/policy-groups'),
  getRolePolicies: (roleId: number) =>
    apiClient.get(`/access-control/role-policies/${roleId}`),
  updateRolePolicies: (roleId: number, policyIds: number[]) =>
    apiClient.put(`/access-control/role-policies/${roleId}`, policyIds),

  // Categories
  getCategories: (params?: Record<string, unknown>) =>
    apiClient.get('/categories', { params }),
  getCategory: (id: number) => apiClient.get(`/categories/${id}`),
  createCategory: (data: Record<string, unknown>) =>
    apiClient.post('/categories', data),
  updateCategory: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/categories/${id}`, data),
  getCategoriesBySystemModule: (systemModuleId: number) =>
    apiClient.get(`/categories/by-system-module/${systemModuleId}`),

  // User Flows
  getUserFlows: (params?: Record<string, unknown>) =>
    apiClient.get('/user-flows', { params }),
  getUserFlow: (id: number) => apiClient.get(`/user-flows/${id}`),
  createUserFlow: (data: Record<string, unknown>) =>
    apiClient.post('/user-flows', data),
  updateUserFlow: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/user-flows/${id}`, data),
  saveUserFlowGraph: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/user-flows/${id}/graph`, data),

  // Histories (Auditoria)
  getHistories: (params?: Record<string, unknown>) =>
    apiClient.get('/histories', { params }),
  getHistory: (id: number) => apiClient.get(`/histories/${id}`),
  getHistoriesByEntity: (entityType: string, entityId: number, params?: Record<string, unknown>) =>
    apiClient.get('/histories/by-entity', { params: { entityType, entityId, ...params } }),
  getHistoriesByUser: (userId: number, params?: Record<string, unknown>) =>
    apiClient.get(`/histories/by-user/${userId}`, { params }),

  // Dashboard
  getDashboardStats: () =>
    apiClient.get('/dashboard/stats'),
};
