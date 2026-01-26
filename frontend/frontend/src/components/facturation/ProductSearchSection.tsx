import React from 'react'
import { useTranslation } from 'react-i18next'
import type { ProduitModel } from '../../types'
import { useSearchNavigation } from '../../hooks/useSearchNavigation'

interface ProductSearchSectionProps {
  searchQuery: string
  setSearchQuery: (v: string) => void
  searchLoading: boolean
  filteredProduits: ProduitModel[]
  addProduitToFacture: (product: ProduitModel) => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
  placeholder?: string
}

export default function ProductSearchSection({
  searchQuery,
  setSearchQuery,
  searchLoading,
  filteredProduits,
  addProduitToFacture,
  searchInputRef,
  placeholder
}: ProductSearchSectionProps) {
  const { t } = useTranslation()

  // Wrapper that clears search after adding product
  const handleAddProduit = (produit: ProduitModel) => {
    addProduitToFacture(produit)
    setSearchQuery('') // Clear search after adding
  }

  // Hook for keyboard navigation (ArrowUp, ArrowDown, Enter)
  const { getItemProps, handleKeyDown } = useSearchNavigation(
    filteredProduits,
    handleAddProduit, // Use wrapper
    { resetOnSelect: true, searchInputRef }
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border border-base-200 flex-1 p-3 md:p-4 relative">
      <label className="label text-xs font-bold text-base-content/50 uppercase tracking-wider py-0 mb-2">{t('facturation.search_label', { defaultValue: 'Rechercher un produit (F2)' })}</label>
      <div className="relative">
        <input
          ref={searchInputRef}
          type="text"
          placeholder={placeholder || t('facturation.search_placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="input input-bordered w-full pl-12 text-lg h-14 bg-base-50 focus:bg-white transition-colors focus:ring-2 focus:ring-primary/20"
        />
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>
      
      {/* Search Results Dropdown */}
      {searchQuery && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-base-200 max-h-[60vh] overflow-y-auto z-50">
          {filteredProduits.length === 0 ? (
            <div className="text-center py-8 text-base-content/40 text-sm">
              {searchLoading ? <span className="loading loading-spinner loading-sm"></span> : searchQuery.length < 2 ? t('facturation.search_min_chars', { defaultValue: 'Tapez au moins 2 caractères' }) : t('facturation.search_no_results', { defaultValue: 'Aucun produit trouvé' })}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-1 p-1">
              {filteredProduits.map((produit, idx) => {
                const itemProps = getItemProps(idx);
                return (
                <div 
                  key={produit.id}
                  {...itemProps}
                  onClick={() => {
                    if ((produit.stock ?? 0) > 0) {
                      handleAddProduit(produit) // Use wrapper
                    }
                  }}
                  style={itemProps.style}
                  className={`
                    group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all
                    ${itemProps.className ? 'shadow-md' : 'hover:bg-base-100'}
                    ${(produit.stock ?? 0) === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm">{produit.name}</div>
                    <div className="text-xs flex gap-3 mt-0.5 opacity-80">
                      <span className={(produit.stock ?? 0) === 0 ? 'text-error font-bold' : ''}>
                        Stock: {produit.stock}
                      </span>
                      <span>{produit.selling_price} F</span>
                    </div>
                  </div>
                  {(produit.stock ?? 0) > 0 && (
                    <div className={`opacity-0 group-hover:opacity-100 ${itemProps.className ? 'opacity-100' : ''}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
