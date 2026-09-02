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
  // Nom sans espaces ni ponctuation : "FRA 1" → "fra1"
  nameCompact: string
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
export function normalize(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Normalise un CIP : majuscule, sans espaces, sans tirets, sans points */
export function normalizeCip(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toUpperCase()
    .trim()
    .replace(/[\s\-.]/g, '')
}

/** Construit l'index de recherche à partir d'une liste de produits */
export function buildIndex(products: ProduitModel[]): SearchIndexEntry[] {
  return products.map(p => {
    const nameNorm = normalize(p.name)
    return {
      product: p,
      nameNorm,
      nameCompact: nameNorm.replace(/[^a-z0-9]/g, ''),
      cip1: normalizeCip(p.cip1),
      cip2: normalizeCip(p.cip2),
      cip3: normalizeCip(p.cip3),
      nameTokens: nameNorm.split(/\s+/).filter(t => t.length >= 2),
    }
  })
}

/** Recherche dans l'index en mémoire */
export function searchInIndex(index: SearchIndexEntry[], query: string, limit: number = 50): ProduitModel[] {
  const q = normalize(query)
  const qCip = normalizeCip(query)
  if (!q && !qCip) return []

  const isNumeric = /^\d+$/.test(qCip)
  const results: { product: ProduitModel; score: number }[] = []

  // Séparer la partie texte et la partie numérique de la requête
  // ex: "doli 500" → tokens ["doli", "500"]
  // ex: "fra1" → un seul token "fra1" (pas d'espace)
  const qTokens = q.split(/\s+/).filter(t => t.length >= 2)

  for (const entry of index) {
    let score = 0

    // --- Recherche par CIP (priorité maximale) ---
    if (isNumeric) {
      if (entry.cip1 === qCip) score = 100
      else if (entry.cip2 === qCip) score = 99
      else if (entry.cip3 === qCip) score = 98
      else if (entry.cip1.startsWith(qCip)) score = 90
      else if (entry.cip2.startsWith(qCip)) score = 89
      else if (entry.cip3.startsWith(qCip)) score = 88
    }

    // --- Recherche par nom (uniquement si pas de match CIP global) ---
    if (score === 0) {
      // Match exact sur le nom complet
      if (entry.nameNorm === q) {
        score = 80
      }
      // Le nom compact (sans espaces/ponctuation) commence par la requête complète
      // ex: "FRA1" match "FRA 1 DOLIPRANE"
      else if (entry.nameCompact.startsWith(q)) {
        score = 78
      }
      // Le nom normalisé commence par la requête
      else if (entry.nameNorm.startsWith(q)) {
        score = 75
      }
      // Un des mots du nom commence par la requête complète
      else if (entry.nameTokens.some(nt => nt.startsWith(q))) {
        score = 70
      }
      // Recherche multi-termes : chaque terme doit matcher (ET logique)
      // Comportement proche du backend DRF : premier terme en préfixe, suivants en contient
      else if (qTokens.length > 1) {
        let allTermsMatch = true
        let termScores = 0
        // Pour chaque terme, déterminer si c'est un CIP potentiel (tout numérique)

        for (let i = 0; i < qTokens.length; i++) {
          const qt = qTokens[i]
          const qtCip = normalizeCip(qt)
          const isNum = /^\d+$/.test(qtCip)
          let termMatched = false
          let termScore = 0

          // CIP match pour termes numériques
          if (isNum && (entry.cip1.startsWith(qtCip) || entry.cip2.startsWith(qtCip) || entry.cip3.startsWith(qtCip))) {
            termMatched = true
            termScore = 95
          }
          // Premier terme : préfixe obligatoire (comme le backend DRF)
          else if (i === 0) {
            if (entry.nameTokens.some(nt => nt.startsWith(qt))) {
              termMatched = true
              termScore = 60
            } else if (entry.nameCompact.startsWith(qt)) {
              termMatched = true
              termScore = 55
            }
          }
          // Termes suivants : contient (comme le backend DRF icontains)
          else {
            if (entry.nameTokens.some(nt => nt.includes(qt))) {
              termMatched = true
              termScore = 50
            } else if (entry.nameNorm.includes(qt)) {
              termMatched = true
              termScore = 40
            }
          }

          if (!termMatched) {
            allTermsMatch = false
            break
          }
          termScores += termScore
        }

        if (allTermsMatch) {
          score = 50 + termScores / qTokens.length
        }
      }
      // Requête à un seul token : uniquement les préfixes pour éviter le bruit
      // (ex: "fra" ne doit PAS matcher "acfran" ou "spasfran")
      else if (qTokens.length === 1) {
        // Déjà traité plus haut par nameTokens.startsWith(q) / nameNorm.startsWith / nameCompact.startsWith
        // Si on arrive ici, aucun mot ne commence par la requête → pas de match
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

      try {
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
                const results = Array.isArray(data) ? data : (data.results || [])
                return results
              }).catch(() => [] as ProduitModel[])
            )
          )
          remainingProducts.push(...batchResults.flat())
        }

        return [...firstProducts, ...remainingProducts]
      } catch (err) {
        throw err
      }
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
