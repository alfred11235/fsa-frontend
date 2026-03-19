import { useState } from 'react';
import { Palette, ChevronDown, ChevronRight } from 'lucide-react';
import type { LayerConfig, SymbologyRule } from '../types/layers';

interface LegendPanelProps {
  layers: LayerConfig[];
}

export default function LegendPanel({ layers }: LegendPanelProps) {
  const [open, setOpen] = useState(true);

  const legendLayers = layers.filter(
    (l) => l.legendEnabled !== false && l.symbologyRules && l.symbologyRules.length > 0,
  );

  if (legendLayers.length === 0) return null;

  return (
    <div className="absolute bottom-8 left-4 z-10 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 border-b border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <Palette size={16} />
        Legend
        <span className="ml-auto">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open && (
        <div className="max-h-64 overflow-auto p-2">
          {legendLayers.map((layer) => (
            <LegendLayerGroup key={layer.code} layer={layer} />
          ))}
        </div>
      )}
    </div>
  );
}

function LegendLayerGroup({ layer }: { layer: LayerConfig }) {
  const [expanded, setExpanded] = useState(true);
  const rules = (layer.symbologyRules ?? []).filter((r) => r.isLegendVisible);

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {layer.name}
      </button>
      {expanded && (
        <div className="ml-4 space-y-0.5">
          {rules.map((rule, idx) => (
            <LegendItem key={idx} rule={rule} geometryType={layer.geometryType} />
          ))}
        </div>
      )}
    </div>
  );
}

function LegendItem({ rule, geometryType }: { rule: SymbologyRule; geometryType: string }) {
  const color = (rule.style.color ?? rule.style.fillColor ?? '#3b82f6') as string;

  return (
    <div className="flex items-center gap-2 py-0.5">
      {geometryType === 'point' && (
        <span
          className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
          style={{ backgroundColor: color }}
        />
      )}
      {geometryType === 'line' && (
        <span
          className="inline-block h-0.5 w-4 rounded"
          style={{ backgroundColor: color }}
        />
      )}
      {geometryType === 'polygon' && (
        <span
          className="inline-block h-3 w-4 rounded-sm border border-gray-300"
          style={{ backgroundColor: color, opacity: 0.6 }}
        />
      )}
      <span className="text-xs text-gray-500">{rule.name}</span>
    </div>
  );
}
