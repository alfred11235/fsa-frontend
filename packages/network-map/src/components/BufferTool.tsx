import { useState, useCallback, useEffect, useRef } from 'react';
import { Circle } from 'lucide-react';
import { useMap } from '../context/MapContext';
import { apiClient } from '@fsa/shared-api';
import CollapsibleToolbar from './CollapsibleToolbar';

const BUFFER_SOURCE = '__buffer-source';
const BUFFER_LAYER = '__buffer-layer';
const BUFFER_OUTLINE = '__buffer-outline';

/** One buffer entry, keyed by the drawId that owns it */
interface BufferEntry {
  drawId: string;
  radius: number;
  feature: GeoJSON.Feature;
}

interface BufferToolProps {
  position?: 'top-left' | 'top-right';
  style?: React.CSSProperties;
  radiusOptions?: number[];
  /** Currently selected drawn figure's drawId (from DrawTool.onSelectionChange) */
  selectedDrawId?: string | null;
  /** Currently selected drawn figure's geometry (from DrawTool.onSelectionChange) */
  selectedDrawGeometry?: GeoJSON.Geometry | null;
  /** Ref callback: receives a function to clear a specific buffer by drawId, or all if no id */
  clearBufferRef?: React.MutableRefObject<((drawId?: string) => void) | null>;
  defaultCollapsed?: boolean;
}

export default function BufferTool({
  position = 'top-right',
  style,
  radiusOptions = [50, 100, 200, 500],
  selectedDrawId,
  selectedDrawGeometry,
  clearBufferRef: externalClearRef,
  defaultCollapsed = false,
}: BufferToolProps) {
  const { selectedFeature, getAdapter } = useMap();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Multiple buffers, each keyed by drawId
  const [buffers, setBuffers] = useState<BufferEntry[]>([]);
  const sourceAdded = useRef(false);

  // positioning handled by CollapsibleToolbar

  const canActivate = !!selectedFeature || !!selectedDrawGeometry;

  // The radius currently active on the selected figure (if any)
  const activeRadiusForSelected = selectedDrawId
    ? buffers.find((b) => b.drawId === selectedDrawId)?.radius ?? null
    : null;
  const hasAnyBuffer = buffers.length > 0;

  // ── Manage buffer source/layers lifecycle ──
  useEffect(() => {
    const adapter = getAdapter();
    if (!adapter) return;

    if (buffers.length > 0 && !sourceAdded.current) {
      adapter.addGeoJSONSource(BUFFER_SOURCE, { type: 'FeatureCollection', features: [] });
      adapter.addLayer({
        id: BUFFER_LAYER,
        type: 'fill',
        source: BUFFER_SOURCE,
        paint: { 'fill-color': '#f97316', 'fill-opacity': 0.15 },
      });
      adapter.addLayer({
        id: BUFFER_OUTLINE,
        type: 'line',
        source: BUFFER_SOURCE,
        paint: { 'line-color': '#f97316', 'line-width': 2, 'line-dasharray': [4, 2] },
      });
      sourceAdded.current = true;
    }

    if (buffers.length === 0 && sourceAdded.current) {
      if (adapter.hasLayer(BUFFER_OUTLINE)) adapter.removeLayer(BUFFER_OUTLINE);
      if (adapter.hasLayer(BUFFER_LAYER)) adapter.removeLayer(BUFFER_LAYER);
      if (adapter.hasSource(BUFFER_SOURCE)) adapter.removeSource(BUFFER_SOURCE);
      sourceAdded.current = false;
    }
  }, [buffers, getAdapter]);

  // ── Update GeoJSON source whenever buffers change ──
  useEffect(() => {
    if (!sourceAdded.current) return;
    const adapter = getAdapter();
    if (!adapter) return;
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: buffers.map((b) => b.feature),
    };
    adapter.updateGeoJSONSource(BUFFER_SOURCE, fc);
  }, [buffers, getAdapter]);

  const clearBuffer = useCallback((drawId?: string) => {
    if (drawId) {
      setBuffers((prev) => prev.filter((b) => b.drawId !== drawId));
    } else {
      setBuffers([]);
    }
  }, []);

  // Expose clearBuffer to parent — set synchronously during render so
  // the ref is always available (not deferred to a useEffect flush).
  if (externalClearRef) externalClearRef.current = clearBuffer;

  const showBuffer = useCallback(
    async (radius: number) => {
      const adapter = getAdapter();
      if (!adapter) return;

      setLoading(true);
      try {
        if (selectedFeature) {
          // Server-side buffer for a selected map feature
          const res = await apiClient.get('/network-map/spatial/buffer', {
            params: {
              layerCode: selectedFeature.layerCode,
              featureId: String(selectedFeature.id),
              radiusMeters: radius,
            },
          });
          const data = res.data as GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry;
          const feat: GeoJSON.Feature = data.type === 'FeatureCollection'
            ? data.features[0]
            : data.type === 'Feature'
              ? data
              : { type: 'Feature', geometry: data, properties: {} };
          if (feat) {
            const drawId = `server-${selectedFeature.id}`;
            feat.properties = { ...feat.properties, _bufferDrawId: drawId };
            setBuffers((prev) => [...prev.filter((b) => b.drawId !== drawId), { drawId, radius, feature: feat }]);
          }
        } else if (selectedDrawGeometry && selectedDrawId) {
          // Client-side: expand the selected drawn figure by the given radius
          const buffered = bufferGeometry(selectedDrawGeometry, radius);
          const feat = buffered.features[0];
          if (feat) {
            feat.properties = { ...feat.properties, _bufferDrawId: selectedDrawId };
            setBuffers((prev) => [
              ...prev.filter((b) => b.drawId !== selectedDrawId),
              { drawId: selectedDrawId, radius, feature: feat },
            ]);
          }
        }
      } catch (err) {
        console.warn('[BufferTool] Failed to compute buffer:', err);
      } finally {
        setLoading(false);
        setOpen(false);
      }
    },
    [selectedFeature, selectedDrawGeometry, selectedDrawId, getAdapter],
  );

  const handleClearCurrent = useCallback(() => {
    if (selectedDrawId) {
      clearBuffer(selectedDrawId);
    } else if (selectedFeature) {
      clearBuffer(`server-${selectedFeature.id}`);
    }
  }, [selectedDrawId, selectedFeature, clearBuffer]);

  return (
    <CollapsibleToolbar
      title="Buffer"
      icon={<Circle size={14} />}
      defaultCollapsed={defaultCollapsed}
      position={position}
      style={style}
    >
      <button
        onClick={() => setOpen(!open)}
        disabled={!canActivate}
        className={`flex h-10 w-10 items-center justify-center rounded-lg border shadow-md transition-colors ${
          hasAnyBuffer
            ? 'border-orange-400 bg-orange-50 text-orange-600'
            : canActivate
              ? 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              : 'border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed'
        }`}
        title={canActivate ? 'Show buffer' : 'Select an element or draw a shape first'}
      >
        <Circle size={18} />
      </button>

      {open && canActivate && (
        <div className={`absolute top-12 ${position === 'top-left' ? 'left-0' : 'right-0'} w-44 rounded-lg border border-gray-200 bg-white p-2 shadow-lg`}>
          <p className="mb-1.5 px-2 text-xs font-medium text-gray-500">Buffer radius</p>
          {radiusOptions.map((r) => (
            <button
              key={r}
              onClick={() => showBuffer(r)}
              disabled={loading}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm ${
                activeRadiusForSelected === r
                  ? 'bg-orange-50 font-medium text-orange-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Circle size={12} />
              {r} m
            </button>
          ))}
          {activeRadiusForSelected && (
            <button
              onClick={handleClearCurrent}
              className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50"
            >
              Clear buffer
            </button>
          )}
        </div>
      )}
    </CollapsibleToolbar>
  );
}

// ─── Client-side buffer helpers ──────────────────────────
// Produces a single expanded polygon around the entire shape.

function toRad(deg: number) { return (deg * Math.PI) / 180; }

/** Convert meters to approximate degrees at a given latitude */
function metersToDeg(meters: number, lat: number): { dlng: number; dlat: number } {
  const dlat = meters / 111_320;
  const dlng = meters / (111_320 * Math.cos(toRad(lat)));
  return { dlng, dlat };
}

/** Generate a circle ring (closed) around a point in degrees */
function circleRing(cx: number, cy: number, radiusMeters: number, steps = 64): [number, number][] {
  const { dlng, dlat } = metersToDeg(radiusMeters, cy);
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    ring.push([cx + dlng * Math.cos(a), cy + dlat * Math.sin(a)]);
  }
  return ring;
}

/**
 * Offset a polygon outward by `radiusMeters`.
 * Strategy: for each edge, compute the outward-offset parallel edge,
 * then at each vertex add a rounded arc connecting consecutive offset edges.
 * This produces a single expanded polygon — no circles on vertices.
 */
function offsetPolygonRing(
  ring: [number, number][],
  radiusMeters: number,
  arcSteps = 12,
): [number, number][] {
  // Ensure the ring is closed and has no duplicate closing point for processing
  const pts = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : [...ring];
  const n = pts.length;
  if (n < 3) return ring;

  // Determine winding direction (positive = CCW in lng/lat space)
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  }
  // For outward expansion: if CW (area > 0 in screen coords), normals point outward to the left
  const sign = area > 0 ? 1 : -1;

  // Compute outward unit normals for each edge
  const normals: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = pts[j][0] - pts[i][0];
    const dy = pts[j][1] - pts[i][1];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) {
      normals.push([0, 0]);
    } else {
      // Normal pointing outward
      normals.push([sign * (-dy / len), sign * (dx / len)]);
    }
  }

  // Use average latitude for meter→degree conversion
  const avgLat = pts.reduce((s, p) => s + p[1], 0) / n;
  const { dlng, dlat } = metersToDeg(radiusMeters, avgLat);

  const result: [number, number][] = [];

  for (let i = 0; i < n; i++) {
    const prevEdge = (i - 1 + n) % n;
    const currEdge = i;

    // Offset points along the two adjacent edges at vertex i
    const n1 = normals[prevEdge];
    const n2 = normals[currEdge];

    // Angle of the two normals
    const a1 = Math.atan2(n1[1], n1[0]);
    const a2 = Math.atan2(n2[1], n2[0]);

    // Compute the angular sweep for the arc
    let sweep = a2 - a1;
    if (sweep > Math.PI) sweep -= 2 * Math.PI;
    if (sweep < -Math.PI) sweep += 2 * Math.PI;

    // If the vertex is convex (outward bend), add a rounded arc
    if (sweep <= 0) {
      // Convex corner: add arc from a1 to a2 going clockwise (outward)
      const steps = Math.max(2, Math.round(Math.abs(sweep) / (Math.PI / arcSteps)));
      for (let s = 0; s <= steps; s++) {
        const a = a1 + (sweep * s) / steps;
        result.push([
          pts[i][0] + dlng * Math.cos(a),
          pts[i][1] + dlat * Math.sin(a),
        ]);
      }
    } else {
      // Concave corner: just use the intersection point (miter)
      const ox = (n1[0] + n2[0]) / 2;
      const oy = (n1[1] + n2[1]) / 2;
      const len = Math.sqrt(ox * ox + oy * oy);
      if (len > 0) {
        result.push([
          pts[i][0] + dlng * (ox / len),
          pts[i][1] + dlat * (oy / len),
        ]);
      } else {
        result.push([pts[i][0] + dlng * n2[0], pts[i][1] + dlat * n2[1]]);
      }
    }
  }

  // Close the ring
  if (result.length > 0) result.push(result[0]);
  return result;
}

/**
 * Buffer a line by creating an offset on both sides + round caps.
 */
function bufferLine(
  coords: [number, number][],
  radiusMeters: number,
  arcSteps = 12,
): [number, number][] {
  if (coords.length < 2) {
    // Degenerate: just return a circle around the single point
    return circleRing(coords[0][0], coords[0][1], radiusMeters);
  }

  const avgLat = coords.reduce((s, p) => s + p[1], 0) / coords.length;
  const { dlng, dlat } = metersToDeg(radiusMeters, avgLat);

  // For each segment, compute the left-offset and right-offset lines
  const leftSide: [number, number][] = [];
  const rightSide: [number, number][] = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const dx = coords[i + 1][0] - coords[i][0];
    const dy = coords[i + 1][1] - coords[i][1];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    const nx = -dy / len;
    const ny = dx / len;

    leftSide.push(
      [coords[i][0] + dlng * nx, coords[i][1] + dlat * ny],
      [coords[i + 1][0] + dlng * nx, coords[i + 1][1] + dlat * ny],
    );
    rightSide.push(
      [coords[i][0] - dlng * nx, coords[i][1] - dlat * ny],
      [coords[i + 1][0] - dlng * nx, coords[i + 1][1] - dlat * ny],
    );
  }

  // Start cap (semicircle around first point)
  const startCap: [number, number][] = [];
  const startAngle = Math.atan2(
    coords[0][1] - coords[1][1],
    coords[0][0] - coords[1][0],
  );
  for (let s = 0; s <= arcSteps; s++) {
    const a = startAngle - Math.PI / 2 + (Math.PI * s) / arcSteps;
    startCap.push([coords[0][0] + dlng * Math.cos(a), coords[0][1] + dlat * Math.sin(a)]);
  }

  // End cap (semicircle around last point)
  const endCap: [number, number][] = [];
  const last = coords.length - 1;
  const endAngle = Math.atan2(
    coords[last][1] - coords[last - 1][1],
    coords[last][0] - coords[last - 1][0],
  );
  for (let s = 0; s <= arcSteps; s++) {
    const a = endAngle - Math.PI / 2 + (Math.PI * s) / arcSteps;
    endCap.push([coords[last][0] + dlng * Math.cos(a), coords[last][1] + dlat * Math.sin(a)]);
  }

  // Combine: left side → end cap → right side (reversed) → start cap
  const ring = [...leftSide, ...endCap, ...rightSide.reverse(), ...startCap];
  if (ring.length > 0) ring.push(ring[0]);
  return ring;
}

function bufferGeometry(geometry: GeoJSON.Geometry, radiusMeters: number): GeoJSON.FeatureCollection {
  let ring: [number, number][] = [];

  if (geometry.type === 'Point') {
    const [lng, lat] = geometry.coordinates as [number, number];
    ring = circleRing(lng, lat, radiusMeters);
  } else if (geometry.type === 'LineString') {
    const coords = geometry.coordinates as [number, number][];
    ring = bufferLine(coords, radiusMeters);
  } else if (geometry.type === 'Polygon') {
    const outerRing = geometry.coordinates[0] as [number, number][];
    ring = offsetPolygonRing(outerRing, radiusMeters);
  } else {
    // Fallback
    return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry, properties: {} }] };
  }

  const feature: GeoJSON.Feature = {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {},
  };
  return { type: 'FeatureCollection', features: [feature] };
}
