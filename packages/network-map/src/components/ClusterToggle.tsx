import { useState, useCallback, useRef, useEffect } from 'react';
import { Group, Ungroup } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../context/MapContext';
import CollapsibleToolbar from './CollapsibleToolbar';

interface ClusterToggleProps {
  layerCode: string;
  label?: string;
  position?: 'top-left' | 'top-right';
  style?: React.CSSProperties;
  defaultCollapsed?: boolean;
}

export default function ClusterToggle({
  layerCode,
  label = 'Clusters',
  position = 'top-right',
  style,
  defaultCollapsed = false,
}: ClusterToggleProps) {
  const { getAdapter, isReady } = useMap();
  const [clustered, setClustered] = useState(true);

  // Store the full layer specs when the map is ready so we can recreate them reliably
  const clusterLayerSpecs = useRef<maplibregl.LayerSpecification[]>([]);
  const clusterSourceSpec = useRef<{ clusterRadius: number; clusterMaxZoom: number } | null>(null);
  // Store original minZoom of the main point layer so we can restore it after toggling
  const originalMinZoom = useRef<number | undefined>(undefined);

  // Capture layer/source specs once the cluster layers exist on the map
  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter) return;
    const rawMap = adapter.getRawMap() as maplibregl.Map | null;
    if (!rawMap) return;

    // Wait a tick for layers to be rendered
    const timer = setTimeout(() => {
      const mapStyle = rawMap.getStyle();
      if (!mapStyle) return;
      const specs = mapStyle.layers.filter(
        (l: maplibregl.LayerSpecification) => 'source' in l && l.source === layerCode
      );
      if (specs.length > 0) {
        clusterLayerSpecs.current = specs.map((s) => ({ ...s }));
      }
      // Capture the original minZoom of the main point layer
      const mainLayer = specs.find((l) => l.id === layerCode);
      if (mainLayer && 'minzoom' in mainLayer && originalMinZoom.current === undefined) {
        originalMinZoom.current = (mainLayer as { minzoom?: number }).minzoom;
      }
      // Capture cluster source options
      const sourceDef = mapStyle.sources[layerCode];
      if (sourceDef && sourceDef.type === 'geojson') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const src = sourceDef as any;
        if (src.cluster) {
          clusterSourceSpec.current = {
            clusterRadius: src.clusterRadius ?? 60,
            clusterMaxZoom: src.clusterMaxZoom ?? 15,
          };
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isReady, getAdapter, layerCode]);

  // positioning handled by CollapsibleToolbar

  const toggle = useCallback(() => {
    const adapter = getAdapter();
    if (!adapter) return;

    const rawMap = adapter.getRawMap() as maplibregl.Map | null;
    if (!rawMap) return;

    // Detect if this is a vector (MVT) source
    const sourceDef = rawMap.getStyle()?.sources?.[layerCode];
    const isMVT = sourceDef?.type === 'vector';

    if (isMVT) {
      // For MVT the backend emits three source-layers per clustered tile:
      //   - "{layerCode}-clusters"    → cluster centroids  (visible when clustered)
      //   - "{layerCode}"             → singles            (visible when clustered)
      //   - "{layerCode}-unclustered" → ALL individual pts (visible when NOT clustered)
      const clusterLayerId = `${layerCode}-cluster`;
      const clusterCountLayerId = `${layerCode}-cluster-count`;
      const unclusteredLayerId = `${layerCode}-unclustered`;

      if (clustered) {
        // Disable clusters → hide cluster circles/counts, show unclustered + main layer.
        // Main layer stays visible because at high zoom (above clusterMaxZoom) the backend
        // uses queryMVTSimple which only emits the "{layerCode}" source-layer.
        if (rawMap.getLayer(clusterLayerId)) rawMap.setLayoutProperty(clusterLayerId, 'visibility', 'none');
        if (rawMap.getLayer(clusterCountLayerId)) rawMap.setLayoutProperty(clusterCountLayerId, 'visibility', 'none');
        if (rawMap.getLayer(layerCode)) {
          rawMap.setLayoutProperty(layerCode, 'visibility', 'visible');
          rawMap.setLayerZoomRange(layerCode, 0, 22);
        }
        if (rawMap.getLayer(unclusteredLayerId)) {
          rawMap.setLayoutProperty(unclusteredLayerId, 'visibility', 'visible');
          rawMap.setLayerZoomRange(unclusteredLayerId, 0, 22);
        }
        setClustered(false);
      } else {
        // Enable clusters → show cluster layers, hide unclustered, restore main layer minZoom
        if (rawMap.getLayer(clusterLayerId)) rawMap.setLayoutProperty(clusterLayerId, 'visibility', 'visible');
        if (rawMap.getLayer(clusterCountLayerId)) rawMap.setLayoutProperty(clusterCountLayerId, 'visibility', 'visible');
        if (rawMap.getLayer(layerCode) && originalMinZoom.current !== undefined) {
          rawMap.setLayerZoomRange(layerCode, originalMinZoom.current, 22);
        }
        if (rawMap.getLayer(unclusteredLayerId)) rawMap.setLayoutProperty(unclusteredLayerId, 'visibility', 'none');
        setClustered(true);
      }
      return;
    }

    // GeoJSON path: recreate source with/without clustering
    const source = rawMap.getSource(layerCode) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const serialized = source.serialize();
    const currentData = serialized?.data ?? { type: 'FeatureCollection', features: [] };

    const mapStyle = rawMap.getStyle();
    const currentLayers = mapStyle.layers.filter(
      (l: maplibregl.LayerSpecification) => 'source' in l && l.source === layerCode
    );

    if (clustered && currentLayers.length > 0) {
      clusterLayerSpecs.current = currentLayers.map((s) => ({ ...s }));
    }

    const allLayerSpecs = clusterLayerSpecs.current.length > 0
      ? clusterLayerSpecs.current
      : currentLayers;

    for (const l of currentLayers) {
      rawMap.removeLayer(l.id);
    }
    rawMap.removeSource(layerCode);

    if (clustered) {
      rawMap.addSource(layerCode, {
        type: 'geojson',
        data: currentData,
      });
      for (const l of allLayerSpecs) {
        if (l.id === `${layerCode}-cluster` || l.id === `${layerCode}-cluster-count`) continue;
        const restored = { ...l };
        if (restored.id === layerCode && 'filter' in restored) {
          delete (restored as Record<string, unknown>).filter;
        }
        rawMap.addLayer(restored);
      }
      setClustered(false);
    } else {
      const cSpec = clusterSourceSpec.current ?? { clusterRadius: 60, clusterMaxZoom: 15 };
      rawMap.addSource(layerCode, {
        type: 'geojson',
        data: currentData,
        cluster: true,
        clusterRadius: cSpec.clusterRadius,
        clusterMaxZoom: cSpec.clusterMaxZoom,
      });
      for (const l of allLayerSpecs) {
        const restored = { ...l };
        if (restored.id === layerCode) {
          (restored as maplibregl.CircleLayerSpecification).filter = ['!', ['has', 'point_count']];
        }
        rawMap.addLayer(restored);
      }
      setClustered(true);
    }
  }, [clustered, getAdapter, layerCode]);

  if (!isReady) return null;

  return (
    <CollapsibleToolbar
      title="Clusters"
      icon={<Group size={14} />}
      defaultCollapsed={defaultCollapsed}
      position={position}
      style={style}
    >
      <button
        onClick={toggle}
        className={`flex h-10 items-center gap-2 rounded-lg border px-3 shadow-md transition-colors ${
          clustered
            ? 'border-green-400 bg-green-50 text-green-700'
            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
        }`}
        title={clustered ? 'Mostrar puntos individuales' : 'Agrupar en clusters'}
      >
        {clustered ? <Ungroup size={18} /> : <Group size={18} />}
        <span className="text-xs font-medium">{clustered ? label : 'Puntos'}</span>
      </button>
    </CollapsibleToolbar>
  );
}
