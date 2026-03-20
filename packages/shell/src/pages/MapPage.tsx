import { useMemo } from 'react';
import {
  MapProvider,
  MapLibreAdapter,
  NetworkMap,
  SearchBar,
  LegendPanel,
  MeasureTool,
  DrawTool,
} from '@fsa/network-map';
import type { LayerConfig } from '@fsa/network-map';

export default function MapPage() {
  const adapterFactory = useMemo(() => () => new MapLibreAdapter(), []);

  // Example layers — in production these would come from the thematic map API
  const layers: LayerConfig[] = useMemo(
    () => [
      {
        code: 'geographic-points',
        name: 'Geographic Points',
        geometryType: 'point',
        source: {
          type: 'mvt',
          url: '/api/network-map/spatial/mvt/geographic-points/{z}/{x}/{y}.mvt',
          //type: 'geojson',
          //url: '/network-map/spatial/geojson?layerCode=geographic-points',
        },
        style: { color: '#3b82f6', iconSize: 5, outlineColor: '#ffffff', outlineWidth: 1.5 },
        interactive: true,
        visibleByDefault: true,
        cluster: {
          enabled: true,
          maxZoom: 15,
          radius: 60,
        },
        popup: {
          trigger: 'hover',
          title: 'Point #{id}',
          fields: [
            { property: 'type', label: 'Type', format: 'badge' },
          ],
        },
      },
      {
        code: 'mt-wires',
        name: 'MT Wires',
        geometryType: 'line',
        source: {
          type: 'geojson',
          url: '/network-map/spatial/geojson?layerCode=mt-wires',
        },
        style: { color: '#ef4444', width: 2, opacity: 0.8 },
        interactive: true,
        visibleByDefault: true,
      },
      {
        code: 'lt-wires',
        name: 'LT Wires',
        geometryType: 'line',
        source: {
          type: 'geojson',
          url: '/network-map/spatial/geojson?layerCode=lt-wires',
        },
        style: { color: '#f59e0b', width: 1.5, opacity: 0.7 },
        interactive: true,
        visibleByDefault: true,
      },
    ],
    [],
  );

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] flex-col">
      <MapProvider adapterFactory={adapterFactory}>
        <div className="relative flex-1">
          <NetworkMap
            center={[-46.63, -23.55]}
            zoom={12}
            layers={layers}
            showLayerPanel
            showBaseLayerSwitcher
            showCoordinates
            showScale
          />
          <SearchBar />
          <LegendPanel layers={layers} />
          <MeasureTool />
          <DrawTool />
        </div>
      </MapProvider>
    </div>
  );
}
