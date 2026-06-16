import { useState, useCallback, useEffect, useRef } from 'react'
import api from '../../services/api'
import type { ProduitModel } from '../../types'
import type { SearchResult } from '../../components/common/ProductSearch/types'

export interface LotInfo {
  id: number
  numero: string
  quantite: number
  quantite_disponible: number
  peremption: string
}

export const useInventaireSearch = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1)
  const [selectedProductForLot, setSelectedProductForLot] = useState<ProduitModel | null>(null)
  const [showLotModal, setShowLotModal] = useState(false)
  const [availableLots, setAvailableLots] = useState<LotInfo[]>([])
  const [loadingLots, setLoadingLots] = useState(false)
  const [selectedLotIndex, setSelectedLotIndex] = useState(0)
  const [lotQuantities, setLotQuantities] = useState<Record<number, number>>({})
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lotModalRef = useRef<HTMLDivElement>(null)
  
  // Search products
  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        return
      }
      
      setLoadingSearch(true)
      try {
        const response = await api.get('produits/', {
          params: {
            search: searchQuery,
            page_size: 50,
            fields: 'id,name,stock,reference,selling_price,category'
          }
        })
        const data = response.data
        const results = Array.isArray(data) ? data : data.results || []
        setSearchResults(results.map((p: ProduitModel) => ({
          ...p,
          id: p.id,
          name: p.name,
          stock: p.stock,
          selling_price: p.selling_price
        })))
      } catch (e) {
        console.error('Search error', e)
        setSearchResults([])
      } finally {
        setLoadingSearch(false)
      }
    }
    
    const timer = setTimeout(searchProducts, 200)
    return () => clearTimeout(timer)
  }, [searchQuery])
  
  // Reset index when results change
  useEffect(() => {
    setSelectedItemIndex(-1)
  }, [searchResults])
  
  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedItemIndex >= 0) {
      const el = document.getElementById(`search-result-${selectedItemIndex}`)
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedItemIndex])
  
  // Focus lot modal when shown
  useEffect(() => {
    if (showLotModal && lotModalRef.current) {
      lotModalRef.current.focus()
    }
  }, [showLotModal])
  
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedItemIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedItemIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedItemIndex >= 0 && selectedItemIndex < searchResults.length) {
          const product = searchResults[selectedItemIndex] as ProduitModel
          handleProductSelect(product)
        }
        break
      case 'Escape':
        setSelectedItemIndex(-1)
        searchInputRef.current?.blur()
        break
    }
  }, [searchResults, selectedItemIndex])
  
  const fetchLots = useCallback(async (productId: number) => {
    setLoadingLots(true)
    try {
      const response = await api.get(`produits/${productId}/lots/`)
      const data = response.data
      const lots = Array.isArray(data) ? data : data.results || []
      setAvailableLots(lots)
      
      // Initialize quantities
      const initialQuantities: Record<number, number> = {}
      lots.forEach((lot: LotInfo) => {
        initialQuantities[lot.id] = 0
      })
      setLotQuantities(initialQuantities)
    } catch (e) {
      console.error('Fetch lots error', e)
      setAvailableLots([])
    } finally {
      setLoadingLots(false)
    }
  }, [])
  
  const handleProductSelect = useCallback((product: ProduitModel) => {
    setSelectedProductForLot(product)
    setShowLotModal(true)
    setSelectedLotIndex(0)
    fetchLots(product.id)
  }, [fetchLots])
  
  const handleLotSelection = useCallback((lotIndex: number) => {
    setSelectedLotIndex(lotIndex)
  }, [])
  
  const handleMultiLotConfirm = useCallback(() => {
    // Return selected product with lot quantities
    const result = {
      product: selectedProductForLot,
      quantities: lotQuantities,
      lots: availableLots.filter(lot => (lotQuantities[lot.id] || 0) > 0)
    }
    
    setShowLotModal(false)
    setSelectedProductForLot(null)
    setAvailableLots([])
    setLotQuantities({})
    setSearchQuery('')
    setSearchResults([])
    
    return result
  }, [selectedProductForLot, lotQuantities, availableLots])
  
  const focusInput = useCallback(() => {
    searchInputRef.current?.focus()
  }, [])
  
  const getItemProps = useCallback((index: number) => {
    const isSelected = index === selectedItemIndex
    return {
      id: `search-result-${index}`,
      className: isSelected 
        ? 'bg-emerald-50 shadow-md ring-1 ring-emerald-500/20 scale-[1.01]' 
        : 'hover:bg-slate-50'
    }
  }, [selectedItemIndex])
  
  return {
    // Search state
    searchQuery,
    setSearchQuery,
    searchResults,
    loadingSearch,
    selectedItemIndex,
    searchInputRef,
    
    // Lot modal state
    showLotModal,
    setShowLotModal,
    selectedProductForLot,
    availableLots,
    loadingLots,
    selectedLotIndex,
    setSelectedLotIndex,
    lotQuantities,
    setLotQuantities,
    lotModalRef,
    
    // Actions
    handleSearchKeyDown,
    handleProductSelect,
    handleLotSelection,
    handleMultiLotConfirm,
    getItemProps,
    focusInput
  }
}
