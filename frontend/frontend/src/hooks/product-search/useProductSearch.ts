import { useState, useRef, useCallback, useEffect } from 'react'
import type { SearchMode, SearchResult, UseProductSearchOptions } from '../../components/common/ProductSearch/types'

export const useProductSearch = (options: UseProductSearchOptions = {}) => {
  const { modes = ['products'], enableQuantityShortcut = false, onQuantityShortcut } = options
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>(modes[0])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(-1)
  }, [searchQuery])
  
  const resetSearch = useCallback(() => {
    setSearchQuery('')
    setSelectedIndex(-1)
  }, [])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, resultCount: number) => {
    // Quantity shortcut (* key)
    if ((e.key === '*' || e.key === 'Multiply') && enableQuantityShortcut && searchQuery && !isNaN(Number(searchQuery))) {
      e.preventDefault()
      onQuantityShortcut?.(Number(searchQuery))
      setSearchQuery('')
      return
    }
    
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
          // Item selection will be handled by the parent via getItemProps
          const element = document.querySelector(`[data-search-index="${selectedIndex}"]`)
          element?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        }
        break
      case 'Escape':
        setSelectedIndex(-1)
        searchInputRef.current?.blur()
        break
    }
  }, [searchQuery, selectedIndex, enableQuantityShortcut, onQuantityShortcut])
  
  const getItemProps = useCallback((index: number) => {
    const isSelected = index === selectedIndex
    return {
      'data-search-index': index,
      className: isSelected ? 'shadow-md ring-2 ring-emerald-500/20' : '',
      style: isSelected ? { transform: 'scale(1.01)' } : {}
    }
  }, [selectedIndex])
  
  return {
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    selectedIndex,
    setSelectedIndex,
    searchInputRef,
    handleKeyDown,
    getItemProps,
    resetSearch
  }
}
