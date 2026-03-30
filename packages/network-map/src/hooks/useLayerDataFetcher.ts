import { useEffect, useRef, useCallback } from 'react';
import { useMap } from '../context/MapContext';
import type { LayerConfig } from '../types/layers';
import { apiClient } from '@fsa/shared-api';

/**
 * Auto-fetches GeoJSON data from the backend spatial API for layers
 * that use { type: 'geojson', url: '...' } sources.
 * Re-fetches when the viewport changes (moveend), with debounce to
 * avoid excessive requests during pan/zoom.
 * Skips fetching when zoom is below layer.minZoom to save bandwidth.
 */
export function useLayerDataFetcher(layers: LayerConfig[]) {
  const { getAdapter, isReady, viewport, invalidatedLayers, clearInvalidation, layerInvalidationKey } = useMap();
  const intervalRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const fetchedKeys = useRef<Map<string, string>>(new Map());

  const doFetch = useCallback(() => {
    const adapter = getAdapter();
    if (!adapter) return;

    const bbox = viewport?.bounds;
    const zoom = viewport?.zoom ?? 12;

    // Clear dedup keys for invalidated layers so they are re-fetched
    for (const code of invalidatedLayers) {
      fetchedKeys.current.delete(code);
      clearInvalidation(code);
    }

    for (const layer of layers) {
      if (layer.source.type !== 'geojson') continue;

      // Skip fetching if current zoom is below layer minZoom — no need to load data
      if (layer.minZoom && zoom < layer.minZoom - 1) continue;

      const url = layer.source.url;
      const bboxParam = bbox
        ? `${bbox.west.toFixed(6)},${bbox.south.toFixed(6)},${bbox.east.toFixed(6)},${bbox.north.toFixed(6)}`
        : undefined;

      // Deduplicate: skip if same bbox+zoom already fetched for this layer
      const fetchKey = `${bboxParam}|${Math.round(zoom)}`;
      if (fetchedKeys.current.get(layer.code) === fetchKey) continue;

      const fetchData = () => {
        // Abort previous in-flight request for this layer
        const prev = abortControllers.current.get(layer.code);
        if (prev) prev.abort();
        const ctrl = new AbortController();
        abortControllers.current.set(layer.code, ctrl);

        const params: Record<string, string | number> = { zoom: Math.round(zoom) };
        if (bboxParam) params.bbox = bboxParam;

        apiClient
          .get(url, { params, signal: ctrl.signal })
          .then((res) => {
            if (adapter.hasSource(layer.code)) {
              adapter.updateGeoJSONSource(layer.code, res.data);
              fetchedKeys.current.set(layer.code, fetchKey);
            }
          })
          .catch((err) => {
            if (err?.code === 'ERR_CANCELED') return;
            console.warn(`[useLayerDataFetcher] Failed to fetch data for layer "${layer.code}":`, err);
          });
      };

      fetchData();

      // Set up refresh interval if configured
      if (layer.source.refreshInterval && layer.source.refreshInterval > 0) {
        const existing = intervalRefs.current.get(layer.code);
        if (existing) clearInterval(existing);
        const handle = setInterval(fetchData, layer.source.refreshInterval);
        intervalRefs.current.set(layer.code, handle);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAdapter, viewport, layers, invalidatedLayers, clearInvalidation]);

  // Re-fetch on viewport changes (debounced)
  useEffect(() => {
    if (!isReady) return;

    // Debounce viewport changes to avoid rapid-fire requests during pan/zoom
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(doFetch, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      for (const [, handle] of intervalRefs.current) {
        clearInterval(handle);
      }
      intervalRefs.current.clear();
      for (const [, ctrl] of abortControllers.current) {
        ctrl.abort();
      }
      abortControllers.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, doFetch]);

  // Immediate re-fetch when layers are explicitly invalidated (no debounce)
  useEffect(() => {
    if (!isReady || layerInvalidationKey === 0) return;
    doFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerInvalidationKey]);
}
