import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { serviceOrdersApi, userFlowApi } from '@fsa/shared-api';
import { Button, DataTable, Modal } from '@fsa/shared-ui';
import { NetworkMap, MapProvider, MapLibreAdapter } from '@fsa/network-map';
import type { LayerConfig } from '@fsa/network-map';
import { useContract } from '../ContractProvider';
import {
  ClipboardList,
  Eye,
  MapPin,
  Plus,
  AlertTriangle,
  Clock,
  FileText,
  User,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OccurrenceRow {
  id: number;
  protocolNumber: string;
  callerFirstName: string | null;
  callerLastName: string | null;
  callerPhone: string | null;
  reportedBy: string | null;
  reportedAt: string | null;
  categoryId: number | null;
  priority: boolean;
  priorityReason: string | null;
  address: string | null;
  neighborhood: string | null;
  referencePoint: string | null;
  additionalInfo: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  createdAt: string | null;
  serviceOrderId: number | null;
  serviceOrderCode: string | null;
  // Enriched on the frontend from user-flow
  status?: string;
}

interface RegisterEntry {
  id: number;
  createdAt: string;
  executedBy: string | null;
  observation: string | null;
  status: { id: number; code: string; description: string } | null;
  action: { id: number; code: string; description: string } | null;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function OccurrenceListPage() {
  const { selectedContract } = useContract();
  const navigate = useNavigate();
  const [data, setData] = useState<OccurrenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<OccurrenceRow | null>(null);

  const load = useCallback(() => {
    if (!selectedContract) return;
    setLoading(true);
    serviceOrdersApi
      .getOccurrencesByContractEnriched(selectedContract.id)
      .then((res) => {
        const rows: OccurrenceRow[] = res.data ?? [];
        // Enrich status: if no service order → "Sem atender"
        for (const row of rows) {
          if (!row.serviceOrderId) {
            row.status = 'Sem atender';
          }
        }
        setData(rows);
        // For rows with a service order, fetch the current register status
        enrichStatuses(rows);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [selectedContract]);

  const enrichStatuses = async (rows: OccurrenceRow[]) => {
    const withSO = rows.filter((r) => r.serviceOrderId && r.serviceOrderCode);
    if (withSO.length === 0) return;

    // Fetch current register status for each service order via generic target query
    const updates: Map<number, string> = new Map();
    await Promise.all(
      withSO.map(async (row) => {
        try {
          const res = await userFlowApi.getCurrentRegister(
            'Manutencao', 'service-orders', 'ServiceOrder', String(row.serviceOrderId!));
          const reg = res.data;
          if (reg?.status?.description) {
            updates.set(row.id, reg.status.description);
          } else if (reg?.status?.code) {
            updates.set(row.id, reg.status.code);
          }
        } catch {
          // Leave as undefined — will show "Sem atender" fallback
        }
      })
    );

    if (updates.size > 0) {
      setData((prev) =>
        prev.map((r) => {
          const statusDesc = updates.get(r.id);
          return statusDesc ? { ...r, status: statusDesc } : r;
        })
      );
    }
  };

  useEffect(() => { load(); }, [load]);

  // Resolve category description from contract
  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of selectedContract?.categories ?? []) {
      map.set(cat.id, cat.description || cat.code);
    }
    return map;
  }, [selectedContract]);

  const columns = [
    { key: 'protocolNumber', header: 'Protocolo', sortable: true, minWidth: '130px' },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      minWidth: '140px',
      render: (row: Record<string, unknown>) => {
        const status = (row.status as string) ?? 'Sem atender';
        const isUnattended = status === 'Sem atender';
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isUnattended
                ? 'bg-amber-100 text-amber-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {status}
          </span>
        );
      },
    },
    {
      key: 'serviceOrderCode',
      header: 'Ordem de Serviço',
      sortable: true,
      minWidth: '140px',
      render: (row: Record<string, unknown>) => {
        const code = row.serviceOrderCode as string | null;
        return code ? (
          <span className="text-sm font-medium text-primary-600">{code}</span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        );
      },
    },
    { key: 'reportedBy', header: 'Solicitante', sortable: true, minWidth: '140px' },
    { key: 'callerPhone', header: 'Telefone', sortable: false, minWidth: '120px' },
    {
      key: 'categoryId',
      header: 'Categoria',
      sortable: true,
      minWidth: '140px',
      render: (row: Record<string, unknown>) => {
        const catId = row.categoryId as number | null;
        return catId ? categoryMap.get(catId) ?? String(catId) : '—';
      },
    },
    {
      key: 'priority',
      header: 'Prioridade',
      sortable: true,
      minWidth: '100px',
      render: (row: Record<string, unknown>) => {
        const p = row.priority as boolean;
        return p ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <AlertTriangle size={12} /> Sim
          </span>
        ) : (
          <span className="text-xs text-gray-400">Não</span>
        );
      },
    },
    { key: 'address', header: 'Endereço', sortable: true, minWidth: '200px' },
    { key: 'neighborhood', header: 'Bairro', sortable: true, minWidth: '120px' },
    {
      key: 'reportedAt',
      header: 'Data',
      sortable: true,
      minWidth: '150px',
      render: (row: Record<string, unknown>) => {
        const d = row.reportedAt as string | null;
        if (!d) return '—';
        try {
          return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        } catch {
          return d;
        }
      },
    },
    { key: 'referencePoint', header: 'Ponto de Referência', sortable: false, minWidth: '160px', visible: false },
    { key: 'additionalInfo', header: 'Info Adicional', sortable: false, minWidth: '160px', visible: false },
    { key: 'description', header: 'Descrição', sortable: false, minWidth: '160px', visible: false },
    { key: 'priorityReason', header: 'Motivo Prioridade', sortable: false, minWidth: '140px', visible: false },
  ];

  return (
    <>
      <DataTable
        title="Solicitações de Manutenção"
        icon={<ClipboardList size={20} className="text-primary-600" />}
        headerActions={<Button size="sm" variant="success" onClick={() => navigate('/solicitacoes/manutencao/abrir')}><Plus size={16} /> Novo</Button>}
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearch={() => {}}
        rowActions={[
          {
            icon: <Eye size={14} />,
            label: 'Visualizar',
            variant: 'info' as const,
            onClick: (row) => setSelected(row as unknown as OccurrenceRow),
          },
        ]}
      />

      {selected && (
        <OccurrenceDetailModal
          occurrence={selected}
          categoryMap={categoryMap}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// ─── Detail Modal ───────────────────────────────────────────────────────────

function OccurrenceDetailModal({
  occurrence,
  categoryMap,
  onClose,
}: {
  occurrence: OccurrenceRow;
  categoryMap: Map<number, string>;
  onClose: () => void;
}) {
  const adapterFactory = useMemo(() => () => new MapLibreAdapter(), []);
  const [registers, setRegisters] = useState<RegisterEntry[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);

  // Fetch register history if there's a service order
  useEffect(() => {
    if (!occurrence.serviceOrderId) return;
    setLoadingRegs(true);
    userFlowApi
      .getHistory('Manutencao', 'service-orders', 'ServiceOrder', String(occurrence.serviceOrderId!))
      .then((res) => setRegisters(res.data ?? []))
      .catch(() => setRegisters([]))
      .finally(() => setLoadingRegs(false));
  }, [occurrence.serviceOrderId]);

  // Build a static GeoJSON layer with a single point for the occurrence location
  const mapLayers: LayerConfig[] = useMemo(() => {
    if (occurrence.latitude == null || occurrence.longitude == null) return [];
    return [
      {
        code: 'occurrence-location',
        name: 'Localização',
        geometryType: 'point' as const,
        source: {
          type: 'geojson-static' as const,
          data: {
            type: 'FeatureCollection' as const,
            features: [
              {
                type: 'Feature' as const,
                geometry: {
                  type: 'Point' as const,
                  coordinates: [occurrence.longitude!, occurrence.latitude!],
                },
                properties: { id: occurrence.id },
              },
            ],
          },
        },
        style: {
          color: '#2563eb',
          iconSize: 10,
          outlineColor: '#ffffff',
          outlineWidth: 3,
          opacity: 1,
        },
        interactive: false,
        visibleByDefault: true,
        zOrder: 10,
      },
    ];
  }, [occurrence]);

  const category = occurrence.categoryId ? categoryMap.get(occurrence.categoryId) : null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Ocorrência ${occurrence.protocolNumber}`}
      className="max-w-4xl max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-5">
        {/* Status + Service Order header */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
              occurrence.status === 'Sem atender'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {occurrence.status ?? 'Sem atender'}
          </span>
          {occurrence.serviceOrderCode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
              <FileText size={14} /> OS: {occurrence.serviceOrderCode}
            </span>
          )}
          {occurrence.priority && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
              <AlertTriangle size={14} /> Prioridade
            </span>
          )}
        </div>

        {/* Caller / Requester Info */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <User size={16} /> Solicitante
          </h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <Field label="Nome" value={[occurrence.callerFirstName, occurrence.callerLastName].filter(Boolean).join(' ')} />
            <Field label="Telefone" value={occurrence.callerPhone} />
          </div>
        </div>

        {/* Occurrence Details */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <ClipboardList size={16} /> Detalhes
          </h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <Field label="Protocolo" value={occurrence.protocolNumber} />
            <Field label="Categoria" value={category} />
            <Field label="Prioridade" value={occurrence.priority ? 'Sim' : 'Não'} />
            <Field label="Motivo Prioridade" value={occurrence.priorityReason} />
            <Field label="Descrição" value={occurrence.description} span2 />
            <Field
              label="Data"
              value={occurrence.reportedAt ? new Date(occurrence.reportedAt).toLocaleString('pt-BR') : null}
            />
          </div>
        </div>

        {/* Address + Map */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <MapPin size={16} /> Localização
          </h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <Field label="Endereço" value={occurrence.address} span2 />
            <Field label="Bairro" value={occurrence.neighborhood} />
            <Field label="Ponto de Referência" value={occurrence.referencePoint} />
            <Field label="Info Adicional" value={occurrence.additionalInfo} span2 />
          </div>
          {occurrence.latitude != null && occurrence.longitude != null && (
            <div className="mt-3 h-[250px] w-full overflow-hidden rounded-lg border border-gray-300">
              <MapProvider adapterFactory={adapterFactory}>
                <NetworkMap
                  center={[occurrence.longitude!, occurrence.latitude!]}
                  zoom={16}
                  layers={mapLayers}
                  showLayerPanel={false}
                  showBaseLayerSwitcher={false}
                  showCoordinates={false}
                  showScale={false}
                  className="h-full w-full"
                />
              </MapProvider>
            </div>
          )}
        </div>

        {/* Service Order + Register History */}
        {occurrence.serviceOrderId && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Clock size={16} /> Histórico da Ordem de Serviço
            </h4>
            {loadingRegs ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
              </div>
            ) : registers.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum registro encontrado.</p>
            ) : (
              <div className="space-y-2">
                {registers.map((reg) => (
                  <div
                    key={reg.id}
                    className="flex items-start gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                  >
                    <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary-500" />
                    <div className="flex-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">
                          {reg.status?.description ?? reg.status?.code ?? '—'}
                        </span>
                        {reg.action && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                            {reg.action.description ?? reg.action.code}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {reg.createdAt
                          ? new Date(reg.createdAt).toLocaleString('pt-BR')
                          : '—'}
                        {reg.executedBy && <> · {reg.executedBy}</>}
                      </div>
                      {reg.observation && (
                        <p className="mt-1 text-xs text-gray-600">{reg.observation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Field helper ───────────────────────────────────────────────────────────

function Field({
  label,
  value,
  span2,
}: {
  label: string;
  value: string | null | undefined;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <span className="text-xs font-medium text-gray-500">{label}: </span>
      <span className="text-gray-700">{value || '—'}</span>
    </div>
  );
}
