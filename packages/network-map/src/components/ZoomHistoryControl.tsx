import { useEffect, useRef, useCallback, useReducer } from 'react';
import { Undo2, Redo2, Home, Navigation } from 'lucide-react';
import { useMap } from '../context/MapContext';
import CollapsibleToolbar from './CollapsibleToolbar';

interface ViewSnapshot {
  center: [number, number];
  zoom: number;
}

interface HistoryState {
  entries: ViewSnapshot[];
  cursor: number;
}

type HistoryAction =
  | { type: 'init'; snap: ViewSnapshot }
  | { type: 'push'; snap: ViewSnapshot }
  | { type: 'go'; cursor: number };

const MAX_ENTRIES = 50;

function isSameView(a: ViewSnapshot, b: ViewSnapshot): boolean {
  return (
    Math.abs(a.zoom - b.zoom) < 0.01 &&
    Math.abs(a.center[0] - b.center[0]) < 0.0001 &&
    Math.abs(a.center[1] - b.center[1]) < 0.0001
  );
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'init':
      return { entries: [action.snap], cursor: 0 };
    case 'push': {
      // Trim forward entries, then append
      const trimmed = state.entries.slice(0, state.cursor + 1);
      const last = trimmed[trimmed.length - 1];
      if (last && isSameView(last, action.snap)) return state;
      const updated = [...trimmed, action.snap];
      if (updated.length > MAX_ENTRIES) updated.shift();
      return { entries: updated, cursor: updated.length - 1 };
    }
    case 'go':
      if (action.cursor < 0 || action.cursor >= state.entries.length) return state;
      return { ...state, cursor: action.cursor };
  }
}

interface ZoomHistoryControlProps {
  position?: 'top-left' | 'top-right';
  style?: React.CSSProperties;
  defaultCollapsed?: boolean;
}

export default function ZoomHistoryControl({
  position = 'top-left',
  style,
  defaultCollapsed = false,
}: ZoomHistoryControlProps) {
  const { getAdapter, isReady } = useMap();
  const [state, dispatch] = useReducer(historyReducer, { entries: [], cursor: -1 });
  const initialView = useRef<ViewSnapshot | null>(null);
  const navigatingRef = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // positioning handled by CollapsibleToolbar

  // Capture initial view + listen for user-initiated view changes
  useEffect(() => {
    if (!isReady) return;
    const adapter = getAdapter();
    if (!adapter) return;

    const vp = adapter.getViewport();
    const snap: ViewSnapshot = { center: [vp.center[0], vp.center[1]], zoom: vp.zoom };
    initialView.current = snap;
    dispatch({ type: 'init', snap });

    const handleMoveEnd = () => {
      if (navigatingRef.current) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const a = getAdapter();
        if (!a) return;
        const v = a.getViewport();
        dispatch({ type: 'push', snap: { center: [v.center[0], v.center[1]], zoom: v.zoom } });
      }, 300);
    };

    adapter.on('moveend', handleMoveEnd);
    return () => {
      adapter.off('moveend', handleMoveEnd);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [isReady, getAdapter]);

  const navigateTo = useCallback(
    (snap: ViewSnapshot) => {
      const adapter = getAdapter();
      if (!adapter) return;
      navigatingRef.current = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawMap = adapter.getRawMap() as any;
      if (rawMap) {
        rawMap.once('moveend', () => { navigatingRef.current = false; });
        rawMap.flyTo({ center: snap.center, zoom: snap.zoom, duration: 400 });
      } else {
        navigatingRef.current = false;
      }
    },
    [getAdapter],
  );

  const handlePrev = useCallback(() => {
    const newCursor = state.cursor - 1;
    if (newCursor < 0) return;
    dispatch({ type: 'go', cursor: newCursor });
    navigateTo(state.entries[newCursor]);
  }, [state, navigateTo]);

  const handleNext = useCallback(() => {
    const newCursor = state.cursor + 1;
    if (newCursor >= state.entries.length) return;
    dispatch({ type: 'go', cursor: newCursor });
    navigateTo(state.entries[newCursor]);
  }, [state, navigateTo]);

  const handleHome = useCallback(() => {
    if (!initialView.current) return;
    navigateTo(initialView.current);
  }, [navigateTo]);

  const canPrev = state.cursor > 0;
  const canNext = state.cursor < state.entries.length - 1;

  const btnBase =
    'flex h-9 w-9 items-center justify-center rounded-lg border shadow-md transition-colors';
  const btnEnabled = 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50';
  const btnDisabled = 'border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed';

  return (
    <CollapsibleToolbar
      title="Navega\u00e7\u00e3o"
      icon={<Navigation size={14} />}
      defaultCollapsed={defaultCollapsed}
      position={position}
      style={style}
    >
      <button
        onClick={handlePrev}
        disabled={!canPrev}
        className={`${btnBase} ${canPrev ? btnEnabled : btnDisabled}`}
        title="Previous view"
      >
        <Undo2 size={16} />
      </button>
      <button
        onClick={handleHome}
        className={`${btnBase} ${btnEnabled}`}
        title="Initial view"
      >
        <Home size={16} />
      </button>
      <button
        onClick={handleNext}
        disabled={!canNext}
        className={`${btnBase} ${canNext ? btnEnabled : btnDisabled}`}
        title="Next view"
      >
        <Redo2 size={16} />
      </button>
    </CollapsibleToolbar>
  );
}
