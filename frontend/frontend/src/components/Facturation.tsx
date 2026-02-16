import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import type { ProduitModel, Facture, LigneFacture } from '../types'
import { useProductSearch } from '../hooks/useProductSearch'
import { useCart } from '../hooks/useCart'
import { useFacturationClients } from '../hooks/useFacturationClients'
import { usePendingSales } from '../hooks/usePendingSales'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation'
import { useClinicalCheck } from '../hooks/useClinicalCheck'
import { useSidebar } from '../context/SidebarContext'
import { safeStorage } from '../utils/storage'
import { Eye, EyeOff, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import PaymentModal from './facturation/PaymentModal'
import OrdonnanceModal, { type OrdonnanceData } from './OrdonnanceModal'
import LotSelectionModal from './LotSelectionModal'
import TotalsSection from './facturation/TotalsSection'
import ActionButtons from './facturation/ActionButtons'
import CartTable from './facturation/CartTable'
import ProductSearchSection from './facturation/ProductSearchSection'
import ClientSection from './facturation/ClientSection'
import ClinicalAlerts from './clinical/ClinicalAlerts'
import ClientCreateModal from './facturation/ClientCreateModal'
import PendingSalesDrawer from './facturation/PendingSalesDrawer'
import TicketPreviewModal from './facturation/TicketPreviewModal'
import SudoValidationModal from './common/SudoValidationModal'
import { useSudo } from '../hooks/useSudo'
import { StockResolutionHandler } from './facturation/StockResolutionHandler'
import { useSaleCompletion } from '../hooks/useSaleCompletion'
import { useFacturationUI } from '../hooks/useFacturationUI'


// FactureProduitPayload removed as it's now handled by useSaleCompletion


export default function Facturation() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { settings: pharmacySettings } = usePharmacySettings()
  const { isZenithMode, toggleZenithMode, isMidnightTheme, toggleMidnightTheme } = useSidebar()
  
  // Local loading state for non-hook operations (e.g. payment)
  const [loading, setLoading] = useState(false)
  const [isRetrocession, setIsRetrocession] = useState(false)

  // Refs - declared early for hook usage
  const quantityInputsRef = useRef<Map<number, HTMLInputElement>>(new Map())
  
  // Ref for barcode callback (to avoid hook ordering issues)
  const addProductRef = useRef<((product: ProduitModel, options?: { isRetrocession?: boolean; preventFocus?: boolean }) => void) | null>(null)
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const clientSelectRef = useRef<HTMLSelectElement>(null)
  const paymentInputRef = useRef<HTMLInputElement>(null)
  const clientSearchRef = useRef<HTMLInputElement>(null)

  // Stabilize callbacks to prevent hook infinite loops
  const handleRequirePrescription = useCallback(() => {
    setShowOrdonnanceModal(true)
  }, [])
  // useCart Hook - Manages all cart logic (must be before useProductSearch for barcode callback)
  const {
      lignesFacture,
      setLignesFacture,
      addProduit: addProduitToFacture,
      updateQuantite,
      updatePrix,
      updateRemiseProduit,
      updateLineLot,
      removeLigne,
      cartStats
  } = useCart({
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
      onRequirePrescription: handleRequirePrescription,
      quantityInputsRef
  })

  const { sudoState, requireSudo, closeSudo } = useSudo()

  const secureUpdateQuantite = useCallback((produitId: number, newQty: number) => {
    if (newQty < 0) {
      const currentLine = lignesFacture.find(l => l.produit.id === produitId);
      requireSudo(async (validatorId, password) => {
          setActiveSudoCreds({ validatorId, password });
          updateQuantite(produitId, newQty);
      }, {
          title: `Validation Quantité Négative`,
          message: `Confirmer la quantité <strong>${newQty}</strong> pour le produit <strong>${currentLine?.produit.name}</strong> ?`
      });
    } else {
      updateQuantite(produitId, newQty);
    }
  }, [updateQuantite, lignesFacture, requireSudo]);

  const secureUpdatePrix = useCallback((produitId: number, newPrice: string) => {
    const currentLine = lignesFacture.find(l => l.produit.id === produitId);
    if (!currentLine) return;
    if (newPrice !== currentLine.prix_unitaire) {
      requireSudo(async (validatorId, password) => {
          setActiveSudoCreds({ validatorId, password });
          updatePrix(produitId, newPrice);
      }, {
          title: `Modification de Prix`,
          message: `Confirmer le changement de prix de <strong>${currentLine.prix_unitaire}</strong> à <strong>${newPrice}</strong> pour <strong>${currentLine.produit.name}</strong> ?`
      });
    } else {
      updatePrix(produitId, newPrice);
    }
  }, [updatePrix, lignesFacture, requireSudo]);

  const secureUpdateRemiseProduit = useCallback((produitId: number, newRemise: string) => {
    const currentLine = lignesFacture.find(l => l.produit.id === produitId);
    if (!currentLine) return;
    if (Number(newRemise) > 0 && newRemise !== currentLine.remise_produit) {
      requireSudo(async (validatorId, password) => {
          setActiveSudoCreds({ validatorId, password });
          updateRemiseProduit(produitId, newRemise);
      }, {
          title: `Validation Remise`,
          message: `Confirmer une remise de <strong>${newRemise}%</strong> sur le produit <strong>${currentLine.produit.name}</strong> ?`
      });
    } else {
      updateRemiseProduit(produitId, newRemise);
    }
  }, [updateRemiseProduit, lignesFacture, requireSudo]);

  // Clinical Check
  const { alerts: clinicalAlerts } = useClinicalCheck(lignesFacture)
  
  // Keep ref updated with latest addProduit function
  addProductRef.current = addProduitToFacture

  // Use product search hook with barcode scan auto-add
  const handleBarcodeMatch = useCallback((product: ProduitModel) => {
      // Auto-add scanned product to cart via ref
      if (addProductRef.current) {
        addProductRef.current(product, { isRetrocession, preventFocus: true })
        toast.success(t('facturation.messages.scan_added', { name: product.name }), { duration: 1500 })
      }
  }, [isRetrocession])

  // Use product search hook with barcode scan auto-add
  const { 
    produits, 
    loading: searchLoading, 
    searchQuery, 
    setSearchQuery
  } = useProductSearch({ 
    minSearchLength: 2, 
    debounceMs: 200,
    onBarcodeMatch: handleBarcodeMatch
  })

  // Pack Addition Logic
  const addPackToFacture = useCallback(async (pack: any) => {
      if (!pack.pack_items || pack.pack_items.length === 0) {
          toast.error(t('facturation.messages.pack_empty'))
          return
      }

      const toastId = toast.loading(t('facturation.messages.adding_pack'))
      try {
          // Fetch all products details concurrently
          const apiBase = import.meta.env.VITE_API_BASE_URL ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '') : ''
          const endpoint = apiBase ? `${apiBase}/api/produits/` : '/api/produits/'

          const itemPromises = pack.pack_items.map(async (item: any) => {
             try {
                const { data: product } = await axios.get<ProduitModel>(`${endpoint}${item.product}/`)
                return { product, quantity: item.quantity }
             } catch (e) {
                 console.error(`Failed to fetch product ${item.product}`, e)
                 return null
             }
          })
          
          const results = await Promise.all(itemPromises)
          const items = results.filter(i => i !== null) as { product: ProduitModel, quantity: number }[]

          if (items.length === 0) {
              toast.error(t('facturation.messages.pack_items_error'), { id: toastId })
              return
          }
          
          // Add items to cart
          // Note: straightforward loop might have state race conditions if addProduit relies on current state
          // But useCart usually handles functional state updates.
          // We'll iterate.
          
          // We calculate the ratio to adjust prices to match pack value
          // Total Normal Price
          const totalNormalPrice = items.reduce((sum, item) => sum + (Number(item.product.selling_price) * item.quantity), 0)
          const packPrice = Number(pack.value)
          
          // Ratio for discount
          const ratio = totalNormalPrice > 0 ? packPrice / totalNormalPrice : 1
          
          for (const { product, quantity } of items) {
              // Add product
              addProduitToFacture(product)
              
              // We need to set quantity. 
              // Since addProduit adds 1, we might need to wait or rely on it being present.
              // To avoid race conditions, we use a timeout or assume addProduit is synchronous enough in state dispatch
              // Actually, useCart `addProduit` usually sets state. 
              // Multiple `setState` in loop is fine in React 18 (batched).
              // But accessing `lignesFacture` immediately after might fail if we needed to check it.
              // Luckily `updateQuantite` usually takes ID.
              
              // We'll queue quantity updates? 
              // Better: just call updateQuantite immediately.
              updateQuantite(product.id, quantity)
              
              // Apply price adjustment (Remise)
              if (ratio < 1) {
                  // Calculate discount percentage
                  // Or set specific price? `updatePrix`?
                  // Let's use Remise logic if possible, or just change selling_price?
                  // `updateRemiseProduit` takes percentage or amount? 
                  // If we want exact match, better to update price net.
                  // But `updatePrix` might just change unit price. 
                  // updatePrix(product.id, newUnitPrice.toFixed(2)) 
                  // Let's rely on standard price but apply global discount? 
                  // No, bundle discount is specific.
                  // Let's apply a discount percent.
                  const discountPercent = (1 - ratio) * 100
                  updateRemiseProduit(product.id, discountPercent.toFixed(2))
              }
          }
          
          toast.success(t('facturation.messages.pack_added', { name: pack.name }), { id: toastId })
          
      } catch (e) {
          console.error(e)
          toast.error(t('facturation.messages.pack_error'), { id: toastId })
      }
  }, [addProduitToFacture, updateQuantite, updateRemiseProduit, updatePrix])

  // useFacturationClients Hook - Manages all client/AD logic
  const {
    clients,
    selectedClient, setSelectedClient,
    manualClientName, setManualClientName,
    useManualClient, setUseManualClient,
    clientSearch, setClientSearch,
    filteredClients,
    showClientDropdown, setShowClientDropdown,
    showClientCreateModal, setShowClientCreateModal,
    newClientForm, setNewClientForm,
    isCreatingClient,
    handleCreateClient,
    ayantsDroitList,
    selectedAyantDroit, setSelectedAyantDroit,
    ayantDroitNom, setAyantDroitNom,
    ayantDroitMatricule, setAyantDroitMatricule,
    ayantDroitSociete, setAyantDroitSociete,
    showNewAyantDroit, setShowNewAyantDroit
  } = useFacturationClients({
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL
  })

  // usePendingSales Hook
  const {
      ventesEnAttente,
      showPendingSales,
      setShowPendingSales,
      savePendingSale,
      deletePendingSale
  } = usePendingSales()

  // useSaleCompletion Hook
  const { 
    completeSale, 
    completeExistingInvoicePayment,
    loading: saleLoading
  } = useSaleCompletion({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    onSuccess: (result) => {
        if (result.success && result.facture) {
            setSuccessInfo(result.facture) // Keep only this local state for toast notifications
            setTicketCaisse(result.ticketCaisse || null)
            if (result.ticketCaisse) setShowTicketPreview(true)
            
            // Clean up
            resetUIState()
            _resetSaleDataOnly() // Clear cart
            closePaymentModal()
            queryClient.invalidateQueries({ queryKey: ['produits'] })
        }
    },
    onError: (msg) => setError(msg)
  })

  // We keep only essential local UI state not covered by hook
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<Facture | null>(null)
  const [pointsToUse, setPointsToUse] = useState(0)
  const [usePendingDiscount, setUsePendingDiscount] = useState(false)
  const [centralizedCashRegister, setCentralizedCashRegister] = useState<boolean>(true)
  const [activeSudoCreds, setActiveSudoCreds] = useState<{ validatorId: number, password: string } | null>(null);

  // New UI Hook replacing local state
  const {
      // States
      remiseGlobale, setRemiseGlobale,
      remiseMode, setRemiseMode,
      modePaiement, setModePaiement,
      montantPaye, setMontantPaye,
      paiements, setPaiements,
      reference, setReference,
      
      isPaymentModalOpen,
      facturePourPaiement,
      openPaymentModal,
      closePaymentModal,

      showTicketPreview, setShowTicketPreview,
      ticketCaisse, setTicketCaisse,

      showStockResolution, setShowStockResolution,
      stockResolutionItems, setStockResolutionItems,
      promisSelections, setPromisSelections,
      promisPhone, setPromisPhone,
      promisClientName, setPromisClientName,

      lotModal, openLotModal, closeLotModal,
      confirmModal, setConfirmModal,

      showOrdonnanceModal, setShowOrdonnanceModal,
      tempOrdonnanceData, setTempOrdonnanceData,
      pendingOrdonnanceFacture, setPendingOrdonnanceFacture,
      devisIdToValidate, setDevisIdToValidate,


      isModificationMode, setIsModificationMode,
      modificationInvoiceId, setModificationInvoiceId,
      originalTotalTtc, setOriginalTotalTtc,

      // Actions
      resetUIState,
      calculateTotals
  } = useFacturationUI()

  // Computed Totals
  const totals = useMemo(() => 
      calculateTotals(cartStats, clients.find(c => c.id === selectedClient)),
      [cartStats, selectedClient, calculateTotals]
  )

  // Derived state (replaces previous local isNewSale logic if needed)
  // Logic: It's a new sale if we don't have a specific invoice ID being paid (standard checkout)
  // BUT: Facturation logic was a bit fuzzy. Let's assume !facturePourPaiement means new sale from cart.
  const isNewSale = !facturePourPaiement



  // Keyboard Navigation Hook - NOW PLACED AFTER STATE DECLARATIONS
  const hasItems = lignesFacture.length > 0;
  
  const handleValidateShortcut = useCallback(() => {
    if (hasItems) {
      handlePaymentClick()
    } else {
        toast.error(t('facturation.messages.cart_empty'))
    }
  }, [hasItems]) // Added dependency later

  // Define handlers locally to avoid closure staleness if needed, 
  // but hook takes them as props.
  const handleIncrement = useCallback((index: number) => {
    if (lignesFacture[index]) {
       const pId = lignesFacture[index].produit.id
       const currentQty = lignesFacture[index].quantite
       updateQuantite(pId, currentQty + 1)
    }
  }, [lignesFacture, updateQuantite])

  const handleDecrement = useCallback((index: number) => {
    if (lignesFacture[index]) {
       const pId = lignesFacture[index].produit.id
       const currentQty = lignesFacture[index].quantite
       if (currentQty > 1) {
          updateQuantite(pId, currentQty - 1)
       }
    }
  }, [lignesFacture, updateQuantite])

  const handleDeleteLine = useCallback((index: number) => {
    if (lignesFacture[index]) {
       removeLigne(lignesFacture[index].produit.id)
    }
  }, [lignesFacture, removeLigne])

  const { selectedIndex, setSelectedIndex } = useKeyboardNavigation({
    listLength: lignesFacture.length,
    onValidate: handleValidateShortcut,
    onIncrement: handleIncrement,
    onDecrement: handleDecrement,
    onDelete: handleDeleteLine,
    enabled: !isPaymentModalOpen && !showOrdonnanceModal && !showClientCreateModal && !lotModal.isOpen && !showStockResolution
  })


  // Charger un devis depuis safeStorage si présent (navigation depuis Ventes)
  useEffect(() => {
    const loadDevis = async () => {
      const devisString = safeStorage.getItem('devis_to_load', 'local')
      if (!devisString) return
      
      try {
        const devis = JSON.parse(devisString) as Facture
        
        // Charger les informations du client
        if (devis.client) {
          setSelectedClient(devis.client)
          setUseManualClient(false)
          
          // Charger l'ayant droit si présent
          if (devis.ayant_droit) {
            setSelectedAyantDroit(devis.ayant_droit)
          }
        } else if (devis.client_name_override) {
          setUseManualClient(true)
          setManualClientName(devis.client_name_override)
        }
        
        // Charger les produits avec données complètes (stock actuel)
        if (devis.produits && devis.produits.length > 0) {
          const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''
          const produitsEndpoint = apiBase ? `${apiBase}/api/produits/` : '/api/produits/'
          
          const lignes: LigneFacture[] = await Promise.all(devis.produits.map(async (p) => {
            let produitData: ProduitModel
            
            if (typeof p.produit === 'object' && p.produit.stock !== undefined) {
              // Le produit a déjà les données complètes
              produitData = p.produit
            } else {
              // Récupérer les données complètes du produit depuis l'API (incluant stock actuel)
              const produitId = typeof p.produit === 'object' ? p.produit.id : p.produit
              try {
                const { data: fullProduct } = await axios.get<ProduitModel>(`${produitsEndpoint}${produitId}/`)
                produitData = fullProduct
              } catch {
                // Fallback en cas d'erreur - créer objet minimal
                produitData = { 
                  id: produitId, 
                  name: p.produit_nom || `Produit #${produitId}`,
                  stock: 0, // Défaut sécuritaire
                  is_deleted: true
                } as ProduitModel
              }
            }
            
            return {
              produit: produitData,
              quantite: p.quantity,
              prix_unitaire: p.selling_price,
              remise_produit: '0',
              total_ligne: p.quantity * Number(p.selling_price),
              lotId: p.lot || null,
              lotText: p.lot || null,
              lotExpiration: p.date_expiration || null
            }
          }))
          setLignesFacture(lignes)
        }
        
        // Charger la remise
        if (devis.remise) {
          setRemiseGlobale(devis.remise)
          setRemiseMode('montant')
        }
        
        // Détecter si c'est une facture validée/payée (mode modification)
        const isValidatedOrPaid = devis.status === 'VAL' || devis.status === 'PAY'
        
        if (isValidatedOrPaid) {
          // Mode modification - facture déjà validée/payée
          setIsModificationMode(true)
          setModificationInvoiceId(devis.id)
          setOriginalTotalTtc(Number(devis.total_ttc || 0))
          toast.success(`Facture #${devis.numero_facture || devis.id} chargée en mode modification`)
        } else {
          // Mode normal - devis/proforma/brouillon à valider
          setDevisIdToValidate(devis.id)
          toast.success(`Devis #${devis.numero_facture || devis.id} chargé`)
        }
        
        // Nettoyer le stockage
        safeStorage.removeItem('devis_to_load', 'local')
      } catch (err) {
        console.error('Erreur lors du chargement du devis:', err)
        toast.error('Impossible de charger le devis')
        safeStorage.removeItem('devis_to_load', 'local')
      }
    }
    
    loadDevis()
  }, [])

  // Auto-focus search input on mount
  useEffect(() => {
    // Small timeout to ensure the DOM is fully ready and transition animations don't interfere
    const timer = setTimeout(() => {
      searchInputRef.current?.focus()
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : ''
  }, [])

  const handleApiError = useCallback((err: unknown, defaultMessage: string) => {
    if (axios.isAxiosError(err)) {
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || defaultMessage
      const errorData = err.response?.data
      console.error('Erreur API:', {
        status: err.response?.status,
        data: errorData,
        message: errorMessage
      })
      setError(errorMessage)
      setSuccessInfo(null)
    } else {
      setError(defaultMessage)
      console.error('Erreur API:', err)
    }
  }, [])

  // Charger les paramètres de facturation (mode caisse centralisée)
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      try {
        const settingsEndpoint = apiBaseUrl
            ? `${apiBaseUrl}/api/invoice-settings/`
            : '/api/invoice-settings/'
        const settingsRes = await axios.get(settingsEndpoint)
        setCentralizedCashRegister(settingsRes.data?.centralized_cash_register ?? true)
      } catch (err) {
        console.warn('Impossible de charger les paramètres de facturation, mode caisse centralisée activé par défaut')
        handleApiError(err, 'Erreur lors du chargement des paramètres.')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [apiBaseUrl, handleApiError])



  // Appliquer automatiquement la remise du client quand il est sélectionné
  useEffect(() => {
    if (!selectedClient || useManualClient) {
      return
    }

    const client = clients.find(c => c.id === selectedClient)
    if (client?.remise_automatique && Number(client.remise_automatique) > 0) {
      setRemiseGlobale(client.remise_automatique)
      setRemiseMode('taux') // La remise automatique est toujours en pourcentage
    }
  }, [selectedClient, clients, useManualClient])





  const handlePaymentClick = async () => {
      // Check for out-of-stock items before payment
      if (!user?.can_sell_negative_stock) {
         // If user CANNOT sell negative stock, they MUST handle it.
      }

      setLoading(true)
      
      // 1. Refresh Stock Data for ALL lines to ensure we don't rely on stale cache
      // This solves the issue where previously loaded products might show outdated stock
      // Optimized: Using new bulk_refresh endpoint to avoid multiple simultaneous API calls
      let freshLignes = lignesFacture;
      try {
          const productIds = lignesFacture.map(l => l.produit.id);
          const refreshEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/produits/bulk_refresh/` : '/api/produits/bulk_refresh/';
          
          const { data: freshProductsData } = await axios.post<any[]>(refreshEndpoint, { ids: productIds });
          
          // Map fresh data back to lines
          const productMap = new Map(freshProductsData.map(p => [p.id, p]));
          
          freshLignes = lignesFacture.map(ligne => {
              const freshProduct = productMap.get(ligne.produit.id);
              if (freshProduct) {
                  return {
                      ...ligne,
                      produit: {
                          ...ligne.produit,
                          stock: freshProduct.stock,
                          selling_price: freshProduct.selling_price,
                          is_active: freshProduct.is_active
                      }
                  };
              }
              return ligne;
          });
      } catch (e) {
          console.error(`Failed to bulk refresh stocks`, e);
          toast.error(t('facturation.messages.refresh_failed') || "Erreur de rafraîchissement des stocks");
          // Fallback to current state
      }

      // Update the cart state with fresh data so the UI reflects reality
      setLignesFacture(freshLignes)
      setLoading(false)

      const problematicLines = freshLignes.filter(l =>
          // Check if quantity > stock (and product manages stock)
          l.quantite > (l.produit.stock ?? 0)
      )

      if (problematicLines.length > 0) {
          const items = problematicLines.map(l => ({
              product: l.produit,
              quantity: l.quantite,
              stock: l.produit.stock ?? 0
          }))
          setStockResolutionItems(items)

          // Auto-select all items for Promis by default
          const allIds = new Set(items.map(i => i.product.id))
          setPromisSelections(allIds)

          // Pre-select phone if available
          const client = clients.find(c => c.id === selectedClient)
          setPromisPhone(client?.phone || '')
          
          // Pre-select name if available
          if (useManualClient) {
              setPromisClientName(manualClientName)
          } else if (client) {
              setPromisClientName(client.name)
          } else {
              setPromisClientName('')
          }

          // Default: Select ALL items for Promis. User can uncheck to force sale.
          setPromisSelections(new Set(items.map(i => i.product.id)))

          setShowStockResolution(true)
      } else {
          // Auto-fill montant with total to pay (Part Patient if Tiers Payant, else Total TTC)
          const montantInitial = (totals.tauxCouverture > 0) ? totals.partPatient : totals.totalTtc
          setMontantPaye(montantInitial.toString()) // Keep precision, don't round immediately for editing
          openPaymentModal()
      }
  }

  const handlePaymentClickWithSudo = async (sudoCredentials?: { validatorId: number, password: string }) => {
      if (sudoCredentials) {
          setActiveSudoCreds(sudoCredentials);
      }
      await handlePaymentClick();
  }

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // F2: Focus Project Search Input
      if (e.key === 'F2') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // F4: Focus Quantity (Last Item)
      if (e.key === 'F4') {
        e.preventDefault()
        if (lignesFacture.length > 0) {
          const lastItem = lignesFacture[lignesFacture.length - 1]
          const input = quantityInputsRef.current.get(lastItem.produit.id)
          if (input) {
            input.focus()
            input.select()
          }
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        clientSearchRef.current?.focus()
      }

      // Alt+Z: Toggle Zenith Mode
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        toggleZenithMode()
      }

      // CTRL+ENTER: Payment
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        handlePaymentClick()
      }
      
      // Escape: Global Cancel / Close Modals
      if (e.key === 'Escape') {
        // Priority: Close top-most modal
        if (showTicketPreview) { setShowTicketPreview(false); return }
        if (isPaymentModalOpen) { closePaymentModal(); return }
        if (showOrdonnanceModal) { setShowOrdonnanceModal(false); return }
        if (lotModal.isOpen) { closeLotModal(); return }
        if (showClientCreateModal) { setShowClientCreateModal(false); return }
        if (showStockResolution) { setShowStockResolution(false); return }
        if (confirmModal) { setConfirmModal(null); return }
        
        // If searching client, clear search?
        if (document.activeElement === clientSearchRef.current) {
            clientSearchRef.current?.blur()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    lignesFacture, handlePaymentClick, 
    showTicketPreview, isPaymentModalOpen, showOrdonnanceModal, 
    lotModal.isOpen, showClientCreateModal, showStockResolution, confirmModal
  ])

  // Produits are already filtered by the hook
  const filteredProduits = produits

  const handleLotSelect = (lot: any | null) => {
      // Update the line with the selected lot
      if (!lotModal.product) return

      updateLineLot(lotModal.product.id, lot)

      closeLotModal()
      
      // Return focus to search
      setTimeout(() => searchInputRef.current?.focus(), 100)
  }





  // Reset loyalty when client changes or new sale starts
  useEffect(() => {
    setPointsToUse(0)
    setUsePendingDiscount(false)
  }, [selectedClient, isNewSale])

  const handleCompleteSale = async (sudoCredentials?: { validatorId: number, password: string }) => {
    // Collect all data for the hook
    const effectiveSudo = sudoCredentials || activeSudoCreds;

    const params = {
        selectedClient,
        useManualClient,
        manualClientName,
        clients,
        selectedAyantDroit,
        ayantDroitNom,
        ayantDroitMatricule,
        ayantDroitSociete,
        ayantsDroitList,
        showNewAyantDroit,
        lignesFacture,
        totals: {
            totalHt: totals.sousTotal,
            totalTva: totals.totalTva,
            totalTtc: totals.totalTtc,
            remiseMontant: totals.remiseMontant,
            tauxCouverture: totals.tauxCouverture,
            partPatient: totals.partPatient,
            partAssurance: totals.partAssurance
        },
        modePaiement,
        montantPaye,
        paiements,
        reference,
        couponNumero: '', // To be implemented if needed
        usePendingDiscount,
        pointsToUse,
        isRetrocession,
        centralizedCashRegister,
        isModificationMode,
        devisIdToValidate: null,
        tempOrdonnanceData,
        // Sudo Mode - pass the operator selected during line edits or stock force
        validated_by_id: effectiveSudo?.validatorId || null,
        sudo_password: effectiveSudo?.password || undefined,
        modificationInvoiceId: modificationInvoiceId
    };

    await completeSale(params);
  };

  // Helper pour vider les données de vente sans fermer les modals de succès éventuels
  const _resetSaleDataOnly = () => {
      setLignesFacture([])
      setClientSearch('')
      setManualClientName('')
      setSelectedClient(null)
      setActiveSudoCreds(null)
      // Auto-select "clients divers" after a sale
      const clientsDivers = clients.find(c => c.name.toLowerCase() === 'clients divers')
      setSelectedClient(clientsDivers ? clientsDivers.id : null)
      setUseManualClient(false)
      setManualClientName('')
      setRemiseGlobale('0')
      setRemiseMode('montant')
      setAyantDroitNom('')
      setAyantDroitMatricule('')
      setAyantDroitSociete('')
      setSelectedAyantDroit(null)
      setShowNewAyantDroit(false)
      setShowNewAyantDroit(false)
      setSearchQuery('')
      setTempOrdonnanceData(null) // Clear temp data
      // On ne clear pas error/successInfo ici si on veut les garder
  }
  const handleQuantityShortcut = useCallback((qty: number) => {
    if (lignesFacture.length > 0) {
      const lastLine = lignesFacture[lignesFacture.length - 1];
      secureUpdateQuantite(lastLine.produit.id, qty);
      toast.success(`Quantité mise à jour : ${qty} x ${lastLine.produit.name}`, { icon: '🔢' });
    } else {
      toast.error("Aucun produit dans le panier pour appliquer une quantité");
    }
  }, [lignesFacture, updateQuantite]);

  const handleOrdonnanceSave = async (data: OrdonnanceData) => {

    
    // Toujours enregistrer immédiatement dans l'API
    setLoading(true);
    try {
        const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/ordonnancier/` : '/api/ordonnancier/';
        
        // Transformer les lignes pour le format backend
        const lignesForBackend = data.lignes.map(ligne => ({
          produit: ligne.produit_id,
          produit_nom: ligne.produit_nom,
          quantite: ligne.quantite,
          surveillance_category: ligne.surveillance_category
        }));
        
        const payload = {
            patient_nom: data.patient_nom,
            prescripteur_nom: data.prescripteur_nom,
            facture: pendingOrdonnanceFacture?.id || null, // Lier à la facture si disponible
            lignes: lignesForBackend
        };
        

        
        await axios.post(endpoint, payload);

        
        toast.success("Enregistré dans l'ordonnancier");
        setShowOrdonnanceModal(false);
        setPendingOrdonnanceFacture(null);
        // Ne pas reset les données de vente ici, juste fermer le modal
    } catch (err: any) {
        console.error("=== ERREUR ORDONNANCIER ===");
        console.error("Error object:", err);
        console.error("Response status:", err.response?.status);
        console.error("Response data:", err.response?.data);
        toast.error("Erreur lors de l'enregistrement de l'ordonnance: " + (err.response?.data?.detail || err.message));
    } finally {
        setLoading(false);
    }
  };

  // Function to handle Proforma generation
  const handleProforma = async () => {
    if (lignesFacture.length === 0) return
    
    setLoading(true)
    try {
      // 1. Create Facture as Proforma
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const factureProduitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/facture-produits/` : '/api/facture-produits/'
      
      // Prepare payload
      const facturePayload = {
        client: useManualClient ? null : selectedClient,
        client_name_override: useManualClient ? manualClientName : null,
        remise: totals.remiseMontant.toString(),
        tva: '0',
        status: 'PROF',
        ayant_droit: selectedAyantDroit,
        part_client: (selectedClient && clients.find(c => c.id === selectedClient)?.client_type === 'PROFESSIONNEL' && totals.tauxCouverture > 0) ? totals.partPatient : null
      }
      
      const { data: createdFacture } = await axios.post(facturesEndpoint, facturePayload)
      
      // 2. Add Products
      const produitsPayload = lignesFacture.map(ligne => {
        const prixUnitaire = Number(ligne.prix_unitaire)
        const remiseProduit = Number(ligne.remise_produit)
        const prixNet = prixUnitaire * (1 - remiseProduit / 100)
        
        return {
          facture: createdFacture.id,
          produit: ligne.produit.id,
          quantity: Number(ligne.quantite),
          selling_price: prixNet.toString(),
          discount: (prixUnitaire - prixNet).toFixed(2),
          stock_lot: ligne.lotId ? Number(ligne.lotId) : null,
          lot: null,
          date_expiration: ligne.produit.expire_date || null,
        }
      })
      
      await Promise.all(
        produitsPayload.map(payload => axios.post(factureProduitsEndpoint, payload))
      )
      
      // 3. Open Print Window (Frontend)
      try {
          // Allow some time for backend to process if needed, or just open immediately since we have ID
          window.open(`/app/print-invoice/${createdFacture.id}`, '_blank')
          toast.success("Proforma généré avec succès")
      } catch (err) {
          console.error("Erreur ouverture impression:", err)
      }
      
      // 4. Reset Cart
      setLignesFacture([])
      setMontantPaye('')
      setModePaiement('especes')
      setPaiements([{ mode: 'especes', montant: 0 }])
      setSelectedClient(null)
      setManualClientName('')
      setTicketCaisse(null)
      
    } catch (error) {
      console.error("Erreur lors de la génération du proforma:", error)
      toast.error("Erreur lors de la création du proforma")
    } finally {
      setLoading(false)
    }
  }

  const handleImprimerFacture = async (facture: Facture) => {
    if (!facture) {
      setError("Aucune facture à imprimer.");
      return;
    }

    try {
      if (facture.id) {
          window.open(`/app/print-invoice/${facture.id}`, '_blank')
      }
    } catch (err) {
      handleApiError(err, "Erreur lors de l'impression de la facture")
    }
  }



  const ouvrirModalPaiement = (facture?: Facture) => {
    if (facture) {
      // Paiement d'une facture existante
      setMontantPaye(Math.round(Number(facture.total_ttc)).toString())
      openPaymentModal(facture)
    } else {
      // Nouvelle vente (Encaisser)
      if (!selectedClient) {
        setError('Veuillez sélectionner un client')
        return
      }
      if (lignesFacture.length === 0) {
        setError('Veuillez ajouter au moins un produit')
        return
      }
      setMontantPaye(Math.round(totals.totalTtc).toString())
      openPaymentModal()
    }
    setModePaiement('especes')
    setReference('')
    setPaiements([]) // Reset paiements list
    
    // Focus sur le montant après un court délai pour laisser la modale s'ouvrir
    setTimeout(() => {
        paymentInputRef.current?.focus()
        paymentInputRef.current?.select()
    }, 100)
  }

  // === PENDING SALES MANAGEMENT ===

  const mettreEnAttente = () => {
    // Validate
    if (lignesFacture.length === 0) {
      setError('Impossible de mettre en attente une vente vide')
      return
    }
    if (ventesEnAttente.length >= 4) {
      setError('Maximum 4 ventes en attente atteint')
      return
    }

    const clientName = !useManualClient && selectedClient 
        ? clients.find(c => c.id === selectedClient)?.name || ''
        : manualClientName
    
    const ayantDroitData = selectedAyantDroit || showNewAyantDroit || ayantDroitNom ? {
        id: selectedAyantDroit,
        nom: ayantDroitNom,
        matricule: ayantDroitMatricule,
        societe: ayantDroitSociete,
        showNew: showNewAyantDroit
    } : null

    savePendingSale({
        client: useManualClient ? null : selectedClient,
        clientName,
        useManualClient,
        manualClientName,
        lignes: lignesFacture,
        remise: remiseGlobale,
        remiseMode,
        ayantDroit: ayantDroitData
    })
    
    // Réinitialiser la vente actuelle
    _resetSale()
    
    toast.success('Vente mise en attente')
  }

  const annulerVente = () => {
    if (lignesFacture.length > 0) {
      setConfirmModal({
          isOpen: true,
          message: 'Êtes-vous sûr de vouloir annuler cette vente en cours ? Tout le panier sera perdu.',
          onConfirm: () => _resetSale()
      })
      return
    }
    _resetSale()
  }

  const _resetSale = () => {
    // Clear everything
    setLignesFacture([])
    // Auto-select "clients divers" after reset
    const clientsDivers = clients.find(c => c.name.toLowerCase() === 'clients divers')
    setSelectedClient(clientsDivers ? clientsDivers.id : null)
    setUseManualClient(false)
    setManualClientName('')
    
    resetUIState()

    setAyantDroitNom('')
    setAyantDroitMatricule('')
    setAyantDroitSociete('')
    setSelectedAyantDroit(null)
    setShowNewAyantDroit(false)
    setShowNewAyantDroit(false)
    setSearchQuery('')
    setError(null)
    setTempOrdonnanceData(null)
    
    searchInputRef.current?.focus()
  }

  const restaurerVente = (id: number) => {
      const vente = ventesEnAttente.find(v => v.id === id)
      if (!vente) return

      // Si le panier actuel n'est pas vide, confirmer l'écrasement
      if (lignesFacture.length > 0) {
          if (!window.confirm('Le panier actuel n\'est pas vide. Voulez-vous le remplacer par la vente en attente ?')) {
              return
          }
      }

      setLignesFacture(vente.lignes)
      setUseManualClient(vente.useManualClient)
      setManualClientName(vente.manualClientName)
      setRemiseGlobale(vente.remise)
      setRemiseMode(vente.remiseMode)
      
      if (vente.client) {
          setSelectedClient(vente.client)
      } else {
          setSelectedClient(null)
      }
      
      // Restaurer ayant droit
      if (vente.ayantDroit) {
          setSelectedAyantDroit(vente.ayantDroit.id)
          setAyantDroitNom(vente.ayantDroit.nom)
          setAyantDroitMatricule(vente.ayantDroit.matricule)
          setAyantDroitSociete(vente.ayantDroit.societe)
          setShowNewAyantDroit(vente.ayantDroit.showNew)
      }

      deletePendingSale(id)
      setShowPendingSales(false)
      toast.success('Vente restaurée')
  }

  const supprimerVenteEnAttente = (id: number) => {
     setConfirmModal({
        isOpen: true,
        message: "Voulez-vous vraiment supprimer cette vente en attente ?",
        onConfirm: () => {
             deletePendingSale(id);
             setConfirmModal(null);
             toast.success("Vente en attente supprimée");
        }
     });
  }

  // Global Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if inside an input/textarea UNLESS it's a specific shortcut key
      
      if (e.key === 'F2') {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      
      if (e.key === 'F4') {
         e.preventDefault()
         clientSelectRef.current?.focus()
         return
      }
      
      if (e.key === 'F9') {
        e.preventDefault()
        if (!isPaymentModalOpen && lignesFacture.length > 0 && selectedClient) {
           ouvrirModalPaiement()
        }
        return
      }
      
      if (e.key === 'Escape') {
        if (isPaymentModalOpen) {
           closePaymentModal()
        } else if (showTicketPreview) {
            setShowTicketPreview(false)
        } else if (successInfo) {
            setSuccessInfo(null)
        } else {
           setSearchQuery('')
           searchInputRef.current?.blur()
        }
        return
      }

      // Alt+Z: Toggle Zenith Mode
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        toggleZenithMode()
        return
      }

      // /: Focus search input
      if (e.key === '/') {
          e.preventDefault()
          searchInputRef.current?.focus()
          return
      }

    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedClient, useManualClient, isPaymentModalOpen, showTicketPreview, successInfo, showStockResolution, showPendingSales, showClientCreateModal, showOrdonnanceModal, lignesFacture.length, handlePaymentClick, toggleZenithMode])

  return (
    <div className="h-full flex flex-col bg-base-100 font-sans text-base-content overflow-hidden">
      {/* Header Minimaliste */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-base-200 bg-white dark:bg-slate-900 shrink-0 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2 sm:gap-4">
          <h1 className="text-lg sm:text-2xl font-bold text-base-content uppercase tracking-tight truncate max-w-[120px] sm:max-w-none">{t('facturation.title')}</h1>
          
          <div className="flex items-center gap-1 sm:gap-2 border-l border-base-200 dark:border-slate-700 pl-2 sm:pl-4 ml-1 sm:ml-2">
            {/* Zenith Mode Toggle */}
            <button 
                onClick={toggleZenithMode}
                className={`btn btn-circle btn-sm ${isZenithMode ? 'btn-primary' : 'btn-ghost'}`}
                title={isZenithMode ? "Quitter Mode Zenith" : "Mode Zenith (Alt+Z)"}
            >
                {isZenithMode ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>

            {/* Midnight Theme Toggle */}
            <button 
                onClick={toggleMidnightTheme}
                className={`btn btn-circle btn-sm ${isMidnightTheme ? 'btn-secondary text-white' : 'btn-ghost'}`}
                title={isMidnightTheme ? "Thème Clair" : "Thème Midnight"}
            >
                {isMidnightTheme ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <div className="text-[10px] sm:text-sm font-medium text-base-content/60">
            {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </div>
          <div className="flex gap-2 sm:gap-4 text-[8px] sm:text-[10px] text-base-content/40 mt-1 uppercase font-bold tracking-tight">
            <span className="flex items-center gap-0.5 sm:gap-1"><kbd className="kbd kbd-xs py-0 h-3 sm:h-4 font-sans">/</kbd> <span className="hidden xs:inline">{t('facturation.shortcuts.search')}</span></span>
            <span className="flex items-center gap-0.5 sm:gap-1"><kbd className="kbd kbd-xs py-0 h-3 sm:h-4 font-sans">F9</kbd> <span className="hidden xs:inline">{t('facturation.shortcuts.pay')}</span></span>
          </div>
        </div>
      </div>

      {/* Modification Mode Banner */}
      {isModificationMode && modificationInvoiceId && (
        <div className="alert alert-warning shadow-lg mx-3 md:mx-4 lg:mx-6 mt-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <h3 className="font-bold">{t('facturation.modification_mode.title')}</h3>
            <div className="text-xs flex flex-wrap gap-4">
              <span>{t('facturation.modification_mode.original_total')}: <strong>{Math.round(originalTotalTtc).toLocaleString('fr-FR')} F</strong></span>
              <span>{t('facturation.modification_mode.new_total')}: <strong>{Math.round(totals.totalTtc).toLocaleString('fr-FR')} F</strong></span>
              {totals.totalTtc !== originalTotalTtc && (
                <span className={totals.totalTtc > originalTotalTtc ? 'text-success font-bold' : 'text-error font-bold'}>
                  {t('facturation.modification_mode.difference')}: {totals.totalTtc > originalTotalTtc ? '+' : ''}{Math.round(totals.totalTtc - originalTotalTtc).toLocaleString('fr-FR')} F
                  {totals.totalTtc > originalTotalTtc ? ` (${t('facturation.modification_mode.to_collect')})` : ` (${t('facturation.modification_mode.to_refund')})`}
                </span>
              )}
            </div>
          </div>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setIsModificationMode(false)
              setModificationInvoiceId(null)
              setOriginalTotalTtc(0)
              setLignesFacture([])
              toast(t('facturation.modification_mode.cancelled'), { icon: '✖️' })
            }}
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {/* Notifications */}
      {/* Notifications (Toasts) */}
      {(error || successInfo) && (
        <div className="toast toast-top toast-end z-[100] mt-16 mr-4">
          {error && (
            <div role="alert" className="alert alert-error shadow-lg max-w-md animate-in fade-in slide-in-from-right-5 duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <h3 className="font-bold">{t('common.error')}</h3>
                <div className="text-xs">{error}</div>
              </div>
              <button className="btn btn-sm btn-ghost btn-circle" onClick={() => setError(null)}>✕</button>
            </div>
          )}

          {successInfo && (
            <div role="alert" className="alert alert-success shadow-lg max-w-lg flex-col items-start gap-2 animate-in fade-in slide-in-from-right-5 duration-300">
              <div className="flex items-center gap-2 w-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div className="flex-1">
                  <h3 className="font-bold">{t('facturation.sale_recorded')} !</h3>
                  <div className="text-xs">{t('facturation.invoice')} <span className="font-mono font-bold">{successInfo.numero_facture}</span> • {Math.round(Number(successInfo.total_ttc))} F</div>
                </div>
                <button className="btn btn-sm btn-ghost btn-circle self-start" onClick={() => setSuccessInfo(null)}>✕</button>
              </div>

              <div className="flex flex-wrap gap-2 w-full justify-end mt-1">
                {successInfo.status !== 'PAY' && (
                  <button className="btn btn-sm btn-primary" onClick={() => ouvrirModalPaiement(successInfo)}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                    </svg>
                    {t('common.pay')}
                  </button>
                )}
                {successInfo.status === 'PAY' && ticketCaisse && (
                  <button className="btn btn-sm btn-info text-white" onClick={() => setShowTicketPreview(true)}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v4.072c.421.424.688 1.006.688 1.653 0 .647-.267 1.23-.688 1.653v4.072c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-4.072c-.421-.424-.688-1.006-.688-1.653 0-.647.267-1.23.688-1.653V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                    </svg>
                    {t('common.ticket')}
                  </button>
                )}
                <button className="btn btn-sm btn-outline" onClick={() => handleImprimerFacture(successInfo)}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                  </svg>
                  A4
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex flex-col overflow-y-auto sm:overflow-hidden p-2 sm:p-4 lg:p-6 gap-3 sm:gap-4 lg:gap-6">
        {/* Top Section: Client & Search */}
        <div className="w-full flex flex-col md:flex-row gap-4 shrink-0">
          {/* Client Selection */}
          <ClientSection
            inputRef={clientSearchRef}
            clients={clients}
            filteredClients={filteredClients}
            useManualClient={useManualClient}
            setUseManualClient={setUseManualClient}
            manualClientName={manualClientName}
            setManualClientName={setManualClientName}
            selectedClient={selectedClient}
            setSelectedClient={setSelectedClient}
            clientSearch={clientSearch}
            setClientSearch={setClientSearch}
            showClientDropdown={showClientDropdown}
            setShowClientDropdown={setShowClientDropdown}
            onOpenCreateClient={(initialName) => {
              setNewClientForm(prev => ({ ...prev, name: initialName }))
              setShowClientCreateModal(true)
            }}
            ayantsDroitList={ayantsDroitList}
            selectedAyantDroit={selectedAyantDroit}
            setSelectedAyantDroit={setSelectedAyantDroit}
            showNewAyantDroit={showNewAyantDroit}
            setShowNewAyantDroit={setShowNewAyantDroit}
            ayantDroitNom={ayantDroitNom}
            setAyantDroitNom={setAyantDroitNom}
            ayantDroitMatricule={ayantDroitMatricule}
            setAyantDroitMatricule={setAyantDroitMatricule}
            ayantDroitSociete={ayantDroitSociete}
            setAyantDroitSociete={setAyantDroitSociete}
            onEnter={() => searchInputRef.current?.focus()}
          />

          {/* Product Search */}
          <ProductSearchSection
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchLoading={searchLoading}
            filteredProduits={filteredProduits}
            addProduitToFacture={(p) => addProduitToFacture(p, { isRetrocession })}
            addPackToFacture={addPackToFacture}
            searchInputRef={searchInputRef}
            placeholder={t('facturation.search_placeholder')}
            onQuantityShortcut={handleQuantityShortcut}
          />
        </div>

        {/* Bottom Section: Cart/Invoice Details */}
        <div className="flex-none sm:flex-1 flex flex-col min-h-[400px] sm:min-h-0 bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden shrink-0 sm:shrink">
          
          {/* Clinical Alerts Banner */}
          <ClinicalAlerts alerts={clinicalAlerts} />

          <div className="p-4 border-b border-base-100 flex justify-between items-center shrink-0">
            <h2 className="font-bold text-lg text-base-content">{t('facturation.cart_title')}</h2>
            <div className="badge badge-ghost font-mono">{lignesFacture.length} {t('facturation.items_count', { count: lignesFacture.length })}</div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <CartTable
              lignesFacture={lignesFacture}
              updateQuantite={secureUpdateQuantite}
              updatePrix={secureUpdatePrix}
              updateRemiseProduit={secureUpdateRemiseProduit}
              removeLigne={removeLigne}
              onOpenLotModal={(product, currentLotId) => openLotModal(product, currentLotId || null)}
              quantityInputsRef={quantityInputsRef}
              onReturnFocus={() => searchInputRef.current?.focus()}
              selectedIndex={selectedIndex}
              onSelectLine={setSelectedIndex}
            />
          </div>

          {/* Footer Totals */}
          <TotalsSection
            totalHT={totals.sousTotal}
            remiseGlobale={remiseGlobale}
            setRemiseGlobale={setRemiseGlobale}
            remiseMode={remiseMode}
            setRemiseMode={setRemiseMode}
            remiseMontant={totals.remiseMontant}
            tvaAmount={totals.totalTva}
            totalTTC={totals.totalTtc}
            tauxCouverture={totals.tauxCouverture}
            partAssurance={totals.partAssurance}
            partPatient={totals.partPatient}
            onOpenOrdonnanceModal={() => setShowOrdonnanceModal(true)}
            ordonnanceData={tempOrdonnanceData}
          />

          {/* Action Buttons */}
          <ActionButtons
            onPayment={handlePaymentClick}
            onProforma={handleProforma}
            onSuspend={mettreEnAttente}
            onViewPending={() => setShowPendingSales(true)}
            pendingCount={ventesEnAttente.length}
            onCancel={annulerVente}
            isValid={lignesFacture.length > 0}
            isRetrocession={isRetrocession}
            setIsRetrocession={setIsRetrocession}
          />
        </div>
      </div>

      {isPaymentModalOpen && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={closePaymentModal}
          loading={saleLoading || loading}
          facturePourPaiement={facturePourPaiement}
          isNewSale={isNewSale}
          totals={totals}
          montantPaye={montantPaye}
          setMontantPaye={setMontantPaye}
          modePaiement={modePaiement}
          setModePaiement={setModePaiement}
          paiements={paiements}
          setPaiements={setPaiements}
          onCompleteSale={handleCompleteSale}
          onRegisterPayment={async () => {
             if (facturePourPaiement) {
                 await completeExistingInvoicePayment({
                    facture: facturePourPaiement,
                    paiements,
                    montantPaye,
                    modePaiement,
                    reference,
                    lignesFacture,
                    tempOrdonnanceData
                 })
             }
          }}
          selectedClient={selectedClient}
          useManualClient={useManualClient}
          paymentInputRef={paymentInputRef}
        />
      )}

      {/* Ticket Preview Modal */}
      <TicketPreviewModal
        isOpen={showTicketPreview}
        onClose={() => setShowTicketPreview(false)}
        ticket={ticketCaisse}
        settings={pharmacySettings}
      />

      {/* Stock Resolution Modal */}
      {/* Stock Resolution Handler (replaces Modal) */}
      <StockResolutionHandler
        isOpen={showStockResolution}
        onClose={() => setShowStockResolution(false)}
        stockResolutionItems={stockResolutionItems}
        promisSelections={promisSelections}
        setPromisSelections={setPromisSelections}
        promisPhone={promisPhone}
        setPromisPhone={setPromisPhone}
        promisClientName={promisClientName}
        setPromisClientName={setPromisClientName}
        lignesFacture={lignesFacture}
        setLignesFacture={setLignesFacture as any}
        clients={clients}
        selectedClient={selectedClient}
        setSelectedClient={setSelectedClient}
        useManualClient={useManualClient}
        setUseManualClient={setUseManualClient}
        setManualClientName={setManualClientName}
        onComplete={handlePaymentClickWithSudo}
    />

      {/* Pending Sales Drawer */}
      <PendingSalesDrawer
        isOpen={showPendingSales}
        onClose={() => setShowPendingSales(false)}
        ventesEnAttente={ventesEnAttente}
        onRestore={restaurerVente}
        onDelete={supprimerVenteEnAttente}
      />

      {/* Confirmation Modal */}

      {/* Confirmation Modal */}
      <dialog className={`modal ${confirmModal?.isOpen ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg text-warning">⚠️ {t('common.confirmation')}</h3>
          <p className="py-4">{confirmModal?.message}</p>
          <div className="modal-action">
            <button className="btn" onClick={() => setConfirmModal(null)}>{t('common.cancel')}</button>
            <button
              className="btn btn-error"
              onClick={() => {
                if (confirmModal?.onConfirm) confirmModal.onConfirm();
                setConfirmModal(null);
              }}
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop" onClick={() => setConfirmModal(null)}><button>close</button></form>
      </dialog>
      {/* Lot Selection Modal */}
      {lotModal.isOpen && (
        <LotSelectionModal
          isOpen={lotModal.isOpen}
          onClose={closeLotModal}
          produit={lotModal.product}
          onSelectLot={handleLotSelect}
          currentLotId={lotModal.currentLotId}
        />
      )}

      {/* Client Creation Modal */}
      <ClientCreateModal
        isOpen={showClientCreateModal}
        onClose={() => setShowClientCreateModal(false)}
        newClientForm={newClientForm}
        setNewClientForm={setNewClientForm}
        isCreatingClient={isCreatingClient}
        handleCreateClient={handleCreateClient}
      />

      {/* Ordonnance Modal */}
      {showOrdonnanceModal && (
          <OrdonnanceModal
              isOpen={showOrdonnanceModal}
              onClose={() => {
                  setShowOrdonnanceModal(false)
                  setPendingOrdonnanceFacture(null)
              }}
              onSave={handleOrdonnanceSave}
              facture={pendingOrdonnanceFacture}
              lignes={lignesFacture}
              loading={loading}
          />
      )}

      {/* Sudo Validation Modal */}
      <SudoValidationModal
        isOpen={sudoState.isOpen}
        onClose={closeSudo}
        onValidate={sudoState.onValidate}
        saving={false}
        title={sudoState.title || "Validation Requise"}
        message={sudoState.message || ""}
      />
    </div>
  )
}
