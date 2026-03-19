import maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { MapAdapter } from './MapAdapter';
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

export class MapLibreAdapter implements MapAdapter {
  private map: maplibregl.Map | null = null;
  private popup: maplibregl.Popup | null = null;
  private markers = new Map<string, maplibregl.Marker>();
  private ready = false;

  init(container: HTMLElement, options: MapInitOptions): void {
    const style = options.style ?? {
      version: 8 as const,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm-base',
          type: 'raster',
          source: 'osm',
        },
      ],
    };

    this.map = new maplibregl.Map({
      container,
      style: style as maplibregl.StyleSpecification,
      center: options.center,
      zoom: options.zoom,
      minZoom: options.minZoom ?? 0,
      maxZoom: options.maxZoom ?? 22,
      bearing: options.bearing ?? 0,
      pitch: options.pitch ?? 0,
    });

    this.map.on('load', () => {
      this.ready = true;
    });
  }

  destroy(): void {
    try {
      this.popup?.remove();
      this.markers.forEach((m) => m.remove());
      this.markers.clear();
      this.map?.remove();
    } catch {
      // Ignore errors during cleanup
    }
    this.map = null;
    this.ready = false;
  }

  resize(): void {
    this.map?.resize();
  }

  isReady(): boolean {
    return this.ready;
  }

  // ─── Viewport ───────────────────────────────────────

  getViewport(): Viewport {
    const m = this.requireMap();
    const center = m.getCenter();
    const bounds = m.getBounds();
    return {
      center: [center.lng, center.lat],
      zoom: m.getZoom(),
      bearing: m.getBearing(),
      pitch: m.getPitch(),
      bounds: {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      },
    };
  }

  setCenter(center: [number, number], animate = true): void {
    if (animate) {
      this.requireMap().flyTo({ center });
    } else {
      this.requireMap().setCenter(center);
    }
  }

  setZoom(zoom: number, animate = true): void {
    if (animate) {
      this.requireMap().flyTo({ zoom });
    } else {
      this.requireMap().setZoom(zoom);
    }
  }

  fitBounds(bounds: LngLatBounds, padding = 40): void {
    this.requireMap().fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding },
    );
  }

  setBearing(bearing: number, animate = true): void {
    if (animate) {
      this.requireMap().flyTo({ bearing });
    } else {
      this.requireMap().setBearing(bearing);
    }
  }

  setPitch(pitch: number, animate = true): void {
    if (animate) {
      this.requireMap().flyTo({ pitch });
    } else {
      this.requireMap().setPitch(pitch);
    }
  }

  // ─── Sources ────────────────────────────────────────

  addGeoJSONSource(id: string, data: FeatureCollection, options?: GeoJSONSourceOptions): void {
    this.requireMap().addSource(id, {
      type: 'geojson',
      data,
      ...(options?.cluster ? {
        cluster: true,
        clusterRadius: options.clusterRadius ?? 50,
        clusterMaxZoom: options.clusterMaxZoom ?? 14,
      } : {}),
    });
  }

  updateGeoJSONSource(id: string, data: FeatureCollection): void {
    const m = this.safeMap();
    if (!m) return;
    const source = m.getSource(id) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
    }
  }

  addVectorSource(id: string, url: string, options?: VectorSourceOptions): void {
    this.requireMap().addSource(id, {
      type: 'vector',
      tiles: [url],
      minzoom: options?.minzoom ?? 0,
      maxzoom: options?.maxzoom ?? 22,
    });
  }

  addRasterSource(id: string, tiles: string[], options?: RasterSourceOptions): void {
    this.requireMap().addSource(id, {
      type: 'raster',
      tiles,
      tileSize: options?.tileSize ?? 256,
      attribution: options?.attribution,
      minzoom: options?.minzoom,
      maxzoom: options?.maxzoom,
    });
  }

  removeSource(id: string): void {
    const m = this.safeMap();
    if (m?.getSource(id)) {
      m.removeSource(id);
    }
  }

  hasSource(id: string): boolean {
    return !!this.safeMap()?.getSource(id);
  }

  // ─── Layers ─────────────────────────────────────────

  addLayer(spec: MapLayerSpec, beforeId?: string): void {
    const layerDef: maplibregl.LayerSpecification = {
      id: spec.id,
      type: spec.type as maplibregl.LayerSpecification['type'],
      source: spec.source,
      ...(spec.sourceLayer ? { 'source-layer': spec.sourceLayer } : {}),
      ...(spec.minzoom !== undefined ? { minzoom: spec.minzoom } : {}),
      ...(spec.maxzoom !== undefined ? { maxzoom: spec.maxzoom } : {}),
      ...(spec.paint ? { paint: spec.paint } : {}),
      ...(spec.layout ? { layout: spec.layout } : {}),
      ...(spec.filter ? { filter: spec.filter } : {}),
    } as maplibregl.LayerSpecification;
    try {
      this.requireMap().addLayer(layerDef, beforeId);
    } catch (err) {
      console.warn(`[MapLibreAdapter] Failed to add layer "${spec.id}":`, err);
    }
  }

  removeLayer(id: string): void {
    const m = this.safeMap();
    if (m?.getLayer(id)) {
      m.removeLayer(id);
    }
  }

  hasLayer(id: string): boolean {
    return !!this.safeMap()?.getLayer(id);
  }

  setLayerVisibility(id: string, visible: boolean): void {
    this.safeMap()?.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }

  setLayerPaint(id: string, property: string, value: unknown): void {
    this.requireMap().setPaintProperty(id, property, value);
  }

  setLayerFilter(id: string, filter: unknown[]): void {
    this.requireMap().setFilter(id, filter as maplibregl.FilterSpecification);
  }

  // ─── Events ─────────────────────────────────────────

  on(event: MapEventType, handlerOrLayerId: MapEventHandler | string, handler?: MapEventHandler): void {
    const m = this.safeMap();
    if (!m) return;
    if (typeof handlerOrLayerId === 'string' && handler) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m as any).on(event, handlerOrLayerId, handler);
    } else if (typeof handlerOrLayerId === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m as any).on(event, handlerOrLayerId);
    }
  }

  off(event: MapEventType, handlerOrLayerId: MapEventHandler | string, handler?: MapEventHandler): void {
    const m = this.safeMap();
    if (!m) return;
    if (typeof handlerOrLayerId === 'string' && handler) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m as any).off(event, handlerOrLayerId, handler);
    } else if (typeof handlerOrLayerId === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m as any).off(event, handlerOrLayerId);
    }
  }

  // ─── Popup ──────────────────────────────────────────

  showPopup(lngLat: [number, number], html: string): void {
    this.hidePopup();
    this.popup = new maplibregl.Popup({ closeOnClick: true, maxWidth: '320px' })
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(this.requireMap());
  }

  hidePopup(): void {
    this.popup?.remove();
    this.popup = null;
  }

  // ─── Markers ────────────────────────────────────────

  addMarker(id: string, lngLat: [number, number], element?: HTMLElement): void {
    this.removeMarker(id);
    const opts: maplibregl.MarkerOptions = element ? { element } : {};
    const marker = new maplibregl.Marker(opts).setLngLat(lngLat).addTo(this.requireMap());
    this.markers.set(id, marker);
  }

  removeMarker(id: string): void {
    const marker = this.markers.get(id);
    if (marker) {
      marker.remove();
      this.markers.delete(id);
    }
  }

  // ─── Controls ───────────────────────────────────────

  addNavigationControl(position: ControlPosition = 'top-right'): void {
    this.requireMap().addControl(new maplibregl.NavigationControl(), position);
  }

  addScaleControl(position: ControlPosition = 'bottom-left'): void {
    this.requireMap().addControl(new maplibregl.ScaleControl({ unit: 'metric' }), position);
  }

  addFullscreenControl(position: ControlPosition = 'top-right'): void {
    this.requireMap().addControl(new maplibregl.FullscreenControl(), position);
  }

  // ─── Interaction ────────────────────────────────────

  setCursor(cursor: string): void {
    const canvas = this.safeMap()?.getCanvas();
    if (canvas) canvas.style.cursor = cursor;
  }

  queryRenderedFeatures(point: { x: number; y: number }, layerIds?: string[]): unknown[] {
    const m = this.safeMap();
    if (!m) return [];
    return m.queryRenderedFeatures([point.x, point.y], {
      layers: layerIds,
    });
  }

  queryRenderedFeaturesInBox(
    sw: { x: number; y: number },
    ne: { x: number; y: number },
    layerIds?: string[],
  ): unknown[] {
    const m = this.safeMap();
    if (!m) return [];
    return m.queryRenderedFeatures(
      [[sw.x, sw.y], [ne.x, ne.y]],
      layerIds ? { layers: layerIds } : undefined,
    );
  }

  project(lngLat: [number, number]): { x: number; y: number } {
    const p = this.requireMap().project(lngLat);
    return { x: p.x, y: p.y };
  }

  unproject(point: { x: number; y: number }): [number, number] {
    const ll = this.requireMap().unproject([point.x, point.y]);
    return [ll.lng, ll.lat];
  }

  // ─── Canvas / raw ───────────────────────────────────

  getCanvas(): HTMLCanvasElement | null {
    return this.map?.getCanvas() ?? null;
  }

  getRawMap(): maplibregl.Map | null {
    return this.map;
  }

  // ─── Helpers ────────────────────────────────────────

  private requireMap(): maplibregl.Map {
    if (!this.map) throw new Error('Map not initialized');
    return this.map;
  }

  private safeMap(): maplibregl.Map | null {
    return this.map;
  }
}
