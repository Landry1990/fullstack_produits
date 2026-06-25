import React from 'react'
import { useTranslation } from 'react-i18next'
import type { ProduitModel, User } from '../../types'
import { ProductSearch, type SearchResult, type PackResult, type DciResult } from '../common/ProductSearch'
import { useFacturationSearch } from '../../hooks/product-search'
import DatamatrixScanField from './DatamatrixScanField'
import type { ScanStatus } from '../../hooks/useDatamatrixScan'

interface ProductSearchSectionProps {
  searchQuery: string
  setSearchQuery: (v: string) => void
  searchLoading: boolean
  filteredProduits: ProduitModel[]
  addProduitToFacture: (product: ProduitModel) => void
  addPackToFacture?: (pack: any) => void
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
  const {
    searchMode,
    setSearchMode,
    packResults,
    dciResults,
    selectedDci,
    setSelectedDci,
    dciProducts,
    handleKeyDown,
    getItemProps,
    fetchDciProducts
  } = useFacturationSearch()

  // Wrapper that clears search after adding product
  const handleAddProduit = (produit: ProduitModel | SearchResult) => {
    addProduitToFacture(produit as ProduitModel)
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
      user={user}
    />
    </div>
  )
})

export default ProductSearchSection
