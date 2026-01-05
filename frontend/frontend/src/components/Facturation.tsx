import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import type { ProduitModel, Client, Facture, TicketCaisse, AyantDroit, Promis } from '../types'
import { useSearchNavigation } from '../hooks/useSearchNavigation'
import { useProductSearch } from '../hooks/useProductSearch'
import LotSelectionModal from './LotSelectionModal'
import PaymentModal from './facturation/PaymentModal'

// Lazy load barcode component
const Barcode = lazy(() => import('react-barcode'))

// Interface locale pour la gestion des lignes de facture dans le state
type LigneFacture = {
  produit: ProduitModel
  quantite: number
  prix_unitaire: string
  remise_produit: string // Remise en pourcentage pour ce produit
  total_ligne: number
  isPromis?: boolean
  promisQuantity?: number
  promisPhone?: string
  lotId?: string | null // Specific lot ID or null for Auto/FEFO
  lotText?: string | null // For display
  lotExpiration?: string | null // Display expiration for selected lot
}

type FactureProduitPayload = {
  facture: number
  produit: number
  quantity: number
  selling_price: string
  discount?: string // NEW
  lot?: string | null
  date_expiration: string | null
}

type VenteEnAttente = {
  id: number
  timestamp: number
  client: number | null
  clientName: string | null
  useManualClient: boolean
  manualClientName: string
  lignes: LigneFacture[]
  remise: string
  remiseMode: 'montant' | 'taux'
  ayantDroit: {
    id: number | null
    nom: string
    matricule: string
    societe: string
    showNew: boolean
  } | null
}

const normalizeNumberInput = (value: string | number, options?: { min?: number; max?: number }) => {
  let parsedValue: number
  
  if (typeof value === 'number') {
    parsedValue = value
  } else {
    // Remplacer la virgule par un point pour le format décimal
    parsedValue = Number(value.toString().replace(',', '.'))
  }

  if (!Number.isFinite(parsedValue)) {
    parsedValue = 0
  }

  if (options?.min !== undefined) {
    parsedValue = Math.max(options.min, parsedValue)
  }

  if (options?.max !== undefined) {
    parsedValue = Math.min(options.max, parsedValue)
  }

  return parsedValue
}

export default function Facturation() {
  const { user } = useAuth()
  
  // Use product search hook
  const { 
    produits, 
    loading: searchLoading, 
    searchQuery, 
    setSearchQuery 
  } = useProductSearch({ minSearchLength: 2, debounceMs: 200 })
  
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<number | null>(null)
  const [manualClientName, setManualClientName] = useState('') // Nom client saisi manuellement
  const [useManualClient, setUseManualClient] = useState(false) // Toggle entre select et input
  const [lignesFacture, setLignesFacture] = useState<LigneFacture[]>([])
  const [loading, setLoading] = useState(false)
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

  // Ayant Droit states
  const [ayantDroitNom, setAyantDroitNom] = useState('')
  const [ayantDroitMatricule, setAyantDroitMatricule] = useState('')
  const [ayantDroitSociete, setAyantDroitSociete] = useState('')
  const [selectedAyantDroit, setSelectedAyantDroit] = useState<number | null>(null)
  const [ayantsDroitList, setAyantsDroitList] = useState<AyantDroit[]>([])
  const [showNewAyantDroit, setShowNewAyantDroit] = useState(false)

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

  // Loyalty State
  const [pointsToUse, setPointsToUse] = useState(0)
  const [usePendingDiscount, setUsePendingDiscount] = useState(false)

  // Settings State - Mode Caisse Centralisée
  const [centralizedCashRegister, setCentralizedCashRegister] = useState<boolean>(true)

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



  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const clientSelectRef = useRef<HTMLSelectElement>(null)
  const productListRef = useRef<HTMLDivElement>(null)
  const paymentInputRef = useRef<HTMLInputElement>(null)
  const quantityInputsRef = useRef<Map<number, HTMLInputElement>>(new Map())

  // Pending Sales Management - Initialize from localStorage to prevent data loss on navigation
  const [ventesEnAttente, setVentesEnAttente] = useState<VenteEnAttente[]>(() => {
    try {
      const saved = localStorage.getItem('ventesEnAttente')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [showPendingSales, setShowPendingSales] = useState(false)
  
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Only load clients, not all products (too many!)
        const clientsRes = await axios.get(clientsEndpoint)
        const clientsData: any = clientsRes.data;
        setClients(Array.isArray(clientsData) ? clientsData : (clientsData.results || []))
        
        // Sélectionner "Clients divers" par défaut
        const allClients = Array.isArray(clientsData) ? clientsData : (clientsData.results || []);
        const defaultClient = allClients.find((c: Client) => c.name.toLowerCase() === 'clients divers')
        if (defaultClient) {
          setSelectedClient(defaultClient.id)
        }

        // Charger les paramètres de facturation (mode caisse centralisée)
        try {
          const settingsEndpoint = apiBaseUrl
            ? `${apiBaseUrl}/api/invoice-settings/`
            : '/api/invoice-settings/'
          const settingsRes = await axios.get(settingsEndpoint)
          setCentralizedCashRegister(settingsRes.data?.centralized_cash_register ?? true)
        } catch (settingsErr) {
          console.warn('Impossible de charger les paramètres de facturation, mode caisse centralisée activé par défaut')
        }
      } catch (err) {
        handleApiError(err, 'Erreur lors du chargement des données.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [clientsEndpoint, apiBaseUrl, handleApiError])

  // Charger les ayants droit quand un client professionnel est sélectionné
  useEffect(() => {
    const fetchAyantsDroit = async () => {
      if (!selectedClient || useManualClient) {
        setAyantsDroitList([])
        setSelectedAyantDroit(null)
        setShowNewAyantDroit(false)
        return
      }

      const client = clients.find(c => c.id === selectedClient)
      if (client?.client_type === 'PROFESSIONNEL') {
        try {
          const ayantsDroitEndpoint = apiBaseUrl
            ? `${apiBaseUrl}/api/ayants-droit/?client=${selectedClient}`
            : `/api/ayants-droit/?client=${selectedClient}`
          const response = await axios.get(ayantsDroitEndpoint)
          const ayantsDroitData: any = response.data
          setAyantsDroitList(Array.isArray(ayantsDroitData) ? ayantsDroitData : (ayantsDroitData.results || []))
        } catch (err) {
          console.error('Erreur lors du chargement des ayants droit:', err)
          setAyantsDroitList([])
        }
      } else {
        setAyantsDroitList([])
        setSelectedAyantDroit(null)
        setShowNewAyantDroit(false)
      }
    }
    fetchAyantsDroit()
  }, [selectedClient, clients, apiBaseUrl, useManualClient])

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

  // Fonction pour calculer le total d'une ligne avec remise produit
  const calculateLigneTotal = (quantite: number, prixUnitaire: string, remiseProduit: string): number => {
    const qty = quantite
    const prix = normalizeNumberInput(prixUnitaire, { min: 0 })
    const remise = normalizeNumberInput(remiseProduit, { min: 0, max: 100 })
    const sousTotal = qty * prix
    const montantRemise = Math.abs(sousTotal) * (remise / 100)
    // Si la quantité est négative (retour), la remise doit aussi être soustraite pour un crédit net
    return sousTotal - (sousTotal < 0 ? -montantRemise : montantRemise)
  }

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
          // Auto-fill montant with total to pay
          setMontantPaye(Math.round(totals.totalTtc).toString())
          setIsPaymentModalOpen(true)
      }
  }

  const addProduitToFacture = async (produit: ProduitModel) => {
    setLoading(true)
    try {
      const produitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/produits/` : '/api/produits/'
      const { data: fullProduit } = await axios.get<ProduitModel>(`${produitsEndpoint}${produit.id}/`)
      
      const existingLigne = lignesFacture.find(ligne => ligne.produit.id === fullProduit.id)

      if (existingLigne) {
        // Pour les quantités positives, vérifier le stock
        const nouvelleQuantite = existingLigne.quantite + 1
        
        // Pour les quantités positives, ajouter simplement
        const updatedLignes = lignesFacture.map(ligne =>
          ligne.produit.id === fullProduit.id
            ? {
                ...ligne,
                quantite: nouvelleQuantite,
                total_ligne: calculateLigneTotal(nouvelleQuantite, ligne.prix_unitaire, ligne.remise_produit),
              }
            : ligne
        )
        setLignesFacture(updatedLignes)
      } else {
        // Pour un nouveau produit
        const prixUnitaire = normalizeNumberInput(fullProduit.selling_price ?? '0', { min: 0 })
        const nouvelleLigne: LigneFacture = {
          produit: fullProduit,
          quantite: 1,
          prix_unitaire: prixUnitaire.toString(),
          remise_produit: '0',
          total_ligne: prixUnitaire,
          lotId: null, // Default to Auto/FEFO
          lotText: null,
          lotExpiration: null
        }
        setLignesFacture([...lignesFacture, nouvelleLigne])
        
        // Focus on quantity field of the newly added product
        setTimeout(() => {
          const qtyInput = quantityInputsRef.current.get(fullProduit.id)
          if (qtyInput) {
            qtyInput.focus()
            qtyInput.select()
          }
        }, 50)
      }
      
      // Clear search after adding for better UX
      setSearchQuery('')
    } catch (err) {
      console.error('Erreur lors du chargement des détails du produit:', err)
      toast.error('Impossible de charger les détails complets du produit')
    } finally {
      setLoading(false)
    }
  }

  // Produits are already filtered by the hook
  const filteredProduits = produits


  // Use search navigation hook (after addProduitToFacture is defined)
  const { handleKeyDown: handleSearchKeyDown, getItemProps } = useSearchNavigation(
    filteredProduits,
    addProduitToFacture,
    { resetOnSelect: true, searchInputRef }
  )

  const updateQuantite = (produitId: number, quantite: number) => {
    // Permettre les quantités négatives (retours) et positives (ventes)
    const normalizedQuantite = Math.floor(normalizeNumberInput(quantite))

    // Si vide ou 0, mettre 1 par défaut au lieu de supprimer
    const finalQuantite = normalizedQuantite === 0 ? 1 : normalizedQuantite

    
    // Vérifier les permissions pour les retours (quantité négative)
    if (finalQuantite < 0 && !user?.can_do_returns) {
      setError("Vous n'avez pas la permission d'effectuer des retours (quantités négatives).")
      return
    }

    // Vérifier le stock pour les quantités positives (ventes) - Deferred check
    // Logic moved to handlePaymentClick
    
    
    const updatedLignes = lignesFacture.map(ligne => 
      ligne.produit.id === produitId
        ? { 
            ...ligne, 
            quantite: finalQuantite, 
            total_ligne: calculateLigneTotal(finalQuantite, ligne.prix_unitaire, ligne.remise_produit),
            // Clear promis if stock is sufficient
            isPromis: undefined,
            promisQuantity: undefined,
            promisPhone: undefined
          }
        : ligne
    )
    setLignesFacture(updatedLignes)
  }

  const updatePrix = (produitId: number, prix: string) => {
    const updatedLignes = lignesFacture.map(ligne => 
      ligne.produit.id === produitId 
        ? { ...ligne, prix_unitaire: prix, total_ligne: calculateLigneTotal(ligne.quantite, prix, ligne.remise_produit) }
        : ligne
    )
    setLignesFacture(updatedLignes)
  }

  const updateRemiseProduit = (produitId: number, remise: string) => {
    const updatedLignes = lignesFacture.map(ligne => 
      ligne.produit.id === produitId 
        ? { ...ligne, remise_produit: remise, total_ligne: calculateLigneTotal(ligne.quantite, ligne.prix_unitaire, remise) }
        : ligne
    )
    setLignesFacture(updatedLignes)
  }




  const handleLotSelect = (lot: any | null) => {
      // Update the line with the selected lot
      if (!lotModal.product) return

      const updatedLignes = lignesFacture.map(ligne => 
        ligne.produit.id === lotModal.product!.id
          ? { 
              ...ligne, 
              lotId: lot ? String(lot.id) : null,
              lotText: lot ? lot.lot : null,
              lotExpiration: lot?.date_expiration || null,
              // Update price if lot has a specific selling price (check for !== null/undefined, not truthy)
              prix_unitaire: (lot && lot.selling_price !== null && lot.selling_price !== undefined) 
                  ? String(lot.selling_price) 
                  : ligne.prix_unitaire,
              // Recalculate total with new price
              total_ligne: calculateLigneTotal(
                  ligne.quantite, 
                  (lot && lot.selling_price !== null && lot.selling_price !== undefined) 
                      ? String(lot.selling_price) 
                      : ligne.prix_unitaire, 
                  ligne.remise_produit
              )
            }
          : ligne
      )
      setLignesFacture(updatedLignes)
      setLotModal({ isOpen: false, product: null, currentLotId: null })
      
      // Return focus to search
      setTimeout(() => searchInputRef.current?.focus(), 100)
  }


  const removeLigne = (produitId: number) => {
    setLignesFacture(lignesFacture.filter(ligne => ligne.produit.id !== produitId))
  }

  const totals = useMemo(() => {
    // Sous-total après remises produits (peut être négatif si retours > ventes)
    const sousTotal = lignesFacture.reduce((total, ligne) => {
      const valeurLigne = typeof ligne.total_ligne === 'number' ? ligne.total_ligne : Number(ligne.total_ligne)
      return total + (Number.isFinite(valeurLigne) ? valeurLigne : 0)
    }, 0)
    
    // Calculer la remise globale selon le mode
    let remiseMontant = 0
    if (remiseMode === 'montant') {
      remiseMontant = Math.min(sousTotal, normalizeNumberInput(remise, { min: 0 }))
    } else {
      // Mode taux (pourcentage)
      const tauxRemise = normalizeNumberInput(remise, { min: 0, max: 100 })
      remiseMontant = sousTotal * (tauxRemise / 100)
    }
    
    const tvaRate = 0
    const baseHT = sousTotal - remiseMontant
    const montantTva = Math.round(baseHT * (tvaRate / 100))
    const totalTtcBase = baseHT + montantTva

    // Calcul tiers payant
    let tauxCouverture = 0
    let partAssurance = 0
    let partPatient = totalTtcBase
    
    let currentPoints = 0
    let pendingDiscountVal = 0
    
    if (!useManualClient && selectedClient) {
      const client = clients.find(c => c.id === selectedClient)
      if (client?.client_type === 'PROFESSIONNEL' && client.taux_couverture) {
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
            const newTotal = currentDebt + totals.totalTtc; // Using totalTtc (amount to be paid/invoiced)
            
            if (newTotal > plafond) {
                // Warning - user can still proceed if backend allows, but we should warn
                // If backend strictly blocks, we should probably block here too or at least warn loudly.
                // The implementation plan says "warn". Backend blocks. So we should probably block or confirm.
                // Let's simple block for now as backend returns 400.
                setError(`Le plafond de crédit (${plafond} F) serait dépassé. Dette: ${currentDebt} + Nouveau: ${Math.round(totals.totalTtc)} = ${Math.round(newTotal)}`);
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
                        
                        // Mettre à jour la liste locale
                        setAyantsDroitList(prev => Array.isArray(prev) ? [...prev, createdAyantDroit] : [createdAyantDroit])
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

      // 1. Créer la facture en mode brouillon AVEC l'ayant droit
      const facturePayload = {
        client: useManualClient ? null : selectedClient,
        client_name_override: useManualClient ? manualClientName : null,
        remise: totals.remiseMontant.toString(),
        tva: '0',
        ayant_droit: ayantDroitId, // Lier directement à la création
        part_client: (clientObj?.client_type === 'PROFESSIONNEL' && totals.tauxCouverture > 0) ? totals.partPatient : null
      }
      const { data: createdFacture } = await axios.post(facturesEndpoint, facturePayload)

      // 2. Ajouter les produits à la facture
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
      
      // Get client name for ticket
      const clientName = useManualClient 
        ? manualClientName 
        : clients.find(c => c.id === selectedClient)?.name || 'Client'
      
      // Pour le ticket, on prend le premier paiement comme référence principale ou on adapte le ticket
      // Note: Le backend renvoie un TicketCaisse par paiement, ici on en a plusieurs.
      // On va simuler un objet TicketCaisse agrégé pour l'affichage
      setTicketCaisse({
        id: 0, // Placeholder
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
      
      setLignesFacture([])
      setSelectedClient(null)
      setRemise('0')
      // Reset ayant droit fields
      setAyantDroitNom('')
      setAyantDroitMatricule('')
      setAyantDroitSociete('')
      setSelectedAyantDroit(null)
      setShowNewAyantDroit(false)
      fermerModalPaiement()
      
      // Products are managed by search hook, will be updated on next search

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

  const handleImprimerFacture = async (facture: Facture) => {
    if (!facture) {
      setError("Aucune facture à imprimer.");
      return;
    }

    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const imprimerEndpoint = `${facturesEndpoint}${facture.id}/imprimer_facture/`;
      const response = await axios.get(imprimerEndpoint, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `facture_${facture.numero_facture}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
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
      
      fermerModalPaiement()
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

  const fermerModalPaiement = () => {
    setIsPaymentModalOpen(false)
    setFacturePourPaiement(null)
    setMontantPaye('')
    setPaiements([])
    setReference('')
    setModePaiement('especes')
    setIsNewSale(false)
    
    // Retourner le focus à la recherche
    setTimeout(() => {
        searchInputRef.current?.focus()
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

    // Get client name
    const clientName = useManualClient 
      ? manualClientName 
      : clients.find(c => c.id === selectedClient)?.name || null

    // Create pending sale
    const vente: VenteEnAttente = {
      id: Date.now(),
      timestamp: Date.now(),
      client: selectedClient,
      clientName,
      useManualClient,
      manualClientName,
      lignes: [...lignesFacture],
      remise,
      remiseMode,
      ayantDroit: ayantsDroitList.length > 0 || showNewAyantDroit ? {
        id: selectedAyantDroit,
        nom: ayantDroitNom,
        matricule: ayantDroitMatricule,
        societe: ayantDroitSociete,
        showNew: showNewAyantDroit
      } : null
    }

    // Add to pending sales
    setVentesEnAttente(prev => [...prev, vente])

    // Clear current sale
    setLignesFacture([])
    setSelectedClient(null)
    setUseManualClient(false)
    setManualClientName ('')
    setRemise('0')
    setRemiseMode('montant')
    setAyantDroitNom('')
    setAyantDroitMatricule('')
    setAyantDroitSociete('')
    setSelectedAyantDroit(null)
    setShowNewAyantDroit(false)
    setSearchQuery('')

    // Notification
    setError(null)
    searchInputRef.current?.focus()
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
    setSearchQuery('')
    setError(null)
    
    searchInputRef.current?.focus()
  }

  const restaurerVente = (id: number) => {
    const vente = ventesEnAttente.find(v => v.id === id)
    if (!vente) return

    // Restore sale
    setLignesFacture(vente.lignes)
    setSelectedClient(vente.client)
    setUseManualClient(vente.useManualClient)
    setManualClientName(vente.manualClientName)
    setRemise(vente.remise)
    setRemiseMode(vente.remiseMode)
    
    if (vente.ayantDroit) {
      setSelectedAyantDroit(vente.ayantDroit.id)
      setAyantDroitNom(vente.ayantDroit.nom)
      setAyantDroitMatricule(vente.ayantDroit.matricule)
      setAyantDroitSociete(vente.ayantDroit.societe)
      setShowNewAyantDroit(vente.ayantDroit.showNew)
    }

    // Remove from pending
    setVentesEnAttente(prev => prev.filter(v => v.id !== id))
    setShowPendingSales(false)
  }

  const supprimerVenteEnAttente = (id: number) => {
    setConfirmModal({
        isOpen: true,
        message: 'Voulez-vous vraiment supprimer cette vente en attente ? Cette action est irréversible.',
        onConfirm: () => setVentesEnAttente(prev => prev.filter(v => v.id !== id))
    })
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
           handlePaymentClick()
        }
        return
      }
      
      if (e.key === 'Escape') {
        if (isPaymentModalOpen) {
           fermerModalPaiement()
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

      // Keyboard navigation in search (delegated to hook when search input is focused)
      if (e.target === searchInputRef.current && !isPaymentModalOpen && !showTicketPreview) {
        const keyboardEvent = e as unknown as React.KeyboardEvent
        handleSearchKeyDown(keyboardEvent)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredProduits, lignesFacture, selectedClient, isPaymentModalOpen, showTicketPreview, successInfo, handleSearchKeyDown])

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
            <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-base-200 w-full md:w-64 lg:w-80 shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <label className="label text-xs font-bold text-base-content/50 uppercase tracking-wider py-0">Client (F4)</label>
                    <button
                        type="button"
                        onClick={() => {
                            setUseManualClient(!useManualClient)
                            if (!useManualClient) {
                                setSelectedClient(null)
                                setManualClientName('')
                            }
                        }}
                        className="btn btn-xs btn-ghost"
                        title={useManualClient ? "Sélectionner dans la liste" : "Saisir manuellement"}
                    >
                        {useManualClient ? '📋 Liste' : '✏️ Saisir'}
                    </button>
                </div>
                {useManualClient ? (
                    <input
                        type="text"
                        value={manualClientName}
                        onChange={(e) => setManualClientName(e.target.value)}
                        placeholder="Nom du client..."
                        className="input input-bordered w-full input-sm bg-base-50 focus:bg-white transition-colors"
                    />
                ) : (
                    <select
                        ref={clientSelectRef}
                        value={selectedClient !== null ? String(selectedClient) : ''}
                        onChange={(e) => {
                            const value = e.target.value
                            setSelectedClient(value ? Number(value) : null)
                        }}
                        className="select select-bordered w-full select-sm bg-base-50 focus:bg-white transition-colors"
                    >
                        <option value="">Sélectionner un client...</option>
                        {clients.map((client) => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Ayant Droit Section - Only for Professional Clients */}
            {!useManualClient && selectedClient && clients.find(c => c.id === selectedClient)?.client_type === 'PROFESSIONNEL' && (
              <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-base-200 w-full md:w-64 lg:w-80 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <label className="label text-xs font-bold text-base-content/50 uppercase tracking-wider py-0">
                    Ayant Droit <span className="text-error">*</span>
                  </label>
                  {ayantsDroitList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewAyantDroit(!showNewAyantDroit)
                        if (!showNewAyantDroit) {
                          setSelectedAyantDroit(null)
                          setAyantDroitNom('')
                          setAyantDroitMatricule('')
                          setAyantDroitSociete('')
                        }
                      }}
                      className="btn btn-xs btn-ghost"
                      title={showNewAyantDroit ? "Sélectionner existant" : "Nouveau"}
                    >
                      {showNewAyantDroit ? '📋 Existant' : '➕ Nouveau'}
                    </button>
                  )}
                </div>
                
                {showNewAyantDroit || ayantsDroitList.length === 0 ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={ayantDroitNom}
                      onChange={(e) => setAyantDroitNom(e.target.value)}
                      placeholder="Nom de l'ayant droit *"
                      className="input input-bordered w-full input-xs bg-base-50 focus:bg-white transition-colors"
                    />
                    <input
                      type="text"
                      value={ayantDroitMatricule}
                      onChange={(e) => setAyantDroitMatricule(e.target.value)}
                      placeholder="Matricule *"
                      className="input input-bordered w-full input-xs bg-base-50 focus:bg-white transition-colors"
                    />
                    <input
                      type="text"
                      value={ayantDroitSociete}
                      onChange={(e) => setAyantDroitSociete(e.target.value)}
                      placeholder="Société (optionnel)"
                      className="input input-bordered w-full input-xs bg-base-50 focus:bg-white transition-colors"
                    />
                  </div>
                ) : (
                  <select
                    value={selectedAyantDroit !== null ? String(selectedAyantDroit) : ''}
                    onChange={(e) => setSelectedAyantDroit(e.target.value ? Number(e.target.value) : null)}
                    className="select select-bordered w-full select-xs bg-base-50 focus:bg-white transition-colors"
                  >
                    <option value="">Sélectionner un ayant droit...</option>
                    {Array.isArray(ayantsDroitList) && ayantsDroitList.map((ad) => (
                      <option key={ad?.id || Math.random()} value={ad?.id || ''}>
                        {ad?.nom || 'N/A'} ({ad?.matricule || 'N/A'}){ad?.societe ? ` - ${ad.societe}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Product Search */}
            <div className="bg-white rounded-xl shadow-sm border border-base-200 flex-1 p-3 md:p-4 relative">
                <label className="label text-xs font-bold text-base-content/50 uppercase tracking-wider py-0 mb-2">Rechercher un produit (F2)</label>
                <div className="relative">
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Tapez pour rechercher un produit..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input input-bordered w-full pl-12 text-lg h-14 bg-base-50 focus:bg-white transition-colors focus:ring-2 focus:ring-primary/20"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                
                {/* Search Results Dropdown */}
                {searchQuery && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-base-200 max-h-[60vh] overflow-y-auto z-50">
                        {filteredProduits.length === 0 ? (
                            <div className="text-center py-8 text-base-content/40 text-sm">
                                {searchLoading ? <span className="loading loading-spinner loading-sm"></span> : searchQuery.length < 2 ? 'Tapez au moins 2 caractères' : 'Aucun produit trouvé'}
                            </div>
                        ) : (
                            <div ref={productListRef} className="max-h-96 overflow-y-auto space-y-1 p-1">
                                {filteredProduits.map((produit, idx) => {
                                    const itemProps = getItemProps(idx);
                                    return (
                                    <div 
                                        key={produit.id}
                                        {...itemProps}
                                        onClick={() => (produit.stock ?? 0) > 0 && addProduitToFacture(produit)}
                                        style={itemProps.style}
                                        className={`
                                            group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all
                                            ${itemProps.className ? 'shadow-md' : 'hover:bg-base-100'}
                                            ${(produit.stock ?? 0) === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                                        `}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate text-sm">{produit.name}</div>
                                            <div className="text-xs flex gap-3 mt-0.5 opacity-80">
                                                <span className={(produit.stock ?? 0) === 0 ? 'text-error font-bold' : ''}>
                                                    Stock: {produit.stock}
                                                </span>
                                                <span>{produit.selling_price} F</span>
                                            </div>
                                        </div>
                                        {(produit.stock ?? 0) > 0 && (
                                            <div className={`opacity-0 group-hover:opacity-100 ${itemProps.className ? 'opacity-100' : ''}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                            </div>
                                        )}
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Bottom Section: Cart/Invoice Details */}
        <div className="w-full bg-white rounded-xl shadow-sm border border-base-200 flex flex-col min-h-0 overflow-hidden flex-1">
            <div className="p-4 border-b border-base-100 flex justify-between items-center shrink-0">
                <h2 className="font-bold text-lg text-base-content">Panier</h2>
                <div className="badge badge-ghost font-mono">{lignesFacture.length} articles</div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto">
                {lignesFacture.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-base-content/30 gap-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <p className="font-light">Commencez par ajouter des produits (F2)</p>
                    </div>
                ) : (
                    <table className="table table-pin-rows table-xs w-full">
                        <thead>
                            <tr className="bg-base-50 uppercase tracking-wider text-base-content/60 font-semibold border-b border-base-200">
                                <th className="bg-base-50 pl-2 md:pl-4">Produit</th>
                                <th className="bg-base-50 text-right w-16 md:w-20">Qté</th>
                                <th className="bg-base-50 text-right w-20 md:w-24">Prix</th>
                                <th className="bg-base-50 text-right w-14 md:w-16 hidden sm:table-cell">Remise</th>
                                <th className="bg-base-50 text-center w-24 hidden md:table-cell">Péremption</th>
                                <th className="bg-base-50 text-right w-20 md:w-28 pr-2 md:pr-4">Total</th>
                                <th className="bg-base-50 w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lignesFacture.map((ligne) => (
                                <tr key={ligne.produit.id} className="hover:bg-base-50/50 group border-b border-base-100 last:border-0">
                                    <td className="pl-2 md:pl-4 py-1">
                                        <div className="font-medium">{ligne.produit.name}</div>
                                    </td>
                                    <td className="text-right py-1">
                                        <input
                                            ref={(el) => {
                                              if (el) quantityInputsRef.current.set(ligne.produit.id, el)
                                              else quantityInputsRef.current.delete(ligne.produit.id)
                                            }}
                                            type="text"
                                            value={ligne.quantite}
                                            onChange={(e) => updateQuantite(ligne.produit.id, parseInt(e.target.value) || 0)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault()
                                                searchInputRef.current?.focus()
                                              }
                                            }}
                                            className="input input-ghost input-xs w-full text-right font-medium focus:bg-base-100 focus:text-primary"
                                        />
                                    </td>
                                    <td className="text-right py-1">
                                        <input
                                            type="text"
                                            value={ligne.prix_unitaire}
                                            onChange={(e) => updatePrix(ligne.produit.id, e.target.value)}
                                            className="input input-ghost input-xs w-full text-right focus:bg-base-100 focus:text-primary"
                                        />
                                    </td>
                                    <td className="text-right py-1 hidden sm:table-cell">
                                        <input
                                            type="text"
                                            value={ligne.remise_produit}
                                            onChange={(e) => updateRemiseProduit(ligne.produit.id, e.target.value)}
                                            className="input input-ghost input-xs w-full text-right focus:bg-base-100 focus:text-primary"
                                            placeholder="%"
                                        />
                                    </td>
                                    <td className="text-center py-1 hidden md:table-cell">
                                        <div className="text-xs text-base-content/60">
                                            {ligne.lotId && ligne.lotExpiration 
                                                ? new Date(ligne.lotExpiration).toLocaleDateString('fr-FR')
                                                : (ligne.produit.expire_date ? new Date(ligne.produit.expire_date).toLocaleDateString('fr-FR') : '-')
                                            }
                                        </div>
                                    </td>
                                    <td className="text-center py-1">
                                        <button 
                                            className={`btn btn-xs ${ligne.lotId ? 'btn-primary' : 'btn-ghost text-base-content/50'} w-full max-w-[80px] truncate`}
                                            onClick={() => setLotModal({
                                                isOpen: true,
                                                product: ligne.produit,
                                                currentLotId: ligne.lotId || null
                                            })}
                                            title={ligne.lotId ? `Lot: ${ligne.lotText}` : "Lot: Automatique (FEFO)"}
                                        >
                                            {ligne.lotId ? ligne.lotText : 'Auto'}
                                        </button>
                                    </td>
                                    <td className="text-right font-medium text-base-content pr-2 md:pr-4 py-1">
                                        {Math.round(ligne.total_ligne)}
                                    </td>
                                    <td className="text-center py-1">
                                        <button
                                            onClick={() => removeLigne(ligne.produit.id)}
                                            className="btn btn-ghost btn-xs text-error/50 hover:text-error btn-square opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer Totals */}
            <div className="p-3 md:p-4 lg:p-6 bg-base-50 border-t border-base-200 shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-4 md:mb-6">
                    <div className="space-y-3">
                        {/* Loyalty Controls */}
                        {selectedClient && !useManualClient && totals.currentPoints > 0 && (
                            <div className="bg-amber-50 p-2 rounded text-xs space-y-2 border border-amber-100">
                                <div className="font-bold text-amber-800 flex justify-between">
                                    <span>💎 Fidélité (Solde: {totals.currentPoints})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="whitespace-nowrap">Utiliser pts:</span>
                                    <input 
                                        type="number" 
                                        className="input input-xs input-bordered w-full"
                                        min="0"
                                        max={totals.currentPoints}
                                        value={pointsToUse}
                                        onChange={e => setPointsToUse(Math.min(totals.currentPoints, Math.max(0, parseInt(e.target.value)||0)))}
                                    />
                                </div>
                                <div className="text-right text-amber-700 font-medium">-{pointsToUse * 10} F</div>
                            </div>
                        )}
                        {selectedClient && !useManualClient && totals.pendingDiscountVal > 0 && (
                            <div className="form-control bg-purple-50 p-2 rounded border border-purple-100">
                                <label className="label cursor-pointer py-0">
                                    <span className="label-text text-xs font-bold text-purple-800">Utiliser Remise Acquise ({totals.pendingDiscountVal}%)</span>
                                    <input 
                                        type="checkbox" 
                                        className="checkbox checkbox-xs checkbox-primary"
                                        checked={usePendingDiscount}
                                        onChange={e => setUsePendingDiscount(e.target.checked)}
                                    />
                                </label>
                            </div>
                        )}
                    
                        <div className="flex items-center gap-2">
                             <select
                                value={remiseMode}
                                onChange={(e) => {
                                    setRemiseMode(e.target.value as 'montant' | 'taux')
                                    setRemise('0')
                                }}
                                className="select select-bordered select-xs w-24"
                            >
                                <option value="montant">Remise (F)</option>
                                <option value="taux">Remise (%)</option>
                            </select>
                            <input
                                type="number"
                                value={remise}
                                onChange={(e) => setRemise(e.target.value)}
                                className="input input-bordered input-xs w-32"
                            />
                        </div>
                    </div>
                    <div className="space-y-1 text-right">
                        <div className="text-sm text-base-content/60">
                            Sous-total: <span className="font-medium text-base-content">{Math.round(totals.sousTotal)} F</span>
                        </div>
                        <div className="text-sm text-base-content/60">
                            Remise: <span className="font-medium text-error">-{Math.round(totals.remiseMontant)} F</span>
                        </div>
                        {totals.loyaltyDeduction > 0 && (
                            <div className="text-sm text-base-content/60">
                                Fidélité: <span className="font-medium text-amber-600">-{Math.round(totals.loyaltyDeduction)} F</span>
                            </div>
                        )}
                        <div className="text-3xl font-light text-primary mt-2">
                            {Math.round(totals.totalTtc)} <span className="text-lg font-normal text-primary/60">FCFA</span>
                        </div>
                        
                        {/* Tiers Payant Section */}
                        {totals.tauxCouverture > 0 && totals.partAssurance > 0 && (
                            <div className="mt-3 pt-3 border-t border-base-200">
                                <div className="flex items-center justify-end gap-2 mb-2">
                                    <span className="badge badge-info badge-sm">Tiers Payant {totals.tauxCouverture}%</span>
                                </div>
                                <div className="text-xs text-base-content/60 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span>Part Assurance ({totals.tauxCouverture}%):</span>
                                        <span className="font-medium text-info">{Math.round(totals.partAssurance)} F (En compte)</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Part Patient ({100 - totals.tauxCouverture}%):</span>
                                        <span className="font-medium text-success">{Math.round(totals.partPatient)} F (À payer)</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Pending Sales Indicator */}
                {ventesEnAttente.length > 0 && (
                    <div className="mb-3 flex justify-center">
                        <button 
                            onClick={() => setShowPendingSales(true)}
                            className="badge badge-warning badge-lg cursor-pointer hover:badge-warning/80 transition-colors gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {ventesEnAttente.length} vente{ventesEnAttente.length > 1 ? 's' : ''} en attente
                        </button>
                    </div>
                )}

                {/* Action Buttons - Dropdown Menu */}
                <div className="dropdown dropdown-top">
                    <div tabIndex={0} role="button" className="btn btn-primary shadow-lg shadow-primary/20 btn-sm w-40">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    </div>
                    <ul tabIndex={0} className="dropdown-content z-[1] menu p-1 shadow-lg bg-base-100 rounded-box w-52 mb-2 border border-base-200 menu-sm">
                        <li>
                            <button
                                onClick={() => {
                                    handlePaymentClick()
                                    const elem = document.activeElement as HTMLElement
                                    elem?.blur()
                                }}
                                disabled={loading || (!selectedClient && !useManualClient) || lignesFacture.length === 0}
                                className="gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Encaisser
                                <kbd className="kbd kbd-xs ml-auto">F9</kbd>
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => {
                                    mettreEnAttente()
                                    const elem = document.activeElement as HTMLElement
                                    elem?.blur()
                                }}
                                disabled={lignesFacture.length === 0 || ventesEnAttente.length >= 4}
                                className="gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                En attente
                                <span className="badge badge-warning badge-xs ml-auto">{ventesEnAttente.length}/4</span>
                            </button>
                        </li>
                        <div className="divider my-0 h-0"></div>
                        <li>
                            <button
                                onClick={() => {
                                    annulerVente()
                                    const elem = document.activeElement as HTMLElement
                                    elem?.blur()
                                }}
                                className="gap-2 text-error"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Annuler
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={fermerModalPaiement}
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

      {/* Modal Ticket (Same as before but cleaner) */}
      {showTicketPreview && ticketCaisse && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md mx-4 p-0 overflow-hidden bg-white">
            <div className="bg-base-50 p-4 flex justify-between items-center border-b border-base-200">
              <h3 className="font-bold text-lg">Ticket de Caisse</h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setShowTicketPreview(false)}>✕</button>
            </div>
            
            <div className="p-6 bg-white text-black font-mono text-sm overflow-y-auto max-h-[60vh]" id="ticket-preview">
                {/* ... Ticket Content (kept mostly same for print compatibility) ... */}
                <div className="text-center mb-4 border-b-2 border-black pb-4">
                <h2 className="text-xl font-black">PHARMA STOCK</h2>
                <p>Douala, Cameroun</p>
                <p>Tel: +237 6XX XX XX XX</p>
              </div>
              
              <div className="space-y-1 mb-4">
                <div className="flex justify-between"><span>Ticket:</span><span>#{ticketCaisse.id}</span></div>
                {typeof ticketCaisse.facture === 'object' && ticketCaisse.facture.numero_facture && (
                  <div className="flex justify-between"><span>Facture:</span><span>#{ticketCaisse.facture.numero_facture}</span></div>
                )}
                <div className="flex justify-between"><span>Date:</span><span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span></div>
                <div className="flex justify-between"><span>Client:</span><span>{ticketCaisse.client_name || 'Passage'}</span></div>
              </div>
              
              <div className="border-y border-dashed border-black py-2 mb-4">
                {typeof ticketCaisse.facture === 'object' && ticketCaisse.facture.produits?.map((p: any) => (
                  <div key={p.id} className="flex justify-between mb-1">
                    <span>{typeof p.produit === 'object' ? p.produit.name : (p.produit_nom || `Produit #${p.produit}`)} x{p.quantity}</span>
                    <span>{Math.round(p.quantity * p.selling_price)}</span>
                  </div>
                ))}
              </div>
              
              <div className="space-y-1 font-bold text-right">
                <div className="flex justify-between text-xs font-normal border-t border-dashed border-black pt-2">
                  <span>Sous-total HT</span>
                  <span>{typeof ticketCaisse.facture === 'object' ? Math.round(Number(ticketCaisse.facture.total_ht)) : 0}</span>
                </div>
                {typeof ticketCaisse.facture === 'object' && Number(ticketCaisse.facture.remise) > 0 && (
                  <div className="flex justify-between text-xs font-normal">
                    <span>Remise</span>
                    <span>-{Math.round(Number(ticketCaisse.facture.remise))}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-normal">
                  <span>TVA</span>
                  <span>{typeof ticketCaisse.facture === 'object' ? Math.round(Number(ticketCaisse.facture.total_tva)) : 0}</span>
                </div>
                <div className="flex justify-between text-lg border-t-2 border-black pt-2 mt-1">
                  <span>TOTAL TTC</span>
                  <span>{Math.round(Number(ticketCaisse.montant))} F</span>
                </div>
                {ticketCaisse.montant_verse && (
                  <div className="flex justify-between text-sm font-normal mt-1 border-t border-dashed border-black pt-1">
                    <span>Montant Versé</span>
                    <span>{Math.round(Number(ticketCaisse.montant_verse))} F</span>
                  </div>
                )}
                {ticketCaisse.rendu && (
                  <div className="flex justify-between text-sm font-normal">
                    <span>Rendu</span>
                    <span>{Math.round(Number(ticketCaisse.rendu))} F</span>
                  </div>
                )}
                
                {/* DEBUG - À retirer après test */}
                <div className="text-xs text-gray-500 mt-2 border border-red-300 p-1">
                  DEBUG: paiements_details = {JSON.stringify(ticketCaisse.paiements_details)}<br/>
                  mode_paiement = {ticketCaisse.mode_paiement}
                </div>
                
                {ticketCaisse.paiements_details && ticketCaisse.paiements_details.length > 0 ? (
                  <div className="mt-2 text-xs font-normal border-t border-dashed border-black pt-1">
                      <div className="font-bold mb-1">Règlements:</div>
                      {ticketCaisse.paiements_details.map((paiement, idx) => {
                        const getModeLabel = (mode: string) => {
                          const labels: { [key: string]: string } = {
                            'especes': 'Espèces',
                            'carte': 'Carte',
                            'cheque': 'Chèque',
                            'virement': 'Virement',
                            'om': 'Orange Money',
                            'momo': 'Mobile Money',
                            'en_compte': 'En compte'
                          }
                          return labels[mode] || mode.toUpperCase()
                        }
                        
                        // Check if it's tiers payant payment
                        const isPartPatient = paiement.part_patient && paiement.part_patient > 0
                        const isPartAssurance = paiement.part_assurance && paiement.part_assurance > 0
                        
                        return (
                          <div key={idx} className="flex justify-between">
                            <span>
                              {getModeLabel(paiement.mode || paiement.mode_paiement || 'N/A')}
                              {isPartPatient && <span className="text-success"> (Part Patient)</span>}
                              {isPartAssurance && <span className="text-info"> (Part Assurance)</span>}
                            </span>
                            <span>{Math.round(paiement.montant)} F</span>
                          </div>
                        )
                      })}
                  </div>
                ) : ticketCaisse.mode_paiement ? (
                  <div className="text-xs font-normal mt-2 text-center">
                    Mode: {ticketCaisse.mode_paiement.toUpperCase()}
                  </div>
                ) : (
                  <div className="text-xs text-red-500 mt-2 text-center">
                    [Aucun mode de paiement détecté]
                  </div>
                )}
              </div>
              
              <div className="text-center mt-6 text-xs">
                <p>Merci de votre visite !</p>
                <p>À bientôt.</p>
              </div>
              
              {/* Barcode with invoice number at bottom */}
              {typeof ticketCaisse.facture === 'object' && ticketCaisse.facture.numero_facture && (
                <Suspense fallback={<div className="text-center py-2">Chargement...</div>}>
                  <div className="flex justify-center mt-4 bg-white">
                    <Barcode value={ticketCaisse.facture.numero_facture} height={50} width={1.5} fontSize={12} />
                  </div>
                </Suspense>
              )}
            </div>
            
            <div className="p-4 bg-base-50 border-t border-base-200 flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTicketPreview(false)}>Fermer (Esc)</button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const content = document.getElementById('ticket-preview')?.innerHTML;
                  const win = window.open('', '', 'height=600,width=400');
                  if (win && content) {
                    win.document.write('<html><head><title>Ticket</title>');
                    win.document.write('<style>body { font-family: monospace; padding: 20px; } .text-center { text-align: center; } .flex { display: flex; justify-content: space-between; } .font-bold { font-weight: bold; } .border-b-2 { border-bottom: 2px solid black; } .border-t-2 { border-top: 2px solid black; } .mb-4 { margin-bottom: 1rem; } .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }</style>');
                    win.document.write('</head><body>');
                    win.document.write(content);
                    win.document.write('</body></html>');
                    win.document.close();
                    win.print();
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
    </div>
  )
}
