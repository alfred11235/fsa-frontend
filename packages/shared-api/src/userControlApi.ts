import { apiClient } from './client';

export const userControlApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  register: (data: Record<string, unknown>) =>
    apiClient.post('/auth/register', data),
  getUsers: (params?: Record<string, unknown>) =>
    apiClient.get('/users', { params }),
  getUser: (id: number) => apiClient.get(`/users/${id}`),
  getCompanies: (params?: Record<string, unknown>) =>
    apiClient.get('/companies', { params }),
  getRegions: () => apiClient.get('/regions'),
  getStates: (regionId?: number) =>
    apiClient.get('/states', { params: regionId ? { regionId } : {} }),
  getMunicipalities: (stateId?: number) =>
    apiClient.get('/municipalities', { params: stateId ? { stateId } : {} }),
  getRoles: () => apiClient.get('/roles'),
  getMemberships: (userId?: number) =>
    apiClient.get('/memberships', { params: userId ? { userId } : {} }),
  getContracts: (companyId?: number) =>
    apiClient.get('/contracts', { params: companyId ? { companyId } : {} }),
};
