import { useState, useEffect, useMemo, useCallback } from 'react'
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
  const [lignesFacture, setLignesFacture] = useState<LigneFacture[]>([])
  const [loading, setLoading] = useState(false)
  const [remise, setRemise] = useState('0')
  const [remiseMode, setRemiseMode] = useState<'montant' | 'taux'>('montant') // Mode de remise globale
  const [tva, setTva] = useState('0')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<Facture | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [modePaiement, setModePaiement] = useState<'especes' | 'cheque' | 'carte' | 'virement'>('especes')
  const [montantPaye, setMontantPaye] = useState('')
  const [reference, setReference] = useState('')
  const [facturePourPaiement, setFacturePourPaiement] = useState<Facture | null>(null)
  const [ticketCaisse, setTicketCaisse] = useState<TicketCaisse | null>(null)
  const [showTicketPreview, setShowTicketPreview] = useState(false)

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
  const filteredProduits = produits.filter(produit =>
    produit.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
        client: selectedClient,
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
  }

  const fermerModalPaiement = () => {
    setIsPaymentModalOpen(false)
    setFacturePourPaiement(null)
    setMontantPaye('')
    setReference('')
    setModePaiement('especes')
    setIsNewSale(false)
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Nouvelle Facture</h1>
          <p className="text-sm text-base-content/80">Créez et gérez les factures clients</p>
        </div>
        <div className="text-sm text-base-content/80">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
      
      {error && (
        <div role="alert" className="alert alert-error shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {successInfo && (
        <div role="alert" className="alert alert-success shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="flex-1">
            <h3 className="font-bold">Facture créée avec succès !</h3>
            <div className="text-xs">
              Facture N° <span className="font-semibold">{successInfo.numero_facture}</span> pour <span className="font-semibold">{successInfo.client_name}</span> • <span className="font-semibold">{Math.round(Number(successInfo.total_ttc))} F</span>
              {successInfo.status === 'PAY' && <span className="badge badge-sm badge-success ml-2">PAYÉE</span>}
            </div>
          </div>
          
          <div className="flex flex-row gap-2 items-center">
            {successInfo.status !== 'PAY' && (
              <button 
                className="btn btn-sm btn-primary"
                onClick={() => ouvrirModalPaiement(successInfo)}
              >
                Payer maintenant
              </button>
            )}
            {successInfo.status === 'PAY' && ticketCaisse && (
              <button className="btn btn-sm btn-info" onClick={() => setShowTicketPreview(true)}>
                Ticket
              </button>
            )}
            <button className="btn btn-sm btn-outline" onClick={() => handleImprimerFacture(successInfo)}>
              Imprimer
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSuccessInfo(null)}>Fermer</button>
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        {/* Left Panel: Client & Products */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 min-h-0">
          {/* Client Selection */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <h2 className="card-title text-sm uppercase tracking-wider text-base-content/80 mb-2">Client & Conditions</h2>
              <div className="grid gap-3">
                <div>
                  <select
                    value={selectedClient !== null ? String(selectedClient) : ''}
                    onChange={(e) => {
                      const value = e.target.value
                      setSelectedClient(value ? Number(value) : null)
                    }}
                    className="select select-bordered w-full"
                  >
                    <option value="">Sélectionner un client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="join w-full">
                    <select
                      value={remiseMode}
                      onChange={(e) => {
                        setRemiseMode(e.target.value as 'montant' | 'taux')
                        setRemise('0')
                      }}
                      className="select select-bordered join-item w-24 text-xs px-1"
                    >
                      <option value="montant">Remise (F)</option>
                      <option value="taux">Remise (%)</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={remise}
                      onChange={(e) => setRemise(e.target.value)}
                      className="input input-bordered join-item w-full"
                      min="0"
                    />
                  </div>
                  <div className="flex items-center gap-2 border border-base-300 rounded-lg px-3 bg-base-200/30">
                    <span className="text-sm text-base-content/80">TVA</span>
                    <input
                      type="number"
                      step="0.01"
                      value={tva}
                      onChange={(e) => setTva(e.target.value)}
                      className="input input-ghost input-sm w-full text-right font-medium"
                    />
                    <span className="text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Product Selection */}
          <div className="card bg-base-100 shadow-sm border border-base-200 flex-1 flex flex-col min-h-0">
            <div className="card-body p-4 flex flex-col h-full min-h-0">
              <h2 className="card-title text-sm uppercase tracking-wider text-base-content/80 mb-2">Produits</h2>
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input input-bordered w-full pl-10"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {filteredProduits.length === 0 ? (
                  <div className="text-center py-8 text-base-content/80">
                    {loading ? <span className="loading loading-spinner"></span> : 'Aucun produit trouvé'}
                  </div>
                ) : (
                  filteredProduits.map((produit) => (
                    <div key={produit.id} className="group flex items-center justify-between p-3 border border-base-200 rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer" onClick={() => (produit.stock ?? 0) > 0 && addProduitToFacture(produit)}>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-base-content truncate">{produit.name}</div>
                        <div className="text-xs text-base-content/80 flex gap-3 mt-1">
                          <span className={(produit.stock ?? 0) === 0 ? 'text-error font-medium' : 'text-success'}>
                            Stock: {produit.stock}
                          </span>
                          <span className="font-medium text-base-content">{produit.selling_price} F</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addProduitToFacture(produit);
                        }}
                        disabled={(produit.stock ?? 0) === 0}
                        className="btn btn-sm btn-square btn-ghost text-primary group-hover:bg-primary group-hover:text-primary-content"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Invoice */}
        <div className="col-span-12 lg:col-span-7 card bg-base-100 shadow-sm border border-base-200 flex flex-col h-full overflow-hidden">
          <div className="card-body p-0 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-base-200 bg-base-200/30 flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Détails de la facture
              </h2>
              <div className="badge badge-ghost">{lignesFacture.length} articles</div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              {lignesFacture.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-base-content/40 gap-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  <p>Le panier est vide</p>
                </div>
              ) : (
                <table className="table table-pin-rows">
                  <thead>
                    <tr className="bg-base-200/50 text-xs uppercase">
                      <th>Produit</th>
                      <th className="text-right w-24">Qté</th>
                      <th className="text-right w-28">Prix</th>
                      <th className="text-right w-20">Remise</th>
                      <th className="text-right w-28">Total</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesFacture.map((ligne) => (
                      <tr key={ligne.produit.id} className="hover:bg-base-100">
                        <td>
                          <div className="font-medium">{ligne.produit.name}</div>
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            value={ligne.quantite}
                            onChange={(e) => updateQuantite(ligne.produit.id, parseInt(e.target.value) || 0)}
                            className="input input-ghost input-xs w-full text-right font-medium focus:bg-base-200"
                          />
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            value={ligne.prix_unitaire}
                            onChange={(e) => updatePrix(ligne.produit.id, e.target.value)}
                            className="input input-ghost input-xs w-full text-right focus:bg-base-200"
                          />
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            value={ligne.remise_produit}
                            onChange={(e) => updateRemiseProduit(ligne.produit.id, e.target.value)}
                            className="input input-ghost input-xs w-full text-right focus:bg-base-200"
                            placeholder="%"
                          />
                        </td>
                        <td className="text-right font-medium">
                          {Math.round(ligne.total_ligne)}
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => removeLigne(ligne.produit.id)}
                            className="btn btn-ghost btn-xs text-error btn-square"
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
            <div className="p-4 bg-base-200/30 border-t border-base-200 space-y-3">
              <div className="grid grid-cols-2 gap-8 text-sm">
                <div className="space-y-1">
                  <div className="flex justify-between text-base-content/80">
                    <span>Sous-total</span>
                    <span>{Math.round(totals.sousTotal)} F</span>
                  </div>
                  <div className="flex justify-between text-error">
                    <span>Remise globale</span>
                    <span>-{Math.round(totals.remiseMontant)} F</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-base-content/80">
                    <span>TVA ({tva}%)</span>
                    <span>{Math.round(totals.montantTva)} F</span>
                  </div>
                  <div className="flex justify-between font-black text-xl text-primary pt-1 border-t border-base-300">
                    <span>Total TTC</span>
                    <span>{Math.round(totals.totalTtc)} F</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => ouvrirModalPaiement()}
                disabled={loading || !selectedClient || lignesFacture.length === 0 }
                className="btn btn-primary w-full shadow-lg shadow-primary/20"
              >
                {loading ? <span className="loading loading-spinner"></span> : 'Encaisser'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de paiement */}
      <dialog className={`modal ${isPaymentModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-md">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Enregistrer le paiement</h3>
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
            }} className="space-y-4">
              <div className="bg-base-200 p-4 rounded-lg mb-4">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="opacity-70">Facture</span>
                    <span className="font-semibold">
                      {isNewSale ? 'Nouvelle Vente' : facturePourPaiement?.numero_facture}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Client</span>
                    <span className="font-semibold">
                      {isNewSale 
                        ? clients.find(c => c.id === selectedClient)?.name 
                        : facturePourPaiement?.client_name}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-base-300 pt-2 mt-2">
                    <span className="font-bold">À payer</span>
                    <span className="font-bold text-lg text-primary">
                      {isNewSale 
                        ? Math.round(totals.totalTtc) 
                        : Math.round(Number(facturePourPaiement?.total_ttc))} F
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-control w-full">
                <label className="label"><span className="label-text font-medium">Mode de paiement</span></label>
                <select
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value as any)}
                  className="select select-bordered w-full"
                >
                  <option value="especes">Espèces</option>
                  <option value="cheque">Chèque</option>
                  <option value="carte">Carte</option>
                  <option value="virement">Virement</option>
                </select>
              </div>

              <div className="form-control w-full">
                <label className="label"><span className="label-text font-medium">Montant reçu</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={montantPaye}
                  onChange={(e) => setMontantPaye(e.target.value)}
                  className="input input-bordered w-full font-bold text-lg"
                />
              </div>

              <div className="form-control w-full">
                <label className="label"><span className="label-text font-medium">Référence</span></label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="N° chèque, transaction..."
                  className="input input-bordered w-full"
                />
              </div>

              {(() => {
                const totalAPayer = isNewSale ? totals.totalTtc : (facturePourPaiement?.total_ttc ? Number(facturePourPaiement.total_ttc) : 0)
                return Number(montantPaye) > totalAPayer && (
                  <div className="alert alert-info py-2 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Rendre : <span className="font-bold">{(Number(montantPaye) - totalAPayer).toFixed(2)} F</span></span>
                  </div>
                )
              })()}

              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={fermerModalPaiement}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <span className="loading loading-spinner"></span> : 'Confirmer'}
                </button>
              </div>
            </form>
          )}
        </div>
        <form method="dialog" className="modal-backdrop" onClick={fermerModalPaiement}><button>close</button></form>
      </dialog>

      {/* Modal d'aperçu du ticket de caisse */}
      {showTicketPreview && ticketCaisse && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md p-0 overflow-hidden">
            <div className="bg-base-200 p-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">Ticket de Caisse</h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setShowTicketPreview(false)}>✕</button>
            </div>
            
            <div className="p-6 bg-white text-black font-mono text-sm overflow-y-auto max-h-[60vh]" id="ticket-preview">
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
            
            <div className="p-4 bg-base-100 border-t border-base-200 flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTicketPreview(false)}>Fermer</button>
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