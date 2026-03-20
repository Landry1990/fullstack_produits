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
import PremiumModal from './common/PremiumModal'
import { ClientNameModal } from './sales/modals/ClientNameModal'
import { useSudo } from '../hooks/useSudo'
import { StockResolutionHandler } from './facturation/StockResolutionHandler'
import { useSaleCompletion } from '../hooks/useSaleCompletion'
import { formatCurrency } from '../utils/formatters'
import { useFacturationKeyboardShortcuts } from '../hooks/useFacturationKeyboardShortcuts'
import FacturationNotifications from './facturation/FacturationNotifications'
import { useFacturationUI } from '../hooks/useFacturationUI'



// FactureProduitPayload removed as it's now handled by useSaleCompletion


export default function Facturation() {
  const { t } = useTranslation(['prescriptions', 'common', 'facturation', 'sales'])
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { settings: pharmacySettings } = usePharmacySettings()
  const { isZenithMode, toggleZenithMode, isMidnightTheme, toggleMidnightTheme } = useSidebar()
  
  // Local loading state for non-hook operations (e.g. payment)
  const [loading, setLoading] = useState(false)
  const [isRetrocession, setIsRetrocession] = useState(false)
  const [isFactureA4, setIsFactureA4] = useState(false)
  const [sortBy, setSortBy] = useState<'chrono' | 'stock' | 'name' | 'qty'>('chrono')

  // Refs - declared early for hook usage
  const quantityInputsRef = useRef<Map<number, HTMLInputElement>>(new Map())
  const hasLoadedDevisRef = useRef(false)
  
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
      bulkAddProduits,
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
          title: t('facturation:payment.sudo_mode.validate_by'),
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
          title: t('facturation:payment.sudo_mode.validate_by'),
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
          title: t('facturation:payment.sudo_mode.validate_by'),
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
        toast.success(t('facturation:messages.scan_added', { name: product.name }), { duration: 1500 })
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
          toast.error(t('facturation:messages.pack_empty'))
          return
      }

      const toastId = toast.loading(t('facturation:messages.adding_pack'))
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
              toast.error(t('facturation:messages.pack_items_error'), { id: toastId })
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
          
          // Prepare items for bulk addition
          const itemsToBulkAdd = items.map(({ product, quantity }) => {
              const itemToSet = {
                  product,
                  quantity,
                  discountPercent: ratio < 1 ? (Math.round((1 - ratio) * 10000) / 100).toFixed(0) : '0'
              }
              return itemToSet
          })

          bulkAddProduits(itemsToBulkAdd)
          
          toast.success(t('facturation.messages.pack_added', { name: pack.name }), { id: toastId })
          
      } catch (e) {
          console.error(e)
          toast.error(t('facturation.messages.pack_error'), { id: toastId })
      }
  }, [addProduitToFacture, updateQuantite, updateRemiseProduit, updatePrix])

  // CSV Import Logic
  const handleCsvImport = useCallback(async (file: File) => {
      const toastId = toast.loading('Analyse et importation du fichier CSV...');
      try {
          const text = await file.text();
          // Lignes séparées par saut de ligne, puis par virgule ou point-virgule
          const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
          
          if (lines.length === 0) {
              toast.error('Le fichier CSV est vide.', { id: toastId });
              return;
          }

          const params: { identifiers: string[], quantities: Record<string, number> } = {
              identifiers: [],
              quantities: {}
          };

          // On saute la première ligne si on suspecte un en-tête (cip, qte) etc.
          // Pour plus de souplesse, on regarde chaque ligne.
          for (let i = 0; i < lines.length; i++) {
              const parts = lines[i].split(/[,;]/).map(s => s.trim());
              if (parts.length >= 2) {
                  const identifier = parts[0];
                  // Si identifier ressemble à 'CIP' ou 'ID', c'est l'en-tête, on passe
                  if (identifier.toLowerCase() === 'cip' || identifier.toLowerCase() === 'id') continue;

                  const quantity = parseInt(parts[1], 10);
                  if (identifier && !isNaN(quantity) && quantity > 0) {
                      params.identifiers.push(identifier);
                      params.quantities[identifier] = quantity;
                  }
              }
          }

          if (params.identifiers.length === 0) {
              toast.error('Aucune donnée valide trouvée dans le CSV. Format attendu: CIP,Quantité', { id: toastId });
              return;
          }

          // Rechercher les produits dans l'API par CIP (ou ID si match)
          const apiBase = import.meta.env.VITE_API_BASE_URL ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '') : '';
          const endpoint = apiBase ? `${apiBase}/api/produits/bulk_search/` : '/api/produits/bulk_search/';
          
          let fetchedProducts: ProduitModel[] = [];

          try {
              // Si le endpoint bulk_search existe (très pratique pour ça), 
              // sinon fallback boucle
              const res = await axios.post(endpoint, { identifiers: params.identifiers });
              fetchedProducts = res.data;
          } catch (e) {
             // Fallback: chercher un par un si le endpoint bulk_search n'existe pas
             console.warn("Endpoint bulk_search introuvable, fallback requêtes unitaires.");
             const productPromises = params.identifiers.map(async (ident) => {
                  try {
                      // Cherche avec le terme 'ident' (souvent le CIP1 ou l'ID direct)
                      const searchUrl = `${apiBase ? apiBase : ''}/api/produits/?search=${ident}`;
                      const res = await axios.get(searchUrl);
                      const results = res.data.results || res.data;
                      if (results && results.length > 0) {
                          // On prend le premier match exact si possible
                          const match = results.find((p: any) => p.cip1 === ident || String(p.id) === ident) || results[0];
                          return { identifier: ident, product: match };
                      }
                  } catch (err) {
                      return null;
                  }
                  return null;
             });

             const results = await Promise.all(productPromises);
             // reconstruire
             const items = results.filter(i => i !== null) as { identifier: string; product: ProduitModel }[];
             fetchedProducts = items.map(i => {
                // Attach l'identifier matché pour faire le lien qte
                (i.product as any)._matched_identifier = i.identifier; 
                return i.product;
             });
          }

          if (fetchedProducts.length === 0) {
              toast.error('Aucun produit correspondant trouvé dans la base.', { id: toastId });
              return;
          }

          // Préparer pour bulkAddProduits
          const itemsToBulkAdd = fetchedProducts.map(product => {
              // Si l'API retourne le product avec son identifier original, on l'utilise, 
              // sinon on essaie de matcher le CIP ou l'ID avec nos params.
              const identifier = (product as any)._matched_identifier || product.cip1 || String(product.id);
              const qty = params.quantities[identifier] || 1;
              return {
                  product,
                  quantity: qty,
                  discountPercent: '0'
              }
          });

          bulkAddProduits(itemsToBulkAdd);
          toast.success(`${itemsToBulkAdd.length} produit(s) importé(s) du CSV.`, { id: toastId });

      } catch (err) {
          console.error("Erreur lecture CSV:", err);
          toast.error("Erreur lors de la lecture du fichier CSV.", { id: toastId });
      }
  }, [bulkAddProduits]);

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
  } = useFacturationClients()

  // usePendingSales Hook
  const {
      ventesEnAttente,
      showPendingSales,
      setShowPendingSales,
      savePendingSale,
      deletePendingSale
  } = usePendingSales()

  // useFacturationUI Hook replacing local state
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


      isModificationMode, setIsModificationMode,
      modificationInvoiceId, setModificationInvoiceId,
      modificationInvoiceStatus, setModificationInvoiceStatus,
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

  const isNewSale = !facturePourPaiement

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
      setSearchQuery('')
      setTempOrdonnanceData(null) // Clear temp data
      // Auto-focus search after clearing cart
      setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  // useSaleCompletion Hook
  const { 
    completeSale, 
    completeExistingInvoicePayment,
    loading: saleLoading
  } = useSaleCompletion({
    onSuccess: (result) => {
        if (result.success && result.facture) {
            setSuccessInfo(result.facture) // Keep only this local state for toast notifications
            setTicketCaisse(result.ticketCaisse || null)
            
            if (isFactureA4) {
               if (result.facture) {
                   // Check if client name is generic
                   const normalize = (str: string) => str?.toLowerCase().trim() || '';
                   const clientName = normalize(result.facture.client_name || '');
                   const isGenericClient = !result.facture.client_name_override && (
                       !clientName || 
                       clientName.includes('passage') || 
                       clientName.includes('divers')
                   );

                   if (isGenericClient) {
                       setPendingPrintFacture(result.facture);
                       setShowClientNameModal(true);
                   } else {
                       const nameToUse = result.facture.client_name_override || result.facture.client_name;
                       let url = `/app/print-invoice/${result.facture.id}`;
                       if (nameToUse) url += `?client_name=${encodeURIComponent(nameToUse)}`;
                       window.open(url, '_blank');
                   }
               }
               setIsFactureA4(false) // Auto-reset for next sale
            } else {
               if (result.ticketCaisse) setShowTicketPreview(true)
            }
            
            // Clean up
            resetUIState()

            // Mise à jour optimiste du cache React Query pour les produits vendus
            // afin d'éviter un rechargement complet de la liste des produits
            lignesFacture.forEach(ligne => {
                queryClient.setQueriesData({ queryKey: ['produits'] }, (oldData: any) => {
                    if (!oldData) return oldData;
                    if (oldData.results && Array.isArray(oldData.results)) {
                        return {
                            ...oldData,
                            results: oldData.results.map((p: any) => 
                                p.id === ligne.produit.id 
                                ? { ...p, stock: Math.max(0, (p.stock || 0) - ligne.quantite) } 
                                : p
                            )
                        };
                    } else if (Array.isArray(oldData)) {
                        return oldData.map((p: any) => 
                            p.id === ligne.produit.id 
                            ? { ...p, stock: Math.max(0, (p.stock || 0) - ligne.quantite) } 
                            : p
                        );
                    }
                    return oldData;
                });
                
                queryClient.setQueriesData({ queryKey: ['produit', ligne.produit.id] }, (oldData: any) => {
                    if (!oldData) return oldData;
                    return { ...oldData, stock: Math.max(0, (oldData.stock || 0) - ligne.quantite) };
                });
            });

            _resetSaleDataOnly() // Clear cart
            closePaymentModal()
        }
    },
    onReset: _resetSaleDataOnly,
    onError: (msg) => setError(msg)
  })

  // We keep only essential local UI state not covered by hook
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<Facture | null>(null)
  const [showClientNameModal, setShowClientNameModal] = useState(false)
  const [pendingPrintFacture, setPendingPrintFacture] = useState<Facture | null>(null)
  const [pointsToUse, setPointsToUse] = useState(0)
  const [usePendingDiscount, setUsePendingDiscount] = useState(false)
  const [centralizedCashRegister, setCentralizedCashRegister] = useState<boolean>(true)
  const [activeSudoCreds, setActiveSudoCreds] = useState<{ validatorId: number, password: string } | null>(null);




  // Keyboard Navigation Hook - NOW PLACED AFTER STATE DECLARATIONS
  // Empty placeholder so diff works, moving logic to bottom
  // Charger un devis depuis safeStorage si présent (navigation depuis Ventes)
  useEffect(() => {
    const loadDevis = async () => {
      if (hasLoadedDevisRef.current) return
      
      const devisString = safeStorage.getItem('devis_to_load', 'local')
      if (!devisString) return
      
      try {
        hasLoadedDevisRef.current = true
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
        // Les factures dupliquées auront status === 'BROU' et id === undefined
        const isValidatedOrPaid = devis.status === 'VAL' || devis.status === 'PAY'
        
        if (isValidatedOrPaid && devis.id) {
          // Mode modification - facture déjà validée/payée
          setIsModificationMode(true)
          setModificationInvoiceId(devis.id)
          setModificationInvoiceStatus(devis.status || null)
          setOriginalTotalTtc(Number(devis.total_ttc || 0))
          toast.success(`Facture #${devis.numero_facture || devis.id} chargée en mode modification`)
        } else if (devis.id) {
          // Mode normal - devis/proforma existant à valider
          toast.success(`Devis #${devis.numero_facture || devis.id} chargé`)
        } else {
          // Mode duplication - nouvelle vente basée sur copie
          toast.success(`Panier pré-rempli à partir de la copie`)
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
                  const preserved = {
                      ...ligne,
                      // Preserve promis flags and quantities when refreshing stock data
                      isPromis: ligne.isPromis,
                      promisQuantity: ligne.promisQuantity,
                      promisPhone: ligne.promisPhone,
                      produit: {
                          ...ligne.produit,
                          stock: freshProduct.stock,
                          selling_price: freshProduct.selling_price,
                          is_active: freshProduct.is_active
                      }
                  };
                  return preserved;
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
          // On ne considère comme problématique que ce qui n'est pas déjà couvert par un promis
          // ou une vente forcée déjà validée par sudo
          !l.isPromis && l.quantite > (l.produit.stock ?? 0)
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

  const handlePaymentClickWithSudo = (updatedLignes?: any[], sudoCredentials?: { validatorId: number, password: string }) => {
      // FIX: Ouvrir directement le modal de paiement sans re-passer par handlePaymentClick()
      // qui re-fetcherait les stocks et écraserait les flags isPromis/promisQuantity
      if (updatedLignes && updatedLignes.length > 0) {
          setLignesFacture(updatedLignes)
      }
      
      if (sudoCredentials) {
          setActiveSudoCreds(sudoCredentials)
      }
      
      // Ouvrir directement le modal de paiement
      const montantInitial = (totals.tauxCouverture > 0) ? totals.partPatient : totals.totalTtc
      setMontantPaye(montantInitial.toString())
      openPaymentModal()
  }

  // Keyboard Navigation Hook - NOW PLACED AFTER STATE DECLARATIONS AND DEPS
  const handleValidateShortcut = useCallback(() => {
    if (lignesFacture.length > 0) {
      handlePaymentClick()
    } else {
        toast.error(t('facturation.messages.cart_empty'))
    }
  }, [lignesFacture.length, handlePaymentClick]) // Added dependency later

  const sortedLignes = useMemo(() => {
    if (sortBy === 'chrono') return lignesFacture;
    return [...lignesFacture].sort((a, b) => {
      if (sortBy === 'name') return (a.produit.name || '').localeCompare(b.produit.name || '');
      if (sortBy === 'stock') return (b.produit.stock || 0) - (a.produit.stock || 0);
      if (sortBy === 'qty') return b.quantite - a.quantite;
      return 0;
    });
  }, [lignesFacture, sortBy])

  // Define handlers locally to avoid closure staleness if needed, 
  // but hook takes them as props.
  const handleIncrement = useCallback((index: number) => {
    if (sortedLignes[index]) {
       const pId = sortedLignes[index].produit.id
       const currentQty = sortedLignes[index].quantite
       updateQuantite(pId, currentQty + 1)
    }
  }, [sortedLignes, updateQuantite])

  const handleDecrement = useCallback((index: number) => {
    if (sortedLignes[index]) {
       const pId = sortedLignes[index].produit.id
       const currentQty = sortedLignes[index].quantite
       if (currentQty > 1) {
          updateQuantite(pId, currentQty - 1)
       }
    }
  }, [sortedLignes, updateQuantite])

  const handleDeleteLine = useCallback((index: number) => {
    if (sortedLignes[index]) {
       removeLigne(sortedLignes[index].produit.id)
    }
  }, [sortedLignes, removeLigne])

  const { selectedIndex, setSelectedIndex } = useKeyboardNavigation({
    listLength: sortedLignes.length,
    onValidate: handleValidateShortcut,
    onIncrement: handleIncrement,
    onDecrement: handleDecrement,
    onDelete: handleDeleteLine,
    enabled: !isPaymentModalOpen && !showOrdonnanceModal && !showClientCreateModal && !lotModal.isOpen && !showStockResolution
  })

  // Global Keyboard Shortcuts Hook
  useFacturationKeyboardShortcuts({
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
    lotModalOpen: lotModal.isOpen,
    closeLotModal,
    showClientCreateModal,
    setShowClientCreateModal,
    showStockResolution,
    setShowStockResolution,
    confirmModal,
    setConfirmModal,
    setSearchQuery,
    successInfo,
    setSuccessInfo
  })

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
            totalHt: totals.totalHt,
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
        modificationInvoiceId: modificationInvoiceId,
        modificationInvoiceStatus: modificationInvoiceStatus || undefined
    };

    await completeSale(params);
  };

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

        toast.success(t('prescriptions:messages.save_success'));
        setShowOrdonnanceModal(false);
        setPendingOrdonnanceFacture(null);
        // Ne pas reset les données de vente ici, juste fermer le modal
    } catch (err: any) {
        console.error("=== ERREUR ORDONNANCIER ===");
        console.error("Error object:", err);
        console.error("Response status:", err.response?.status);
        console.error("Response data:", err.response?.data);
        toast.error(t('prescriptions:messages.save_error') + ": " + (err.response?.data?.detail || err.message));
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
          discount: (prixUnitaire - prixNet).toFixed(0),
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

  const handleBonDeLivraison = async () => {
    if (lignesFacture.length === 0) {
      toast.error("Le panier est vide")
      return
    }

    if (isModificationMode && modificationInvoiceId) {
      window.open(`/app/print-invoice/${modificationInvoiceId}?type=BL`, '_blank')
      return
    }

    setLoading(true)
    try {
      // 1. Create Facture (Status PROF)
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const factureProduitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/facture-produits/` : '/api/facture-produits/'

      const facturePayload = {
        client: selectedClient || null,
        client_name_override: manualClientName || null,
        ayant_droit: selectedAyantDroit || null,
        status: 'PROF',
        remise: Number(remiseGlobale) || 0,
        notes: "Généré via Bon de Livraison"
      }
      
      const res = await axios.post(facturesEndpoint, facturePayload, {
        headers: { Authorization: `Token ${safeStorage.getItem('authToken')}` }
      })
      const createdFacture = res.data
      
      // 2. Add Products
      const produitsPayload = lignesFacture.map(ligne => {
        const prixUnitaire = Number(ligne.prix_unitaire)
        const remiseProduit = Number(ligne.remise_produit) || 0
        const prixNet = prixUnitaire * (1 - remiseProduit / 100)
        
        // Sécuriser l'ID du lot (doit être un nombre ou null)
        const lotIdNum = ligne.lotId && !isNaN(Number(ligne.lotId)) ? Number(ligne.lotId) : null
        
        return {
          facture: createdFacture.id,
          produit: ligne.produit.id,
          produit_nom: ligne.produit.name,
          quantity: Number(ligne.quantite),
          selling_price: prixNet.toFixed(2),
          discount: (prixUnitaire - prixNet).toFixed(2),
          stock_lot_id: lotIdNum,
          lot: ligne.lotText || null,
          date_expiration: ligne.lotExpiration || ligne.produit.expire_date || null,
        }
      })
      
      // On utilise une boucle simple pour mieux capturer les erreurs individuelles si besoin
      for (const payload of produitsPayload) {
        await axios.post(factureProduitsEndpoint, payload, {
          headers: { Authorization: `Token ${safeStorage.getItem('authToken')}` }
        })
      }
      
      // 3. Open Print Window with type=BL
      window.open(`/app/print-invoice/${createdFacture.id}?type=BL`, '_blank')
      
      // 4. Switch to modification mode to reuse this invoice ID for final validation
      setModificationInvoiceId(createdFacture.id)
      setModificationInvoiceStatus('PROF')
      setIsModificationMode(true)
      
      toast.success("Bon de livraison généré - Document prêt pour validation")
      
    } catch (error: any) {
      console.error("Erreur lors de la génération du bon de livraison:", error)
      const errorMsg = error.response?.data?.detail || error.response?.data ? JSON.stringify(error.response.data) : error.message
      console.log("Détails de l'erreur:", errorMsg)
      toast.error(`Erreur lors de la création du document : ${errorMsg}`)
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

  const handleConfirmPrintClientName = async (clientNameInput: string) => {
      if (!pendingPrintFacture) return;

      try {
          // PATCH update
          await axios.patch(`${apiBaseUrl ? apiBaseUrl : ''}/api/factures/${pendingPrintFacture.id}/`,
              { client_name_override: clientNameInput }
          );

          // Lancer impression
          let url = `/app/print-invoice/${pendingPrintFacture.id}`;
          if (clientNameInput) url += `?client_name=${encodeURIComponent(clientNameInput)}`;
          window.open(url, '_blank');

      } catch (error) {
          console.error('Erreur sauvegarde nom client:', error);
          toast.error(t('sales.messages.save_error', { defaultValue: 'Erreur lors de la sauvegarde du nom' }));
          // Fallback print
          let url = `/app/print-invoice/${pendingPrintFacture.id}`;
          if (clientNameInput) url += `?client_name=${encodeURIComponent(clientNameInput)}`;
          window.open(url, '_blank');
      } finally {
          setShowClientNameModal(false);
          setPendingPrintFacture(null);
          // Return focus to search after client name entry
          setTimeout(() => searchInputRef.current?.focus(), 100);
      }
  };

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

  // Envoi WhatsApp
  const handleSendWhatsApp = async () => {
    if (!ticketCaisse || !ticketCaisse.facture || typeof ticketCaisse.facture === 'number') return
    
    const facture = ticketCaisse.facture as any
    // Déterminer le numéro (priorité au numéro du client si présent)
    const clientPhone = (typeof facture.client === 'object' ? facture.client?.phone : '') || facture.client_phone
    const phone = window.prompt(t('facturation.messages.enter_whatsapp_number') || 'Entrez le numéro WhatsApp (format international ex: 237...)', clientPhone || '')
    
    if (!phone) return

    setLoading(true)
    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const response = await axios.post(`${facturesEndpoint}${facture.id}/send_whatsapp/`, {
        phone: phone
      })
      toast.success(response.data.detail || 'Ticket envoyé par WhatsApp !')
    } catch (err: any) {
      console.error('Erreur envoi WhatsApp:', err)
      toast.error(err.response?.data?.detail || "Erreur lors de l'envoi WhatsApp")
    } finally {
      setLoading(false)
    }
  }

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
          message: t('facturation.messages.cancel_sale_confirm', { defaultValue: 'Êtes-vous sûr de vouloir annuler cette vente en cours ? Tout le panier sera perdu.' }),
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
      toast.success(t('facturation:messages.save_success'))
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

  // Managed by useFacturationKeyboardShortcuts hook

  return (
    <div className="h-full flex flex-col bg-base-100 font-sans text-base-content overflow-hidden">
      {/* Header Minimaliste */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-base-200 bg-white dark:bg-slate-900 shrink-0 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2 sm:gap-4">
          <h1 className="text-lg sm:text-2xl font-bold text-base-content uppercase tracking-tight truncate max-w-[120px] sm:max-w-none">{t('facturation:title')}</h1>
          
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
            <span className="flex items-center gap-0.5 sm:gap-1"><kbd className="kbd kbd-xs py-0 h-3 sm:h-4 font-sans">/</kbd> <span className="hidden xs:inline">{t('facturation:shortcuts.search')}</span></span>
            <span className="flex items-center gap-0.5 sm:gap-1"><kbd className="kbd kbd-xs py-0 h-3 sm:h-4 font-sans">F9</kbd> <span className="hidden xs:inline">{t('facturation:shortcuts.pay')}</span></span>
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
            <h3 className="font-bold">{t('facturation:modification_mode.title')}</h3>
            <div className="text-xs flex flex-wrap gap-4">
              <span>{t('facturation:modification_mode.original_total')}: <strong>{formatCurrency(Math.round(originalTotalTtc))}</strong></span>
              <span>{t('facturation:modification_mode.new_total')}: <strong>{formatCurrency(Math.round(totals.totalTtc))}</strong></span>
              {totals.totalTtc !== originalTotalTtc && (
                <span className={totals.totalTtc > originalTotalTtc ? 'text-success font-bold' : 'text-error font-bold'}>
                  {t('facturation:modification_mode.difference')}: {totals.totalTtc > originalTotalTtc ? '+' : ''}{formatCurrency(Math.round(totals.totalTtc - originalTotalTtc))}
                  {totals.totalTtc > originalTotalTtc ? ` (${t('facturation:modification_mode.to_collect')})` : ` (${t('facturation:modification_mode.to_refund')})`}
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
              toast(t('facturation:modification_mode.cancelled'), { icon: '✖️' })
            }}
          >
            {t('common:cancel')}
          </button>
        </div>
      )}

      {/* Notifications */}
      <FacturationNotifications
        error={error}
        setError={setError}
        successInfo={successInfo}
        setSuccessInfo={setSuccessInfo}
        onOpenPaymentModal={ouvrirModalPaiement}
        onShowTicket={() => setShowTicketPreview(true)}
        onPrintA4={handleImprimerFacture}
        ticketCaisse={ticketCaisse}
      />

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
            placeholder={t('facturation:search.placeholder')}
            onQuantityShortcut={handleQuantityShortcut}
            onCsvImport={handleCsvImport}
          />
        </div>

        {/* Bottom Section: Cart/Invoice Details */}
        <div className="flex-none sm:flex-1 flex flex-col min-h-[400px] sm:min-h-0 bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden shrink-0 sm:shrink">
          
          {/* Clinical Alerts Banner */}
          <ClinicalAlerts alerts={clinicalAlerts} />

          <div className="p-4 border-b border-base-100 flex justify-between items-center shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <h2 className="font-bold text-lg text-base-content">{t('facturation:cart.title')}</h2>
              <div className="badge badge-ghost font-mono">{lignesFacture.length} {t('facturation:cart.items_count', { count: lignesFacture.length })}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-base-content/60 font-medium">Trier par:</span>
              <select 
                className="select select-bordered select-sm text-xs" 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                disabled={lignesFacture.length === 0}
              >
                <option value="chrono">Chronologie</option>
                <option value="stock">Qté en stock</option>
                <option value="name">Nom</option>
                <option value="qty">Qté saisie</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <CartTable
              lignesFacture={sortedLignes}
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
            totalHT={totals.totalHt}
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
            onBonDeLivraison={handleBonDeLivraison}
            onSuspend={mettreEnAttente}
            onViewPending={() => setShowPendingSales(true)}
            pendingCount={ventesEnAttente.length}
            onCancel={annulerVente}
            isValid={lignesFacture.length > 0}
            isRetrocession={isRetrocession}
            setIsRetrocession={setIsRetrocession}
            isFactureA4={isFactureA4}
            setIsFactureA4={setIsFactureA4}
            loading={loading || saleLoading}
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
        onClose={() => {
            setShowTicketPreview(false)
            setTimeout(() => searchInputRef.current?.focus(), 100)
        }}
        ticket={ticketCaisse}
        settings={pharmacySettings}
        onSendWhatsApp={handleSendWhatsApp}
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
      <PremiumModal
        isOpen={!!confirmModal?.isOpen}
        onClose={() => setConfirmModal(null)}
        title={t('common:confirmation', { defaultValue: 'Confirmation' })}
        icon={<span className="text-warning text-xl">⚠️</span>}
        gradientFrom="warning/10"
        gradientTo="warning/5"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn" onClick={() => setConfirmModal(null)}>
              {t('common:cancel', { defaultValue: 'Annuler' })}
            </button>
            <button
              className="btn btn-error"
              onClick={() => {
                if (confirmModal?.onConfirm) confirmModal.onConfirm();
                setConfirmModal(null);
              }}
            >
              {t('common:confirm', { defaultValue: 'Confirmer' })}
            </button>
          </div>
        }
      >
        <div className="p-6">
          <p className="text-base-content/80 text-lg">{confirmModal?.message}</p>
        </div>
      </PremiumModal>
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

      {/* Client Name Modal for A4 Invoice */}
      <ClientNameModal 
          isOpen={showClientNameModal}
          onClose={() => {
              setShowClientNameModal(false);
              setPendingPrintFacture(null);
              setTimeout(() => searchInputRef.current?.focus(), 100);
          }}
          onConfirm={handleConfirmPrintClientName}
          facture={pendingPrintFacture}
      />

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
