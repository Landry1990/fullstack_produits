import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import type { ProduitModel, Facture } from '../types'
import { useProductSearch } from './useProductSearch'
import { useCart } from './useCart'
import { useAuth } from '../context/AuthContext'
import { useFacturationClients } from './useFacturationClients'
import { usePendingSales } from './usePendingSales'
import { usePharmacySettings } from './usePharmacySettings'
import { useKeyboardNavigation } from './useKeyboardNavigation'
import { useClinicalCheck } from './useClinicalCheck'
import { useSidebar } from '../context/SidebarContext'
import { useTranslation } from 'react-i18next'
import { useSudo } from './useSudo'
import { useSaleCompletion } from './useSaleCompletion'
import { useFacturationKeyboardShortcuts } from './useFacturationKeyboardShortcuts'
import { useFacturationUI } from './useFacturationUI'
import { useFacturationSession } from './useFacturationSession'
import { useFacturationActions } from './useFacturationActions'
import { useMultiCaisse } from './useMultiCaisse'
import { useSecureCartOperations } from './useSecureCartOperations'
import { useDevisLoader } from './useDevisLoader'
import { useFacturationImport } from './useFacturationImport'

export function useFacturationState() {
  const { t } = useTranslation(['prescriptions', 'common', 'facturation', 'sales'])
  const queryClient = useQueryClient()
  const { settings: pharmacySettings } = usePharmacySettings()
  const { isZenithMode, toggleZenithMode, isMidnightTheme, toggleMidnightTheme } = useSidebar()
  const { user } = useAuth()

  // --- Core local state ---
  const [loading, setLoading] = useState(false)
  const [isRetrocession, setIsRetrocession] = useState(false)
  const [isFactureA4, setIsFactureA4] = useState(false)
  const [sortBy, setSortBy] = useState<'chrono' | 'stock' | 'name' | 'qty'>('chrono')

  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<Facture | null>(null)
  const [showClientNameModal, setShowClientNameModal] = useState(false)
  const [pendingPrintFacture, setPendingPrintFacture] = useState<Facture | null>(null)
  const [pointsToUse, setPointsToUse] = useState(0)
  const [usePendingDiscount, setUsePendingDiscount] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const triggerUiRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1)
  }, [])

  // --- Refs ---
  const quantityInputsRef = useRef<Map<number, HTMLInputElement>>(new Map())
  const addProductRef = useRef<((product: ProduitModel, options?: { isRetrocession?: boolean; preventFocus?: boolean }) => void) | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const paymentInputRef = useRef<HTMLInputElement>(null)
  const clientSearchRef = useRef<HTMLInputElement>(null)

  // --- Sudo ---
  const { sudoState, requireSudo, closeSudo } = useSudo()
  const [activeSudoCreds, setActiveSudoCreds] = useState<{ validatorId: number, password: string } | null>(null)

  // --- UI Hook ---
  const ui = useFacturationUI()

  // --- Cart Hook ---
  const cart = useCart({
    onRequirePrescription: () => ui.setShowOrdonnanceModal(true),
    onAlert: (message, title, type, is_blocking, targetId) => ui.pushDisplayAlert({ message, title, type, is_blocking, targetId }),
    quantityInputsRef
  })

  // --- Secure Cart Operations (sudo-protected) ---
  const { secureUpdateQuantite, secureUpdatePrix, secureUpdateRemiseProduit } = useSecureCartOperations({
    cart,
    requireSudo,
    setActiveSudoCreds,
    t,
    triggerUiRefresh
  })

  // --- Clinical Check ---
  const { alerts: clinicalAlerts } = useClinicalCheck(cart.lignesFacture)

  // --- Barcode scanning ---
  addProductRef.current = cart.addProduit

  const handleBarcodeMatch = useCallback((product: ProduitModel) => {
    if (addProductRef.current) {
      addProductRef.current(product, { isRetrocession, preventFocus: true })
      toast.success(t('facturation:messages.scan_added', { name: product.name }), { duration: 1500 })
    }
  }, [isRetrocession, t])

  const productSearch = useProductSearch({
    minSearchLength: 2,
    debounceMs: 200,
    onBarcodeMatch: handleBarcodeMatch
  })

  // --- Import (CSV + Packs) ---
  const { addPackToFacture, handleCsvImport } = useFacturationImport({
    cart,
    apiBaseUrl: '',
    t
  })

  // --- Clients ---
  const clientsHook = useFacturationClients()
  const pendingSales = usePendingSales()

  // --- Session Persistence (auto-save / restore) ---
  useFacturationSession({
    clientsHook,
    ui,
    isRetrocession,
    setIsRetrocession,
    isFactureA4,
    setIsFactureA4,
    cartLength: cart.lignesFacture.length
  })

  // --- Multi-Caisse ---
  const multiCaisse = useMultiCaisse({})

  // --- Devis Loader (on mount) ---
  useDevisLoader({ clientsHook, cart, ui })

  // --- Totals ---
  const totals = useMemo(() =>
    ui.calculateTotals(cart.cartStats, clientsHook.clients.find(c => c.id === clientsHook.selectedClient)),
    [cart.cartStats, clientsHook.selectedClient, clientsHook.clients, ui.calculateTotals]
  )

  const isNewSale = !ui.facturePourPaiement

  // --- Actions ---
  const actions = useFacturationActions({
    cart,
    clientsHook,
    ui,
    totals,
    pendingSales,
    setLoading,
    setError,
    t,
    productSearch,
    searchInputRef,
    paymentInputRef,
    pendingPrintFacture,
    setPendingPrintFacture,
    setShowClientNameModal,
    secureUpdateQuantite,
    user
  })

  // --- Sale Completion ---
  const { completeSale, completeExistingInvoicePayment, loading: saleLoading } = useSaleCompletion({
    onSuccess: (result) => {
      if (result.success && result.facture) {
        setSuccessInfo(result.facture)
        ui.setTicketCaisse(result.ticketCaisse || null)

        if (isFactureA4) {
          if (result.facture) {
            const normalize = (str: string) => str?.toLowerCase().trim() || ''
            const clientName = normalize(result.facture.client_name || '')
            const isGenericClient = !result.facture.client_name_override && (
              !clientName || clientName.includes('passage') || clientName.includes('divers')
            )
            if (isGenericClient) {
              setPendingPrintFacture(result.facture)
              setShowClientNameModal(true)
            } else {
              const nameToUse = result.facture.client_name_override || result.facture.client_name
              let url = `/app/print-invoice/${result.facture.id}`
              if (nameToUse) url += `?client_name=${encodeURIComponent(nameToUse)}`
              window.open(url, '_blank')
            }
          }
          setIsFactureA4(false)
        } else {
          if (result.ticketCaisse) ui.setShowTicketPreview(true)
        }

        ui.resetUIState()

        // Update product stock in React Query cache
        cart.lignesFacture.forEach((ligne: any) => {
          queryClient.setQueriesData({ queryKey: ['produits'] }, (oldData: any) => {
            if (!oldData) return oldData
            if (oldData.results && Array.isArray(oldData.results)) {
              return {
                ...oldData,
                results: oldData.results.map((p: any) =>
                  p.id === ligne.produit.id ? { ...p, stock: Math.max(0, (p.stock || 0) - ligne.quantite) } : p
                )
              }
            } else if (Array.isArray(oldData)) {
              return oldData.map((p: any) =>
                p.id === ligne.produit.id ? { ...p, stock: Math.max(0, (p.stock || 0) - ligne.quantite) } : p
              )
            }
            return oldData
          })
          queryClient.setQueriesData({ queryKey: ['produit', ligne.produit.id] }, (oldData: any) => {
            if (!oldData) return oldData
            return { ...oldData, stock: Math.max(0, (oldData.stock || 0) - ligne.quantite) }
          })
        })

        actions._resetSaleDataOnly()
        ui.closePaymentModal()
      }
    },
    onReset: actions._resetSaleDataOnly,
    onError: (msg) => setError(msg)
  })

  // --- Complete Sale Handler ---
  const handleCompleteSale = async (sudoCredentials?: { validatorId: number, password: string }) => {
    const effectiveSudo = sudoCredentials || activeSudoCreds
    const params = {
      selectedClient: clientsHook.selectedClient,
      useManualClient: clientsHook.useManualClient,
      manualClientName: clientsHook.manualClientName,
      clients: clientsHook.clients,
      selectedAyantDroit: clientsHook.selectedAyantDroit,
      ayantDroitNom: clientsHook.ayantDroitNom,
      ayantDroitMatricule: clientsHook.ayantDroitMatricule,
      ayantDroitSociete: clientsHook.ayantDroitSociete,
      ayantsDroitList: clientsHook.ayantsDroitList,
      showNewAyantDroit: clientsHook.showNewAyantDroit,
      lignesFacture: cart.lignesFacture,
      totals: totals,
      modePaiement: ui.modePaiement,
      montantPaye: ui.montantPaye,
      paiements: ui.paiements,
      reference: ui.reference,
      couponNumero: '',
      usePendingDiscount,
      pointsToUse,
      isRetrocession,
      centralizedCashRegister: multiCaisse.centralizedCashRegister,
      isModificationMode: ui.isModificationMode,
      devisIdToValidate: null,
      tempOrdonnanceData: ui.tempOrdonnanceData,
      validated_by_id: effectiveSudo?.validatorId || null,
      sudo_password: effectiveSudo?.password || undefined,
      modificationInvoiceStatus: ui.modificationInvoiceStatus || undefined,
      poste_caisse_id: multiCaisse.selectedPosteCaisseId,
      prescriptionImage: ui.prescriptionImage,
      modificationInvoiceId: ui.modificationInvoiceId,
      isFactureA4: isFactureA4
    }
    await completeSale(params)
  }

  const applyLoyaltyReward = useCallback(() => {
    if (!clientsHook.selectedClient || clientsHook.useManualClient) return
    const client = clientsHook.clients.find(c => c.id === clientsHook.selectedClient)
    if (client?.pending_discount && Number(client.pending_discount) > 0) {
      ui.setRemiseGlobale(client.pending_discount)
      ui.setRemiseMode('taux')
      setUsePendingDiscount(true)
      toast.success(t('facturation:messages.reward_applied', { discount: client.pending_discount }))
    }
  }, [clientsHook.selectedClient, clientsHook.clients, clientsHook.useManualClient, ui, t])

  // --- Payment Preparation ---
  const handlePaymentClick = async () => {
    setLoading(true)
    let freshLignes = cart.lignesFacture
    try {
      const productIds = cart.lignesFacture.map((l: any) => l.produit.id)
      const { data: freshProductsData } = await api.post<any[]>('produits/bulk_refresh/', { ids: productIds })

      const productMap = new Map(freshProductsData.map((p: any) => [p.id, p]))
      freshLignes = cart.lignesFacture.map((ligne: any) => {
        const freshProduct = productMap.get(ligne.produit.id)
        if (freshProduct) {
          return {
            ...ligne,
            isPromis: ligne.isPromis,
            promisQuantity: ligne.promisQuantity,
            promisPhone: ligne.promisPhone,
            produit: { ...ligne.produit, stock: freshProduct.stock, selling_price: freshProduct.selling_price, is_active: freshProduct.is_active }
          }
        }
        return ligne
      })
    } catch (e) {
      toast.error(t('facturation.messages.refresh_failed') || "Erreur de rafraîchissement des stocks")
    }

    cart.setLignesFacture(freshLignes)
    setLoading(false)

    const problematicLines = freshLignes.filter((l: any) => !l.isPromis && l.quantite > (l.produit.stock ?? 0))

    if (problematicLines.length > 0) {
      const items = problematicLines.map((l: any) => ({ product: l.produit, quantity: l.quantite, stock: l.produit.stock ?? 0 }))
      ui.setStockResolutionItems(items)

      const initialActions: Record<number, 'promis' | 'force' | 'reduce'> = {}
      items.forEach(item => {
        initialActions[item.product.id] = 'promis'
      })
      ui.setResolutionActions(initialActions)

      const client = clientsHook.clients.find(c => c.id === clientsHook.selectedClient)
      ui.setPromisPhone(client?.phone || '')
      if (clientsHook.useManualClient) {
        ui.setPromisClientName(clientsHook.manualClientName)
      } else if (client) {
        ui.setPromisClientName(client.name)
      } else {
        ui.setPromisClientName('')
      }
      ui.setShowStockResolution(true)
    } else {
      const totalTtc = totals.totalTtc

      if (totalTtc <= 0) {
        // Enforce sudo for non-positive sales
        requireSudo(async (validatorId, password) => {
          await handleCompleteSale({ validatorId, password })
        }, {
          title: t('facturation:payment.sudo_mode.validate_by'),
          message: `Cette vente avec un total de ${totalTtc} F nécessite l'autorisation d'un superviseur.`
        })
      } else {
        const montantInitial = (totals.tauxCouverture > 0) ? totals.partPatient : totalTtc
        ui.setMontantPaye(montantInitial.toString())
        ui.openPaymentModal()
      }
    }
  }

  const handlePaymentClickWithSudo = (updatedLignes?: any[], sudoCredentials?: { validatorId: number, password: string }) => {
    if (updatedLignes && updatedLignes.length > 0) {
      cart.setLignesFacture(updatedLignes)
    }
    if (sudoCredentials) {
      setActiveSudoCreds(sudoCredentials)
    }
    const montantInitial = (totals.tauxCouverture > 0) ? totals.partPatient : totals.totalTtc
    ui.setMontantPaye(montantInitial.toString())
    ui.openPaymentModal()
  }

  // --- Auto-focus on mount ---
  useEffect(() => {
    const timer = setTimeout(() => searchInputRef.current?.focus(), 300)
    return () => clearTimeout(timer)
  }, [])

  // --- Client auto-discount & alerts ---
  useEffect(() => {
    if (!clientsHook.selectedClient || clientsHook.useManualClient) return
    const client = clientsHook.clients.find(c => c.id === clientsHook.selectedClient)
    if (client?.remise_automatique && Number(client.remise_automatique) > 0) {
      ui.setRemiseGlobale(client.remise_automatique)
      ui.setRemiseMode('taux')
    }
    if (client?.message_alerte) {
      ui.pushDisplayAlert({
        message: client.message_alerte,
        title: client.name,
        type: 'client',
        is_blocking: !!client.blocking_alerte
      })
    }
  }, [clientsHook.selectedClient, clientsHook.clients, clientsHook.useManualClient])

  // --- Reset loyalty/discount on client change ---
  useEffect(() => {
    setPointsToUse(0)
    setUsePendingDiscount(false)
  }, [clientsHook.selectedClient, isNewSale])

  // --- Sorting ---
  const sortedLignes = useMemo(() => {
    if (sortBy === 'chrono') return cart.lignesFacture
    return [...cart.lignesFacture].sort((a: any, b: any) => {
      if (sortBy === 'name') return (a.produit.name || '').localeCompare(b.produit.name || '')
      if (sortBy === 'stock') return (b.produit.stock || 0) - (a.produit.stock || 0)
      if (sortBy === 'qty') return b.quantite - a.quantite
      return 0
    })
  }, [cart.lignesFacture, sortBy])

  // --- Keyboard Navigation ---
  const handleIncrement = useCallback((index: number) => {
    if (sortedLignes[index]) {
      const pId = sortedLignes[index].produit.id
      const currentQty = sortedLignes[index].quantite
      cart.updateQuantite(pId, currentQty + 1)
    }
  }, [sortedLignes, cart.updateQuantite])

  const handleDecrement = useCallback((index: number) => {
    if (sortedLignes[index]) {
      const pId = sortedLignes[index].produit.id
      const currentQty = sortedLignes[index].quantite
      if (currentQty > 1) {
        cart.updateQuantite(pId, currentQty - 1)
      }
    }
  }, [sortedLignes, cart.updateQuantite])

  const handleDeleteLine = useCallback((index: number) => {
    if (sortedLignes[index]) {
      cart.removeLigne(sortedLignes[index].produit.id)
    }
  }, [sortedLignes, cart.removeLigne])

  const handleValidateShortcut = useCallback(() => {
    if (cart.lignesFacture.length > 0) {
      handlePaymentClick()
    } else {
      toast.error(t('facturation.messages.cart_empty'))
    }
  }, [cart.lignesFacture.length, handlePaymentClick, t])

  const keyboardNav = useKeyboardNavigation({
    listLength: sortedLignes.length,
    onValidate: handleValidateShortcut,
    onIncrement: handleIncrement,
    onDecrement: handleDecrement,
    onDelete: handleDeleteLine,
    enabled: !ui.isPaymentModalOpen && !ui.showOrdonnanceModal && !clientsHook.showClientCreateModal && !ui.lotModal.isOpen && !ui.showStockResolution
  })

  // --- Alert Message Handler ---
  const handleAddAlertMessage = useCallback(() => {
    if (keyboardNav.selectedIndex >= 0 && sortedLignes[keyboardNav.selectedIndex]) {
      const ligne = sortedLignes[keyboardNav.selectedIndex]
      ui.setAlertTarget({
        type: 'product',
        id: ligne.produit.id,
        name: ligne.produit.name,
        currentMessage: ligne.produit.message_alerte || ''
      })
      ui.setIsAlertModalOpen(true)
      return
    }

    if (clientsHook.selectedClient && !clientsHook.useManualClient) {
      const client = clientsHook.clients.find(c => c.id === clientsHook.selectedClient)
      if (client) {
        ui.setAlertTarget({
          type: 'client',
          id: client.id,
          name: client.name,
          currentMessage: client.message_alerte || ''
        })
        ui.setIsAlertModalOpen(true)
      }
    }
  }, [keyboardNav.selectedIndex, sortedLignes, clientsHook.selectedClient, clientsHook.useManualClient, clientsHook.clients, ui.setAlertTarget, ui.setIsAlertModalOpen])

  // --- Keyboard Shortcuts ---
  useFacturationKeyboardShortcuts({
    searchInputRef,
    clientSearchRef,
    lignesFacture: cart.lignesFacture,
    quantityInputsRef,
    handlePaymentClick,
    toggleZenithMode,
    isPaymentModalOpen: ui.isPaymentModalOpen,
    closePaymentModal: ui.closePaymentModal,
    showTicketPreview: ui.showTicketPreview,
    setShowTicketPreview: ui.setShowTicketPreview,
    showOrdonnanceModal: ui.showOrdonnanceModal,
    setShowOrdonnanceModal: ui.setShowOrdonnanceModal,
    lotModalOpen: ui.lotModal.isOpen,
    closeLotModal: ui.closeLotModal,
    showClientCreateModal: clientsHook.showClientCreateModal,
    setShowClientCreateModal: clientsHook.setShowClientCreateModal,
    showStockResolution: ui.showStockResolution,
    setShowStockResolution: ui.setShowStockResolution,
    confirmModal: ui.confirmModal,
    setConfirmModal: ui.setConfirmModal,
    setSearchQuery: productSearch.setSearchQuery,
    successInfo,
    setSuccessInfo,
    setShowHelp,
    handleSuspendSale: actions.mettreEnAttente,
    handleAddAlertMessage,
    showPendingSales: pendingSales.showPendingSales,
    setShowPendingSales: pendingSales.setShowPendingSales
  })

  return {
    t,
    isZenithMode, toggleZenithMode,
    isMidnightTheme, toggleMidnightTheme,
    loading: loading || saleLoading,
    error, setError,
    successInfo, setSuccessInfo,
    refreshTrigger,
    showClientNameModal, setShowClientNameModal,
    pendingPrintFacture, setPendingPrintFacture,
    showHelp, setShowHelp,
    
    // Core state
    isRetrocession, setIsRetrocession,
    isFactureA4, setIsFactureA4,
    sortBy, setSortBy,
    isMultiCaisse: multiCaisse.isMultiCaisse, setIsMultiCaisse: multiCaisse.setIsMultiCaisse,
    postesCaisses: multiCaisse.postesCaisses, setPostesCaisses: multiCaisse.setPostesCaisses,
    selectedPosteCaisseId: multiCaisse.selectedPosteCaisseId, setSelectedPosteCaisseId: multiCaisse.setSelectedPosteCaisseId,
    lignesFacture: cart.lignesFacture,
    sortedLignes,
    totals,
    isModificationMode: ui.isModificationMode,
    modificationInvoiceId: ui.modificationInvoiceId,
    originalTotalTtc: ui.originalTotalTtc,
    setOriginalTotalTtc: ui.setOriginalTotalTtc,
    setIsModificationMode: ui.setIsModificationMode,
    setModificationInvoiceId: ui.setModificationInvoiceId,
    setLignesFacture: cart.setLignesFacture,
    isNewSale,

    // Modals and Drawers
    showOrdonnanceModal: ui.showOrdonnanceModal,
    setShowOrdonnanceModal: ui.setShowOrdonnanceModal,
    pendingOrdonnanceFacture: ui.pendingOrdonnanceFacture,
    setPendingOrdonnanceFacture: ui.setPendingOrdonnanceFacture,
    tempOrdonnanceData: ui.tempOrdonnanceData,
    showTicketPreview: ui.showTicketPreview,
    setShowTicketPreview: ui.setShowTicketPreview,
    ticketCaisse: ui.ticketCaisse,
    showPendingSales: pendingSales.showPendingSales,
    setShowPendingSales: pendingSales.setShowPendingSales,
    ventesEnAttente: pendingSales.ventesEnAttente,
    confirmModal: ui.confirmModal,
    setConfirmModal: ui.setConfirmModal,
    lotModal: ui.lotModal,
    closeLotModal: ui.closeLotModal,
    showStockResolution: ui.showStockResolution,
    setShowStockResolution: ui.setShowStockResolution,

    // Actions
    handleCompleteSale,
    handleProforma: actions.handleProforma,
    handleBonDeLivraison: actions.handleBonDeLivraison,
    addPackToFacture,
    mettreEnAttente: actions.mettreEnAttente,
    annulerVente: actions.annulerVente,
    restaurerVente: actions.restaurerVente,
    supprimerVenteEnAttente: actions.supprimerVenteEnAttente,
    handlePaymentClick,
    handlePaymentClickWithSudo,
    ouvrirModalPaiement: actions.ouvrirModalPaiement,
    handleSendWhatsApp: actions.handleSendWhatsApp,
    handleImprimerFacture: actions.handleImprimerFacture,
    handleConfirmPrintClientName: actions.handleConfirmPrintClientName,
    handleOrdonnanceSave: actions.handleOrdonnanceSave,
    handleLotSelect: actions.handleLotSelect,
    handleQuantityShortcut: actions.handleQuantityShortcut,
    handleCsvImport,
    removeLigne: cart.removeLigne,
    secureUpdateQuantite,
    secureUpdatePrix,
    secureUpdateRemiseProduit,
    completeExistingInvoicePayment,

    // Sub-hooks exposed state
    clientsHook,
    productSearch,
    cart,
    ui,
    pendingSales,
    sudoState,
    requireSudo,
    closeSudo,
    clinicalAlerts,
    keyboardNav,
    pharmacySettings,

    // Refs
    searchInputRef,
    clientSearchRef,
    quantityInputsRef,
    paymentInputRef,
    applyLoyaltyReward
  }
}
