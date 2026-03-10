import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

/* ── Types ── */
type ToastVariant = 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

/* ── Context ── */
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

/* ── Single Toast ── */
function ToastMessage({ item, onRemove }: { item: ToastItem; onRemove: (id: number) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => setExiting(true), 3500);
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (exiting) {
      const t = setTimeout(() => onRemove(item.id), 300);
      return () => clearTimeout(t);
    }
  }, [exiting, item.id, onRemove]);

  const isSuccess = item.variant === 'success';
  const bg = isSuccess ? 'bg-green-600' : 'bg-red-600';
  const Icon = isSuccess ? CheckCircle : AlertCircle;

  return (
    <div
      className={`${bg} ${exiting ? 'animate-toast-out' : 'animate-toast-in'} flex items-start gap-2.5 rounded-lg px-4 py-3 text-white shadow-lg min-w-[280px] max-w-[420px]`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <span className="text-sm font-medium leading-snug flex-1">{item.message}</span>
      <button
        onClick={() => setExiting(true)}
        className="shrink-0 rounded p-0.5 hover:bg-white/20 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/* ── Provider ── */
let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((message: string, variant: ToastVariant) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const success = useCallback((message: string) => add(message, 'success'), [add]);
  const error = useCallback((message: string) => add(message, 'error'), [add]);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      {/* Toast container — bottom-right */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-auto">
        {toasts.map((t) => (
          <ToastMessage key={t.id} item={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
