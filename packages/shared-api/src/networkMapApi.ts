import { apiClient } from './client';

export const networkMapApi = {
  // Thematic maps
  getThematicMaps: () => apiClient.get('/network-map/thematic-maps'),
  getThematicMap: (id: string) => apiClient.get(`/network-map/thematic-maps/${id}`),
  createThematicMap: (data: Record<string, unknown>) =>
    apiClient.post('/network-map/thematic-maps', data),

  // Base layers
  getBaseLayers: () => apiClient.get('/network-map/base-layers'),
  createBaseLayer: (data: Record<string, unknown>) =>
    apiClient.post('/network-map/base-layers', data),
  deleteBaseLayer: (id: string) => apiClient.delete(`/network-map/base-layers/${id}`),

  // Spatial queries
  getGeoJSON: (params: {
    layerCode?: string;
    layerId?: string;
    bbox?: string;
    zoom?: number;
    limit?: number;
    [key: string]: unknown;
  }) => apiClient.get('/network-map/spatial/geojson', { params }),

  getClusters: (layerCode: string, bbox?: string, zoom?: number) =>
    apiClient.get('/network-map/spatial/cluster', { params: { layerCode, bbox, zoom } }),

  getHeatmap: (layerCode: string, bbox: string, zoom?: number) =>
    apiClient.get('/network-map/spatial/heatmap', { params: { layerCode, bbox, zoom } }),

  getBuffer: (layerCode: string, featureId: string, radiusMeters: number) =>
    apiClient.get('/network-map/spatial/buffer', {
      params: { layerCode, featureId, radiusMeters },
    }),

  // MVT tile URL template (not a fetch call, used as URL template for map sources)
  getMvtUrlTemplate: (layerCode: string) =>
    `/api/network-map/spatial/mvt/${layerCode}/{z}/{x}/{y}.mvt`,

  // Layer data sources (admin)
  getLayerDataSources: () => apiClient.get('/network-map/layer-data-sources'),
  getLayerDataSource: (id: string) => apiClient.get(`/network-map/layer-data-sources/${id}`),
  createLayerDataSource: (data: Record<string, unknown>) =>
    apiClient.post('/network-map/layer-data-sources', data),
  updateLayerDataSource: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/network-map/layer-data-sources/${id}`, data),
  deleteLayerDataSource: (id: string) =>
    apiClient.delete(`/network-map/layer-data-sources/${id}`),
};
