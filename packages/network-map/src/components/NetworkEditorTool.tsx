import { useState, useCallback, useEffect, useRef } from 'react';
import {
  MapPin,
  Move,
  Trash2,
  Cable,
  X,
  Plus,
  Save,
  Loader2,
  Edit3,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useMap } from '../context/MapContext';
import { topoNetworkApi } from '@fsa/shared-api';
import type { GeographicPointType, PointRequest, WireRequest } from '@fsa/shared-api';
import { useEditorHistory } from '../hooks/useEditorHistory';

// ─── Field configuration types ──────────────────────────────────

export interface FieldConfig {
  visible?: boolean;
  required?: boolean;
  label?: string;
}

export interface PointFieldsConfig {
  geographicPointTypeId?: FieldConfig;
  basement?: FieldConfig;
  ownerId?: FieldConfig;
  materialId?: FieldConfig;
  heightId?: FieldConfig;
  effortId?: FieldConfig;
  municipalityId?: FieldConfig;
  zone?: FieldConfig;
  address?: FieldConfig;
  neighborhood?: FieldConfig;
}

export interface WireFieldsConfig {
  wireOfLine?: FieldConfig;
  feederId?: FieldConfig;
  transformerParentId?: FieldConfig;
}

// ─── Component props ────────────────────────────────────────────

type EditorMode = 'none' | 'add-point' | 'move-point' | 'delete-point' | 'add-wire' | 'edit-wire' | 'delete-wire';
type WireType = 'mt' | 'lt';

interface NetworkEditorToolProps {
  position?: 'top-left' | 'top-right';
  style?: React.CSSProperties;
  /** Configurable visibility / required for point fields */
  pointFields?: PointFieldsConfig;
  /** Configurable visibility / required for wire fields */
  wireFields?: WireFieldsConfig;
  /** Callback after any change so the parent can refresh map layers */
  onDataChanged?: () => void;
  /** Layer codes to query for existing points when selecting start/end */
  pointLayerCodes?: string[];
  /** Source IDs to refresh (cache-bust) after data mutations */
  refreshSourceIds?: string[];
  /** Wire layer codes to query for existing wires when editing/deleting */
  wireLayerCodes?: string[];
}

// ─── Constants ──────────────────────────────────────────────────

const EDITOR_SOURCE = '__net-editor';
const EDITOR_POINTS_LAYER = '__net-editor-points';
const EDITOR_LINES_LAYER = '__net-editor-lines';

const DEFAULT_POINT_FIELDS: PointFieldsConfig = {
  geographicPointTypeId: { visible: true, required: true, label: 'Point Type' },
  basement: { visible: true, required: false, label: 'Basement' },
  ownerId: { visible: false, required: false, label: 'Owner' },
  materialId: { visible: false, required: false, label: 'Material' },
  heightId: { visible: false, required: false, label: 'Height' },
  effortId: { visible: false, required: false, label: 'Effort' },
  municipalityId: { visible: false, required: false, label: 'Municipality' },
  zone: { visible: true, required: false, label: 'Zone' },
  address: { visible: true, required: false, label: 'Address' },
  neighborhood: { visible: true, required: false, label: 'Neighborhood' },
};

const DEFAULT_WIRE_FIELDS: WireFieldsConfig = {
  wireOfLine: { visible: true, required: false, label: 'Wire of Line' },
  feederId: { visible: false, required: false, label: 'Feeder' },
  transformerParentId: { visible: false, required: false, label: 'Transformer Parent' },
};

// ─── Helper: merge field configs ────────────────────────────────

function mergeFields<T extends object>(
  defaults: T,
  overrides?: Partial<T>,
): T {
  if (!overrides) return defaults;
  const result = { ...defaults };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    if (overrides[key]) {
      (result as Record<string, unknown>)[key as string] = {
        ...(defaults[key as keyof T] as object),
        ...(overrides[key] as object),
      };
    }
  }
  return result;
}

// ─── Component ──────────────────────────────────────────────────

export default function NetworkEditorTool({
  position = 'top-right',
  style,
  pointFields: pointFieldsOverride,
  wireFields: wireFieldsOverride,
  onDataChanged,
  pointLayerCodes,
  refreshSourceIds,
  wireLayerCodes,
}: NetworkEditorToolProps) {
  const { getAdapter, isReady, invalidateLayer } = useMap();

  const pointFields = mergeFields(DEFAULT_POINT_FIELDS, pointFieldsOverride);
  const wireFields = mergeFields(DEFAULT_WIRE_FIELDS, wireFieldsOverride);

  // ── Editor history (undo/redo) ──
  // refreshMapSources is defined further down; we use a ref to break the circular dependency.
  const refreshAfterHistoryRef = useRef<() => void>(() => {});
  const history = useEditorHistory(() => {
    refreshAfterHistoryRef.current();
    onDataChangedRef.current?.();
  });

  const [mode, setMode] = useState<EditorMode>('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Point types from backend
  const [pointTypes, setPointTypes] = useState<GeographicPointType[]>([]);
  const [typesLoaded, setTypesLoaded] = useState(false);

  // ── Point add form state ──
  const [pendingCoord, setPendingCoord] = useState<[number, number] | null>(null);
  const [pointForm, setPointForm] = useState<Partial<PointRequest>>({});

  // ── Wire state (add-wire) ──
  const [wireType, setWireType] = useState<WireType>('mt');
  const [wireStartPointId, setWireStartPointId] = useState<number | null>(null);
  const [wireEndPointId, setWireEndPointId] = useState<number | null>(null);
  const [wireForm, setWireForm] = useState<Partial<WireRequest>>({});

  // ── Drag-move state (move-point) ──
  const draggingRef = useRef(false);
  const dragPointIdRef = useRef<number | null>(null);
  const dragCoordRef = useRef<[number, number] | null>(null);
  const dragOldCoordRef = useRef<[number, number] | null>(null); // original position for undo
  const [dragPreview, setDragPreview] = useState<[number, number] | null>(null);

  // ── Wire drag state (add-wire & edit-wire) ──
  const wireDraggingRef = useRef(false);
  const wireDragStartPointIdRef = useRef<number | null>(null);
  const wireDragStartCoordRef = useRef<[number, number] | null>(null);
  // For edit-wire: the wire being edited and which endpoint
  const wireDragEditInfoRef = useRef<{ wireId: number; wireType: WireType; endpoint: 'start' | 'end' } | null>(null);
  const [wireDragLine, setWireDragLine] = useState<{ start: [number, number]; end: [number, number] } | null>(null);

  const onDataChangedRef = useRef(onDataChanged);
  onDataChangedRef.current = onDataChanged;
  const refreshSourceIdsRef = useRef(refreshSourceIds);
  refreshSourceIdsRef.current = refreshSourceIds;

  const posClass = position === 'top-left' ? 'left-4' : 'right-4';

  // ─── Fetch point types ───────────────────────────────────────

  useEffect(() => {
    if (typesLoaded) return;
    let cancelled = false;
    topoNetworkApi
      .getGeographicPointTypes()
      .then((res) => {
        if (!cancelled) {
          setPointTypes(res.data);
          setTypesLoaded(true);
        }
      })
      .catch(() => {
        // Silently fail — types dropdown will be empty
      });
    return () => { cancelled = true; };
  }, [typesLoaded]);

  // ─── Editor overlay source/layers ────────────────────────────

  const sourceAdded = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter || sourceAdded.current) return;

    adapter.addGeoJSONSource(EDITOR_SOURCE, { type: 'FeatureCollection', features: [] });
    adapter.addLayer({
      id: EDITOR_LINES_LAYER,
      type: 'line',
      source: EDITOR_SOURCE,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': [
          'match', ['get', '_wireType'],
          'mt', '#ef4444',
          'lt', '#f97316',
          '#6366f1',
        ],
        'line-width': [
          'match', ['get', '_wireType'],
          'mt', 3,
          'lt', 2,
          3,
        ],
        'line-dasharray': [3, 2],
      },
    });
    adapter.addLayer({
      id: EDITOR_POINTS_LAYER,
      type: 'circle',
      source: EDITOR_SOURCE,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 7,
        'circle-color': '#6366f1',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });
    sourceAdded.current = true;

    return () => {
      try {
        adapter.removeLayer(EDITOR_POINTS_LAYER);
        adapter.removeLayer(EDITOR_LINES_LAYER);
        adapter.removeSource(EDITOR_SOURCE);
      } catch { /* ignore */ }
      sourceAdded.current = false;
    };
  }, [isReady, getAdapter]);

  // ─── Update overlay geometry ─────────────────────────────────

  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter || !sourceAdded.current) return;

    const features: GeoJSON.Feature[] = [];

    // Show pending point (add-point mode)
    if (pendingCoord && mode === 'add-point') {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pendingCoord },
        properties: { _type: 'pending-point' },
      });
    }

    // Show drag preview (move-point mode)
    if (dragPreview) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: dragPreview },
        properties: { _type: 'drag-preview' },
      });
    }

    // Show wire drag preview line
    if (wireDragLine) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [wireDragLine.start, wireDragLine.end],
        },
        properties: { _type: 'wire-preview', _wireType: wireType },
      });
    }

    adapter.updateGeoJSONSource(EDITOR_SOURCE, { type: 'FeatureCollection', features });
  }, [isReady, getAdapter, pendingCoord, mode, wireType, dragPreview, wireDragLine]);

  // ─── Helper: query point features at a screen location ────────

  const queryPointFeatureId = useCallback((adapter: NonNullable<ReturnType<typeof getAdapter>>, point: { x: number; y: number }): number | null => {
    const layerIds = (pointLayerCodes ?? ['geographic-points']).flatMap((code) => [
      code,
      `${code}-unclustered`,
    ]);
    const hits = adapter.queryRenderedFeatures(point, layerIds) as {
      properties: Record<string, unknown>;
    }[];
    if (hits.length === 0) return null;
    return (hits[0].properties.feature_id as number | undefined) ?? (hits[0].properties.id as number | undefined) ?? null;
  }, [pointLayerCodes]);

  // ─── Helper: query point coordinates at a screen location ─────

  const queryPointCoord = useCallback((adapter: NonNullable<ReturnType<typeof getAdapter>>, point: { x: number; y: number }): [number, number] | null => {
    const layerIds = (pointLayerCodes ?? ['geographic-points']).flatMap((code) => [
      code,
      `${code}-unclustered`,
    ]);
    const hits = adapter.queryRenderedFeatures(point, layerIds) as {
      geometry?: { coordinates?: [number, number] };
      properties: Record<string, unknown>;
    }[];
    if (hits.length === 0) return null;
    // Try to get coordinates from the feature geometry
    if (hits[0].geometry?.coordinates) return hits[0].geometry.coordinates;
    // Fallback: use properties if they have lng/lat
    const lng = hits[0].properties.lng as number | undefined;
    const lat = hits[0].properties.lat as number | undefined;
    if (lng != null && lat != null) return [lng, lat];
    return null;
  }, [pointLayerCodes]);

  // ─── Helper: query wire features at a screen location ────────

  const queryWireFeature = useCallback((adapter: NonNullable<ReturnType<typeof getAdapter>>, point: { x: number; y: number }): { id: number; type: WireType } | null => {
    const layers = wireLayerCodes ?? ['mt-wires', 'lt-wires'];
    const hits = adapter.queryRenderedFeatures(point, layers) as {
      properties: Record<string, unknown>;
      layer?: { id?: string };
    }[];
    if (hits.length === 0) return null;
    const wireId = (hits[0].properties.feature_id as number | undefined) ?? (hits[0].properties.id as number | undefined) ?? null;
    if (!wireId) return null;
    const layerId = (hits[0].layer?.id as string | undefined) ?? '';
    const type: WireType = layerId.includes('lt') ? 'lt' : 'mt';
    return { id: wireId, type };
  }, [wireLayerCodes]);

  // ─── Helper: query wire feature with geometry info for endpoint detection ──

  const queryWireEndpoint = useCallback((adapter: NonNullable<ReturnType<typeof getAdapter>>, point: { x: number; y: number }): {
    wireId: number; wireType: WireType; endpoint: 'start' | 'end'; anchorCoord: [number, number];
  } | null => {
    const layers = wireLayerCodes ?? ['mt-wires', 'lt-wires'];
    const hits = adapter.queryRenderedFeatures(point, layers) as {
      geometry?: { coordinates?: [number, number][] };
      properties: Record<string, unknown>;
      layer?: { id?: string };
    }[];
    if (hits.length === 0) return null;
    const wireId = (hits[0].properties.feature_id as number | undefined) ?? (hits[0].properties.id as number | undefined) ?? null;
    if (!wireId) return null;
    const layerId = (hits[0].layer?.id as string | undefined) ?? '';
    const wType: WireType = layerId.includes('lt') ? 'lt' : 'mt';

    // Determine which endpoint is closer to click
    const coords = hits[0].geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const startCoord = coords[0];
    const endCoord = coords[coords.length - 1];
    const clickLng = point.x; // screen coords
    const clickLat = point.y;

    // Project both endpoints to screen to compare
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMap = adapter.getRawMap() as any;
    if (!rawMap?.project) return null;
    const startScreen = rawMap.project(startCoord);
    const endScreen = rawMap.project(endCoord);
    const dStart = Math.hypot(startScreen.x - clickLng, startScreen.y - clickLat);
    const dEnd = Math.hypot(endScreen.x - clickLng, endScreen.y - clickLat);

    const endpoint = dStart <= dEnd ? 'start' : 'end';
    const anchorCoord: [number, number] = endpoint === 'start' ? [endCoord[0], endCoord[1]] : [startCoord[0], startCoord[1]];
    return { wireId, wireType: wType, endpoint, anchorCoord };
  }, [wireLayerCodes]);

  // ─── Map click handlers (add-point, delete-point, delete-wire) ──

  useEffect(() => {
    if (!isReady || mode === 'none' || mode === 'move-point' || mode === 'add-wire' || mode === 'edit-wire') return;
    const adapter = getAdapter();
    if (!adapter) return;

    const handleClick = (e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => {
      if (mode === 'add-point') {
        setPendingCoord([e.lngLat.lng, e.lngLat.lat]);
      }

      if (mode === 'delete-point') {
        const featureId = queryPointFeatureId(adapter, e.point);
        if (featureId) handleDeletePoint(featureId);
      }

      if (mode === 'delete-wire') {
        const wire = queryWireFeature(adapter, e.point);
        if (wire) {
          handleDeleteWire(wire.id, wire.type);
        }
      }
    };

    adapter.on('click', handleClick);
    return () => adapter.off('click', handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, getAdapter, mode, queryPointFeatureId, queryWireFeature]);

  // ─── Drag-and-drop handler for move-point ─────────────────────

  useEffect(() => {
    if (!isReady || mode !== 'move-point') return;
    const adapter = getAdapter();
    if (!adapter) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMap = adapter.getRawMap() as any;
    if (!rawMap) return;

    const handleMouseDown = (e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number }; originalEvent: MouseEvent }) => {
      const featureId = queryPointFeatureId(adapter, e.point);
      if (!featureId) return;

      e.originalEvent.preventDefault();
      rawMap.dragPan?.disable();

      draggingRef.current = true;
      dragPointIdRef.current = featureId;
      dragCoordRef.current = [e.lngLat.lng, e.lngLat.lat];
      dragOldCoordRef.current = [e.lngLat.lng, e.lngLat.lat]; // capture original position for undo
      setDragPreview([e.lngLat.lng, e.lngLat.lat]);
      adapter.setCursor('grabbing');
    };

    const handleMouseMove = (e: { lngLat: { lng: number; lat: number } }) => {
      if (!draggingRef.current) return;
      dragCoordRef.current = [e.lngLat.lng, e.lngLat.lat];
      setDragPreview([e.lngLat.lng, e.lngLat.lat]);
    };

    const handleMouseUp = () => {
      if (!draggingRef.current || !dragPointIdRef.current || !dragCoordRef.current) {
        rawMap.dragPan?.enable();
        return;
      }

      const id = dragPointIdRef.current;
      const [lng, lat] = dragCoordRef.current;

      draggingRef.current = false;
      dragPointIdRef.current = null;
      dragCoordRef.current = null;
      setDragPreview(null);

      rawMap.dragPan?.enable();
      adapter.setCursor('');

      handleMovePoint(id, lng, lat);
    };

    adapter.on('mousedown', handleMouseDown);
    adapter.on('mousemove', handleMouseMove);
    adapter.on('mouseup', handleMouseUp);

    adapter.setCursor('grab');

    return () => {
      adapter.off('mousedown', handleMouseDown);
      adapter.off('mousemove', handleMouseMove);
      adapter.off('mouseup', handleMouseUp);
      adapter.setCursor('');
      rawMap.dragPan?.enable();
      draggingRef.current = false;
      dragPointIdRef.current = null;
      dragCoordRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, getAdapter, mode, queryPointFeatureId]);

  // ─── Drag-and-drop handler for add-wire ───────────────────────
  // Mousedown on a point starts a wire drag. Mousemove shows a preview
  // line. Mouseup on a different point sets both endpoints.

  useEffect(() => {
    if (!isReady || mode !== 'add-wire') return;
    const adapter = getAdapter();
    if (!adapter) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMap = adapter.getRawMap() as any;
    if (!rawMap) return;

    const handleMouseDown = (e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number }; originalEvent: MouseEvent }) => {
      // Only start if we haven't already captured endpoints
      if (wireStartPointId && wireEndPointId) return;

      const featureId = queryPointFeatureId(adapter, e.point);
      if (!featureId) return;

      const coord = queryPointCoord(adapter, e.point) ?? [e.lngLat.lng, e.lngLat.lat];

      e.originalEvent.preventDefault();
      rawMap.dragPan?.disable();

      wireDraggingRef.current = true;
      wireDragStartPointIdRef.current = featureId;
      wireDragStartCoordRef.current = coord;
      setWireDragLine({ start: coord, end: coord });
      adapter.setCursor('crosshair');
    };

    const handleMouseMove = (e: { lngLat: { lng: number; lat: number } }) => {
      if (!wireDraggingRef.current || !wireDragStartCoordRef.current) return;
      const cursor: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setWireDragLine({ start: wireDragStartCoordRef.current, end: cursor });
    };

    const handleMouseUp = (e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => {
      if (!wireDraggingRef.current || !wireDragStartPointIdRef.current) {
        rawMap.dragPan?.enable();
        return;
      }

      const startId = wireDragStartPointIdRef.current;

      wireDraggingRef.current = false;
      wireDragStartCoordRef.current = null;
      setWireDragLine(null);
      rawMap.dragPan?.enable();
      adapter.setCursor('crosshair');

      // Check if we landed on a different point
      const endId = queryPointFeatureId(adapter, e.point);
      if (endId && endId !== startId) {
        setWireStartPointId(startId);
        setWireEndPointId(endId);
      }
      wireDragStartPointIdRef.current = null;
    };

    adapter.on('mousedown', handleMouseDown);
    adapter.on('mousemove', handleMouseMove);
    adapter.on('mouseup', handleMouseUp);

    adapter.setCursor('crosshair');

    return () => {
      adapter.off('mousedown', handleMouseDown);
      adapter.off('mousemove', handleMouseMove);
      adapter.off('mouseup', handleMouseUp);
      adapter.setCursor('');
      rawMap.dragPan?.enable();
      wireDraggingRef.current = false;
      wireDragStartPointIdRef.current = null;
      wireDragStartCoordRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, getAdapter, mode, wireStartPointId, wireEndPointId, queryPointFeatureId, queryPointCoord]);

  // ─── Drag-and-drop handler for edit-wire ──────────────────────
  // Mousedown near a wire endpoint starts drag. Mouseup on a point
  // reassigns that endpoint immediately.

  useEffect(() => {
    if (!isReady || mode !== 'edit-wire') return;
    const adapter = getAdapter();
    if (!adapter) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMap = adapter.getRawMap() as any;
    if (!rawMap) return;

    const handleMouseDown = (e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number }; originalEvent: MouseEvent }) => {
      const info = queryWireEndpoint(adapter, e.point);
      if (!info) return;

      e.originalEvent.preventDefault();
      rawMap.dragPan?.disable();

      wireDraggingRef.current = true;
      wireDragEditInfoRef.current = { wireId: info.wireId, wireType: info.wireType, endpoint: info.endpoint };
      wireDragStartCoordRef.current = info.anchorCoord;
      setWireDragLine({ start: info.anchorCoord, end: [e.lngLat.lng, e.lngLat.lat] });
      adapter.setCursor('grabbing');
    };

    const handleMouseMove = (e: { lngLat: { lng: number; lat: number } }) => {
      if (!wireDraggingRef.current || !wireDragStartCoordRef.current) return;
      setWireDragLine({ start: wireDragStartCoordRef.current, end: [e.lngLat.lng, e.lngLat.lat] });
    };

    const handleMouseUp = (e: { point: { x: number; y: number } }) => {
      if (!wireDraggingRef.current || !wireDragEditInfoRef.current) {
        rawMap.dragPan?.enable();
        return;
      }

      const info = wireDragEditInfoRef.current;

      wireDraggingRef.current = false;
      wireDragEditInfoRef.current = null;
      wireDragStartCoordRef.current = null;
      setWireDragLine(null);
      rawMap.dragPan?.enable();
      adapter.setCursor('grab');

      // Check if we dropped on a point
      const newPointId = queryPointFeatureId(adapter, e.point);
      if (newPointId) {
        handleEditWireDrop(info.wireId, info.wireType, info.endpoint, newPointId);
      }
    };

    adapter.on('mousedown', handleMouseDown);
    adapter.on('mousemove', handleMouseMove);
    adapter.on('mouseup', handleMouseUp);

    adapter.setCursor('grab');

    return () => {
      adapter.off('mousedown', handleMouseDown);
      adapter.off('mousemove', handleMouseMove);
      adapter.off('mouseup', handleMouseUp);
      adapter.setCursor('');
      rawMap.dragPan?.enable();
      wireDraggingRef.current = false;
      wireDragEditInfoRef.current = null;
      wireDragStartCoordRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, getAdapter, mode, queryPointFeatureId, queryWireEndpoint]);

  // ─── API handlers ────────────────────────────────────────────

  // ─── Helper: refresh map sources after data mutation ────────

  const refreshMapSources = useCallback(() => {
    const adapter = getAdapter();
    if (!adapter) return;
    const ids = refreshSourceIdsRef.current ?? ['geographic-points'];
    for (const id of ids) {
      try { adapter.refreshSource(id); } catch { /* ignore */ }
      // Also invalidate the layer in the data fetcher so GeoJSON sources re-fetch
      try { invalidateLayer(id); } catch { /* ignore */ }
    }
  }, [getAdapter, invalidateLayer]);

  // Wire the history callback to refreshMapSources (breaks circular dep)
  refreshAfterHistoryRef.current = refreshMapSources;

  const handleSavePoint = useCallback(async () => {
    if (!pendingCoord) return;
    setLoading(true);
    setError(null);
    try {
      const data: PointRequest = {
        lng: pendingCoord[0],
        lat: pendingCoord[1],
        ...pointForm,
      };
      const res = await topoNetworkApi.createGeographicPoint(data);
      const createdId = (res.data as Record<string, unknown>).id as number;
      history.push({ type: 'create-point', createdId, requestData: data });
      setPendingCoord(null);
      setPointForm({});
      refreshMapSources();
      onDataChangedRef.current?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create point');
    } finally {
      setLoading(false);
    }
  }, [pendingCoord, pointForm, refreshMapSources, history]);

  const handleDeletePoint = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch snapshot before deleting (needed for undo)
      const snapRes = await topoNetworkApi.getGeographicPoint(id);
      const snapshot = snapRes.data as Record<string, unknown>;
      await topoNetworkApi.deleteGeographicPoint(id);
      history.push({ type: 'delete-point', deletedId: id, snapshot });
      refreshMapSources();
      onDataChangedRef.current?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete point');
    } finally {
      setLoading(false);
    }
  }, [refreshMapSources, history]);

  const handleMovePoint = useCallback(async (id: number, lng: number, lat: number) => {
    setLoading(true);
    setError(null);
    try {
      // Capture old coords from the drag start ref
      const oldCoord = dragOldCoordRef.current;
      await topoNetworkApi.updateGeographicPoint(id, { lng, lat });
      if (oldCoord) {
        history.push({
          type: 'move-point',
          pointId: id,
          oldLng: oldCoord[0],
          oldLat: oldCoord[1],
          newLng: lng,
          newLat: lat,
        });
      }
      dragOldCoordRef.current = null;
      refreshMapSources();
      onDataChangedRef.current?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to move point');
    } finally {
      setLoading(false);
    }
  }, [refreshMapSources, history]);

  const handleSaveWire = useCallback(async () => {
    if (!wireStartPointId || !wireEndPointId) return;
    setLoading(true);
    setError(null);
    try {
      const data: WireRequest = {
        geographicPointStartId: wireStartPointId,
        geographicPointEndId: wireEndPointId,
        ...wireForm,
      };
      let createdId: number;
      if (wireType === 'mt') {
        const res = await topoNetworkApi.createMTWire(data);
        createdId = (res.data as Record<string, unknown>).id as number;
      } else {
        const res = await topoNetworkApi.createLTWire(data);
        createdId = (res.data as Record<string, unknown>).id as number;
      }
      history.push({ type: 'create-wire', wireType, createdId, requestData: data });
      setWireStartPointId(null);
      setWireEndPointId(null);
      setPendingCoord(null);
      setWireForm({});
      refreshMapSources();
      onDataChangedRef.current?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create wire');
    } finally {
      setLoading(false);
    }
  }, [wireStartPointId, wireEndPointId, wireType, wireForm, refreshMapSources, history]);

  const handleDeleteWire = useCallback(async (id: number, type: WireType) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch snapshot before deleting (needed for undo)
      let snapshot: Record<string, unknown>;
      if (type === 'mt') {
        const snapRes = await topoNetworkApi.getMTWire(id);
        snapshot = snapRes.data as Record<string, unknown>;
        await topoNetworkApi.deleteMTWire(id);
      } else {
        const snapRes = await topoNetworkApi.getLTWire(id);
        snapshot = snapRes.data as Record<string, unknown>;
        await topoNetworkApi.deleteLTWire(id);
      }
      history.push({ type: 'delete-wire', wireType: type, deletedId: id, snapshot });
      refreshMapSources();
      onDataChangedRef.current?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete wire');
    } finally {
      setLoading(false);
    }
  }, [refreshMapSources, history]);

  const handleEditWireDrop = useCallback(async (wireId: number, wType: WireType, endpoint: 'start' | 'end', newPointId: number) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch the wire to get the old endpoint point ID before updating
      let oldPointId: number;
      if (wType === 'mt') {
        const snapRes = await topoNetworkApi.getMTWire(wireId);
        const snap = snapRes.data as Record<string, unknown>;
        oldPointId = (endpoint === 'start' ? snap.geographicPointStartId : snap.geographicPointEndId) as number;
      } else {
        const snapRes = await topoNetworkApi.getLTWire(wireId);
        const snap = snapRes.data as Record<string, unknown>;
        oldPointId = (endpoint === 'start' ? snap.geographicPointStartId : snap.geographicPointEndId) as number;
      }
      const payload: Partial<WireRequest> = endpoint === 'start'
        ? { geographicPointStartId: newPointId }
        : { geographicPointEndId: newPointId };
      if (wType === 'mt') {
        await topoNetworkApi.updateMTWire(wireId, payload);
      } else {
        await topoNetworkApi.updateLTWire(wireId, payload);
      }
      history.push({ type: 'edit-wire', wireType: wType, wireId, endpoint, oldPointId, newPointId });
      refreshMapSources();
      onDataChangedRef.current?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update wire');
    } finally {
      setLoading(false);
    }
  }, [refreshMapSources, history]);

  const cancel = useCallback(() => {
    setMode('none');
    setPendingCoord(null);
    setPointForm({});
    setWireStartPointId(null);
    setWireEndPointId(null);
    setWireForm({});
    setDragPreview(null);
    setWireDragLine(null);
    setError(null);
  }, []);

  const startMode = useCallback((m: EditorMode) => {
    cancel();
    setMode(m);
  }, [cancel]);

  // ── Undo / Redo handlers ──

  const handleUndo = useCallback(async () => {
    if (!history.canUndo || history.busy) return;
    setLoading(true);
    setError(null);
    try {
      const ok = await history.undo();
      if (!ok) setError('Undo failed');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Undo failed');
    } finally {
      setLoading(false);
    }
  }, [history]);

  const handleRedo = useCallback(async () => {
    if (!history.canRedo || history.busy) return;
    setLoading(true);
    setError(null);
    try {
      const ok = await history.redo();
      if (!ok) setError('Redo failed');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Redo failed');
    } finally {
      setLoading(false);
    }
  }, [history]);

  // ─── Field helper: render a configurable field ───────────────

  function renderField(
    key: string,
    config: FieldConfig | undefined,
    value: unknown,
    onChange: (val: string) => void,
    type: 'text' | 'number' | 'select' = 'text',
    options?: { value: string | number; label: string }[],
  ) {
    if (!config?.visible) return null;
    const label = config.label ?? key;
    const required = config.required ?? false;

    return (
      <div key={key} className="flex flex-col gap-0.5">
        <label className="text-xs text-gray-600">
          {label}{required && <span className="text-red-500"> *</span>}
        </label>
        {type === 'select' && options ? (
          <select
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
            required={required}
          >
            <option value="">-- Select --</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
            required={required}
          />
        )}
      </div>
    );
  }

  // ─── Validation ──────────────────────────────────────────────

  function isPointFormValid(): boolean {
    for (const [key, config] of Object.entries(pointFields)) {
      if (config?.visible && config?.required) {
        const val = pointForm[key as keyof PointRequest];
        if (val === undefined || val === null || val === '') return false;
      }
    }
    return true;
  }

  function isWireFormValid(): boolean {
    if (!wireStartPointId || !wireEndPointId) return false;
    for (const [key, config] of Object.entries(wireFields)) {
      if (config?.visible && config?.required) {
        const val = wireForm[key as keyof WireRequest];
        if (val === undefined || val === null || val === '') return false;
      }
    }
    return true;
  }

  // ─── Render: active mode panel ───────────────────────────────

  if (mode !== 'none') {
    return (
      <div className={`absolute ${posClass} z-10`} style={style}>
        <div className="w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">
              {mode === 'add-point' && 'Add Point'}
              {mode === 'move-point' && 'Move Point'}
              {mode === 'delete-point' && 'Delete Point'}
              {mode === 'add-wire' && 'Add Wire'}
              {mode === 'edit-wire' && 'Edit Wire'}
              {mode === 'delete-wire' && 'Delete Wire'}
            </span>
            <button onClick={cancel} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>

          {error && (
            <div className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* ── Add Point ── */}
          {mode === 'add-point' && !pendingCoord && (
            <p className="text-xs text-gray-500">Click on the map to place a point.</p>
          )}

          {mode === 'add-point' && pendingCoord && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500">
                Location: {pendingCoord[1].toFixed(6)}, {pendingCoord[0].toFixed(6)}
              </p>

              {renderField(
                'geographicPointTypeId',
                pointFields.geographicPointTypeId,
                pointForm.geographicPointTypeId,
                (v) => setPointForm((prev: Partial<PointRequest>) => ({ ...prev, geographicPointTypeId: v ? Number(v) : null })),
                'select',
                pointTypes.map((t) => ({ value: t.id, label: t.description ?? t.code })),
              )}
              {renderField(
                'basement',
                pointFields.basement,
                pointForm.basement,
                (v) => setPointForm((prev: Partial<PointRequest>) => ({ ...prev, basement: v || null })),
              )}
              {renderField(
                'ownerId',
                pointFields.ownerId,
                pointForm.ownerId,
                (v) => setPointForm((prev: Partial<PointRequest>) => ({ ...prev, ownerId: v ? Number(v) : null })),
                'number',
              )}
              {renderField(
                'materialId',
                pointFields.materialId,
                pointForm.materialId,
                (v) => setPointForm((prev: Partial<PointRequest>) => ({ ...prev, materialId: v ? Number(v) : null })),
                'number',
              )}
              {renderField(
                'heightId',
                pointFields.heightId,
                pointForm.heightId,
                (v) => setPointForm((prev: Partial<PointRequest>) => ({ ...prev, heightId: v ? Number(v) : null })),
                'number',
              )}
              {renderField(
                'effortId',
                pointFields.effortId,
                pointForm.effortId,
                (v) => setPointForm((prev: Partial<PointRequest>) => ({ ...prev, effortId: v ? Number(v) : null })),
                'number',
              )}
              {renderField(
                'municipalityId',
                pointFields.municipalityId,
                pointForm.municipalityId,
                (v) => setPointForm((prev: Partial<PointRequest>) => ({ ...prev, municipalityId: v ? Number(v) : null })),
                'number',
              )}
              {renderField(
                'zone',
                pointFields.zone,
                pointForm.zone,
                (v) => setPointForm((prev: Partial<PointRequest>) => ({ ...prev, zone: v || null })),
              )}
              {renderField(
                'address',
                pointFields.address,
                pointForm.address,
                (v) => setPointForm((prev: Partial<PointRequest>) => ({ ...prev, address: v || null })),
              )}
              {renderField(
                'neighborhood',
                pointFields.neighborhood,
                pointForm.neighborhood,
                (v) => setPointForm((prev: Partial<PointRequest>) => ({ ...prev, neighborhood: v || null })),
              )}

              <div className="flex gap-1 pt-1">
                <button
                  onClick={() => setPendingCoord(null)}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePoint}
                  disabled={loading || !isPointFormValid()}
                  className="flex flex-1 items-center justify-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
              </div>
            </div>
          )}

          {/* ── Move Point ── */}
          {mode === 'move-point' && !dragPreview && (
            <p className="text-xs text-gray-500">Click and drag a point to move it.</p>
          )}
          {mode === 'move-point' && dragPreview && (
            <p className="text-xs text-gray-500">
              Dragging... release to place at new position.
            </p>
          )}

          {/* ── Delete Point ── */}
          {mode === 'delete-point' && (
            <p className="text-xs text-gray-500">Click on a point to delete it.</p>
          )}

          {/* ── Add Wire (drag-based) ── */}
          {mode === 'add-wire' && (
            <div className="flex flex-col gap-2">
              {/* Wire type selector */}
              <div className="flex gap-1">
                <button
                  onClick={() => setWireType('mt')}
                  className={`flex-1 rounded border px-2 py-1 text-xs ${
                    wireType === 'mt'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Middle Tension
                </button>
                <button
                  onClick={() => setWireType('lt')}
                  className={`flex-1 rounded border px-2 py-1 text-xs ${
                    wireType === 'lt'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Low Tension
                </button>
              </div>

              {!wireStartPointId && !wireDragLine && (
                <p className="text-xs text-gray-500">Drag from one point to another to create a wire.</p>
              )}
              {wireDragLine && (
                <p className="text-xs text-gray-500">
                  Dragging... release on a point to connect.
                </p>
              )}

              {wireStartPointId && wireEndPointId && (
                <>
                  <p className="text-xs text-gray-500">
                    Start: #{wireStartPointId} → End: #{wireEndPointId}
                  </p>

                  {wireType === 'mt' && renderField(
                    'wireOfLine',
                    wireFields.wireOfLine,
                    wireForm.wireOfLine,
                    (v) => setWireForm((prev: Partial<WireRequest>) => ({ ...prev, wireOfLine: v || null })),
                  )}
                  {renderField(
                    'feederId',
                    wireFields.feederId,
                    wireForm.feederId,
                    (v) => setWireForm((prev: Partial<WireRequest>) => ({ ...prev, feederId: v ? Number(v) : null })),
                    'number',
                  )}
                  {wireType === 'lt' && renderField(
                    'transformerParentId',
                    wireFields.transformerParentId,
                    wireForm.transformerParentId,
                    (v) => setWireForm((prev: Partial<WireRequest>) => ({ ...prev, transformerParentId: v ? Number(v) : null })),
                    'number',
                  )}

                  <div className="flex gap-1 pt-1">
                    <button
                      onClick={() => { setWireStartPointId(null); setWireEndPointId(null); setPendingCoord(null); }}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      Reset
                    </button>
                    <button
                      onClick={handleSaveWire}
                      disabled={loading || !isWireFormValid()}
                      className="flex flex-1 items-center justify-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Save
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Edit Wire (drag-based) ── */}
          {mode === 'edit-wire' && (
            <div className="flex flex-col gap-2">
              {!wireDragLine && (
                <p className="text-xs text-gray-500">
                  Drag a wire endpoint to a new point to reassign it.
                </p>
              )}
              {wireDragLine && (
                <p className="text-xs text-gray-500">
                  Dragging... release on a point to reassign the endpoint.
                </p>
              )}
            </div>
          )}

          {/* ── Delete Wire ── */}
          {mode === 'delete-wire' && (
            <p className="text-xs text-gray-500">Click on a wire to delete it.</p>
          )}

          {loading && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" /> Processing...
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Render: toolbar buttons ─────────────────────────────────

  const btnBase =
    'flex h-9 w-9 items-center justify-center rounded-lg border shadow-md transition-colors';
  const btnNormal = 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50';

  return (
    <div className={`absolute ${posClass} z-10 flex flex-col gap-1`} style={style}>
      {/* Points section */}
      <button
        onClick={() => startMode('add-point')}
        className={`${btnBase} ${btnNormal}`}
        title="Add point"
      >
        <Plus size={14} />
      </button>
      <button
        onClick={() => startMode('move-point')}
        className={`${btnBase} ${btnNormal}`}
        title="Move point"
      >
        <Move size={14} />
      </button>
      <button
        onClick={() => startMode('delete-point')}
        className={`${btnBase} border-red-300 bg-red-50 text-red-600 shadow-md hover:bg-red-100`}
        title="Delete point"
      >
        <MapPin size={14} />
      </button>

      {/* Divider */}
      <div className="my-0.5 h-px bg-gray-200" />

      {/* Wires section */}
      <button
        onClick={() => startMode('add-wire')}
        className={`${btnBase} ${btnNormal}`}
        title="Add wire (drag between points)"
      >
        <Cable size={14} />
      </button>
      <button
        onClick={() => startMode('edit-wire')}
        className={`${btnBase} ${btnNormal}`}
        title="Edit wire endpoints (drag)"
      >
        <Edit3 size={14} />
      </button>
      <button
        onClick={() => startMode('delete-wire')}
        className={`${btnBase} border-red-300 bg-red-50 text-red-600 shadow-md hover:bg-red-100`}
        title="Delete wire"
      >
        <Trash2 size={14} />
      </button>

      {/* Divider */}
      <div className="my-0.5 h-px bg-gray-200" />

      {/* Undo / Redo */}
      <button
        onClick={handleUndo}
        disabled={!history.canUndo || history.busy || loading}
        className={`${btnBase} ${history.canUndo ? btnNormal : 'border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed'}`}
        title={history.canUndo ? `Undo (${history.undoStack.length})` : 'Nothing to undo'}
      >
        <Undo2 size={14} />
      </button>
      <button
        onClick={handleRedo}
        disabled={!history.canRedo || history.busy || loading}
        className={`${btnBase} ${history.canRedo ? btnNormal : 'border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed'}`}
        title={history.canRedo ? `Redo (${history.redoStack.length})` : 'Nothing to redo'}
      >
        <Redo2 size={14} />
      </button>
    </div>
  );
}
