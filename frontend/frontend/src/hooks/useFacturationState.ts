import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import api from '../services/api'
import { gooeyToast } from 'goey-toast'
import { useQueryClient } from '@tanstack/react-query'
import type { ProduitModel, Facture, LigneFacture, PaginatedResponse } from '../types'
import type { SaleCompletionResult } from '../types/finance'
import { useProductSearch } from './useProductSearch'
import { useCart } from './useCart'
import { useAuth } from '../context/AuthContext'
import { useFacturationClients } from './useFacturationClients'
import { usePendingSales } from './usePendingSales'
import { usePharmacySettings } from './usePharmacySettings'
import { useKeyboardNavigation } from './useKeyboardNavigation'
import { useClinicalCheck } from './useClinicalCheck'
import { useSidebar } from './useSidebar'
import { useTranslation } from 'react-i18next'
import { useSudo } from './useSudo'
import useSaleCompletion from './useSaleCompletion'
import { useFacturationKeyboardShortcuts } from './useFacturationKeyboardShortcuts'
import { useFacturationUI } from './useFacturationUI'
import { useFacturationSession } from './useFacturationSession'
import { useFacturationActions } from './useFacturationActions'
import { useMultiCaisse } from './useMultiCaisse'
import { useSecureCartOperations } from './useSecureCartOperations'
import { useDevisLoader } from './useDevisLoader'
import { useFacturationImport } from './useFacturationImport'
import { useRecallInvoice } from './useRecallInvoice'
import { generateUUID } from '../utils/uuid'

export type FacturationState = ReturnType<typeof useFacturationState>

export function useFacturationState() {
  const { t } = useTranslation(['prescriptions', 'common', 'facturation', 'sales'])
  const queryClient = useQueryClient()
  const { settings: pharmacySettings } = usePharmacySettings()
  const { isZenithMode, toggleZenithMode, isMidnightTheme, toggleMidnightTheme } = useSidebar()
  const { user } = useAuth()

  // --- Core local state ---
  const [loading, setLoading] = useState(false)
  const saleInProgressRef = useRef(false)
  const pendingPrintWindowRef = useRef<Window | null>(null)
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
  const [substitutionProduct, setSubstitutionProduct] = useState<ProduitModel | null>(null)
  const [forceStockProduct, setForceStockProduct] = useState<ProduitModel | null>(null)

  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const triggerUiRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1)
  }, [])

  // --- Refs ---
  const quantityInputsRef = useRef<Map<number, HTMLInputElement>>(new Map())
  const addProductRef = useRef<((product: ProduitModel, options?: { isRetrocession?: boolean; preventFocus?: boolean; markupPercentage?: number }) => void) | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const paymentInputRef = useRef<HTMLInputElement>(null)
  const clientSearchRef = useRef<HTMLInputElement>(null)

  // --- Sudo ---
  const { sudoState, requireSudo, closeSudo } = useSudo()
  const [activeSudoCreds, setActiveSudoCreds] = useState<{ validatorId: number, password: string } | null>(null)
  const [remiseSudoCreds, setRemiseSudoCreds] = useState<{ validatorId: number, password: string } | null>(null)
  const [prixSudoCreds, setPrixSudoCreds] = useState<{ validatorId: number, password: string } | null>(null)

  // --- UI Hook ---
  const ui = useFacturationUI()

  // --- Cart Hook ---
  const cart = useCart({
    onRequirePrescription: () => ui.setShowOrdonnanceModal(true),
    onAlert: (message, title, type, is_blocking, targetId) => ui.pushDisplayAlert({ message, title, type, is_blocking, targetId }),
    onSubstitution: (produit) => setSubstitutionProduct(produit),
    onForceStock: (produit) => setForceStockProduct(produit),
    onMultiLotDetected: (produit, lineId, quantity) => ui.openLotModal(produit, null, quantity, null, lineId),
    onQuantityExceedsLot: (produit, lineId, quantity) => ui.openLotModal(produit, null, quantity, null, lineId),
    quantityInputsRef
  })

  // --- Secure Cart Operations (sudo-protected) ---
  const maxDiscountRate = user?.is_superuser ? 100 : (Number(user?.profile?.max_discount_rate || 0))
  const { secureUpdateQuantite, secureUpdatePrix, secureUpdateRemiseProduit, secureSetRemiseGlobale } = useSecureCartOperations({
    cart,
    requireSudo,
    setRemiseSudoCreds,
    remiseSudoCreds,
    setPrixSudoCreds,
    prixSudoCreds,
    t,
    triggerUiRefresh,
    maxDiscountRate
  })

  // --- Clinical Check ---
  const { alerts: clinicalAlerts } = useClinicalCheck(cart.lignesFacture)

  // --- Clients ---
  const clientsHook = useFacturationClients()
  const pendingSales = usePendingSales()

  const currentMarkup = useMemo(() => {
    if (!clientsHook.selectedClient || clientsHook.useManualClient) return 0
    const client = clientsHook.clients.find(c => c.id === clientsHook.selectedClient)
    if (client?.client_type === 'PROFESSIONNEL') {
      return Number(client.majoration_pro_pourcentage || 0)
    }
    return 0
  }, [clientsHook.selectedClient, clientsHook.clients, clientsHook.useManualClient])

  // --- Barcode scanning ---
  addProductRef.current = cart.addProduit

  const handleBarcodeMatch = useCallback((product: ProduitModel) => {
    if (addProductRef.current) {
      addProductRef.current(product, { isRetrocession, preventFocus: true, markupPercentage: currentMarkup })
      gooeyToast.success(t('facturation:messages.scan_added', { name: product.name }), { duration: 1500 })
    }
  }, [isRetrocession, t, currentMarkup])

  const productSearch = useProductSearch({
    minSearchLength: 2,
    debounceMs: 400,
    pageSize: 1000,
    onBarcodeMatch: handleBarcodeMatch
  })

  // --- Import (CSV + Packs) ---
  const { addPackToFacture, handleCsvImport } = useFacturationImport({
    cart,
    apiBaseUrl: '',
    t
  })

  // Apply markup when client changes
  useEffect(() => {
    if (cart.lignesFacture.length > 0) {
      cart.applyMarkupToCart(currentMarkup)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMarkup, cart.applyMarkupToCart])

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

  // --- Recall invoice ---
  const onInvoiceLoaded = useCallback(async (invoice: Facture) => {
    // 1. Annuler la facture originale pour réintégrer le stock
    //    (comme le fait handleFullModification de la caisse centrale)
    if (invoice.id && invoice.status && invoice.status !== 'BROU') {
      try {
        await api.post(`factures/${invoice.id}/annuler/`, {
          motif: `Rappel pour modification (depuis Facturation)`
        })
      } catch {
        gooeyToast.error(t('facturation:messages.recall_cancel_error') || 'Impossible d\'annuler la facture originale')
        return
      }
    }

    // 2. Charger les produits avec le stock réintégré
    if (invoice.produits && invoice.produits.length > 0) {
      const lignes: LigneFacture[] = await Promise.all(invoice.produits.map(async (p) => {
        let produitData: ProduitModel
        if (typeof p.produit === 'object' && p.produit !== null && 'stock' in p.produit) {
          produitData = p.produit as ProduitModel
        } else {
          const produitId = typeof p.produit === 'object' && p.produit !== null ? p.produit.id : (p.produit as number)
          try {
            const { data: fullProduct } = await api.get<ProduitModel>(`produits/${produitId}/`)
            produitData = fullProduct
          } catch {
            produitData = {
              id: produitId,
              name: p.produit_nom || `Produit #${produitId}`,
              stock: 0,
              is_deleted: true
            } as unknown as ProduitModel
          }
        }

        const raw = p as unknown as { stock_lot?: number | string | null }
        const lotId = raw.stock_lot ? String(raw.stock_lot) : (p.lot || null)
        const unitPrice = Number(p.selling_price || 0)
        const lineDiscount = Number(p.discount || 0)

        return {
          lineId: generateUUID(),
          produit: produitData,
          quantite: p.quantity,
          prix_unitaire: p.selling_price,
          remise_produit: p.discount ?? '0',
          total_ligne: (p.quantity * unitPrice) - lineDiscount,
          lotId,
          lotText: p.lot || null,
          lotExpiration: p.date_expiration || null,
          lotSellingPrice: p.selling_price || null,
          treatment_duration_days: p.treatment_duration_days
        }
      }))
      cart.setLignesFacture(lignes)
    } else {
      cart.setLignesFacture([])
    }

    // 3. Restaurer le client / ayant droit / remise
    if (invoice.client) {
      clientsHook.setSelectedClient(invoice.client)
      clientsHook.setUseManualClient(false)
      if (invoice.ayant_droit) clientsHook.setSelectedAyantDroit(invoice.ayant_droit)
    } else if (invoice.client_name_override) {
      clientsHook.setUseManualClient(true)
      clientsHook.setManualClientName(invoice.client_name_override)
    } else {
      clientsHook.setSelectedClient(null)
      clientsHook.setUseManualClient(false)
    }

    if (invoice.remise) {
      ui.setRemiseGlobale(invoice.remise)
      ui.setRemiseMode('montant')
    } else {
      ui.setRemiseGlobale('0')
      ui.setRemiseMode('montant')
    }

    // 4. Mode modification (sans l'ID puisque la facture est annulée)
    ui.setIsModificationMode(true)
    ui.setModificationInvoiceId(null)
    if (ui.setModificationInvoiceStatus) ui.setModificationInvoiceStatus(null)
    ui.setOriginalTotalTtc(Number(invoice.total_ttc || 0))

    gooeyToast.success(t('facturation:messages.invoice_loaded_for_edit', { num: invoice.numero_facture || invoice.id }))
  }, [clientsHook, cart, ui, t])

  const { recallNumber, setRecallNumber, isRecalling, handleRecallInvoice } = useRecallInvoice({ onInvoiceLoaded, t })

  // --- Totals ---
  const totals = useMemo(() =>
    ui.calculateTotals(cart.cartStats, clientsHook.clients.find(c => c.id === clientsHook.selectedClient)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    user,
    myActivePoste: multiCaisse.myActivePoste,
    postesCaisses: multiCaisse.postesCaisses
  })

  // --- Sale Completion ---
  const { completeSale, completeExistingInvoicePayment, loading: saleLoading } = useSaleCompletion({
    onSuccess: (result: SaleCompletionResult) => {
      if (result.success && result.facture) {
        // Notification visuelle uniquement si vente payée directement (pas en attente caisse centralisée)
        if (result.ticketCaisse) {
          setSuccessInfo(result.facture)
          ui.setTicketCaisse(result.ticketCaisse)

          if (isFactureA4) {
            const normalize = (str: string) => str?.toLowerCase().trim() || ''
            const clientName = normalize(result.facture.client_name || '')
            const isGenericClient = !result.facture.client_name_override && (
              !clientName || clientName.includes('passage') || clientName.includes('divers')
            )
            if (isGenericClient) {
              // Fermer la fenêtre pré-ouverte — le ClientNameModal s'occupera de l'impression
              if (pendingPrintWindowRef.current) {
                pendingPrintWindowRef.current.close()
                pendingPrintWindowRef.current = null
              }
              setPendingPrintFacture(result.facture)
              setShowClientNameModal(true)
            } else {
              const nameToUse = result.facture.client_name_override || result.facture.client_name
              let url = `/app/print-invoice/${result.facture.id}`
              if (nameToUse) url += `?client_name=${encodeURIComponent(nameToUse)}`
              // Utiliser la fenêtre pré-ouverte
              if (pendingPrintWindowRef.current) {
                pendingPrintWindowRef.current.location.href = url
                pendingPrintWindowRef.current = null
              } else {
                const w = window.open(url, '_blank')
                if (!w) gooeyToast.error(t('common:popup_blocked'))
              }
            }
            setIsFactureA4(false)
          } else {
            ui.setShowTicketPreview(true)
          }
        } else {
          // Envoi caisse centralisée — reset du flag facture
          if (isFactureA4) {
            setIsFactureA4(false)
          }
        }

        ui.resetUIState()

        // Mettre à jour le cache stock dans tous les cas
        cart.lignesFacture.forEach((ligne: LigneFacture) => {
          queryClient.setQueriesData({ queryKey: ['produits'] }, (oldData: PaginatedResponse<ProduitModel> | ProduitModel[] | undefined) => {
            if (!oldData) return oldData
            if (!Array.isArray(oldData) && oldData.results && Array.isArray(oldData.results)) {
              return {
                ...oldData,
                results: oldData.results.map((p: ProduitModel) =>
                  p.id === ligne.produit.id ? { ...p, stock: Math.max(0, (p.stock || 0) - ligne.quantite) } : p
                )
              }
            } else if (Array.isArray(oldData)) {
              return (oldData as ProduitModel[]).map((p: ProduitModel) =>
                p.id === ligne.produit.id ? { ...p, stock: Math.max(0, (p.stock || 0) - ligne.quantite) } : p
              )
            }
            return oldData
          })
          queryClient.setQueriesData({ queryKey: ['produit', ligne.produit.id] }, (oldData: ProduitModel | undefined) => {
            if (!oldData) return oldData
            return { ...oldData, stock: Math.max(0, (oldData.stock || 0) - ligne.quantite) }
          })
        })

        actions._resetSaleDataOnly()
        setActiveSudoCreds(null)
        setRemiseSudoCreds(null)
        setPrixSudoCreds(null)
        ui.closePaymentModal()
      }
    },
    onReset: () => {
      actions._resetSaleDataOnly()
      setActiveSudoCreds(null)
      setRemiseSudoCreds(null)
      setPrixSudoCreds(null)
    },
    onError: (msg: string) => setError(msg)
  })

  const isPosteCaisseActive = Boolean(multiCaisse.myActivePoste)
  const hasActiveCaisse = multiCaisse.activePostesVente.some((p) => !!p.caisse)
  const hasMyActivePoste = multiCaisse.activePostesVente.some((p) => p.vendeur === user?.id)

  // --- Complete Sale Handler ---
  const handleCompleteSale = async (sudoCredentials?: { validatorId: number, password: string }) => {
    if (saleInProgressRef.current) return
    saleInProgressRef.current = true

    // En mode caisse centrale, une caisse doit être ouverte avant toute vente
    if (multiCaisse.centralizedCashRegister && !hasActiveCaisse) {
      setError(t('facturation:messages.no_cash_register_open'))
      saleInProgressRef.current = false
      return
    }

    // Sudo required when sending to centralized cash register or when selling on an opened cash register point
    if ((multiCaisse.centralizedCashRegister || isPosteCaisseActive) && !sudoCredentials) {
      saleInProgressRef.current = false
      requireSudo(async (validatorId, password) => {
        await handleCompleteSale({ validatorId, password })
      }, {
        title: isPosteCaisseActive ? 'Validation vendeur' : t('facturation:payment.sudo_confirm_identity'),
        message: isPosteCaisseActive
          ? 'Ce poste est partagé. Veuillez saisir vos identifiants de vendeur pour cette vente.'
          : t('facturation:payment.sudo_send_to_caisse'),
        permission: 'can_validate_sales',
        forceCurrentUser: false,
      })
      return
    }

    const effectiveSudo = sudoCredentials || activeSudoCreds

    // En mode caisse centrale, les ventes des POS convergent vers le point de caisse ouvert.
    // On cherche uniquement parmi les postes qui ont une caisse physique (caisse non null).
    const activeCaissePosteVente = multiCaisse.centralizedCashRegister
      ? multiCaisse.activePostesVente.find((p) => p.caisse && p.caisse === multiCaisse.selectedPosteCaisseId)
        ?? multiCaisse.activePostesVente.find((p) => !!p.caisse)
      : null

    const posteVenteId = multiCaisse.centralizedCashRegister
      ? (activeCaissePosteVente?.id ?? null)
      : (multiCaisse.myActivePoste?.id ?? null)

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
      remise_validated_by_id: remiseSudoCreds?.validatorId || null,
      remise_validated_password: remiseSudoCreds?.password || undefined,
      prix_validated_by_id: prixSudoCreds?.validatorId || null,
      prix_validated_password: prixSudoCreds?.password || undefined,
      modificationInvoiceStatus: ui.modificationInvoiceStatus || undefined,
      poste_vente_id: posteVenteId,
      prescriptionImage: ui.prescriptionImage,
      modificationInvoiceId: ui.modificationInvoiceId,
      isFactureA4: isFactureA4,
      is_avoir_client: ui.isAvoirClient,
      promisClientName: ui.promisClientName,
      promisPhone: ui.promisPhone,
    }
    try {
      await completeSale(params)
    } finally {
      saleInProgressRef.current = false
    }
  }

  const applyLoyaltyReward = useCallback(() => {
    if (!clientsHook.selectedClient || clientsHook.useManualClient) return
    const client = clientsHook.clients.find(c => c.id === clientsHook.selectedClient)
    if (client?.pending_discount && Number(client.pending_discount) > 0) {
      ui.setRemiseGlobale(client.pending_discount)
      ui.setRemiseMode('taux')
      setUsePendingDiscount(true)
      gooeyToast.success(t('facturation:messages.reward_applied', { discount: client.pending_discount }))
    }
  }, [clientsHook.selectedClient, clientsHook.clients, clientsHook.useManualClient, ui, t])

  // --- Payment Preparation ---
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handlePaymentClick = async () => {
    setLoading(true)
    // Pré-ouvrir la fenêtre d'impression A4 si demandé (avant les await)
    // pour éviter le blocage popup par le navigateur
    pendingPrintWindowRef.current = null
    if (isFactureA4) {
      try {
        pendingPrintWindowRef.current = window.open('about:blank', '_blank')
      } catch { /* ignore */ }
      if (!pendingPrintWindowRef.current) {
        gooeyToast.error(t('common:popup_blocked'))
      }
    }
    let freshLignes = cart.lignesFacture
    try {
      const productIds = cart.lignesFacture.map((l: LigneFacture) => l.produit.id)
      const { data: freshProductsData } = await api.post<ProduitModel[]>('produits/bulk_refresh/', { ids: productIds })

      const productMap = new Map(freshProductsData.map((p: ProduitModel) => [p.id, p]))
      freshLignes = cart.lignesFacture.map((ligne: LigneFacture) => {
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
    } catch {
      gooeyToast.error(t('facturation.messages.refresh_failed') || "Erreur de rafraîchissement des stocks")
    }

    cart.setLignesFacture(freshLignes)
    setLoading(false)

    const problematicLines = freshLignes.filter((l: LigneFacture) => !l.isPromis && l.quantite > (l.produit.stock ?? 0))

    if (problematicLines.length > 0) {
      // Fermer la fenêtre pré-ouverte — le flux de résolution de stock
      // peut annuler la vente ou modifier les quantités
      if (pendingPrintWindowRef.current) {
        pendingPrintWindowRef.current.close()
        pendingPrintWindowRef.current = null
      }
      const items = problematicLines.map((l: LigneFacture) => ({ product: l.produit, quantity: l.quantite, stock: l.produit.stock ?? 0 }))
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
        if (activeSudoCreds) {
          await handleCompleteSale(activeSudoCreds)
        } else {
          requireSudo(async (validatorId, password) => {
            await handleCompleteSale({ validatorId, password })
          }, {
            title: t('facturation:payment.sudo_mode.validate_by'),
            message: `Cette vente avec un total de ${totalTtc} F nécessite l'autorisation d'un superviseur.`,
            permission: 'can_validate_zero_amount'
          })
        }
      } else {
        const montantInitial = (totals.tauxCouverture > 0) ? totals.partPatient : totalTtc
        ui.setMontantPaye(montantInitial.toString())
        ui.openPaymentModal()
      }
    }
  }

  const handlePaymentClickWithSudo = (updatedLignes?: LigneFacture[], sudoCredentials?: { validatorId: number, password: string }) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsHook.selectedClient, clientsHook.clients, clientsHook.useManualClient])

  // --- Reset loyalty/discount on client change ---
  useEffect(() => {
    setPointsToUse(0)
    setUsePendingDiscount(false)
  }, [clientsHook.selectedClient, isNewSale])

  // --- Sorting ---
  const sortedLignes = useMemo(() => {
    if (sortBy === 'chrono') return cart.lignesFacture
    return cart.lignesFacture.slice().sort((a: LigneFacture, b: LigneFacture) => {
      if (sortBy === 'name') return (a.produit.name || '').localeCompare(b.produit.name || '')
      if (sortBy === 'stock') return (b.produit.stock || 0) - (a.produit.stock || 0)
      if (sortBy === 'qty') return b.quantite - a.quantite
      return 0
    })
  }, [cart.lignesFacture, sortBy])

  // --- Keyboard Navigation ---
  const handleIncrement = useCallback((index: number) => {
    if (sortedLignes[index]) {
      const lId = sortedLignes[index].lineId
      const currentQty = sortedLignes[index].quantite
      cart.updateQuantite(lId, currentQty + 1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedLignes, cart.updateQuantite])

  const handleDecrement = useCallback((index: number) => {
    if (sortedLignes[index]) {
      const lId = sortedLignes[index].lineId
      const currentQty = sortedLignes[index].quantite
      if (currentQty > 1) {
        cart.updateQuantite(lId, currentQty - 1)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedLignes, cart.updateQuantite])

  const handleDeleteLine = useCallback((index: number) => {
    if (sortedLignes[index]) {
      cart.removeLigne(sortedLignes[index].lineId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedLignes, cart.removeLigne])

  const handleValidateShortcut = useCallback(() => {
    if (cart.lignesFacture.length > 0) {
      handlePaymentClick()
    } else {
      gooeyToast.error(t('facturation.messages.cart_empty'))
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    centralizedCashRegister: multiCaisse.centralizedCashRegister,
    postesCaisses: multiCaisse.postesCaisses, setPostesCaisses: multiCaisse.setPostesCaisses,
    activePostesVente: multiCaisse.activePostesVente, setActivePostesVente: multiCaisse.setActivePostesVente,
    selectedPosteCaisseId: multiCaisse.selectedPosteCaisseId, setSelectedPosteCaisseId: multiCaisse.setSelectedPosteCaisseId,
    activePoste: multiCaisse.myActivePoste,
    isPosteCaisseActive,
    hasMyActivePoste,
    allPostes: multiCaisse.postesCaisses,
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
    secureSetRemiseGlobale,
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

    currentMarkup,
    // Substitution
    substitutionProduct,
    setSubstitutionProduct,
    // Force stock
    forceStockProduct,
    setForceStockProduct,
    // Refs
    searchInputRef,
    clientSearchRef,
    quantityInputsRef,
    paymentInputRef,
    applyLoyaltyReward,
    user,

    // Recall invoice
    recallNumber,
    setRecallNumber,
    isRecalling,
    handleRecallInvoice
  }
}
