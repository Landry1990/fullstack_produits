import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../utils/formatters'
import type { ProduitModel } from '../../types'
import { useSearchNavigation } from '../../hooks/useSearchNavigation'
import { Package, Pill, FlaskConical } from 'lucide-react'
import { toast } from 'react-hot-toast'
import api from '../../services/api'

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
  onCsvImport
}: ProductSearchSectionProps) => {
  const { t } = useTranslation(['facturation', 'common'])
  const [searchMode, setSearchMode] = useState<'products' | 'packs' | 'dci'>('products')
  const [packResults, setPackResults] = useState<any[]>([])
  const [packLoading, setPackLoading] = useState(false)
  const [dciResults, setDciResults] = useState<any[]>([])
  const [dciLoading, setDciLoading] = useState(false)
  const [selectedDci, setSelectedDci] = useState<any | null>(null)
  const [dciProducts, setDciProducts] = useState<ProduitModel[]>([])
  const [dciProductsLoading, setDciProductsLoading] = useState(false)

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
  const navList =
    searchMode === 'products' ? filteredProduits :
    searchMode === 'packs' ? packResults :
    selectedDci ? dciProducts : dciResults;

  const navAction =
    searchMode === 'products' ? handleAddProduit :
    searchMode === 'packs' ? handleAddPack :
    selectedDci ? handleAddProduit :
    (dci: any) => { setSelectedDci(dci); setSearchQuery(''); fetchDciProducts(dci.id); };

  const { getItemProps, handleKeyDown: handleNavKeyDown } = useSearchNavigation(
    navList as any[],
    navAction as any,
    { resetOnSelect: true, searchInputRef }
  )

  const searchPacks = async (query: string) => {
      if (query.length < 2) {
          setPackResults([])
          return
      }
      setPackLoading(true)
      try {
          const response = await api.get('promotions/', {
              params: {
                  search: query,
                  discount_type: 'BUNDLE',
                  active: true
              }
          });
          
          if (response.status === 200) {
              const data = response.data;
              setPackResults(Array.isArray(data) ? data : data.results || []);
          }
      } catch (e) {
          console.error("Pack search error", e)
          toast.error(t('facturation:search.error_search_packs'))
      } finally {
          setPackLoading(false)
      }
  }

  const searchDci = async (query: string) => {
      if (query.length < 2) {
          setDciResults([])
          return
      }
      setDciLoading(true)
      try {
          const response = await api.get('substances/', {
              params: { search: query, page_size: 50 }
          });
          const data = response.data;
          setDciResults(Array.isArray(data) ? data : data.results || []);
      } catch (e) {
          console.error("DCI search error", e)
      } finally {
          setDciLoading(false)
      }
  }

  const fetchDciProducts = async (substanceId: number) => {
      setDciProductsLoading(true)
      try {
          const response = await api.get('produits/', {
              params: { substances: substanceId, page_size: 100 }
          });
          const data = response.data;
          setDciProducts(Array.isArray(data) ? data : data.results || []);
      } catch (e) {
          console.error("DCI products error", e)
      } finally {
          setDciProductsLoading(false)
      }
  }

  // Custom debounce logic for packs and dci
  React.useEffect(() => {
    if (searchMode === 'packs') {
        const timer = setTimeout(() => {
            if (searchQuery) searchPacks(searchQuery)
        }, 300)
        return () => clearTimeout(timer)
    }
    if (searchMode === 'dci') {
        const timer = setTimeout(() => {
            if (searchQuery) searchDci(searchQuery)
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
    <div className="flex-1 relative flex flex-col gap-2 p-3 md:p-4">
      <div className="flex justify-between items-center">
            <label className="label text-xs font-bold text-base-content/50 uppercase tracking-wider py-0">
                {searchMode === 'products' ? t('facturation:search.label') : searchMode === 'packs' ? t('facturation:search.label_pack') : t('facturation:search.label_dci')}
            </label>
            
            {/* Tabs */}
            <div className="flex bg-base-200 p-1 rounded-lg items-center gap-1">
                <button 
                    className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${searchMode === 'products' ? 'bg-base-100 shadow text-primary' : 'text-base-content/60 hover:text-base-content/90'}`}
                    onClick={() => { setSearchMode('products'); setSearchQuery(''); searchInputRef.current?.focus() }}
                >
                    <Pill size={14} /> {t('facturation:search.tabs_products')}
                </button>
                <button 
                    className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${searchMode === 'packs' ? 'bg-base-100 shadow text-secondary' : 'text-base-content/60 hover:text-base-content/90'}`}
                    onClick={() => { setSearchMode('packs'); setSearchQuery(''); searchInputRef.current?.focus() }}
                >
                    <Package size={14} /> {t('facturation:search.tabs_packs')}
                </button>
                <button 
                    className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${searchMode === 'dci' ? 'bg-base-100 shadow text-accent' : 'text-base-content/60 hover:text-base-content/90'}`}
                    onClick={() => { setSearchMode('dci'); setSearchQuery(''); setSelectedDci(null); setDciProducts([]); searchInputRef.current?.focus() }}
                >
                    <FlaskConical size={14} /> {t('facturation:search.tabs_dci')}
                </button>
                
                {/* File Upload for CSV */}
                {onCsvImport && (
                    <div className="relative border-l border-base-200 pl-1 ml-1 flex items-center">
                        <input 
                            type="file" 
                            accept=".csv" 
                            id="csv_import"
                            className="hidden" 
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file && onCsvImport) {
                                  onCsvImport(file);
                                }
                                // Reset input so same file can be selected again if needed
                                e.target.value = '';
                            }}
                        />
                        <label 
                            htmlFor="csv_import" 
                            className="btn btn-xs bg-success/90 hover:bg-success text-success-content border-none shadow-sm rounded-md flex items-center gap-1 cursor-pointer font-bold"
                            title={t('facturation:search.csv_import_tooltip')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                            CSV
                        </label>
                    </div>
                )}
            </div>
      </div>

      <div className="relative">
        <input
          ref={searchInputRef}
          type="text"
          placeholder={
            searchMode === 'products' ? (placeholder || t('facturation:search.placeholder')) :
            searchMode === 'packs' ? t('facturation:search.placeholder_pack') :
            t('facturation:search.placeholder_dci')
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={onInternalKeyDown}
          className={`input input-bordered w-full pl-12 text-lg h-14 bg-base-50 focus:bg-base-100 transition-colors focus:ring-2 ${
            searchMode === 'products' ? 'focus:ring-primary/20' :
            searchMode === 'packs' ? 'focus:ring-secondary/20' :
            'focus:ring-accent/20'
          }`}
        />
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>
      
      {/* Search Results Dropdown */}
      {(searchQuery || selectedDci) && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-base-100 rounded-xl shadow-xl border border-base-200 max-h-[60vh] overflow-y-auto z-50">
          
          {/* PRODUCT MODE */}
          {searchMode === 'products' && (
             filteredProduits.length === 0 ? (
                <div className="text-center py-8 text-base-content/40 text-sm">
                {searchLoading ? <span className="loading loading-spinner loading-sm"></span> : searchQuery.length < 2 ? t('facturation:search.min_chars') : t('facturation:search.no_results')}
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
                        <div className="flex items-center gap-2">
                            <div className="font-medium truncate text-sm">{produit.name}</div>
                            {produit.active_promis_count && produit.active_promis_count > 0 ? (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-warning/20 text-warning-content border border-warning/30 rounded animate-pulse shrink-0">
                                    PROMIS ({produit.active_promis_count})
                                </span>
                            ) : null}
                        </div>
                        <div className="text-xs flex gap-3 mt-0.5 opacity-80">
                        <span className={(produit.stock ?? 0) <= 0 ? 'text-error font-bold' : ''}>
                            {t('facturation:search.stock_label')} {produit.stock}
                        </span>
                        <span>{formatCurrency(Number(produit.selling_price))}</span>
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
                {packLoading ? <span className="loading loading-spinner loading-sm"></span> : searchQuery.length < 2 ? t('facturation:search.placeholder_pack') : t('facturation:search.no_results_pack')}
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
                        <div className="text-xs text-base-content/60 mt-0.5">
                            {formatCurrency(Number(pack.value))} • {pack.products_count || pack.pack_items?.length || '?'} {t('facturation:search.products_count')}
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

          {/* DCI MODE */}
          {searchMode === 'dci' && (
            selectedDci ? (
              /* DCI Products view */
              <div className="p-2">
                <div className="flex items-center justify-between mb-2 p-2 bg-accent/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FlaskConical size={16} className="text-accent" />
                    <span className="font-bold text-sm">{selectedDci.nom}</span>
                  </div>
                  <button
                    className="btn btn-xs btn-ghost"
                    onClick={() => { setSelectedDci(null); setDciProducts([]); searchInputRef.current?.focus() }}
                  >
                    ← Retour
                  </button>
                </div>
                {dciProductsLoading ? (
                  <div className="text-center py-8"><span className="loading loading-spinner loading-sm"></span></div>
                ) : dciProducts.length === 0 ? (
                  <div className="text-center py-8 text-base-content/40 text-sm">Aucun produit en stock pour cette DCI</div>
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-1">
                  {dciProducts.map((produit, idx) => {
                    const itemProps = getItemProps(idx);
                    return (
                    <div
                      key={produit.id}
                      {...itemProps}
                      onClick={() => {
                        if ((produit.stock ?? 0) > 0) {
                          handleAddProduit(produit)
                          setSelectedDci(null)
                          setDciProducts([])
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
                            {t('facturation:search.stock_label')} {produit.stock}
                          </span>
                          <span>{formatCurrency(Number(produit.selling_price))}</span>
                        </div>
                      </div>
                      {(produit.stock ?? 0) > 0 && (
                        <button className="btn btn-ghost btn-sm btn-circle opacity-0 group-hover:opacity-100 text-accent">
                        +
                        </button>
                      )}
                    </div>
                    )
                  })}
                  </div>
                )}
              </div>
            ) : (
              /* DCI Search results */
              dciResults.length === 0 ? (
                <div className="text-center py-8 text-base-content/40 text-sm">
                {dciLoading ? <span className="loading loading-spinner loading-sm"></span> : searchQuery.length < 2 ? t('facturation:search.min_chars') : t('facturation:search.no_results_dci')}
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-1 p-1">
                {dciResults.map((dci, idx) => {
                  const itemProps = getItemProps(idx);
                  return (
                  <div
                    key={dci.id}
                    {...itemProps}
                    onClick={() => { setSelectedDci(dci); setSearchQuery(''); fetchDciProducts(dci.id); }}
                    style={itemProps.style}
                    className={`
                      group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border-l-4 border-accent/50
                      ${itemProps.className ? 'shadow-md bg-accent/5' : 'hover:bg-base-100'}
                    `}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-accent text-sm">{dci.nom}</div>
                      <div className="text-xs text-base-content/60 mt-0.5">
                        {dci.produits_count || 0} {t('facturation:search.dci_products_count')}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-circle opacity-0 group-hover:opacity-100 text-accent">
                      →
                    </button>
                  </div>
                  )
                })}
                </div>
              )
            )
          )}

        </div>
      )}
    </div>
  )
})

export default ProductSearchSection
