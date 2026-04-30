import { useEffect, useState } from 'react';
import { userControlApi, serviceOrdersApi } from '@fsa/shared-api';
import { Button } from '@fsa/shared-ui';
import { Send } from 'lucide-react';
import {
  registerActionCustomization,
  type ActionModalContext,
  type AfterExecuteContext,
} from './flowActionCustomizations';

// ─── Worker selector modal body ─────────────────────────────────────────────

function DespacharModal({ ctx }: { ctx: ActionModalContext }) {
  const [workers, setWorkers] = useState<{ userId: number; userName: string }[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [observation, setObservation] = useState('');

  useEffect(() => {
    setLoadingWorkers(true);
    userControlApi
      .getMembershipsByContract(ctx.contractId)
      .then((res) => {
        const memberships = res.data ?? [];
        const unique = new Map<number, string>();
        for (const m of memberships as { user?: { id: number; name: string }; role?: { code: string } }[]) {
          if (m.role?.code === 'FieldTechnician' && m.user?.id && m.user?.name) {
            unique.set(m.user.id, m.user.name);
          }
        }
        setWorkers(Array.from(unique.entries()).map(([userId, userName]) => ({ userId, userName })));
      })
      .catch(() => setWorkers([]))
      .finally(() => setLoadingWorkers(false));
  }, [ctx.contractId]);

  const handleConfirm = () => {
    if (!selectedWorkerId) return;
    ctx.onConfirm(observation || undefined, { assignedTo: selectedWorkerId });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Selecione o trabalhador para despachar a OS <strong>{ctx.serviceOrderCode}</strong>:
      </p>

      {loadingWorkers ? (
        <div className="flex justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
        </div>
      ) : workers.length === 0 ? (
        <p className="text-sm text-amber-600">Nenhum técnico de campo encontrado neste contrato.</p>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Trabalhador</label>
          <select
            value={selectedWorkerId ?? ''}
            onChange={(e) => setSelectedWorkerId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Selecione um trabalhador...</option>
            {workers.map((w) => (
              <option key={w.userId} value={w.userId}>{w.userName}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Observação (opcional)
        </label>
        <textarea
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Adicione uma observação..."
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={ctx.onCancel} disabled={ctx.executing}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={ctx.executing || !selectedWorkerId}>
          {ctx.executing ? (
            'Despachando...'
          ) : (
            <span className="inline-flex items-center gap-1">
              <Send size={14} /> Despachar
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Register the customization ─────────────────────────────────────────────

registerActionCustomization('Despachar', {
  renderModal: (ctx) => <DespacharModal ctx={ctx} />,

  afterExecute: async (ctx: AfterExecuteContext) => {
    const assignedTo = ctx.extraData.assignedTo as number | undefined;
    if (assignedTo) {
      await serviceOrdersApi.assignWorker(ctx.serviceOrderId, assignedTo);
    }
  },
});
