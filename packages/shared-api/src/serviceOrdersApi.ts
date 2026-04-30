import { apiClient } from './client';

export const serviceOrdersApi = {
  getOrders: (params?: Record<string, unknown>) =>
    apiClient.get('/service-orders', { params }),
  getOrder: (id: number) => apiClient.get(`/service-orders/${id}`),
  getOrdersByContract: (contractId: number) =>
    apiClient.get(`/service-orders/by-contract/${contractId}`),
  createOrder: (data: Record<string, unknown>) =>
    apiClient.post('/service-orders', data),
  getCategories: () => apiClient.get('/service-orders/catalog/categories'),
  getCategory: (id: number) => apiClient.get(`/service-orders/catalog/categories/${id}`),

  // Occurrences
  getOccurrences: (params?: Record<string, unknown>) =>
    apiClient.get('/occurrences', { params }),
  getOccurrence: (id: number) => apiClient.get(`/occurrences/${id}`),
  getOccurrenceByProtocol: (protocolNumber: string) =>
    apiClient.get(`/occurrences/by-protocol/${protocolNumber}`),
  getOccurrencesByContract: (contractId: number) =>
    apiClient.get(`/occurrences/by-contract/${contractId}`),
  getOccurrencesByContractEnriched: (contractId: number) =>
    apiClient.get(`/occurrences/by-contract/${contractId}/enriched`),
  getOccurrencesByContractGeoJson: (contractId: number) =>
    apiClient.get(`/occurrences/by-contract/${contractId}/geojson`),
  createOccurrence: (data: Record<string, unknown>) =>
    apiClient.post('/occurrences', data),
  getUnassignedOccurrences: (contractId: number) =>
    apiClient.get(`/occurrences/by-contract/${contractId}/unassigned`),
  getUnassignedOccurrencesGeoJson: (contractId: number) =>
    apiClient.get(`/occurrences/by-contract/${contractId}/unassigned/geojson`),
  generateServiceOrders: (occurrenceIds: number[], contractId: number) =>
    apiClient.post('/occurrences/generate-service-orders', { occurrenceIds, contractId }),
  generateAndDispatch: (occurrenceIds: number[], contractId: number, assignedTo: number) =>
    apiClient.post('/occurrences/generate-and-dispatch', { occurrenceIds, contractId, assignedTo }),
};
