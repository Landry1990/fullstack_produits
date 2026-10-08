import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { safeStorage } from '../utils/storage'
import { logger } from '../utils/logger'
import { patchSearchIndexStock, type StockUpdateItem } from './useProductSearchIndex'
import type { ProduitModel } from '../types'

interface StockUpdateMessage {
  type: string
  produits?: StockUpdateItem[]
}

// Clés React Query contenant des listes/détails de produits avec stock.
// On patch les caches de listes pour un affichage instantané, puis on invalide
// pour un refetch silencieux (autoritaire) des queries actives.
// NB : ['products', 'search'] ne matche PAS ['products', 'search-index']
// (segments distincts) — l'index est patché en place, jamais reconstruit ici.
const PATCHABLE_LIST_KEYS: readonly (readonly string[])[] = [
  ['produits'],
  ['products', 'search'],
  ['facturation', 'dci-products'],
  ['facturation', 'recent-products'],
  ['vitrine-products'],
  ['substance-produits'],
]

const INVALIDATED_KEYS: readonly (readonly string[])[] = [
  ...PATCHABLE_LIST_KEYS,
  ['facturation', 'packs'],      // la dispo d'un pack dépend du stock de ses composants
  ['produit-lots'],              // quantity_remaining des lots change avec le stock
  ['produit-substituts'],        // les substituts affichent le stock
]

/**
 * Réception temps réel des changements de stock via WebSocket `ws/stock/`.
 * Le backend diffuse {type:'stock_update', produits:[{id, stock, stock_reserve}]}
 * (valeurs post-commit, autoritaires) après chaque opération modifiant le stock.
 *
 * À chaque message :
 *  a) patch en place de l'index de recherche en mémoire (cachedIndex)
 *  b) patch des caches React Query (détail produit + listes) pour un affichage instantané
 *  c) invalidation des queries produits → refetch silencieux des queries actives
 *
 * Ne se connecte que si un authToken existe (appelé uniquement en zone authentifiée).
 */
export function useStockRealtime() {
  const queryClient = useQueryClient()
  const queryClientRef = useRef(queryClient)
  queryClientRef.current = queryClient
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const token = safeStorage.getItem('authToken')
    if (!token) return // pas de session → pas de connexion (évite boucle 4001 sur login)

    const wsBase = import.meta.env.VITE_WS_URL ?? `ws://${window.location.host}`
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let pingTimer: ReturnType<typeof setInterval> | null = null
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    /** Patch instantané des caches React Query contenant des produits */
    const patchQueryCaches = (updates: StockUpdateItem[]) => {
      const qc = queryClientRef.current
      const byId = new Map(updates.map(u => [u.id, u]))

      const patchProduct = (p: ProduitModel): ProduitModel => {
        const u = byId.get(p.id)
        if (!u) return p
        return {
          ...p,
          stock: u.stock,
          ...(u.stock_reserve !== undefined ? { stock_reserve: u.stock_reserve } : {}),
          ...(p.total_stock !== undefined
            ? { total_stock: u.stock + (u.stock_reserve ?? p.stock_reserve ?? 0) }
            : {}),
        }
      }

      const patchList = (data: unknown): unknown => {
        if (Array.isArray(data)) {
          return data.map(p => patchProduct(p as ProduitModel))
        }
        if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
          const d = data as { results: ProduitModel[] }
          return { ...d, results: d.results.map(patchProduct) }
        }
        return data
      }

      // Détail produit ['produit', id]
      for (const u of updates) {
        qc.setQueryData<ProduitModel>(['produit', u.id], (old) => (old ? patchProduct(old) : old))
      }

      // Listes de produits (array ou PaginatedResponse)
      for (const key of PATCHABLE_LIST_KEYS) {
        qc.setQueriesData({ queryKey: [...key] }, patchList)
      }
    }

    /**
     * Invalidations groupées (debounce 500ms) : un import/ajustement en masse
     * peut envoyer plusieurs messages d'affilée — on ne refetch qu'une fois.
     */
    const scheduleInvalidations = () => {
      if (invalidateTimer) return
      invalidateTimer = setTimeout(() => {
        invalidateTimer = null
        const qc = queryClientRef.current
        for (const key of INVALIDATED_KEYS) {
          void qc.invalidateQueries({ queryKey: [...key] })
        }
      }, 500)
    }

    const handleStockUpdate = (produits: StockUpdateItem[]) => {
      // a) Index de recherche en mémoire (caisse, commandes, inventaire, avoirs…)
      patchSearchIndexStock(produits)
      // b) Caches React Query — affichage instantané
      patchQueryCaches(produits)
      // c) Refetch silencieux des queries actives (valeurs autoritaires)
      scheduleInvalidations()
    }

    const connectWs = () => {
      if (stopped) return
      try {
        ws = new WebSocket(`${wsBase}/ws/stock/?token=${encodeURIComponent(token)}`)

        ws.onopen = () => {
          setConnected(true)
          logger.info('WebSocket stock connecté')
          pingTimer = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }))
            }
          }, 30_000)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as StockUpdateMessage
            if (data.type === 'stock_update' && Array.isArray(data.produits)) {
              handleStockUpdate(data.produits)
            }
          } catch {
            // ignore malformed messages
          }
        }

        ws.onclose = (event) => {
          setConnected(false)
          if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
          // 4001/4401 = refus d'auth : inutile de boucler, le token est probablement expiré
          if (event.code === 4001 || event.code === 4401) {
            logger.info('WebSocket stock fermé par le serveur (auth), pas de reconnexion')
            return
          }
          if (!stopped) {
            reconnectTimer = setTimeout(connectWs, 3_000)
          }
        }

        ws.onerror = () => {
          ws?.close()
        }
      } catch (err) {
        logger.error('Erreur WebSocket stock:', err)
      }
    }

    connectWs()

    return () => {
      stopped = true
      setConnected(false)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (pingTimer) clearInterval(pingTimer)
      if (invalidateTimer) clearTimeout(invalidateTimer)
      if (ws) { ws.onclose = null; ws.close() }
    }
  }, [])

  return { connected }
}
