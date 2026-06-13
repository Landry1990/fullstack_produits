import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface DataTableOptimizedProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  selectedIds?: Set<string | number>;
  onSelect?: (id: string | number) => void;
  onSelectAll?: () => void;
  loading?: boolean;
  emptyMessage?: string;
  compact?: boolean;
  maxHeight?: string;
}

/**
 * DataTable optimisé avec:
 * - Header compact
 * - Scrollbar stylisée
 * - Tri intégré
 * - Recherche intégrée
 * - Sélection de lignes
 */
export function DataTableOptimized<T>({
  data,
  columns,
  keyExtractor,
  title,
  subtitle,
  actions,
  searchPlaceholder = 'Rechercher...',
  onSearch,
  onSort,
  sortKey,
  sortDirection,
  rowClassName,
  onRowClick,
  selectedIds,
  onSelect,
  onSelectAll,
  loading,
  emptyMessage = 'Aucune donnée',
  compact = false,
  maxHeight = 'calc(100vh - 180px)',
}: DataTableOptimizedProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const allSelected = data.length > 0 && data.every((item) => selectedIds?.has(keyExtractor(item)));
  const someSelected = data.some((item) => selectedIds?.has(keyExtractor(item))) && !allSelected;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch?.(value);
  };

  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSort) return;
    const newDirection = sortKey === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(column.key, newDirection);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-base-100 rounded-lg border border-base-200">
      {/* Header compact */}
      {(title || onSearch || actions) && (
        <div className={`flex items-center justify-between border-b border-base-200 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {title && (
              <div className="min-w-0">
                <h2 className={`font-semibold text-base-content truncate ${compact ? 'text-sm' : 'text-base'}`}>
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs text-base-content/60 truncate">{subtitle}</p>
                )}
              </div>
            )}
            {onSearch && (
              <div className="relative flex-1 max-w-xs">
                <Search className={`absolute left-2.5 text-base-content/40 ${compact ? 'size-3.5 top-1.5' : 'size-4 top-2'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearch}
                  placeholder={searchPlaceholder}
                  className={`input input-bordered input-sm w-full pl-8 ${compact ? 'h-7 text-xs' : ''}`}
                />
              </div>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0 ml-4">{actions}</div>}
        </div>
      )}

      {/* Table avec scrollbar optimisée */}
      <div
        className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-transparent"
        style={{
          maxHeight,
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--fallback-bc,oklch(var(--bc)/0.2)) transparent',
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-base-content/50">
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <table className={`table w-full ${compact ? 'table-sm' : 'table-md'}`}>
            <thead className="sticky top-0 bg-base-100 z-10">
              <tr className="border-b border-base-200">
                {(onSelect || onSelectAll) && (
                  <th className={`bg-base-100 w-10 ${compact ? 'p-2' : 'p-3'}`}>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={onSelectAll}
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`bg-base-100 font-medium text-base-content/70 ${
                      column.sortable ? 'cursor-pointer hover:text-base-content' : ''
                    } ${compact ? 'p-2 text-xs' : 'p-3 text-sm'} ${
                      column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                    style={{ width: column.width }}
                    onClick={() => handleSort(column)}
                  >
                    <div className="flex items-center gap-1">
                      {column.header}
                      {column.sortable && sortKey === column.key && (
                        sortDirection === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const id = keyExtractor(item);
                const isSelected = selectedIds?.has(id);
                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(item)}
                    className={`border-b border-base-200 hover:bg-base-200/50 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    } ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(item) || ''}`}
                  >
                    {(onSelect || onSelectAll) && (
                      <td
                        className={`${compact ? 'p-2' : 'p-3'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={isSelected}
                          onChange={() => onSelect?.(id)}
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`${compact ? 'p-2 text-xs' : 'p-3 text-sm'} ${
                          column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {column.render ? column.render(item) : (item as any)[column.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer avec pagination ou stats */}
      <div className={`flex items-center justify-between border-t border-base-200 bg-base-100 ${compact ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
        <span className={`text-base-content/60 ${compact ? 'text-xs' : 'text-sm'}`}>
          {data.length} résultat{data.length > 1 ? 's' : ''}
        </span>
        {selectedIds && selectedIds.size > 0 && (
          <span className={`text-primary ${compact ? 'text-xs' : 'text-sm'}`}>
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export default DataTableOptimized;
