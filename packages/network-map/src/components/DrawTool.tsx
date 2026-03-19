import { useState, useCallback, useEffect, useRef } from 'react';
import { Pencil, Circle, Minus, Pentagon, X, Trash2 } from 'lucide-react';
import { useMap } from '../context/MapContext';
import type { DrawMode } from '../types/map';

interface DrawToolProps {
  position?: 'top-left' | 'top-right';
  style?: React.CSSProperties;
  onDrawComplete?: (geometry: GeoJSON.Geometry, drawId: string) => void;
  /** Called when a drawn figure is deleted, so parent can clean up associated resources (e.g. buffers) */
  onFeatureDeleted?: (drawId: string) => void;
  /** Called after a polygon/line/circle is drawn with the features found inside the drawn area */
  onSpatialQuery?: (drawnGeometry: GeoJSON.Geometry, featuresInArea: GeoJSON.Feature[]) => void;
  /** Layer IDs to include in spatial queries. If empty/undefined, queries all visible data layers. */
  spatialQueryLayers?: string[];
}

const DRAW_SOURCE = '__draw-active';
const RESULT_SOURCE = '__draw-result';
const SEL_SOURCE = '__draw-selected';
const DBLCLICK_MS = 350;

let featureIdCounter = 0;

export default function DrawTool({
  position = 'top-right',
  style,
  onDrawComplete,
  onFeatureDeleted,
  onSpatialQuery,
  spatialQueryLayers,
}: DrawToolProps) {
  const { getAdapter, isReady } = useMap();
  const [mode, setMode] = useState<DrawMode | 'none'>('none');
  const [points, setPoints] = useState<[number, number][]>([]);
  const [completedFeatures, setCompletedFeatures] = useState<GeoJSON.Feature[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sourceAdded = useRef(false);
  const resultSourceAdded = useRef(false);
  const selSourceAdded = useRef(false);
  const pointsRef = useRef<[number, number][]>([]);
  const onDrawCompleteRef = useRef(onDrawComplete);
  onDrawCompleteRef.current = onDrawComplete;
  const onFeatureDeletedRef = useRef(onFeatureDeleted);
  onFeatureDeletedRef.current = onFeatureDeleted;
  const onSpatialQueryRef = useRef(onSpatialQuery);
  onSpatialQueryRef.current = onSpatialQuery;
  const spatialQueryLayersRef = useRef(spatialQueryLayers);
  spatialQueryLayersRef.current = spatialQueryLayers;
  const lastClickTime = useRef(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Keep pointsRef in sync
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const posClass = position === 'top-left' ? 'left-4' : 'right-4';

  // ── Persistent result layer (survives mode changes) ──
  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter) return;

    if (!resultSourceAdded.current) {
      adapter.addGeoJSONSource(RESULT_SOURCE, { type: 'FeatureCollection', features: [] });
      adapter.addLayer({
        id: `${RESULT_SOURCE}-fill`,
        type: 'fill',
        source: RESULT_SOURCE,
        filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.2 },
      });
      adapter.addLayer({
        id: `${RESULT_SOURCE}-line`,
        type: 'line',
        source: RESULT_SOURCE,
        paint: { 'line-color': '#3b82f6', 'line-width': 2.5, 'line-dasharray': [4, 2] },
      });
      adapter.addLayer({
        id: `${RESULT_SOURCE}-points`,
        type: 'circle',
        source: RESULT_SOURCE,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#3b82f6',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      resultSourceAdded.current = true;
    }

    // Selection highlight layer
    if (!selSourceAdded.current) {
      adapter.addGeoJSONSource(SEL_SOURCE, { type: 'FeatureCollection', features: [] });
      adapter.addLayer({
        id: `${SEL_SOURCE}-fill`,
        type: 'fill',
        source: SEL_SOURCE,
        filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.3 },
      });
      adapter.addLayer({
        id: `${SEL_SOURCE}-line`,
        type: 'line',
        source: SEL_SOURCE,
        paint: { 'line-color': '#ef4444', 'line-width': 3 },
      });
      adapter.addLayer({
        id: `${SEL_SOURCE}-points`,
        type: 'circle',
        source: SEL_SOURCE,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 8,
          'circle-color': '#ef4444',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      selSourceAdded.current = true;
    }

    return () => {
      if (resultSourceAdded.current) {
        adapter.removeLayer(`${RESULT_SOURCE}-points`);
        adapter.removeLayer(`${RESULT_SOURCE}-line`);
        adapter.removeLayer(`${RESULT_SOURCE}-fill`);
        adapter.removeSource(RESULT_SOURCE);
        resultSourceAdded.current = false;
      }
      if (selSourceAdded.current) {
        adapter.removeLayer(`${SEL_SOURCE}-points`);
        adapter.removeLayer(`${SEL_SOURCE}-line`);
        adapter.removeLayer(`${SEL_SOURCE}-fill`);
        adapter.removeSource(SEL_SOURCE);
        selSourceAdded.current = false;
      }
    };
  }, [isReady, getAdapter]);

  // Update the result source whenever completedFeatures changes
  useEffect(() => {
    if (!isReady || !resultSourceAdded.current) return;
    const adapter = getAdapter();
    if (!adapter) return;
    adapter.updateGeoJSONSource(RESULT_SOURCE, { type: 'FeatureCollection', features: completedFeatures });
  }, [completedFeatures, isReady, getAdapter]);

  // Update selection highlight
  useEffect(() => {
    if (!isReady || !selSourceAdded.current) return;
    const adapter = getAdapter();
    if (!adapter) return;
    const selFeature = selectedId ? completedFeatures.find((f) => f.properties?._drawId === selectedId) : null;
    const features = selFeature ? [selFeature] : [];
    adapter.updateGeoJSONSource(SEL_SOURCE, { type: 'FeatureCollection', features });
  }, [selectedId, completedFeatures, isReady, getAdapter]);

  // Disable double-click zoom while in draw mode
  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMap = adapter.getRawMap() as any;
    if (!rawMap) return;

    if (mode !== 'none') {
      rawMap.doubleClickZoom.disable();
    } else {
      rawMap.doubleClickZoom.enable();
    }
    return () => {
      rawMap.doubleClickZoom?.enable();
    };
  }, [mode, isReady, getAdapter]);

  // ── Active drawing source/layers (only while mode !== 'none') ──
  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter) return;

    if (mode !== 'none' && !sourceAdded.current) {
      adapter.addGeoJSONSource(DRAW_SOURCE, { type: 'FeatureCollection', features: [] });
      adapter.addLayer({
        id: `${DRAW_SOURCE}-fill`,
        type: 'fill',
        source: DRAW_SOURCE,
        filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': '#f97316', 'fill-opacity': 0.15 },
      });
      adapter.addLayer({
        id: `${DRAW_SOURCE}-line`,
        type: 'line',
        source: DRAW_SOURCE,
        paint: { 'line-color': '#f97316', 'line-width': 2 },
      });
      adapter.addLayer({
        id: `${DRAW_SOURCE}-points`,
        type: 'circle',
        source: DRAW_SOURCE,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#f97316',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      sourceAdded.current = true;
    }

    if (mode === 'none' && sourceAdded.current) {
      adapter.removeLayer(`${DRAW_SOURCE}-points`);
      adapter.removeLayer(`${DRAW_SOURCE}-line`);
      adapter.removeLayer(`${DRAW_SOURCE}-fill`);
      adapter.removeSource(DRAW_SOURCE);
      sourceAdded.current = false;
    }
  }, [mode, isReady, getAdapter]);

  // Update active drawing geometry on the map
  useEffect(() => {
    if (!isReady || mode === 'none' || points.length === 0) return;
    const adapter = getAdapter();
    if (!adapter || !sourceAdded.current) return;

    const features: GeoJSON.Feature[] = [];
    for (const pt of points) {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: pt }, properties: {} });
    }

    if (points.length >= 2) {
      if (mode === 'line') {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: points },
          properties: {},
        });
      } else if (mode === 'polygon') {
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] },
          properties: {},
        });
      }
    }

    if (mode === 'circle' && points.length >= 2) {
      const center = points[0];
      const edge = points[1];
      const radius = haversine(center, edge);
      const circleCoords = generateCircle(center, radius, 64);
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [circleCoords] },
        properties: {},
      });
    }

    adapter.updateGeoJSONSource(DRAW_SOURCE, { type: 'FeatureCollection', features });
  }, [points, mode, isReady, getAdapter]);

  // Helper: finish a draw and persist geometry
  const finishDraw = useCallback((geometry: GeoJSON.Geometry) => {
    const id = `draw-${++featureIdCounter}`;
    const feature: GeoJSON.Feature = { type: 'Feature', geometry, properties: { _drawId: id } };
    setCompletedFeatures((prev) => [...prev, feature]);
    onDrawCompleteRef.current?.(geometry, id);
    setMode('none');
    setPoints([]);

    // Spatial query: for non-point geometries, find map features inside the drawn area
    if (geometry.type !== 'Point' && onSpatialQueryRef.current) {
      // Defer to next tick so the map has rendered
      setTimeout(() => {
        const adapter = getAdapter();
        if (!adapter) return;
        const coords = geometry.type === 'Polygon'
          ? geometry.coordinates[0] as [number, number][]
          : geometry.type === 'LineString'
            ? geometry.coordinates as [number, number][]
            : [];
        if (coords.length === 0) return;

        // Compute bounding box of the drawn geometry
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        for (const [lng, lat] of coords) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }

        // Project to screen coords
        const sw = adapter.project([minLng, minLat]);
        const ne = adapter.project([maxLng, maxLat]);

        // Determine which layers to query (exclude internal draw/buffer layers)
        const internalPrefixes = ['__draw-', '__buffer-', '__draw-selected'];
        const queryLayers = spatialQueryLayersRef.current?.length
          ? spatialQueryLayersRef.current
          : undefined;

        const rawHits = adapter.queryRenderedFeaturesInBox(
          { x: Math.min(sw.x, ne.x), y: Math.min(sw.y, ne.y) },
          { x: Math.max(sw.x, ne.x), y: Math.max(sw.y, ne.y) },
          queryLayers,
        ) as GeoJSON.Feature[];

        // Filter out internal layers and deduplicate by feature id
        const seen = new Set<string>();
        const results: GeoJSON.Feature[] = [];
        for (const f of rawHits) {
          const layerId = (f as unknown as { layer?: { id?: string } }).layer?.id ?? '';
          if (internalPrefixes.some((p) => layerId.startsWith(p))) continue;
          const fid = String(f.properties?.id ?? f.id ?? '');
          if (fid && seen.has(fid)) continue;
          if (fid) seen.add(fid);
          results.push(f);
        }

        onSpatialQueryRef.current?.(geometry, results);
      }, 100);
    }
  }, [getAdapter]);

  // Click handler — detects double-click via timing within the click handler itself
  useEffect(() => {
    if (!isReady || mode === 'none') return;
    const adapter = getAdapter();
    if (!adapter) return;

    const handleClick = (e: { lngLat: { lng: number; lat: number } }) => {
      const now = Date.now();
      const isDblClick = now - lastClickTime.current < DBLCLICK_MS;
      lastClickTime.current = now;

      if (isDblClick) {
        // Treat as double-click → finalize
        const pts = pointsRef.current;
        const currentMode = modeRef.current;
        if (currentMode === 'line' && pts.length >= 2) {
          // Remove the last point (added by the first click of this dblclick pair)
          const clean = pts.slice(0, -1);
          if (clean.length >= 2) finishDraw({ type: 'LineString', coordinates: clean });
        } else if (currentMode === 'polygon' && pts.length >= 3) {
          const clean = pts.slice(0, -1);
          if (clean.length >= 3) finishDraw({ type: 'Polygon', coordinates: [[...clean, clean[0]]] });
        }
        return;
      }

      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (mode === 'point') {
        finishDraw({ type: 'Point', coordinates: coord });
      } else if (mode === 'circle') {
        setPoints((prev) => {
          const next = [...prev, coord];
          if (next.length >= 2) {
            const center = next[0];
            const edge = next[1];
            const radius = haversine(center, edge);
            const coords = generateCircle(center, radius, 64);
            setTimeout(() => finishDraw({ type: 'Polygon', coordinates: [coords] }), 0);
            return next;
          }
          return next;
        });
      } else {
        // line / polygon — just add point
        setPoints((prev) => [...prev, coord]);
      }
    };

    adapter.on('click', handleClick);
    // Also intercept native dblclick to prevent zoom
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMap = adapter.getRawMap() as any;
    const suppressDbl = (e: { preventDefault?: () => void }) => { e.preventDefault?.(); };
    rawMap?.on('dblclick', suppressDbl);
    adapter.setCursor('crosshair');

    return () => {
      adapter.off('click', handleClick);
      rawMap?.off('dblclick', suppressDbl);
      adapter.setCursor('');
    };
  }, [mode, isReady, getAdapter, finishDraw]);

  // Click on completed shapes to select/deselect (only when not drawing)
  useEffect(() => {
    if (!isReady || mode !== 'none' || completedFeatures.length === 0) return;
    const adapter = getAdapter();
    if (!adapter) return;

    const resultLayers = [`${RESULT_SOURCE}-fill`, `${RESULT_SOURCE}-line`, `${RESULT_SOURCE}-points`];

    const handleResultClick = (e: { point: { x: number; y: number } }) => {
      const hits = adapter.queryRenderedFeatures(e.point, resultLayers) as {
        properties: Record<string, unknown>;
      }[];
      if (hits.length > 0) {
        const hitId = hits[0].properties._drawId as string | undefined;
        if (hitId) {
          setSelectedId((prev) => (prev === hitId ? null : hitId));
          return;
        }
      }
      setSelectedId(null);
    };

    adapter.on('click', handleResultClick);
    return () => adapter.off('click', handleResultClick);
  }, [mode, isReady, getAdapter, completedFeatures.length]);

  // Delete selected shape via keyboard
  useEffect(() => {
    if (!selectedId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setCompletedFeatures((prev) => prev.filter((f) => f.properties?._drawId !== selectedId));
        onFeatureDeletedRef.current?.(selectedId);
        setSelectedId(null);
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedId]);

  const start = useCallback((m: DrawMode) => {
    setPoints([]);
    setSelectedId(null);
    setMode(m);
  }, []);

  const cancel = useCallback(() => {
    setMode('none');
    setPoints([]);
  }, []);


  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setCompletedFeatures((prev) => prev.filter((f) => f.properties?._drawId !== selectedId));
    onFeatureDeletedRef.current?.(selectedId);
    setSelectedId(null);
  }, [selectedId]);

  if (mode !== 'none') {
    return (
      <div className={`absolute ${posClass} z-10`} style={style}>
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">
              Drawing: {mode}
            </span>
            <button onClick={cancel} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {mode === 'point' && 'Click to place a point'}
            {mode === 'line' && 'Click to add points, double-click to finish'}
            {mode === 'polygon' && 'Click to add vertices, double-click to close'}
            {mode === 'circle' && (points.length === 0 ? 'Click to set center' : 'Click to set edge')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`absolute ${posClass} z-10 flex flex-col gap-1`} style={style}>
      <button
        onClick={() => start('point')}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white shadow-md hover:bg-gray-50"
        title="Draw point"
      >
        <Pencil size={14} className="text-gray-600" />
      </button>
      <button
        onClick={() => start('line')}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white shadow-md hover:bg-gray-50"
        title="Draw line"
      >
        <Minus size={14} className="text-gray-600" />
      </button>
      <button
        onClick={() => start('polygon')}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white shadow-md hover:bg-gray-50"
        title="Draw polygon"
      >
        <Pentagon size={14} className="text-gray-600" />
      </button>
      <button
        onClick={() => start('circle')}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white shadow-md hover:bg-gray-50"
        title="Draw circle"
      >
        <Circle size={14} className="text-gray-600" />
      </button>
      {selectedId && (
        <button
          onClick={deleteSelected}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-400 bg-red-50 shadow-md hover:bg-red-100"
          title="Delete selected shape (or press Delete key)"
        >
          <Trash2 size={14} className="text-red-600" />
        </button>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function generateCircle(center: [number, number], radiusMeters: number, steps: number): [number, number][] {
  const coords: [number, number][] = [];
  const km = radiusMeters / 1000;
  for (let i = 0; i <= steps; i++) {
    const angle = (i * 360) / steps;
    const rad = toRad(angle);
    const lat = center[1] + (km / 111.32) * Math.cos(rad);
    const lng = center[0] + (km / (111.32 * Math.cos(toRad(center[1])))) * Math.sin(rad);
    coords.push([lng, lat]);
  }
  return coords;
}
