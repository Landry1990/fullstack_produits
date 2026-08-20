import { safeStorage } from './storage'
import type { SearchResult } from '../components/common/ProductSearch/types'

const KEY = 'facturation_recent_products'

export function getRecentProducts(): SearchResult[] {
  try {
    const raw = safeStorage.getItem(KEY, 'session')
    return raw ? (JSON.parse(raw) as SearchResult[]) : []
  } catch {
    return []
  }
}

export function addRecentProducts(products: SearchResult[]) {
  const current = getRecentProducts()
  const next = [...products, ...current.filter(p => !products.some(n => n.id === p.id))].slice(0, 5)
  safeStorage.setItem(KEY, JSON.stringify(next), 'session')
  window.dispatchEvent(new CustomEvent('recent-products-updated', { detail: next }))
}

function addRecentProduct(product: SearchResult) {
  addRecentProducts([product])
}
