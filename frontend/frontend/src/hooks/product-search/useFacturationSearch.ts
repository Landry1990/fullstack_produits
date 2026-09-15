import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import api from '../../services/api'
import { gooeyToast } from 'goey-toast'
import type { ProduitModel } from '../../types'
import type { SearchMode, PackResult, DciResult, SearchResult } from '../../components/common/ProductSearch/types'
import { logger } from '../../utils/logger'

interface UseFacturationSearchParams {
  searchQuery: string
  searchMode: SearchMode
}

const STALE_TIME = 1000 * 60
const GC_TIME = 1000 * 60 * 5

export const useFacturationSearch = (params: UseFacturationSearchParams) => {
  const { t } = useTranslation(['facturation', 'common'])
  const { searchQuery, searchMode } = params

  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [productResults, setProductResults] = useState<SearchResult[]>([])
  const [selectedDci, setSelectedDci] = useState<DciResult | null>(null)

  const [debouncedSearch] = useDebounce(searchQuery, 300)

  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(-1)
  }, [searchQuery])

  // Pack search
  const {
    data: packResults = [],
    isLoading: packLoading,
    error: packError
  } = useQuery<PackResult[]>({
    queryKey: ['facturation', 'packs', debouncedSearch],
    queryFn: async () => {
      const response = await api.get('promotions/', {
        params: {
          search: debouncedSearch,
          discount_type: 'BUNDLE',
          active: true,
          page_size: 50
        }
      })
      const data = response.data
      return Array.isArray(data) ? data : data.results || []
    },
    enabled: searchMode === 'packs' && debouncedSearch.length >= 3,
    staleTime: STALE_TIME,
    gcTime: GC_TIME
  })

  useEffect(() => {
    if (packError) {
      logger.error('Pack search error', packError)
      gooeyToast.error(t('facturation:search.error_search_packs'))
    }
  }, [packError, t])

  // Search DCI
  const {
    data: dciResults = [],
    isLoading: dciLoading,
    error: dciError
  } = useQuery<DciResult[]>({
    queryKey: ['facturation', 'dci', debouncedSearch],
    queryFn: async () => {
      const response = await api.get('substances/', {
        params: { search: debouncedSearch, page_size: 50 }
      })
      const data = response.data
      return Array.isArray(data) ? data : data.results || []
    },
    enabled: searchMode === 'dci' && debouncedSearch.length >= 3,
    staleTime: STALE_TIME,
    gcTime: GC_TIME
  })

  useEffect(() => {
    if (dciError) {
      logger.error('DCI search error', dciError)
    }
  }, [dciError])

  // Fetch DCI products
  const {
    data: dciProducts = [],
    isLoading: dciProductsLoading
  } = useQuery<ProduitModel[]>({
    queryKey: ['facturation', 'dci-products', selectedDci?.id],
    queryFn: async () => {
      const response = await api.get('produits/', {
        params: { substances: selectedDci!.id, page_size: 50 }
      })
      const data = response.data
      return Array.isArray(data) ? data : data.results || []
    },
    enabled: !!selectedDci,
    staleTime: STALE_TIME,
    gcTime: GC_TIME
  })

  const resetSearch = useCallback(() => {
    setSelectedIndex(-1)
    setSelectedDci(null)
    setProductResults([])
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, resultCount: number) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => {
          const newIndex = prev < resultCount - 1 ? prev + 1 : prev
          if (newIndex !== prev) {
            setTimeout(() => {
              const el = document.querySelector(`[data-search-index="${newIndex}"]`)
              el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
            }, 0)
          }
          return newIndex
        })
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : -1
          if (newIndex !== prev && newIndex >= 0) {
            setTimeout(() => {
              const el = document.querySelector(`[data-search-index="${newIndex}"]`)
              el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
            }, 0)
          }
          return newIndex
        })
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
          return dciProducts as unknown as SearchResult[]
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
                    false

  return {
    // Search state
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
    fetchDciProducts: async (_substanceId: number) => { /* driven by selectedDci state */ },

    // Mode-specific actions
    onSelectDci: (dci: DciResult) => {
      setSelectedDci(dci)
    }
  }
}
