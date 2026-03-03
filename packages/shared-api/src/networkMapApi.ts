import { apiClient } from './client';

export const networkMapApi = {
  getThematicMaps: () => apiClient.get('/network-map/thematic-maps'),
  getThematicMap: (id: string) => apiClient.get(`/network-map/thematic-maps/${id}`),
  createThematicMap: (data: Record<string, unknown>) =>
    apiClient.post('/network-map/thematic-maps', data),
};
