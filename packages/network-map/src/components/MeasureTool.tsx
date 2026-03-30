import { useState, useCallback, useEffect, useRef } from 'react';
import { Ruler, X } from 'lucide-react';
import { useMap } from '../context/MapContext';
import CollapsibleToolbar from './CollapsibleToolbar';

type MeasureMode = 'none' | 'distance' | 'area';

interface MeasureToolProps {
  position?: 'top-left' | 'top-right';
  style?: React.CSSProperties;
  defaultCollapsed?: boolean;
}

export default function MeasureTool({ position = 'top-right', style, defaultCollapsed = false }: MeasureToolProps) {
  const { getAdapter, isReady } = useMap();
  const [mode, setMode] = useState<MeasureMode>('none');
  const [points, setPoints] = useState<[number, number][]>([]);
  const [result, setResult] = useState<string>('');
  const sourceAdded = useRef(false);

  // positioning handled by CollapsibleToolbar

  // Add/remove measure source and layers
  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter) return;

    if (mode !== 'none' && !sourceAdded.current) {
      adapter.addGeoJSONSource('measure-source', { type: 'FeatureCollection', features: [] });
      adapter.addLayer({
        id: 'measure-line',
        type: 'line',
        source: 'measure-source',
        paint: {
          'line-color': '#ef4444',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });
      adapter.addLayer({
        id: 'measure-points',
        type: 'circle',
        source: 'measure-source',
        filter: ['all', ['==', '$type', 'Point'], ['!has', '_segLabel']],
        paint: {
          'circle-radius': 4,
          'circle-color': '#ef4444',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      adapter.addLayer({
        id: 'measure-segment-labels',
        type: 'symbol',
        source: 'measure-source',
        filter: ['has', '_segLabel'],
        layout: {
          'text-field': ['get', '_segLabel'],
          'text-size': 12,
          'text-font': ['Open Sans Semibold'],
          'text-anchor': 'center',
          'text-allow-overlap': true,
          'text-offset': [0, -1],
        },
        paint: {
          'text-color': '#dc2626',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      });
      sourceAdded.current = true;
    }

    if (mode === 'none' && sourceAdded.current) {
      adapter.removeLayer('measure-segment-labels');
      adapter.removeLayer('measure-points');
      adapter.removeLayer('measure-line');
      adapter.removeSource('measure-source');
      sourceAdded.current = false;
    }
  }, [mode, isReady, getAdapter]);

  // Update geometry on the map when points change
  useEffect(() => {
    if (!isReady || mode === 'none' || points.length === 0) return;
    const adapter = getAdapter();
    if (!adapter || !sourceAdded.current) return;

    const features: GeoJSON.Feature[] = [];

    // Point features
    for (const pt of points) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: {},
      });
    }

    // Line or polygon
    if (points.length >= 2) {
      if (mode === 'distance') {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: points },
          properties: {},
        });
        // Segment midpoint labels
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1];
          const b = points[i];
          const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          const segDist = haversineDistance(a, b);
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: mid },
            properties: { _segLabel: formatDistance(segDist) },
          });
        }
      } else if (mode === 'area' && points.length >= 3) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] },
          properties: {},
        });
      }
    }

    adapter.updateGeoJSONSource('measure-source', {
      type: 'FeatureCollection',
      features,
    });

    // Calculate
    if (mode === 'distance' && points.length >= 2) {
      const dist = computeDistance(points);
      setResult(formatDistance(dist));
    } else if (mode === 'area' && points.length >= 3) {
      const area = computeArea(points);
      setResult(formatArea(area));
    }
  }, [points, mode, isReady, getAdapter]);

  // Click handler for placing points
  useEffect(() => {
    if (!isReady || mode === 'none') return;
    const adapter = getAdapter();
    if (!adapter) return;

    const handleClick = (e: { lngLat: { lng: number; lat: number } }) => {
      setPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
    };

    adapter.on('click', handleClick);
    adapter.setCursor('crosshair');

    return () => {
      adapter.off('click', handleClick);
      adapter.setCursor('');
    };
  }, [mode, isReady, getAdapter]);

  const handleStartDistance = useCallback(() => {
    setPoints([]);
    setResult('');
    setMode('distance');
  }, []);

  const handleStartArea = useCallback(() => {
    setPoints([]);
    setResult('');
    setMode('area');
  }, []);

  const handleStop = useCallback(() => {
    setMode('none');
    setPoints([]);
    setResult('');
  }, []);

  return (
    <CollapsibleToolbar
      title="Medir"
      icon={<Ruler size={14} />}
      defaultCollapsed={defaultCollapsed}
      position={position}
      style={style}
    >
      {mode === 'none' ? (
        <>
          <button
            onClick={handleStartDistance}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white shadow-md hover:bg-gray-50"
            title="Measure distance"
          >
            <Ruler size={16} className="text-gray-600" />
          </button>
          <button
            onClick={handleStartArea}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-600 shadow-md hover:bg-gray-50"
            title="Measure area"
          >
            m²
          </button>
        </>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">
              {mode === 'distance' ? 'Distance' : 'Area'}
            </span>
            <button onClick={handleStop} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-500">Click on the map to add points</p>
          {result && (
            <div className="mt-2 rounded-md bg-blue-50 px-2 py-1 text-sm font-semibold text-blue-700">
              {result}
            </div>
          )}
          {points.length > 0 && (
            <button
              onClick={handleStop}
              className="mt-2 w-full rounded-md bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </CollapsibleToolbar>
  );
}

// ─── Haversine helpers ───────────────────────────────────

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversineDistance(a: [number, number], b: [number, number]): number {
  const R = 6371000; // meters
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function computeDistance(points: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i]);
  }
  return total;
}

function computeArea(points: [number, number][]): number {
  // Shoelface formula on projected coordinates (simple approximation)
  const R = 6371000;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = toRad(points[i][0]) * R * Math.cos(toRad(points[i][1]));
    const yi = toRad(points[i][1]) * R;
    const xj = toRad(points[j][0]) * R * Math.cos(toRad(points[j][1]));
    const yj = toRad(points[j][1]) * R;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area / 2);
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return (meters / 1000).toFixed(2) + ' km';
  return meters.toFixed(1) + ' m';
}

function formatArea(sqMeters: number): string {
  if (sqMeters >= 1_000_000) return sqMeters.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' m²';
  return sqMeters.toFixed(1) + ' m²';
}
