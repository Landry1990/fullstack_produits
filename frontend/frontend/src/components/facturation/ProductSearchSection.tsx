import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ProduitModel, User } from '../../types'
import { safeStorage } from '../../utils/storage'
import api from '../../services/api'
import { ProductSearch, type SearchResult, type PackResult, type DciResult, type SearchMode } from '../common/ProductSearch'
import { useFacturationSearch } from '../../hooks/product-search/useFacturationSearch'
import DatamatrixScanField from './DatamatrixScanField'
import type { ScanStatus } from '../../hooks/useDatamatrixScan'
import { getRecentProducts } from '../../utils/recentProducts'

interface ProductSearchSectionProps {
  searchQuery: string
  setSearchQuery: (v: string) => void
  searchLoading: boolean
  filteredProduits: ProduitModel[]
  addProduitToFacture: (product: ProduitModel) => Promise<ProduitModel | undefined>
  addPackToFacture?: (pack: PackResult) => void | Promise<void>
  searchInputRef: React.RefObject<HTMLInputElement | null>
  placeholder?: string
  onQuantityShortcut?: (qty: number) => void
  onCsvImport?: (file: File) => void
  user?: User | null
  onSelectOutOfStock?: (product: ProduitModel) => void
  scanInput?: string
  scanStatus?: ScanStatus
  scanLastScanned?: string | null
  onScanChange?: (v: string) => void
  onScanKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

const RECENT_PRODUCTS_KEY = 'facturation_recent_products'
const RECENT_STALE_TIME = 1000 * 60
const RECENT_GC_TIME = 1000 * 60 * 5

const ProductSearchSection = React.memo(({
  searchQuery,
  setSearchQuery,
  searchLoading,
  filteredProduits,
  addProduitToFacture,
  addPackToFacture,
  searchInputRef,
  placeholder,
  onQuantityShortcut,
  onCsvImport,
  user,
  onSelectOutOfStock,
  scanInput,
  scanStatus,
  scanLastScanned,
  onScanChange,
  onScanKeyDown,
}: ProductSearchSectionProps) => {
  const [searchMode, setSearchMode] = useState<SearchMode>('products')
  const [recentVersion, setRecentVersion] = useState(0)

  const { data: recentProductsData } = useQuery<SearchResult[]>({
    queryKey: ['facturation', 'recent-products', recentVersion],
    queryFn: async () => {
      const stored = getRecentProducts()
      const ids = stored.map(p => p.id).filter((id): id is number => typeof id === 'number')
      if (ids.length === 0) return []

      try {
        const { data } = await api.get<ProduitModel[]>('produits/recent/', {
          params: { ids: ids.join(',') }
        })
        const results = Array.isArray(data) ? data : (data as { results?: ProduitModel[] }).results || []
        const byId = new Map<number, SearchResult>(
          results.map(p => [p.id, p as unknown as SearchResult])
        )
        return stored.map(p => {
          const fresh = byId.get(p.id)
          if (!fresh) return p
          return { ...p, ...fresh } as SearchResult
        })
      } catch {
        return stored
      }
    },
    staleTime: RECENT_STALE_TIME,
    gcTime: RECENT_GC_TIME
  })

  const recentProducts = recentProductsData ?? getRecentProducts()

  useEffect(() => {
    if (recentProductsData) {
      safeStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(recentProductsData), 'session')
    }
  }, [recentProductsData])

  useEffect(() => {
    const handleUpdate = () => {
      setRecentVersion(v => v + 1)
    }
    window.addEventListener('recent-products-updated', handleUpdate as EventListener)
    return () => {
      window.removeEventListener('recent-products-updated', handleUpdate as EventListener)
    }
  }, [])

  const {
    packResults,
    dciResults,
    selectedDci,
    setSelectedDci,
    dciProducts,
    handleKeyDown,
    getItemProps
  } = useFacturationSearch({ searchQuery, searchMode })

  // Wrapper that clears search after adding product
  const handleAddProduit = async (produit: ProduitModel | SearchResult) => {
    await addProduitToFacture(produit as ProduitModel)
    setSearchQuery('')
  }

  const handleAddPack = (pack: PackResult) => {
    if (addPackToFacture) {
      addPackToFacture(pack)
      setSearchQuery('')
    }
  }

  const handleSelectDci = (dci: DciResult) => {
    setSelectedDci(dci)
    setSearchQuery('')
  }

  // Get current loading state (simplified - you can enhance useFacturationSearch to expose these)
  const isLoading = searchLoading

  // Get current results
  const getResults = (): SearchResult[] => {
    return filteredProduits.map(p => ({
      ...p,
      id: p.id,
      name: p.name,
      stock: p.stock,
      stock_minimum: p.stock_minimum,
      selling_price: p.selling_price
    }))
  }

  const hasScan = !!onScanChange

  return (
    <div className="flex flex-col gap-1.5">
      {hasScan && (
        <DatamatrixScanField
          value={scanInput ?? ''}
          onChange={onScanChange!}
          onKeyDown={onScanKeyDown!}
          status={scanStatus ?? 'idle'}
          lastScanned={scanLastScanned ?? null}
        />
      )}
      <ProductSearch
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      results={getResults()}
      recentProducts={recentProducts}
      loading={isLoading}
      placeholder={placeholder}
      modes={['products', 'packs', 'dci']}
      showCsvImport={!!onCsvImport}
      onSelect={handleAddProduit}
      onSelectOutOfStock={onSelectOutOfStock ? (item) => onSelectOutOfStock(item as unknown as ProduitModel) : undefined}
      onCsvImport={onCsvImport}
      onQuantityShortcut={onQuantityShortcut}
      packResults={packResults}
      dciResults={dciResults}
      selectedDci={selectedDci}
      setSelectedDci={setSelectedDci}
      dciProducts={dciProducts}
      onSelectPack={handleAddPack}
      onSelectDci={handleSelectDci}
      searchInputRef={searchInputRef}
      handleKeyDown={handleKeyDown}
      getItemProps={getItemProps}
      controlledMode={searchMode}
      onModeChange={setSearchMode}
      user={user}
    />
    </div>
  )
})

export default ProductSearchSection
