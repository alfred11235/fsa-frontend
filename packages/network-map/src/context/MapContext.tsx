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

  initMap(container: HTMLElement, options: MapInitOptions): void;
  destroyMap(): void;
  setLayers(layers: LayerConfig[]): void;
  setSelectedFeature(feature: MapFeature | null): void;
  setHoveredFeature(feature: MapFeature | null): void;
  getAdapter(): MapAdapter | null;
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

  const value: MapContextValue = {
    adapter: adapterRef.current,
    viewport,
    layers,
    selectedFeature,
    hoveredFeature,
    isReady,
    initMap,
    destroyMap,
    setLayers,
    setSelectedFeature,
    setHoveredFeature,
    getAdapter,
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
