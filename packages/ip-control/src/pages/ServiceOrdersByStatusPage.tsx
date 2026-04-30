import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { serviceOrdersApi, userFlowApi, userControlApi } from '@fsa/shared-api';
import { DataTable, Modal, Button } from '@fsa/shared-ui';
import { useContract } from '../ContractProvider';
import { useAuth } from '../AuthProvider';
import { ClipboardList, Play, AlertTriangle } from 'lucide-react';
import { getActionCustomization } from '../config/flowActionCustomizations';
// Register all action customizations (side-effect imports)
import '../config/despacharCustomization';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OccurrenceRef {
  id: number;
  protocolNumber: string;
  address: string | null;
}

interface ServiceOrderRow {
  id: number;
  code: string;
  description: string | null;
  priority: string | null;
  categoryId: number | null;
  contractId: number | null;
  assignedTo: number | null;
  createdAt: string | null;
  currentStatusId: number | null;
  currentStatusCode: string | null;
  currentStatusDescription: string | null;
  occurrences: OccurrenceRef[];
  [key: string]: unknown;
}

interface FlowAction {
  id: number;
  code: string;
  description: string;
  statusFromId: number;
  statusToId: number;
  identities: { id: number; entityId: string; entityType: string }[];
}

interface FlowStatus {
  id: number;
  code: string;
  description: string;
  isInitial: boolean;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ServiceOrdersByStatusPage() {
  const { statusCode } = useParams<{ statusCode: string }>();
  const { selectedContract } = useContract();
  const { user } = useAuth();

  const [allOrders, setAllOrders] = useState<ServiceOrderRow[]>([]);
  const [statuses, setStatuses] = useState<FlowStatus[]>([]);
  const [actions, setActions] = useState<FlowAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberMap, setMemberMap] = useState<Map<number, string>>(new Map());
  const [categoryMap, setCategoryMap] = useState<Map<number, string>>(new Map());

  // Action execution state
  const [actionModal, setActionModal] = useState<{
    order: ServiceOrderRow;
    action: FlowAction;
  } | null>(null);
  const [executing, setExecuting] = useState(false);
  const [observation, setObservation] = useState('');
  const [extraData, setExtraData] = useState<Record<string, unknown>>({});

  // Load flow graph
  useEffect(() => {
    userFlowApi.getFlowByCode('Manutencao').then((res) => {
      const data = res.data;
      setStatuses(data.statuses ?? []);
      setActions(data.actions ?? []);
    }).catch(() => {});
  }, []);

  // Load service orders + members + categories
  const loadOrders = useCallback(() => {
    if (!selectedContract) return;
    setLoading(true);
    serviceOrdersApi
      .getOrdersByContract(selectedContract.id)
      .then((res) => setAllOrders(res.data ?? []))
      .catch(() => setAllOrders([]))
      .finally(() => setLoading(false));
  }, [selectedContract]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!selectedContract) return;
    userControlApi.getMembershipsByContract(selectedContract.id).then((res) => {
      const map = new Map<number, string>();
      for (const m of res.data as { id: number; user?: { id: number; name: string } }[]) {
        if (m.user) map.set(m.user.id, m.user.name);
      }
      setMemberMap(map);
    }).catch(() => {});
  }, [selectedContract]);

  useEffect(() => {
    if (!selectedContract) return;
    const map = new Map<number, string>();
    for (const cat of selectedContract.categories ?? []) {
      map.set(cat.id, cat.description);
    }
    setCategoryMap(map);
  }, [selectedContract]);

  // Find current status object
  const currentStatus = useMemo(
    () => statuses.find((s) => s.code === statusCode) ?? null,
    [statuses, statusCode]
  );

  // Filter orders by status
  const filteredOrders = useMemo(
    () => allOrders.filter((o) => o.currentStatusCode === statusCode),
    [allOrders, statusCode]
  );

  // Get available actions FROM this status, filtered by user's role
  const userRoleId = useMemo(() => {
    if (!user || !selectedContract) return null;
    const membership = user.memberships.find((m) => m.contractId === selectedContract.id);
    return membership?.roleId ?? null;
  }, [user, selectedContract]);

  const availableActions = useMemo(() => {
    if (!currentStatus || !userRoleId) return [];
    return actions.filter((a) => {
      if (a.statusFromId !== currentStatus.id) return false;
      return a.identities.some((ident) => {
        if (ident.entityType === 'Roles') {
          return ident.entityId === String(userRoleId);
        }
        if (ident.entityType === 'Users') {
          return ident.entityId === String(user?.id);
        }
        return false;
      });
    });
  }, [actions, currentStatus, userRoleId, user]);

  // Execute an action on a service order (called by default modal or custom modal)
  const handleExecuteAction = useCallback(async (obs?: string, extra?: Record<string, unknown>) => {
    if (!actionModal || !user) return;
    const mergedExtra = extra ?? extraData;
    setExecuting(true);
    try {
      await userFlowApi.executeAction(
        actionModal.action.id,
        'service-orders',
        'ServiceOrder',
        String(actionModal.order.id),
        user.name,
        obs ?? (observation || undefined)
      );
      // Run afterExecute hook if the action has a customization
      const customization = getActionCustomization(actionModal.action.code);
      if (customization?.afterExecute) {
        await customization.afterExecute({
          serviceOrderId: actionModal.order.id,
          extraData: mergedExtra,
        });
      }
      setActionModal(null);
      setObservation('');
      setExtraData({});
      loadOrders();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Erro ao executar ação.');
    } finally {
      setExecuting(false);
    }
  }, [actionModal, user, observation, extraData, loadOrders]);

  // Build row actions (one button per available action)
  const rowActions = useMemo(() => {
    return availableActions.map((action) => ({
      icon: <Play size={14} />,
      label: action.description,
      onClick: (row: ServiceOrderRow) => {
        setActionModal({ order: row, action });
        setObservation('');
      },
      variant: action.code === 'Cancelar' ? 'danger' as const : 'info' as const,
    }));
  }, [availableActions]);

  const pageTitle = currentStatus?.description ?? statusCode ?? 'Ordens de Serviço';

  return (
    <>
      <DataTable<ServiceOrderRow>
        title={pageTitle}
        icon={<ClipboardList size={20} className="text-primary-600" />}
        onSearch={() => {}}
        columns={[
          { key: 'code', header: 'Código', sortable: true },
          {
            key: 'occurrences', header: 'Ocorrências', sortable: false,
            render: (row) => {
              const occs = row.occurrences ?? [];
              if (occs.length === 0) return <>—</>;
              return (
                <div className="flex flex-wrap gap-1">
                  {occs.map((o) => (
                    <span
                      key={o.id}
                      className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700"
                      title={o.address ?? undefined}
                    >
                      {o.protocolNumber}
                    </span>
                  ))}
                </div>
              );
            },
          },
          { key: 'description', header: 'Descrição', sortable: true },
          { key: 'priority', header: 'Prioridade', sortable: true,
            render: (row) => (
              <span className={`inline-flex items-center gap-1 ${row.priority === 'Alta' ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                {row.priority === 'Alta' && <AlertTriangle size={14} />}
                {row.priority ?? '—'}
              </span>
            ),
          },
          {
            key: 'categoryId', header: 'Categoria', sortable: true,
            render: (row) => <>{row.categoryId ? categoryMap.get(row.categoryId) ?? '—' : '—'}</>,
          },
          {
            key: 'assignedTo', header: 'Responsável', sortable: true,
            render: (row) => <>{row.assignedTo ? memberMap.get(row.assignedTo) ?? '—' : '—'}</>,
          },
          {
            key: 'createdAt', header: 'Criado em', sortable: true,
            render: (row) =>
              row.createdAt ? new Date(row.createdAt).toLocaleString('pt-BR') : '—',
          },
        ]}
        data={filteredOrders}
        loading={loading}
        pageSize={20}
        rowActions={rowActions}
      />

      {/* Action confirmation modal */}
      {actionModal && (() => {
        const customization = getActionCustomization(actionModal.action.code);
        const closeModal = () => { setActionModal(null); setObservation(''); setExtraData({}); };

        return (
          <Modal
            open
            onClose={closeModal}
            title={`${actionModal.action.description} — OS ${actionModal.order.code}`}
            className="max-w-md"
          >
            {customization?.renderModal ? (
              customization.renderModal({
                serviceOrderId: actionModal.order.id,
                serviceOrderCode: actionModal.order.code,
                actionDescription: actionModal.action.description,
                contractId: selectedContract!.id,
                onConfirm: (obs, extra) => handleExecuteAction(obs, extra),
                onCancel: closeModal,
                executing,
                extraData,
                setExtraData,
              })
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Deseja executar a ação <strong>{actionModal.action.description}</strong> na
                  ordem de serviço <strong>{actionModal.order.code}</strong>?
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Observação (opcional)
                  </label>
                  <textarea
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Adicione uma observação..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeModal} disabled={executing}>
                    Cancelar
                  </Button>
                  <Button onClick={() => handleExecuteAction()} disabled={executing}>
                    {executing ? 'Executando...' : 'Confirmar'}
                  </Button>
                </div>
              </div>
            )}
          </Modal>
        );
      })()}
    </>
  );
}
