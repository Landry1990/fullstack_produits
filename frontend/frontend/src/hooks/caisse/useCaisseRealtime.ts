import { useEffect, useRef, useCallback } from 'react'
import { logger } from '../../utils/logger'

interface UseCaisseRealtimeParams {
  selectedPosteCaisseId: string
  fetchFacturesEnAttente: () => Promise<void>
  fetchCoupons: () => void
}

/**
 * Gère la connexion WebSocket temps réel + polling de fallback pour la caisse.
 * - WebSocket sur /ws/caisse_centralisee/ avec ping 30s et reconnexion 3s
 * - Polling de fallback toutes les 30s
 * - Ne rafraîchit que si la notification concerne la caisse sélectionnée
 */
export function useCaisseRealtime({
  selectedPosteCaisseId,
  fetchFacturesEnAttente,
  fetchCoupons,
}: UseCaisseRealtimeParams) {
  const fetchRef = useRef(fetchFacturesEnAttente)
  fetchRef.current = fetchFacturesEnAttente

  const fetchCouponsRef = useRef(fetchCoupons)
  fetchCouponsRef.current = fetchCoupons

  // Ref pour le filtre de caisse dans le handler WebSocket (évite stale closure)
  const posteCaisseRef = useRef(selectedPosteCaisseId)
  posteCaisseRef.current = selectedPosteCaisseId

  const refresh = useCallback(() => {
    fetchRef.current()
    fetchCouponsRef.current()
  }, [])

  useEffect(() => {
    fetchFacturesEnAttente()
    fetchCoupons()

    // ── WebSocket pour notifications temps réel ──
    const wsBase = import.meta.env.VITE_WS_URL ?? `ws://${window.location.host}`
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let pingTimer: ReturnType<typeof setInterval> | null = null

    const connectWs = () => {
      try {
        ws = new WebSocket(`${wsBase}/ws/caisse_centralisee/`)

        ws.onopen = () => {
          logger.info('WebSocket caisse connecté')
          // Ping toutes les 30s pour garder la connexion alive
          pingTimer = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }))
            }
          }, 30_000)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'facture_update') {
              // Ne rafraîchir que si la notification concerne notre caisse (ou mode "all")
              const notifCaisseId = data.poste_caisse_id
              const currentPoste = posteCaisseRef.current
              if (currentPoste === 'all' || String(notifCaisseId) === currentPoste) {
                logger.info('WebSocket: mise à jour facture reçue', data)
                fetchRef.current()
                fetchCouponsRef.current()
              }
            }
          } catch {
            // ignore malformed messages
          }
        }

        ws.onclose = () => {
          logger.info('WebSocket caisse déconnecté, reconnexion dans 3s')
          if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
          reconnectTimer = setTimeout(connectWs, 3_000)
        }

        ws.onerror = () => {
          ws?.close()
        }
      } catch (err) {
        logger.error('Erreur WebSocket caisse:', err)
      }
    }

    connectWs()

    // ── Polling de fallback (30s au lieu de 5s) ──
    const interval = setInterval(() => {
      fetchRef.current()
      fetchCouponsRef.current()
    }, 30_000)

    return () => {
      clearInterval(interval)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (pingTimer) clearInterval(pingTimer)
      if (ws) { ws.onclose = null; ws.close() }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPosteCaisseId])

  return { refresh }
}
