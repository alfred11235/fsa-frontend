import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { serviceOrdersApi, userFlowApi } from '@fsa/shared-api';
import { Button, useToast } from '@fsa/shared-ui';
import { NetworkMap, MapProvider, MapLibreAdapter, DrawTool } from '@fsa/network-map';
import type { LayerConfig } from '@fsa/network-map';
import { useContract } from '../ContractProvider';
import {
  ClipboardList,
  CheckCircle,
  Eye,
  ArrowLeft,
  LayoutDashboard,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OccurrenceRow {
  id: number;
  protocolNumber: string;
  callerFirstName: string | null;
  callerLastName: string | null;
  reportedBy: string | null;
  reportedAt: string | null;
  categoryId: number | null;
  priority: boolean;
  priorityReason: string | null;
  address: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  createdAt: string | null;
}

interface GeneratedSO {
  occurrenceId: number;
  protocolNumber: string;
  serviceOrderId: number;
  serviceOrderCode: string;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function GenerateServiceOrderPage() {
  const { selectedContract } = useContract();
  const navigate = useNavigate();
  const toast = useToast();
  const adapterFactory = useMemo(() => () => new MapLibreAdapter(), []);

  const [occurrences, setOccurrences] = useState<OccurrenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [generatedOrders, setGeneratedOrders] = useState<GeneratedSO[] | null>(null);
  const [detailOcc, setDetailOcc] = useState<OccurrenceRow | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Load unassigned occurrences
  const load = useCallback(() => {
    if (!selectedContract) return;
    setLoading(true);
    serviceOrdersApi
      .getUnassignedOccurrences(selectedContract.id)
      .then((res) => setOccurrences(res.data ?? []))
      .catch(() => setOccurrences([]))
      .finally(() => setLoading(false));
  }, [selectedContract]);

  useEffect(() => { load(); }, [load]);

  // Category map
  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of selectedContract?.categories ?? []) {
      map.set(cat.id, cat.description || cat.code);
    }
    return map;
  }, [selectedContract]);

  // Sorting
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortedOccurrences = useMemo(() => {
    if (!sortKey) return occurrences;
    return [...occurrences].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      let cmp: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') cmp = aVal - bVal;
      else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') cmp = aVal === bVal ? 0 : aVal ? -1 : 1;
      else cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base', numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [occurrences, sortKey, sortDir]);

  // Toggle selection
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === occurrences.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(occurrences.map((o) => o.id)));
    }
  };

  // Spatial query from draw tool — select occurrences inside the fence
  const handleSpatialQuery = useCallback((_geom: GeoJSON.Geometry, features: GeoJSON.Feature[]) => {
    const idsInFence = new Set<number>();
    for (const f of features) {
      const fid = f.properties?.id;
      if (typeof fid === 'number') idsInFence.add(fid);
    }
    if (idsInFence.size > 0) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of idsInFence) {
          // Only add if it's an occurrence id (not a pole)
          if (occurrences.some((o) => o.id === id)) next.add(id);
        }
        return next;
      });
    }
  }, [occurrences]);

  // GeoJSON layer for unassigned occurrences on the map
  const occurrenceGeoJson = useMemo(() => {
    const features = occurrences
      .filter((o) => o.latitude != null && o.longitude != null)
      .map((o) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [o.longitude!, o.latitude!] },
        properties: {
          id: o.id,
          protocolNumber: o.protocolNumber,
          address: o.address,
          priority: o.priority,
          selected: selectedIds.has(o.id),
        },
      }));
    return { type: 'FeatureCollection' as const, features };
  }, [occurrences, selectedIds]);

  // Map layers
  const mapLayers: LayerConfig[] = useMemo(() => {
    const layers: LayerConfig[] = [];

    // Geographic points (poles) — MVT
    layers.push({
      code: 'geographic-points',
      name: 'Postes',
      geometryType: 'point',
      source: {
        type: 'mvt',
        url: '/api/network-map/spatial/tiles/{z}/{x}/{y}.mvt?layerCode=geographic-points',
        sourceLayer: 'geographic-points-unclustered',
      },
      style: { color: '#f97316', iconSize: 5, outlineColor: '#fff', outlineWidth: 1, opacity: 0.7 },
      interactive: false,
      visibleByDefault: true,
      zOrder: 1,
    });

    // Unassigned occurrences — GeoJSON static with selection styling
    layers.push({
      code: 'unassigned-occurrences',
      name: 'Ocorrências',
      geometryType: 'point',
      source: { type: 'geojson-static' as const, data: occurrenceGeoJson },
      style: { color: '#2563eb', iconSize: 8, outlineColor: '#fff', outlineWidth: 2, opacity: 1 },
      interactive: true,
      visibleByDefault: true,
      zOrder: 5,
      popup: {
        titleField: 'protocolNumber',
        titlePrefix: 'Protocolo: ',
        fields: [
          { key: 'address', label: 'Endereço' },
        ],
      },
    });

    return layers;
  }, [occurrenceGeoJson]);

  // Generate service orders
  const handleGenerate = async () => {
    if (selectedIds.size === 0 || !selectedContract) return;
    setSubmitting(true);
    try {
      const res = await serviceOrdersApi.generateServiceOrders(
        Array.from(selectedIds),
        selectedContract.id,
      );
      const generated: GeneratedSO[] = res.data ?? [];

      // Create a Register for each service order with status GERADA
      await Promise.allSettled(
        generated.map((so) =>
          userFlowApi.startFlow(
            'Manutencao',
            'service-orders',
            'ServiceOrder',
            String(so.serviceOrderId),
            'Sistema',
          )
        )
      );

      setGeneratedOrders(generated);
      toast.success(`${generated.length} ordem(ns) de serviço gerada(s) com sucesso!`);
    } catch {
      toast.error('Erro ao gerar ordens de serviço.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success Screen ───────────────────────────────────────────────────────

  if (generatedOrders) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-600" />
          <h2 className="mb-1 text-lg font-semibold text-green-800">
            {generatedOrders.length === 1
              ? 'Ordem de serviço criada com sucesso!'
              : `${generatedOrders.length} ordens de serviço criadas com sucesso!`}
          </h2>
        </div>

        <div className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase text-gray-500">Protocolo</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase text-gray-500">Código OS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {generatedOrders.map((so) => (
                <tr key={so.serviceOrderId} className="bg-white">
                  <td className="px-4 py-2 text-sm text-gray-700">{so.protocolNumber}</td>
                  <td className="px-4 py-2 text-sm font-medium text-primary-600">{so.serviceOrderCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              setGeneratedOrders(null);
              setSelectedIds(new Set());
              load();
            }}
          >
            <ArrowLeft size={16} /> Continuar gerando Ordens de Serviço
          </Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            <LayoutDashboard size={16} /> Ir ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ─── Detail Popup ─────────────────────────────────────────────────────────

  const detailPopup = detailOcc && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetailOcc(null)}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-sm font-semibold text-gray-800">
          Ocorrência — Protocolo {detailOcc.protocolNumber}
        </h3>
        <div className="space-y-1 text-sm text-gray-700">
          <DetailField label="Solicitante" value={detailOcc.reportedBy} />
          <DetailField label="Endereço" value={detailOcc.address} />
          <DetailField label="Bairro" value={detailOcc.neighborhood} />
          <DetailField label="Categoria" value={detailOcc.categoryId ? categoryMap.get(detailOcc.categoryId) ?? String(detailOcc.categoryId) : null} />
          <DetailField label="Prioridade" value={detailOcc.priority ? 'Sim' : 'Não'} />
          {detailOcc.priorityReason && <DetailField label="Motivo" value={detailOcc.priorityReason} />}
          <DetailField label="Descrição" value={detailOcc.description} />
          <DetailField label="Data" value={detailOcc.createdAt ? new Date(detailOcc.createdAt).toLocaleString('pt-BR') : null} />
        </div>
        <div className="mt-4 text-right">
          <Button size="sm" variant="secondary" onClick={() => setDetailOcc(null)}>Fechar</Button>
        </div>
      </div>
    </div>
  );

  // ─── Main Layout ──────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-3 text-lg font-semibold text-gray-800">
        Manutenção: Geração de Ordens de Serviço
      </h1>

      {selectedContract && (
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
          Contrato: <span className="font-medium text-gray-800">{selectedContract.name}</span>
        </div>
      )}

      <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800">
        Para gerar uma ordem de serviço, selecione a(s) ocorrência(s) na lista ou diretamente no mapa.
      </div>

      {/* Split layout */}
      <div className="flex flex-1 gap-3 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left: occurrence list */}
        <div className="flex w-1/2 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={occurrences.length > 0 && selectedIds.size === occurrences.length}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600"
                    />
                  </th>
                  {[
                    { key: 'protocolNumber', label: 'Protocolo' },
                    { key: 'priority', label: 'Prioridade' },
                    { key: 'createdAt', label: 'Data de criação' },
                    { key: 'neighborhood', label: 'Bairro' },
                    { key: 'address', label: 'Endereço' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="cursor-pointer select-none px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-900"
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <span className="text-[10px] text-gray-400">
                          {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '▽'}
                        </span>
                      </span>
                    </th>
                  ))}
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
                    </td>
                  </tr>
                ) : sortedOccurrences.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      Nenhuma ocorrência disponível para geração de OS
                    </td>
                  </tr>
                ) : (
                  sortedOccurrences.map((occ) => (
                    <tr
                      key={occ.id}
                      className={`transition-colors ${selectedIds.has(occ.id) ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
                    >
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(occ.id)}
                          onChange={() => toggleSelect(occ.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600"
                        />
                      </td>
                      <td className="px-3 py-2 text-[13px] font-medium text-gray-800">{occ.protocolNumber}</td>
                      <td className="px-3 py-2">
                        {occ.priority ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            <AlertTriangle size={12} /> Sim
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Não</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[13px] text-gray-600">
                        {occ.createdAt ? new Date(occ.createdAt).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-3 py-2 text-[13px] text-gray-600">{occ.neighborhood ?? '—'}</td>
                      <td className="max-w-[180px] truncate px-3 py-2 text-[13px] text-gray-600" title={occ.address ?? ''}>
                        {occ.address ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          title="Visualizar"
                          onClick={() => setDetailOcc(occ)}
                          className="rounded p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Footer with count and button */}
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2">
            <span className="text-xs text-gray-500">
              {selectedIds.size} de {occurrences.length} ocorrência(s) selecionada(s)
            </span>
          </div>
        </div>

        {/* Right: map */}
        <div className="w-1/2 overflow-hidden rounded-lg border border-gray-200">
          <MapProvider adapterFactory={adapterFactory}>
            <NetworkMap
              center={[-38.5, -12.97]}
              zoom={13}
              layers={mapLayers}
              showLayerPanel={false}
              showBaseLayerSwitcher={false}
              showCoordinates={false}
              showScale={false}
              className="h-full w-full"
            />
            <DrawTool
              position="top-right"
              style={{ top: 10 }}
              onSpatialQuery={handleSpatialQuery}
              spatialQueryLayers={['unassigned-occurrences']}
            />
          </MapProvider>
        </div>
      </div>

      {/* Generate button */}
      <div className="mt-3 flex justify-center">
        <Button
          variant="primary"
          size="lg"
          disabled={selectedIds.size === 0 || submitting}
          onClick={handleGenerate}
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Gerando...
            </span>
          ) : (
            <>
              <ClipboardList size={18} /> Gerar Ordem de Serviço
            </>
          )}
        </Button>
      </div>

      {detailPopup}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-500">{label}: </span>
      <span className="text-gray-700">{value || '—'}</span>
    </div>
  );
}
