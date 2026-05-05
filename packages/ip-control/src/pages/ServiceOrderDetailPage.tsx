import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { serviceOrdersApi, userFlowApi, topoNetworkApi, userControlApi, ipControlApi } from '@fsa/shared-api';
import { Button, Modal, DataTable } from '@fsa/shared-ui';
import { NetworkMap, MapProvider, MapLibreAdapter, useMap } from '@fsa/network-map';
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
  Eye,
  Camera,
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
  componentModule: string | null;
  componentEntity: string | null;
  componentId: number | null;
  [key: string]: unknown;
}

interface TaskPicture {
  id: number;
  url: string;
  description: string | null;
  pictureTypeCode: string | null;
  pictureTypeDescription: string | null;
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
  pictures: TaskPicture[];
  createdAt: string | null;
  updatedAt: string | null;
  [key: string]: unknown;
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
  address: string | null;
  neighborhood: string | null;
  zone: string | null;
  latitude: number;
  longitude: number;
}

interface LightingAssetData {
  id: number;
  plateCode: string | null;
  registryCode: number | null;
  lampType: { type: string } | null;
  lampPower: { value: number } | null;
  luminaryType: { type: string } | null;
  luminarySupportArmType: { armType: string } | null;
  manufacturer: { name: string } | null;
  manufacturerModel: { model: string } | null;
  socketType: { type: string } | null;
  reactorType: { type: string } | null;
  reactorLocation: { location: string } | null;
  relayType: { type: string } | null;
  relayActivation: { activation: string } | null;
  relayModel: { model: string } | null;
  localType: { type: string } | null;
  illuminatedObjectType: { type: string } | null;
  installationHeight: number | null;
  operatingFor12h: boolean;
  operatingFor24h: boolean;
  measured: boolean;
  brokenOrMissing: boolean;
  installationDate: string | null;
  [key: string]: unknown;
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
  const [flowActions, setFlowActions] = useState<FlowAction[]>([]);
  const [currentStatusCode, setCurrentStatusCode] = useState<string | null>(null);
  const [geoPoints, setGeoPoints] = useState<GeoPoint[]>([]);
  const [memberMap, setMemberMap] = useState<Map<number, string>>(new Map());

  // Flow action modal state
  const [actionModal, setActionModal] = useState<{ action: FlowAction } | null>(null);
  const [executing, setExecuting] = useState(false);
  const [observation, setObservation] = useState('');
  const [extraData, setExtraData] = useState<Record<string, unknown>>({});

  // Task detail popup
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);
  const [lightingAssets, setLightingAssets] = useState<Map<number, LightingAssetData>>(new Map());
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Tasks DataTable pagination
  const [taskPage, setTaskPage] = useState(0);
  const [taskPageSize, setTaskPageSize] = useState(20);

  // Actions DataTable pagination (in popup)
  const [actPage, setActPage] = useState(0);
  const [actPageSize, setActPageSize] = useState(10);

  // ─── Data loading ─────────────────────────────────────────────────────────

  useEffect(() => {
    userFlowApi.getFlowByCode('Manutencao').then((res) => {
      setStatuses(res.data.statuses ?? []);
      setFlowActions(res.data.actions ?? []);
    }).catch(() => {});
  }, []);

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

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const detailRes = await serviceOrdersApi.getOrderDetail(Number(id));
      setOrder(detailRes.data);
    } catch { /* ignore */ }
    try {
      const statusRes = await userFlowApi.getCurrentRegister('Manutencao', 'service-orders', 'ServiceOrder', id);
      setCurrentStatusCode(statusRes.data?.status?.code ?? null);
    } catch { /* ignore */ }
    setLoading(false);
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
              points.push({ id: d.id, basement: d.basement ?? `P${d.id}`, address: d.address ?? null, neighborhood: d.neighborhood ?? null, zone: d.zone ?? null, latitude: d.lat, longitude: d.lng });
            }
          }
        }
        setGeoPoints(points);
      });
  }, [order]);

  // Fetch LightingAssets when task detail popup opens
  useEffect(() => {
    if (!detailTask) return;
    const componentIds = detailTask.actions
      .filter((a) => a.componentModule === 'ip-control' && a.componentEntity === 'LightingAsset' && a.componentId != null)
      .map((a) => a.componentId!);
    const uniqueIds = [...new Set(componentIds)].filter((cid) => !lightingAssets.has(cid));
    if (uniqueIds.length === 0) return;

    setLoadingAssets(true);
    Promise.all(uniqueIds.map((cid) => ipControlApi.getLightingAsset(cid).catch(() => null)))
      .then((results) => {
        setLightingAssets((prev) => {
          const next = new Map(prev);
          for (const r of results) {
            if (r?.data) next.set(r.data.id, r.data);
          }
          return next;
        });
      })
      .finally(() => setLoadingAssets(false));
  }, [detailTask, lightingAssets]);

  // ─── Computed ─────────────────────────────────────────────────────────────

  const isApprovedEditable = currentStatusCode === 'CONCLUIDA' || currentStatusCode === 'PENDENTE';

  // Map target entityId → GeoPoint for quick lookup in task columns
  const geoPointByEntityId = useMemo(() => {
    const map = new Map<number, GeoPoint>();
    for (const gp of geoPoints) map.set(gp.id, gp);
    return map;
  }, [geoPoints]);

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
    return flowActions.filter((a) => {
      if (a.statusFromId !== currentStatus.id) return false;
      return a.identities.some((ident) => {
        if (ident.entityType === 'Roles') return ident.entityId === String(userRoleId);
        if (ident.entityType === 'Users') return ident.entityId === String(user?.id);
        return false;
      });
    });
  }, [flowActions, currentStatus, userRoleId, user]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleTaskApproval = useCallback(async (taskId: number, value: boolean | null) => {
    try {
      await serviceOrdersApi.approveTask(taskId, value);
      // Update local state: task + all its actions get the same value
      setOrder((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId
              ? { ...t, isApproved: value, actions: t.actions.map((a) => ({ ...a, isApproved: value })) }
              : t,
          ),
        };
      });
      setDetailTask((prev) => {
        if (!prev || prev.id !== taskId) return prev;
        return { ...prev, isApproved: value, actions: prev.actions.map((a) => ({ ...a, isApproved: value })) };
      });
    } catch {
      alert('Erro ao atualizar aprovacao da tarefa.');
    }
  }, []);

  const handleActionApproval = useCallback(async (actionId: number, value: boolean | null) => {
    try {
      const res = await serviceOrdersApi.approveTaskAction(actionId, value);
      const { taskIsApproved } = res.data;
      setOrder((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) => {
            const hasAction = t.actions.some((a) => a.id === actionId);
            if (!hasAction) return t;
            return {
              ...t,
              isApproved: taskIsApproved,
              actions: t.actions.map((a) => a.id === actionId ? { ...a, isApproved: value } : a),
            };
          }),
        };
      });
      setDetailTask((prev) => {
        if (!prev) return prev;
        const hasAction = prev.actions.some((a) => a.id === actionId);
        if (!hasAction) return prev;
        return {
          ...prev,
          isApproved: taskIsApproved,
          actions: prev.actions.map((a) => a.id === actionId ? { ...a, isApproved: value } : a),
        };
      });
    } catch {
      alert('Erro ao atualizar aprovacao.');
    }
  }, []);

  const handleExecuteAction = useCallback(async (obs?: string, extra?: Record<string, unknown>) => {
    if (!actionModal || !user || !order) return;
    const mergedExtra = extra ?? extraData;
    setExecuting(true);
    try {
      await userFlowApi.executeAction(
        actionModal.action.id, 'service-orders', 'ServiceOrder',
        String(order.id), user.name, obs ?? (observation || undefined),
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

  const targetOccProtocolMap = useMemo(() => {
    if (!order) return new Map<number, string>();
    const map = new Map<number, string>();
    for (const t of order.tasks) {
      if (t.target && t.occurrenceProtocol) map.set(t.target.entityId, t.occurrenceProtocol);
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
        id: gp.id, basement: gp.basement,
        occurrenceProtocol: targetOccProtocolMap.get(gp.id) ?? '',
        label: `${gp.basement}${targetOccProtocolMap.get(gp.id) ? ' (' + targetOccProtocolMap.get(gp.id) + ')' : ''}`,
      },
    }));
    return { type: 'FeatureCollection' as const, features };
  }, [geoPoints, targetOccProtocolMap]);

  const mapLayers: LayerConfig[] = useMemo(() => {
    const layers: LayerConfig[] = [];
    layers.push({ code: 'mt-wires', name: 'Rede MT', geometryType: 'line', source: { type: 'mvt', url: '/api/network-map/spatial/mvt/mt-wires/{z}/{x}/{y}.mvt', sourceLayer: 'mt-wires' }, style: { color: '#ef4444', width: 3, opacity: 0.9 }, minZoom: 13, interactive: false, visibleByDefault: true, zOrder: 0 });
    layers.push({ code: 'geographic-points', name: 'Postes', geometryType: 'point', source: { type: 'mvt', url: '/api/network-map/spatial/mvt/geographic-points/{z}/{x}/{y}.mvt' }, style: { color: '#22c55e', iconSize: 6, outlineColor: '#fff', outlineWidth: 2, opacity: 0.95 }, minZoom: 10, labelField: 'Basement', labelMinZoom: 15, cluster: { enabled: true, maxZoom: 13, radius: 60 }, interactive: false, visibleByDefault: true, zOrder: 1 });
    if (occurrenceGeoJson.features.length > 0) {
      layers.push({ code: 'so-occurrences', name: 'Ocorrencias', geometryType: 'point', source: { type: 'geojson-static' as const, data: occurrenceGeoJson }, style: { color: '#2563eb', iconSize: 9, outlineColor: '#fff', outlineWidth: 2, opacity: 1 }, interactive: true, visibleByDefault: true, zOrder: 5, labelField: 'protocolNumber', labelMinZoom: 14, popup: { trigger: 'click', title: 'Protocolo: {protocolNumber}', fields: [{ property: 'address', label: 'Endereco' }] } });
    }
    if (targetGeoJson.features.length > 0) {
      layers.push({ code: 'so-targets', name: 'Alvos (Postes)', geometryType: 'point', source: { type: 'geojson-static' as const, data: targetGeoJson }, style: { color: '#f59e0b', iconSize: 10, outlineColor: '#fff', outlineWidth: 2, opacity: 1 }, interactive: true, visibleByDefault: true, zOrder: 6, labelField: 'label', labelMinZoom: 10, popup: { trigger: 'click', title: 'Poste: {basement}', fields: [{ property: 'occurrenceProtocol', label: 'Ocorrencia' }] } });
    }
    return layers;
  }, [occurrenceGeoJson, targetGeoJson]);

  const mapCenter = useMemo(() => {
    const allCoords: [number, number][] = [];
    if (order) {
      for (const o of order.occurrences) {
        if (o.latitude != null && o.longitude != null) allCoords.push([o.longitude, o.latitude]);
      }
    }
    for (const gp of geoPoints) allCoords.push([gp.longitude, gp.latitude]);
    if (allCoords.length > 0) {
      const avgLng = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length;
      const avgLat = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length;
      return [avgLng, avgLat] as [number, number];
    }
    if (selectedContract?.bounds) return [selectedContract.bounds.centerLongitude, selectedContract.bounds.centerLatitude] as [number, number];
    return [-38.5, -12.97] as [number, number];
  }, [order, geoPoints, selectedContract]);

  // ─── Task columns for DataTable ─────────────────────────────────────────────

  const taskColumns = useMemo(() => [
    { key: 'code', header: 'Codigo', sortable: true },
    { key: 'occurrenceProtocol', header: 'Ocorrencia', sortable: true,
      render: (row: TaskRow) => row.occurrenceProtocol
        ? <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">{row.occurrenceProtocol}</span>
        : <span className="text-gray-400">—</span>,
    },
    { key: 'description', header: 'Descricao', sortable: true },
    { key: 'basement', header: 'Poste', sortable: true,
      render: (row: TaskRow) => {
        const gp = row.target ? geoPointByEntityId.get(row.target.entityId) : null;
        return gp ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-600">{gp.basement}</span> : <span className="text-gray-400">—</span>;
      },
    },
    { key: 'address', header: 'Endereco', sortable: true,
      render: (row: TaskRow) => {
        const gp = row.target ? geoPointByEntityId.get(row.target.entityId) : null;
        return gp?.address ?? '—';
      },
    },
    { key: 'neighborhood', header: 'Bairro', sortable: true, visible: false,
      render: (row: TaskRow) => {
        const gp = row.target ? geoPointByEntityId.get(row.target.entityId) : null;
        return gp?.neighborhood ?? '—';
      },
    },
    { key: 'zone', header: 'Zona', sortable: true, visible: false,
      render: (row: TaskRow) => {
        const gp = row.target ? geoPointByEntityId.get(row.target.entityId) : null;
        return gp?.zone ?? '—';
      },
    },
    { key: 'createdAt', header: 'Criado em', sortable: true,
      render: (row: TaskRow) => row.createdAt ? new Date(row.createdAt).toLocaleString('pt-BR') : '—',
    },
    { key: 'updatedAt', header: 'Atualizado em', sortable: true, visible: false,
      render: (row: TaskRow) => row.updatedAt ? new Date(row.updatedAt).toLocaleString('pt-BR') : '—',
    },
    { key: 'isApproved', header: 'Aprovacao', sortable: true,
      render: (row: TaskRow) => isApprovedEditable
        ? <ApprovalToggle value={row.isApproved} onChange={(val) => handleTaskApproval(row.id, val)} />
        : <ApprovalBadge value={row.isApproved} />,
    },
  ], [isApprovedEditable, handleTaskApproval, geoPointByEntityId]);

  const taskRowActions = useMemo(() => [
    { icon: <Eye size={14} />, label: 'Detalhes', onClick: (row: TaskRow) => { setDetailTask(row); setActPage(0); }, variant: 'info' as const },
  ], []);

  // ─── Action columns for DataTable (in popup) ─────────────────────────────

  const actionColumns = useMemo(() => [
    { key: 'description', header: 'Descricao', sortable: true },
    { key: 'executedBy', header: 'Executado por', sortable: true },
    { key: 'executedAt', header: 'Data', sortable: true,
      render: (row: TaskAction) => row.executedAt ? new Date(row.executedAt).toLocaleString('pt-BR') : '—',
    },
    { key: 'component', header: 'Componente', sortable: false,
      render: (row: TaskAction) => {
        if (!row.componentId) return '—';
        const asset = lightingAssets.get(row.componentId);
        return asset
          ? <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-600">{asset.plateCode ?? `#${asset.id}`}</span>
          : <span className="text-gray-400">#{row.componentId}</span>;
      },
    },
    { key: 'lampType', header: 'Tipo Lampada', sortable: false,
      render: (row: TaskAction) => lightingAssets.get(row.componentId ?? 0)?.lampType?.type ?? '—',
    },
    { key: 'lampPower', header: 'Potencia', sortable: false,
      render: (row: TaskAction) => { const v = lightingAssets.get(row.componentId ?? 0)?.lampPower?.value; return v != null ? `${v}W` : '—'; },
    },
    { key: 'luminaryType', header: 'Luminaria', sortable: false,
      render: (row: TaskAction) => lightingAssets.get(row.componentId ?? 0)?.luminaryType?.type ?? '—',
    },
    { key: 'armType', header: 'Braco', sortable: false,
      render: (row: TaskAction) => lightingAssets.get(row.componentId ?? 0)?.luminarySupportArmType?.armType ?? '—',
    },
    { key: 'reactorType', header: 'Reator', sortable: false,
      render: (row: TaskAction) => lightingAssets.get(row.componentId ?? 0)?.reactorType?.type ?? '—',
    },
    { key: 'relayType', header: 'Rele', sortable: false,
      render: (row: TaskAction) => lightingAssets.get(row.componentId ?? 0)?.relayType?.type ?? '—',
    },
    { key: 'manufacturer', header: 'Fabricante', sortable: false, visible: false,
      render: (row: TaskAction) => lightingAssets.get(row.componentId ?? 0)?.manufacturer?.name ?? '—',
    },
    { key: 'model', header: 'Modelo', sortable: false, visible: false,
      render: (row: TaskAction) => lightingAssets.get(row.componentId ?? 0)?.manufacturerModel?.model ?? '—',
    },
    { key: 'localType', header: 'Local', sortable: false, visible: false,
      render: (row: TaskAction) => lightingAssets.get(row.componentId ?? 0)?.localType?.type ?? '—',
    },
    { key: 'isApproved', header: 'Aprovacao', sortable: true,
      render: (row: TaskAction) => isApprovedEditable
        ? <ApprovalToggle value={row.isApproved} onChange={(val) => handleActionApproval(row.id, val)} />
        : <ApprovalBadge value={row.isApproved} />,
    },
  ], [isApprovedEditable, handleActionApproval, lightingAssets]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
      </div>
    );
  }

  if (!order) {
    return <div className="py-12 text-center text-gray-500">Ordem de servico nao encontrada.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <ClipboardList size={20} className="text-primary-600" />
        <h1 className="text-lg font-semibold text-gray-800">OS {order.code}</h1>
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
        <div className="ml-auto flex gap-2">
          {availableActions.map((action) => (
            <Button key={action.id} size="sm" variant={action.code === 'Cancelar' ? 'danger' : 'primary'}
              onClick={() => { setActionModal({ action }); setObservation(''); }}>
              <Play size={14} /> {action.description}
            </Button>
          ))}
        </div>
      </div>

      {/* Order info bar */}
      <div className="mb-3 grid grid-cols-4 gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
        <div><span className="text-xs text-gray-500">Descricao</span><p className="text-gray-700">{order.description || '—'}</p></div>
        <div><span className="text-xs text-gray-500">Prioridade</span><p className="text-gray-700">{order.priority || '—'}</p></div>
        <div><span className="text-xs text-gray-500">Criado em</span><p className="text-gray-700">{order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : '—'}</p></div>
        <div>
          <span className="text-xs text-gray-500">Ocorrencias</span>
          <div className="flex flex-wrap gap-1">
            {order.occurrences.map((o) => (
              <span key={o.id} className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{o.protocolNumber}</span>
            ))}
            {order.occurrences.length === 0 && <p className="text-gray-400">—</p>}
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 gap-3 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left: tasks DataTable */}
        <div className="flex w-1/2 flex-col overflow-auto">
          <DataTable<TaskRow>
            title={`Tarefas (${order.tasks.length})`}
            icon={<ClipboardList size={18} className="text-primary-600" />}
            columns={taskColumns}
            data={order.tasks}
            loading={false}
            pageSize={taskPageSize}
            page={taskPage}
            onPageChange={setTaskPage}
            onPageSizeChange={setTaskPageSize}
            onSearch={() => {}}
            rowActions={taskRowActions}
          />
        </div>

        {/* Right: map */}
        <div className="relative w-1/2 overflow-hidden rounded-lg border border-gray-200">
          <MapProvider adapterFactory={adapterFactory}>
            <NetworkMap center={mapCenter} zoom={15} layers={mapLayers}
              showLayerPanel={false} showBaseLayerSwitcher={false}
              showCoordinates={false} showScale={false} className="h-full w-full" />
            <MapFlyTo center={mapCenter} />
          </MapProvider>
        </div>
      </div>

      {/* ─── Task Detail Popup ─────────────────────────────────────────────── */}
      {detailTask && (
        <Modal open onClose={() => setDetailTask(null)}
          title={`Tarefa ${detailTask.code}${detailTask.occurrenceProtocol ? ` — ${detailTask.occurrenceProtocol}` : ''}`}
          className="max-w-6xl">
          <div className="space-y-4">
            {/* Task info */}
            <div className="flex items-center gap-4 text-sm">
              <div><span className="text-xs text-gray-500">Descricao:</span> <span className="text-gray-700">{detailTask.description || '—'}</span></div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Aprovacao:</span>
                {isApprovedEditable
                  ? <ApprovalToggle value={detailTask.isApproved} onChange={(val) => handleTaskApproval(detailTask.id, val)} />
                  : <ApprovalBadge value={detailTask.isApproved} />}
              </div>
              {detailTask.target && (
                <div><span className="text-xs text-gray-500">Alvo:</span>{' '}
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-600">
                    {detailTask.target.entityType} #{detailTask.target.entityId}
                  </span>
                </div>
              )}
            </div>

            {/* Task actions DataTable */}
            {loadingAssets && (
              <div className="flex justify-center py-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
              </div>
            )}
            <DataTable<TaskAction>
              columns={actionColumns}
              data={detailTask.actions}
              loading={false}
              pageSize={actPageSize}
              page={actPage}
              onPageChange={setActPage}
              onPageSizeChange={setActPageSize}
              onSearch={() => {}}
            />

            {/* Task pictures */}
            <TaskPicturesSection pictures={detailTask.pictures ?? []} />

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setDetailTask(null)}>Fechar</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Flow Action Modal ─────────────────────────────────────────────── */}
      {actionModal && (() => {
        const customization = getActionCustomization(actionModal.action.code);
        const closeModal = () => { setActionModal(null); setObservation(''); setExtraData({}); };
        return (
          <Modal open onClose={closeModal}
            title={`${actionModal.action.description} — OS ${order.code}`} className="max-w-md">
            {customization?.renderModal ? (
              customization.renderModal({
                serviceOrderId: order.id, serviceOrderCode: order.code,
                actionDescription: actionModal.action.description, contractId: selectedContract!.id,
                onConfirm: (obs, extra) => handleExecuteAction(obs, extra),
                onCancel: closeModal, executing, extraData, setExtraData,
              })
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Deseja executar a acao <strong>{actionModal.action.description}</strong> na
                  ordem de servico <strong>{order.code}</strong>?
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Observacao (opcional)</label>
                  <textarea value={observation} onChange={(e) => setObservation(e.target.value)} rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Adicione uma observacao..." />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeModal} disabled={executing}>Cancelar</Button>
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

// ─── Map helper ───────────────────────────────────────────────────────────────

function MapFlyTo({ center }: { center: [number, number] }) {
  const { getAdapter, isReady } = useMap();
  const prevCenterRef = useRef<string>('');

  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter) return;
    const key = center.join(',');
    if (key === prevCenterRef.current) return;
    prevCenterRef.current = key;
    adapter.flyTo(center, 15);
  }, [isReady, center, getAdapter]);

  return null;
}

// ─── Task Pictures Section ────────────────────────────────────────────────────

function TaskPicturesSection({ pictures }: { pictures: TaskPicture[] }) {
  const before = pictures.filter((p) => p.pictureTypeCode === 'FOTOS_ANTES');
  const after = pictures.filter((p) => p.pictureTypeCode === 'FOTOS_DEPOIS');
  const other = pictures.filter((p) => p.pictureTypeCode !== 'FOTOS_ANTES' && p.pictureTypeCode !== 'FOTOS_DEPOIS');

  if (pictures.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-400">
        <Camera size={16} /> Nenhuma foto registrada para esta tarefa.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {before.length > 0 && (
        <PictureGroup title="Fotos antes" pictures={before} />
      )}
      {after.length > 0 && (
        <PictureGroup title="Fotos depois" pictures={after} />
      )}
      {other.length > 0 && (
        <PictureGroup title="Outras fotos" pictures={other} />
      )}
    </div>
  );
}

function PictureGroup({ title, pictures }: { title: string; pictures: TaskPicture[] }) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
        <Camera size={14} className="text-gray-500" /> {title} ({pictures.length})
      </h4>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {pictures.map((pic) => (
          <button key={pic.id} onClick={() => setSelectedUrl(pic.url)}
            className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400">
            <img src={pic.url} alt={pic.description ?? ''} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            {pic.description && (
              <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[10px] text-white truncate">
                {pic.description}
              </div>
            )}
          </button>
        ))}
      </div>
      {/* Lightbox */}
      {selectedUrl && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" onClick={() => setSelectedUrl(null)}>
          <img src={selectedUrl} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}

// ─── Approval Components ──────────────────────────────────────────────────────

function ApprovalToggle({ value, onChange }: { value: boolean | null; onChange: (val: boolean | null) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-0.5">
      <button title="Aprovar" onClick={(e) => { e.stopPropagation(); onChange(value === true ? null : true); }}
        className={`rounded p-1 transition-colors ${value === true ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-green-500'}`}>
        <CheckCircle size={16} />
      </button>
      <button title="Reprovar" onClick={(e) => { e.stopPropagation(); onChange(value === false ? null : false); }}
        className={`rounded p-1 transition-colors ${value === false ? 'bg-red-100 text-red-600' : 'text-gray-400 hover:text-red-500'}`}>
        <XCircle size={16} />
      </button>
    </div>
  );
}

function ApprovalBadge({ value }: { value: boolean | null; size?: 'xs' | 'sm' }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle size={14} /> Aprovado
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
        <XCircle size={14} /> Reprovado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
      <MinusCircle size={14} /> Pendente
    </span>
  );
}
