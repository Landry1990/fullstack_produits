import React, { useState, useEffect } from 'react'
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
  const [recentProducts, setRecentProducts] = useState<SearchResult[]>([])

  const RECENT_PRODUCTS_KEY = 'facturation_recent_products'

  useEffect(() => {
    const loadAndRefresh = async () => {
      try {
        const parsed = getRecentProducts()
        const refreshed = await Promise.all(parsed.map(async (p) => {
          try {
            const { data } = await api.get<ProduitModel>(`produits/${p.id}/`)
            return {
              ...p,
              stock: data.stock,
              stock_minimum: data.stock_minimum,
              selling_price: data.selling_price,
              cip1: data.cip1 ?? p.cip1,
              rayon_name: data.rayon_name ?? p.rayon_name,
              active_promis_count: data.active_promis_count ?? p.active_promis_count
            } as SearchResult
          } catch {
            return p
          }
        }))
        setRecentProducts(refreshed)
      } catch { /* ignore */ }
    }
    loadAndRefresh()

    const handleUpdate = (e: CustomEvent<SearchResult[]>) => {
      setRecentProducts(e.detail)
    }
    window.addEventListener('recent-products-updated', handleUpdate as EventListener)
    return () => {
      window.removeEventListener('recent-products-updated', handleUpdate as EventListener)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    safeStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(recentProducts), 'session')
  }, [recentProducts])

  const {
    packResults,
    dciResults,
    selectedDci,
    setSelectedDci,
    dciProducts,
    handleKeyDown,
    getItemProps,
    fetchDciProducts
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
    fetchDciProducts(dci.id)
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
