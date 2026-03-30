import { useEffect, useRef } from 'react';
import { useMap } from '../context/MapContext';
import type { LayerConfig } from '../types/layers';
import type { MapLayerSpec } from '../types/map';

/**
 * Renders LayerConfig[] onto the map adapter.
 * Manages adding/removing sources and layers based on config changes.
 */
export function useLayerRenderer(layers: LayerConfig[]) {
  const { getAdapter, isReady } = useMap();
  const prevLayerCodes = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter) return;

    const currentCodes = new Set(layers.map((l) => l.code));

    // Remove layers that are no longer in config
    for (const code of prevLayerCodes.current) {
      if (!currentCodes.has(code)) {
        removeLayerAndSource(adapter, code);
      }
    }

    // Add or update layers
    for (const layer of layers) {
      if (adapter.hasLayer(layer.code)) {
        // Update source data if GeoJSON
        if (layer.source.type === 'geojson' || layer.source.type === 'geojson-static') {
          // GeoJSON sources can be updated via the adapter
          // For dynamic endpoints, we'd refetch — handled by useLayerDataFetcher
        }
        continue;
      }

      addLayerToMap(adapter, layer);
    }

    prevLayerCodes.current = currentCodes;
  }, [isReady, layers, getAdapter]);
}

function addLayerToMap(adapter: ReturnType<ReturnType<typeof useMap>['getAdapter']>, layer: LayerConfig) {
  if (!adapter) return;

  const sourceId = layer.code;
  const layerId = layer.code;

  // Add source
  if (!adapter.hasSource(sourceId)) {
    if (layer.source.type === 'mvt') {
      adapter.addVectorSource(sourceId, layer.source.url, {
        minzoom: layer.minZoom,
        maxzoom: layer.maxZoom,
      });
    } else if (layer.source.type === 'geojson') {
      // Start with empty data; useLayerDataFetcher will fill it
      const clusterOpts = layer.cluster?.enabled
        ? { cluster: true, clusterRadius: layer.cluster.radius ?? 50, clusterMaxZoom: layer.cluster.maxZoom ?? 14 }
        : undefined;
      adapter.addGeoJSONSource(sourceId, { type: 'FeatureCollection', features: [] }, clusterOpts);
    } else if (layer.source.type === 'geojson-static') {
      const clusterOpts = layer.cluster?.enabled
        ? { cluster: true, clusterRadius: layer.cluster.radius ?? 50, clusterMaxZoom: layer.cluster.maxZoom ?? 14 }
        : undefined;
      adapter.addGeoJSONSource(sourceId, layer.source.data, clusterOpts);
    }
  }

  // Build layer spec based on geometry type
  const spec = buildLayerSpec(layer, sourceId, layerId);
  // If clustering is enabled for GeoJSON, only show unclustered individual points.
  // For MVT, the backend already separates points and clusters into different source-layers.
  if (layer.cluster?.enabled && layer.geometryType === 'point' && layer.source.type !== 'mvt') {
    spec.filter = ['!', ['has', 'point_count']];
  }
  adapter.addLayer(spec);

  // Add label layer if configured
  if (layer.labelField) {
    const labelSpec: MapLayerSpec = {
      id: `${layerId}-label`,
      type: 'symbol',
      source: sourceId,
      ...(layer.source.type === 'mvt' ? { sourceLayer: layer.code } : {}),
      minzoom: layer.labelMinZoom ?? (layer.minZoom ?? 0) + 2,
      layout: {
        'text-field': ['get', layer.labelField],
        'text-font': ['Open Sans Semibold'],
        'text-size': layer.style.textSize ?? 12,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': layer.style.textColor ?? '#374151',
        'text-halo-color': layer.style.textHaloColor ?? '#ffffff',
        'text-halo-width': layer.style.textHaloWidth ?? 1.5,
      },
    };
    adapter.addLayer(labelSpec);
  }

  // Set initial visibility
  if (layer.visibleByDefault === false) {
    adapter.setLayerVisibility(layerId, false);
    if (layer.labelField) {
      adapter.setLayerVisibility(`${layerId}-label`, false);
    }
  }

  // Add cluster layers if cluster config exists
  if (layer.cluster?.enabled) {
    if (layer.source.type === 'mvt') {
      addMVTClusterLayers(adapter, layer, sourceId);
    } else {
      addClusterLayers(adapter, layer, sourceId);
    }
  }

  // Add heatmap layer if configured
  if (layer.heatmap?.enabled) {
    addHeatmapLayer(adapter, layer, sourceId);
  }
}

function buildLayerSpec(layer: LayerConfig, sourceId: string, layerId: string): MapLayerSpec {
  const s = layer.style;
  const isMVT = layer.source.type === 'mvt';

  switch (layer.geometryType) {
    case 'point':
      return {
        id: layerId,
        type: 'circle',
        source: sourceId,
        ...(isMVT ? { sourceLayer: layer.code } : {}),
        minzoom: layer.minZoom,
        maxzoom: layer.maxZoom,
        paint: {
          'circle-radius': s.iconSize ?? 6,
          'circle-color': buildSymbologyExpression(layer, 'color', s.color ?? '#3b82f6'),
          'circle-opacity': s.opacity ?? 0.9,
          'circle-stroke-color': s.outlineColor ?? '#ffffff',
          'circle-stroke-width': s.outlineWidth ?? 1.5,
        },
      };

    case 'line':
      return {
        id: layerId,
        type: 'line',
        source: sourceId,
        ...(isMVT ? { sourceLayer: layer.code } : {}),
        minzoom: layer.minZoom,
        maxzoom: layer.maxZoom,
        paint: {
          'line-color': buildSymbologyExpression(layer, 'color', s.color ?? '#6366f1'),
          'line-width': s.width ?? 2,
          'line-opacity': s.opacity ?? 1,
          ...(s.dashArray ? { 'line-dasharray': s.dashArray } : {}),
          ...(s.lineOffset != null ? { 'line-offset': s.lineOffset } : {}),
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      };

    case 'polygon':
      return {
        id: layerId,
        type: 'fill',
        source: sourceId,
        ...(isMVT ? { sourceLayer: layer.code } : {}),
        minzoom: layer.minZoom,
        maxzoom: layer.maxZoom,
        paint: {
          'fill-color': buildSymbologyExpression(layer, 'fillColor', s.fillColor ?? s.color ?? '#3b82f6'),
          'fill-opacity': s.fillOpacity ?? s.opacity ?? 0.4,
          'fill-outline-color': s.outlineColor ?? '#1e40af',
        },
      };

    default:
      return {
        id: layerId,
        type: 'circle',
        source: sourceId,
        ...(isMVT ? { sourceLayer: layer.code } : {}),
        paint: {
          'circle-radius': 5,
          'circle-color': '#3b82f6',
        },
      };
  }
}

/**
 * Builds a MapLibre expression for symbology rules (case expression).
 */
function buildSymbologyExpression(
  layer: LayerConfig,
  styleProp: string,
  defaultValue: string,
): unknown {
  if (!layer.symbologyRules || layer.symbologyRules.length === 0) return defaultValue;

  const cases: unknown[] = ['case'];
  for (const rule of layer.symbologyRules.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const condition = rule.condition;
    // Simple equality condition: { field: "status", value: "active" }
    if (condition.field && condition.value !== undefined) {
      cases.push(['==', ['get', condition.field as string], condition.value]);
      const ruleValue = (rule.style as Record<string, unknown>)[styleProp];
      cases.push(ruleValue ?? defaultValue);
    }
  }
  cases.push(defaultValue);
  return cases.length > 2 ? cases : defaultValue;
}

function addClusterLayers(
  adapter: NonNullable<ReturnType<ReturnType<typeof useMap>['getAdapter']>>,
  layer: LayerConfig,
  sourceId: string,
) {
  // Use the layer's base color as the uniform cluster color
  const clusterColor = layer.style.color ?? '#3b82f6';

  // Cluster circles — single uniform color, radius scales with point_count
  adapter.addLayer({
    id: `${layer.code}-cluster`,
    type: 'circle',
    source: sourceId,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': clusterColor,
      'circle-opacity': 0.85,
      'circle-radius': ['step', ['get', 'point_count'], 18, 50, 24, 200, 30, 1000, 38],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });

  // Cluster count labels — show point_count number inside each circle
  adapter.addLayer({
    id: `${layer.code}-cluster-count`,
    type: 'symbol',
    source: sourceId,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-size': 13,
      'text-font': ['Open Sans Semibold'],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#ffffff',
    },
  });
}

function addMVTClusterLayers(
  adapter: NonNullable<ReturnType<ReturnType<typeof useMap>['getAdapter']>>,
  layer: LayerConfig,
  sourceId: string,
) {
  // Server-side MVT clustering: the backend emits a "{code}-clusters" source-layer
  // with point_count and point_count_abbreviated properties.
  const clusterColor = layer.style.color ?? '#3b82f6';
  const clusterSourceLayer = `${layer.code}-clusters`;

  adapter.addLayer({
    id: `${layer.code}-cluster`,
    type: 'circle',
    source: sourceId,
    sourceLayer: clusterSourceLayer,
    paint: {
      'circle-color': clusterColor,
      'circle-opacity': 0.85,
      'circle-radius': ['step', ['get', 'point_count'], 18, 50, 24, 200, 30, 1000, 38],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });

  adapter.addLayer({
    id: `${layer.code}-cluster-count`,
    type: 'symbol',
    source: sourceId,
    sourceLayer: clusterSourceLayer,
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-size': 13,
      'text-font': ['Open Sans Semibold'],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#ffffff',
    },
  });

  // Add an unclustered layer (hidden by default) that references the
  // "{code}-unclustered" source-layer containing ALL individual points.
  // ClusterToggle shows this layer when clusters are toggled off.
  const s = layer.style;
  adapter.addLayer({
    id: `${layer.code}-unclustered`,
    type: 'circle',
    source: sourceId,
    sourceLayer: `${layer.code}-unclustered`,
    layout: { visibility: 'none' },
    paint: {
      'circle-color': s.color ?? '#3b82f6',
      'circle-radius': s.iconSize ?? 5,
      'circle-stroke-color': s.outlineColor ?? '#ffffff',
      'circle-stroke-width': s.outlineWidth ?? 1.5,
      'circle-opacity': s.opacity ?? 0.9,
    },
  });
}

function addHeatmapLayer(
  adapter: NonNullable<ReturnType<ReturnType<typeof useMap>['getAdapter']>>,
  layer: LayerConfig,
  sourceId: string,
) {
  const hc = layer.heatmap!;
  adapter.addLayer({
    id: `${layer.code}-heatmap`,
    type: 'heatmap',
    source: sourceId,
    maxzoom: hc.maxZoom ?? 15,
    paint: {
      'heatmap-weight': hc.weight
        ? ['interpolate', ['linear'], ['get', hc.weight], 0, 0, 6, 1]
        : 1,
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, hc.intensity ?? 3],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, hc.radius ?? 20],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(33,102,172,0)',
        0.2, hc.colorRamp?.[0] ?? 'rgb(103,169,207)',
        0.4, hc.colorRamp?.[1] ?? 'rgb(209,229,240)',
        0.6, hc.colorRamp?.[2] ?? 'rgb(253,219,199)',
        0.8, hc.colorRamp?.[3] ?? 'rgb(239,138,98)',
        1.0, hc.colorRamp?.[4] ?? 'rgb(178,24,43)',
      ],
    },
  });
}


function removeLayerAndSource(
  adapter: NonNullable<ReturnType<ReturnType<typeof useMap>['getAdapter']>>,
  code: string,
) {
  // Remove all associated layers
  const suffixes = ['', '-label', '-cluster', '-cluster-count', '-heatmap', '-heatmap-toggle', '-outline'];
  for (const suffix of suffixes) {
    if (adapter.hasLayer(code + suffix)) {
      adapter.removeLayer(code + suffix);
    }
  }
  if (adapter.hasSource(code)) {
    adapter.removeSource(code);
  }
}
