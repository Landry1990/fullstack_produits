import { useEffect, useRef, useCallback } from 'react'
import type { Facture } from '../types'

interface KeyboardHandlers {
  onEncaisser: (facture: Facture) => void
  onOpenCouponPanel: (facture: Facture) => void
  onRefresh: () => void
  onToggleCouponPanel: () => void
  onCloseModal: () => void
  canCashOut: boolean
}

interface KeyboardState {
  sortedFactures: Facture[]
  selectedRowIndex: number
  isPaymentModalOpen: boolean
  isGenererCouponModalOpen: boolean
  isDetailsCouponModalOpen: boolean
  isSudoModalOpen: boolean
  showTicketPreview: boolean
  isCouponPanelOpen: boolean
}

/**
 * Hook personnalisé pour gérer les raccourcis clavier de la caisse centralisée
 * Extrait du composant CaisseCentralisee pour réduire la complexité
 */
export const useCaisseKeyboard = (
  handlers: KeyboardHandlers,
  state: KeyboardState,
  setSelectedRowIndex: (index: number | ((prev: number) => number)) => void
) => {
  // Utiliser un ref pour toujours avoir accès aux valeurs les plus récentes
  // sans réattacher l'event listener à chaque changement
  const latestState = useRef({
    ...state,
    ...handlers
  })

  // Mettre à jour le ref à chaque render
  useEffect(() => {
    latestState.current = {
      ...state,
      ...handlers
    }
  })

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const current = latestState.current

    // Ignorer si une modale est ouverte
    if (current.isPaymentModalOpen || current.isGenererCouponModalOpen || 
        current.isDetailsCouponModalOpen || current.isSudoModalOpen) {
      if (e.key === 'Escape') {
        current.onCloseModal()
      }
      return
    }

    // Escape pour fermer le ticket preview
    if (current.showTicketPreview && e.key === 'Escape') {
      current.onCloseModal()
      return
    }

    // Ignorer si l'utilisateur tape dans un input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return
    }

    const { sortedFactures, selectedRowIndex, canCashOut, isCouponPanelOpen } = current

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault()
        setSelectedRowIndex(prev => Math.min(prev + 1, sortedFactures.length - 1))
        break

      case 'ArrowUp':
      case 'k':
        e.preventDefault()
        setSelectedRowIndex(prev => Math.max(prev - 1, 0))
        break

      case 'Enter':
        if (sortedFactures.length > 0 && canCashOut) {
          e.preventDefault()
          const facture = sortedFactures[selectedRowIndex]
          if (facture) {
            current.onEncaisser(facture)
          }
        }
        break

      case 'c':
      case 'C':
        e.preventDefault()
        if (sortedFactures.length > 0) {
          current.onOpenCouponPanel(sortedFactures[selectedRowIndex])
        }
        break

      case 'r':
      case 'R':
        e.preventDefault()
        current.onRefresh()
        break

      case 'Escape':
        if (isCouponPanelOpen) {
          current.onToggleCouponPanel()
        }
        break

      default:
        // 1-9 pour sélectionner directement une vente
        if (e.key >= '1' && e.key <= '9') {
          const index = parseInt(e.key) - 1
          if (index < sortedFactures.length) {
            setSelectedRowIndex(index)
          }
        }
        break
    }
  }, [setSelectedRowIndex])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
