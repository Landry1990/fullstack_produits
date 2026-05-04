import { useEffect, type RefObject } from 'react'

interface UseFacturationKeyboardShortcutsProps {
  searchInputRef: RefObject<HTMLInputElement | null>;
  clientSearchRef: RefObject<HTMLInputElement | null>;
  lignesFacture: any[];
  quantityInputsRef: RefObject<Map<number, HTMLInputElement> | null>;
  handlePaymentClick: () => void;
  toggleZenithMode: () => void;
  isPaymentModalOpen: boolean;
  closePaymentModal: () => void;
  showTicketPreview: boolean;
  setShowTicketPreview: (val: boolean) => void;
  showOrdonnanceModal: boolean;
  setShowOrdonnanceModal: (val: boolean) => void;
  lotModalOpen: boolean;
  closeLotModal: () => void;
  showClientCreateModal: boolean;
  setShowClientCreateModal: (val: boolean) => void;
  showStockResolution: boolean;
  setShowStockResolution: (val: boolean) => void;
  confirmModal: any;
  setConfirmModal: (val: any) => void;
  setSearchQuery: (val: string) => void;
  successInfo?: any;
  setSuccessInfo: (val: any) => void;
  setShowHelp: (val: boolean) => void;
  handleSuspendSale: () => void;
  handleAddAlertMessage: () => void;
  showPendingSales: boolean;
  setShowPendingSales: (val: boolean) => void;
}

/**
 * Hook regroupant tous les raccourcis clavier globaux du module de facturation.
 * Permet d'alléger le composant principal.
 */
export function useFacturationKeyboardShortcuts({
  searchInputRef,
  clientSearchRef,
  lignesFacture,
  quantityInputsRef,
  handlePaymentClick,
  toggleZenithMode,
  isPaymentModalOpen,
  closePaymentModal,
  showTicketPreview,
  setShowTicketPreview,
  showOrdonnanceModal,
  setShowOrdonnanceModal,
  lotModalOpen,
  closeLotModal,
  showClientCreateModal,
  setShowClientCreateModal,
  showStockResolution,
  setShowStockResolution,
  confirmModal,
  setConfirmModal,
  setSearchQuery,
  successInfo,
  setSuccessInfo,
  setShowHelp,
  handleSuspendSale,
  handleAddAlertMessage,
  showPendingSales,
  setShowPendingSales
}: UseFacturationKeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un input mais que c'est une touche de fonction (F2, F4...)
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'

      // F1: Aide Raccourcis
      if (e.key === 'F1') {
        e.preventDefault()
        setShowHelp(true)
        return
      }

      // F2: Focus Recherche Produit
      if (e.key === 'F2') {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      // F4: Focus Quantité du dernier article ou Recherche Client
      if (e.key === 'F4') {
        e.preventDefault()
        if (lignesFacture.length > 0) {
          const lastItem = lignesFacture[lignesFacture.length - 1]
          const input = quantityInputsRef.current?.get(lastItem.produit.id)
          if (input) {
            input.focus()
            input.select()
            return
          }
        }
        clientSearchRef.current?.focus()
        return
      }

      // F7: Mettre en attente (si panier non vide)
      if (e.key === 'F7') {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (lignesFacture.length > 0) {
           handleSuspendSale()
        }
        return
      }

      // F8: Rappeler les ventes en attente
      if (e.key === 'F8') {
        e.preventDefault()
        setShowPendingSales(!showPendingSales)
        return
      }

      // F9: Payer / Encaisser (si panier non vide)
      if (e.key === 'F9') {
        e.preventDefault()
        if (!isPaymentModalOpen && lignesFacture.length > 0) {
           handlePaymentClick()
        }
        return
      }

      // Ctrl+F: Focus Recherche Client
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        clientSearchRef.current?.focus()
        return
      }

      // Ctrl+M: Add Alert Message to Product/Client
      if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault()
        handleAddAlertMessage()
        return
      }

      // Ctrl+S: Suspendre la vente (si panier non vide)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (lignesFacture.length > 0) {
            handleSuspendSale()
        }
        return
      }

      // Alt+Z: Toggle Mode Zenith
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        toggleZenithMode()
        return
      }

      // /: Focus recherche produit (si pas déjà dans un input)
      if (e.key === '/' && !isInput) {
          e.preventDefault()
          searchInputRef.current?.focus()
          return
      }
      
      // Escape: Fermer les modals dans l'ordre de priorité
      if (e.key === 'Escape') {
        if (showTicketPreview) { setShowTicketPreview(false); return }
        if (isPaymentModalOpen) { closePaymentModal(); return }
        if (showOrdonnanceModal) { setShowOrdonnanceModal(false); return }
        if (lotModalOpen) { closeLotModal(); return }
        if (showClientCreateModal) { setShowClientCreateModal(false); return }
        if (showStockResolution) { setShowStockResolution(false); return }
        if (confirmModal) { setConfirmModal(null); return }
        if (successInfo) { 
            setSuccessInfo(null)
            searchInputRef.current?.focus()
            return 
        }
        
        // Si on est dans un champ de recherche, on vide et on dé-focus
        if (document.activeElement === clientSearchRef.current || document.activeElement === searchInputRef.current) {
            setSearchQuery('')
            ;(document.activeElement as HTMLElement).blur()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    lignesFacture, handlePaymentClick, toggleZenithMode, 
    isPaymentModalOpen, closePaymentModal, showTicketPreview, setShowTicketPreview,
    showOrdonnanceModal, setShowOrdonnanceModal, 
    lotModalOpen, closeLotModal, 
    showClientCreateModal, setShowClientCreateModal, 
    showStockResolution, setShowStockResolution, 
    confirmModal, setConfirmModal, 
    successInfo, setSuccessInfo,
    setSearchQuery, searchInputRef, clientSearchRef, quantityInputsRef,
    setShowHelp, handleSuspendSale, handleAddAlertMessage,
    showPendingSales, setShowPendingSales
  ])
}
