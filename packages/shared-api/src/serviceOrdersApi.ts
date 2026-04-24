import { apiClient } from './client';

export const serviceOrdersApi = {
  getOrders: (params?: Record<string, unknown>) =>
    apiClient.get('/service-orders', { params }),
  getOrder: (id: number) => apiClient.get(`/service-orders/${id}`),
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
  createOccurrence: (data: Record<string, unknown>) =>
    apiClient.post('/occurrences', data),
};
