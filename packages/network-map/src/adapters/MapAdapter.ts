import type {
  MapInitOptions,
  Viewport,
  LngLatBounds,
  MapLayerSpec,
  MapEventType,
  MapEventHandler,
  ControlPosition,
  RasterSourceOptions,
  VectorSourceOptions,
  GeoJSONSourceOptions,
} from '../types/map';
import type { FeatureCollection } from 'geojson';

/**
 * Provider-agnostic map adapter interface.
 * Implementations wrap specific map libraries (MapLibre, OpenLayers, etc.).
 */
export interface MapAdapter {
  // ─── Lifecycle ──────────────────────────────────────
  init(container: HTMLElement, options: MapInitOptions): void;
  destroy(): void;
  resize(): void;
  isReady(): boolean;

  // ─── Viewport ───────────────────────────────────────
  getViewport(): Viewport;
  setCenter(center: [number, number], animate?: boolean): void;
  setZoom(zoom: number, animate?: boolean): void;
  fitBounds(bounds: LngLatBounds, padding?: number): void;
  setBearing(bearing: number, animate?: boolean): void;
  setPitch(pitch: number, animate?: boolean): void;
  flyTo(center: [number, number], zoom?: number): void;

  // ─── Sources ────────────────────────────────────────
  addGeoJSONSource(id: string, data: FeatureCollection, options?: GeoJSONSourceOptions): void;
  updateGeoJSONSource(id: string, data: FeatureCollection): void;
  addVectorSource(id: string, url: string, options?: VectorSourceOptions): void;
  addRasterSource(id: string, tiles: string[], options?: RasterSourceOptions): void;
  removeSource(id: string): void;
  hasSource(id: string): boolean;
  /** Force a source to re-fetch all tiles (useful after data mutations on MVT sources). */
  refreshSource(id: string): void;

  // ─── Layers ─────────────────────────────────────────
  addLayer(spec: MapLayerSpec, beforeId?: string): void;
  removeLayer(id: string): void;
  hasLayer(id: string): boolean;
  setLayerVisibility(id: string, visible: boolean): void;
  setLayerPaint(id: string, property: string, value: unknown): void;
  setLayerFilter(id: string, filter: unknown[]): void;

  // ─── Events ─────────────────────────────────────────
  on(event: MapEventType, handler: MapEventHandler): void;
  on(event: MapEventType, layerId: string, handler: MapEventHandler): void;
  off(event: MapEventType, handler: MapEventHandler): void;
  off(event: MapEventType, layerId: string, handler: MapEventHandler): void;

  // ─── Popup ──────────────────────────────────────────
  showPopup(lngLat: [number, number], html: string): void;
  hidePopup(): void;

  // ─── Markers ────────────────────────────────────────
  addMarker(id: string, lngLat: [number, number], element?: HTMLElement): void;
  removeMarker(id: string): void;

  // ─── Controls ───────────────────────────────────────
  addNavigationControl(position?: ControlPosition): void;
  addScaleControl(position?: ControlPosition): void;
  addFullscreenControl(position?: ControlPosition): void;

  // ─── Interaction ────────────────────────────────────
  setCursor(cursor: string): void;
  queryRenderedFeatures(point: { x: number; y: number }, layerIds?: string[]): unknown[];
  queryRenderedFeaturesInBox(sw: { x: number; y: number }, ne: { x: number; y: number }, layerIds?: string[]): unknown[];
  project(lngLat: [number, number]): { x: number; y: number };
  unproject(point: { x: number; y: number }): [number, number];

  // ─── Canvas / raw access ────────────────────────────
  getCanvas(): HTMLCanvasElement | null;
  getRawMap(): unknown;
}
