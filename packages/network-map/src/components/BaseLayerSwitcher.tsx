import { useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import type { BaseLayerOption } from './NetworkMap';

interface BaseLayerSwitcherProps {
  baseLayers: BaseLayerOption[];
  defaultCode: string;
  onChange: (layer: BaseLayerOption) => void;
}

export default function BaseLayerSwitcher({ baseLayers, defaultCode, onChange }: BaseLayerSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(defaultCode);

  const handleSelect = (layer: BaseLayerOption) => {
    setActive(layer.code);
    onChange(layer);
    setOpen(false);
  };

  return (
    <div className="absolute bottom-8 right-4 z-10">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white shadow-md hover:bg-gray-50"
        title="Base layers"
      >
        <MapIcon size={18} className="text-gray-600" />
      </button>

      {open && (
        <div className="absolute bottom-12 right-0 w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          {baseLayers.map((layer) => (
            <button
              key={layer.code}
              onClick={() => handleSelect(layer)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                active === layer.code
                  ? 'bg-blue-50 font-medium text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <MapIcon size={14} />
              {layer.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
