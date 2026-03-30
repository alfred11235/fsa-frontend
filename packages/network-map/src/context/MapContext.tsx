import { createContext, useContext, useRef, useCallback, useState, type ReactNode } from 'react';
import type { MapAdapter } from '../adapters/MapAdapter';
import type { MapInitOptions, Viewport, LngLatBounds, MapFeature } from '../types/map';
import type { LayerConfig } from '../types/layers';

interface MapContextValue {
  adapter: MapAdapter | null;
  viewport: Viewport | null;
  layers: LayerConfig[];
  selectedFeature: MapFeature | null;
  hoveredFeature: MapFeature | null;
  isReady: boolean;
  /** Monotonically increasing counter — bumped by invalidateLayer to trigger re-fetches */
  layerInvalidationKey: number;
  /** Set of layer codes that need re-fetching */
  invalidatedLayers: Set<string>;

  initMap(container: HTMLElement, options: MapInitOptions): void;
  destroyMap(): void;
  setLayers(layers: LayerConfig[]): void;
  setSelectedFeature(feature: MapFeature | null): void;
  setHoveredFeature(feature: MapFeature | null): void;
  getAdapter(): MapAdapter | null;
  /** Invalidate a layer so its data is re-fetched (for GeoJSON sources) */
  invalidateLayer(code: string): void;
  /** Clear a layer from the invalidated set (called by useLayerDataFetcher after re-fetch) */
  clearInvalidation(code: string): void;
}

const MapCtx = createContext<MapContextValue | null>(null);

interface MapProviderProps {
  children: ReactNode;
  adapterFactory: () => MapAdapter;
}

export function MapProvider({ children, adapterFactory }: MapProviderProps) {
  const adapterRef = useRef<MapAdapter | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [layers, setLayers] = useState<LayerConfig[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<MapFeature | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<MapFeature | null>(null);
  const [layerInvalidationKey, setLayerInvalidationKey] = useState(0);
  const invalidatedLayersRef = useRef<Set<string>>(new Set());
  const [invalidatedLayers, setInvalidatedLayers] = useState<Set<string>>(new Set());

  const initMap = useCallback(
    (container: HTMLElement, options: MapInitOptions) => {
      if (adapterRef.current) return;
      const adapter = adapterFactory();
      adapterRef.current = adapter;
      adapter.init(container, options);

      adapter.on('load', () => {
        setIsReady(true);
        setViewport(adapter.getViewport());
      });

      adapter.on('moveend', () => {
        setViewport(adapter.getViewport());
      });
    },
    [adapterFactory],
  );

  const destroyMap = useCallback(() => {
    adapterRef.current?.destroy();
    adapterRef.current = null;
    setIsReady(false);
    setViewport(null);
  }, []);

  const getAdapter = useCallback(() => adapterRef.current, []);

  const invalidateLayer = useCallback((code: string) => {
    invalidatedLayersRef.current.add(code);
    setInvalidatedLayers(new Set(invalidatedLayersRef.current));
    setLayerInvalidationKey((k) => k + 1);
  }, []);

  const clearInvalidation = useCallback((code: string) => {
    invalidatedLayersRef.current.delete(code);
    setInvalidatedLayers(new Set(invalidatedLayersRef.current));
  }, []);

  const value: MapContextValue = {
    adapter: adapterRef.current,
    viewport,
    layers,
    selectedFeature,
    hoveredFeature,
    isReady,
    layerInvalidationKey,
    invalidatedLayers,
    initMap,
    destroyMap,
    setLayers,
    setSelectedFeature,
    setHoveredFeature,
    getAdapter,
    invalidateLayer,
    clearInvalidation,
  };

  return <MapCtx.Provider value={value}>{children}</MapCtx.Provider>;
}

export function useMap(): MapContextValue {
  const ctx = useContext(MapCtx);
  if (!ctx) throw new Error('useMap must be used within <MapProvider>');
  return ctx;
}

export function useMapViewport(): Viewport | null {
  return useMap().viewport;
}

export function useMapBounds(): LngLatBounds | null {
  return useMap().viewport?.bounds ?? null;
}
