import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button, useToast } from '@fsa/shared-ui';
import { serviceOrdersApi, fileApi } from '@fsa/shared-api';
import { NetworkMap, MapProvider, MapLibreAdapter, useMap } from '@fsa/network-map';
import type { LayerConfig } from '@fsa/network-map';
import { useContract } from '../ContractProvider';
import {
  ArrowRight,
  ArrowLeft,
  Phone,
  MapPin,
  CheckCircle,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CategoryOption {
  id: number;
  code: string;
  description: string;
  iconUrl: string | null;
}

interface WizardData {
  // Step 1 – Caller
  callerPhone: string;
  callerPhoneIsLandline: boolean;
  callerFirstName: string;
  callerLastName: string;
  // Step 2 – Category
  categoryId: number | null;
  categoryDescription: string;
  priority: boolean;
  priorityReason: string;
  // Step 3 – Address
  address: string;
  neighborhood: string;
  referencePoint: string;
  additionalInfo: string;
  latitude: number | null;
  longitude: number | null;
  pictureFiles: File[];
}

interface CreatedOccurrence {
  id: number;
  protocolNumber: string;
  categoryDescription: string;
  address: string;
  referencePoint: string;
  additionalInfo: string;
}

const STEPS = [
  { number: 1, label: 'Dados do solicitante' },
  { number: 2, label: 'Tipo de Problema' },
  { number: 3, label: 'Endereço da Ocorrência' },
];

const emptyData: WizardData = {
  callerPhone: '',
  callerPhoneIsLandline: false,
  callerFirstName: '',
  callerLastName: '',
  categoryId: null,
  categoryDescription: '',
  priority: false,
  priorityReason: '',
  address: '',
  neighborhood: '',
  referencePoint: '',
  additionalInfo: '',
  latitude: null,
  longitude: null,
  pictureFiles: [],
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function OpenMaintenanceRequestPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({ ...emptyData });
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedOccurrence | null>(null);
  const { selectedContract } = useContract();
  const toast = useToast();

  const categories: CategoryOption[] = selectedContract?.categories ?? [];

  const update = useCallback(
    (patch: Partial<WizardData>) => setData((prev) => ({ ...prev, ...patch })),
    []
  );

  const canProceed = (): boolean => {
    if (step === 1) {
      return data.callerPhone.trim().length > 0 && data.callerFirstName.trim().length > 0;
    }
    if (step === 2) {
      return data.categoryId !== null && (!data.priority || data.priorityReason.trim().length > 0);
    }
    // Step 3: the address must have been resolved to actual coordinates, either by
    // picking one of the Nominatim suggestions or by clicking on the map (which
    // reverse-geocodes). A bare typed string with no coords would create an
    // occurrence the field crew can't navigate to.
    return (
      data.address.trim().length > 0 &&
      data.latitude != null &&
      data.longitude != null
    );
  };

  const handleSubmit = async () => {
    if (!selectedContract) {
      toast.error('Selecione um contrato.');
      return;
    }

    setSubmitting(true);
    try {
      // Upload pictures first
      const pictureUrls: string[] = [];
      for (const file of data.pictureFiles) {
        const res = await fileApi.upload(file, 'occurrences');
        pictureUrls.push(res.data.url);
      }

      const res = await serviceOrdersApi.createOccurrence({
        callerPhone: data.callerPhone,
        callerPhoneIsLandline: data.callerPhoneIsLandline,
        callerFirstName: data.callerFirstName,
        callerLastName: data.callerLastName,
        categoryId: data.categoryId,
        contractId: selectedContract.id,
        priority: data.priority,
        priorityReason: data.priorityReason,
        address: data.address,
        neighborhood: data.neighborhood,
        referencePoint: data.referencePoint,
        additionalInfo: data.additionalInfo,
        latitude: data.latitude,
        longitude: data.longitude,
        pictureUrls,
      });

      setCreated({
        id: res.data.id,
        protocolNumber: res.data.protocolNumber,
        categoryDescription: data.categoryDescription,
        address: data.address,
        referencePoint: data.referencePoint,
        additionalInfo: data.additionalInfo,
      });
      setStep(4);
      toast.success('Ocorrência criada com sucesso!');
    } catch {
      toast.error('Erro ao criar ocorrência.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    setData({ ...emptyData });
    setCreated(null);
    setStep(1);
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Title */}
      <h1 className="mb-6 text-xl font-semibold text-gray-800">Solicitação de manutenção</h1>

      {/* Stepper */}
      {step < 4 && <Stepper currentStep={step} />}

      {/* Contract badge */}
      {selectedContract && step < 4 && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
          Contrato: <span className="font-medium text-gray-800">{selectedContract.name}</span>
        </div>
      )}

      {/* Steps */}
      {step === 1 && <StepCallerData data={data} update={update} />}
      {step === 2 && <StepCategory data={data} update={update} categories={categories} />}
      {step === 3 && <StepAddress data={data} update={update} />}
      {step === 4 && created && (
        <StepConfirmation occurrence={created} onContinue={handleContinue} />
      )}

      {/* Navigation */}
      {step < 4 && (
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
          >
            <ArrowLeft size={16} /> Voltar
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
              Próximo <ArrowRight size={16} />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canProceed() || submitting}>
              {submitting ? 'Enviando...' : 'Criar Ocorrência'} {!submitting && <ArrowRight size={16} />}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stepper ────────────────────────────────────────────────────────────────

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-0">
      {STEPS.map((s, i) => {
        const active = s.number === currentStep;
        const done = s.number < currentStep;
        return (
          <div key={s.number} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? 'bg-primary-600 text-white'
                    : done
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s.number}
              </div>
              <span
                className={`text-sm ${
                  active ? 'font-semibold text-primary-700' : 'text-gray-500'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-4 h-px w-12 ${done ? 'bg-primary-400' : 'bg-gray-300'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Caller Data ────────────────────────────────────────────────────

function StepCallerData({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-4">
        {/* Phone */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Número de Telefone *
          </label>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              <Phone size={14} /> +55
            </span>
            <input
              type="tel"
              placeholder="(99) 99999-9999"
              value={data.callerPhone}
              onChange={(e) => update({ callerPhone: e.target.value })}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Landline checkbox */}
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={data.callerPhoneIsLandline}
            onChange={(e) => update({ callerPhoneIsLandline: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Número fixo
        </label>

        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nome *</label>
            <input
              placeholder="Nome"
              value={data.callerFirstName}
              onChange={(e) => update({ callerFirstName: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Sobrenome</label>
            <input
              placeholder="Sobrenome"
              value={data.callerLastName}
              onChange={(e) => update({ callerLastName: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Category ───────────────────────────────────────────────────────

function StepCategory({
  data,
  update,
  categories,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  categories: CategoryOption[];
}) {
  return (
    <div className="space-y-4">
      {/* Category grid */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {categories.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            Nenhuma categoria disponível para o contrato selecionado.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {categories.map((cat) => {
              const selected = data.categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() =>
                    update({
                      categoryId: cat.id,
                      categoryDescription: cat.description || cat.code,
                    })
                  }
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-colors ${
                    selected
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-gray-50'
                  }`}
                >
                  {cat.iconUrl ? (
                    <img src={cat.iconUrl} alt={cat.description} className="h-16 w-16 object-contain" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                      <AlertTriangle size={24} className="text-gray-400" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-800">
                    {cat.description || cat.code}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Priority */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-gray-700">Prioridade</label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="priority"
              checked={data.priority}
              onChange={() => update({ priority: true })}
              className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Sim
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="priority"
              checked={!data.priority}
              onChange={() => update({ priority: false, priorityReason: '' })}
              className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Não
          </label>
        </div>
        {data.priority && (
          <input
            placeholder="Explique o motivo da prioridade..."
            value={data.priorityReason}
            onChange={(e) => update({ priorityReason: e.target.value })}
            className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Address / Map / Photos ─────────────────────────────────────────

function StepAddress({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  const adapterFactory = useMemo(() => () => new MapLibreAdapter(), []);

  return (
    <MapProvider adapterFactory={adapterFactory}>
      <StepAddressInner data={data} update={update} />
    </MapProvider>
  );
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
}

function StepAddressInner({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  const { isReady, getAdapter } = useMap();
  const { selectedContract } = useContract();
  const markerRef = useRef<unknown>(null);

  // Address autocomplete state
  const [addressQuery, setAddressQuery] = useState(data.address);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressReverseRef = useRef(false);

  // Sync external updates to local query (e.g. from reverse geocoding)
  useEffect(() => {
    setAddressQuery(data.address);
  }, [data.address]);

  // Forward geocoding: search as user types (debounced)
  const searchAddress = useCallback((query: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          format: 'json',
          addressdetails: '1',
          limit: '5',
          countrycodes: 'br',
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { 'Accept-Language': 'pt-BR' },
        });
        const results: NominatimResult[] = await res.json();
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 400);
  }, []);

  const handleAddressInput = useCallback((value: string) => {
    setAddressQuery(value);
    // Typing invalidates any previously resolved coordinates — the user must
    // pick a Nominatim suggestion (or click on the map) to set them again.
    update({ address: value, latitude: null, longitude: null });
    searchAddress(value);
  }, [update, searchAddress]);

  // When user picks a suggestion: update address, neighborhood, coords, center map, move marker
  const handleSelectSuggestion = useCallback((result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const addr = result.address;
    const neighborhood = addr?.suburb || addr?.neighbourhood || addr?.city_district || '';

    suppressReverseRef.current = true;
    update({
      address: result.display_name,
      neighborhood,
      latitude: lat,
      longitude: lng,
    });
    setSuggestions([]);
    setShowSuggestions(false);

    // Move marker and fly to location
    const marker = markerRef.current as { setLngLat: (c: [number, number]) => void } | null;
    if (marker) marker.setLngLat([lng, lat]);

    const adapter = getAdapter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMap = adapter?.getRawMap() as any;
    if (rawMap) {
      rawMap.flyTo({ center: [lng, lat], zoom: 16 });
    }
  }, [update, getAdapter]);

  // Reverse geocoding: coords → address
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (suppressReverseRef.current) {
      suppressReverseRef.current = false;
      return;
    }
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
        addressdetails: '1',
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { 'Accept-Language': 'pt-BR' },
      });
      const result: NominatimResult = await res.json();
      if (result.display_name) {
        const addr = result.address;
        const neighborhood = addr?.suburb || addr?.neighbourhood || addr?.city_district || '';
        update({
          address: result.display_name,
          neighborhood,
        });
      }
    } catch {
      // Silently fail — user can still type manually
    }
  }, [update]);

  // Build layers: geographic-points (MVT) + occurrences for the current contract (GeoJSON)
  const [occurrenceGeoJson, setOccurrenceGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    if (!selectedContract) return;
    serviceOrdersApi
      .getOccurrencesByContractGeoJson(selectedContract.id)
      .then((res) => setOccurrenceGeoJson(res.data))
      .catch(() => {});
  }, [selectedContract]);

  const mapLayers: LayerConfig[] = useMemo(() => {
    const layers: LayerConfig[] = [
      // Geographic points (poles) via MVT — use the unclustered source-layer
      // so every individual point is always clickable at any zoom level
      {
        code: 'geographic-points',
        name: 'Postes',
        geometryType: 'point' as const,
        source: {
          type: 'mvt' as const,
          url: '/api/network-map/spatial/mvt/geographic-points/{z}/{x}/{y}.mvt',
          sourceLayer: 'geographic-points-unclustered',
        },
        style: {
          color: '#22c55e',
          iconSize: 6,
          outlineColor: '#ffffff',
          outlineWidth: 2,
          opacity: 0.95,
        },
        minZoom: 10,
        interactive: true,
        visibleByDefault: true,
        legendEnabled: true,
        zOrder: 20,
        popup: {
          trigger: 'click' as const,
          title: 'Poste {Basement}',
          fields: [
            { property: 'Basement', label: 'Código', format: 'text' as const },
            { property: 'Neighborhood', label: 'Bairro', format: 'text' as const },
            { property: 'Address', label: 'Endereço', format: 'text' as const },
          ],
        },
      },
    ];

    // Occurrences for this contract via GeoJSON (static data fetched from API)
    if (occurrenceGeoJson && occurrenceGeoJson.features.length > 0) {
      layers.push({
        code: 'occurrences',
        name: 'Ocorrências',
        geometryType: 'point' as const,
        source: {
          type: 'geojson-static' as const,
          data: occurrenceGeoJson,
        },
        style: {
          color: '#ef4444',
          iconSize: 8,
          outlineColor: '#ffffff',
          outlineWidth: 2,
          opacity: 0.9,
        },
        interactive: true,
        visibleByDefault: true,
        legendEnabled: true,
        zOrder: 30,
        popup: {
          trigger: 'click' as const,
          title: 'Ocorrência {protocolNumber}',
          fields: [
            { property: 'protocolNumber', label: 'Protocolo', format: 'text' as const },
            { property: 'address', label: 'Endereço', format: 'text' as const },
            { property: 'reportedBy', label: 'Solicitante', format: 'text' as const },
            { property: 'reportedAt', label: 'Data', format: 'datetime' as const },
          ],
        },
      });
    }

    return layers;
  }, [occurrenceGeoJson]);

  // Add a draggable marker once the map is ready, capture clicks
  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMap = adapter.getRawMap() as any;
    if (!rawMap) return;

    // Dynamically import maplibre-gl for the Marker class (it's already loaded by NetworkMap)
    import('maplibre-gl').then((maplibregl) => {
      const MarkerClass = maplibregl.Marker ?? maplibregl.default?.Marker;
      if (!MarkerClass) return;

      const lng = data.longitude ?? -38.5;
      const lat = data.latitude ?? -12.97;

      const marker = new MarkerClass({ draggable: true, color: '#2563eb' })
        .setLngLat([lng, lat])
        .addTo(rawMap);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        update({ latitude: lngLat.lat, longitude: lngLat.lng });
        reverseGeocode(lngLat.lat, lngLat.lng);
      });

      rawMap.on('click', (e: { lngLat: { lng: number; lat: number } }) => {
        marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
        update({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
        reverseGeocode(e.lngLat.lat, e.lngLat.lng);
      });

      markerRef.current = marker;
    });

    return () => {
      if (markerRef.current && typeof (markerRef.current as { remove: () => void }).remove === 'function') {
        (markerRef.current as { remove: () => void }).remove();
      }
    };
  }, [isReady]);

  const addFiles = useCallback((files: File[]) => {
    const validFiles = files.filter(
      (f) => f.size <= 5 * 1024 * 1024 && /\.(jpe?g|png|pdf)$/i.test(f.name)
    );
    if (validFiles.length === 0) return;
    update({ pictureFiles: [...data.pictureFiles, ...validFiles] });

    validFiles.forEach((f) => {
      if (f.type.startsWith('image/')) {
        const url = URL.createObjectURL(f);
        setPreviews((prev) => [...prev, url]);
      }
    });
  }, [data.pictureFiles, update]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const removeFile = (index: number) => {
    const newFiles = [...data.pictureFiles];
    newFiles.splice(index, 1);
    update({ pictureFiles: newFiles });

    setPreviews((prev) => {
      const next = [...prev];
      if (next[index]) URL.revokeObjectURL(next[index]);
      next.splice(index, 1);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Map — full width, larger area */}
      <div className="h-[400px] w-full overflow-hidden rounded-lg border border-gray-300">
        <NetworkMap
          center={[data.longitude ?? -38.5, data.latitude ?? -12.97]}
          zoom={13}
          layers={mapLayers}
          showLayerPanel={false}
          showBaseLayerSwitcher={false}
          showCoordinates={false}
          showScale={false}
          className="h-full w-full"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left: address fields */}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Endereço da Ocorrência *
            </label>
            <div className="relative">
              <div className="flex items-center gap-2">
                <input
                  placeholder="Digite o endereço da ocorrência..."
                  value={addressQuery}
                  onChange={(e) => handleAddressInput(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
                <MapPin size={18} className="text-primary-500" />
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {suggestions.map((s) => (
                    <li key={s.place_id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectSuggestion(s)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-primary-50"
                      >
                        {s.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Bairro/Povoado/Distrito
            </label>
            <input
              placeholder="Digite Bairro/Povoado/Distrito da Ocorrência"
              value={data.neighborhood}
              onChange={(e) => update({ neighborhood: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Ponto de Referência
            </label>
            <input
              placeholder="Digite um ponto de referência..."
              value={data.referencePoint}
              onChange={(e) => update({ referencePoint: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Right: additional info + photos */}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Informações Adicionais
            </label>
            <textarea
              placeholder="E.x: A lâmpada com problema fica próxima praça ou a uma escola..."
              value={data.additionalInfo}
              onChange={(e) => update({ additionalInfo: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Photo upload */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Anexar Fotos</label>
            <label
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors hover:border-primary-400 hover:bg-primary-50"
            >
              <Upload size={24} className="text-gray-400" />
              <span className="text-sm text-gray-500">
                Clique ou arraste os arquivos aqui para fazer upload de fotos
              </span>
              <span className="text-xs text-gray-400">
                Tamanho máximo por arquivo: 5MB - Tipos permitidos: JPG, PNG, PDF
              </span>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {/* Preview */}
            {data.pictureFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {data.pictureFiles.map((f, i) => (
                  <div key={i} className="group relative">
                    {previews[i] ? (
                      <img
                        src={previews[i]}
                        alt={f.name}
                        className="h-16 w-16 rounded-md border border-gray-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-md border border-gray-200 bg-gray-100 text-xs text-gray-500">
                        PDF
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute -right-1 -top-1 hidden rounded-full bg-red-500 p-0.5 text-white group-hover:block"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Confirmation ───────────────────────────────────────────────────

function StepConfirmation({
  occurrence,
  onContinue,
}: {
  occurrence: CreatedOccurrence;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">

      {/* Summary */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <AlertTriangle size={16} className="text-primary-600" />
            <span className="font-semibold">{occurrence.categoryDescription}</span>
          </div>
          {occurrence.address && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={16} className="text-primary-500" />
              <span>{occurrence.address}</span>
            </div>
          )}
          {occurrence.referencePoint && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-xs text-primary-600">
                i
              </span>
              <span>{occurrence.referencePoint}</span>
            </div>
          )}
          {occurrence.additionalInfo && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-xs text-primary-600">
                i
              </span>
              <span>{occurrence.additionalInfo}</span>
            </div>
          )}
        </div>
      </div>

      {/* Protocol number */}
      <div className="rounded-lg border-2 border-primary-200 bg-primary-50 p-6 text-center">
        <p className="text-sm text-gray-600">
          Ocorrência <span className="font-semibold text-green-600">criada com sucesso!</span>
        </p>
        <p className="mt-2 text-4xl font-bold text-primary-700">{occurrence.protocolNumber}</p>
        <p className="mt-3 text-sm text-gray-600">
          Se você deseja{' '}
          <button onClick={onContinue} className="font-medium text-primary-600 underline">
            criar outra ocorrência
          </button>{' '}
          para o mesmo cidadão, <span className="font-semibold">pode continuar</span>, caso
          contrário, você deve fechar esta janela de criação:
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button onClick={onContinue}>Continuar</Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          <X size={16} /> Fechar
        </Button>
      </div>
    </div>
  );
}
