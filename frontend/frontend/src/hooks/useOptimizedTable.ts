import { useState, useCallback, useMemo } from 'react';

interface UseOptimizedTableProps<T> {
  data: T[];
  keyExtractor: (item: T) => string | number;
  initialSort?: { key: string; direction: 'asc' | 'desc' };
  searchFields?: (keyof T)[];
}

interface UseOptimizedTableReturn<T> {
  // Data filtrée et triée
  processedData: T[];
  
  // Recherche
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Tri
  sortKey: string | null;
  sortDirection: 'asc' | 'desc';
  handleSort: (key: string) => void;
  
  // Sélection
  selectedIds: Set<string | number>;
  handleSelect: (id: string | number) => void;
  handleSelectAll: () => void;
  handleClearSelection: () => void;
  isSelected: (id: string | number) => boolean;
  areAllSelected: boolean;
  hasSelection: boolean;
  selectedCount: number;
  
  // Pagination (optionnelle)
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  paginatedData: T[];
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
}

/**
 * Hook réutilisable pour gérer un tableau optimisé
 * avec recherche, tri, sélection et pagination
 */
export function useOptimizedTable<T>({
  data,
  keyExtractor,
  initialSort,
  searchFields,
}: UseOptimizedTableProps<T>): UseOptimizedTableReturn<T> {
  // État de recherche
  const [searchQuery, setSearchQuery] = useState('');
  
  // État de tri
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSort?.direction || 'asc');
  
  // État de sélection
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  
  // État de pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filtrage
  const filteredData = useMemo(() => {
    if (!searchQuery || !searchFields || searchFields.length === 0) {
      return data;
    }
    
    const query = searchQuery.toLowerCase();
    return data.filter((item) =>
      searchFields.some((field) => {
        const value = item[field];
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      })
    );
  }, [data, searchQuery, searchFields]);

  // Tri
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = (a as any)[sortKey];
      const bValue = (b as any)[sortKey];
      
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return sortDirection === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Handlers de tri
  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset pagination on sort change
  }, [sortKey]);

  // Handlers de sélection
  const handleSelect = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const currentIds = paginatedData.map(keyExtractor);
    const allSelected = currentIds.every((id) => selectedIds.has(id));
    
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (allSelected) {
        // Désélectionner tout
        currentIds.forEach((id) => newSet.delete(id));
      } else {
        // Sélectionner tout
        currentIds.forEach((id) => newSet.add(id));
      }
      return newSet;
    });
  }, [paginatedData, keyExtractor, selectedIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Handlers de pagination
  const goToFirstPage = useCallback(() => setCurrentPage(1), []);
  const goToLastPage = useCallback(() => setCurrentPage(totalPages), [totalPages]);
  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);
  const goToPreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  // Computed
  const isSelected = useCallback(
    (id: string | number) => selectedIds.has(id),
    [selectedIds]
  );

  const areAllSelected = useMemo(() => {
    if (paginatedData.length === 0) return false;
    return paginatedData.every((item) => selectedIds.has(keyExtractor(item)));
  }, [paginatedData, selectedIds, keyExtractor]);

  const hasSelection = selectedIds.size > 0;
  const selectedCount = selectedIds.size;

  // Data complète pour l'affichage sans pagination
  const processedData = sortedData;

  return {
    processedData,
    searchQuery,
    setSearchQuery,
    sortKey,
    sortDirection,
    handleSort,
    selectedIds,
    handleSelect,
    handleSelectAll,
    handleClearSelection,
    isSelected,
    areAllSelected,
    hasSelection,
    selectedCount,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    paginatedData,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
  };
}

export default useOptimizedTable;
