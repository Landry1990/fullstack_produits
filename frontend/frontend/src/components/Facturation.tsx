import { useState, useEffect, useMemo, useCallback } from 'react'
import axios from 'axios'
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
  produit_id: number
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
  const [produits, setProduits] = useState<ProduitModel[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<number | null>(null)
  const [lignesFacture, setLignesFacture] = useState<LigneFacture[]>([])
  const [loading, setLoading] = useState(false)
  const [remise, setRemise] = useState('0')
  const [remiseMode, setRemiseMode] = useState<'montant' | 'taux'>('montant') // Mode de remise globale
  const [tva, setTva] = useState('19.25')
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
      // Afficher plus de détails pour les erreurs 500
      if (err.response?.status === 500) {
        const fullError = errorData?.error || errorData?.traceback || JSON.stringify(errorData, null, 2)
        setError(`${errorMessage}\n\nDétails: ${fullError}`)
      } else {
        setError(errorMessage)
      }
      setSuccessInfo(null)
    } else {
      setError(defaultMessage)
      console.error('Erreur API:', err)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    async function fetchInitialData() {
      setLoading(true)
      setError(null)
      setSuccessInfo(null)
      try {
        const [produitsResponse, clientsResponse] = await Promise.all([
          axios.get<ProduitModel[]>(produitsEndpoint, { signal: controller.signal }),
          axios.get<Client[]>(clientsEndpoint, { signal: controller.signal }),
        ])
        setProduits(produitsResponse.data)
        setClients(clientsResponse.data)
      } catch (err) {
        handleApiError(err, 'Erreur lors du chargement des données initiales.')
      } finally {
        setLoading(false)
      }
    }
    fetchInitialData()
    return () => controller.abort()
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
      if (nouvelleQuantite > 0 && nouvelleQuantite > (produit.stock ?? 0)) {
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
    // Vérifier le stock seulement pour les quantités positives (ventes)
    // Les quantités négatives (retours) sont autorisées
    if (ligne && normalizedQuantite > 0 && normalizedQuantite > (ligne.produit.stock ?? 0)) {
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

  const createFacture = async () => {
    if (!selectedClient) {
      setError('Veuillez sélectionner un client')
      return
    }
    if (lignesFacture.length === 0) {
      setError('Veuillez ajouter au moins un produit')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessInfo(null)
    const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
    const factureProduitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/facture-produits/` : '/api/facture-produits/'

    try {
      // 1. Créer la facture en mode brouillon
      const facturePayload = {
        client: selectedClient,
        remise: normalizeNumberInput(remise, { min: 0 }).toString(),
        tva: normalizeNumberInput(tva, { min: 0 }).toString(),
      }
      const { data: createdFacture } = await axios.post(facturesEndpoint, facturePayload)

      // 2. Ajouter les produits à la facture
      const produitsPayload: FactureProduitPayload[] = lignesFacture.map(ligne => ({
        facture: createdFacture.id,
        produit_id: ligne.produit.id,
        quantity: Number(ligne.quantite),
        selling_price: normalizeNumberInput(ligne.prix_unitaire, { min: 0 }).toString(),
        lot: null, // Ajout du champ lot
        date_expiration: null, // Ajout du champ date_expiration
      }))

      // On peut utiliser Promise.all pour envoyer les requêtes en parallèle
      await Promise.all(
        produitsPayload.map(payload => axios.post(factureProduitsEndpoint, payload))
      )

      // 3. Valider la facture (le backend s'occupe du stock)
      const validerEndpoint = `${facturesEndpoint}${createdFacture.id}/valider/`
      const { data: validatedFacture } = await axios.post<Facture>(validerEndpoint)

      // 4. Afficher le succès et réinitialiser
      setSuccessInfo(validatedFacture)
      setLignesFacture([])
      setSelectedClient(null)
      setRemise('0')
      
      // Rafraîchir la liste des produits pour mettre à jour les stocks
      try {
        const produitsResponse = await axios.get<ProduitModel[]>(produitsEndpoint)
        setProduits(produitsResponse.data)
      } catch (err) {
        console.error('Erreur lors du rafraîchissement des produits:', err)
        // En cas d'erreur, essayer de mettre à jour manuellement avec les données de la facture validée
        setProduits(prevProduits => 
          prevProduits.map(p => {
            const factureProduit = validatedFacture.produits.find(fp => fp.produit.id === p.id)
            return factureProduit ? factureProduit.produit : p
          })
        )
      }
    } catch (err) {
      handleApiError(err, 'Une erreur est survenue lors de la création de la facture.')
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
        montant: normalizeNumberInput(montantPaye, { min: 0 }),
        reference: reference || null,
        statut: 'completee',
      }

      // Créer le ticket de caisse
      const caisseResponse = await axios.post(caisseEndpoint, paiementPayload)
      console.log('Ticket de caisse créé:', caisseResponse.data)
      
      // Stocker les données du ticket pour l'aperçu
      setTicketCaisse({
        ...caisseResponse.data,
        facture: factureAPayer
      })

      // Mettre à jour le statut de la facture à "PAYEE"
      const factureUpdateEndpoint = apiBaseUrl
        ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/factures/${factureAPayer.id}/`
        : `/api/factures/${factureAPayer.id}/`

      await axios.patch(factureUpdateEndpoint, { status: 'PAY' })
      
      // Rafraîchir les données de la facture pour avoir les dernières informations
      const factureDetailEndpoint = apiBaseUrl
        ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/factures/${factureAPayer.id}/`
        : `/api/factures/${factureAPayer.id}/`
      const { data: factureUpdated } = await axios.get<Facture>(factureDetailEndpoint)

      setSuccessInfo(factureUpdated)
      
      // Mettre à jour le ticket avec les données complètes de la facture
      setTicketCaisse({
        ...caisseResponse.data,
        facture: factureUpdated
      })
      
      if (facturePourPaiement) {
        fermerModalPaiement()
      }
    } catch (err) {
      handleApiError(err, "Erreur lors de l'enregistrement du paiement")
    } finally {
      setLoading(false)
    }
  }

  const ouvrirModalPaiement = (facture: Facture) => {
    setFacturePourPaiement(facture)
    setMontantPaye(Math.round(Number(facture.total_ttc)).toString())
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
  }

  return (
    <div className="p-6 bg-base-200 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Facturation</h1>
      
      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {successInfo && (
        <div role="alert" className="alert alert-success mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="flex-1">
            <h3 className="font-bold">Facture créée avec succès !</h3>
            <div className="text-xs mb-4">
              Facture N° <span className="font-semibold">{successInfo.numero_facture}</span> pour le client <span className="font-semibold">{successInfo.client_name}</span> d'un montant total de <span className="font-semibold">{Math.round(Number(successInfo.total_ttc))} F</span>.
              {successInfo.status === 'PAY' && <span className="badge badge-success ml-2">PAYÉE</span>}
              {successInfo.status === 'PAY' && <span className="badge badge-info ml-2">Ticket de caisse enregistré</span>}
            </div>
            
            {/* Formulaire de paiement */}
            {successInfo.status !== 'PAY' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
              <div>
                <label className="label label-text-sm">Mode de paiement</label>
                <select
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value as any)}
                  className="select select-bordered select-sm w-full"
                >
                  <option value="especes">Espèces</option>
                  <option value="cheque">Chèque</option>
                  <option value="carte">Carte</option>
                  <option value="virement">Virement</option>
                </select>
              </div>
              <div>
                <label className="label label-text-sm">Montant payé</label>
                <input
                  type="number"
                  step="0.01"
                  value={montantPaye}
                  onChange={(e) => setMontantPaye(e.target.value)}
                  placeholder={`${Math.round(Number(successInfo.total_ttc))}`}
                  className="input input-bordered input-sm w-full"
                />
              </div>
              <div>
                <label className="label label-text-sm">Référence (opt.)</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="N° chèque, ref..."
                  className="input input-bordered input-sm w-full"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => enregistrerPaiement(successInfo)}
                  disabled={loading || !montantPaye}
                  className="btn btn-sm btn-success w-full"
                >
                  {loading ? 'Enregistrement...' : 'Enregistrer Paiement'}
                </button>
              </div>
            </div>
            )}
            {successInfo.status === 'PAY' && (
              <div className="text-xs text-base-content/70 mb-2">
                Le paiement a été enregistré. Le ticket de caisse a été créé.
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {successInfo.status === 'PAY' && ticketCaisse && (
              <button 
                className="btn btn-sm btn-info"
                onClick={() => setShowTicketPreview(true)}
              >
                Aperçu Ticket
              </button>
            )}
            <button 
              className="btn btn-sm btn-outline"
              onClick={() => handleImprimerFacture(successInfo)}
            >
              Imprimer Facture
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSuccessInfo(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Sélection du client */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
        <h2 className="card-title">Informations Client</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label"><span className="label-text">Client</span></label>
            <select
              value={selectedClient !== null ? String(selectedClient) : ''}
              onChange={(e) => {
                const value = e.target.value
                setSelectedClient(value ? Number(value) : null)
              }}
              className="select select-bordered w-full"
            >
              <option value="">Sélectionner un client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label"><span className="label-text">Remise globale</span></label>
            <div className="flex gap-2">
              <select
                value={remiseMode}
                onChange={(e) => {
                  setRemiseMode(e.target.value as 'montant' | 'taux')
                  setRemise('0')
                }}
                className="select select-bordered w-24"
              >
                <option value="montant">Montant</option>
                <option value="taux">Taux %</option>
              </select>
              <input
                type="number"
                step="0.01"
                value={remise}
                onChange={(e) => setRemise(e.target.value)}
                placeholder={remiseMode === 'montant' ? 'Montant (F)' : 'Taux (%)'}
                className="input input-bordered flex-1"
                min="0"
                max={remiseMode === 'taux' ? '100' : undefined}
              />
            </div>
          </div>
          <div>
            <label className="label"><span className="label-text">TVA (%)</span></label>
            <input
              type="number"
              step="0.01"
              value={tva}
              onChange={(e) => setTva(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Liste des produits disponibles */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Produits Disponibles</h2>

            {/* Champ de recherche */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {filteredProduits.length === 0 ? (
                <div className="text-center py-4 text-base-content/70">
                  {loading && <span className="loading loading-spinner"></span>}
                  {!loading && (searchQuery ? 'Aucun produit trouvé' : 'Aucun produit disponible')}
                </div>
              ) : (
                filteredProduits.map((produit) => (
                  <div key={produit.id} className="flex items-center justify-between p-3 border border-base-300 rounded-lg hover:bg-base-200 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium text-base-content">{produit.name}</div>
                      <div className="text-sm text-base-content/70">
                        Stock: <span className={(produit.stock ?? 0) === 0 ? 'text-error font-medium' : 'text-success font-medium'}>{produit.stock}</span> | 
                        Prix: <span className="text-info font-medium">{produit.selling_price} F</span>
                      </div>
                    </div>
                    <button
                      onClick={() => addProduitToFacture(produit)}
                      disabled={(produit.stock ?? 0) === 0}
                      className="btn btn-sm btn-primary"
                    >
                      {(produit.stock ?? 0) === 0 ? 'Rupture' : 'Ajouter'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tableau de la facture */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Facture</h2>

            {lignesFacture.length === 0 ? (
              <div className="text-center py-8 text-base-content/70">
                Aucun produit ajouté à la facture
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th className="text-right">Qté</th>
                        <th className="text-right">Prix</th>
                        <th className="text-right">Remise %</th>
                        <th className="text-right">Total</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignesFacture.map((ligne) => (
                        <tr key={ligne.produit.id}>
                          <td className="py-3 px-2">
                            <div className="font-medium">{ligne.produit.name}</div>
                            <div className="text-sm opacity-70">Stock: <span className="font-medium">{ligne.produit.stock}</span></div>
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              min={undefined}
                              max={ligne.quantite > 0 ? ligne.produit.stock : undefined}
                              value={ligne.quantite}
                              onChange={(e) => updateQuantite(ligne.produit.id, parseInt(e.target.value) || 0)}
                              className="input input-bordered input-sm w-20 text-right"
                              title={ligne.quantite < 0 ? "Quantité négative = retour (augmente le stock)" : "Quantité positive = vente (diminue le stock)"}
                            />
                            {ligne.quantite < 0 && (
                              <div className="text-xs text-warning mt-1">Retour</div>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={ligne.prix_unitaire}
                              onChange={(e) => updatePrix(ligne.produit.id, e.target.value)}
                              className="input input-bordered input-sm w-24 text-right"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={ligne.remise_produit}
                              onChange={(e) => updateRemiseProduit(ligne.produit.id, e.target.value)}
                              className="input input-bordered input-sm w-20 text-right"
                              placeholder="0%"
                            />
                          </td>
                          <td className="py-3 px-2 text-right font-medium">
                            {Math.round(ligne.total_ligne)} F
                          </td>
                          <td className="py-3 px-2 text-center">
                            <button
                              onClick={() => removeLigne(ligne.produit.id)}
                              className="btn btn-ghost btn-xs"
                              title="Supprimer"
                            >
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totaux */}
                <div className="mt-4 pt-4 border-t border-base-300">
                  <div className="flex justify-between mb-2">
                    <span>Sous-total:</span>
                    <span className="font-medium">{Math.round(totals.sousTotal)} F</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span>Remise {remiseMode === 'taux' && remise ? `(${remise}%)` : ''}:</span>
                    <span className="font-medium text-error">-{Math.round(totals.remiseMontant)} F</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span>TVA ({tva}%):</span>
                    <span className="font-medium">{Math.round(totals.montantTva)} F</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-2xl border-t pt-2 text-black">
                    <span>Total TTC:</span>
                    <span className="text-primary">{Math.round(totals.totalTtc)} F</span>
                  </div>
                </div>

                {/* Bouton de création */}
                <div className="mt-6">
                  <button
                    onClick={createFacture}
                    disabled={loading || !selectedClient || lignesFacture.length === 0 }
                    className="btn btn-success btn-block"
                  >
                    {loading ? 'Création...' : 'Créer la Facture'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de paiement */}
      <dialog className={`modal ${isPaymentModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-md">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Enregistrer le paiement</h3>
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost"
              onClick={fermerModalPaiement}
            >
              ✕
            </button>
          </div>

          {facturePourPaiement && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                enregistrerPaiement()
              }}
              className="space-y-4"
            >
              {/* Infos facture */}
              <div className="bg-base-200 p-4 rounded mb-4">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Facture :</span>
                    <span className="font-semibold">{facturePourPaiement.numero_facture}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Client :</span>
                    <span className="font-semibold">{facturePourPaiement.client_name}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Montant à payer :</span>
                    <span className="font-bold text-lg">{Math.round(Number(facturePourPaiement.total_ttc))} F</span>
                  </div>
                </div>
              </div>

              {/* Mode de paiement */}
              <label className="form-control w-full">
                <span className="label-text font-semibold">Mode de paiement *</span>
                <select
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value as any)}
                  className="select select-bordered w-full"
                  required
                >
                  <option value="especes">Espèces</option>
                  <option value="cheque">Chèque</option>
                  <option value="carte">Carte</option>
                  <option value="virement">Virement</option>
                </select>
              </label>

              {/* Montant payé */}
              <label className="form-control w-full">
                <span className="label-text font-semibold">Montant payé *</span>
                <input
                  type="number"
                  step="0.01"
                  value={montantPaye}
                  onChange={(e) => setMontantPaye(e.target.value)}
                  className="input input-bordered w-full"
                  required
                />
              </label>

              {/* Référence */}
              <label className="form-control w-full">
                <span className="label-text font-semibold">Référence (optionnel)</span>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="N° chèque, N° de transaction..."
                  className="input input-bordered w-full"
                />
              </label>

              {/* Monnaie rendue */}
              {Number(montantPaye) > Number(facturePourPaiement.total_ttc) && (
                <div className="alert alert-info">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Monnaie à rendre : <span className="font-bold">{(Number(montantPaye) - Number(facturePourPaiement.total_ttc)).toFixed(2)} F</span></span>
                </div>
              )}

              {error && (
                <div role="alert" className="alert alert-error">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l-2-2m0 0l-2-2m2 2l2-2m-2 2l-2 2" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={fermerModalPaiement}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? <span className="loading loading-spinner loading-sm"></span> : 'Confirmer le paiement'}
                </button>
              </div>
            </form>
          )}
        </div>
        <form method="dialog" className="modal-backdrop" onClick={fermerModalPaiement}>
          <button>close</button>
        </form>
      </dialog>

      {/* Modal d'aperçu du ticket de caisse */}
      {showTicketPreview && ticketCaisse && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Aperçu du Ticket de Caisse</h3>
              <button 
                className="btn btn-sm btn-circle btn-ghost"
                onClick={() => setShowTicketPreview(false)}
              >
                ✕
              </button>
            </div>
            
            {/* Aperçu du ticket formaté pour l'impression */}
            <div className="bg-white p-6 rounded-lg shadow-lg" id="ticket-preview" style={{ maxWidth: '80mm', margin: '0 auto' }}>
              {/* En-tête */}
              <div className="text-center mb-4 border-b-2 border-gray-800 pb-3">
                <h2 className="text-xl font-bold">DJADEU PHARMACY</h2>
                <p className="text-sm">Logbessou</p>
                <p className="text-sm">Tel: 697268949</p>
              </div>
              
              {/* Informations du ticket */}
              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">Ticket N°:</span>
                  <span>#{ticketCaisse.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Facture:</span>
                  <span>{ticketCaisse.facture_numero || (typeof ticketCaisse.facture === 'object' ? ticketCaisse.facture.numero_facture : null) || `FAC-${typeof ticketCaisse.facture === 'object' ? ticketCaisse.facture.id : ticketCaisse.facture}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Client:</span>
                  <span className="text-right">{ticketCaisse.client_name || (typeof ticketCaisse.facture === 'object' ? ticketCaisse.facture.client_name : null) || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Date:</span>
                  <span>{new Date(ticketCaisse.date_paiement || (typeof ticketCaisse.facture === 'object' ? ticketCaisse.facture.date : new Date().toISOString())).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Mode de paiement:</span>
                  <span className="uppercase">
                    {ticketCaisse.mode_paiement === 'especes' ? 'Espèces' :
                     ticketCaisse.mode_paiement === 'cheque' ? 'Chèque' :
                     ticketCaisse.mode_paiement === 'carte' ? 'Carte' :
                     ticketCaisse.mode_paiement === 'virement' ? 'Virement' : ticketCaisse.mode_paiement}
                  </span>
                </div>
                {ticketCaisse.reference && (
                  <div className="flex justify-between">
                    <span className="font-semibold">Référence:</span>
                    <span>{ticketCaisse.reference}</span>
                  </div>
                )}
              </div>
              
              {/* Détails de la facture */}
              {typeof ticketCaisse.facture === 'object' && ticketCaisse.facture.produits && ticketCaisse.facture.produits.length > 0 && (
                <div className="mb-4 border-t border-b border-gray-300 py-2">
                  <div className="text-xs font-semibold mb-2">Détails:</div>
                  {ticketCaisse.facture.produits.slice(0, 5).map((produit) => (
                    <div key={produit.id} className="flex justify-between text-xs mb-1">
                      <span className="flex-1">{produit.produit.name} x{Math.abs(produit.quantity)}</span>
                      <span>{Math.round(Math.abs(produit.quantity) * Number(produit.selling_price || 0))} F</span>
                    </div>
                  ))}
                  {ticketCaisse.facture.produits.length > 5 && (
                    <div className="text-xs text-gray-500 mt-1">... et {ticketCaisse.facture.produits.length - 5} autre(s) produit(s)</div>
                  )}
                </div>
              )}
              
              {/* Totaux */}
              <div className="mb-4 space-y-1 text-sm border-t border-gray-300 pt-2">
                {typeof ticketCaisse.facture === 'object' && ticketCaisse.facture && (
                  <>
                    <div className="flex justify-between">
                      <span>Sous-total HT:</span>
                      <span>{Math.round(Number(ticketCaisse.facture.total_ht || 0)).toLocaleString('fr-FR')} F</span>
                    </div>
                    {Number(ticketCaisse.facture.remise || 0) > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Remise:</span>
                        <span>-{Math.round(Number(ticketCaisse.facture.remise || 0)).toLocaleString('fr-FR')} F</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>TVA ({ticketCaisse.facture.tva}%):</span>
                      <span>{Math.round(Number(ticketCaisse.facture.total_tva || 0)).toLocaleString('fr-FR')} F</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-lg border-t-2 border-gray-800 pt-2 mt-2">
                  <span>TOTAL:</span>
                  <span>{Math.round(Number(ticketCaisse.montant || 0)).toLocaleString('fr-FR')} F</span>
                </div>
              </div>
              
              {/* Pied de page */}
              <div className="text-center text-xs border-t border-gray-300 pt-3 mt-4">
                <p>Merci de votre visite !</p>
                <p className="mt-1">Ticket généré le {new Date().toLocaleString('fr-FR')}</p>
              </div>
            </div>
            
            {/* Boutons d'action */}
            <div className="modal-action">
              <button 
                className="btn btn-ghost"
                onClick={() => setShowTicketPreview(false)}
              >
                Fermer
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  const printContent = document.getElementById('ticket-preview')
                  if (printContent) {
                    const printWindow = window.open('', '_blank')
                    if (printWindow) {
                      printWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <title>Ticket de Caisse - ${ticketCaisse.facture_numero || (typeof ticketCaisse.facture === 'object' ? ticketCaisse.facture.numero_facture : '')}</title>
                            <style>
                              @media print {
                                @page { margin: 0; size: 80mm auto; }
                                body { margin: 0; padding: 10mm; font-family: Arial, sans-serif; font-size: 12px; }
                              }
                              body { margin: 0; padding: 10mm; font-family: Arial, sans-serif; font-size: 12px; }
                              .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                              .header h2 { margin: 0; font-size: 18px; font-weight: bold; }
                              .info { margin-bottom: 15px; }
                              .info div { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
                              .details { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 15px 0; }
                              .totals { border-top: 1px solid #ccc; padding-top: 10px; margin-top: 15px; }
                              .totals div { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
                              .total-final { font-weight: bold; font-size: 16px; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
                              .footer { text-align: center; border-top: 1px solid #ccc; padding-top: 10px; margin-top: 15px; font-size: 10px; }
                            </style>
                          </head>
                          <body>
                            ${printContent.innerHTML}
                          </body>
                        </html>
                      `)
                      printWindow.document.close()
                      setTimeout(() => {
                        printWindow.print()
                        printWindow.close()
                      }, 250)
                    }
                  }
                }}
              >
                Imprimer Ticket
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowTicketPreview(false)}></div>
        </div>
      )}
    </div>
  )
}