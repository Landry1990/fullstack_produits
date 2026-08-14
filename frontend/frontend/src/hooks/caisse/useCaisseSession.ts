import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import { cashSessionService } from '../../services/cashSessionService'
import { logger } from '../../utils/logger'
import type { PosteCaisse, PosteVente } from '../../types'

interface SessionRecap {
  has_session: boolean
  poste_nom?: string
  date_ouverture?: string
  fond_de_caisse?: number
  total_encaisse?: number
  total_avec_fond?: number
  nb_transactions?: number
  details_par_mode?: Record<string, number>
}

/**
 * Gère l'initialisation multi-caisse et le rafraîchissement du récap session.
 * - Charge les postes de caisse, les réglages, et détecte le mode multi-caisse
 * - Poll le récap session toutes les 10 secondes
 * - Possède l'état selectedPosteCaisseId (source de vérité pour la caisse sélectionnée)
 */
export function useCaisseSession() {
  const [postesCaisses, setPostesCaisses] = useState<PosteCaisse[]>([])
  const [selectedPosteCaisseId, setSelectedPosteCaisseId] = useState<string>('all')
  const [isMultiCaisse, setIsMultiCaisse] = useState(false)
  const [myActivePoste, setMyActivePoste] = useState<PosteVente | null>(null)
  const [hideAmounts, setHideAmounts] = useState(false)
  const [sessionRecap, setSessionRecap] = useState<SessionRecap | null>(null)

  const fetchSessionRecap = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (selectedPosteCaisseId !== 'all') params.poste_caisse = selectedPosteCaisseId
      const res = await api.get('postes-caisses/recap_session/', { params })
      setSessionRecap(res.data)
    } catch {
      // silencieux si pas de session
    }
  }, [selectedPosteCaisseId])

  // Récap session : toutes les 10 secondes + immédiat sur changement de poste
  useEffect(() => {
    fetchSessionRecap()
    const interval = setInterval(fetchSessionRecap, 10000)
    return () => clearInterval(interval)
  }, [fetchSessionRecap])

  // Charger les postes de caisse et réglages (une seule fois au montage)
  useEffect(() => {
    const initPage = async () => {
      try {
        const [settingsRes, postesRes, myActive, allActivePostes] = await Promise.all([
          api.get('parametres/').catch(() => ({ data: {} })),
          api.get('postes-caisses/').catch(() => ({ data: { results: [] } })),
          cashSessionService.getMyActivePostesVente().catch(() => []),
          cashSessionService.getActivePostesVente().catch(() => [])
        ])

        // Charger le paramètre de sécurité caisse
        const settings = settingsRes.data
        if (settings.hide_cash_totals) {
          setHideAmounts(true)
        }

        const postesList = postesRes.data.results || postesRes.data || []
        const activePoste = myActive.length > 0 ? myActive[0] : null
        setPostesCaisses(postesList)
        setMyActivePoste(activePoste)
        if (activePoste) {
          setSelectedPosteCaisseId(String(activePoste.caisse))
        }

        // Détecter si on est en mode multi-caisse (plusieurs caisses actives globalement)
        const activeCaisseIds = new Set(
          allActivePostes.filter((p: PosteVente) => !!p.caisse).map((p: PosteVente) => p.caisse)
        )
        setIsMultiCaisse(activeCaisseIds.size > 1)
      } catch (err) {
        logger.error('Erreur initialisation page:', err)
      }
    }
    initPage()
  }, [])

  return {
    postesCaisses,
    setPostesCaisses,
    selectedPosteCaisseId,
    setSelectedPosteCaisseId,
    isMultiCaisse,
    setIsMultiCaisse,
    myActivePoste,
    setMyActivePoste,
    hideAmounts,
    setHideAmounts,
    sessionRecap,
    setSessionRecap,
    fetchSessionRecap,
  }
}
