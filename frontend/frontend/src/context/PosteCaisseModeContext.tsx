import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { cashSessionService, type PosteVente } from '../services/cashSessionService'
import { logger } from '../utils/logger'

const POS_TAB_KEY = 'pos_tab_poste_vente_id'
const POS_MODE_KEY = 'pos_tab_mode'

interface PosteCaisseModeContextType {
  activePoste: PosteVente | null
  selectedPosteCaisseId: number | null
  isPosMode: boolean
  isLoading: boolean
  refresh: () => Promise<void>
  openPoste: (caisseId: number, fondDeCaisse?: string) => Promise<PosteVente>
  setActivePosteVente: (poste: PosteVente) => void
  closePoste: (hideAmounts?: boolean) => Promise<void>
  selectPoste: (id: number | null) => void
}

const PosteCaisseModeContext = createContext<PosteCaisseModeContextType | undefined>(undefined)

export function PosteCaisseModeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [activePoste, setActivePoste] = useState<PosteVente | null>(null)
  const [selectedPosteCaisseId, setSelectedPosteCaisseId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return
    setIsLoading(true)
    try {
      const tabPosteId = sessionStorage.getItem(POS_TAB_KEY)
      // Un nouvel onglet n'a pas POS_TAB_KEY → ne pas forcer la restauration du POS
      if (!tabPosteId) {
        setActivePoste(null)
        setIsLoading(false)
        return
      }

      const postes = await cashSessionService.getMyActivePostesVente()
      const matching = postes.find((p) => String(p.id) === tabPosteId) || postes[0] || null

      if (matching) {
        setActivePoste(matching)
        sessionStorage.setItem(POS_TAB_KEY, String(matching.id))
        sessionStorage.setItem(POS_MODE_KEY, matching.mode_pos ? 'pos' : 'caisse')
        if (!matching.mode_pos && matching.caisse) {
          setSelectedPosteCaisseId(matching.caisse)
        }
      } else {
        sessionStorage.removeItem(POS_TAB_KEY)
        sessionStorage.removeItem(POS_MODE_KEY)
        setActivePoste(null)
      }
    } catch (err) {
      logger.error('Erreur refresh poste actif:', err)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    refresh()
  }, [refresh])

  const openPoste = useCallback(async (posteVenteId: number, fondDeCaisse?: string) => {
    const data = await cashSessionService.activerPosteVente(posteVenteId, fondDeCaisse)
    sessionStorage.setItem(POS_TAB_KEY, String(data.id))
    sessionStorage.setItem(POS_MODE_KEY, 'pos')
    setActivePoste(data)
    // POS n'a pas de caisse — ne pas remplacer le selectedPosteCaisseId
    return data
  }, [])

  const setActivePosteVente = useCallback((poste: PosteVente) => {
    sessionStorage.setItem(POS_TAB_KEY, String(poste.id))
    sessionStorage.setItem(POS_MODE_KEY, poste.mode_pos ? 'pos' : 'caisse')
    setActivePoste(poste)
    // Seulement assigner selectedPosteCaisseId si c'est une caisse physique (mode_pos=False)
    if (!poste.mode_pos && poste.caisse) {
      setSelectedPosteCaisseId(poste.caisse)
    }
  }, [])

  const closePoste = useCallback(async (hideAmounts?: boolean) => {
    if (!activePoste) return
    await cashSessionService.closePosteVente(activePoste.id, hideAmounts)
    sessionStorage.removeItem(POS_TAB_KEY)
    sessionStorage.removeItem(POS_MODE_KEY)
    setActivePoste(null)
    setSelectedPosteCaisseId(null)
  }, [activePoste])

  const selectPoste = useCallback((id: number | null) => {
    setSelectedPosteCaisseId(id)
  }, [])

  const value: PosteCaisseModeContextType = {
    activePoste,
    selectedPosteCaisseId,
    // Le mode POS dépend du mode d'ouverture (mode_pos).
    // Un POS n'a pas de caisse physique — il envoie les ventes vers la caisse de la caissière.
    isPosMode: !!activePoste && (activePoste.mode_pos === true || sessionStorage.getItem(POS_MODE_KEY) === 'pos'),
    isLoading,
    refresh,
    openPoste,
    setActivePosteVente,
    closePoste,
    selectPoste
  }

  return (
    <PosteCaisseModeContext.Provider value={value}>
      {children}
    </PosteCaisseModeContext.Provider>
  )
}

export function usePosteCaisseMode(): PosteCaisseModeContextType {
  const ctx = useContext(PosteCaisseModeContext)
  if (!ctx) {
    throw new Error('usePosteCaisseMode must be used within PosteCaisseModeProvider')
  }
  return ctx
}
