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

const isActiveItem = (itemProps: { className?: string; style?: React.CSSProperties }) =>
  Object.keys(itemProps.style || {}).length > 0 ||
  itemProps.className?.includes('active') ||
  itemProps.className?.includes('shadow')

export const ProductSearch: React.FC<ProductSearchProps> = ({
  searchQuery,
  setSearchQuery,
  results,
  loading,
  placeholder,
  modes = ['products'],
  showCsvImport = false,
  onSelect,
  onSelectOutOfStock,
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
  getItemProps,
  // Controlled mode
  controlledMode,
  onModeChange,
  // Permissions
  user,
  skipStockCheck = false,
  compact = false,
  recentProducts = []
}) => {
  const { t } = useTranslation(['facturation', 'common'])
  const [internalMode, setInternalMode] = React.useState<SearchMode>(modes[0])
  const [isFocused, setIsFocused] = React.useState(false)
  const searchMode = selectedDci ? 'dci' : (controlledMode ?? internalMode)
  const resultsContainerRef = React.useRef<HTMLDivElement>(null)

  // Garde l'élément sélectionné au clavier visible dans le dropdown (auto-scroll).
  const activeResultCount = searchMode === 'packs' ? packResults.length :
    searchMode === 'dci' ? (selectedDci ? dciProducts.length : dciResults.length) :
    (searchMode === 'products' && !searchQuery ? recentProducts.length : results.length)

  const activeIndex = React.useMemo(() => {
    if (!getItemProps) return -1
    for (let i = 0; i < activeResultCount; i++) {
      if (isActiveItem(getItemProps(i))) return i
    }
    return -1
  }, [getItemProps, activeResultCount])

  React.useEffect(() => {
    if (activeIndex < 0 || !resultsContainerRef.current) return
    const item = getItemProps?.(activeIndex)
    const el = item?.id ? document.getElementById(item.id) : resultsContainerRef.current.querySelector(`[data-search-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, getItemProps])
  
  const handleModeChange = (mode: SearchMode) => {
    if (onModeChange) {
      onModeChange(mode)
    } else {
      setInternalMode(mode)
    }
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
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          className={cn(
            "w-full pl-10 pr-4 text-base h-11 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all",
            getFocusColor()
          )}
        />
        <Search className="size-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 inline-block size-3.5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        )}
      </div>
    )
  }
  
  const renderProductItem = (item: SearchResult, idx: number) => {
    const itemProps = getItemProps?.(idx) || { className: '', style: {} }
    const isActive = isActiveItem(itemProps)
    const stock = item.stock ?? 0
    const stockMin = item.stock_minimum ?? 0
    const canSellNegativeStock = skipStockCheck || user?.is_superuser || user?.profile?.can_sell_negative_stock || user?.can_sell_negative_stock
    const isOutOfStock = stock <= 0
    const isBlocked = isOutOfStock && !canSellNegativeStock
    const isNegativeStock = stock < 0
    const isZeroStock = stock === 0
    const isLowStock = stock > 0 && stockMin > 0 && stock <= stockMin

    const handleClick = () => {
      if (isBlocked) return
      if (isOutOfStock && onSelectOutOfStock) {
        onSelectOutOfStock(item)
      } else {
        onSelect(item)
      }
    }

    return (
      <div
        key={item.id}
        {...itemProps}
        onClick={handleClick}
        style={isActive ? itemProps.style : undefined}
        className={cn(
          itemProps.className,
          "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all",
          isActive ? 'bg-blue-500 shadow-md border-l-4 border-l-blue-700' : 'hover:bg-slate-50',
          isBlocked && !isActive ? 'text-slate-400 cursor-not-allowed' : ''
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={cn(
              "truncate text-sm",
              isActive ? 'text-white font-bold' :
              isNegativeStock ? 'text-red-600 font-medium' :
              isZeroStock ? 'text-slate-500 font-normal' :
              'text-slate-800 font-bold'
            )}>{item.name}</div>
            {isLowStock && (
              <Badge variant="secondary" className={cn("text-[10px] h-4 px-1 shrink-0", isActive ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-100 text-amber-700 border-amber-200')}>
                {t('facturation:search.low_stock_badge')}
              </Badge>
            )}
            {(item.active_promis_count ?? 0) > 0 && (
              <Badge variant="secondary" className={cn("text-[10px] h-4 px-1 shrink-0", isActive ? 'bg-blue-400 text-white border-blue-300' : 'bg-amber-100 text-amber-700 border-amber-200 animate-pulse')}>
                PROMIS ({item.active_promis_count})
              </Badge>
            )}
          </div>
          {(item.cip1 || item.rayon_name) && (
            <div className={cn(
              "text-[10px] flex gap-1.5 mt-0.5",
              isActive ? 'text-blue-100' : 'text-slate-400'
            )}>
              {item.cip1 && <span className={cn("font-mono px-1 rounded", isActive ? 'bg-white/20' : 'bg-slate-100')}>{item.cip1}</span>}
              {item.rayon_name && <span>• {item.rayon_name}</span>}
            </div>
          )}
          <div className="text-xs flex gap-3 mt-0.5">
            <span className={cn(
              isActive ? 'text-blue-100 font-semibold' :
              isNegativeStock ? 'text-red-500 font-semibold' :
              isZeroStock ? 'text-slate-400' :
              'text-slate-500'
            )}>
              {isZeroStock
                ? t('facturation:search.out_of_stock', { defaultValue: 'Épuisé' })
                : `${t('facturation:search.stock_label')} ${stock}`}
            </span>
            <span className={cn(isActive ? 'text-white font-semibold' : 'text-slate-600 font-medium')}>{formatCurrency(Number(item.selling_price))}</span>
          </div>
        </div>
        {!isBlocked && (
          <Button variant="ghost" size="icon" className={cn("size-8 opacity-0 group-hover:opacity-100", isActive ? 'text-white hover:text-white hover:bg-blue-600' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100')}>
            <Plus className="size-4" />
          </Button>
        )}
      </div>
    )
  }
  
  const renderPackItem = (pack: PackResult, idx: number) => {
    const itemProps = getItemProps?.(idx) || { className: '', style: {} }
    const isSelected = isActiveItem(itemProps)
    
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
    const isSelected = isActiveItem(itemProps)
    
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
            {dci.produits_count ? `${dci.produits_count} ${t('facturation:search.dci_products_count')}` : ''}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 text-amber-600 hover:text-amber-700 hover:bg-amber-100">
          <Plus className="size-4" />
        </Button>
      </div>
    )
  }
  
  const renderSkeleton = () => (
    <div className="max-h-96 overflow-y-auto space-y-0.5 p-1">
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 border-y border-slate-100">
        {t('facturation:search.tabs_products')}
      </div>
      {[1, 2, 3].map((n) => (
        <div key={`skel-${n}`} className="p-3 rounded-lg animate-pulse">
          <div className="flex justify-between items-center mb-1.5">
            <div className="h-3.5 w-1/2 bg-slate-200 rounded" />
            <div className="h-3 w-1/5 bg-slate-200 rounded" />
          </div>
          <div className="flex justify-between items-center">
            <div className="h-2.5 w-1/3 bg-slate-200 rounded" />
            <div className="h-2.5 w-1/4 bg-slate-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  )

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
            {dciProducts.map((produit, idx) => renderProductItem(produit as unknown as SearchResult, idx))}
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
    if (searchMode === 'products' && !searchQuery && recentProducts.length > 0) {
      return (
        <div className="max-h-96 overflow-y-auto space-y-0.5 p-1">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 border-y border-slate-200">
            {t('facturation:search.recent_label')}
          </div>
          {recentProducts.map((item, idx) => renderProductItem(item, idx))}
        </div>
      )
    }
    if (searchMode === 'products' && loading) {
      return renderSkeleton()
    }
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
  
  const hasResults = isFocused || searchQuery || selectedDci
  
  return (
    <div className={cn("flex-1 relative flex flex-col gap-2", compact ? "p-0" : "p-3 md:p-4")}>
      {!compact && (
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider py-0">
            {searchMode === 'packs' ? t('facturation:search.label_pack') : 
             searchMode === 'dci' ? t('facturation:search.label_dci') : 
             t('facturation:search.label')}
          </label>
          {renderModeTabs()}
        </div>
      )}
      {compact && modes.length > 1 && (
        <div className="absolute right-0 top-0 z-10">
          {renderModeTabs()}
        </div>
      )}
      
      {renderSearchInput()}
      
      {hasResults && (
        <div
          ref={resultsContainerRef}
          className={cn(
            "absolute left-0 top-full mt-2 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-200 max-h-[60vh] overflow-y-auto z-50",
            compact ? "w-full max-w-xl" : "right-0"
          )}
        >
          {renderResults()}
        </div>
      )}
    </div>
  )
}

export default ProductSearch
