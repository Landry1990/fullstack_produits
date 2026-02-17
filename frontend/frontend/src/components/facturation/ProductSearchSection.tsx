import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProduitModel } from '../../types'
import { useSearchNavigation } from '../../hooks/useSearchNavigation'
import { Package, Pill } from 'lucide-react'
import { safeStorage } from '../../utils/storage'
import { toast } from 'react-hot-toast'
import axios from 'axios'

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
}

export default function ProductSearchSection({
  searchQuery,
  setSearchQuery,
  searchLoading,
  filteredProduits,
  addProduitToFacture,
  addPackToFacture,
  searchInputRef,
  placeholder,
  onQuantityShortcut
}: ProductSearchSectionProps) {
  const { t } = useTranslation()
  const [searchMode, setSearchMode] = useState<'products' | 'packs'>('products')
  const [packResults, setPackResults] = useState<any[]>([])
  const [packLoading, setPackLoading] = useState(false)

  // Wrapper that clears search after adding product
  const handleAddProduit = (produit: ProduitModel) => {
    addProduitToFacture(produit)
    setSearchQuery('') // Clear search after adding
  }

  const handleAddPack = (pack: any) => {
      if (addPackToFacture) {
          addPackToFacture(pack)
          setSearchQuery('')
          setPackResults([])
      }
  }

  // Hook for keyboard navigation (ArrowUp, ArrowDown, Enter)
  // We switch the list based on searchMode
  const { getItemProps, handleKeyDown: handleNavKeyDown } = useSearchNavigation(
    searchMode === 'products' ? filteredProduits : packResults,
    searchMode === 'products' ? handleAddProduit : handleAddPack, 
    { resetOnSelect: true, searchInputRef }
  )

  const searchPacks = async (query: string) => {
      if (query.length < 2) {
          setPackResults([])
          return
      }
      setPackLoading(true)
      try {
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
          const baseUrl = apiBaseUrl.replace(/\/$/, '');
          const url = `${baseUrl}/api/promotions/`;
          const token = safeStorage.getItem('authToken');
          
          const response = await axios.get(url, {
              params: {
                  search: query,
                  discount_type: 'BUNDLE',
                  active: true
              },
              headers: {
                  'Authorization': `Token ${token}`
              }
          });
          
          if (response.status === 200) {
              const data = response.data;
              setPackResults(Array.isArray(data) ? data : data.results || []);
          }
      } catch (e) {
          console.error("Pack search error", e)
          toast.error(t('facturation.search.error_search_packs'))
      } finally {
          setPackLoading(false)
      }
  }

  // Custom debounce logic for packs
  React.useEffect(() => {
    if (searchMode === 'packs') {
        const timer = setTimeout(() => {
            if (searchQuery) searchPacks(searchQuery)
        }, 300)
        return () => clearTimeout(timer)
    }
  }, [searchQuery, searchMode])


  const onInternalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Shortcuts
    if ((e.key === '*' || e.key === 'Multiply') && searchQuery && !isNaN(Number(searchQuery))) {
      e.preventDefault();
      onQuantityShortcut?.(Number(searchQuery));
      setSearchQuery('');
      return;
    }
    
    // Tab switch shortcut? Maybe Ctrl+Tab? Let's keep it simple.
    
    handleNavKeyDown(e);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-base-200 flex-1 p-3 md:p-4 relative flex flex-col gap-2">
      <div className="flex justify-between items-center">
            <label className="label text-xs font-bold text-base-content/50 uppercase tracking-wider py-0">
                {searchMode === 'products' ? t('facturation.search_label', { defaultValue: 'Rechercher un produit (F2)' }) : t('facturation.search.label_pack')}
            </label>
            
            {/* Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                    className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${searchMode === 'products' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => { setSearchMode('products'); setSearchQuery(''); searchInputRef.current?.focus() }}
                >
                    <Pill size={14} /> {t('facturation.search.tabs_products')}
                </button>
                <button 
                    className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${searchMode === 'packs' ? 'bg-white shadow text-secondary' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => { setSearchMode('packs'); setSearchQuery(''); searchInputRef.current?.focus() }}
                >
                    <Package size={14} /> {t('facturation.search.tabs_packs')}
                </button>
            </div>
      </div>

      <div className="relative">
        <input
          ref={searchInputRef}
          type="text"
          placeholder={searchMode === 'products' ? (placeholder || t('facturation.search_placeholder')) : t('facturation.search.placeholder_pack')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={onInternalKeyDown}
          className={`input input-bordered w-full pl-12 text-lg h-14 bg-base-50 focus:bg-white transition-colors focus:ring-2 ${searchMode === 'products' ? 'focus:ring-primary/20' : 'focus:ring-secondary/20'}`}
        />
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>
      
      {/* Search Results Dropdown */}
      {searchQuery && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-base-200 max-h-[60vh] overflow-y-auto z-50">
          
          {/* PRODUCT MODE */}
          {searchMode === 'products' && (
             filteredProduits.length === 0 ? (
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
                        ${(produit.stock ?? 0) <= 0 ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    >
                    <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{produit.name}</div>
                        <div className="text-xs flex gap-3 mt-0.5 opacity-80">
                        <span className={(produit.stock ?? 0) <= 0 ? 'text-error font-bold' : ''}>
                            Stock: {produit.stock}
                        </span>
                        <span>{produit.selling_price} F</span>
                        </div>
                    </div>
                    {(produit.stock ?? 0) > 0 && (
                        <button className="btn btn-ghost btn-sm btn-circle opacity-0 group-hover:opacity-100 text-primary">
                        +
                        </button>
                    )}
                    </div>
                    )
                })}
                </div>
            )
          )}

          {/* PACK MODE */}
          {searchMode === 'packs' && (
             packResults.length === 0 ? (
                <div className="text-center py-8 text-base-content/40 text-sm">
                {packLoading ? <span className="loading loading-spinner loading-sm"></span> : searchQuery.length < 2 ? t('facturation.search.placeholder_pack') : t('facturation.search.no_results_pack')}
                </div>
            ) : (
                <div className="max-h-96 overflow-y-auto space-y-1 p-1">
                {packResults.map((pack, idx) => {
                    const itemProps = getItemProps(idx);
                    return (
                    <div 
                    key={pack.id}
                    {...itemProps}
                    onClick={() => handleAddPack(pack)}
                    style={itemProps.style}
                    className={`
                        group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border-l-4 border-secondary/50
                        ${itemProps.className ? 'shadow-md bg-secondary/5' : 'hover:bg-base-100'}
                    `}
                    >
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-secondary text-sm">{pack.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                            {pack.value} F • {pack.products_count || pack.pack_items?.length || '?'} {t('facturation.search.products_count')}
                        </div>
                    </div>
                     <button className="btn btn-ghost btn-sm btn-circle opacity-0 group-hover:opacity-100 text-secondary">
                        +
                     </button>
                    </div>
                    )
                })}
                </div>
            )
          )}

        </div>
      )}
    </div>
  )
}
