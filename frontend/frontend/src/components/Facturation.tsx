import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import type { ProduitModel, Client, Facture, TicketCaisse } from '../types'

// Interface locale pour la gestion des lignes de facture dans le state
type LigneFacture = {
  produit: ProduitModel
  quantite: number
  prix_unitaire: string
  remise_produit: string // Remise en pourcentage pour ce produit
  total_ligne: number
}

type FactureProduitPayload = {
  facture: number
  produit: number
  quantity: number
  selling_price: string
  lot: string | null
  date_expiration: string | null
}

const normalizeNumberInput = (value: string | number, options?: { min?: number; max?: number }) => {
  let parsedValue = typeof value === 'number' ? value : Number(value)

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
  const [produits, setProduits] = useState<ProduitModel[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<number | null>(null)
  const [manualClientName, setManualClientName] = useState('') // Nom client saisi manuellement
  const [useManualClient, setUseManualClient] = useState(false) // Toggle entre select et input
  const [lignesFacture, setLignesFacture] = useState<LigneFacture[]>([])
  const [loading, setLoading] = useState(false)
  const [remise, setRemise] = useState('0')
  const [remiseMode, setRemiseMode] = useState<'montant' | 'taux'>('montant') // Mode de remise globale
  const [tva, setTva] = useState('0')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<Facture | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [modePaiement, setModePaiement] = useState<'especes' | 'cheque' | 'carte' | 'virement' | 'en_compte'>('especes')
  const [montantPaye, setMontantPaye] = useState('')
  const [reference, setReference] = useState('')
  const [facturePourPaiement, setFacturePourPaiement] = useState<Facture | null>(null)
  const [ticketCaisse, setTicketCaisse] = useState<TicketCaisse | null>(null)
  const [showTicketPreview, setShowTicketPreview] = useState(false)

  // Keyboard Navigation State
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const clientSelectRef = useRef<HTMLSelectElement>(null)
  const productListRef = useRef<HTMLDivElement>(null)
  const paymentInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (successInfo && successInfo.status !== 'PAY') {
      setMontantPaye(Math.round(Number(successInfo.total_ttc)).toString())
    }
  }, [successInfo])

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : ''
  }, [])
  const produitsEndpoint = apiBaseUrl
    ? `${apiBaseUrl}/api/produits/`
    : '/api/produits/'
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
        const [produitsRes, clientsRes] = await Promise.all([
          axios.get<ProduitModel[]>(produitsEndpoint),
          axios.get<Client[]>(clientsEndpoint)
        ])
        setProduits(produitsRes.data)
        setClients(clientsRes.data)
        
        // Sélectionner "Clients divers" par défaut
        const defaultClient = clientsRes.data.find(c => c.name.toLowerCase() === 'clients divers')
        if (defaultClient) {
          setSelectedClient(defaultClient.id)
        }
      } catch (err) {
        handleApiError(err, 'Erreur lors du chargement des données.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [produitsEndpoint, clientsEndpoint, handleApiError])

  // Fonction pour calculer le total d'une ligne avec remise produit
  const calculateLigneTotal = (quantite: number, prixUnitaire: string, remiseProduit: string): number => {
    const qty = Math.abs(quantite)
    const prix = normalizeNumberInput(prixUnitaire, { min: 0 })
    const remise = normalizeNumberInput(remiseProduit, { min: 0, max: 100 })
    const sousTotal = qty * prix
    const montantRemise = sousTotal * (remise / 100)
    return sousTotal - montantRemise
  }

  const addProduitToFacture = (produit: ProduitModel) => {
    const existingLigne = lignesFacture.find(ligne => ligne.produit.id === produit.id)

    if (existingLigne) {
      // Pour les quantités positives, vérifier le stock
      // Pour les quantités négatives (retours), permettre sans limite
      const nouvelleQuantite = existingLigne.quantite + 1
      if (nouvelleQuantite > 0 && nouvelleQuantite > (produit.stock ?? 0) && !user?.can_sell_negative_stock) {
        setError(`Le stock pour "${produit.name}" est insuffisant. Stock disponible: ${produit.stock}`)
        return
      }
      const updatedLignes = lignesFacture.map(ligne =>
        ligne.produit.id === produit.id
          ? {
              ...ligne,
              quantite: nouvelleQuantite,
              total_ligne: calculateLigneTotal(nouvelleQuantite, ligne.prix_unitaire, ligne.remise_produit),
            }
          : ligne
      )
      setLignesFacture(updatedLignes)
    } else {
      // Permettre l'ajout même si le stock est à 0 (pour les retours avec quantité négative)
      const prixUnitaire = normalizeNumberInput(produit.selling_price ?? '0', { min: 0 })
      const nouvelleLigne: LigneFacture = {
        produit,
        quantite: 1,
        prix_unitaire: produit.selling_price ?? '0',
        remise_produit: '0',
        total_ligne: prixUnitaire,
      }
      setLignesFacture([...lignesFacture, nouvelleLigne])
    }
    // Clear search after adding (optional, but good for flow)
    // setSearchQuery('') 
    // Instead of clearing, maybe just keep focus on search
    searchInputRef.current?.focus()
  }

  const updateQuantite = (produitId: number, quantite: number) => {
    // Permettre les quantités négatives (retours) et positives (ventes)
    const normalizedQuantite = Math.floor(normalizeNumberInput(quantite))

    if (normalizedQuantite === 0) {
      // Supprimer la ligne si quantité = 0
      setLignesFacture(lignesFacture.filter(ligne => ligne.produit.id !== produitId))
      return
    }

    const ligne = lignesFacture.find(l => l.produit.id === produitId)
    
    // Vérifier les permissions pour les retours (quantité négative)
    if (normalizedQuantite < 0 && !user?.can_do_returns) {
      setError("Vous n'avez pas la permission d'effectuer des retours (quantités négatives).")
      return
    }

    // Vérifier le stock seulement pour les quantités positives (ventes)
    // Les quantités négatives (retours) sont autorisées
    if (ligne && normalizedQuantite > 0 && normalizedQuantite > (ligne.produit.stock ?? 0) && !user?.can_sell_negative_stock) {
      setError(`La quantité ne peut pas dépasser le stock disponible (${ligne.produit.stock})`)
      return
    }
    const updatedLignes = lignesFacture.map(ligne => 
      ligne.produit.id === produitId
        ? { 
            ...ligne, 
            quantite: normalizedQuantite, 
            total_ligne: calculateLigneTotal(normalizedQuantite, ligne.prix_unitaire, ligne.remise_produit)
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

  const removeLigne = (produitId: number) => {
    setLignesFacture(lignesFacture.filter(ligne => ligne.produit.id !== produitId))
  }

  const totals = useMemo(() => {
    // Sous-total après remises produits
    const sousTotal = lignesFacture.reduce((total, ligne) => total + normalizeNumberInput(ligne.total_ligne, { min: 0 }), 0)
    
    // Calculer la remise globale selon le mode
    let remiseMontant = 0
    if (remiseMode === 'montant') {
      remiseMontant = Math.min(sousTotal, normalizeNumberInput(remise, { min: 0 }))
    } else {
      // Mode taux (pourcentage)
      const tauxRemise = normalizeNumberInput(remise, { min: 0, max: 100 })
      remiseMontant = sousTotal * (tauxRemise / 100)
    }
    
    const tvaRate = normalizeNumberInput(tva, { min: 0 })
    const baseHT = sousTotal - remiseMontant
    const montantTva = Math.round(baseHT * (tvaRate / 100))
    const totalTtc = baseHT + montantTva

    return {
      sousTotal,
      remiseMontant,
      montantTva,
      totalTtc,
    }
  }, [lignesFacture, remise, remiseMode, tva])

  // Filtrer les produits selon la recherche
  const filteredProduits = useMemo(() => {
    return produits.filter(produit =>
      produit.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [produits, searchQuery])

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  // Scroll selected product into view
  useEffect(() => {
    if (productListRef.current) {
      const selectedElement = productListRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  const [isNewSale, setIsNewSale] = useState(false)

  const handleCompleteSale = async () => {
    if (!selectedClient) {
      setError('Veuillez sélectionner un client')
      return
    }
    if (lignesFacture.length === 0) {
      setError('Veuillez ajouter au moins un produit')
      return
    }
    if (!montantPaye || Number(montantPaye) <= 0) {
      setError('Veuillez entrer un montant valide')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessInfo(null)
    
    const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
    const factureProduitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/facture-produits/` : '/api/facture-produits/'
    const caisseEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/caisse/` : '/api/caisse/'

    try {
      // 1. Créer la facture en mode brouillon
      const facturePayload = {
        client: useManualClient ? null : selectedClient,
        client_name_override: useManualClient ? manualClientName : null,
        remise: totals.remiseMontant.toString(),
        tva: normalizeNumberInput(tva, { min: 0 }).toString(),
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
          lot: null,
          date_expiration: null,
        }
      })

      await Promise.all(
        produitsPayload.map(payload => axios.post(factureProduitsEndpoint, payload))
      )

      // 3. Valider la facture
      const validerEndpoint = `${facturesEndpoint}${createdFacture.id}/valider/`
      const { data: validatedFacture } = await axios.post<Facture>(validerEndpoint)

      // 4. Enregistrer le paiement
      // On enregistre le montant total de la facture comme paiement, pas le montant donné (qui sert au rendu monnaie)
      const paiementPayload = {
        facture: validatedFacture.id,
        mode_paiement: modePaiement,
        montant: validatedFacture.total_ttc, // Utiliser le total TTC validé
        reference: reference || null,
        statut: 'completee',
      }
      const caisseResponse = await axios.post(caisseEndpoint, paiementPayload)

      // 5. Mettre à jour le statut de la facture à "PAYEE"
      const factureUpdateEndpoint = `${facturesEndpoint}${validatedFacture.id}/`
      await axios.patch(factureUpdateEndpoint, { status: 'PAY' })

      // 6. Récupérer la facture finale mise à jour
      const { data: finalFacture } = await axios.get<Facture>(factureUpdateEndpoint)

      // 7. Finaliser
      const montantVerse = Number(montantPaye)
      const rendu = montantVerse - Number(finalFacture.total_ttc)

      setSuccessInfo(finalFacture)
      setTicketCaisse({
        ...caisseResponse.data,
        facture: finalFacture,
        montant_verse: montantVerse.toString(),
        rendu: rendu.toString()
      })
      
      setLignesFacture([])
      setSelectedClient(null)
      setRemise('0')
      fermerModalPaiement()
      
      // Rafraîchir les stocks
      try {
        const produitsResponse = await axios.get<ProduitModel[]>(produitsEndpoint)
        setProduits(produitsResponse.data)
      } catch (err) {
        console.error('Erreur lors du rafraîchissement des produits:', err)
      }

    } catch (err) {
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

      const paiementPayload = {
        facture: factureAPayer.id,
        mode_paiement: modePaiement,
        montant: factureAPayer.total_ttc, // Utiliser le total TTC de la facture
        reference: reference || null,
        statut: 'completee',
      }

      // Créer le ticket de caisse
      const caisseResponse = await axios.post(caisseEndpoint, paiementPayload)
      
      // Mettre à jour le statut de la facture à "PAYEE"
      const factureUpdateEndpoint = apiBaseUrl
        ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/factures/${factureAPayer.id}/`
        : `/api/factures/${factureAPayer.id}/`

      await axios.patch(factureUpdateEndpoint, { status: 'PAY' })
      
      // Rafraîchir les données de la facture
      const { data: factureUpdated } = await axios.get<Facture>(factureUpdateEndpoint)

      const montantVerse = Number(montantPaye)
      const rendu = montantVerse - Number(factureUpdated.total_ttc)

      setSuccessInfo(factureUpdated)
      setTicketCaisse({
        ...caisseResponse.data,
        facture: factureUpdated,
        montant_verse: montantVerse.toString(),
        rendu: rendu.toString()
      })
      
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
    setReference('')
    setModePaiement('especes')
    setIsNewSale(false)
    
    // Retourner le focus à la recherche
    setTimeout(() => {
        searchInputRef.current?.focus()
    }, 100)
  }

  // Global Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if inside an input/textarea UNLESS it's a specific shortcut key
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement
      
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

      // Navigation dans la liste des produits (si focus sur recherche ou pas d'autre input focus)
      if (!isPaymentModalOpen && !showTicketPreview && (!isInput || e.target === searchInputRef.current)) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => Math.min(prev + 1, filteredProduits.length - 1))
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
        }
        if (e.key === 'Enter') {
           // Si on est dans le champ de recherche, Enter ajoute le produit sélectionné
           if (e.target === searchInputRef.current && filteredProduits[selectedIndex]) {
             e.preventDefault()
             addProduitToFacture(filteredProduits[selectedIndex])
           }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredProduits, selectedIndex, lignesFacture, selectedClient, isPaymentModalOpen, showTicketPreview, successInfo])

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
      {error && (
        <div className="px-6 pt-4 shrink-0">
            <div role="alert" className="alert alert-error shadow-sm rounded-lg py-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error}</span>
            <button className="btn btn-sm btn-ghost btn-square" onClick={() => setError(null)}>✕</button>
            </div>
        </div>
      )}

      {successInfo && (
        <div className="px-6 pt-4 shrink-0">
            <div role="alert" className="alert alert-success shadow-sm rounded-lg py-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div className="flex-1 flex items-center justify-between">
                <div className="text-sm">
                    <span className="font-bold">Succès !</span> Facture <span className="font-mono font-bold">{successInfo.numero_facture}</span> • {Math.round(Number(successInfo.total_ttc))} F
                </div>
                <div className="flex gap-2">
                    {successInfo.status !== 'PAY' && (
                        <button className="btn btn-xs btn-primary" onClick={() => ouvrirModalPaiement(successInfo)}>Payer</button>
                    )}
                    {successInfo.status === 'PAY' && ticketCaisse && (
                        <button className="btn btn-xs btn-info" onClick={() => setShowTicketPreview(true)}>Ticket</button>
                    )}
                    <button className="btn btn-xs btn-outline" onClick={() => handleImprimerFacture(successInfo)}>Imprimer</button>
                    <button className="btn btn-xs btn-ghost" onClick={() => setSuccessInfo(null)}>Fermer</button>
                </div>
            </div>
            </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 md:p-4 lg:p-6 gap-4 lg:gap-6">
        {/* Left Panel: Search & Products */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 min-h-0 h-auto lg:h-full">
            {/* Client Selection */}
            <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-base-200 shrink-0">
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

            {/* Product Search & List */}
            <div className="bg-white rounded-xl shadow-sm border border-base-200 flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="p-4 border-b border-base-100 shrink-0">
                     <label className="label text-xs font-bold text-base-content/50 uppercase tracking-wider py-0 mb-2">Produits (F2)</label>
                    <div className="relative">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Rechercher..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input input-bordered w-full pl-9 bg-base-50 focus:bg-white transition-colors"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1" ref={productListRef}>
                    {filteredProduits.length === 0 ? (
                        <div className="text-center py-10 text-base-content/40 text-sm">
                            {loading ? <span className="loading loading-spinner loading-sm"></span> : 'Aucun produit trouvé'}
                        </div>
                    ) : (
                        filteredProduits.map((produit, idx) => (
                            <div 
                                key={produit.id} 
                                onClick={() => (produit.stock ?? 0) > 0 && addProduitToFacture(produit)}
                                className={`
                                    group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all
                                    ${idx === selectedIndex ? 'bg-primary text-primary-content shadow-md ring-2 ring-primary ring-offset-1' : 'hover:bg-base-100 text-base-content'}
                                    ${(produit.stock ?? 0) === 0 ? 'opacity-50' : ''}
                                `}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate text-sm">{produit.name}</div>
                                    <div className={`text-xs flex gap-3 mt-0.5 ${idx === selectedIndex ? 'text-primary-content/80' : 'text-base-content/60'}`}>
                                        <span className={(produit.stock ?? 0) === 0 ? 'text-error font-bold' : ''}>
                                            Stock: {produit.stock}
                                        </span>
                                        <span>{produit.selling_price} F</span>
                                    </div>
                                </div>
                                {(produit.stock ?? 0) > 0 && (
                                    <div className={`opacity-0 group-hover:opacity-100 ${idx === selectedIndex ? 'opacity-100' : ''}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* Right Panel: Invoice Details */}
        <div className="w-full lg:flex-1 bg-white rounded-xl shadow-sm border border-base-200 flex flex-col min-h-0 overflow-hidden">
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
                    <table className="table table-pin-rows w-full">
                        <thead>
                            <tr className="bg-base-50 text-xs uppercase tracking-wider text-base-content/60 font-semibold border-b border-base-200">
                                <th className="bg-base-50 pl-3 md:pl-6">Produit</th>
                                <th className="bg-base-50 text-right w-20 md:w-24">Qté</th>
                                <th className="bg-base-50 text-right w-24 md:w-28">Prix</th>
                                <th className="bg-base-50 text-right w-16 md:w-20 hidden sm:table-cell">Remise</th>
                                <th className="bg-base-50 text-right w-24 md:w-32 pr-3 md:pr-6">Total</th>
                                <th className="bg-base-50 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lignesFacture.map((ligne) => (
                                <tr key={ligne.produit.id} className="hover:bg-base-50/50 group border-b border-base-100 last:border-0">
                                    <td className="pl-3 md:pl-6 py-2 md:py-3">
                                        <div className="font-medium text-xs md:text-sm">{ligne.produit.name}</div>
                                    </td>
                                    <td className="text-right py-2 md:py-3">
                                        <input
                                            type="number"
                                            value={ligne.quantite}
                                            onChange={(e) => updateQuantite(ligne.produit.id, parseInt(e.target.value) || 0)}
                                            className="input input-ghost input-xs w-full text-right font-medium focus:bg-base-100 focus:text-primary"
                                        />
                                    </td>
                                    <td className="text-right py-2 md:py-3">
                                        <input
                                            type="number"
                                            value={ligne.prix_unitaire}
                                            onChange={(e) => updatePrix(ligne.produit.id, e.target.value)}
                                            className="input input-ghost input-xs w-full text-right focus:bg-base-100 focus:text-primary"
                                        />
                                    </td>
                                    <td className="text-right py-2 md:py-3 hidden sm:table-cell">
                                        <input
                                            type="number"
                                            value={ligne.remise_produit}
                                            onChange={(e) => updateRemiseProduit(ligne.produit.id, e.target.value)}
                                            className="input input-ghost input-xs w-full text-right focus:bg-base-100 focus:text-primary"
                                            placeholder="%"
                                        />
                                    </td>
                                    <td className="text-right font-medium text-base-content pr-3 md:pr-6 py-2 md:py-3 text-xs md:text-sm">
                                        {Math.round(ligne.total_ligne)}
                                    </td>
                                    <td className="text-center py-3">
                                        <button
                                            onClick={() => removeLigne(ligne.produit.id)}
                                            className="btn btn-ghost btn-xs text-error/50 hover:text-error btn-square opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase text-base-content/50 w-24">TVA (%)</span>
                            <input
                                type="number"
                                value={tva}
                                onChange={(e) => setTva(e.target.value)}
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
                        <div className="text-sm text-base-content/60">
                            TVA: <span className="font-medium text-base-content">{Math.round(totals.montantTva)} F</span>
                        </div>
                        <div className="text-3xl font-light text-primary mt-2">
                            {Math.round(totals.totalTtc)} <span className="text-lg font-normal text-primary/60">FCFA</span>
                        </div>
                    </div>
                </div>
                
                <button
                    onClick={() => ouvrirModalPaiement()}
                    disabled={loading || (!selectedClient && !useManualClient) || lignesFacture.length === 0 }
                    className="btn btn-primary w-full shadow-lg shadow-primary/20 h-12 text-lg font-normal"
                >
                    {loading ? <span className="loading loading-spinner"></span> : <span>Encaisser <span className="opacity-70 text-sm ml-2">(F9)</span></span>}
                </button>
            </div>
        </div>
      </div>

      {/* Modal de paiement */}
      <dialog className={`modal ${isPaymentModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-md mx-4 p-0 overflow-hidden bg-white">
          <div className="p-4 border-b border-base-200 flex justify-between items-center bg-base-50">
            <h3 className="font-bold text-lg">Paiement</h3>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={fermerModalPaiement}>✕</button>
          </div>

          {(facturePourPaiement || isNewSale) && (
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              if (isNewSale) {
                handleCompleteSale();
              } else {
                enregistrerPaiement(); 
              }
            }} className="p-6 space-y-5">
              
              <div className="text-center mb-6">
                <div className="text-sm text-base-content/60 uppercase tracking-wide mb-1">Total à payer</div>
                <div className="text-4xl font-light text-primary">
                    {isNewSale 
                        ? Math.round(totals.totalTtc) 
                        : Math.round(Number(facturePourPaiement?.total_ttc))} F
                </div>
              </div>

              <div className="form-control w-full">
                <label className="label py-1"><span className="label-text text-xs uppercase font-bold text-base-content/50">Mode de paiement</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { value: 'especes', label: 'Espèces' },
                      { value: 'cheque', label: 'Chèque' },
                      { value: 'carte', label: 'Carte' },
                      { value: 'virement', label: 'Virement' },
                      { value: 'en_compte', label: 'En compte' }
                    ].map((mode) => {
                        // Désactiver "En compte" si client de passage (null) ou saisie manuelle
                        const isDisabled = mode.value === 'en_compte' && (selectedClient === null || useManualClient)
                        return (
                            <button
                                key={mode.value}
                                type="button"
                                className={`btn btn-sm ${
                                    modePaiement === mode.value ? 'btn-primary' : 'btn-outline border-base-300 text-base-content font-normal'
                                } ${isDisabled ? 'btn-disabled opacity-50' : ''}`}
                                onClick={() => !isDisabled && setModePaiement(mode.value as any)}
                                disabled={isDisabled}
                                title={isDisabled ? 'Disponible uniquement pour les clients enregistrés' : ''}
                            >
                                {mode.label}
                            </button>
                        )
                    })}
                </div>
              </div>

              <div className="form-control w-full">
                <label className="label py-1"><span className="label-text text-xs uppercase font-bold text-base-content/50">Montant reçu</span></label>
                <input
                  ref={paymentInputRef}
                  type="number"
                  step="0.01"
                  value={montantPaye}
                  onChange={(e) => setMontantPaye(e.target.value)}
                  className="input input-bordered w-full font-light text-2xl text-center focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {(() => {
                const totalAPayer = isNewSale ? totals.totalTtc : (facturePourPaiement?.total_ttc ? Number(facturePourPaiement.total_ttc) : 0)
                const rendu = Number(montantPaye) - totalAPayer
                return rendu > 0 && (
                  <div className="alert bg-success/10 text-success border-success/20 py-3 shadow-sm flex justify-between items-center">
                    <span className="text-sm font-medium">Monnaie à rendre</span>
                    <span className="text-xl font-bold">{rendu.toFixed(0)} F</span>
                  </div>
                )
              })()}

              <div className="pt-4 flex gap-3">
                <button type="button" className="btn btn-ghost flex-1" onClick={fermerModalPaiement}>Annuler (Esc)</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                  {loading ? <span className="loading loading-spinner"></span> : 'Confirmer (Entrée)'}
                </button>
              </div>
            </form>
          )}
        </div>
        <form method="dialog" className="modal-backdrop" onClick={fermerModalPaiement}><button>close</button></form>
      </dialog>

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
                <div className="flex justify-between"><span>Date:</span><span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span></div>
                <div className="flex justify-between"><span>Client:</span><span>{ticketCaisse.client_name || 'Passage'}</span></div>
              </div>
              
              <div className="border-y border-dashed border-black py-2 mb-4">
                {typeof ticketCaisse.facture === 'object' && ticketCaisse.facture.produits?.map((p: any) => (
                  <div key={p.id} className="flex justify-between mb-1">
                    <span>{p.produit.name} x{p.quantity}</span>
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
                <div className="text-xs font-normal mt-2 text-center">
                  Mode: {ticketCaisse.mode_paiement.toUpperCase()}
                </div>
              </div>
              
              <div className="text-center mt-6 text-xs">
                <p>Merci de votre visite !</p>
                <p>À bientôt.</p>
              </div>
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
    </div>
  )
}