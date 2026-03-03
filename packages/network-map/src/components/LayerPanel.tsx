import { useState } from 'react';
import { Layers, Eye, EyeOff } from 'lucide-react';

interface Layer {
  id: string;
  name: string;
  visible: boolean;
}

interface LayerPanelProps {
  layers: Layer[];
  onToggle: (id: string) => void;
}

export default function LayerPanel({ layers, onToggle }: LayerPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="absolute left-4 top-4 z-10 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <Layers size={16} />
        Layers
      </button>
      {open && (
        <div className="max-h-64 overflow-auto p-2">
          {layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => onToggle(layer.id)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} className="text-gray-400" />}
              <span className={layer.visible ? '' : 'text-gray-400'}>{layer.name}</span>
            </button>
          ))}
          {layers.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">No layers available</p>
          )}
        </div>
      )}
    </div>
  );
}
