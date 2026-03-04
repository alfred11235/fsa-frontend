import React, { useState, useMemo } from 'react';
import { cn } from '../lib/utils';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

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
  onSearch?: (query: string) => void;
  rowActions?: RowAction<T>[];
  onRowClick?: (row: T) => void;
  className?: string;
  title?: string;
  headerActions?: React.ReactNode;
}

const actionVariants: Record<string, string> = {
  info: 'text-blue-600 hover:bg-blue-50',
  warning: 'text-amber-600 hover:bg-amber-50',
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
  onSearch,
  rowActions,
  onRowClick,
  className,
  title,
  headerActions,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible !== false),
    [columns],
  );

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  const total = totalItems ?? data.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white', className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
          {onSearch && (
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-56 rounded-md border border-gray-300 bg-gray-50 pl-8 pr-3 text-sm text-gray-700 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
              />
            </form>
          )}
        </div>
        {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 font-medium text-gray-600',
                    col.sortable && 'cursor-pointer select-none hover:text-gray-900',
                  )}
                  style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span className="text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </span>
                </th>
              ))}
              {rowActions && rowActions.length > 0 && (
                <th className="px-4 py-3 text-right font-medium text-gray-600" style={{ width: '1%', whiteSpace: 'nowrap' }}>
                  Actions
                </th>
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
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (rowActions ? 1 : 0)} className="px-4 py-12 text-center text-gray-400">
                  No data available
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  className={cn('bg-white transition-colors hover:bg-gray-50', onRowClick && 'cursor-pointer')}
                >
                  {visibleColumns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-gray-700">
                      {col.render ? col.render(row) : String(getNestedValue(row, col.key) ?? '')}
                    </td>
                  ))}
                  {rowActions && rowActions.length > 0 && (
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        {rowActions
                          .filter((a) => !a.show || a.show(row))
                          .map((action, j) => (
                            <button
                              key={j}
                              title={action.label}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(row);
                              }}
                              className={cn(
                                'rounded-md p-1.5 transition-colors',
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <span className="text-xs text-gray-500">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 0}
              onClick={() => onPageChange?.(page - 1)}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-2 text-xs font-medium text-gray-700">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange?.(page + 1)}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}
