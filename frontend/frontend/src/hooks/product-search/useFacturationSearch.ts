import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { toast } from 'react-hot-toast'
import type { ProduitModel } from '../../types'
import type { SearchMode, PackResult, DciResult, SearchResult } from '../../components/common/ProductSearch/types'

export const useFacturationSearch = () => {
  const { t } = useTranslation(['facturation', 'common'])
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('products')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Results states
  const [productResults, setProductResults] = useState<SearchResult[]>([])
  const [packResults, setPackResults] = useState<PackResult[]>([])
  const [dciResults, setDciResults] = useState<DciResult[]>([])
  const [dciProducts, setDciProducts] = useState<ProduitModel[]>([])
  
  // Loading states
  const [loading, setLoading] = useState(false)
  const [packLoading, setPackLoading] = useState(false)
  const [dciLoading, setDciLoading] = useState(false)
  const [dciProductsLoading, setDciProductsLoading] = useState(false)
  
  // DCI selection
  const [selectedDci, setSelectedDci] = useState<DciResult | null>(null)
  
  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(-1)
  }, [searchQuery])
  
  // Search packs
  const searchPacks = useCallback(async (query: string) => {
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
      })
      const data = response.data
      setPackResults(Array.isArray(data) ? data : data.results || [])
    } catch (e) {
      console.error('Pack search error', e)
      toast.error(t('facturation:search.error_search_packs'))
    } finally {
      setPackLoading(false)
    }
  }, [t])
  
  // Search DCI
  const searchDci = useCallback(async (query: string) => {
    if (query.length < 2) {
      setDciResults([])
      return
    }
    setDciLoading(true)
    try {
      const response = await api.get('substances/', {
        params: { search: query, page_size: 50 }
      })
      const data = response.data
      setDciResults(Array.isArray(data) ? data : data.results || [])
    } catch (e) {
      console.error('DCI search error', e)
    } finally {
      setDciLoading(false)
    }
  }, [])
  
  // Fetch DCI products
  const fetchDciProducts = useCallback(async (substanceId: number) => {
    setDciProductsLoading(true)
    try {
      const response = await api.get('produits/', {
        params: { substances: substanceId, page_size: 100 }
      })
      const data = response.data
      setDciProducts(Array.isArray(data) ? data : data.results || [])
    } catch (e) {
      console.error('DCI products error', e)
    } finally {
      setDciProductsLoading(false)
    }
  }, [])
  
  // Debounced searches for packs and DCI
  useEffect(() => {
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
  }, [searchQuery, searchMode, searchPacks, searchDci])
  
  const resetSearch = useCallback(() => {
    setSearchQuery('')
    setSelectedIndex(-1)
    setSelectedDci(null)
    setProductResults([])
    setPackResults([])
    setDciResults([])
    setDciProducts([])
  }, [])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, resultCount: number) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < resultCount - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < resultCount) {
          const element = document.querySelector(`[data-search-index="${selectedIndex}"]`)
          element?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        }
        break
      case 'Escape':
        setSelectedIndex(-1)
        if (selectedDci) {
          setSelectedDci(null)
        } else {
          searchInputRef.current?.blur()
        }
        break
    }
  }, [selectedIndex, selectedDci])
  
  const getItemProps = useCallback((index: number) => {
    const isSelected = index === selectedIndex
    return {
      'data-search-index': index,
      className: isSelected ? 'shadow-md ring-2 ring-emerald-500/20' : '',
      style: isSelected ? { transform: 'scale(1.01)' } : {}
    }
  }, [selectedIndex])
  
  // Get current results based on mode
  const getCurrentResults = useCallback((): SearchResult[] => {
    switch (searchMode) {
      case 'products':
        return productResults
      case 'packs':
        return packResults.map(p => ({ ...p, name: p.name })) as SearchResult[]
      case 'dci':
        if (selectedDci) {
          return dciProducts as SearchResult[]
        } else {
          return dciResults.map(d => ({ ...d, name: d.nom })) as unknown as SearchResult[]
        }
      default:
        return productResults
    }
  }, [searchMode, productResults, packResults, dciResults, dciProducts, selectedDci])
  
  // Get current loading state
  const isLoading = searchMode === 'packs' ? packLoading : 
                    searchMode === 'dci' ? (selectedDci ? dciProductsLoading : dciLoading) :
                    loading
  
  return {
    // Search state
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    searchInputRef,
    selectedIndex,
    setSelectedIndex,
    
    // Results
    results: getCurrentResults(),
    loading: isLoading,
    productResults,
    setProductResults,
    packResults,
    dciResults,
    selectedDci,
    setSelectedDci,
    dciProducts,
    
    // Actions
    resetSearch,
    handleKeyDown,
    getItemProps,
    fetchDciProducts,
    
    // Mode-specific actions
    onSelectDci: (dci: DciResult) => {
      setSelectedDci(dci)
      setSearchQuery('')
      fetchDciProducts(dci.id)
    }
  }
}
