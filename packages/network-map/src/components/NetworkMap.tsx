import { useEffect, useRef, useCallback } from 'react';
import { useMap } from '../context/MapContext';
import type { MapInitOptions, MapFeature } from '../types/map';
import type { LayerConfig } from '../types/layers';
import BaseLayerSwitcher from './BaseLayerSwitcher';
import CoordinateDisplay from './CoordinateDisplay';
import LayerPanel from './LayerPanel';
import FeaturePopup from './FeaturePopup';
import FeatureDetailPanel from './FeatureDetailPanel';
import { useLayerRenderer } from '../hooks/useLayerRenderer';
import { useLayerDataFetcher } from '../hooks/useLayerDataFetcher';

export interface NetworkMapProps {
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  bearing?: number;
  pitch?: number;
  layers?: LayerConfig[];
  baseLayers?: BaseLayerOption[];
  className?: string;
  showLayerPanel?: boolean;
  showBaseLayerSwitcher?: boolean;
  showCoordinates?: boolean;
  showScale?: boolean;
  onFeatureClick?: (feature: MapFeature) => void;
  onFeatureHover?: (feature: MapFeature | null) => void;
  onViewportChange?: (viewport: { center: [number, number]; zoom: number }) => void;
}

export interface BaseLayerOption {
  code: string;
  name: string;
  tileUrl: string;
  attribution?: string;
  isDefault?: boolean;
}

const DEFAULT_BASE_LAYERS: BaseLayerOption[] = [
  {
    code: 'OSM',
    name: 'OpenStreetMap',
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    isDefault: true,
  },
  {
    code: 'SATELLITE',
    name: 'Satellite',
    tileUrl: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '© Google',
  },
  {
    code: 'DARK',
    name: 'Dark',
    tileUrl: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
    attribution: '© CARTO',
  },
];

export default function NetworkMap({
  center = [-46.63, -23.55],
  zoom = 10,
  minZoom,
  maxZoom,
  bearing,
  pitch,
  layers = [],
  baseLayers,
  className = '',
  showLayerPanel = true,
  showBaseLayerSwitcher = true,
  showCoordinates = true,
  showScale = true,
  onFeatureClick,
  onFeatureHover: _onFeatureHover,
  onViewportChange,
}: NetworkMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    initMap,
    destroyMap,
    isReady,
    viewport,
    selectedFeature,
    setLayers,
    setSelectedFeature,
    getAdapter,
  } = useMap();

  const effectiveBaseLayers = baseLayers ?? DEFAULT_BASE_LAYERS;
  const defaultBase = effectiveBaseLayers.find((b) => b.isDefault) ?? effectiveBaseLayers[0];

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;
    // Build initial sources: include MVT layers in the style so MapLibre
    // registers them at init time (dynamically added vector sources can
    // fail to trigger tile fetches in some MapLibre versions).
    const initialSources: Record<string, unknown> = {
      'base-raster': {
        type: 'raster',
        tiles: [defaultBase.tileUrl],
        tileSize: 256,
        maxzoom: 19,
        attribution: defaultBase.attribution ?? '',
      },
    };
    for (const layer of layers) {
      if (layer.source.type === 'mvt') {
        const tileUrl = layer.source.url.startsWith('http')
          ? layer.source.url
          : `${window.location.origin}${layer.source.url}`;
        initialSources[layer.code] = {
          type: 'vector',
          tiles: [tileUrl],
          minzoom: layer.minZoom ?? 0,
          maxzoom: layer.maxZoom ?? 22,
        };
      }
    }

    const options: MapInitOptions = {
      center,
      zoom,
      minZoom,
      maxZoom,
      bearing,
      pitch,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: initialSources,
        layers: [{ id: 'base-layer', type: 'raster', source: 'base-raster' }],
      },
    };
    initMap(containerRef.current, options);
    return () => destroyMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync layers to context
  useEffect(() => {
    setLayers(layers);
  }, [layers, setLayers]);

  // Render data layers
  useLayerRenderer(layers);

  // Auto-fetch GeoJSON data from backend spatial API
  useLayerDataFetcher(layers);

  // Navigation controls
  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter) return;
    adapter.addNavigationControl('top-right');
    if (showScale) adapter.addScaleControl('bottom-left');
    adapter.addFullscreenControl('top-right');
  }, [isReady, getAdapter, showScale]);

  // Viewport change callback
  useEffect(() => {
    if (viewport && onViewportChange) {
      onViewportChange({ center: viewport.center, zoom: viewport.zoom });
    }
  }, [viewport, onViewportChange]);

  // Feature click handling
  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter) return;

    const interactiveCodes = layers.filter((l) => l.interactive !== false).map((l) => l.code);
    // Include MVT sub-layer IDs so queryRenderedFeatures picks up clustered/unclustered features
    const interactiveLayers = interactiveCodes.flatMap((code) => [
      code, `${code}-unclustered`, `${code}-cluster`, `${code}-cluster-count`,
    ]);

    const handleClick = (e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => {
      const features = adapter.queryRenderedFeatures(e.point, interactiveLayers) as {
        layer: { id: string };
        properties: Record<string, unknown>;
        geometry: GeoJSON.Geometry;
      }[];
      if (features.length === 0) {
        setSelectedFeature(null);
        return;
      }

      // Prefer non-cluster features — cluster layers often overlap individual points
      const nonCluster = features.find((ft) => ft.properties.point_count == null);
      const clusterHit = features.find((ft) => ft.properties.point_count != null);

      if (nonCluster) {
        // Resolve MVT sub-layer IDs back to the parent layer code
        let resolvedLayerCode = nonCluster.layer.id;
        for (const suffix of ['-cluster-count', '-cluster', '-unclustered', '-label']) {
          if (resolvedLayerCode.endsWith(suffix)) {
            resolvedLayerCode = resolvedLayerCode.slice(0, -suffix.length);
            break;
          }
        }
        // Fallback: match against known layer codes
        if (!layers.some((l) => l.code === resolvedLayerCode)) {
          const base = layers.find((l) => resolvedLayerCode.startsWith(l.code));
          if (base) resolvedLayerCode = base.code;
        }
        const mapFeature: MapFeature = {
          id: (nonCluster.properties.id ?? nonCluster.properties.feature_id ?? '') as string | number,
          layerCode: resolvedLayerCode,
          geometry: nonCluster.geometry,
          properties: { ...nonCluster.properties, lat: e.lngLat.lat, lng: e.lngLat.lng },
        };
        setSelectedFeature(mapFeature);
        onFeatureClick?.(mapFeature);
      } else if (clusterHit) {
        // Only cluster features at this point — zoom in to reveal individual points
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawMap = adapter.getRawMap() as any;
        if (rawMap) {
          rawMap.easeTo({
            center: [e.lngLat.lng, e.lngLat.lat],
            zoom: adapter.getViewport().zoom + 2,
          });
        }
      }
    };

    adapter.on('click', handleClick);
    return () => adapter.off('click', handleClick);
  }, [isReady, layers, getAdapter, setSelectedFeature, onFeatureClick]);

  // Feature hover handling — cursor change only
  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter) return;

    const hoverCodes = layers.filter((l) => l.interactive !== false).map((l) => l.code);
    const hoverLayers = hoverCodes.flatMap((code) => [
      code, `${code}-unclustered`, `${code}-cluster`, `${code}-cluster-count`,
    ]);

    const handleMouseMove = (e: { point: { x: number; y: number } }) => {
      const features = adapter.queryRenderedFeatures(e.point, hoverLayers) as {
        layer: { id: string };
        properties: Record<string, unknown>;
        geometry: GeoJSON.Geometry;
      }[];
      if (features.length > 0) {
        adapter.setCursor('pointer');
      } else {
        adapter.setCursor('');
      }
    };

    adapter.on('mousemove', handleMouseMove);
    return () => adapter.off('mousemove', handleMouseMove);
  }, [isReady, layers, getAdapter]);

  // Layer visibility toggle
  const handleLayerToggle = useCallback(
    (layerCode: string) => {
      const adapter = getAdapter();
      if (!adapter) return;
      if (!adapter.hasLayer(layerCode)) return;
      const rawMap = adapter.getRawMap() as { getLayoutProperty: (l: string, p: string) => string } | null;
      const style = rawMap?.getLayoutProperty(layerCode, 'visibility');
      adapter.setLayerVisibility(layerCode, style === 'none');
    },
    [getAdapter],
  );

  // Base layer switch — sets the whole map style's base raster
  const handleBaseLayerChange = useCallback(
    (baseLayer: BaseLayerOption) => {
      const adapter = getAdapter();
      if (!adapter) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawMap = adapter.getRawMap() as any;
      if (!rawMap) return;

      try {
        // Remove existing base layer + source
        if (rawMap.getLayer('base-layer')) rawMap.removeLayer('base-layer');
        if (rawMap.getSource('base-raster')) rawMap.removeSource('base-raster');

        // Add new raster source
        rawMap.addSource('base-raster', {
          type: 'raster',
          tiles: [baseLayer.tileUrl],
          tileSize: 256,
          attribution: baseLayer.attribution ?? '',
          maxzoom: 19,
        });

        // Find the first existing data layer to place the base behind it
        const style = rawMap.getStyle();
        const firstDataLayer = style?.layers?.find(
          (l: { id: string }) => l.id !== 'base-layer'
        );

        rawMap.addLayer(
          { id: 'base-layer', type: 'raster', source: 'base-raster' },
          firstDataLayer?.id,
        );
      } catch (err) {
        console.warn('[NetworkMap] Base layer switch failed:', err);
      }
    },
    [getAdapter],
  );

  // Find layer config for popup/detail — both driven by click (selectedFeature)
  const activePopupLayer = selectedFeature
    ? layers.find((l) => l.code === selectedFeature.layerCode)
    : null;
  const activeDetailLayer = selectedFeature
    ? layers.find((l) => l.code === selectedFeature.layerCode)
    : null;

  return (
    <div className={`relative h-full w-full ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />

      {showLayerPanel && isReady && (
        <LayerPanel
          layers={layers.map((l) => ({ id: l.code, name: l.name, visible: l.visibleByDefault !== false }))}
          onToggle={handleLayerToggle}
        />
      )}

      {showBaseLayerSwitcher && isReady && (
        <BaseLayerSwitcher
          baseLayers={effectiveBaseLayers}
          defaultCode={defaultBase.code}
          onChange={handleBaseLayerChange}
        />
      )}

      {showCoordinates && isReady && viewport && (
        <CoordinateDisplay
          lat={viewport.center[1]}
          lng={viewport.center[0]}
          zoom={viewport.zoom}
        />
      )}

      {selectedFeature && activePopupLayer?.popup && !activePopupLayer?.detailPanel && (
        <FeaturePopup
          feature={selectedFeature}
          config={activePopupLayer.popup}
        />
      )}

      {selectedFeature && activeDetailLayer?.detailPanel && (
        <FeatureDetailPanel
          feature={selectedFeature}
          config={activeDetailLayer.detailPanel}
          onClose={() => setSelectedFeature(null)}
        />
      )}
    </div>
  );
}
