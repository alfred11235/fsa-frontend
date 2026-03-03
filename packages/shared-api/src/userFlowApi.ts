import { apiClient } from './client';

export const userFlowApi = {
  getFlows: () => apiClient.get('/user-flows'),
  startFlow: (flowCode: string, targetId: string) =>
    apiClient.post('/user-flows/start', { flowCode, targetId }),
  executeAction: (actionId: number, targetId: string) =>
    apiClient.post('/user-flows/execute-action', { actionId, targetId }),
  getCurrentRegister: (flowCode: string, targetId: string) =>
    apiClient.get('/user-flows/current', { params: { flowCode, targetId } }),
  getAvailableActions: (flowCode: string, targetId: string) =>
    apiClient.get('/user-flows/available-actions', { params: { flowCode, targetId } }),
  getHistory: (flowCode: string, targetId: string) =>
    apiClient.get('/user-flows/history', { params: { flowCode, targetId } }),
};
