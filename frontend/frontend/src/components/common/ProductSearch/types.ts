import type { ProduitModel, User } from '../../../types'

export type SearchMode = 'products' | 'packs' | 'dci'

export interface SearchResult {
  id: number
  name: string
  stock?: number
  selling_price?: number | string
  isPromis?: boolean
  active_promis_count?: number
  [key: string]: any
}

export interface PackResult {
  id: number
  name: string
  value: number | string
  products_count?: number
  pack_items?: any[]
}

export interface DciResult {
  id: number
  nom: string
  produits_count?: number
}

export interface ProductSearchState {
  searchQuery: string
  setSearchQuery: (v: string) => void
  searchMode: SearchMode
  setSearchMode: (mode: SearchMode) => void
  results: SearchResult[]
  loading: boolean
  selectedIndex: number
  searchInputRef: React.RefObject<HTMLInputElement | null>
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  getItemProps: (index: number) => { className: string; style: React.CSSProperties }
  resetSearch: () => void
}

export interface ProductSearchProps {
  // États de recherche
  searchQuery: string
  setSearchQuery: (v: string) => void
  results: SearchResult[]
  loading: boolean
  
  // Configuration
  placeholder?: string
  modes?: SearchMode[]
  showCsvImport?: boolean
  
  // Callbacks
  onSelect: (item: SearchResult | ProduitModel) => void
  onSelectOutOfStock?: (item: SearchResult) => void
  onCsvImport?: (file: File) => void
  onQuantityShortcut?: (qty: number) => void
  
  // Mode DCI/Packs (spécifique facturation)
  packResults?: PackResult[]
  dciResults?: DciResult[]
  selectedDci?: DciResult | null
  setSelectedDci?: (dci: DciResult | null) => void
  dciProducts?: ProduitModel[]
  onSelectPack?: (pack: PackResult) => void
  onSelectDci?: (dci: DciResult) => void
  
  // Navigation clavier
  handleKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>, resultCount: number) => void
  getItemProps?: (index: number) => { 'data-search-index': number; className: string; style: React.CSSProperties }
  
  // Ref
  searchInputRef: React.RefObject<HTMLInputElement | null>

  // Permissions
  user?: User | null
}

export interface UseProductSearchOptions {
  modes?: SearchMode[]
  enableQuantityShortcut?: boolean
  onQuantityShortcut?: (qty: number) => void
}
