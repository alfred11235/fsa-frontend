import React, { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  visible?: boolean;
  minWidth?: string;
}

export interface RowAction<T> {
  icon: React.ReactNode;
  label: string;
  onClick: (row: T) => void;
  variant?: 'info' | 'warning' | 'danger';
  show?: (row: T) => boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pageSize?: number;
  totalItems?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSearch?: (query: string) => void;
  rowActions?: RowAction<T>[];
  onRowClick?: (row: T) => void;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
}

const actionVariants: Record<string, string> = {
  info: 'text-blue-600 hover:bg-blue-50',
  warning: 'bg-amber-400 text-white hover:bg-amber-500',
  danger: 'text-red-600 hover:bg-red-50',
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  pageSize = 10,
  totalItems,
  page = 0,
  onPageChange,
  onPageSizeChange,
  onSearch,
  rowActions,
  onRowClick,
  className,
  title,
  icon,
  headerActions,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hide = new Set<string>();
    columns.forEach((c) => { if (c.visible === false) hide.add(c.key); });
    setHiddenCols(hide);
  }, [columns]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.key)),
    [columns, hiddenCols],
  );

  const toggleCol = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = getNestedValue(row, col.key);
        if (val == null) return false;
        return String(val).toLowerCase().includes(q);
      }),
    );
  }, [data, searchQuery, columns]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = getNestedValue(a, sortKey);
      const bVal = getNestedValue(b, sortKey);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      let cmp: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        cmp = (aVal === bVal) ? 0 : aVal ? -1 : 1;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base', numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir]);

  const clientSidePagination = totalItems == null;
  const total = clientSidePagination ? sortedData.length : totalItems;

  const displayData = useMemo(() => {
    if (!clientSidePagination) return sortedData;
    const start = page * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, clientSidePagination, page, pageSize]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxShow = 5;
    let start = Math.max(0, page - Math.floor(maxShow / 2));
    let end = Math.min(totalPages, start + maxShow);
    if (end - start < maxShow) start = Math.max(0, end - maxShow);
    for (let i = start; i < end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return (
    <div className={cn('', className)}>
      {/* Title row */}
      {title && (
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        </div>
      )}

      {/* Search */}
      {onSearch && (
        <form onSubmit={handleSearchSubmit} className="mb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Busca..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
            />
          </div>
        </form>
      )}

      {/* Toolbar: add button + column visibility */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {headerActions}
        </div>
        <div className="relative flex items-center gap-2" ref={colMenuRef}>
          <span className="text-xs text-gray-500">{visibleColumns.length} col. mostrando</span>
          <button
            onClick={() => setColMenuOpen(!colMenuOpen)}
            className="rounded border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-50"
            title="Mostrar/ocultar colunas"
          >
            <SlidersHorizontal size={14} />
          </button>
          {colMenuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {columns.map((col) => (
                <label key={col.key} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={!hiddenCols.has(col.key)}
                    onChange={() => toggleCol(col.key)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600"
                  />
                  {col.header}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-md border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500',
                    col.sortable && 'cursor-pointer select-none hover:text-gray-900',
                  )}
                  style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="text-[10px] text-gray-400">
                        {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '▽'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              {rowActions && rowActions.length > 0 && (
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500" style={{ width: '1%', whiteSpace: 'nowrap' }} />
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length + (rowActions ? 1 : 0)} className="px-4 py-12 text-center text-gray-400">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
                </td>
              </tr>
            ) : displayData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (rowActions ? 1 : 0)} className="px-4 py-12 text-center text-gray-400">
                  Nenhum dado encontrado
                </td>
              </tr>
            ) : (
              displayData.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    i === 0 ? 'bg-cyan-50' : 'bg-white',
                    'transition-colors hover:bg-gray-50',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {visibleColumns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-[13px] text-gray-700">
                      {col.render ? col.render(row) : String(getNestedValue(row, col.key) ?? '')}
                    </td>
                  ))}
                  {rowActions && rowActions.length > 0 && (
                    <td className="px-3 py-1.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {rowActions
                          .filter((a) => !a.show || a.show(row))
                          .map((action, j) => (
                            <button
                              key={j}
                              title={action.label}
                              onClick={(e) => { e.stopPropagation(); action.onClick(row); }}
                              className={cn(
                                'rounded p-1.5 transition-colors',
                                actionVariants[action.variant ?? 'info'],
                              )}
                            >
                              {action.icon}
                            </button>
                          ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button disabled={page === 0} onClick={() => onPageChange?.(0)}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30">
            <ChevronsLeft size={16} />
          </button>
          <button disabled={page === 0} onClick={() => onPageChange?.(page - 1)}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          {pageNumbers.map((p) => (
            <button
              key={p}
              onClick={() => onPageChange?.(p)}
              className={cn(
                'min-w-[28px] rounded px-1.5 py-0.5 text-xs font-medium',
                p === page
                  ? 'bg-red-500 text-white'
                  : 'text-gray-500 hover:bg-gray-200',
              )}
            >
              {p + 1}
            </button>
          ))}
          <button disabled={page >= totalPages - 1} onClick={() => onPageChange?.(page + 1)}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
          <button disabled={page >= totalPages - 1} onClick={() => onPageChange?.(totalPages - 1)}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30">
            <ChevronsRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Página {page + 1} de {totalPages} ({total} itens)</span>
          <select
            value={pageSize}
            onChange={(e) => { onPageSizeChange?.(Number(e.target.value)); onPageChange?.(0); }}
            className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-600 outline-none"
          >
            {[10, 20, 50, 100].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}
