import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { serviceOrdersApi, userFlowApi, topoNetworkApi, userControlApi } from '@fsa/shared-api';
import { Button, Modal } from '@fsa/shared-ui';
import { NetworkMap, MapProvider, MapLibreAdapter } from '@fsa/network-map';
import type { LayerConfig } from '@fsa/network-map';
import { useContract } from '../ContractProvider';
import { useAuth } from '../AuthProvider';
import { getActionCustomization } from '../config/flowActionCustomizations';
import '../config/despacharCustomization';
import {
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  MinusCircle,
  ClipboardList,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OccurrenceRef {
  id: number;
  protocolNumber: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface TargetRef {
  id: number;
  entityId: number;
  moduleName: string;
  entityType: string;
}

interface TaskAction {
  id: number;
  description: string | null;
  executedBy: string | null;
  executedAt: string | null;
  isApproved: boolean | null;
}

interface TaskRow {
  id: number;
  code: string;
  description: string | null;
  sortOrder: number;
  occurrenceId: number | null;
  occurrenceProtocol: string | null;
  targetId: number | null;
  isApproved: boolean | null;
  target: TargetRef | null;
  actions: TaskAction[];
}

interface OrderDetail {
  id: number;
  code: string;
  description: string | null;
  priority: string | null;
  categoryId: number | null;
  contractId: number | null;
  assignedTo: number | null;
  createdAt: string | null;
  occurrences: OccurrenceRef[];
  tasks: TaskRow[];
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

interface GeoPoint {
  id: number;
  basement: string;
  latitude: number;
  longitude: number;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ServiceOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedContract } = useContract();
  const { user } = useAuth();
  const adapterFactory = useMemo(() => () => new MapLibreAdapter(), []);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<FlowStatus[]>([]);
  const [actions, setActions] = useState<FlowAction[]>([]);
  const [currentStatusCode, setCurrentStatusCode] = useState<string | null>(null);
  const [geoPoints, setGeoPoints] = useState<GeoPoint[]>([]);
  const [memberMap, setMemberMap] = useState<Map<number, string>>(new Map());

  // Action modal state
  const [actionModal, setActionModal] = useState<{ action: FlowAction } | null>(null);
  const [executing, setExecuting] = useState(false);
  const [observation, setObservation] = useState('');
  const [extraData, setExtraData] = useState<Record<string, unknown>>({});

  // Load flow graph
  useEffect(() => {
    userFlowApi.getFlowByCode('Manutencao').then((res) => {
      setStatuses(res.data.statuses ?? []);
      setActions(res.data.actions ?? []);
    }).catch(() => {});
  }, []);

  // Load members for contract
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

  // Load order detail + current status
  const loadDetail = useCallback(() => {
    if (!id) return;
    setLoading(true);
    const detailP = serviceOrdersApi.getOrderDetail(Number(id));
    const statusP = userFlowApi.getCurrentRegister('Manutencao', 'service-orders', 'ServiceOrder', id);

    Promise.all([detailP, statusP])
      .then(([detailRes, statusRes]) => {
        setOrder(detailRes.data);
        setCurrentStatusCode(statusRes.data?.status?.code ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // Fetch GeographicPoints for targets
  useEffect(() => {
    if (!order) return;
    const gpEntityIds = order.tasks
      .filter((t) => t.target && t.target.entityType === 'GeographicPoint')
      .map((t) => t.target!.entityId);
    if (gpEntityIds.length === 0) { setGeoPoints([]); return; }

    Promise.all(gpEntityIds.map((eid) => topoNetworkApi.getGeographicPoint(eid).catch(() => null)))
      .then((results) => {
        const points: GeoPoint[] = [];
        for (const r of results) {
          if (r?.data) {
            const d = r.data;
            if (d.lat != null && d.lng != null) {
              points.push({ id: d.id, basement: d.basement ?? `P${d.id}`, latitude: d.lat, longitude: d.lng });
            }
          }
        }
        setGeoPoints(points);
      });
  }, [order]);

  // Editable statuses for IsApproved
  const isApprovedEditable = currentStatusCode === 'CONCLUIDA' || currentStatusCode === 'PENDENTE';

  // Available actions for current status
  const userRoleId = useMemo(() => {
    if (!user || !selectedContract) return null;
    const membership = user.memberships.find((m) => m.contractId === selectedContract.id);
    return membership?.roleId ?? null;
  }, [user, selectedContract]);

  const currentStatus = useMemo(
    () => statuses.find((s) => s.code === currentStatusCode) ?? null,
    [statuses, currentStatusCode],
  );

  const availableActions = useMemo(() => {
    if (!currentStatus || !userRoleId) return [];
    return actions.filter((a) => {
      if (a.statusFromId !== currentStatus.id) return false;
      return a.identities.some((ident) => {
        if (ident.entityType === 'Roles') return ident.entityId === String(userRoleId);
        if (ident.entityType === 'Users') return ident.entityId === String(user?.id);
        return false;
      });
    });
  }, [actions, currentStatus, userRoleId, user]);

  // Handle approval toggle
  const handleApproval = useCallback(async (taskId: number, value: boolean | null) => {
    await serviceOrdersApi.approveTask(taskId, value);
    setOrder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => t.id === taskId ? { ...t, isApproved: value } : t),
      };
    });
  }, []);

  // Execute flow action
  const handleExecuteAction = useCallback(async (obs?: string, extra?: Record<string, unknown>) => {
    if (!actionModal || !user || !order) return;
    const mergedExtra = extra ?? extraData;
    setExecuting(true);
    try {
      await userFlowApi.executeAction(
        actionModal.action.id,
        'service-orders',
        'ServiceOrder',
        String(order.id),
        user.name,
        obs ?? (observation || undefined),
      );
      const customization = getActionCustomization(actionModal.action.code);
      if (customization?.afterExecute) {
        await customization.afterExecute({ serviceOrderId: order.id, extraData: mergedExtra });
      }
      setActionModal(null);
      setObservation('');
      setExtraData({});
      loadDetail();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Erro ao executar acao.');
    } finally {
      setExecuting(false);
    }
  }, [actionModal, user, order, observation, extraData, loadDetail]);

  // ─── Map layers ─────────────────────────────────────────────────────────────

  // Build a map from target entityId -> occurrence protocol for labeling
  const targetOccProtocolMap = useMemo(() => {
    if (!order) return new Map<number, string>();
    const map = new Map<number, string>();
    for (const t of order.tasks) {
      if (t.target && t.occurrenceProtocol) {
        map.set(t.target.entityId, t.occurrenceProtocol);
      }
    }
    return map;
  }, [order]);

  const occurrenceGeoJson = useMemo(() => {
    if (!order) return { type: 'FeatureCollection' as const, features: [] as GeoJSON.Feature[] };
    const features = order.occurrences
      .filter((o) => o.latitude != null && o.longitude != null)
      .map((o) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [o.longitude!, o.latitude!] },
        properties: { id: o.id, protocolNumber: o.protocolNumber, address: o.address },
      }));
    return { type: 'FeatureCollection' as const, features };
  }, [order]);

  const targetGeoJson = useMemo(() => {
    const features = geoPoints.map((gp) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [gp.longitude, gp.latitude] },
      properties: {
        id: gp.id,
        basement: gp.basement,
        occurrenceProtocol: targetOccProtocolMap.get(gp.id) ?? '',
        label: `${gp.basement}${targetOccProtocolMap.get(gp.id) ? ' (' + targetOccProtocolMap.get(gp.id) + ')' : ''}`,
      },
    }));
    return { type: 'FeatureCollection' as const, features };
  }, [geoPoints, targetOccProtocolMap]);

  const mapLayers: LayerConfig[] = useMemo(() => {
    const layers: LayerConfig[] = [];

    // MT wires
    layers.push({
      code: 'mt-wires',
      name: 'Rede MT',
      geometryType: 'line',
      source: { type: 'mvt', url: '/api/network-map/spatial/mvt/mt-wires/{z}/{x}/{y}.mvt', sourceLayer: 'mt-wires' },
      style: { color: '#ef4444', width: 3, opacity: 0.9 },
      minZoom: 13,
      interactive: false,
      visibleByDefault: true,
      zOrder: 0,
    });

    // Geographic points (poles)
    layers.push({
      code: 'geographic-points',
      name: 'Postes',
      geometryType: 'point',
      source: { type: 'mvt', url: '/api/network-map/spatial/mvt/geographic-points/{z}/{x}/{y}.mvt' },
      style: { color: '#22c55e', iconSize: 6, outlineColor: '#fff', outlineWidth: 2, opacity: 0.95 },
      minZoom: 10,
      labelField: 'Basement',
      labelMinZoom: 15,
      cluster: { enabled: true, maxZoom: 13, radius: 60 },
      interactive: false,
      visibleByDefault: true,
      zOrder: 1,
    });

    // Occurrences (blue markers)
    if (occurrenceGeoJson.features.length > 0) {
      layers.push({
        code: 'so-occurrences',
        name: 'Ocorrencias',
        geometryType: 'point',
        source: { type: 'geojson-static' as const, data: occurrenceGeoJson },
        style: { color: '#2563eb', iconSize: 9, outlineColor: '#fff', outlineWidth: 2, opacity: 1 },
        interactive: true,
        visibleByDefault: true,
        zOrder: 5,
        labelField: 'protocolNumber',
        labelMinZoom: 14,
        popup: {
          trigger: 'click',
          title: 'Protocolo: {protocolNumber}',
          fields: [{ property: 'address', label: 'Endereco' }],
        },
      });
    }

    // Target GeographicPoints (orange markers with labels)
    if (targetGeoJson.features.length > 0) {
      layers.push({
        code: 'so-targets',
        name: 'Alvos (Postes)',
        geometryType: 'point',
        source: { type: 'geojson-static' as const, data: targetGeoJson },
        style: { color: '#f59e0b', iconSize: 10, outlineColor: '#fff', outlineWidth: 2, opacity: 1 },
        interactive: true,
        visibleByDefault: true,
        zOrder: 6,
        labelField: 'label',
        labelMinZoom: 10,
        popup: {
          trigger: 'click',
          title: 'Poste: {basement}',
          fields: [{ property: 'occurrenceProtocol', label: 'Ocorrencia' }],
        },
      });
    }

    return layers;
  }, [occurrenceGeoJson, targetGeoJson]);

  // Map center: fit to occurrences + targets
  const mapCenter = useMemo(() => {
    const allCoords: [number, number][] = [];
    if (order) {
      for (const o of order.occurrences) {
        if (o.latitude != null && o.longitude != null) allCoords.push([o.longitude, o.latitude]);
      }
    }
    for (const gp of geoPoints) {
      allCoords.push([gp.longitude, gp.latitude]);
    }
    if (allCoords.length > 0) {
      const avgLng = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length;
      const avgLat = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length;
      return [avgLng, avgLat] as [number, number];
    }
    if (selectedContract?.bounds) {
      return [selectedContract.bounds.centerLongitude, selectedContract.bounds.centerLatitude] as [number, number];
    }
    return [-38.5, -12.97] as [number, number];
  }, [order, geoPoints, selectedContract]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center text-gray-500 py-12">
        Ordem de servico nao encontrada.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <ClipboardList size={20} className="text-primary-600" />
        <h1 className="text-lg font-semibold text-gray-800">
          OS {order.code}
        </h1>
        {currentStatusCode && (
          <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-medium text-blue-700">
            {currentStatus?.description ?? currentStatusCode}
          </span>
        )}
        {order.assignedTo && memberMap.get(order.assignedTo) && (
          <span className="text-sm text-gray-500">
            Responsavel: <span className="font-medium text-gray-700">{memberMap.get(order.assignedTo)}</span>
          </span>
        )}

        {/* Action buttons */}
        <div className="ml-auto flex gap-2">
          {availableActions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant={action.code === 'Cancelar' ? 'danger' : 'primary'}
              onClick={() => { setActionModal({ action }); setObservation(''); }}
            >
              <Play size={14} /> {action.description}
            </Button>
          ))}
        </div>
      </div>

      {/* Order info */}
      <div className="mb-3 grid grid-cols-4 gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
        <div><span className="text-xs text-gray-500">Descricao</span><p className="text-gray-700">{order.description || '—'}</p></div>
        <div><span className="text-xs text-gray-500">Prioridade</span><p className="text-gray-700">{order.priority || '—'}</p></div>
        <div><span className="text-xs text-gray-500">Criado em</span><p className="text-gray-700">{order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : '—'}</p></div>
        <div>
          <span className="text-xs text-gray-500">Ocorrencias</span>
          <div className="flex flex-wrap gap-1">
            {order.occurrences.map((o) => (
              <span key={o.id} className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                {o.protocolNumber}
              </span>
            ))}
            {order.occurrences.length === 0 && <p className="text-gray-400">—</p>}
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 gap-3 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left: tasks */}
        <div className="flex w-1/2 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
            <h2 className="text-sm font-semibold text-gray-700">Tarefas ({order.tasks.length})</h2>
          </div>
          <div className="flex-1 overflow-auto">
            {order.tasks.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">Nenhuma tarefa cadastrada.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {order.tasks.map((task) => (
                  <div key={task.id} className="px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{task.code}</span>
                          {task.occurrenceProtocol && (
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
                              {task.occurrenceProtocol}
                            </span>
                          )}
                          {task.target && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-600">
                              Alvo: {task.target.entityType} #{task.target.entityId}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="mt-0.5 text-xs text-gray-500">{task.description}</p>
                        )}
                      </div>

                      {/* Approval control */}
                      <div className="ml-3 flex items-center gap-1.5">
                        {isApprovedEditable ? (
                          <ApprovalToggle
                            value={task.isApproved}
                            onChange={(val) => handleApproval(task.id, val)}
                          />
                        ) : (
                          <ApprovalBadge value={task.isApproved} />
                        )}
                      </div>
                    </div>

                    {/* Task actions */}
                    {task.actions.length > 0 && (
                      <div className="mt-2 space-y-1 border-l-2 border-gray-200 pl-3">
                        {task.actions.map((a) => (
                          <div key={a.id} className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="font-medium text-gray-600">{a.executedBy}</span>
                            <span>{a.description}</span>
                            {a.executedAt && (
                              <span className="text-gray-400">
                                {new Date(a.executedAt).toLocaleString('pt-BR')}
                              </span>
                            )}
                            {a.isApproved != null && (
                              <ApprovalBadge value={a.isApproved} size="xs" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: map */}
        <div className="relative w-1/2 overflow-hidden rounded-lg border border-gray-200">
          <MapProvider adapterFactory={adapterFactory}>
            <NetworkMap
              center={mapCenter}
              zoom={15}
              layers={mapLayers}
              showLayerPanel={false}
              showBaseLayerSwitcher={false}
              showCoordinates={false}
              showScale={false}
              className="h-full w-full"
            />
          </MapProvider>
        </div>
      </div>

      {/* Action modal */}
      {actionModal && (() => {
        const customization = getActionCustomization(actionModal.action.code);
        const closeModal = () => { setActionModal(null); setObservation(''); setExtraData({}); };

        return (
          <Modal
            open
            onClose={closeModal}
            title={`${actionModal.action.description} — OS ${order.code}`}
            className="max-w-md"
          >
            {customization?.renderModal ? (
              customization.renderModal({
                serviceOrderId: order.id,
                serviceOrderCode: order.code,
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
                  Deseja executar a acao <strong>{actionModal.action.description}</strong> na
                  ordem de servico <strong>{order.code}</strong>?
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Observacao (opcional)
                  </label>
                  <textarea
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Adicione uma observacao..."
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
    </div>
  );
}

// ─── Approval Components ──────────────────────────────────────────────────────

function ApprovalToggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (val: boolean | null) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-0.5">
      <button
        title="Aprovar"
        onClick={() => onChange(value === true ? null : true)}
        className={`rounded p-1 transition-colors ${value === true ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-green-500'}`}
      >
        <CheckCircle size={16} />
      </button>
      <button
        title="Reprovar"
        onClick={() => onChange(value === false ? null : false)}
        className={`rounded p-1 transition-colors ${value === false ? 'bg-red-100 text-red-600' : 'text-gray-400 hover:text-red-500'}`}
      >
        <XCircle size={16} />
      </button>
    </div>
  );
}

function ApprovalBadge({ value, size = 'sm' }: { value: boolean | null; size?: 'xs' | 'sm' }) {
  const iconSize = size === 'xs' ? 12 : 14;
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle size={iconSize} /> Aprovado
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
        <XCircle size={iconSize} /> Reprovado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
      <MinusCircle size={iconSize} /> Pendente
    </span>
  );
}
