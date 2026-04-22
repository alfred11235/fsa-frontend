import { apiClient } from './client';

export interface PointRequest {
  lng: number;
  lat: number;
  geographicPointTypeId?: number | null;
  basement?: string | null;
  ownerId?: number | null;
  materialId?: number | null;
  heightId?: number | null;
  effortId?: number | null;
  municipalityId?: number | null;
  zone?: string | null;
  address?: string | null;
  neighborhood?: string | null;
}

export interface WireRequest {
  geographicPointStartId: number;
  geographicPointEndId: number;
  wireOfLine?: string | null;
  feederId?: number | null;
  transformerParentId?: number | null;
}

export interface GeographicPointType {
  id: number;
  code: string;
  description: string | null;
  isActive: boolean;
}

export const topoNetworkApi = {
  // Geographic Points
  getGeographicPoints: (params?: Record<string, unknown>) =>
    apiClient.get('/geographic-points', { params }),
  getGeographicPoint: (id: number) => apiClient.get(`/geographic-points/${id}`),
  getByMunicipality: (municipalityId: number) =>
    apiClient.get(`/geographic-points/by-municipality/${municipalityId}`),
  createGeographicPoint: (data: PointRequest) =>
    apiClient.post('/geographic-points', data),
  updateGeographicPoint: (id: number, data: Partial<PointRequest>) =>
    apiClient.put(`/geographic-points/${id}`, data),
  deleteGeographicPoint: (id: number) =>
    apiClient.delete(`/geographic-points/${id}`),

  // Geographic Point Types
  getGeographicPointTypes: () =>
    apiClient.get<GeographicPointType[]>('/geographic-point-types'),

  // Middle Tension Wires
  createMTWire: (data: WireRequest) =>
    apiClient.post('/wires/mt', data),
  updateMTWire: (id: number, data: Partial<WireRequest>) =>
    apiClient.put(`/wires/mt/${id}`, data),
  deleteMTWire: (id: number) =>
    apiClient.delete(`/wires/mt/${id}`),
  getMTWire: (id: number) =>
    apiClient.get(`/wires/mt/${id}`),

  // Low Tension Wires
  createLTWire: (data: WireRequest) =>
    apiClient.post('/wires/lt', data),
  updateLTWire: (id: number, data: Partial<WireRequest>) =>
    apiClient.put(`/wires/lt/${id}`, data),
  deleteLTWire: (id: number) =>
    apiClient.delete(`/wires/lt/${id}`),
  getLTWire: (id: number) =>
    apiClient.get(`/wires/lt/${id}`),

  // Editor History
  recordEditorAction: (data: {
    userId: number;
    actionType: string;
    entityType: string;
    entityId: number | null;
    beforeData: Record<string, unknown> | null;
    afterData: Record<string, unknown> | null;
    maxEntries?: number;
  }) => apiClient.post('/editor-history/record', data),

  undoEditorAction: (userId: number) =>
    apiClient.post('/editor-history/undo', null, { params: { userId } }),

  redoEditorAction: (userId: number) =>
    apiClient.post('/editor-history/redo', null, { params: { userId } }),

  updateEditorHistoryEntityId: (historyId: number, newEntityId: number) =>
    apiClient.patch(`/editor-history/${historyId}/entity-id`, null, { params: { newEntityId } }),

  getEditorHistoryStatus: (userId: number) =>
    apiClient.get<{ undoCount: number; redoCount: number }>('/editor-history/status', { params: { userId } }),

  getEditorHistory: (userId: number, limit?: number) =>
    apiClient.get('/editor-history', { params: { userId, limit: limit ?? 50 } }),

  // Geographic Point Pictures
  getPointPictures: (pointId: number) =>
    apiClient.get(`/geographic-point-pictures/by-point/${pointId}`),
  createPointPicture: (data: Record<string, unknown>) =>
    apiClient.post('/geographic-point-pictures', data),
  deletePointPicture: (id: number) =>
    apiClient.delete(`/geographic-point-pictures/${id}`),
};
