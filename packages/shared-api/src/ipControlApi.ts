import { apiClient } from './client';

export const ipControlApi = {
  getLightingAsset: (id: number) =>
    apiClient.get(`/ip-control/lighting-assets/${id}`),
  getLightingAssetsByGeographicPoint: (geographicPointId: number) =>
    apiClient.get(`/ip-control/lighting-assets/by-geographic-point/${geographicPointId}`),
};
