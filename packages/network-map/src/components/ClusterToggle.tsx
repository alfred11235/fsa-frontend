import { useState, useCallback, useRef, useEffect } from 'react';
import { Group, Ungroup } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../context/MapContext';

interface ClusterToggleProps {
  layerCode: string;
  label?: string;
  position?: 'top-left' | 'top-right';
  style?: React.CSSProperties;
}

export default function ClusterToggle({
  layerCode,
  label = 'Clusters',
  position = 'top-right',
  style,
}: ClusterToggleProps) {
  const { getAdapter, isReady } = useMap();
  const [clustered, setClustered] = useState(true);

  // Store the full layer specs when the map is ready so we can recreate them reliably
  const clusterLayerSpecs = useRef<maplibregl.LayerSpecification[]>([]);
  const clusterSourceSpec = useRef<{ clusterRadius: number; clusterMaxZoom: number } | null>(null);

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

  const positionClass = position === 'top-left' ? 'left-4' : 'right-4';

  const toggle = useCallback(() => {
    const adapter = getAdapter();
    if (!adapter) return;

    const rawMap = adapter.getRawMap() as maplibregl.Map | null;
    if (!rawMap) return;

    const source = rawMap.getSource(layerCode) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    // Get current GeoJSON data from the source via serialize()
    const serialized = source.serialize();
    const currentData = serialized?.data ?? { type: 'FeatureCollection', features: [] };

    // Get current layers from the map style
    const mapStyle = rawMap.getStyle();
    const currentLayers = mapStyle.layers.filter(
      (l: maplibregl.LayerSpecification) => 'source' in l && l.source === layerCode
    );

    // Only update stored specs when clustered (all layers present), not when unclustered
    if (clustered && currentLayers.length > 0) {
      clusterLayerSpecs.current = currentLayers.map((s) => ({ ...s }));
    }

    // Use the stored full set of layer specs (includes cluster + cluster-count even when they're removed)
    const allLayerSpecs = clusterLayerSpecs.current.length > 0
      ? clusterLayerSpecs.current
      : currentLayers;

    // Remove all current layers referencing this source
    for (const l of currentLayers) {
      rawMap.removeLayer(l.id);
    }
    rawMap.removeSource(layerCode);

    if (clustered) {
      // Recreate source WITHOUT clustering
      rawMap.addSource(layerCode, {
        type: 'geojson',
        data: currentData,
      });
      // Re-add only non-cluster layers (skip cluster + cluster-count)
      for (const l of allLayerSpecs) {
        if (l.id === `${layerCode}-cluster` || l.id === `${layerCode}-cluster-count`) continue;
        const restored = { ...l };
        // Remove the cluster filter from the main point layer
        if (restored.id === layerCode && 'filter' in restored) {
          delete (restored as Record<string, unknown>).filter;
        }
        rawMap.addLayer(restored);
      }
      setClustered(false);
    } else {
      // Recreate source WITH clustering
      const cSpec = clusterSourceSpec.current ?? { clusterRadius: 60, clusterMaxZoom: 15 };
      rawMap.addSource(layerCode, {
        type: 'geojson',
        data: currentData,
        cluster: true,
        clusterRadius: cSpec.clusterRadius,
        clusterMaxZoom: cSpec.clusterMaxZoom,
      });
      // Re-add all layers including cluster + cluster-count
      for (const l of allLayerSpecs) {
        const restored = { ...l };
        // Restore the cluster filter on the main point layer
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
    <div className={`absolute ${positionClass} z-10`} style={style}>
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
    </div>
  );
}
