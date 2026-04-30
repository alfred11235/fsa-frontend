import { useEffect, useState } from 'react';
import { userFlowApi } from '@fsa/shared-api';

interface FlowStatus {
  id: number;
  code: string;
  description: string;
  isInitial: boolean;
}

let cachedStatuses: FlowStatus[] | null = null;
let fetchPromise: Promise<FlowStatus[]> | null = null;

/**
 * Returns the list of statuses for the Manutencao flow.
 * Caches across components so only one request is made.
 */
export function useFlowStatuses(): FlowStatus[] {
  const [statuses, setStatuses] = useState<FlowStatus[]>(cachedStatuses ?? []);

  useEffect(() => {
    if (cachedStatuses) {
      setStatuses(cachedStatuses);
      return;
    }
    if (!fetchPromise) {
      fetchPromise = userFlowApi
        .getFlowByCode('Manutencao')
        .then((res) => {
          const list: FlowStatus[] = res.data?.statuses ?? [];
          cachedStatuses = list;
          return list;
        })
        .catch(() => {
          cachedStatuses = [];
          return [];
        });
    }
    fetchPromise.then((list) => setStatuses(list));
  }, []);

  return statuses;
}
