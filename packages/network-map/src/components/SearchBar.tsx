import { useState, useCallback, useRef } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import { useMap } from '../context/MapContext';
import { apiClient } from '@fsa/shared-api';

interface SearchResult {
  id: string | number;
  label: string;
  sublabel?: string;
  layerCode: string;
  center: [number, number];
  zoom?: number;
}

interface SearchBarProps {
  placeholder?: string;
  searchEndpoint?: string;
  onSelect?: (result: SearchResult) => void;
}

export default function SearchBar({
  placeholder = 'Search features...',
  searchEndpoint = '/network-map/spatial/search',
  onSelect,
}: SearchBarProps) {
  const { getAdapter } = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }
      debounceRef.current = setTimeout(() => {
        apiClient
          .get(searchEndpoint, { params: { q: value } })
          .then((res) => {
            setResults(res.data ?? []);
            setOpen(true);
          })
          .catch(() => setResults([]));
      }, 300);
    },
    [searchEndpoint],
  );

  const handleSelect = useCallback(
    (result: SearchResult) => {
      const adapter = getAdapter();
      if (adapter && result.center) {
        adapter.flyTo(result.center, result.zoom ?? 16);
      }
      setOpen(false);
      setQuery(result.label);
      onSelect?.(result);
    },
    [getAdapter, onSelect],
  );

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="absolute left-1/2 top-4 z-10 w-80 -translate-x-1/2">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-8 text-sm text-gray-700 shadow-md placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="mt-1 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((result) => (
            <button
              key={`${result.layerCode}-${result.id}`}
              onClick={() => handleSelect(result)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <MapPin size={14} className="shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-700">{result.label}</div>
                {result.sublabel && (
                  <div className="truncate text-xs text-gray-400">{result.sublabel}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && (
        <div className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-3 text-center text-xs text-gray-400 shadow-lg">
          No results found
        </div>
      )}
    </div>
  );
}
