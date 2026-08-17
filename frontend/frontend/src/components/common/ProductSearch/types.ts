import type { ProduitModel, User } from '../../../types'

export type SearchMode = 'products' | 'packs' | 'dci'

export interface SearchResult {
  id: number
  name: string
  stock?: number
  stock_minimum?: number | null
  selling_price?: number | string
  isPromis?: boolean
  active_promis_count?: number
  /** Code CIP, affiché en sous-titre si présent (ex: écran inventaire) */
  cip1?: string | null
  /** Nom du rayon, affiché en sous-titre si présent (ex: écran inventaire) */
  rayon_name?: string | null
  [key: string]: unknown
}

export interface PackResult {
  id: number
  name: string
  value: number | string
  products_count?: number
  pack_items?: Array<{ product: number; quantity: number }>
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
  recentProducts?: SearchResult[]
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
  recentProducts?: SearchResult[]
  loading: boolean
  
  // Configuration
  placeholder?: string
  modes?: SearchMode[]
  showCsvImport?: boolean
  compact?: boolean
  
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

  // Controlled mode (optional — if provided, mode is managed externally)
  controlledMode?: SearchMode
  onModeChange?: (mode: SearchMode) => void

  // Permissions
  user?: User | null
  skipStockCheck?: boolean
}

export interface UseProductSearchOptions {
  modes?: SearchMode[]
  enableQuantityShortcut?: boolean
  onQuantityShortcut?: (qty: number) => void
}
