import { apiClient } from './client';

export const userFlowApi = {
  getFlows: () => apiClient.get('/user-flows'),
  startFlow: (flowCode: string, targetModule: string, targetEntity: string, targetId: string, executedBy?: string) =>
    apiClient.post('/user-flows/start', { flowCode, targetModule, targetEntity, targetId, executedBy }),
  executeAction: (actionId: number, targetModule: string, targetEntity: string, targetId: string, executedBy?: string, observation?: string) =>
    apiClient.post('/user-flows/execute-action', { actionId: String(actionId), targetModule, targetEntity, targetId, executedBy, observation }),
  getCurrentRegister: (flowCode: string, targetModule: string, targetEntity: string, targetId: string) =>
    apiClient.get('/user-flows/current', { params: { flowCode, targetModule, targetEntity, targetId } }),
  getAvailableActions: (flowCode: string, targetModule: string, targetEntity: string, targetId: string) =>
    apiClient.get('/user-flows/available-actions', { params: { flowCode, targetModule, targetEntity, targetId } }),
  getHistory: (flowCode: string, targetModule: string, targetEntity: string, targetId: string) =>
    apiClient.get('/user-flows/history', { params: { flowCode, targetModule, targetEntity, targetId } }),
};
