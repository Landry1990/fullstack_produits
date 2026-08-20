import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import type { ProduitModel, PaginatedResponse } from '../types'

/**
 * Index de recherche produit en mémoire.
 *
 * Précharge tous les produits actifs une seule fois au montage de l'app,
 * puis filtre localement sans appel API à chaque frappe.
 *
 * Pour ~5000 produits, l'index fait ~1-2 MB en mémoire — négligeable.
 * La recherche locale est instantanée (< 1ms) vs 200-400ms par round-trip API.
 */

interface SearchIndexEntry {
  product: ProduitModel
  nameNorm: string
  cip1: string
  cip2: string
  cip3: string
  // Mots individuels du nom pour recherche par token
  nameTokens: string[]
}

let cachedIndex: SearchIndexEntry[] | null = null
let cachedAt = 0
const CACHE_TTL = 1000 * 60 * 5 // 5 minutes

/** Normalise une chaîne pour la comparaison (sans accents, minuscules) */
function normalize(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Construit l'index de recherche à partir d'une liste de produits */
function buildIndex(products: ProduitModel[]): SearchIndexEntry[] {
  return products.map(p => {
    const nameNorm = normalize(p.name)
    return {
      product: p,
      nameNorm,
      cip1: normalize(p.cip1),
      cip2: normalize(p.cip2),
      cip3: normalize(p.cip3),
      nameTokens: nameNorm.split(/\s+/).filter(t => t.length >= 2),
    }
  })
}

/** Recherche dans l'index en mémoire */
function searchInIndex(index: SearchIndexEntry[], query: string, limit: number = 50): ProduitModel[] {
  const q = normalize(query)
  if (!q) return []

  const isNumeric = /^\d+$/.test(q)
  const results: { product: ProduitModel; score: number }[] = []

  for (const entry of index) {
    let score = 0

    // Recherche par CIP (priorité maximale — match exact)
    if (isNumeric) {
      if (entry.cip1 === q) score = 100
      else if (entry.cip2 === q) score = 99
      else if (entry.cip3 === q) score = 98
      else if (entry.cip1.startsWith(q)) score = 90
      else if (entry.cip2.startsWith(q)) score = 89
      else if (entry.cip3.startsWith(q)) score = 88
    }

    // Recherche par nom
    if (score === 0) {
      if (entry.nameNorm === q) {
        score = 80 // Match exact
      } else if (entry.nameNorm.startsWith(q)) {
        score = 70 // Commence par
      } else if (entry.nameNorm.includes(q)) {
        score = 50 // Contient
      } else {
        // Recherche par tokens (mots individuels)
        const qTokens = q.split(/\s+/).filter(t => t.length >= 2)
        if (qTokens.length > 0) {
          let matchedTokens = 0
          for (const qt of qTokens) {
            const tokenMatch = entry.nameTokens.some(nt => nt.startsWith(qt))
            if (tokenMatch) matchedTokens++
          }
          if (matchedTokens === qTokens.length) {
            score = 60 // Tous les tokens matchent
          } else if (matchedTokens > 0) {
            score = 30 // Match partiel
          }
        }
      }
    }

    if (score > 0) {
      results.push({ product: entry.product, score })
    }
  }

  // Trier par score décroissant, puis par nom
  results.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))

  return results.slice(0, limit).map(r => r.product)
}

export function useProductSearchIndex() {
  const [isReady, setIsReady] = useState(cachedIndex !== null)
  const fetchRef = useRef<Promise<void> | null>(null)

  // Précharger tous les produits une seule fois
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products', 'search-index'],
    queryFn: async (): Promise<ProduitModel[]> => {
      // Vérifier le cache en mémoire
      if (cachedIndex && Date.now() - cachedAt < CACHE_TTL) {
        return cachedIndex.map(e => e.product)
      }

      // 1. Charger la première page pour connaître le total
      const pageSize = 1000
      const firstResponse = await api.get('produits/', {
        params: { page: 1, page_size: pageSize, include_inactive: false }
      })
      const firstData = firstResponse.data as ProduitModel[] | PaginatedResponse<ProduitModel>

      // Si la réponse est un array simple (pas de pagination), tout est déjà là
      if (Array.isArray(firstData)) {
        return firstData
      }

      const firstProducts = firstData.results || []
      const totalCount = firstData.count || firstProducts.length

      // Si on a tout en une page, on a fini
      if (firstProducts.length >= totalCount) {
        return firstProducts
      }

      // 2. Calculer le nombre de pages restantes et les charger en parallèle
      const totalPages = Math.ceil(totalCount / pageSize)
      const remainingPages = Array.from(
        { length: totalPages - 1 },
        (_, i) => i + 2 // pages 2, 3, 4, ...
      )

      // Charger par lots de 5 requêtes parallèles pour ne pas saturer le serveur
      const BATCH_SIZE = 5
      const remainingProducts: ProduitModel[] = []

      for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
        const batch = remainingPages.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
          batch.map(page =>
            api.get('produits/', {
              params: { page, page_size: pageSize, include_inactive: false }
            }).then(res => {
              const data = res.data as ProduitModel[] | PaginatedResponse<ProduitModel>
              return Array.isArray(data) ? data : (data.results || [])
            }).catch(() => [] as ProduitModel[])
          )
        )
        remainingProducts.push(...batchResults.flat())
      }

      return [...firstProducts, ...remainingProducts]
    },
    staleTime: CACHE_TTL,
    gcTime: 1000 * 60 * 10,
    enabled: !cachedIndex || Date.now() - cachedAt >= CACHE_TTL,
  })

  // Construire l'index quand les données arrivent
  useEffect(() => {
    if (data && data.length > 0 && (!cachedIndex || Date.now() - cachedAt >= CACHE_TTL)) {
      cachedIndex = buildIndex(data)
      cachedAt = Date.now()
      setIsReady(true)
    }
  }, [data])

  /** Recherche locale dans l'index en mémoire */
  const search = useCallback((query: string, limit?: number): ProduitModel[] => {
    if (!cachedIndex || !query) return []
    return searchInIndex(cachedIndex, query, limit)
  }, [])

  /** Invalide l'index (force un rechargement au prochain accès) */
  const invalidate = useCallback(() => {
    cachedIndex = null
    cachedAt = 0
    setIsReady(false)
  }, [])

  return {
    search,
    isReady,
    isLoading: isLoading || (isFetching && !cachedIndex),
    invalidate,
    productCount: cachedIndex?.length ?? 0,
  }
}
