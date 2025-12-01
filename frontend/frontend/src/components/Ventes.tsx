import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import type { Facture, TicketCaisse, CaisseParTranche } from '../types'

export default function Ventes() {
  const [factures, setFactures] = useState<Facture[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [deletingBrouillons, setDeletingBrouillons] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showCaisseTranches, setShowCaisseTranches] = useState(false)
  const [loadingCaisse, setLoadingCaisse] = useState(false)
  const [caisseData, setCaisseData] = useState<CaisseParTranche | null>(null)
  const [ticketCaisse, setTicketCaisse] = useState<TicketCaisse | null>(null)
  const [showTicketPreview, setShowTicketPreview] = useState(false)
  const [dateDebut, setDateDebut] = useState<string>(() => {
    const now = new Date()
    const date = now.toISOString().split('T')[0]
    // Par défaut, commencer à 00:00 du jour actuel
    return `${date}T00:00`
  })
  const [dateFin, setDateFin] = useState<string>(() => {
    const now = new Date()
    const date = now.toISOString().split('T')[0]
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return `${date}T${time}`
  })

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? ''),
    [],
  )
  const facturesEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/factures/`
    : '/api/factures/'
  const caisseEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/caisse/`
    : '/api/caisse/'

  useEffect(() => {
    fetchFactures()
  }, [])

  const fetchFactures = async () => {
    try {
      const response = await axios.get<Facture[]>(facturesEndpoint)
      setFactures(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des factures:', error)
      setFactures([])
    } finally {
      setLoading(false)
    }
  }

  const fetchFactureDetails = async (factureId: number) => {
    setLoadingDetails(true)
    try {
      const response = await axios.get<Facture>(`${facturesEndpoint}${factureId}/`)
      setSelectedFacture(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des détails de la facture:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleViewProducts = async (facture: Facture) => {
    // Si la facture a déjà les produits chargés, les afficher directement
    if (facture.produits && facture.produits.length > 0) {
      setSelectedFacture(facture)
    } else {
      // Sinon, charger les détails complets
      await fetchFactureDetails(facture.id)
    }
  }

  const handleOpenTicketPreview = async () => {
    if (!selectedFacture) return
    try {
      const { data } = await axios.get<TicketCaisse[]>(`${caisseEndpoint}?facture=${selectedFacture.id}`)
      if (!data || data.length === 0) {
        setTicketCaisse(null)
        setShowTicketPreview(false)
        setError('Aucun ticket de caisse trouvé pour cette facture.')
        return
      }
      setTicketCaisse(data[0])
      setShowTicketPreview(true)
    } catch (err) {
      setTicketCaisse(null)
      setShowTicketPreview(false)
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Erreur lors de la récupération du ticket de caisse.')
      } else {
        setError('Erreur lors de la récupération du ticket de caisse.')
      }
    }
  }

  const handleDeleteBrouillons = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer toutes les factures brouillons ? Cette action est irréversible.')) {
      return
    }

    setDeletingBrouillons(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await axios.delete(`${facturesEndpoint}supprimer_brouillons/`)
      setSuccessMessage(response.data.detail || `${response.data.count} facture(s) brouillon supprimée(s) avec succès.`)
      // Rafraîchir la liste des factures
      await fetchFactures()
      // Effacer le message de succès après 5 secondes
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Erreur lors de la suppression des factures brouillons.')
      } else {
        setError('Erreur lors de la suppression des factures brouillons.')
      }
      console.error('Erreur lors de la suppression des factures brouillons:', err)
    } finally {
      setDeletingBrouillons(false)
    }
  }

  const brouillonsCount = factures.filter(f => f.status === 'BROU').length

  const fetchCaisseParTranche = async () => {
    const dateDebutObj = new Date(dateDebut)
    const dateFinObj = new Date(dateFin)
    
    if (dateDebutObj >= dateFinObj) {
      setError("La date/heure de début doit être antérieure à la date/heure de fin.")
      return
    }

    setLoadingCaisse(true)
    setError(null)
    try {
      const response = await axios.get<CaisseParTranche>(`${facturesEndpoint}caisse_par_tranche_horaire/`, {
        params: {
          date_debut: dateDebut,
          date_fin: dateFin
        }
      })
      setCaisseData(response.data)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Erreur lors du calcul de la caisse par tranche horaire.')
      } else {
        setError('Erreur lors du calcul de la caisse par tranche horaire.')
      }
      console.error('Erreur lors du calcul de la caisse:', err)
    } finally {
      setLoadingCaisse(false)
    }
  }

  useEffect(() => {
    if (showCaisseTranches) {
      const dateDebutObj = new Date(dateDebut)
      const dateFinObj = new Date(dateFin)
      if (dateDebutObj < dateFinObj) {
        fetchCaisseParTranche()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCaisseTranches, dateDebut, dateFin])

  // Filtrer les factures
  const filteredFactures = factures.filter(facture =>
    (facture.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (facture.numero_facture && facture.numero_facture.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Historique des Ventes</h1>
          <p className="text-base-content/70">Consultez et gérez l'historique de toutes les factures</p>
        </div>
        
        <div className="stats shadow bg-base-100 border border-base-200">
          <div className="stat place-items-center py-2 px-4">
            <div className="stat-title text-xs uppercase tracking-wider">Total Factures</div>
            <div className="stat-value text-primary text-2xl">{factures.length}</div>
          </div>
          
          {brouillonsCount > 0 && (
            <div className="stat place-items-center py-2 px-4 border-l border-base-200">
              <div className="stat-title text-xs uppercase tracking-wider text-warning">Brouillons</div>
              <div className="stat-value text-warning text-2xl">{brouillonsCount}</div>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div role="alert" className="alert alert-error shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {successMessage && (
        <div role="alert" className="alert alert-success shadow-sm text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{successMessage}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setSuccessMessage(null)}>✕</button>
        </div>
      )}

      {/* Control Bar */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Rechercher client, n° facture..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-bordered pl-10 w-full focus:outline-none focus:border-primary"
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowCaisseTranches(!showCaisseTranches)}
              className={`btn btn-sm flex-1 md:flex-none gap-2 ${showCaisseTranches ? 'btn-primary' : 'btn-outline'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {showCaisseTranches ? 'Masquer Rapport' : 'Rapport Caisse'}
            </button>
            
            {brouillonsCount > 0 && (
              <button
                onClick={handleDeleteBrouillons}
                disabled={deletingBrouillons}
                className="btn btn-sm btn-error text-white flex-1 md:flex-none gap-2"
              >
                {deletingBrouillons ? <span className="loading loading-spinner loading-xs"></span> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                Supprimer Brouillons
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section Caisse par tranche horaire */}
      {showCaisseTranches && (
        <div className="card bg-base-100 shadow-md border border-base-200 overflow-hidden">
          <div className="bg-base-200/50 px-6 py-3 border-b border-base-200 flex justify-between items-center">
            <h2 className="font-bold text-base-content flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Rapport de Caisse
            </h2>
          </div>
          <div className="card-body p-6">
            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="form-control flex-1">
                <label className="label"><span className="label-text font-medium">Début</span></label>
                <input
                  type="datetime-local"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="input input-bordered w-full"
                  step="60"
                />
              </div>
              <div className="form-control flex-1">
                <label className="label"><span className="label-text font-medium">Fin</span></label>
                <input
                  type="datetime-local"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="input input-bordered w-full"
                  step="60"
                />
              </div>
              <button
                onClick={fetchCaisseParTranche}
                disabled={loadingCaisse || new Date(dateDebut) >= new Date(dateFin)}
                className="btn btn-primary w-full md:w-auto"
              >
                {loadingCaisse ? <span className="loading loading-spinner"></span> : 'Générer le rapport'}
              </button>
            </div>

            {new Date(dateDebut) >= new Date(dateFin) && (
              <div className="alert alert-warning mt-4 text-sm py-2">
                <span>La date de début doit être antérieure à la date de fin.</span>
              </div>
            )}

            {caisseData && !loadingCaisse && (
              <div className="mt-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
                    <div className="stat-title text-xs uppercase tracking-wider">Total HT</div>
                    <div className="stat-value text-xl">{Math.round(Number(caisseData.total_ht || 0)).toLocaleString('fr-FR')} F</div>
                  </div>
                  <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
                    <div className="stat-title text-xs uppercase tracking-wider">Total TVA</div>
                    <div className="stat-value text-xl">{Math.round(Number(caisseData.total_tva || 0)).toLocaleString('fr-FR')} F</div>
                  </div>
                  <div className="stat bg-primary text-primary-content rounded-xl shadow-lg p-4">
                    <div className="stat-title text-primary-content/80 text-xs uppercase tracking-wider">Total TTC</div>
                    <div className="stat-value text-2xl">{Math.round(Number(caisseData.total_ttc || 0)).toLocaleString('fr-FR')} F</div>
                    <div className="stat-desc text-primary-content/60 mt-1">{caisseData.nombre_factures} facture(s)</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Liste des factures */}
      <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead className="bg-base-200/50 text-base-content/70">
              <tr>
                <th>N° Facture</th>
                <th>Client</th>
                <th>Date</th>
                <th>Statut</th>
                <th className="text-right">Montant TTC</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFactures.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-base-content/50">
                    {searchQuery ? 'Aucune facture trouvée pour cette recherche' : 'Aucune facture enregistrée'}
                  </td>
                </tr>
              ) : (
                filteredFactures.map((facture) => (
                  <tr key={facture.id} className="hover:bg-base-200/30 transition-colors">
                    <td className="font-medium">
                      {facture.numero_facture || <span className="italic text-base-content/50">Brouillon #{facture.id}</span>}
                    </td>
                    <td>
                      <div className="font-medium">{facture.client_name || 'Client de passage'}</div>
                    </td>
                    <td className="text-sm text-base-content/70">
                      {new Date(facture.date).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td>
                      <span className={`badge badge-sm font-medium ${
                        facture.status === 'PAY' ? 'badge-success text-white' :
                        facture.status === 'BROU' ? 'badge-warning text-warning-content' :
                        facture.status === 'VAL' ? 'badge-info text-white' :
                        'badge-ghost'
                      }`}>
                        {facture.status_display}
                      </span>
                    </td>
                    <td className="text-right font-bold text-base-content">
                      {Math.round(Number(facture.total_ttc || 0)).toLocaleString('fr-FR')} F
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => handleViewProducts(facture)}
                        className="btn btn-sm btn-ghost btn-square text-primary hover:bg-primary/10"
                        title="Voir détails"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal pour afficher les produits de la facture */}
      {selectedFacture && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">
              Produits de la facture {selectedFacture.numero_facture || `Brouillon ${selectedFacture.id}`}
            </h3>
            
            {loadingDetails ? (
              <div className="flex justify-center items-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-base-200 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Client:</span> {selectedFacture.client_name || 'N/A'}
                    </div>
                    <div>
                      <span className="font-semibold">Date:</span> {new Date(selectedFacture.date).toLocaleString('fr-FR')}
                    </div>
                  </div>
                </div>

                {selectedFacture.produits && selectedFacture.produits.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                      <thead>
                        <tr>
                          <th>Produit</th>
                          <th className="text-right">Prix Unitaire</th>
                          <th className="text-right">Quantité</th>
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedFacture.produits.map((p, index) => {
                           const produitNom = typeof p.produit === 'object' ? p.produit.name : (p.produit_nom ?? `Produit #${p.produit}`)
                           return (
                          <tr key={index}>
                            <td>{produitNom}</td>
                            <td className="text-right">{Math.round(Number(p.selling_price)).toLocaleString('fr-FR')} F</td>
                            <td className="text-right">{Math.abs(p.quantity)}</td>
                            <td className="text-right">{Math.round(Math.abs(p.quantity) * Number(p.selling_price)).toLocaleString('fr-FR')} F</td>
                          </tr>
                           )
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="text-right font-bold">Total TTC:</td>
                          <td className="text-right font-bold">{Math.round(Number(selectedFacture.total_ttc)).toLocaleString('fr-FR')} F</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-base-content/50">
                    Aucune ligne de produit pour cette facture.
                  </div>
                )}
              </>
            )}
            
            <div className="modal-action">
              <button className="btn" onClick={() => setSelectedFacture(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aperçu Ticket */}
      {showTicketPreview && ticketCaisse && selectedFacture && (
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
            <div className="bg-white p-6 rounded-lg shadow-lg" id="ticket-preview" style={{ maxWidth: '80mm', margin: '0 auto', color: '#000', fontFamily: "'Arial Black', Arial, sans-serif" }}>
              <div className="text-center mb-4 border-b-2 border-gray-800 pb-3">
                <h2 className="text-xl font-bold">DJADEU PHARMACY</h2>
                <p className="text-sm">Logbessou</p>
                <p className="text-sm">Tel: 697268949</p>
              </div>
              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">Ticket N°:</span>
                  <span>#{ticketCaisse.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Facture:</span>
                  <span>{selectedFacture.numero_facture || `FAC-${selectedFacture.id}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Client:</span>
                  <span className="text-right">{selectedFacture.client_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Date:</span>
                  <span>{new Date(ticketCaisse.date_paiement || selectedFacture.date).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
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
              {selectedFacture.produits && selectedFacture.produits.length > 0 && (
                <div className="mb-4 border-t border-b border-gray-300 py-2">
                  <div className="text-xs font-semibold mb-2">Détails:</div>
                  {selectedFacture.produits.slice(0, 5).map((p) => {
                    const produitNom = typeof p.produit === 'object' ? p.produit.name : (p.produit_nom ?? `Produit #${p.produit}`)
                    return (
                      <div key={p.id} className="flex justify-between text-xs mb-1">
                        <span className="flex-1">{produitNom} x{Math.abs(p.quantity)}</span>
                        <span>{Math.round(Math.abs(p.quantity) * Number(p.selling_price || 0))} F</span>
                      </div>
                    )
                  })}
                  {selectedFacture.produits.length > 5 && (
                    <div className="text-xs text-gray-500 mt-1">... et {selectedFacture.produits.length - 5} autre(s) produit(s)</div>
                  )}
                </div>
              )}
              <div className="mb-4 space-y-1 text-sm border-t border-gray-300 pt-2">
                <div className="flex justify-between">
                  <span>Sous-total HT:</span>
                  <span>{Math.round(Number(selectedFacture.total_ht || 0)).toLocaleString('fr-FR')} F</span>
                </div>
                {Number(selectedFacture.remise || 0) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Remise:</span>
                    <span>-{Math.round(Number(selectedFacture.remise || 0)).toLocaleString('fr-FR')} F</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>TVA ({selectedFacture.tva}%):</span>
                  <span>{Math.round(Number(selectedFacture.total_tva || 0)).toLocaleString('fr-FR')} F</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t-2 border-gray-800 pt-2 mt-2">
                  <span>TOTAL:</span>
                  <span>{Math.round(Number(ticketCaisse.montant || selectedFacture.total_ttc || 0)).toLocaleString('fr-FR')} F</span>
                </div>
              </div>
              <div className="text-center text-xs border-t border-gray-300 pt-3 mt-4">
                <p>Merci de votre visite !</p>
                <p className="mt-1">Ticket généré le {new Date().toLocaleString('fr-FR')}</p>
              </div>
            </div>
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
                            <title>Ticket de Caisse - ${selectedFacture.numero_facture || ''}</title>
                            <style>
                              @media print {
                                @page { margin: 0; size: 80mm auto; }
                                body { margin: 0; padding: 10mm; font-family: 'Arial Black', Arial, sans-serif; font-size: 12px; color: #000; font-weight: 600; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                              }
                              body { margin: 0; padding: 10mm; font-family: 'Arial Black', Arial, sans-serif; font-size: 12px; color: #000; font-weight: 600; }
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