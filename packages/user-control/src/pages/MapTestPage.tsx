import React, { useMemo, useCallback, useState, useRef } from 'react';
import {
  MapProvider,
  MapLibreAdapter,
  NetworkMap,
  SearchBar,
  LegendPanel,
  MeasureTool,
  DrawTool,
  BufferTool,
  ClusterToggle,
} from '@fsa/network-map';
import type { LayerConfig } from '@fsa/network-map';
import { MapPin } from 'lucide-react';

export default function MapTestPage() {
  const adapterFactory = useMemo(() => () => new MapLibreAdapter(), []);
  const [lastDrawnGeometry, setLastDrawnGeometry] = useState<GeoJSON.Geometry | null>(null);
  // Track which drawId owns the current buffer so we can clear it when that figure is deleted
  const [bufferOwnerDrawId, setBufferOwnerDrawId] = useState<string | null>(null);
  const clearBufferRef = useRef<(() => void) | null>(null);

  const handleDrawComplete = useCallback((geometry: GeoJSON.Geometry, drawId: string) => {
    // eslint-disable-next-line no-console
    console.log('[DrawTool] Geometry drawn:', drawId, JSON.stringify(geometry));
    setLastDrawnGeometry(geometry);
    setBufferOwnerDrawId(drawId);
  }, []);

  const handleFeatureDeleted = useCallback((drawId: string) => {
    // eslint-disable-next-line no-console
    console.log('[DrawTool] Feature deleted:', drawId);
    // If the deleted figure owns the buffer, clear it
    if (drawId === bufferOwnerDrawId) {
      clearBufferRef.current?.();
      setLastDrawnGeometry(null);
      setBufferOwnerDrawId(null);
    }
  }, [bufferOwnerDrawId]);

  const handleSpatialQuery = useCallback((drawnGeometry: GeoJSON.Geometry, features: GeoJSON.Feature[]) => {
    // eslint-disable-next-line no-console
    console.log(
      `[SpatialQuery] Found ${features.length} features inside drawn ${drawnGeometry.type}:`,
      features.map((f) => ({ id: f.properties?.id, layer: (f as unknown as { layer?: { id?: string } }).layer?.id, props: f.properties })),
    );
  }, []);

  // ─── Layer configurations showcasing all features ──────

  const layers: LayerConfig[] = useMemo(
    () => [
      // ── Line layer: MT Wires (Rede Média Tensão) ──────
      {
        code: 'mt-wires',
        name: 'Rede MT',
        geometryType: 'line',
        source: {
          type: 'geojson',
          url: '/network-map/spatial/geojson?layerCode=mt-wires',
        },
        style: {
          color: '#ef4444',
          width: 3,
          opacity: 0.9,
        },
        minZoom: 13,
        interactive: true,
        visibleByDefault: true,
        legendEnabled: true,
        zOrder: 10,
        symbologyRules: [
          {
            name: 'Rede MT',
            condition: { field: 'WireOfLine', value: '*' },
            style: { color: '#ef4444' },
            sortOrder: 0,
            isLegendVisible: true,
          },
        ],
        popup: {
          trigger: 'click',
          title: 'Trecho MT',
          fields: [
            { property: 'WireOfLine', label: 'Cabo', format: 'text' },
          ],
        },
      },

      // ── Line layer: LT Wires (Rede Baixa Tensão) ─────
      {
        code: 'lt-wires',
        name: 'Rede BT',
        geometryType: 'line',
        source: {
          type: 'geojson',
          url: '/network-map/spatial/geojson?layerCode=lt-wires',
        },
        style: {
          color: '#f97316',
          width: 2,
          opacity: 0.8,
          dashArray: [6, 3],
        },
        minZoom: 14,
        interactive: true,
        visibleByDefault: true,
        legendEnabled: true,
        zOrder: 8,
        symbologyRules: [
          {
            name: 'Rede BT',
            condition: { field: 'id', value: '*' },
            style: { color: '#f97316' },
            sortOrder: 0,
            isLegendVisible: true,
          },
        ],
        popup: {
          trigger: 'click',
          title: 'Trecho BT',
          fields: [],
        },
      },

      // ── Point layer: Geographic Points (Postes) ───────
      {
        code: 'geographic-points',
        name: 'Postes',
        geometryType: 'point',
        source: {
          type: 'geojson',
          url: '/network-map/spatial/geojson?layerCode=geographic-points',
        },
        style: {
          color: '#22c55e',
          iconSize: 6,
          outlineColor: '#ffffff',
          outlineWidth: 2,
          opacity: 0.95,
        },
        minZoom: 10,
        interactive: true,
        visibleByDefault: true,
        legendEnabled: true,
        zOrder: 20,
        cluster: {
          enabled: true,
          maxZoom: 15,
          radius: 60,
        },
        symbologyRules: [
          {
            name: 'Poste',
            condition: { field: 'Basement', value: '*' },
            style: { color: '#22c55e' },
            sortOrder: 0,
            isLegendVisible: true,
          },
        ],
        labelField: 'Basement',
        labelMinZoom: 15,
        popup: {
          trigger: 'click',
          title: 'Poste {Basement}',
          maxWidth: 320,
          fields: [
            { property: 'Basement', label: 'Código', format: 'text' },
            { property: 'Neighborhood', label: 'Bairro', format: 'text' },
            { property: 'Address', label: 'Endereço', format: 'text' },
            { property: 'Zone', label: 'Zona', format: 'text' },
          ],
        },
        detailPanel: {
          title: 'Poste {Basement}',
          subtitle: '{Neighborhood} — {Address}',
          width: 400,
          position: 'right',
          header: {
            badges: [
              { property: 'Zone', label: 'Zona' },
              { property: 'Neighborhood', label: 'Bairro' },
            ],
            actions: [
              {
                label: 'Google Maps',
                action: 'navigate' as const,
                url: 'https://maps.google.com/?q={lat},{lng}',
              },
            ],
          },
          sections: [
            {
              title: 'Informações do Poste',
              type: 'attributes' as const,
              collapsible: true,
              config: {
                columns: 2,
                fields: [
                  { property: 'Basement', label: 'Código Base', format: 'text', copyable: true },
                  { property: 'Address', label: 'Endereço', format: 'text' },
                  { property: 'Neighborhood', label: 'Bairro', format: 'text' },
                  { property: 'Zone', label: 'Zona', format: 'text' },
                ],
              },
            },
          ],
        },
      },

      // ── Point layer: Transformers MT ──────────────────
      {
        code: 'transformers',
        name: 'Transformadores MT',
        geometryType: 'point',
        source: {
          type: 'geojson',
          url: '/network-map/spatial/geojson?layerCode=transformers',
        },
        style: {
          color: '#8b5cf6',
          iconSize: 7,
          outlineColor: '#ffffff',
          outlineWidth: 1.5,
          opacity: 0.9,
        },
        minZoom: 10,
        interactive: true,
        visibleByDefault: true,
        legendEnabled: true,
        zOrder: 18,
        symbologyRules: [
          {
            name: 'Transformador',
            condition: { field: 'InstallationCode', value: '*' },
            style: { color: '#8b5cf6' },
            sortOrder: 0,
            isLegendVisible: true,
          },
        ],
        popup: {
          trigger: 'click',
          title: 'Trafo {InstallationCode}',
          fields: [
            { property: 'InstallationCode', label: 'Código Instalação', format: 'text' },
            { property: 'Plate', label: 'Placa', format: 'text' },
          ],
        },
      },

      // ── Point layer: MT Equipment ─────────────────────
      {
        code: 'mt-equipment',
        name: 'Equipamentos MT',
        geometryType: 'point',
        source: {
          type: 'geojson',
          url: '/network-map/spatial/geojson?layerCode=mt-equipment',
        },
        style: {
          color: '#eab308',
          iconSize: 6,
          outlineColor: '#ffffff',
          outlineWidth: 1.5,
          opacity: 0.9,
        },
        minZoom: 13,
        interactive: true,
        visibleByDefault: true,
        legendEnabled: true,
        zOrder: 16,
        symbologyRules: [
          {
            name: 'Equipamento MT',
            condition: { field: 'Basement', value: '*' },
            style: { color: '#eab308' },
            sortOrder: 0,
            isLegendVisible: true,
          },
        ],
        popup: {
          trigger: 'click',
          title: 'Equipamento',
          fields: [
            { property: 'Basement', label: 'Poste', format: 'text' },
            { property: 'Neighborhood', label: 'Bairro', format: 'text' },
          ],
        },
      },

      // ── Point layer: Meters (clustered) ───────────────
      {
        code: 'meters',
        name: 'Medidores',
        geometryType: 'point',
        source: {
          type: 'geojson',
          url: '/network-map/spatial/geojson?layerCode=meters',
        },
        style: {
          color: '#06b6d4',
          iconSize: 4,
          outlineColor: '#ffffff',
          outlineWidth: 1,
          opacity: 0.85,
        },
        minZoom: 15,
        interactive: true,
        visibleByDefault: true,
        legendEnabled: true,
        zOrder: 15,
        cluster: {
          enabled: true,
          maxZoom: 17,
          radius: 50,
        },
        symbologyRules: [
          {
            name: 'Medidor',
            condition: { field: 'Basement', value: '*' },
            style: { color: '#06b6d4' },
            sortOrder: 0,
            isLegendVisible: true,
          },
        ],
        popup: {
          trigger: 'click',
          title: 'Medidor — Poste {Basement}',
          fields: [
            { property: 'Basement', label: 'Poste', format: 'text' },
            { property: 'Neighborhood', label: 'Bairro', format: 'text' },
          ],
        },
      },
    ],
    [],
  );

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
          <MapPin size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Teste de Mapa</h1>
          <p className="text-xs text-gray-500">
            Demonstração completa do componente NetworkMap — Salvador de Bahía
          </p>
        </div>
      </div>

      <div className="-mx-5 -mb-5 flex h-[calc(100vh-8.5rem)] flex-col">
        <MapProvider adapterFactory={adapterFactory}>
          <div className="relative flex-1">
            <NetworkMap
              center={[-38.4613, -12.9714]}
              zoom={11}
              layers={layers}
              showLayerPanel
              showBaseLayerSwitcher
              showCoordinates
              showScale
            />
            <SearchBar placeholder="Buscar postes, transformadores..." />
            <LegendPanel layers={layers} />
            <MeasureTool position="top-right" style={{ top: 220 }} />
            <BufferTool position="top-right" style={{ top: 355 }} radiusOptions={[50, 100, 200, 500]} drawnGeometry={lastDrawnGeometry} clearBufferRef={clearBufferRef} />
            <ClusterToggle layerCode="geographic-points" label="Clusters" position="top-right" style={{ top: 310 }} />
            <DrawTool position="top-right" style={{ top: 400 }} onDrawComplete={handleDrawComplete} onFeatureDeleted={handleFeatureDeleted} onSpatialQuery={handleSpatialQuery} />

          </div>
        </MapProvider>
      </div>
    </>
  );
}
