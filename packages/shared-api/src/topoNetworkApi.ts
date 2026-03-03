import { apiClient } from './client';

export const topoNetworkApi = {
  getGeographicPoints: (params?: Record<string, unknown>) =>
    apiClient.get('/geographic-points', { params }),
  getGeographicPoint: (id: number) => apiClient.get(`/geographic-points/${id}`),
  getByMunicipality: (municipalityId: number) =>
    apiClient.get(`/geographic-points/by-municipality/${municipalityId}`),
};
