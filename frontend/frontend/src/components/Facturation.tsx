import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import axios from 'axios'
import DOMPurify from 'dompurify'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import type { ProduitModel, Client, Facture, TicketCaisse, AyantDroit, Promis, LigneFacture } from '../types'
import { useProductSearch } from '../hooks/useProductSearch'
import { useCart } from '../hooks/useCart'
import { useFacturationClients } from '../hooks/useFacturationClients'
import { usePendingSales } from '../hooks/usePendingSales'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import { normalizeNumberInput } from '../utils/formatters'
import LotSelectionModal from './LotSelectionModal'
import PaymentModal from './facturation/PaymentModal'
import CartTable from './facturation/CartTable'
import ClientSection from './facturation/ClientSection'
import ProductSearchSection from './facturation/ProductSearchSection'
import TotalsSection from './facturation/TotalsSection'
import ActionButtons from './facturation/ActionButtons'
import OrdonnanceModal, { type OrdonnanceData } from './OrdonnanceModal'
import { TicketTemplate } from './printing/TicketTemplate'

// Lazy load barcode component (kept if needed elsewhere, otherwise remove)
const Barcode = lazy(() => import('react-barcode'))



type FactureProduitPayload = {
  facture: number
  produit: number
  quantity: number
  selling_price: string
  discount?: string // NEW
  lot?: string | null
  date_expiration: string | null
}





export default function Facturation() {
  const { user } = useAuth()
  const { settings: pharmacySettings } = usePharmacySettings()
  
  // Local loading state for non-hook operations (e.g. payment)
  const [loading, setLoading] = useState(false)
  const [isRetrocession, setIsRetrocession] = useState(false)

  // Refs - declared early for hook usage
  const quantityInputsRef = useRef<Map<number, HTMLInputElement>>(new Map())
  
  // Ref for barcode callback (to avoid hook ordering issues)
  const addProductRef = useRef<((product: ProduitModel, options?: { isRetrocession?: boolean }) => void) | null>(null)

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
      clearCart,
      cartStats,
      loading: cartLoading
  } = useCart({
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
      onRequirePrescription: handleRequirePrescription,
      quantityInputsRef
  })
  
  // Keep ref updated with latest addProduit function
  addProductRef.current = addProduitToFacture

  // Use product search hook with barcode scan auto-add
  const handleBarcodeMatch = useCallback((product: ProduitModel) => {
      // Auto-add scanned product to cart via ref
      if (addProductRef.current) {
        addProductRef.current(product, { isRetrocession })
        toast.success(`✅ ${product.name} ajouté (scan)`, { duration: 1500 })
      }
  }, [isRetrocession])

  // Use product search hook with barcode scan auto-add
  const { 
    produits, 
    loading: searchLoading, 
    searchQuery, 
    setSearchQuery,
    wasBarcodeScanned
  } = useProductSearch({ 
    minSearchLength: 2, 
    debounceMs: 200,
    onBarcodeMatch: handleBarcodeMatch
  })

  // useFacturationClients Hook - Manages all client/AD logic
  const {
    clients,
    loading: clientsLoading,
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

  // Combined loading state
  const isLoading = loading || cartLoading || clientsLoading || searchLoading



  const [remise, setRemise] = useState('0')
  const [remiseMode, setRemiseMode] = useState<'montant' | 'taux'>('montant') // Mode de remise globale
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<Facture | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [modePaiement, setModePaiement] = useState<'especes' | 'cheque' | 'carte' | 'virement' | 'en_compte'>('especes')
  const [montantPaye, setMontantPaye] = useState('')
  const [paiements, setPaiements] = useState<{ mode: string; montant: number; part_patient?: number | null; part_assurance?: number | null }[]>([])
  const [reference, setReference] = useState('')
  const [facturePourPaiement, setFacturePourPaiement] = useState<Facture | null>(null)
  const [ticketCaisse, setTicketCaisse] = useState<TicketCaisse | null>(null)
  const [showTicketPreview, setShowTicketPreview] = useState(false)


  // Lot Selection Modal State
  const [lotModal, setLotModal] = useState<{
    isOpen: boolean
    product: ProduitModel | null
    currentLotId: string | null
  }>({
    isOpen: false,
    product: null,
    currentLotId: null
  })

  // Promis Logic State - Deferred Resolution
  const [showStockResolution, setShowStockResolution] = useState(false)
  const [stockResolutionItems, setStockResolutionItems] = useState<{product: ProduitModel, quantity: number, stock: number}[]>([])
  const [promisSelections, setPromisSelections] = useState<Set<number>>(new Set())
  const [promisPhone, setPromisPhone] = useState('')

  // Ordonnancier Temporary Data Storage
  const [tempOrdonnanceData, setTempOrdonnanceData] = useState<OrdonnanceData | null>(null)

  // Loyalty State
  const [pointsToUse, setPointsToUse] = useState(0)
  const [usePendingDiscount, setUsePendingDiscount] = useState(false)

  // Ordonnancier State
  const [showOrdonnanceModal, setShowOrdonnanceModal] = useState(false)
  const [pendingOrdonnanceFacture, setPendingOrdonnanceFacture] = useState<Facture | null>(null)

  // Settings State - Mode Caisse Centralisée
  const [centralizedCashRegister, setCentralizedCashRegister] = useState<boolean>(true)

  // Devis to validate (when loading from Ventes)
  const [devisIdToValidate, setDevisIdToValidate] = useState<number | null>(null)
  
  // Modification mode (for validated/paid invoices)
  const [isModificationMode, setIsModificationMode] = useState(false)
  const [modificationInvoiceId, setModificationInvoiceId] = useState<number | null>(null)
  const [originalTotalTtc, setOriginalTotalTtc] = useState<number>(0)

  // Router Location State Handling (Reload from CaisseCentralisee)
  const location = useLocation()
  const [hasProcessedReload, setHasProcessedReload] = useState(false)
  
  useEffect(() => {
    if (location.state && location.state.mode === 'edit_reload' && !loading && !hasProcessedReload) {
        const { cartData, client, remise: remiseState } = location.state
        
        // Restore Client
        if (client && client.id) {
            setSelectedClient(client.id)
        }
        
        // Restore Remise
        if (remiseState) {
            setRemise(remiseState)
        }

        // Restore Cart
        if (cartData && Array.isArray(cartData)) {
            const restoredLignes: LigneFacture[] = cartData.map((item: any) => ({
                produit: {
                    id: item.id,
                    name: item.name,
                    selling_price: item.price,
                    is_stock: true,
                    stock: item.stock || 9999,
                    cip: item.cip || '',
                    tva: item.tva || 0
                } as unknown as ProduitModel,
                quantite: Number(item.quantity),
                prix_unitaire: item.price,
                remise_produit: item.discount || '0',
                total_ligne: Number(item.quantity) * Number(item.price) * (1 - (Number(item.discount || 0) / 100)) 
            }))
            
            setLignesFacture(restoredLignes)
            toast.success('Facture rechargée pour modification')
            
            // Clear state and mark as processed
            window.history.replaceState({}, document.title)
            setHasProcessedReload(true)
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, hasProcessedReload])

  // Retrocession Mode Effect - Dynamic Price Update
  useEffect(() => {
    if (lignesFacture.length > 0) {
      setLignesFacture(prevLignes => prevLignes.map(ligne => {
        let newPrice = '0'
        
        if (isRetrocession) {
            // Mode Retrocession: Utiliser Last Purchase Price ou Cost Price
            const lastPurchase = ligne.produit.last_purchase_price
            const costPrice = ligne.produit.cost_price?.toString()
            newPrice = lastPurchase ? String(lastPurchase) : (costPrice ? costPrice : '0')
        } else {
            // Mode Standard: Revenir au Selling Price
            newPrice = ligne.produit.selling_price ? String(ligne.produit.selling_price) : '0'
        }

        return {
          ...ligne,
          prix_unitaire: newPrice,
          total_ligne: Number(newPrice) * Number(ligne.quantite) * (1 - Number(ligne.remise_produit) / 100)
        }
      }))
      
      if (isRetrocession) {
          toast('Mode Rétrocession: Prix mis à jour (Prix Achat)', { icon: '🔄', id: 'retro-price-update' })
      } else {
          toast('Mode Standard: Prix rétablis', { icon: '🔄', id: 'retro-price-update' })
      }
    }
  }, [isRetrocession])



  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const clientSelectRef = useRef<HTMLSelectElement>(null)

  const paymentInputRef = useRef<HTMLInputElement>(null)
  // quantityInputsRef declared earlier (before useCart)

  // usePendingSales Hook
  const {
      ventesEnAttente,
      showPendingSales,
      setShowPendingSales,
      savePendingSale,
      deletePendingSale
  } = usePendingSales()
  
  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (successInfo && successInfo.status !== 'PAY') {
      setMontantPaye(Math.round(Number(successInfo.total_ttc)).toString())
    }
  }, [successInfo])

  // Charger un devis depuis localStorage si présent (navigation depuis Ventes)
  useEffect(() => {
    const loadDevis = async () => {
      const devisString = localStorage.getItem('devis_to_load')
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
          setRemise(devis.remise)
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
        
        // Nettoyer le localStorage
        localStorage.removeItem('devis_to_load')
      } catch (err) {
        console.error('Erreur lors du chargement du devis:', err)
        toast.error('Impossible de charger le devis')
        localStorage.removeItem('devis_to_load')
      }
    }
    
    loadDevis()
  }, [])

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : ''
  }, [])
  // produitsEndpoint removed - products are loaded via useProductSearch hook
  const clientsEndpoint = apiBaseUrl
    ? `${apiBaseUrl}/api/clients/`
    : '/api/clients/'

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
      setRemise(client.remise_automatique)
      setRemiseMode('taux') // La remise automatique est toujours en pourcentage
    }
  }, [selectedClient, clients, useManualClient])



  const handleStockResolutionConfirm = () => {
      // Apply Promis selections to the invoice lines
      const updatedLignes = lignesFacture.map(ligne => {
          if (promisSelections.has(ligne.produit.id)) {
              const stock = ligne.produit.stock ?? 0
              const promisQty = Math.max(0, ligne.quantite - stock)
              return {
                  ...ligne,
                  isPromis: true,
                  promisQuantity: promisQty,
                  promisPhone: promisPhone || undefined
              }
          } else {
              // Forced sale (or normal if stock came back?)
              // If user didn't select Promis, acts as Force Sale for the deficit
              return {
                  ...ligne,
                  isPromis: false,
                  promisQuantity: 0,
                  promisPhone: undefined
              }
          }
      })
      setLignesFacture(updatedLignes)
      setShowStockResolution(false)
      setIsNewSale(true)
      setIsPaymentModalOpen(true)
  }

  const handlePaymentClick = () => {
      // Check for out-of-stock items before payment
      if (!user?.can_sell_negative_stock) {
         // If user CANNOT sell negative stock, they MUST handle it.
         // Effectively, they must use Promis or remove items.
         // For now, we reuse the resolution modal but maybe enforce checks?
         // The requirement says "tous forcage de stock n'est pas promis".
         // Use existing logic for resolution.
      }

      const problematicLines = lignesFacture.filter(l =>
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

          // Pre-select phone if available
          const client = clients.find(c => c.id === selectedClient)
          setPromisPhone(client?.phone || '')

          // By default, do NOT select Promis (Force) - User must opt-in
          setPromisSelections(new Set())

          setShowStockResolution(true)
      } else {
          setIsNewSale(true)
          // Auto-fill montant with total to pay (Part Patient if Tiers Payant, else Total TTC)
          const montantInitial = (totals.tauxCouverture > 0) ? totals.partPatient : totals.totalTtc
          setMontantPaye(Math.round(montantInitial).toString())
          setIsPaymentModalOpen(true)
      }
  }

  // Produits are already filtered by the hook
  const filteredProduits = produits

  const handleLotSelect = (lot: any | null) => {
      // Update the line with the selected lot
      if (!lotModal.product) return

      updateLineLot(lotModal.product.id, lot)

      setLotModal({ isOpen: false, product: null, currentLotId: null })
      
      // Return focus to search
      setTimeout(() => searchInputRef.current?.focus(), 100)
  }




  const totals = useMemo(() => {
    // Sous-total via hook useCart
    const sousTotal = cartStats.sousTotal
    
    // Calculer la remise globale selon le mode
    let remiseMontant = 0
    if (remiseMode === 'montant') {
      remiseMontant = Math.min(sousTotal, normalizeNumberInput(remise, { min: 0 }))
    } else {
      // Mode taux (pourcentage)
      const tauxRemise = normalizeNumberInput(remise, { min: 0, max: 100 })
      remiseMontant = sousTotal * (tauxRemise / 100)
    }
    
    // TVA calculée par ligne (depuis cartStats)
    const montantTva = cartStats.totalTva
    const baseHT = sousTotal - remiseMontant
    const totalTtcBase = baseHT + montantTva

    // Calcul tiers payant
    let tauxCouverture = 0
    let partAssurance = 0
    let partPatient = totalTtcBase
    
    let currentPoints = 0
    let pendingDiscountVal = 0
    
    if (!useManualClient && selectedClient) {
      const client = clients.find(c => c.id === selectedClient)
      
      if (client?.client_type === 'PROFESSIONNEL' && client.taux_couverture !== undefined && client.taux_couverture !== null) {
        tauxCouverture = normalizeNumberInput(client.taux_couverture, { min: 0, max: 100 })
        if (tauxCouverture > 0) {
          partAssurance = Math.round(totalTtcBase * (tauxCouverture / 100))
          partPatient = totalTtcBase - partAssurance
        }
      }
      // Loyalty Data
      if (client && client.client_type !== 'PROFESSIONNEL' && (client as any).is_loyalty_member) {
          currentPoints = (client as any).points_fidelite || 0
          pendingDiscountVal = Number((client as any).pending_discount || 0)
      }
    }
    
    // Loyalty Calculations
    let loyaltyDeduction = 0
    const pointsValue = pointsToUse * 10 // Est. 10F/point
    if (usePendingDiscount && pendingDiscountVal > 0) {
        loyaltyDeduction += totalTtcBase * (pendingDiscountVal / 100)
    }
    loyaltyDeduction += pointsValue
    
    const finalTotalTtc = Math.max(0, totalTtcBase - loyaltyDeduction)
    const finalPartPatient = Math.max(0, partPatient - loyaltyDeduction)

    return {
      sousTotal,
      remiseMontant,
      montantTva,
      totalTtc: finalTotalTtc,
      originalTotalTtc: totalTtcBase,
      loyaltyDeduction,
      tauxCouverture,
      partAssurance,
      partPatient: finalPartPatient,
      currentPoints,
      pendingDiscountVal
    }
  }, [lignesFacture, remise, remiseMode, selectedClient, useManualClient, clients, pointsToUse, usePendingDiscount])

  const [isNewSale, setIsNewSale] = useState(false)

  // Reset loyalty when client changes or new sale starts
  useEffect(() => {
    setPointsToUse(0)
    setUsePendingDiscount(false)
  }, [selectedClient, isNewSale])

  const handleCompleteSale = async () => {
    if (!selectedClient) {
      setError('Veuillez sélectionner un client')
      return
    }
    if (lignesFacture.length === 0) {
      setError('Veuillez ajouter au moins un produit')
      return
    }
    // Validation du montant
    const isTiersPayant = totals.tauxCouverture > 0 && totals.partAssurance > 0;
    const montantAttendu = isTiersPayant ? totals.partPatient : totals.totalTtc;

    if (montantAttendu > 0) {
        // On doit avoir soit un montant saisi positif, soit une liste de paiements (split) valide
        const montantSaisi = Number(montantPaye);
        const totalSplit = paiements.reduce((acc, p) => acc + p.montant, 0);
        
        if (paiements.length === 0 && (!montantPaye || montantSaisi <= 0)) {
             setError('Veuillez entrer un montant valide')
             return
        }

        // Si paiement partagé, vérifier le total
        if (paiements.length > 0) {
            // Tolérance de 1F pour les arrondis
            if (Math.abs(totalSplit - montantAttendu) > 1 && Math.abs(totalSplit + montantSaisi - montantAttendu) > 1) {
                 setError(`Le total des paiements (${totalSplit + montantSaisi} F) ne correspond pas au montant à payer (${montantAttendu} F)`)
                 return
            }
        }
    }

    // Validation pour les clients professionnels : ayant droit obligatoire
    if (!useManualClient && selectedClient) {
      const client = clients.find(c => c.id === selectedClient)
      if (client?.client_type === 'PROFESSIONNEL') {
        // Si on est en mode "nouveau ayant droit" ou qu'il n'y a pas d'ayants droit existants
        if (showNewAyantDroit || ayantsDroitList.length === 0) {
          if (!ayantDroitNom || !ayantDroitMatricule) {
            setError('Pour un client professionnel, veuillez renseigner le nom et le matricule de l\'ayant droit')
            return
          }
        }
        
        // Validation du PLAFOND DE CRÉDIT (Credit Limit Check)
        const plafond = Number(client.plafond || 0);
        if (plafond > 0) {
            const currentDebt = Number(client.current_debt || 0);
            const newTotal = currentDebt + totals.totalTtc;
            
            if (newTotal > plafond) {
                const message = `⚠️ PLAFOND DÉPASSÉ !\nDette actuelle: ${Math.round(currentDebt).toLocaleString()} F\nNouvelle facture: ${Math.round(totals.totalTtc).toLocaleString()} F\nTotal: ${Math.round(newTotal).toLocaleString()} F\nPlafond: ${Math.round(plafond).toLocaleString()} F`;
                setError(message);
                toast.error(`⚠️ Plafond crédit dépassé ! (${Math.round(plafond).toLocaleString()} F)`, { 
                  duration: 6000,
                  style: { background: '#dc2626', color: 'white', fontWeight: 'bold' }
                });
                return;
            }
        }
      }
    } else {
          // Si on est en mode "sélection existant", vérifier qu'un ayant droit est sélectionné
          if (!selectedAyantDroit) {
            setError('Pour un client professionnel, veuillez sélectionner un ayant droit ou en créer un nouveau')
            return
      }
    }




    setLoading(true)
    setError(null)
    setSuccessInfo(null)
    
    const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
    const factureProduitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/facture-produits/` : '/api/facture-produits/'
    const caisseEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/caisse/` : '/api/caisse/'

    let validatedFactureForRollback: Facture | null = null

    try {
      // 0. Préparer l'ayant droit (si nécessaire)
      let ayantDroitId = selectedAyantDroit
      const clientObj = clients.find(c => c.id === selectedClient)
      
      if (clientObj?.client_type === 'PROFESSIONNEL') {
          // Cas lecture seule ou sélectionné : déjà dans ayantDroitId
          
          // Cas création nouveau
          if (showNewAyantDroit || ayantsDroitList.length === 0) {
              if (ayantDroitNom && ayantDroitMatricule) {
                  try {
                      // Vérifier d'abord dans la liste locale si un ayant droit avec ce matricule existe
                      const existingLocal = Array.isArray(ayantsDroitList) 
                        ? ayantsDroitList.find(ad => ad.matricule === ayantDroitMatricule)
                        : null
                      
                      if (existingLocal) {
                        // Utiliser l'ayant droit existant
                        ayantDroitId = existingLocal.id || null
                        setSelectedAyantDroit(existingLocal.id || null)
                        setShowNewAyantDroit(false)
                      } else {
                        // Créer un nouveau
                        const ayantsDroitEndpoint = apiBaseUrl 
                          ? `${apiBaseUrl}/api/ayants-droit/` 
                          : '/api/ayants-droit/'
                        
                        const ayantDroitPayload = {
                          client: selectedClient,
                          nom: ayantDroitNom,
                          matricule: ayantDroitMatricule,
                          societe: ayantDroitSociete || null
                        }
                        
                        const { data: createdAyantDroit } = await axios.post<AyantDroit>(ayantsDroitEndpoint, ayantDroitPayload)
                        ayantDroitId = createdAyantDroit.id || null
                        
                        // Note: La liste sera rechargée automatiquement lors de la prochaine sélection client
                        // setAyantsDroitList(prev => Array.isArray(prev) ? [...prev, createdAyantDroit] : [createdAyantDroit])
                        setSelectedAyantDroit(createdAyantDroit.id || null)
                        setShowNewAyantDroit(false)
                      }
                  } catch (err) {
                      console.error('Erreur lors de la création de l\'ayant droit:', err)
                      throw new Error("Impossible de créer l'ayant droit. Veuillez réessayer.")
                  }
              }
          }
      }

      // === MODE MODIFICATION: Factures validées/payées ===
      if (isModificationMode && modificationInvoiceId) {
        // Préparer les données des produits pour l'endpoint modifier
        const produitsPayload = lignesFacture.map(ligne => {
          const prixUnitaire = normalizeNumberInput(ligne.prix_unitaire, { min: 0 })
          const remiseProduit = normalizeNumberInput(ligne.remise_produit, { min: 0, max: 100 })
          const prixNet = prixUnitaire * (1 - remiseProduit / 100)
          
          return {
            produit: ligne.produit.id,
            quantity: ligne.quantite,
            selling_price: prixNet.toString(),
            lot_id: ligne.lotId ? Number(ligne.lotId) : null
          }
        })
        
        // Appeler l'endpoint modifier
        const modifierEndpoint = `${facturesEndpoint}${modificationInvoiceId}/modifier/`
        const { data: modificationResult } = await axios.post(modifierEndpoint, {
          produits: produitsPayload,
          remise: totals.remiseMontant.toString(),
          client: useManualClient ? null : selectedClient,
          client_name_override: useManualClient ? manualClientName : null
        })
        
        // Afficher le résultat
        const difference = modificationResult.difference
        if (difference > 0) {
          toast.success(`Facture modifiée. Encaissement supplémentaire: ${Math.round(difference).toLocaleString('fr-FR')} F`)
        } else if (difference < 0) {
          toast.success(`Facture modifiée. Remboursement: ${Math.round(Math.abs(difference)).toLocaleString('fr-FR')} F`)
        } else {
          toast.success('Facture modifiée (même total)')
        }
        
        // Réinitialiser l'état
        setLignesFacture([])
        setSelectedClient(null)
        setUseManualClient(false)
        setManualClientName('')
        setRemise('0')
        setRemiseMode('montant')
        setIsModificationMode(false)
        setModificationInvoiceId(null)
        setOriginalTotalTtc(0)
        setIsPaymentModalOpen(false)
        setLoading(false)
        
        // Reset ayant droit state
        setAyantDroitNom('')
        setAyantDroitMatricule('')
        setAyantDroitSociete('')
        setSelectedAyantDroit(null)
        setShowNewAyantDroit(false)
        
        return // Fin du traitement en mode modification
      }

      // === FLUX NORMAL: Créer la facture OU utiliser le devis existant ===
      let createdFacture: Facture

      if (devisIdToValidate) {
        // On valide un devis existant - ne pas créer de nouvelle facture
        const { data: existingFacture } = await axios.get<Facture>(`${facturesEndpoint}${devisIdToValidate}/`)
        createdFacture = existingFacture
        
        // Reset le devisIdToValidate
        setDevisIdToValidate(null)
      } else {
        // Flux normal : créer une nouvelle facture brouillon
        const facturePayload = {
          client: useManualClient ? null : selectedClient,
          client_name_override: useManualClient ? manualClientName : null,
          remise: totals.remiseMontant.toString(),
          tva: '0',
          ayant_droit: ayantDroitId, // Lier directement à la création
          part_client: (clientObj?.client_type === 'PROFESSIONNEL' && totals.tauxCouverture > 0) ? totals.partPatient : null,
          type: isRetrocession ? 'RETRO' : 'STD' // Add Retrocession Type
        }
        const { data } = await axios.post(facturesEndpoint, facturePayload)
        createdFacture = data
      }

      // 2. Ajouter les produits (uniquement si nouvelle facture, pas pour devis existant)
      if (!devisIdToValidate) {
        const produitsPayload: FactureProduitPayload[] = lignesFacture.map(ligne => {
        // Calculer le prix unitaire net après remise produit
        const prixUnitaire = normalizeNumberInput(ligne.prix_unitaire, { min: 0 })
        const remiseProduit = normalizeNumberInput(ligne.remise_produit, { min: 0, max: 100 })
        const prixNet = prixUnitaire * (1 - remiseProduit / 100)
        
        return {
          facture: createdFacture.id,
          produit: ligne.produit.id,
          quantity: Number(ligne.quantite),
          selling_price: prixNet.toString(), // Envoyer le prix net au backend
          discount: (prixUnitaire - prixNet).toFixed(2), // Envoyer le montant de la remise par unité
          stock_lot: ligne.lotId ? Number(ligne.lotId) : null, // New field for specific lot
          lot: null, // Legacy field
          date_expiration: ligne.produit.expire_date || null,
        }
        })

        await Promise.all(
          produitsPayload.map(payload => axios.post(factureProduitsEndpoint, payload))
        )
      }


      // NOUVELLE LOGIQUE DE PAIEMENT
      // Vérifier si c'est un client professionnel avec 100% de couverture (tiers payant)
      const clientIsPro100 = clientObj?.client_type === 'PROFESSIONNEL' && totals.partPatient === 0 && totals.partAssurance > 0
      
      if (clientIsPro100) {
        // Client professionnel à 100% : Validation + Paiement automatique "en_compte"
        toast('Client professionnel 100% - Validation automatique', { icon: 'ℹ️' })
        
        // 1. Valider la facture
        const validerEndpoint = `${facturesEndpoint}${createdFacture.id}/valider/`
        const { data: validatedFacture } = await axios.post<Facture>(validerEndpoint, {
          use_pending_discount: usePendingDiscount,
          points_to_use: pointsToUse
        })
        
        // 2. Enregistrer le paiement "en_compte" (100% assurance)
        await axios.post(caisseEndpoint, {
          facture: validatedFacture.id,
          mode_paiement: 'en_compte',
          montant: totals.partAssurance,
          reference: null,
          statut: 'completee',
          part_patient: 0,
          part_assurance: totals.partAssurance
        })
        
        // 3. Succès
        toast.success(`Facture ${validatedFacture.numero_facture} validée (Tiers payant 100%)`)
        
        // Clear cart
        setLignesFacture([])
        setSelectedClient(null)
        setUseManualClient(false)
        setManualClientName('')
        setRemise('0')
        setRemiseMode('montant')
        setMontantPaye('')
        setPaiements([])
        setLoading(false)
        
        return // Fin du traitement
      } else if (centralizedCashRegister) {
        // Mode Caisse Centralisée ACTIVE : Envoi en Caisse Centralisée (BROUILLON)
        
        // Si c'est un devis/proforma, mettre à jour son statut en BROUILLON
        // pour qu'il apparaisse dans la caisse centralisée
        if (createdFacture.status === 'PROF' || createdFacture.status === 'PROFORMA') {
          await axios.patch(`${facturesEndpoint}${createdFacture.id}/`, { status: 'BROU' })
        }
        
        toast.success(`Vente envoyée à la Caisse Centralisée (Ticket #${createdFacture.id})`)
        setSuccessInfo({ ...createdFacture, status: 'BROUILLON' })
        
        // Clear cart and state without validating
        setLignesFacture([])
        setSelectedClient(null)
        setUseManualClient(false)
        setManualClientName('')
        setRemise('0')
        setRemiseMode('montant')
        setMontantPaye('')
        setPaiements([])
        setLoading(false)
        setIsPaymentModalOpen(false)
        
        return // Stop execution (Do NOT validate)
      }
      // Mode Caisse Centralisée DÉSACTIVÉE : Continuer vers le paiement direct

      // 3. Valider la facture
      // 3. Valider la facture
      const validerEndpoint = `${facturesEndpoint}${createdFacture.id}/valider/`
      const { data: validatedFacture } = await axios.post<Facture>(validerEndpoint, {
          use_pending_discount: usePendingDiscount,
          points_to_use: pointsToUse
      })
      validatedFactureForRollback = validatedFacture

      // 4. Enregistrer les paiements
      // Déterminer si on utilise le tiers payant
      const useTiersPayant = totals.tauxCouverture > 0 && totals.partAssurance > 0
      
      let paiementsList = []
      
      if (useTiersPayant) {
        // Tiers payant: créer paiements
        paiementsList = []
        
        // Part patient
        if (totals.partPatient > 0) {
            // Si des paiements multiples ont été définis (split payment)
            if (paiements.length > 0) {
                paiements.forEach(p => {
                    paiementsList.push({
                        mode: p.mode,
                        montant: p.montant,
                        part_patient: p.montant, // Tout ce qui est payé ici est pour la part patient
                        part_assurance: null
                    });
                });
                
                // Ajouter aussi le montant courant s'il reste quelque chose dans l'input
                if (montantPaye && Number(montantPaye) > 0) {
                     paiementsList.push({
                        mode: modePaiement,
                        montant: Number(montantPaye),
                        part_patient: Number(montantPaye),
                        part_assurance: null
                    });
                }
            } else {
                // Paiement unique classique
                paiementsList.push({
                    mode: modePaiement,
                    montant: totals.partPatient,
                    part_patient: totals.partPatient,
                    part_assurance: null
                })
            }
        }
        
        // Part assurance (toujours en compte)
        if (totals.partAssurance > 0) {
          paiementsList.push({
            mode: 'en_compte',
            montant: totals.partAssurance,
            part_patient: null,
            part_assurance: totals.partAssurance
          })
        }
      } else {
        // Pas de tiers payant: utiliser la liste normale + montant courant
        if (paiements.length > 0) {
            paiementsList = paiements.map(p => ({ ...p, part_patient: null, part_assurance: null }));
            if (montantPaye && Number(montantPaye) > 0) {
                paiementsList.push({ mode: modePaiement, montant: Number(montantPaye), part_patient: null, part_assurance: null });
            }
        } else {
             paiementsList = [{ mode: modePaiement, montant: Number(montantPaye), part_patient: null, part_assurance: null }];
        }
      }

      let totalVerse = 0
      const failedPayments: any[] = []
      
      // Promesse séquentielle ou parallèle pour les paiements
      await Promise.all(paiementsList.map(async (paiement) => {
          const paiementPayload: any = {
            facture: validatedFacture.id,
            mode_paiement: paiement.mode,
            montant: paiement.montant,
            reference: reference || null,
            statut: 'completee',
          }
          
          // Ajouter les champs tiers payant s'ils existent
          if (paiement.part_patient !== null && paiement.part_patient !== undefined) {
            paiementPayload.part_patient = paiement.part_patient
          }
          if (paiement.part_assurance !== null && paiement.part_assurance !== undefined) {
            paiementPayload.part_assurance = paiement.part_assurance
          }
          
          try {
            await axios.post(caisseEndpoint, paiementPayload)
            totalVerse += paiement.montant
          } catch (paymentError) {
            console.error('ERREUR CRITIQUE: Échec création paiement:', paymentError)
            console.error('Payload:', paiementPayload)
            failedPayments.push({ paiement, error: paymentError })
            // Re-throw pour déclencher le rollback
            throw new Error(`Échec enregistrement paiement ${paiement.mode}: ${paymentError}`)
          }
      }))
      
      // Vérifier qu'aucun paiement n'a échoué
      if (failedPayments.length > 0) {
        throw new Error(`${failedPayments.length} paiement(s) non enregistré(s)`)
      }

      // 5. Mettre à jour le statut de la facture à "PAYEE"
      const factureUpdateEndpoint = `${facturesEndpoint}${validatedFacture.id}/`
      await axios.patch(factureUpdateEndpoint, { status: 'PAY' })

      // 6. Récupérer la facture finale mise à jour
      const { data: finalFacture } = await axios.get<Facture>(factureUpdateEndpoint)

      // 7. Gérer les Promis (après paiement validé)
      const promisLines = lignesFacture.filter(l => l.isPromis && l.promisQuantity && l.promisQuantity > 0)
      const createdPromisIds: number[] = []

      for (const line of promisLines) {
          try {
              const promisPayload = {
                  facture: finalFacture.id,
                  client: finalFacture.client,
                  client_name: finalFacture.client_name || (useManualClient ? manualClientName : ''),
                  client_phone: line.promisPhone,
                  produit: line.produit.id,
                  quantite: line.promisQuantity,
                  status: 'ATT'
              }
              const promisEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/promis/` : '/api/promis/'
              const { data: createdPromis } = await axios.post<Promis>(promisEndpoint, promisPayload)
              
              createdPromisIds.push(createdPromis.id)
              
          } catch (err) {
              console.error("Erreur création promis:", err)
          }
      }

      // Grouped Print
      if (createdPromisIds.length > 0) {
          try {
              const printGroupEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/promis/imprimer_ticket_groupe/` : '/api/promis/imprimer_ticket_groupe/'
              
              // Trigger download/print
              await new Promise(resolve => setTimeout(resolve, 500))
              
              const response = await axios.post(printGroupEndpoint, { promis_ids: createdPromisIds }, { responseType: 'blob' })
              const url = window.URL.createObjectURL(new Blob([response.data]))
              const link = document.createElement('a')
              link.href = url
              link.setAttribute('download', `ticket_promis_groupe_${finalFacture.id}.pdf`)
              document.body.appendChild(link)
              link.click()
              link.parentNode?.removeChild(link)
          } catch (err) {
              console.error("Erreur impression ticket promis groupé:", err)
              setError("Erreur lors de l'impression du ticket Promis groupé")
          }
      }

      // 8. Finaliser
      const rendu = totalVerse - Number(finalFacture.total_ttc)

      setSuccessInfo(finalFacture)

      // trigger premium print
      window.open(`/app/print-invoice/${finalFacture.id}`, '_blank')
      
      // Get client name for ticket
      const clientName = useManualClient 
        ? manualClientName 
        : clients.find(c => c.id === selectedClient)?.name || 'Client'
      
      // Pour le ticket standard
      setTicketCaisse({
        id: 0, 
        facture: finalFacture,
        mode_paiement: paiementsList.length > 1 ? 'Mixte' : paiementsList[0].mode,
        montant: finalFacture.total_ttc,
        montant_verse: totalVerse.toString(),
        rendu: rendu.toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        statut: 'completee',
        date_paiement: new Date().toISOString(),
        client_name: clientName,
        paiements_details: paiementsList
      } as TicketCaisse)
      
      // Save ordonnancier data if it was collected earlier
      console.log('DEBUG: tempOrdonnanceData =', tempOrdonnanceData)
      if (tempOrdonnanceData) {
        console.log('DEBUG: Saving ordonnancier with', tempOrdonnanceData.lignes.length, 'lines')
        try {
          const ordonnancierEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/ordonnancier/` : '/api/ordonnancier/'
          
          // Transform lignes to match backend format (produit instead of produit_id)
          const lignesForBackend = tempOrdonnanceData.lignes.map(ligne => ({
            produit: ligne.produit_id,  // Backend expects 'produit' (ID)
            produit_nom: ligne.produit_nom,
            quantite: ligne.quantite,
            surveillance_category: ligne.surveillance_category
          }))
          
          console.log('DEBUG: lignesForBackend =', lignesForBackend)
          
          await axios.post(ordonnancierEndpoint, {
            patient_nom: tempOrdonnanceData.patient_nom,
            prescripteur_nom: tempOrdonnanceData.prescripteur_nom,
            facture: finalFacture.id,
            lignes: lignesForBackend
          })
          toast.success("Ordonnancier enregistré")
          setTempOrdonnanceData(null)
        } catch (err) {
          console.error("Erreur enregistrement ordonnancier:", err)
          toast.error("Erreur lors de l'enregistrement de l'ordonnancier")
        }
      } else {
        console.log('DEBUG: tempOrdonnanceData is null, skipping ordonnancier save')
      }
      
      // Standard Clean (ordonnancier modal already handled during product selection)
      _resetSaleDataOnly()
      setIsPaymentModalOpen(false)

    } catch (err) {
      // ROLLBACK STOCK IF NEEDED
      if (validatedFactureForRollback) {
        try {
           const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
           await axios.post(`${facturesEndpoint}${validatedFactureForRollback.id}/annuler/`, {
             motif: "Échec du paiement (Annulation automatique)"
           })
           console.log("Rollback successful: Invoice cancelled due to payment failure.")
        } catch (rollbackErr) {
           console.error("Critical: Failed to rollback invoice after payment failure", rollbackErr)
        }
      }
      handleApiError(err, 'Une erreur est survenue lors de l\'enregistrement de la vente.')
    } finally {
      setLoading(false)
    }
  }

  // Helper pour vider les données de vente sans fermer les modals de succès éventuels
  const _resetSaleDataOnly = () => {
      setLignesFacture([])
      setSelectedClient(null)
      setUseManualClient(false)
      setManualClientName('')
      setRemise('0')
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
  
  const handleOrdonnanceSave = async (data: OrdonnanceData) => {
    console.log('=== handleOrdonnanceSave DEBUG ===');
    console.log('Received data:', data);
    
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
        
        console.log('API endpoint:', endpoint);
        console.log('Payload being sent:', payload);
        
        const response = await axios.post(endpoint, payload);
        console.log('API Response:', response.data);
        
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
        const prixUnitaire = normalizeNumberInput(ligne.prix_unitaire, { min: 0 })
        const remiseProduit = normalizeNumberInput(ligne.remise_produit, { min: 0, max: 100 })
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

  const enregistrerPaiement = async (facture?: Facture) => {
    const factureAPayer = facture || facturePourPaiement
    if (!factureAPayer) {
      setError('Aucune facture sélectionnée')
      return
    }

    if (!montantPaye || Number(montantPaye) <= 0) {
      setError('Veuillez entrer un montant valide')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const caisseEndpoint = apiBaseUrl
        ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/caisse/`
        : '/api/caisse/'

      const paiementsList = paiements.length > 0 
        ? paiements 
        : [{ mode: modePaiement, montant: Number(montantPaye) }]

      let totalVerse = 0

      // Enregistrer chaque paiement
      await Promise.all(paiementsList.map(async (paiement) => {
          const paiementPayload = {
            facture: factureAPayer.id,
            mode_paiement: paiement.mode,
            montant: paiement.montant,
            reference: reference || null,
            statut: 'completee',
          }
          await axios.post(caisseEndpoint, paiementPayload)
          totalVerse += paiement.montant
      }))
      
      // Mettre à jour le statut de la facture à "PAYEE"
      const factureUpdateEndpoint = apiBaseUrl
        ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/factures/${factureAPayer.id}/`
        : `/api/factures/${factureAPayer.id}/`

      await axios.patch(factureUpdateEndpoint, { status: 'PAY' })
      
      // Rafraîchir les données de la facture
      const { data: factureUpdated } = await axios.get<Facture>(factureUpdateEndpoint)

      const rendu = totalVerse - Number(factureUpdated.total_ttc)

      setSuccessInfo(factureUpdated)

      // trigger premium print
      window.open(`/app/print-invoice/${factureUpdated.id}`, '_blank')

      // Construction ticket simulé
      setTicketCaisse({
        id: 0,
        facture: factureUpdated,
        mode_paiement: paiementsList.length > 1 ? 'Mixte' : paiementsList[0].mode,
        montant: factureUpdated.total_ttc,
        montant_verse: totalVerse.toString(),
        rendu: rendu.toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        statut: 'completee',
        date_paiement: new Date().toISOString(),
        paiements_details: paiementsList
      } as TicketCaisse)

      // Save ordonnancier data if it was collected earlier
      if (tempOrdonnanceData) {
        try {
          const ordonnancierEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/ordonnancier/` : '/api/ordonnancier/'
          
          // Transform lignes to match backend format (produit instead of produit_id)
          const lignesForBackend = tempOrdonnanceData.lignes.map(ligne => ({
            produit: ligne.produit_id,  // Backend expects 'produit' (ID)
            produit_nom: ligne.produit_nom,
            quantite: ligne.quantite,
            surveillance_category: ligne.surveillance_category
          }))
          
          await axios.post(ordonnancierEndpoint, {
            patient_nom: tempOrdonnanceData.patient_nom,
            prescripteur_nom: tempOrdonnanceData.prescripteur_nom,
            facture: factureUpdated.id,
            lignes: lignesForBackend
          })
          toast.success("Ordonnancier enregistré")
          setTempOrdonnanceData(null)
        } catch (err) {
          toast.error("Erreur lors de l'enregistrement de l'ordonnancier")
        }
      }
      
      setIsPaymentModalOpen(false)
    } catch (err) {
      handleApiError(err, "Erreur lors de l'enregistrement du paiement")
    } finally {
      setLoading(false)
    }
  }

  const ouvrirModalPaiement = (facture?: Facture) => {
    if (facture) {
      // Paiement d'une facture existante
      setFacturePourPaiement(facture)
      setMontantPaye(Math.round(Number(facture.total_ttc)).toString())
      setIsNewSale(false)
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
      setFacturePourPaiement(null)
      setMontantPaye(Math.round(totals.totalTtc).toString())
      setIsNewSale(true)
    }
    setModePaiement('especes')
    setReference('')
    setIsPaymentModalOpen(true)
    setPaiements([]) // Reset paiements list

    
    // Focus sur le montant après un court délai pour laisser la modale s'ouvrir
    setTimeout(() => {
        paymentInputRef.current?.focus()
        paymentInputRef.current?.select()
    }, 100)
  }

  // === PENDING SALES MANAGEMENT ===
  
  // Save pending sales to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('ventesEnAttente', JSON.stringify(ventesEnAttente))
  }, [ventesEnAttente])

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
        remise,
        remiseMode,
        ayantDroit: ayantDroitData
    })
    
    // Réinitialiser la vente actuelle
    setLignesFacture([])
    setSelectedClient(null)
    setUseManualClient(false)
    setManualClientName('')
    setRemise('0')
    setRemiseMode('montant')
    setMontantPaye('')
    setFacturePourPaiement(null)
    setSuccessInfo(null)
    setError(null)
    
    // Reset ayant droit
    setAyantDroitNom('')
    setAyantDroitMatricule('')
    setAyantDroitSociete('')
    setSelectedAyantDroit(null)
    setShowNewAyantDroit(false)
    
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
    setSelectedClient(null)
    setUseManualClient(false)
    setManualClientName('')
    setRemise('0')
    setRemiseMode('montant')
    setAyantDroitNom('')
    setAyantDroitMatricule('')
    setAyantDroitSociete('')
    setSelectedAyantDroit(null)
    setShowNewAyantDroit(false)
    setShowNewAyantDroit(false)
    setSearchQuery('')
    setError(null)
    setTempOrdonnanceData(null) // Clear temp data
    
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
      setRemise(vente.remise)
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
           setIsPaymentModalOpen(false)
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

    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedClient, isPaymentModalOpen, showTicketPreview, successInfo])

  return (
    <div className="h-full flex flex-col bg-base-100 font-sans text-base-content overflow-hidden">
      {/* Header Minimaliste */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-base-200 bg-white shrink-0">
        <div>
          <h1 className="text-xl font-light tracking-tight text-base-content">Facturation</h1>
          <div className="flex gap-4 text-xs text-base-content/50 mt-1">
            <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">F2</kbd> Recherche</span>
            <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">F4</kbd> Client</span>
            <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">F9</kbd> Encaisser</span>
            <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">Esc</kbd> Annuler</span>
          </div>
        </div>
        <div className="text-sm font-medium text-base-content/60">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>
      
      {/* Modification Mode Banner */}
      {isModificationMode && modificationInvoiceId && (
        <div className="alert alert-warning shadow-lg mx-3 md:mx-4 lg:mx-6 mt-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <h3 className="font-bold">Mode Modification</h3>
            <div className="text-xs flex flex-wrap gap-4">
              <span>Facture originale: <strong>{Math.round(originalTotalTtc).toLocaleString('fr-FR')} F</strong></span>
              <span>Nouveau total: <strong>{Math.round(totals.totalTtc).toLocaleString('fr-FR')} F</strong></span>
              {totals.totalTtc !== originalTotalTtc && (
                <span className={totals.totalTtc > originalTotalTtc ? 'text-success font-bold' : 'text-error font-bold'}>
                  Différence: {totals.totalTtc > originalTotalTtc ? '+' : ''}{Math.round(totals.totalTtc - originalTotalTtc).toLocaleString('fr-FR')} F
                  {totals.totalTtc > originalTotalTtc ? ' (à encaisser)' : ' (à rembourser)'}
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
              toast('Mode modification annulé', { icon: '✖️' })
            }}
          >
            Annuler
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
                <h3 className="font-bold">Erreur</h3>
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
                  <h3 className="font-bold">Vente enregistrée !</h3>
                  <div className="text-xs">Facture <span className="font-mono font-bold">{successInfo.numero_facture}</span> • {Math.round(Number(successInfo.total_ttc))} F</div>
                </div>
                <button className="btn btn-sm btn-ghost btn-circle self-start" onClick={() => setSuccessInfo(null)}>✕</button>
              </div>
              
              <div className="flex flex-wrap gap-2 w-full justify-end mt-1">
                  {successInfo.status !== 'PAY' && (
                      <button className="btn btn-sm btn-primary" onClick={() => ouvrirModalPaiement(successInfo)}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                        </svg>
                        Payer
                      </button>
                  )}
                  {successInfo.status === 'PAY' && ticketCaisse && (
                      <button className="btn btn-sm btn-info text-white" onClick={() => setShowTicketPreview(true)}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v4.072c.421.424.688 1.006.688 1.653 0 .647-.267 1.23-.688 1.653v4.072c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-4.072c-.421-.424-.688-1.006-.688-1.653 0-.647.267-1.23.688-1.653V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                        </svg>
                        Ticket
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
      <div className="flex-1 flex flex-col overflow-hidden p-3 md:p-4 lg:p-6 gap-4 lg:gap-6">
        {/* Top Section: Client & Search */}
        <div className="w-full flex flex-col md:flex-row gap-4 shrink-0">
            {/* Client Selection */}
            <ClientSection
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
            />

            {/* Product Search */}
            {/* Product Search */}
            <ProductSearchSection
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchLoading={searchLoading}
                filteredProduits={filteredProduits}
                addProduitToFacture={(p) => addProduitToFacture(p, { isRetrocession })}
                searchInputRef={searchInputRef}
            />
        </div>

        {/* Bottom Section: Cart/Invoice Details */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="p-4 border-b border-base-100 flex justify-between items-center shrink-0">
                <h2 className="font-bold text-lg text-base-content">Panier</h2>
                <div className="badge badge-ghost font-mono">{lignesFacture.length} articles</div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto">
                <CartTable 
                    lignesFacture={lignesFacture}
                    updateQuantite={updateQuantite}
                    updatePrix={updatePrix}
                    updateRemiseProduit={updateRemiseProduit}
                    removeLigne={removeLigne}
                    onOpenLotModal={(product, currentLotId) => setLotModal({
                        isOpen: true,
                        product,
                        currentLotId
                    })}
                    quantityInputsRef={quantityInputsRef}
                    onReturnFocus={() => searchInputRef.current?.focus()}
                />
            </div>

            {/* Footer Totals */}
            <TotalsSection
                totalHT={totals.sousTotal}
                remiseGlobale={remise}
                setRemiseGlobale={setRemise}
                remiseMode={remiseMode}
                setRemiseMode={setRemiseMode}
                remiseMontant={totals.remiseMontant}
                tvaAmount={totals.montantTva}
                totalTTC={totals.totalTtc}
            />

            {/* Retrocession Toggle (Near Actions) */}
            <div className="px-4 pb-2 flex justify-end">
                <div className="flex items-center space-x-2 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200">
                        <input
                        type="checkbox"
                        id="retrocession-toggle-bottom"
                        checked={isRetrocession}
                        onChange={(e) => setIsRetrocession(e.target.checked)}
                        className="checkbox checkbox-xs checkbox-warning"
                        />
                        <label htmlFor="retrocession-toggle-bottom" className="text-xs font-bold text-yellow-800 cursor-pointer select-none uppercase tracking-wide">
                            Mode Rétrocession (SUDO)
                        </label>
                </div>
            </div>

            {/* Action Buttons */}
            <ActionButtons
                onPayment={handlePaymentClick}
                onProforma={handleProforma}
                onSuspend={mettreEnAttente}
                onViewPending={() => setShowPendingSales(true)}
                pendingCount={ventesEnAttente.length}
                onCancel={() => {
                   if (window.confirm('Voulez-vous vraiment annuler cette facture ?')) {
                       annulerVente()
                   }
                }}
                isValid={lignesFacture.length > 0}
            />
        </div>
      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        loading={loading}
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
        onRegisterPayment={enregistrerPaiement}
        selectedClient={selectedClient}
        useManualClient={useManualClient}
        paymentInputRef={paymentInputRef}
      />

      {/* Modal Ticket */}
      {showTicketPreview && ticketCaisse && (
        <div className="modal modal-open">
          <div className="modal-box p-0 max-w-sm bg-white overflow-hidden">
            <div className="bg-base-50 p-3 flex justify-between items-center border-b border-base-200">
              <h3 className="font-bold text-lg">Ticket de Caisse</h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setShowTicketPreview(false)}>✕</button>
            </div>
            
            <div className="max-h-[70vh] overflow-y-auto bg-gray-50 flex justify-center py-4" id="ticket-preview-container">
               <div id="ticket-preview">
                  <TicketTemplate ticket={ticketCaisse} settings={pharmacySettings} />
               </div>
            </div>
            
            <div className="p-3 bg-base-50 border-t border-base-200 flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTicketPreview(false)}>Fermer (Esc)</button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const content = DOMPurify.sanitize(document.getElementById('ticket-preview')?.innerHTML || '');
                  const win = window.open('', '', 'height=600,width=400');
                  if (win && content) {
                    win.document.write('<html><head><title>Ticket</title>');
                    win.document.write('<style>@media print { @page { margin: 0; size: 80mm auto; } body { margin: 0; padding: 0; } } body { margin: 0; padding: 0; background: white; }</style>');
                    win.document.write('</head><body>');
                    win.document.write(content);
                    win.document.write('</body></html>');
                    win.document.close();
                    win.focus();
                    setTimeout(() => {
                        win.print();
                        win.close();
                    }, 250);
                  }
                }}
              >
                Imprimer
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowTicketPreview(false)}></div>
        </div>
      )}

      {/* Promis / Force Stock Modal */}
      {/* Stock Resolution Modal (Promis vs Force) */}
      <dialog className={`modal ${showStockResolution ? 'modal-open' : ''}`}>
        <div className="modal-box w-[600px] max-w-full">
            <h3 className="font-bold text-lg text-warning">Résolution des Stocks Insuffisants</h3>
            <div className="py-4">
                 <div className="alert alert-warning text-sm py-2 mb-4">
                     <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                     <span>
                        Certains articles dépassent le stock disponible. Veuillez indiquer lesquels sont des "Promis" (Reliquats à livrer).
                        Les articles non cochés seront forcés en stock négatif.
                     </span>
                 </div>

                 <div className="overflow-x-auto">
                     <table className="table table-compact w-full">
                         <thead>
                             <tr>
                                 <th>Produit</th>
                                 <th className="text-right">Demande</th>
                                 <th className="text-right">Stock</th>
                                 <th className="text-right">Manquant</th>
                                 <th className="text-center">Promis ?</th>
                             </tr>
                         </thead>
                         <tbody>
                             {stockResolutionItems.map((item, _) => {
                                 const manquant = Math.max(0, item.quantity - item.stock)
                                 const isSelected = promisSelections.has(item.product.id)
                                 
                                 return (
                                     <tr key={item.product.id}>
                                         <td className="font-medium">{item.product.name}</td>
                                         <td className="text-right font-bold">{item.quantity}</td>
                                         <td className="text-right">{item.stock}</td>
                                         <td className="text-right text-error font-bold">{manquant}</td>
                                         <td className="text-center">
                                             <input 
                                                 type="checkbox" 
                                                 className="checkbox checkbox-warning"
                                                 checked={isSelected}
                                                 onChange={(e) => {
                                                     const newSet = new Set(promisSelections)
                                                     if (e.target.checked) newSet.add(item.product.id)
                                                     else newSet.delete(item.product.id)
                                                     setPromisSelections(newSet)
                                                 }}
                                             />
                                         </td>
                                     </tr>
                                 )
                             })}
                         </tbody>
                     </table>
                 </div>

                 <div className="form-control w-full mt-4">
                    <label className="label">
                        <span className="label-text">Téléphone Client (pour ticket Promis)</span>
                    </label>
                    <input
                        type="text"
                        value={promisPhone}
                        onChange={(e) => setPromisPhone(e.target.value)}
                        placeholder="Numéro de téléphone..."
                        className="input input-bordered w-full"
                    />
                </div>
            </div>
            
            <div className="modal-action flex justify-between">
                <button className="btn btn-ghost" onClick={() => setShowStockResolution(false)}>Annuler et Modifier Panier</button>
                <button 
                    className="btn btn-primary"
                    onClick={handleStockResolutionConfirm}
                >
                    Valider et Encaisser
                </button>
            </div>
        </div>
      </dialog>

      {/* Pending Sales Drawer */}
      {showPendingSales && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Ventes en Attente</h3>
              <button onClick={() => setShowPendingSales(false)} className="btn btn-sm btn-circle btn-ghost">✕</button>
            </div>

            {ventesEnAttente.length === 0 ? (
              <div className="text-center py-8 text-base-content/40">
                Aucune vente en attente
              </div>
            ) : (
              <div className="space-y-3">
                {ventesEnAttente.map((vente, idx) => {
                  const total = vente.lignes.reduce((sum, ligne) => sum + ligne.total_ligne, 0)
                  const remiseMontant = vente.remiseMode === 'montant' 
                    ? parseFloat(vente.remise) 
                    : total * (parseFloat(vente.remise) / 100)
                  const totalNet = total - remiseMontant

                  return (
                    <div key={vente.id} className="card bg-base-100 border border-base-200 shadow-sm">
                      <div className="card-body p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="badge badge-info badge-sm">#{idx + 1}</div>
                              <span className="font-semibold">
                                {vente.clientName || vente.manualClientName || 'Client non spécifié'}
                              </span>
                            </div>
                            <div className="text-sm text-base-content/60 space-y-1">
                              <div>{vente.lignes.length} article{vente.lignes.length > 1 ? 's' : ''}</div>
                              <div className="font-medium text-primary">{Math.round(totalNet)} FCFA</div>
                              <div className="text-xs opacity-50">
                                {new Date(vente.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button 
                              onClick={() => restaurerVente(vente.id)}
                              className="btn btn-primary btn-sm"
                            >
                              Restaurer
                            </button>
                            <button 
                              onClick={() => supprimerVenteEnAttente(vente.id)}
                              className="btn btn-error btn-outline btn-sm"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div className="modal-backdrop" onClick={() => setShowPendingSales(false)}></div>
        </div>
      )}

      {/* Confirmation Modal */}
      <dialog className={`modal ${confirmModal?.isOpen ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg text-warning">⚠️ Confirmation</h3>
          <p className="py-4">{confirmModal?.message}</p>
          <div className="modal-action">
            <button className="btn" onClick={() => setConfirmModal(null)}>Annuler</button>
            <button 
                className="btn btn-error" 
                onClick={() => { 
                    if (confirmModal?.onConfirm) confirmModal.onConfirm(); 
                    setConfirmModal(null); 
                }}
            >
                Confirmer
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop" onClick={() => setConfirmModal(null)}><button>close</button></form>
      </dialog>
      {/* Lot Selection Modal */}
      {lotModal.isOpen && (
        <LotSelectionModal 
            isOpen={lotModal.isOpen}
            onClose={() => setLotModal({ ...lotModal, isOpen: false })}
            produit={lotModal.product}
            onSelectLot={handleLotSelect}
            currentLotId={lotModal.currentLotId}
        />
      )}

      {/* Modal Création Client */}
      {showClientCreateModal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              ➕ Nouveau Client
              <span className="badge badge-sm badge-primary">{newClientForm.client_type}</span>
            </h3>
            
            <form onSubmit={handleCreateClient} className="space-y-4">
              {/* Type de client */}
              <div className="flex gap-4">
                <label className="label cursor-pointer gap-2">
                  <input 
                    type="radio" 
                    className="radio radio-primary radio-sm" 
                    checked={newClientForm.client_type === 'PARTICULIER'}
                    onChange={() => setNewClientForm(prev => ({ ...prev, client_type: 'PARTICULIER' }))}
                  />
                  <span className="label-text">Particulier</span>
                </label>
                <label className="label cursor-pointer gap-2">
                  <input 
                    type="radio" 
                    className="radio radio-secondary radio-sm" 
                    checked={newClientForm.client_type === 'PROFESSIONNEL'}
                    onChange={() => setNewClientForm(prev => ({ ...prev, client_type: 'PROFESSIONNEL' }))}
                  />
                  <span className="label-text">Professionnel</span>
                </label>
              </div>

              {/* Infos de base */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs">Nom *</span></label>
                  <input 
                    type="text" 
                    value={newClientForm.name} 
                    onChange={e => setNewClientForm(prev => ({ ...prev, name: e.target.value }))}
                    className="input input-bordered input-sm w-full" 
                    placeholder="Nom complet" 
                    required 
                    />
                </div>
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs">Téléphone *</span></label>
                  <input 
                    type="tel" 
                    value={newClientForm.phone} 
                    onChange={e => setNewClientForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="input input-bordered input-sm w-full" 
                    placeholder="0612345678" 
                    required 
                    />
                </div>
              </div>
              
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Email *</span></label>
                <input 
                  type="email" 
                  value={newClientForm.email} 
                  onChange={e => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
                  className="input input-bordered input-sm w-full" 
                  placeholder="email@exemple.com" 
                  required 
                  />
              </div>

              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Adresse *</span></label>
                <textarea 
                  value={newClientForm.address} 
                  onChange={e => setNewClientForm(prev => ({ ...prev, address: e.target.value }))}
                  className="textarea textarea-bordered textarea-sm w-full h-16 resize-none" 
                  placeholder="Adresse complète" 
                  required 
                  />
              </div>

              {/* Champs professionnels */}
              {newClientForm.client_type === 'PROFESSIONNEL' && (
                <div className="bg-base-200 p-3 rounded-lg space-y-3">
                  <h4 className="text-sm font-bold text-secondary">Options professionnelles</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-control">
                      <label className="label py-1"><span className="label-text text-xs">Plafond crédit</span></label>
                      <input 
                        type="number" 
                        value={newClientForm.plafond} 
                        onChange={e => setNewClientForm(prev => ({ ...prev, plafond: e.target.value }))}
                        className="input input-bordered input-sm w-full" 
                        min="0"
                        />
                    </div>
                    <div className="form-control">
                      <label className="label py-1"><span className="label-text text-xs">Couverture (%)</span></label>
                      <input 
                        type="number" 
                        value={newClientForm.taux_couverture} 
                        onChange={e => setNewClientForm(prev => ({ ...prev, taux_couverture: e.target.value }))}
                        className="input input-bordered input-sm w-full" 
                        min="0" 
                        max="100"
                        />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="modal-action mt-6">
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  onClick={() => setShowClientCreateModal(false)}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary gap-2"
                  disabled={isCreatingClient}
                >
                  {isCreatingClient ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                      <> Créer et sélectionner</>
                  )}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop" onClick={() => setShowClientCreateModal(false)}>
            <button>close</button>
          </form>
        </dialog>
      )}

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
    </div>
  )
}
