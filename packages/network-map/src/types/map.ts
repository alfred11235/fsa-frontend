import type { Geometry } from 'geojson';

// ─── Core map types ──────────────────────────────────────

export interface LngLatBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Viewport {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  bounds: LngLatBounds;
}

export interface MapInitOptions {
  center: [number, number];
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  bearing?: number;
  pitch?: number;
  style?: MapStyleSpec;
}

export interface MapStyleSpec {
  version: 8;
  sources: Record<string, unknown>;
  layers: unknown[];
}

export type ControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type MapEventType = 'click' | 'mousemove' | 'mouseenter' | 'mouseleave' | 'moveend' | 'zoomend' | 'load';
export type DrawMode = 'point' | 'line' | 'polygon' | 'circle';

export interface MapFeature {
  id: string | number;
  layerCode: string;
  geometry: Geometry;
  properties: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MapEventHandler = (e: any) => void;

// ─── Source types ────────────────────────────────────────

export interface VectorSourceOptions {
  minzoom?: number;
  maxzoom?: number;
}

export interface RasterSourceOptions {
  tileSize?: number;
  attribution?: string;
  minzoom?: number;
  maxzoom?: number;
}

export interface GeoJSONSourceOptions {
  cluster?: boolean;
  clusterRadius?: number;
  clusterMaxZoom?: number;
}

// ─── Layer style types ───────────────────────────────────

export interface MapLayerStyle {
  color?: string;
  opacity?: number;
  width?: number;
  outlineColor?: string;
  outlineWidth?: number;
  icon?: string;
  iconSize?: number;
  dashArray?: number[];
  fillColor?: string;
  fillOpacity?: number;
  textField?: string;
  textSize?: number;
  textColor?: string;
  textHaloColor?: string;
  textHaloWidth?: number;
}

export type MapLayerType = 'circle' | 'symbol' | 'line' | 'fill' | 'heatmap' | 'fill-extrusion' | 'raster';

export interface MapLayerSpec {
  id: string;
  type: MapLayerType;
  source: string;
  sourceLayer?: string;
  minzoom?: number;
  maxzoom?: number;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: unknown[];
}

// ─── Map control ─────────────────────────────────────────

export interface MapControl {
  type: 'navigation' | 'scale' | 'fullscreen' | 'geolocate' | 'custom';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance?: any;
}
