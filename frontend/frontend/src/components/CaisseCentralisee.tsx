import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import type { Facture, TicketCaisse } from '../types'

// Lazy load barcode component
const Barcode = lazy(() => import('react-barcode'))

export default function CaisseCentralisee() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { settings: pharmacySettings } = usePharmacySettings()
  const [facturesEnAttente, setFacturesEnAttente] = useState<Facture[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [montantPaye, setMontantPaye] = useState('')
  const [modePaiement, setModePaiement] = useState<'especes' | 'cheque' | 'carte' | 'virement' | 'om' | 'momo'>('especes')
  const [reference, setReference] = useState('')
  const [ticketCaisse, setTicketCaisse] = useState<TicketCaisse | null>(null)
  const [showTicketPreview, setShowTicketPreview] = useState(false)
  const [paiements, setPaiements] = useState<{ mode: string; montant: number }[]>([])

  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? ''), [])

  // Fonction pour récupérer les factures en attente
  const fetchFacturesEnAttente = useCallback(async () => {
    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      
      // Fetch list of pending invoices
      const response = await axios.get(`${facturesEndpoint}?status__in=BROU,VAL`)
      const facturesList = response.data.results || response.data || []
      
      // Fetch full details for each invoice to get products
      const facturesWithDetails = await Promise.all(
        facturesList.map(async (facture: Facture) => {
          try {
            const detailResponse = await axios.get(`${facturesEndpoint}${facture.id}/`)
            return detailResponse.data
          } catch (err) {
            console.error(`Failed to fetch details for invoice ${facture.id}:`, err)
            return facture // Fallback to list data
          }
        })
      )
      
      setFacturesEnAttente(facturesWithDetails)
    } catch (err) {
      console.error('Erreur lors du chargement des factures en attente:', err)
    }
  }, [apiBaseUrl])


  // Rafraîchissement automatique toutes les 20 secondes
  useEffect(() => {
    fetchFacturesEnAttente()
    const interval = setInterval(fetchFacturesEnAttente, 20000)
    return () => clearInterval(interval)
  }, [fetchFacturesEnAttente])

  // Ouvrir la modale de paiement
  const handleEncaisser = (facture: Facture) => {
    setSelectedFacture(facture)
    // Suggest part_client if available and positive, otherwise total_ttc
    const amountToPay = (facture.part_client !== null && Number(facture.part_client) >= 0) 
      ? Number(facture.part_client) 
      : Number(facture.total_ttc)
    
    setMontantPaye(Math.round(amountToPay).toString())
    setModePaiement('especes')
    setReference('')
    setPaiements([]) // Reset multiple payments
    setIsPaymentModalOpen(true)
  }

  // Enregistrer le paiement
  const enregistrerPaiement = async () => {
    if (!selectedFacture) return

    // Calculer le total des paiements
    const totalPaiements = paiements.reduce((acc, p) => acc + p.montant, 0)
    const montantCourant = Number(montantPaye) || 0
    const montantTotal = totalPaiements + (paiements.length === 0 ? montantCourant : 0)

    if (montantTotal <= 0) {
      toast.error('Veuillez entrer un montant valide')
      return
    }

    setLoading(true)

    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const caisseEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/caisse/` : '/api/caisse/'

      // 1. Valider la facture si elle n'est pas déjà validée
      let factureValidee = selectedFacture
      if (selectedFacture.status !== 'VAL' && selectedFacture.status !== 'VALIDEE') {
        const validerEndpoint = `${facturesEndpoint}${selectedFacture.id}/valider/`
        const { data } = await axios.post<Facture>(validerEndpoint, {})
        factureValidee = data
      }

      // Déterminer si c'est un tiers payant et le montant réel à encaisser
      const hasTiersPayant = factureValidee.part_client !== null && Number(factureValidee.part_client) >= 0
      const montantAEncaisser = hasTiersPayant 
        ? Number(factureValidee.part_client)
        : Number(factureValidee.total_ttc)

      // 2. Enregistrer les paiements (multiples ou simple)
      const paiementsAEnregistrer = paiements.length > 0 
        ? paiements 
        : [{ mode: modePaiement, montant: montantCourant }]

      for (const paiement of paiementsAEnregistrer) {
        const paiementPayload: any = {
          facture: factureValidee.id,
          mode_paiement: paiement.mode,
          montant: paiement.montant,
          reference: reference || null,
          statut: 'completee',
        }

        // Si tiers payant, marquer comme paiement de la part patient
        if (hasTiersPayant) {
          paiementPayload.part_patient = paiement.montant
          paiementPayload.part_assurance = 0
        }

        await axios.post(caisseEndpoint, paiementPayload)
      }

      // 3. Mettre à jour le statut à PAYEE
      const factureUpdateEndpoint = `${facturesEndpoint}${factureValidee.id}/`
      await axios.patch(factureUpdateEndpoint, { status: 'PAY' })

      // 4. Récupérer la facture finale
      const { data: factureFinale } = await axios.get<Facture>(factureUpdateEndpoint)

      // 5. Créer le ticket de caisse (calculer le rendu sur la base du montant encaissé, pas du total)
      const rendu = montantTotal - montantAEncaisser
      setTicketCaisse({
        id: 0,
        facture: factureFinale,
        mode_paiement: paiements.length > 1 ? 'Mixte' : (paiements[0]?.mode || modePaiement),
        montant: factureFinale.total_ttc,
        montant_verse: montantTotal.toString(),
        rendu: rendu.toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        statut: 'completee',
        date_paiement: new Date().toISOString(),
        paiements_details: (factureFinale as any).paiements || []
      } as any)

      // 6. Fermer la modale de paiement et afficher le ticket
      setIsPaymentModalOpen(false)
      setShowTicketPreview(true)

      // 7. Rafraîchir la liste
      await fetchFacturesEnAttente()

      toast.success(`Facture #${factureFinale.numero_facture} encaissée avec succès !`)
    } catch (err: any) {
      console.error('Erreur lors du paiement:', err)
      toast.error(err.response?.data?.detail || "Erreur lors de l'enregistrement du paiement")
    } finally {
      setLoading(false)
    }
  }



  // Annuler une facture
  const handleAnnuler = async (facture: Facture) => {
    if (!window.confirm(`Voulez-vous vraiment annuler la facture #${facture.numero_facture} ?`)) return

    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      // Utiliser l'endpoint d'annulation
      await axios.post(`${facturesEndpoint}${facture.id}/annuler/`, { motif: 'Annulation depuis Caisse Centrale' })
      toast.success('Facture annulée')
      fetchFacturesEnAttente()
    } catch (err) {
      console.error('Erreur annulation:', err)
      toast.error('Erreur lors de l\'annulation')
    }
  }

  // Modifier une facture (Redirection vers Facturation)
  const handleModifier = async (facture: Facture) => {
    if (!window.confirm(`Modifier cette facture ?\nElle sera retirée de la liste et rechargée dans l'écran de vente.`)) return

    try {
      setLoading(true)
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const produitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/produits/` : '/api/produits/'
      
      // 1. Fetch the FULL invoice detail (list endpoint doesn't include products)
      const { data: fullFacture } = await axios.get<Facture>(`${facturesEndpoint}${facture.id}/`)
      
      if (!fullFacture.produits || fullFacture.produits.length === 0) {
        toast.error('Cette facture ne contient aucun produit')
        setLoading(false)
        return
      }
      
      // 2. Fetch complete product details for all products
      const productPromises = fullFacture.produits.map(async (p: any) => {
        try {
          const response = await axios.get(`${produitsEndpoint}${p.produit}/`)
          return {
            id: response.data.id,
            name: response.data.name,
            price: p.selling_price,
            quantity: p.quantity,
            stock: response.data.stock,
            discount: p.discount || 0,
            cip: response.data.cip,
            tva: response.data.tva
          }
        } catch (err) {
          console.error(`Failed to fetch product ${p.produit}:`, err)
          return {
            id: p.produit,
            name: p.produit_nom || 'Produit',
            price: p.selling_price,
            quantity: p.quantity,
            stock: 9999,
            discount: p.discount || 0
          }
        }
      })

      const cartItems = await Promise.all(productPromises)

      // 3. Cancel the invoice after fetching all data
      await axios.post(`${facturesEndpoint}${facture.id}/annuler/`, { motif: 'Modification (Reload)' })

      // 4. Navigate to Facturation with complete state
      navigate('/app/facturation', { 
        state: { 
          cartData: cartItems,
          client: fullFacture.client ? { id: fullFacture.client, name: fullFacture.client_name } : null,
          remise: fullFacture.remise,
          mode: 'edit_reload'
        } 
      })
      
    } catch (err) {
      console.error('Erreur modification:', err)
      toast.error('Impossible de charger la facture pour modification')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-white shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Caisse Centralisée</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Les ventes en attente de règlement s'affichent automatiquement
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="badge badge-lg badge-primary gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualisation auto (20s)
          </div>
          <div className="badge badge-lg badge-error">
            {facturesEnAttente.length} en attente
          </div>
        </div>
      </div>

      {/* Liste des factures */}
      <div className="flex-1 overflow-auto p-6">
        {facturesEnAttente.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-base-content/40">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xl font-light">Aucune facture en attente de règlement</p>
            <p className="text-sm mt-2">Les ventes validées par les vendeurs apparaîtront ici</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {facturesEnAttente
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Sort by date ascending
              .map((facture, index) => (
              <div
                key={facture.id}
                className="bg-white rounded-lg shadow-md border-2 border-base-200 hover:border-primary transition-all p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="badge badge-lg badge-neutral font-bold">#{index + 1}</div>
                    <div>
                      <div className="text-xs text-base-content/60 uppercase tracking-wide">Facture</div>
                      <div className="text-2xl font-bold text-primary">#{facture.numero_facture}</div>
                    </div>
                  </div>
                  <div className="badge badge-warning">En attente</div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Client:</span>
                    <span className="font-medium">{facture.client_name || 'Client de passage'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Date:</span>
                    <span className="font-medium">{new Date(facture.date).toLocaleString('fr-FR')}</span>
                  </div>
                  
                  {/* Products Preview - Collapsible */}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-primary hover:text-primary-focus flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Voir les produits ({facture.produits?.length || 0})
                    </summary>
                    <div className="mt-2 bg-base-50 rounded p-2 space-y-1 max-h-40 overflow-y-auto">
                      {facture.produits && facture.produits.length > 0 ? (
                        facture.produits.map((p: any) => (
                          <div key={p.id} className="flex justify-between text-xs bg-white p-2 rounded">
                            <span className="font-medium">{p.produit_nom || `Produit #${p.produit}`}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-base-content/60">×{p.quantity}</span>
                              <span className="font-bold">{Math.round(p.quantity * Number(p.selling_price))} F</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-center text-base-content/40 py-2">Aucun produit</div>
                      )}
                    </div>
                  </details>
                </div>

                <div className="divider my-2"></div>

                <div className="flex justify-between items-center mb-4">
                  <span className="text-base-content/60">
                    {(facture.part_client !== null && Number(facture.part_client) >= 0) 
                      ? 'Part Client' 
                      : 'Montant TTC'}
                  </span>
                  <span className="text-3xl font-bold text-success">
                    {Math.round(
                      (facture.part_client !== null && Number(facture.part_client) >= 0)
                        ? Number(facture.part_client)
                        : Number(facture.total_ttc)
                    )} F
                  </span>
                </div>
                {(facture.part_client !== null && Number(facture.part_client) >= 0) && (
                  <div className="flex justify-between items-center text-xs text-base-content/50 mb-2">
                    <span>Total TTC</span>
                    <span>{Math.round(Number(facture.total_ttc))} F (Tiers Payant)</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleModifier(facture)}
                    className="btn btn-outline btn-warning flex-1"
                    title="Modifier (Recharger dans la vente)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={() => handleAnnuler(facture)}
                    className="btn btn-outline btn-error flex-1"
                    title="Annuler la vente"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={() => handleEncaisser(facture)}
                  disabled={!(user as any)?.can_cash_out && !(user?.is_superuser)}
                  className="btn btn-success btn-block gap-2 text-white mt-2 disabled:bg-base-300 disabled:text-base-content/50"
                  title={!(user as any)?.can_cash_out && !(user?.is_superuser) ? "Vous n'êtes pas autorisé à encaisser" : "Encaisser la facture"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Encaisser
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de paiement */}
      {isPaymentModalOpen && selectedFacture && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">Encaissement - Facture #{selectedFacture.numero_facture}</h3>

            <div className="text-center mb-6">
              <div className="text-sm text-base-content/60">Total à payer</div>
              <div className="text-4xl font-bold text-primary">
                {Math.round(
                  (selectedFacture.part_client !== null && Number(selectedFacture.part_client) >= 0)
                    ? Number(selectedFacture.part_client)
                    : Number(selectedFacture.total_ttc)
                )} F
              </div>
              {(selectedFacture.part_client !== null && Number(selectedFacture.part_client) >= 0) && (
                 <div className="badge badge-info mt-2">Part Client (Tiers Payant actif)</div>
              )}
            </div>

            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Mode de paiement</span>
              </label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value as any)}
                className="select select-bordered w-full"
              >
                <option value="especes">Espèces</option>
                <option value="cheque">Chèque</option>
                <option value="carte">Carte</option>
                <option value="virement">Virement</option>
                <option value="om">Orange Money</option>
                <option value="momo">Mobile Money</option>
              </select>
            </div>

            {/* Liste des paiements ajoutés */}
            {paiements.length > 0 && (
              <div className="bg-base-200 rounded-lg p-3 mb-4">
                <div className="text-xs font-bold mb-2">Paiements enregistrés:</div>
                {paiements.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2 rounded mb-1">
                    <span className="text-sm">{p.mode === 'especes' ? 'Espèces' : p.mode === 'carte' ? 'Carte' : p.mode === 'cheque' ? 'Chèque' : p.mode === 'om' ? 'OM' : p.mode === 'momo' ? 'MoMo' : p.mode.toUpperCase()}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{p.montant} F</span>
                      <button 
                        onClick={() => setPaiements(paiements.filter((_, i) => i !== idx))}
                        className="btn btn-ghost btn-xs text-error"
                      >✕</button>
                    </div>
                  </div>
                ))}
                <div className="text-right text-xs mt-2 pt-2 border-t">
                  Total versé: <span className="font-bold">{paiements.reduce((acc, p) => acc + p.montant, 0)} F</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 items-end mb-4">
              <div className="form-control flex-1">
                <label className="label">
                  <span className="label-text">Montant</span>
                </label>
                <input
                  type="number"
                  value={montantPaye}
                  onChange={(e) => setMontantPaye(e.target.value)}
                  className="input input-bordered w-full text-2xl text-center"
                  placeholder={
                    (selectedFacture.part_client !== null && Number(selectedFacture.part_client) >= 0)
                      ? `Part Client: ${Math.round(Number(selectedFacture.part_client))} F`
                      : `${Math.round(Number(selectedFacture.total_ttc))} F`
                  }
                  autoFocus={paiements.length === 0}
                />
              </div>
              <button
                onClick={() => {
                  if (montantPaye && Number(montantPaye) > 0) {
                    setPaiements([...paiements, { mode: modePaiement, montant: Number(montantPaye) }])
                    const reste = Math.max(0, Number(selectedFacture.total_ttc) - paiements.reduce((acc, p) => acc + p.montant, 0) - Number(montantPaye))
                    setMontantPaye(reste > 0 ? reste.toString() : '')
                  }
                }}
                className="btn btn-primary"
                disabled={!montantPaye || Number(montantPaye) <= 0}
              >
                ➕ Ajouter
              </button>
            </div>

            {/* Calcul du rendu avec paiements multiples */}
            {(() => {
              const totalVerse = paiements.reduce((acc, p) => acc + p.montant, 0) + (paiements.length === 0 ? Number(montantPaye) : 0)
              const amountToPay = (selectedFacture.part_client !== null && Number(selectedFacture.part_client) >= 0)
                    ? Number(selectedFacture.part_client)
                    : Number(selectedFacture.total_ttc)
              const rendu = totalVerse - amountToPay
              
              return rendu > 0 && (
                <div className="alert alert-success mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="text-sm">Monnaie à rendre</div>
                    <div className="text-xl font-bold">{rendu.toFixed(0)} F</div>
                  </div>
                </div>
              )
            })()}

            <div className="modal-action">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="btn btn-ghost"
                disabled={loading}
              >
                Annuler
              </button>
              <button
                onClick={enregistrerPaiement}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? <span className="loading loading-spinner"></span> : 'Confirmer'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setIsPaymentModalOpen(false)}></div>
        </div>
      )}

      {/* Modal Ticket */}
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
                <h2 className="text-xl font-black">{pharmacySettings.pharmacy_name}</h2>
                <p>{pharmacySettings.city}, {pharmacySettings.country}</p>
                {pharmacySettings.phone && <p>Tel: {pharmacySettings.phone}</p>}
                {pharmacySettings.niu && <p>NIU: {pharmacySettings.niu}</p>}
                {pharmacySettings.registre_commerce && <p>RC: {pharmacySettings.registre_commerce}</p>}
              </div>
              
              <div className="space-y-1 mb-4">
                <div className="flex justify-between"><span>Ticket:</span><span>#{ticketCaisse.id}</span></div>
                {typeof ticketCaisse.facture === 'object' && ticketCaisse.facture.numero_facture && (
                  <div className="flex justify-between"><span>Facture:</span><span>#{ticketCaisse.facture.numero_facture}</span></div>
                )}
                <div className="flex justify-between"><span>Date:</span><span>{new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR')}</span></div>
                <div className="flex justify-between"><span>Client:</span><span>{typeof ticketCaisse.facture === 'object' ? ticketCaisse.facture.client_name || 'Passage' : ticketCaisse.client_name || 'Passage'}</span></div>
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
              {ticketCaisse.paiements_details && ticketCaisse.paiements_details.length > 0 ? (
                <div className="mt-2 text-xs font-normal border-t border-dashed border-black pt-1">
                    <div className="font-bold mb-1">Règlements:</div>
                    {ticketCaisse.paiements_details.map((paiement: any, idx: number) => {
                      const getModeLabel = (mode: string) => {
                        if (!mode) return 'N/A'
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
                <p>{pharmacySettings.ticket_footer_message || 'Merci de votre visite !'}</p>
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
          <div className="modal-backdrop" onClick={() => setShowTicketPreview(false)}></div>
        </div>
      )}
    </div>
  )
}
