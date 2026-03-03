import { apiClient } from './client';

export const serviceOrdersApi = {
  getOrders: (params?: Record<string, unknown>) =>
    apiClient.get('/service-orders', { params }),
  getOrder: (id: number) => apiClient.get(`/service-orders/${id}`),
  createOrder: (data: Record<string, unknown>) =>
    apiClient.post('/service-orders', data),
  getCategories: () => apiClient.get('/service-orders/catalog/categories'),
  getCategory: (id: number) => apiClient.get(`/service-orders/catalog/categories/${id}`),
};
