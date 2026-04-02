import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import type { ProduitModel, Facture, LigneFacture } from '../types'
import { useProductSearch } from './useProductSearch'
import { useCart } from './useCart'
import { useAuth } from '../context/AuthContext'
import { useFacturationClients } from './useFacturationClients'
import { usePendingSales } from './usePendingSales'
import { usePharmacySettings } from './usePharmacySettings'
import { useKeyboardNavigation } from './useKeyboardNavigation'
import { useClinicalCheck } from './useClinicalCheck'
import { useSidebar } from '../context/SidebarContext'
import { safeStorage } from '../utils/storage'
import { useTranslation } from 'react-i18next'
import { useSudo } from './useSudo'
import { useSaleCompletion } from './useSaleCompletion'
import { useFacturationKeyboardShortcuts } from './useFacturationKeyboardShortcuts'
import { useFacturationUI } from './useFacturationUI'
import type { OrdonnanceData } from '../components/OrdonnanceModal'

export function useFacturationState() {
  const { t } = useTranslation(['prescriptions', 'common', 'facturation', 'sales'])
  const queryClient = useQueryClient()
  const { settings: pharmacySettings } = usePharmacySettings()
  const { isZenithMode, toggleZenithMode, isMidnightTheme, toggleMidnightTheme } = useSidebar()
  
  const [loading, setLoading] = useState(false)
  const [isRetrocession, setIsRetrocession] = useState(false)
  const [isFactureA4, setIsFactureA4] = useState(false)
  const [sortBy, setSortBy] = useState<'chrono' | 'stock' | 'name' | 'qty'>('chrono')

  const quantityInputsRef = useRef<Map<number, HTMLInputElement>>(new Map())
  const hasLoadedDevisRef = useRef(false)
  const addProductRef = useRef<((product: ProduitModel, options?: { isRetrocession?: boolean; preventFocus?: boolean }) => void) | null>(null)
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const paymentInputRef = useRef<HTMLInputElement>(null)
  const clientSearchRef = useRef<HTMLInputElement>(null)

  const { sudoState, requireSudo, closeSudo } = useSudo()
  const [activeSudoCreds, setActiveSudoCreds] = useState<{ validatorId: number, password: string } | null>(null);

  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<Facture | null>(null)
  const [showClientNameModal, setShowClientNameModal] = useState(false)
  const [pendingPrintFacture, setPendingPrintFacture] = useState<Facture | null>(null)
  const [pointsToUse, setPointsToUse] = useState(0)
  const [usePendingDiscount, setUsePendingDiscount] = useState(false)
  const [centralizedCashRegister, setCentralizedCashRegister] = useState<boolean>(true)
  const [showHelp, setShowHelp] = useState(false)

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : ''
  }, [])

  const handleApiError = useCallback((err: unknown, defaultMessage: string) => {
    if (axios.isAxiosError(err)) {
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || defaultMessage
      setError(errorMessage)
      setSuccessInfo(null)
    } else {
      setError(defaultMessage)
    }
  }, [])

  // useFacturationUI Hook
  const ui = useFacturationUI()

  // useCart Hook
  const cart = useCart({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    onRequirePrescription: () => ui.setShowOrdonnanceModal(true),
    onAlert: (message, title, type, is_blocking) => ui.pushDisplayAlert({ message, title, type, is_blocking }),
    quantityInputsRef
  })

  const secureUpdateQuantite = useCallback((produitId: number, newQty: number) => {
    if (newQty < 0) {
      const currentLine = cart.lignesFacture.find((l: any) => l.produit.id === produitId);
      requireSudo(async (validatorId, password) => {
          setActiveSudoCreds({ validatorId, password });
          cart.updateQuantite(produitId, newQty);
      }, {
          title: t('facturation:payment.sudo_mode.validate_by'),
          message: `Confirmer la quantité ${newQty} pour le produit ${currentLine?.produit.name ?? ''} ?`
      });
    } else {
      cart.updateQuantite(produitId, newQty);
    }
  }, [cart.updateQuantite, cart.lignesFacture, requireSudo, t]);

  const secureUpdatePrix = useCallback((produitId: number, newPrice: string) => {
    const currentLine = cart.lignesFacture.find((l: any) => l.produit.id === produitId);
    if (!currentLine) return;
    if (newPrice !== currentLine.prix_unitaire) {
      requireSudo(async (validatorId, password) => {
          setActiveSudoCreds({ validatorId, password });
          cart.updatePrix(produitId, newPrice);
      }, {
          title: t('facturation:payment.sudo_mode.validate_by'),
          message: `Confirmer le changement de prix de ${currentLine.prix_unitaire} à ${newPrice} pour ${currentLine.produit.name} ?`
      });
    } else {
      cart.updatePrix(produitId, newPrice);
    }
  }, [cart.updatePrix, cart.lignesFacture, requireSudo, t]);

  const secureUpdateRemiseProduit = useCallback((produitId: number, newRemise: string) => {
    const currentLine = cart.lignesFacture.find((l: any) => l.produit.id === produitId);
    if (!currentLine) return;
    if (Number(newRemise) > 0 && newRemise !== currentLine.remise_produit) {
      requireSudo(async (validatorId, password) => {
          setActiveSudoCreds({ validatorId, password });
          cart.updateRemiseProduit(produitId, newRemise);
      }, {
          title: t('facturation:payment.sudo_mode.validate_by'),
          message: `Confirmer une remise de ${newRemise}% sur le produit ${currentLine.produit.name} ?`
      });
    } else {
      cart.updateRemiseProduit(produitId, newRemise);
    }
  }, [cart.updateRemiseProduit, cart.lignesFacture, requireSudo, t]);

  const { alerts: clinicalAlerts } = useClinicalCheck(cart.lignesFacture)
  
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

  // Pack Addition
  const addPackToFacture = useCallback(async (pack: any) => {
      if (!pack.pack_items || pack.pack_items.length === 0) {
          toast.error(t('facturation:messages.pack_empty'))
          return
      }
      const toastId = toast.loading(t('facturation:messages.adding_pack'))
      try {
          const apiBase = apiBaseUrl
          const endpoint = apiBase ? `${apiBase}/api/produits/` : '/api/produits/'

          const itemPromises = pack.pack_items.map(async (item: any) => {
             try {
                const { data: product } = await axios.get<ProduitModel>(`${endpoint}${item.product}/`)
                return { product, quantity: item.quantity }
             } catch (e) {
                 return null
             }
          })
          const results = await Promise.all(itemPromises)
          const items = results.filter(i => i !== null) as { product: ProduitModel, quantity: number }[]

          if (items.length === 0) {
              toast.error(t('facturation:messages.pack_items_error'), { id: toastId })
              return
          }
          const totalNormalPrice = items.reduce((sum, item) => sum + (Number(item.product.selling_price) * item.quantity), 0)
          const packPrice = Number(pack.value)
          const ratio = totalNormalPrice > 0 ? packPrice / totalNormalPrice : 1
          
          const itemsToBulkAdd = items.map(({ product, quantity }) => {
              return {
                  product,
                  quantity,
                  discountPercent: ratio < 1 ? (Math.round((1 - ratio) * 10000) / 100).toFixed(0) : '0'
              }
          })
          cart.bulkAddProduits(itemsToBulkAdd)
          toast.success(t('facturation.messages.pack_added', { name: pack.name }), { id: toastId })
      } catch (e) {
          toast.error(t('facturation.messages.pack_error'), { id: toastId })
      }
  }, [cart.bulkAddProduits, apiBaseUrl, t])

  // CSV Import
  const handleCsvImport = useCallback(async (file: File) => {
      const toastId = toast.loading('Analyse et importation du fichier CSV...');
      try {
          const text = await file.text();
          const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
          if (lines.length === 0) {
              toast.error('Le fichier CSV est vide.', { id: toastId });
              return;
          }
          const params: { identifiers: string[], quantities: Record<string, number> } = {
              identifiers: [],
              quantities: {}
          };
          for (let i = 0; i < lines.length; i++) {
              const parts = lines[i].split(/[,;]/).map(s => s.trim());
              if (parts.length >= 2) {
                  const identifier = parts[0];
                  if (identifier.toLowerCase() === 'cip' || identifier.toLowerCase() === 'id') continue;
                  const quantity = parseInt(parts[1], 10);
                  if (identifier && !isNaN(quantity) && quantity > 0) {
                      params.identifiers.push(identifier);
                      params.quantities[identifier] = quantity;
                  }
              }
          }
          if (params.identifiers.length === 0) {
              toast.error('Aucune donnée valide trouvée dans le CSV.', { id: toastId });
              return;
          }
          const apiBase = apiBaseUrl;
          const endpoint = apiBase ? `${apiBase}/api/produits/bulk_search/` : '/api/produits/bulk_search/';
          let fetchedProducts: ProduitModel[] = [];
          try {
              const res = await axios.post(endpoint, { identifiers: params.identifiers });
              fetchedProducts = res.data;
          } catch (e) {
             const productPromises = params.identifiers.map(async (ident) => {
                  try {
                      const searchUrl = `${apiBase ? apiBase : ''}/api/produits/?search=${ident}`;
                      const res = await axios.get(searchUrl);
                      const results = res.data.results || res.data;
                      if (results && results.length > 0) {
                          const match = results.find((p: any) => p.cip1 === ident || String(p.id) === ident) || results[0];
                          return { identifier: ident, product: match };
                      }
                  } catch (err) { return null; }
                  return null;
             });
             const results = await Promise.all(productPromises);
             const items = results.filter(i => i !== null) as { identifier: string; product: ProduitModel }[];
             fetchedProducts = items.map(i => {
                (i.product as any)._matched_identifier = i.identifier; 
                return i.product;
             });
          }
          if (fetchedProducts.length === 0) {
              toast.error('Aucun produit correspondant trouvé.', { id: toastId });
              return;
          }
          const itemsToBulkAdd = fetchedProducts.map(product => {
              const identifier = (product as any)._matched_identifier || product.cip1 || String(product.id);
              const qty = params.quantities[identifier] || 1;
              return {
                  product,
                  quantity: qty,
                  discountPercent: '0'
              }
          });
          cart.bulkAddProduits(itemsToBulkAdd);
          toast.success(`${itemsToBulkAdd.length} produit(s) importé(s).`, { id: toastId });
      } catch (err) {
          toast.error("Erreur lecture CSV.", { id: toastId });
      }
  }, [cart.bulkAddProduits, apiBaseUrl])

  const clientsHook = useFacturationClients()
  const pendingSales = usePendingSales()

  // --- AUTO-SAVE LOGIC (SESSION CONTEXT) ---
  const { user } = useAuth();
  const contextStorageKey = useMemo(() => user?.id ? `activeSaleContext_${user.id}` : null, [user?.id]);
  const hasHydratedContextRef = useRef(false);

  // 1. Restore Session Data when User ID is available
  useEffect(() => {
    if (contextStorageKey && !hasHydratedContextRef.current) {
        const saved = safeStorage.getItem(contextStorageKey, 'local');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.selectedClient !== undefined) clientsHook.setSelectedClient(data.selectedClient);
                if (data.useManualClient !== undefined) clientsHook.setUseManualClient(data.useManualClient);
                if (data.manualClientName !== undefined) clientsHook.setManualClientName(data.manualClientName);
                if (data.remiseGlobale !== undefined) ui.setRemiseGlobale(data.remiseGlobale);
                if (data.remiseMode !== undefined) ui.setRemiseMode(data.remiseMode);
                if (data.isRetrocession !== undefined) setIsRetrocession(data.isRetrocession);
                if (data.isFactureA4 !== undefined) setIsFactureA4(data.isFactureA4);
                if (data.tempOrdonnanceData !== undefined) ui.setTempOrdonnanceData(data.tempOrdonnanceData);
                if (data.selectedAyantDroit !== undefined) clientsHook.setSelectedAyantDroit(data.selectedAyantDroit);
                if (data.ayantDroitNom !== undefined) clientsHook.setAyantDroitNom(data.ayantDroitNom);
                if (data.ayantDroitMatricule !== undefined) clientsHook.setAyantDroitMatricule(data.ayantDroitMatricule);
                if (data.ayantDroitSociete !== undefined) clientsHook.setAyantDroitSociete(data.ayantDroitSociete);
            } catch (e) {
                console.error("Erreur lors de la restauration de la session:", e);
            }
        }
        hasHydratedContextRef.current = true;
        
        // Cleanup old global key
        safeStorage.removeItem('activeSaleContext', 'local');
    }
  }, [contextStorageKey]);

  // 2. Persist Session Data on changes
  useEffect(() => {
    if (!contextStorageKey || !hasHydratedContextRef.current) return;

    const sessionData = {
        selectedClient: clientsHook.selectedClient,
        useManualClient: clientsHook.useManualClient,
        manualClientName: clientsHook.manualClientName,
        remiseGlobale: ui.remiseGlobale,
        remiseMode: ui.remiseMode,
        isRetrocession,
        isFactureA4,
        tempOrdonnanceData: ui.tempOrdonnanceData,
        selectedAyantDroit: clientsHook.selectedAyantDroit,
        ayantDroitNom: clientsHook.ayantDroitNom,
        ayantDroitMatricule: clientsHook.ayantDroitMatricule,
        ayantDroitSociete: clientsHook.ayantDroitSociete
    };
    
    // Only save if there's an actual active sale
    const isDefaultClient = !clientsHook.selectedClient || (clientsHook.clients.find(c => c.id === clientsHook.selectedClient)?.name.toLowerCase().includes('divers'));
    
    if (cart.lignesFacture.length > 0 || !isDefaultClient || clientsHook.useManualClient) {
        safeStorage.setItem(contextStorageKey, JSON.stringify(sessionData), 'local');
    } else {
        safeStorage.removeItem(contextStorageKey, 'local');
    }
  }, [
      contextStorageKey,
      clientsHook.selectedClient, clientsHook.useManualClient, clientsHook.manualClientName,
      ui.remiseGlobale, ui.remiseMode, isRetrocession, isFactureA4, ui.tempOrdonnanceData,
      clientsHook.selectedAyantDroit, clientsHook.ayantDroitNom, clientsHook.ayantDroitMatricule,
      clientsHook.ayantDroitSociete, cart.lignesFacture.length
  ]);

  // --- END AUTO-SAVE LOGIC ---

  const totals = useMemo(() => 
      ui.calculateTotals(cart.cartStats, clientsHook.clients.find(c => c.id === clientsHook.selectedClient)),
      [cart.cartStats, clientsHook.selectedClient, clientsHook.clients, ui.calculateTotals]
  )

  const isNewSale = !ui.facturePourPaiement

  const _resetSaleDataOnly = () => {
      cart.setLignesFacture([])
      clientsHook.setClientSearch('')
      clientsHook.setManualClientName('')
      clientsHook.setSelectedClient(null)
      setActiveSudoCreds(null)
      const clientsDivers = clientsHook.clients.find(c => c.name.toLowerCase() === 'clients divers')
      clientsHook.setSelectedClient(clientsDivers ? clientsDivers.id : null)
      clientsHook.setUseManualClient(false)
      clientsHook.setManualClientName('')
      ui.setRemiseGlobale('0')
      ui.setRemiseMode('montant')
      clientsHook.setAyantDroitNom('')
      clientsHook.setAyantDroitMatricule('')
      clientsHook.setAyantDroitSociete('')
      clientsHook.setSelectedAyantDroit(null)
      clientsHook.setShowNewAyantDroit(false)
      productSearch.setSearchQuery('')
      ui.setTempOrdonnanceData(null)
      
      // Nettoyer explicitement le cache auto-save (clé dynamique)
      if (user?.id) {
        safeStorage.removeItem(`activeCartLignes_${user.id}`, 'local')
        safeStorage.removeItem(`activeSaleContext_${user.id}`, 'local')
      }
      
      setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  const { completeSale, completeExistingInvoicePayment, loading: saleLoading } = useSaleCompletion({
    onSuccess: (result) => {
        if (result.success && result.facture) {
            setSuccessInfo(result.facture)
            ui.setTicketCaisse(result.ticketCaisse || null)
            
            if (isFactureA4) {
               if (result.facture) {
                   const normalize = (str: string) => str?.toLowerCase().trim() || '';
                   const clientName = normalize(result.facture.client_name || '');
                   const isGenericClient = !result.facture.client_name_override && (
                       !clientName || clientName.includes('passage') || clientName.includes('divers')
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
               setIsFactureA4(false)
            } else {
               if (result.ticketCaisse) ui.setShowTicketPreview(true)
            }
            
            ui.resetUIState()

            cart.lignesFacture.forEach((ligne: any) => {
                queryClient.setQueriesData({ queryKey: ['produits'] }, (oldData: any) => {
                    if (!oldData) return oldData;
                    if (oldData.results && Array.isArray(oldData.results)) {
                        return {
                            ...oldData,
                            results: oldData.results.map((p: any) => 
                                p.id === ligne.produit.id ? { ...p, stock: Math.max(0, (p.stock || 0) - ligne.quantite) }  : p
                            )
                        };
                    } else if (Array.isArray(oldData)) {
                        return oldData.map((p: any) => 
                            p.id === ligne.produit.id ? { ...p, stock: Math.max(0, (p.stock || 0) - ligne.quantite) }  : p
                        );
                    }
                    return oldData;
                });
                queryClient.setQueriesData({ queryKey: ['produit', ligne.produit.id] }, (oldData: any) => {
                    if (!oldData) return oldData;
                    return { ...oldData, stock: Math.max(0, (oldData.stock || 0) - ligne.quantite) };
                });
            });

            _resetSaleDataOnly()
            ui.closePaymentModal()
        }
    },
    onReset: _resetSaleDataOnly,
    onError: (msg) => setError(msg)
  })

  // Load Devis on Mount
  useEffect(() => {
    const loadDevis = async () => {
      if (hasLoadedDevisRef.current) return
      const devisString = safeStorage.getItem('devis_to_load', 'local')
      if (!devisString) return
      try {
        hasLoadedDevisRef.current = true
        const devis = JSON.parse(devisString) as Facture
        
        if (devis.client) {
          clientsHook.setSelectedClient(devis.client)
          clientsHook.setUseManualClient(false)
          if (devis.ayant_droit) clientsHook.setSelectedAyantDroit(devis.ayant_droit)
        } else if (devis.client_name_override) {
          clientsHook.setUseManualClient(true)
          clientsHook.setManualClientName(devis.client_name_override)
        }
        
        if (devis.produits && devis.produits.length > 0) {
          const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''
          const produitsEndpoint = apiBase ? `${apiBase}/api/produits/` : '/api/produits/'
          
          const lignes: LigneFacture[] = await Promise.all(devis.produits.map(async (p: any) => {
            let produitData: ProduitModel
            if (typeof p.produit === 'object' && p.produit.stock !== undefined) {
              produitData = p.produit
            } else {
              const produitId = typeof p.produit === 'object' ? p.produit.id : p.produit
              try {
                const { data: fullProduct } = await axios.get<ProduitModel>(`${produitsEndpoint}${produitId}/`)
                produitData = fullProduct
              } catch {
                produitData = { id: produitId, name: p.produit_nom || `Produit #${produitId}`, stock: 0, is_deleted: true } as ProduitModel
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
          cart.setLignesFacture(lignes)
        }
        
        if (devis.remise) {
          ui.setRemiseGlobale(devis.remise)
          ui.setRemiseMode('montant')
        }
        
        const isValidatedOrPaid = devis.status === 'VAL' || devis.status === 'PAY'
        if (isValidatedOrPaid && devis.id) {
          ui.setIsModificationMode(true)
          ui.setModificationInvoiceId(devis.id)
          ui.setModificationInvoiceStatus(devis.status || null)
          ui.setOriginalTotalTtc(Number(devis.total_ttc || 0))
          toast.success(`Facture #${devis.numero_facture || devis.id} chargée en mode modification`)
        } else if (devis.id) {
          toast.success(`Devis #${devis.numero_facture || devis.id} chargé`)
        } else {
          toast.success(`Panier pré-rempli à partir de la copie`)
        }
        safeStorage.removeItem('devis_to_load', 'local')
      } catch (err) {
        toast.error('Impossible de charger le devis')
        safeStorage.removeItem('devis_to_load', 'local')
      }
    }
    loadDevis()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchInputRef.current?.focus(), 300)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      try {
        const settingsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/invoice-settings/` : '/api/invoice-settings/'
        const settingsRes = await axios.get(settingsEndpoint)
        setCentralizedCashRegister(settingsRes.data?.centralized_cash_register ?? true)
      } catch (err) {
        handleApiError(err, 'Erreur lors du chargement des paramètres.')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [apiBaseUrl, handleApiError])

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

  useEffect(() => {
    setPointsToUse(0)
    setUsePendingDiscount(false)
  }, [clientsHook.selectedClient, isNewSale])



  // Payment Preparation
  const handlePaymentClick = async () => {
      setLoading(true)
      let freshLignes = cart.lignesFacture;
      try {
          const productIds = cart.lignesFacture.map((l: any) => l.produit.id);
          const refreshEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/produits/bulk_refresh/` : '/api/produits/bulk_refresh/';
          const { data: freshProductsData } = await axios.post<any[]>(refreshEndpoint, { ids: productIds });
          
          const productMap = new Map(freshProductsData.map((p: any) => [p.id, p]));
          freshLignes = cart.lignesFacture.map((ligne: any) => {
              const freshProduct = productMap.get(ligne.produit.id);
              if (freshProduct) {
                  return {
                      ...ligne,
                      isPromis: ligne.isPromis,
                      promisQuantity: ligne.promisQuantity,
                      promisPhone: ligne.promisPhone,
                      produit: { ...ligne.produit, stock: freshProduct.stock, selling_price: freshProduct.selling_price, is_active: freshProduct.is_active }
                  };
              }
              return ligne;
          });
      } catch (e) {
          toast.error(t('facturation.messages.refresh_failed') || "Erreur de rafraîchissement des stocks");
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
          const montantInitial = (totals.tauxCouverture > 0) ? totals.partPatient : totals.totalTtc
          ui.setMontantPaye(montantInitial.toString())
          ui.openPaymentModal()
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

  // Sorting and Keyboard Config
  const sortedLignes = useMemo(() => {
    if (sortBy === 'chrono') return cart.lignesFacture;
    return [...cart.lignesFacture].sort((a: any, b: any) => {
      if (sortBy === 'name') return (a.produit.name || '').localeCompare(b.produit.name || '');
      if (sortBy === 'stock') return (b.produit.stock || 0) - (a.produit.stock || 0);
      if (sortBy === 'qty') return b.quantite - a.quantite;
      return 0;
    });
  }, [cart.lignesFacture, sortBy])

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

  const handleAddAlertMessage = useCallback(() => {
    // 1. Check if a product is selected
    if (keyboardNav.selectedIndex >= 0 && sortedLignes[keyboardNav.selectedIndex]) {
      const ligne = sortedLignes[keyboardNav.selectedIndex];
      ui.setAlertTarget({
         type: 'product',
         id: ligne.produit.id,
         name: ligne.produit.name,
         currentMessage: ligne.produit.message_alerte || ''
      });
      ui.setIsAlertModalOpen(true);
      return;
    }
    
    // 2. Check if a client is selected
    if (clientsHook.selectedClient && !clientsHook.useManualClient) {
      const client = clientsHook.clients.find(c => c.id === clientsHook.selectedClient);
      if (client) {
         ui.setAlertTarget({
            type: 'client',
            id: client.id,
            name: client.name,
            currentMessage: client.message_alerte || ''
         });
         ui.setIsAlertModalOpen(true);
      }
    }
  }, [keyboardNav.selectedIndex, sortedLignes, clientsHook.selectedClient, clientsHook.useManualClient, clientsHook.clients, ui.setAlertTarget, ui.setIsAlertModalOpen]);


  const handleLotSelect = (lot: any | null) => {
      if (!ui.lotModal.product) return
      cart.updateLineLot(ui.lotModal.product.id, lot)
      ui.closeLotModal()
      setTimeout(() => searchInputRef.current?.focus(), 100)
  }

  const handleCompleteSale = async (sudoCredentials?: { validatorId: number, password: string }) => {
    const effectiveSudo = sudoCredentials || activeSudoCreds;
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
        totals: {
            totalHt: totals.totalHt,
            totalTva: totals.totalTva,
            totalTtc: totals.totalTtc,
            remiseMontant: totals.remiseMontant,
            tauxCouverture: totals.tauxCouverture,
            partPatient: totals.partPatient,
            partAssurance: totals.partAssurance
        },
        modePaiement: ui.modePaiement,
        montantPaye: ui.montantPaye,
        paiements: ui.paiements,
        reference: ui.reference,
        couponNumero: '',
        usePendingDiscount,
        pointsToUse,
        isRetrocession,
        centralizedCashRegister,
        isModificationMode: ui.isModificationMode,
        devisIdToValidate: null,
        tempOrdonnanceData: ui.tempOrdonnanceData,
        validated_by_id: effectiveSudo?.validatorId || null,
        sudo_password: effectiveSudo?.password || undefined,
        modificationInvoiceId: ui.modificationInvoiceId,
        modificationInvoiceStatus: ui.modificationInvoiceStatus || undefined
    };
    await completeSale(params);
  };

  const handleQuantityShortcut = useCallback((qty: number) => {
    if (cart.lignesFacture.length > 0) {
      const lastLine = cart.lignesFacture[cart.lignesFacture.length - 1];
      secureUpdateQuantite(lastLine.produit.id, qty);
      toast.success(`Quantité mise à jour : ${qty} x ${lastLine.produit.name}`, { icon: '🔢' });
    } else {
      toast.error("Aucun produit dans le panier pour appliquer une quantité");
    }
  }, [cart.lignesFacture, secureUpdateQuantite]);

  const handleOrdonnanceSave = async (data: OrdonnanceData) => {
    setLoading(true);
    try {
        const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/ordonnancier/` : '/api/ordonnancier/';
        const lignesForBackend = data.lignes.map((ligne: any) => ({
          produit: ligne.produit_id,
          produit_nom: ligne.produit_nom,
          quantite: ligne.quantite,
          surveillance_category: ligne.surveillance_category
        }));
        const payload = {
            patient_nom: data.patient_nom,
            prescripteur_nom: data.prescripteur_nom,
            facture: ui.pendingOrdonnanceFacture?.id || null,
            lignes: lignesForBackend
        };
        await axios.post(endpoint, payload);
        toast.success(t('prescriptions:messages.save_success'));
        ui.setShowOrdonnanceModal(false);
        ui.setPendingOrdonnanceFacture(null);
    } catch (err: any) {
        toast.error(t('prescriptions:messages.save_error') + ": " + (err.response?.data?.detail || err.message));
    } finally {
        setLoading(false);
    }
  };

  const handleProforma = async () => {
    if (cart.lignesFacture.length === 0) return
    setLoading(true)
    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const factureProduitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/facture-produits/` : '/api/facture-produits/'
      
      const facturePayload = {
        client: clientsHook.useManualClient ? null : clientsHook.selectedClient,
        client_name_override: clientsHook.useManualClient ? clientsHook.manualClientName : null,
        remise: totals.remiseMontant.toString(),
        tva: '0',
        status: 'PROF',
        ayant_droit: clientsHook.selectedAyantDroit,
        part_client: (clientsHook.selectedClient && clientsHook.clients.find(c => c.id === clientsHook.selectedClient)?.client_type === 'PROFESSIONNEL' && totals.tauxCouverture > 0) ? totals.partPatient : null
      }
      const { data: createdFacture } = await axios.post(facturesEndpoint, facturePayload)
      
      const produitsPayload = cart.lignesFacture.map((ligne: any) => {
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
      
      await Promise.all(produitsPayload.map((payload: any) => axios.post(factureProduitsEndpoint, payload)))
      
      try {
          window.open(`/app/print-invoice/${createdFacture.id}`, '_blank')
          toast.success("Proforma généré avec succès")
      } catch (err) {}
      
      cart.setLignesFacture([])
      ui.setMontantPaye('')
      ui.setModePaiement('especes')
      ui.setPaiements([{ mode: 'especes', montant: 0 }])
      clientsHook.setSelectedClient(null)
      clientsHook.setManualClientName('')
      ui.setTicketCaisse(null)
    } catch (error) {
      toast.error("Erreur lors de la création du proforma")
    } finally {
      setLoading(false)
    }
  }

  const handleBonDeLivraison = async () => {
    if (cart.lignesFacture.length === 0) {
      toast.error("Le panier est vide")
      return
    }
    if (ui.isModificationMode && ui.modificationInvoiceId) {
      window.open(`/app/print-invoice/${ui.modificationInvoiceId}?type=BL`, '_blank')
      return
    }

    setLoading(true)
    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const factureProduitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/facture-produits/` : '/api/facture-produits/'

      const facturePayload = {
        client: clientsHook.selectedClient || null,
        client_name_override: clientsHook.manualClientName || null,
        ayant_droit: clientsHook.selectedAyantDroit || null,
        status: 'PROF',
        remise: Number(ui.remiseGlobale) || 0,
        notes: "Généré via Bon de Livraison"
      }
      
      const res = await axios.post(facturesEndpoint, facturePayload, {
        headers: { Authorization: `Token ${safeStorage.getItem('authToken')}` }
      })
      const createdFacture = res.data
      
      const produitsPayload = cart.lignesFacture.map((ligne: any) => {
        const prixUnitaire = Number(ligne.prix_unitaire)
        const remiseProduit = Number(ligne.remise_produit) || 0
        const prixNet = prixUnitaire * (1 - remiseProduit / 100)
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
      
      for (const payload of produitsPayload) {
        await axios.post(factureProduitsEndpoint, payload, {
          headers: { Authorization: `Token ${safeStorage.getItem('authToken')}` }
        })
      }
      
      window.open(`/app/print-invoice/${createdFacture.id}?type=BL`, '_blank')
      
      ui.setModificationInvoiceId(createdFacture.id)
      ui.setModificationInvoiceStatus('PROF')
      ui.setIsModificationMode(true)
      
      toast.success("Bon de livraison généré - Document prêt pour validation")
    } catch (error: any) {
      toast.error(`Erreur lors de la création du document : ${error.message}`)
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
          await axios.patch(`${apiBaseUrl}/api/factures/${pendingPrintFacture.id}/`,
              { client_name_override: clientNameInput }
          );
          let url = `/app/print-invoice/${pendingPrintFacture.id}`;
          if (clientNameInput) url += `?client_name=${encodeURIComponent(clientNameInput)}`;
          window.open(url, '_blank');
      } catch (error) {
          let url = `/app/print-invoice/${pendingPrintFacture.id}`;
          if (clientNameInput) url += `?client_name=${encodeURIComponent(clientNameInput)}`;
          window.open(url, '_blank');
      } finally {
          setShowClientNameModal(false);
          setPendingPrintFacture(null);
          setTimeout(() => searchInputRef.current?.focus(), 100);
      }
  };

  const ouvrirModalPaiement = (facture?: Facture) => {
    if (facture) {
      ui.setMontantPaye(Math.round(Number(facture.total_ttc)).toString())
      ui.openPaymentModal(facture)
    } else {
      if (!clientsHook.selectedClient) {
        setError('Veuillez sélectionner un client')
        return
      }
      if (cart.lignesFacture.length === 0) {
        setError('Veuillez ajouter au moins un produit')
        return
      }
      ui.setMontantPaye(Math.round(totals.totalTtc).toString())
      ui.openPaymentModal()
    }
    ui.setModePaiement('especes')
    ui.setReference('')
    ui.setPaiements([])
    setTimeout(() => {
        paymentInputRef.current?.focus()
        paymentInputRef.current?.select()
    }, 100)
  }

  const handleSendWhatsApp = async () => {
    if (!ui.ticketCaisse || !ui.ticketCaisse.facture || typeof ui.ticketCaisse.facture === 'number') return
    const facture = ui.ticketCaisse.facture as any
    const clientPhone = (typeof facture.client === 'object' ? facture.client?.phone : '') || facture.client_phone
    const phone = window.prompt(t('facturation.messages.enter_whatsapp_number') || 'Entrez le numéro WhatsApp', clientPhone || '')
    if (!phone) return

    setLoading(true)
    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const response = await axios.post(`${facturesEndpoint}${facture.id}/send_whatsapp/`, { phone: phone })
      toast.success(response.data.detail || 'Ticket envoyé par WhatsApp !')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'envoi WhatsApp")
    } finally {
      setLoading(false)
    }
  }

  const _resetSale = () => {
    cart.setLignesFacture([])
    const clientsDivers = clientsHook.clients.find(c => c.name.toLowerCase() === 'clients divers')
    clientsHook.setSelectedClient(clientsDivers ? clientsDivers.id : null)
    clientsHook.setUseManualClient(false)
    clientsHook.setManualClientName('')
    ui.resetUIState()
    clientsHook.setAyantDroitNom('')
    clientsHook.setAyantDroitMatricule('')
    clientsHook.setAyantDroitSociete('')
    clientsHook.setSelectedAyantDroit(null)
    clientsHook.setShowNewAyantDroit(false)
    productSearch.setSearchQuery('')
    setError(null)
    ui.setTempOrdonnanceData(null)
    searchInputRef.current?.focus()
  }

  const mettreEnAttente = () => {
    if (cart.lignesFacture.length === 0) {
      setError('Impossible de mettre en attente une vente vide')
      return
    }
    if (pendingSales.ventesEnAttente.length >= 4) {
      setError('Maximum 4 ventes en attente atteint')
      return
    }
    const clientName = !clientsHook.useManualClient && clientsHook.selectedClient 
        ? clientsHook.clients.find(c => c.id === clientsHook.selectedClient)?.name || ''
        : clientsHook.manualClientName
    
    const ayantDroitData = clientsHook.selectedAyantDroit || clientsHook.showNewAyantDroit || clientsHook.ayantDroitNom ? {
        id: clientsHook.selectedAyantDroit,
        nom: clientsHook.ayantDroitNom,
        matricule: clientsHook.ayantDroitMatricule,
        societe: clientsHook.ayantDroitSociete,
        showNew: clientsHook.showNewAyantDroit
    } : null

    pendingSales.savePendingSale({
        client: clientsHook.useManualClient ? null : clientsHook.selectedClient,
        clientName,
        useManualClient: clientsHook.useManualClient,
        manualClientName: clientsHook.manualClientName,
        lignes: cart.lignesFacture,
        remise: ui.remiseGlobale,
        remiseMode: ui.remiseMode,
        ayantDroit: ayantDroitData
    })
    _resetSale()
    toast.success('Vente mise en attente')
  }

  const annulerVente = () => {
    if (cart.lignesFacture.length > 0) {
      ui.setConfirmModal({
          isOpen: true,
          message: t('facturation.messages.cancel_sale_confirm', { defaultValue: 'Êtes-vous sûr de vouloir annuler cette vente en cours ? Tout le panier sera perdu.' }),
          onConfirm: () => _resetSale()
      })
      return
    }
    _resetSale()
  }

  const restaurerVente = (id: number) => {
      const vente = pendingSales.ventesEnAttente.find(v => v.id === id)
      if (!vente) return
      if (cart.lignesFacture.length > 0) {
          if (!window.confirm('Le panier actuel n\'est pas vide. Voulez-vous le remplacer par la vente en attente ?')) return
      }
      cart.setLignesFacture(vente.lignes)
      clientsHook.setUseManualClient(vente.useManualClient)
      clientsHook.setManualClientName(vente.manualClientName)
      ui.setRemiseGlobale(vente.remise)
      ui.setRemiseMode(vente.remiseMode)
      if (vente.client) clientsHook.setSelectedClient(vente.client)
      else clientsHook.setSelectedClient(null)
      if (vente.ayantDroit) {
          clientsHook.setSelectedAyantDroit(vente.ayantDroit.id)
          clientsHook.setAyantDroitNom(vente.ayantDroit.nom)
          clientsHook.setAyantDroitMatricule(vente.ayantDroit.matricule)
          clientsHook.setAyantDroitSociete(vente.ayantDroit.societe)
          clientsHook.setShowNewAyantDroit(vente.ayantDroit.showNew)
      }
      pendingSales.deletePendingSale(id)
      pendingSales.setShowPendingSales(false)
      toast.success(t('facturation:messages.save_success'))
  }

  const supprimerVenteEnAttente = (id: number) => {
     ui.setConfirmModal({
        isOpen: true,
        message: "Voulez-vous vraiment supprimer cette vente en attente ?",
        onConfirm: () => {
             pendingSales.deletePendingSale(id);
             ui.setConfirmModal(null);
             toast.success("Vente en attente supprimée");
        }
     });
  }

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
    handleSuspendSale: mettreEnAttente,
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
    showClientNameModal, setShowClientNameModal,
    pendingPrintFacture, setPendingPrintFacture,
    showHelp, setShowHelp,
    
    // Core state
    isRetrocession, setIsRetrocession,
    isFactureA4, setIsFactureA4,
    sortBy, setSortBy,
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
    handleProforma,
    handleBonDeLivraison,
    addPackToFacture,
    mettreEnAttente,
    annulerVente,
    restaurerVente,
    supprimerVenteEnAttente,
    handlePaymentClick,
    handlePaymentClickWithSudo,
    ouvrirModalPaiement,
    handleSendWhatsApp,
    handleImprimerFacture,
    handleConfirmPrintClientName,
    handleOrdonnanceSave,
    handleLotSelect,
    handleQuantityShortcut,
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
    paymentInputRef
  }
}
