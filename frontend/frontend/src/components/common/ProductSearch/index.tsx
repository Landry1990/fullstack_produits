import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../../utils/formatters'
import { Pill, Package, FlaskConical, Search, Plus, ArrowLeft, Upload } from 'lucide-react'
import { Button } from '../../shadcn/button'
import { Badge } from '../../shadcn/badge'
import { cn } from '../../../lib/utils'
import type { ProductSearchProps, SearchMode, SearchResult, PackResult, DciResult } from './types'

export * from './types'

const modeConfig: Record<SearchMode, { icon: React.ReactNode; color: string; label: string }> = {
  products: { icon: <Pill className="size-3.5" />, color: 'emerald', label: 'products' },
  packs: { icon: <Package className="size-3.5" />, color: 'violet', label: 'packs' },
  dci: { icon: <FlaskConical className="size-3.5" />, color: 'amber', label: 'dci' }
}

export const ProductSearch: React.FC<ProductSearchProps> = ({
  searchQuery,
  setSearchQuery,
  results,
  loading,
  placeholder,
  modes = ['products'],
  showCsvImport = false,
  onSelect,
  onCsvImport,
  onQuantityShortcut,
  // Mode DCI/Packs
  packResults = [],
  dciResults = [],
  selectedDci,
  setSelectedDci,
  dciProducts = [],
  onSelectPack,
  onSelectDci,
  // Search state
  searchInputRef,
  handleKeyDown,
  getItemProps
}) => {
  const { t } = useTranslation(['facturation', 'common'])
  const [internalMode, setInternalMode] = React.useState<SearchMode>(modes[0])
  const searchMode = selectedDci ? 'dci' : internalMode
  
  const handleModeChange = (mode: SearchMode) => {
    setInternalMode(mode)
    setSearchQuery('')
    if (setSelectedDci) setSelectedDci(null)
    searchInputRef.current?.focus()
  }
  
  const onInternalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Quantity shortcut
    if ((e.key === '*' || e.key === 'Multiply') && onQuantityShortcut && searchQuery && !isNaN(Number(searchQuery))) {
      e.preventDefault()
      onQuantityShortcut(Number(searchQuery))
      setSearchQuery('')
      return
    }
    
    const resultCount = searchMode === 'packs' ? packResults.length : 
                      searchMode === 'dci' ? (selectedDci ? dciProducts.length : dciResults.length) :
                      results.length
    
    handleKeyDown?.(e, resultCount)
  }
  
  const renderModeTabs = () => {
    if (modes.length <= 1) return null
    
    return (
      <div className="flex bg-slate-100 p-1 rounded-xl items-center gap-1">
        {modes.map((mode) => {
          const config = modeConfig[mode]
          const isActive = searchMode === mode && !selectedDci
          const colorClass = isActive ? `text-${config.color}-600 bg-white shadow-sm` : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
          
          return (
            <Button
              key={mode}
              variant="ghost"
              size="sm"
              className={cn("h-7 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all", colorClass)}
              onClick={() => handleModeChange(mode)}
            >
              {config.icon}
              {t(`facturation:search.tabs_${config.label}`)}
            </Button>
          )
        })}
        
        {showCsvImport && (
          <div className="relative border-l border-slate-200 pl-1 ml-1 flex items-center">
            <input
              type="file"
              accept=".csv"
              id="csv_import"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file && onCsvImport) onCsvImport(file)
                e.target.value = ''
              }}
            />
            <label
              htmlFor="csv_import"
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer transition-colors"
              title={t('facturation:search.csv_import_tooltip')}
            >
              <Upload className="size-3.5" />
              CSV
            </label>
          </div>
        )}
      </div>
    )
  }
  
  const renderSearchInput = () => {
    const getPlaceholder = () => {
      if (placeholder) return placeholder
      if (searchMode === 'packs') return t('facturation:search.placeholder_pack')
      if (searchMode === 'dci') return t('facturation:search.placeholder_dci')
      return t('facturation:search.placeholder')
    }
    
    const getFocusColor = () => {
      if (searchMode === 'packs') return 'focus:ring-violet-100 focus:border-violet-300'
      if (searchMode === 'dci') return 'focus:ring-amber-100 focus:border-amber-300'
      return 'focus:ring-emerald-100 focus:border-emerald-300'
    }
    
    return (
      <div className="relative">
        <input
          ref={searchInputRef}
          type="text"
          placeholder={getPlaceholder()}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={onInternalKeyDown}
          className={cn(
            "w-full pl-12 pr-4 text-lg h-14 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all",
            getFocusColor()
          )}
        />
        <Search className="size-6 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 inline-block size-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        )}
      </div>
    )
  }
  
  const renderProductItem = (item: SearchResult, idx: number) => {
    const itemProps = getItemProps?.(idx) || { className: '', style: {} }
    const isSelected = itemProps.className?.includes('shadow')
    const isOutOfStock = (item.stock ?? 0) <= 0
    
    return (
      <div
        key={item.id}
        {...itemProps}
        onClick={() => !isOutOfStock && onSelect(item)}
        className={cn(
          "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all",
          isSelected ? 'bg-emerald-50 shadow-md border-l-4 border-l-emerald-500' : 'hover:bg-slate-50',
          isOutOfStock ? 'text-slate-400 cursor-not-allowed' : ''
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate text-sm text-slate-800">{item.name}</div>
            {item.active_promis_count && item.active_promis_count > 0 && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-amber-100 text-amber-700 border-amber-200 animate-pulse shrink-0">
                PROMIS ({item.active_promis_count})
              </Badge>
            )}
          </div>
          <div className="text-xs flex gap-3 mt-0.5">
            <span className={isOutOfStock ? 'text-red-500 font-semibold' : 'text-slate-500'}>
              {t('facturation:search.stock_label')} {item.stock}
            </span>
            <span className="text-slate-600 font-medium">{formatCurrency(Number(item.selling_price))}</span>
          </div>
        </div>
        {!isOutOfStock && (
          <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100">
            <Plus className="size-4" />
          </Button>
        )}
      </div>
    )
  }
  
  const renderPackItem = (pack: PackResult, idx: number) => {
    const itemProps = getItemProps?.(idx) || { className: '', style: {} }
    const isSelected = itemProps.className?.includes('shadow')
    
    return (
      <div
        key={pack.id}
        {...itemProps}
        onClick={() => onSelectPack?.(pack)}
        className={cn(
          "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border-l-4 border-violet-400",
          isSelected ? 'shadow-md bg-violet-50' : 'hover:bg-slate-50'
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-violet-700 text-sm">{pack.name}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {formatCurrency(Number(pack.value))} • {pack.products_count || pack.pack_items?.length || '?'} {t('facturation:search.products_count')}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 text-violet-600 hover:text-violet-700 hover:bg-violet-100">
          <Plus className="size-4" />
        </Button>
      </div>
    )
  }
  
  const renderDciItem = (dci: DciResult, idx: number) => {
    const itemProps = getItemProps?.(idx) || { className: '', style: {} }
    const isSelected = itemProps.className?.includes('shadow')
    
    return (
      <div
        key={dci.id}
        {...itemProps}
        onClick={() => onSelectDci?.(dci)}
        className={cn(
          "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border-l-4 border-amber-400",
          isSelected ? 'shadow-md bg-amber-50' : 'hover:bg-slate-50'
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-amber-700 text-sm">{dci.nom}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {dci.produits_count || 0} {t('facturation:search.dci_products_count')}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 text-amber-600 hover:text-amber-700 hover:bg-amber-100">
          <Plus className="size-4" />
        </Button>
      </div>
    )
  }
  
  const renderResults = () => {
    // DCI Products view
    if (selectedDci && searchMode === 'dci') {
      return (
        <div className="p-2">
          <div className="flex items-center justify-between mb-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
            <div className="flex items-center gap-2">
              <FlaskConical className="size-4 text-amber-600" />
              <span className="font-semibold text-sm text-amber-800">{selectedDci.nom}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-100"
              onClick={() => setSelectedDci?.(null)}
            >
              <ArrowLeft className="size-3.5 mr-1" />
              Retour
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-0.5">
            {dciProducts.map((produit, idx) => renderProductItem(produit as SearchResult, idx))}
          </div>
        </div>
      )
    }
    
    // Pack results
    if (searchMode === 'packs') {
      if (packResults.length === 0) {
        return (
          <div className="text-center py-8 text-slate-400 text-sm">
            {searchQuery.length < 2 ? t('facturation:search.placeholder_pack') : t('facturation:search.no_results_pack')}
          </div>
        )
      }
      return (
        <div className="max-h-96 overflow-y-auto space-y-0.5 p-1">
          {packResults.map((pack, idx) => renderPackItem(pack, idx))}
        </div>
      )
    }
    
    // DCI results
    if (searchMode === 'dci') {
      if (dciResults.length === 0) {
        return (
          <div className="text-center py-8 text-slate-400 text-sm">
            {searchQuery.length < 2 ? t('facturation:search.min_chars') : t('facturation:search.no_results_dci')}
          </div>
        )
      }
      return (
        <div className="max-h-96 overflow-y-auto space-y-0.5 p-1">
          {dciResults.map((dci, idx) => renderDciItem(dci, idx))}
        </div>
      )
    }
    
    // Product results (default)
    if (results.length === 0) {
      return (
        <div className="text-center py-8 text-slate-400 text-sm">
          {searchQuery.length < 2 ? t('facturation:search.min_chars') : t('facturation:search.no_results')}
        </div>
      )
    }
    
    return (
      <div className="max-h-96 overflow-y-auto space-y-0.5 p-1">
        {results.map((item, idx) => renderProductItem(item, idx))}
      </div>
    )
  }
  
  const hasResults = searchQuery || selectedDci
  
  return (
    <div className="flex-1 relative flex flex-col gap-2 p-3 md:p-4">
      <div className="flex justify-between items-center">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider py-0">
          {searchMode === 'packs' ? t('facturation:search.label_pack') : 
           searchMode === 'dci' ? t('facturation:search.label_dci') : 
           t('facturation:search.label')}
        </label>
        {renderModeTabs()}
      </div>
      
      {renderSearchInput()}
      
      {hasResults && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-200 max-h-[60vh] overflow-y-auto z-50">
          {renderResults()}
        </div>
      )}
    </div>
  )
}

export default ProductSearch
