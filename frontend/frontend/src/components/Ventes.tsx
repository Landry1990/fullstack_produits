import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import DOMPurify from 'dompurify'
import type { Facture, TicketCaisse, CaisseParTranche } from '../types'

export default function Ventes() {
  const navigate = useNavigate()
  const [factures, setFactures] = useState<Facture[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'validated' | 'cancelled'>('all')
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [deletingBrouillons, setDeletingBrouillons] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showCaisseTranches, setShowCaisseTranches] = useState(false)
  const [loadingCaisse, setLoadingCaisse] = useState(false)
  const [caisseData, setCaisseData] = useState<CaisseParTranche | null>(null)
  const [ticketCaisse, setTicketCaisse] = useState<TicketCaisse | null>(null)
  const [showTicketPreview, setShowTicketPreview] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundFacture, setRefundFacture] = useState<Facture | null>(null)
  const [refundMode, setRefundMode] = useState('especes')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReference, setRefundReference] = useState('')
  
  // Pagination State
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Helper pour formater la date locale en string pour l'input datetime-local (YYYY-MM-DDThh:mm)
  const getLocalDateTimeString = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Helper pour formater la date en format français JJ/MM/AAAA HH:mm
  const formatDateFr = (dateString: string) => {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  }

  const [dateDebut, setDateDebut] = useState<string>(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return getLocalDateTimeString(now)
  })
  
  const [dateFin, setDateFin] = useState<string>(() => {
    const now = new Date()
    return getLocalDateTimeString(now)
  })

  // Debounce search query
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, filterStatus]);

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
  }, [page, debouncedSearchQuery, filterStatus])

  const fetchFactures = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      
      if (debouncedSearchQuery) {
        params.append('search', debouncedSearchQuery)
      }

      if (filterStatus === 'validated') {
        params.append('status__in', 'VAL,PAY')
      } else if (filterStatus === 'cancelled') {
        params.append('status', 'ANN')
      }

      const response = await axios.get(facturesEndpoint, { params })
      const data = response.data

      if (data.results) {
        setFactures(data.results)
        setTotalCount(data.count)
        setTotalPages(Math.ceil(data.count / 50)) // Assuming page size is 50
      } else {
        // Fallback for non-paginated response (should not happen with default DRF)
        setFactures(Array.isArray(data) ? data : [])
        setTotalCount(Array.isArray(data) ? data.length : 0)
        setTotalPages(1)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des factures:', error)
      setFactures([])
    } finally {
      setLoading(false)
    }
  }

  // ... (keep fetchFactureDetails, handleViewProducts, handleOpenTicketPreview, handlePrintInvoice, handleOpenRefundModal, handleConfirmRefund, printInvoicePDF, handleDeleteBrouillons, brouillonsCount, fetchCaisseParTranche, useEffect for caisse) ...

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
    
    // Si la facture est payée, charger aussi les détails de paiement
    if (facture.status === 'PAY') {
      try {
        const { data } = await axios.get<any[]>(`${caisseEndpoint}?facture=${facture.id}`)
        if (data && data.length > 0) {
          // Créer un ticket agrégé avec tous les paiements
          const paiementsDetails = data.map(p => ({
            mode: p.mode_paiement,
            montant: Number(p.montant),
            part_patient: p.part_patient ? Number(p.part_patient) : null,
            part_assurance: p.part_assurance ? Number(p.part_assurance) : null
          }))
          
          setTicketCaisse({
            ...data[0],
            paiements_details: paiementsDetails
          } as TicketCaisse)
        }
      } catch (err) {
        console.error('Erreur lors du chargement des paiements:', err)
      }
    }
  }

  const handleOpenTicketPreview = async () => {
    if (!selectedFacture) return
    try {
      const { data } = await axios.get<any[]>(`${caisseEndpoint}?facture=${selectedFacture.id}`)
      if (!data || data.length === 0) {
        setTicketCaisse(null)
        setShowTicketPreview(false)
        setError('Aucun ticket de caisse trouvé pour cette facture.')
        return
      }

      // Créer un ticket agrégé avec tous les paiements
      const paiementsDetails = data.map(p => ({
        mode: p.mode_paiement,
        montant: Number(p.montant),
        part_patient: p.part_patient ? Number(p.part_patient) : null,
        part_assurance: p.part_assurance ? Number(p.part_assurance) : null
      }))

      setTicketCaisse({
        ...data[0],
        paiements_details: paiementsDetails
      } as TicketCaisse)
      
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

  const handlePrintInvoice = async () => {
    if (!selectedFacture) return
    
    // Vérifier si c'est un client générique
    const isGenericClient = !selectedFacture.client_name || 
                            selectedFacture.client_name.toLowerCase().includes('divers') ||
                            selectedFacture.client_name.toLowerCase().includes('passage')
    
    let clientName: string | null = null
    
    if (isGenericClient) {
      // Demander le nom du client
      clientName = window.prompt('Nom du client pour la facture:', '')
      if (clientName === null) return // Annulation
    }
    
    // Imprimer la facture
    await printInvoicePDF(selectedFacture.id, clientName)
  }

  const handleOpenRefundModal = (facture: Facture) => {
    setRefundFacture(facture)
    // Calculer le montant restant à rembourser (total TTC négatif)
    // On suppose qu'on rembourse tout le montant TTC
    setRefundAmount((-Number(facture.total_ttc)).toString())
    setRefundMode('especes')
    setRefundReference('')
    setShowRefundModal(true)
  }

  const handleConfirmRefund = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!refundFacture) return

    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // 1. Annuler la facture (changer le statut) avec le motif
      await axios.post(`${facturesEndpoint}${refundFacture.id}/annuler/`, {
        motif: refundReference
      })

      // 2. Créer la transaction négative dans la caisse
      await axios.post(caisseEndpoint, {
        facture: refundFacture.id,
        mode_paiement: refundMode,
        montant: refundAmount, // Montant négatif
        reference: refundReference || `Remboursement Facture #${refundFacture.numero_facture || refundFacture.id}`,
        statut: 'completee'
      })

      setSuccessMessage('Facture annulée et remboursement enregistré avec succès.')
      setShowRefundModal(false)
      setRefundFacture(null)
      // Rafraîchir les données
      await fetchFactures()
      if (showCaisseTranches) {
        fetchCaisseParTranche()
      }
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Erreur lors de l\'enregistrement du remboursement.')
      } else {
        setError('Erreur lors de l\'enregistrement du remboursement.')
      }
      console.error('Erreur remboursement:', err)
    } finally {
      setLoading(false)
    }
  }

  const printInvoicePDF = async (factureId: number, clientName?: string | null) => {
    try {
      const endpoint = `${facturesEndpoint}${factureId}/imprimer_facture/`
      const params = clientName ? { client_name_override: clientName } : {}
      
      const response = await axios.get(endpoint, {
        params,
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `facture_${factureId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      
      setSuccessMessage('Facture téléchargée avec succès')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Erreur lors de l\'impression de la facture')
      } else {
        setError('Erreur lors de l\'impression de la facture')
      }
      console.error('Erreur impression:', err)
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

  const brouillonsCount = useMemo(() => {
      // Note: This count might be inaccurate if brouillons are not on the current page.
      // Ideally backend should provide this count separately or we fetch distinct count
      return factures.filter(f => f.status === 'BROU').length
  }, [factures])

  const handleOpenDevisInFacturation = useCallback(async (facture: Facture) => {
    try {
      // Charger les détails complets de la facture (avec produits) si pas déjà chargés
      let factureComplete = facture
      if (!facture.produits || facture.produits.length === 0) {
        const response = await axios.get<Facture>(`${facturesEndpoint}${facture.id}/`)
        factureComplete = response.data
      }
      
      // Stocker le devis dans localStorage pour qu'il puisse être chargé par Facturation
      localStorage.setItem('devis_to_load', JSON.stringify(factureComplete))
      
      // Naviguer vers l'interface de facturation
      navigate('/app/facturation')
    } catch (err) {
      console.error('Erreur lors du chargement du devis:', err)
      setError('Impossible de charger le devis')
    }
  }, [facturesEndpoint])


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
    <div className="flex flex-col h-full p-4 space-y-4 animate-fade-in">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Historique des Ventes</h1>
          <p className="text-base-content/70 text-sm">Consultez et gérez l'historique de toutes les factures</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-base-200 px-4 py-2 flex items-center gap-6">
          <div className="flex flex-col items-center">
            <span className="text-xs uppercase tracking-wider font-bold opacity-50">Total Factures</span>
            <span className="text-xl font-bold text-primary">{totalCount}</span>
          </div>
          
          {brouillonsCount > 0 && (
            <div className="flex flex-col items-center border-l pl-6 border-base-200">
              <span className="text-xs uppercase tracking-wider font-bold text-warning">Brouillons (Page)</span>
              <span className="text-xl font-bold text-warning">{brouillonsCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div role="alert" className="alert alert-error shrink-0 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {successMessage && (
        <div role="alert" className="alert alert-success shrink-0 shadow-sm text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{successMessage}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setSuccessMessage(null)}>✕</button>
        </div>
      )}

      {/* Control Bar */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-4 justify-between items-center shrink-0">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Rechercher client, n° facture..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-sm input-bordered pl-9 w-full focus:outline-none focus:border-primary"
            />
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
            <div className="join">
              <button 
                className={`join-item btn btn-sm ${filterStatus === 'all' ? 'btn-active font-bold' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                Toutes
              </button>
              <button 
                className={`join-item btn btn-sm ${filterStatus === 'validated' ? 'btn-success text-white' : ''}`}
                onClick={() => setFilterStatus('validated')}
              >
                Validées
              </button>
              <button 
                className={`join-item btn btn-sm ${filterStatus === 'cancelled' ? 'btn-error text-white' : ''}`}
                onClick={() => setFilterStatus('cancelled')}
              >
                Annulées
              </button>
            </div>

            <button
              onClick={() => setShowCaisseTranches(!showCaisseTranches)}
              className={`btn btn-sm gap-2 ${showCaisseTranches ? 'btn-primary' : 'btn-outline'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {showCaisseTranches ? 'Masquer Rapport' : 'Rapport Caisse'}
            </button>
            
            {brouillonsCount > 0 && (
              <button
                onClick={handleDeleteBrouillons}
                disabled={deletingBrouillons}
                className="btn btn-sm btn-error text-white gap-2"
              >
                {deletingBrouillons ? <span className="loading loading-spinner loading-xs"></span> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                Vider Brouillons
              </button>
            )}
          </div>
      </div>

      {/* Section Caisse par tranche horaire */}
      {showCaisseTranches && (
        <div className="bg-white rounded-lg shadow border border-base-200 overflow-hidden shrink-0">
          <div className="bg-base-50 px-6 py-3 border-b flex justify-between items-center">
            <h2 className="font-bold text-base-content flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Rapport de Caisse
            </h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="form-control flex-1">
                <label className="label"><span className="label-text font-medium text-xs uppercase">Début</span></label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={dateDebut.split('T')[0]}
                    onChange={(e) => setDateDebut(e.target.value + 'T' + dateDebut.split('T')[1])}
                    className="input input-sm input-bordered w-full"
                    lang="fr"
                  />
                  <input
                    type="time"
                    value={dateDebut.split('T')[1]}
                    onChange={(e) => setDateDebut(dateDebut.split('T')[0] + 'T' + e.target.value)}
                    className="input input-sm input-bordered w-32"
                    lang="fr"
                  />
                </div>
              </div>
              <div className="form-control flex-1">
                <label className="label"><span className="label-text font-medium text-xs uppercase">Fin</span></label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={dateFin.split('T')[0]}
                    onChange={(e) => setDateFin(e.target.value + 'T' + dateFin.split('T')[1])}
                    className="input input-bordered input-sm w-full"
                    lang="fr"
                  />
                   <input
                    type="time"
                    value={dateFin.split('T')[1]}
                    onChange={(e) => setDateFin(dateFin.split('T')[0] + 'T' + e.target.value)}
                    className="input input-bordered input-sm w-32"
                    lang="fr"
                  />
                </div>
              </div>
              <button
                onClick={fetchCaisseParTranche}
                disabled={loadingCaisse || new Date(dateDebut) >= new Date(dateFin)}
                className="btn btn-primary btn-sm w-full md:w-auto"
              >
                {loadingCaisse ? <span className="loading loading-spinner"></span> : 'Générer le rapport'}
              </button>
            </div>

            {new Date(dateDebut) >= new Date(dateFin) && (
              <div className="alert alert-warning mt-4 text-sm py-2 rounded-lg">
                <span>La date de début doit être antérieure à la date de fin.</span>
              </div>
            )}

            {caisseData && !loadingCaisse && (
              <div className="mt-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-base-50 rounded-lg p-4 text-center border">
                    <div className="text-xs uppercase tracking-wider opacity-60">Total HT</div>
                    <div className="text-xl font-bold">{Math.round(Number(caisseData.total_ht || 0)).toLocaleString('fr-FR')} F</div>
                  </div>
                  <div className="bg-base-50 rounded-lg p-4 text-center border">
                    <div className="text-xs uppercase tracking-wider opacity-60">Total TVA</div>
                    <div className="text-xl font-bold">{Math.round(Number(caisseData.total_tva || 0)).toLocaleString('fr-FR')} F</div>
                  </div>
                  <div className="bg-primary text-primary-content rounded-lg shadow p-4 text-center">
                    <div className="text-xs uppercase tracking-wider opacity-80">Total TTC</div>
                    <div className="text-2xl font-bold">{Math.round(Number(caisseData.total_ttc || 0)).toLocaleString('fr-FR')} F</div>
                    <div className="text-xs opacity-70 mt-1">{caisseData.nombre_factures} facture(s)</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Liste des factures */}
      <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          <table className="table table-xs w-full table-pin-rows">
            <thead className="bg-base-100/80 backdrop-blur text-base-content/70 z-10">
              <tr>
                <th>N° Facture</th>
                <th>Client</th>
                <th>Date</th>
                <th>Statut</th>
                {filterStatus === 'cancelled' && <th>Motif Annulation</th>}
                <th className="text-right">Remise</th>
                <th className="text-right">Montant TTC</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {factures.length === 0 ? (
                <tr>
                  <td colSpan={filterStatus === 'cancelled' ? 8 : 7} className="text-center py-12 text-base-content/50">
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-3xl">📭</span>
                        <span>{searchQuery ? 'Aucune facture trouvée' : 'Aucune facture enregistrée'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                factures.map((facture) => (
                  <tr 
                    key={facture.id} 
                    className="hover:bg-base-50 transition-colors cursor-pointer border-b border-base-100 last:border-0"
                    onClick={() => handleViewProducts(facture)}
                  >
                    <td className="font-bold font-mono text-sm md:text-base">
                      {facture.numero_facture || <span className="italic text-base-content/50">Brouillon #{facture.id}</span>}
                    </td>
                    <td>
                      <div className="font-bold text-sm">{facture.client_name || 'Client de passage'}</div>
                    </td>
                    <td className="text-xs text-base-content/70">
                      {formatDateFr(facture.date)}
                    </td>
                    <td>
                      <span className="badge badge-sm font-medium badge-ghost">
                        {facture.status_display}
                      </span>
                    </td>
                    {filterStatus === 'cancelled' && (
                      <td className="text-xs text-error italic max-w-xs truncate" title={facture.notes || ''}>
                        {facture.notes ? facture.notes.split('\n').pop()?.replace(/.*Motif: /, '') : '-'}
                      </td>
                    )}
                    <td className="text-right">
                      {Number(facture.remise) > 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-error font-medium">
                            -{Math.round(Number(facture.remise)).toLocaleString('fr-FR')} F
                          </span>
                          {facture.is_remise_auto && (
                            <span className="badge badge-xs badge-ghost gap-1" title="Remise automatique appliquée">
                              🤖 Auto
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-base-content/30 text-xs">-</span>
                      )}
                    </td>
                    <td className="text-right font-bold text-base-content">
                      {Math.round(Number(facture.total_ttc || 0)).toLocaleString('fr-FR')} F
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewProducts(facture); }}
                          className="btn btn-xs btn-ghost btn-square text-primary"
                          title="Voir détails"
                        >
                          👁️
                        </button>
                        {/* Bouton pour ouvrir/modifier dans Facturation (toutes sauf annulées) */}
                        {facture.status !== 'ANN' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenDevisInFacturation(facture); }}
                            className="btn btn-xs btn-ghost btn-square text-success"
                            title="Modifier / Rappeler dans Facturation"
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenRefundModal(facture); }}
                          className={`btn btn-xs btn-ghost btn-square ${facture.status === 'ANN' ? 'opacity-0 cursor-default' : 'text-error'}`}
                          title={facture.status === 'ANN' ? 'Déjà annulée' : "Annuler / Rembourser"}
                          disabled={facture.status === 'ANN'}
                        >
                          {facture.status !== 'ANN' && '↩️'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination & Footer info */}
        <div className="p-2 border-t bg-base-50/50 text-xs text-center text-base-content/50 flex flex-col items-center gap-2">
            <div>
              {factures.length} facture{factures.length > 1 ? 's' : ''} affichée{factures.length > 1 ? 's' : ''} sur {totalCount} total
            </div>
            
            {!loading && totalCount > 0 && (
                <div className="flex justify-center items-center gap-2">
                <button 
                  className="btn btn-xs btn-outline" 
                  disabled={page === 1} 
                  onClick={() => setPage(page - 1)}
                >
                  ← Précédent
                </button>
                <div className="px-2 py-1 bg-white rounded border border-base-200">
                  <span className="font-semibold">Page {page}</span>
                  {totalPages > 1 && <span className="text-gray-500"> / {totalPages}</span>}
                </div>
                <button 
                  className="btn btn-xs btn-outline" 
                  disabled={page >= totalPages} 
                  onClick={() => setPage(page + 1)}
                >
                  Suivant →
                </button>
              </div>
            )}
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
                    <table className="table table-zebra w-full table-xs">
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
                           const isDeleted = p.produit === null;
                           
                           return (
                          <tr key={index}>
                            <td className={isDeleted ? 'italic' : ''}>
                                {produitNom}
                                {isDeleted && <span className="text-xs ml-2 opacity-75">(Supprimé)</span>}
                            </td>
                            <td className="text-right">{Math.round(Number(p.selling_price)).toLocaleString('fr-FR')} F</td>
                            <td className="text-right">{Math.abs(p.quantity)}</td>
                            <td className="text-right">{Math.round(Math.abs(p.quantity) * Number(p.selling_price)).toLocaleString('fr-FR')} F</td>
                          </tr>
                           )
                        })}
                      </tbody>
                      <tfoot className="bg-base-100 font-bold text-sm">
                        <tr>
                            <td colSpan={3} className="text-right font-normal text-base-content/70 border-b-0 pb-1">Sous-total HT:</td>
                            <td className="text-right border-b-0 pb-1">{Math.round(Number(selectedFacture.total_ht)).toLocaleString('fr-FR')} F</td>
                        </tr>
                        {Number(selectedFacture.remise) > 0 && (
                            <tr>
                                <td colSpan={3} className="text-right font-normal text-error border-b-0 py-1">Remise:</td>
                                <td className="text-right text-error border-b-0 py-1">-{Math.round(Number(selectedFacture.remise)).toLocaleString('fr-FR')} F</td>
                            </tr>
                        )}
                        <tr>
                            <td colSpan={3} className="text-right font-normal text-base-content/70 border-b-0 py-1">TVA:</td>
                            <td className="text-right border-b-0 py-1">{Math.round(Number(selectedFacture.total_tva)).toLocaleString('fr-FR')} F</td>
                        </tr>
                        <tr className="text-lg">
                          <td colSpan={3} className="text-right pt-2 border-t border-base-300">Total TTC:</td>
                  <td className="text-right pt-2 border-t border-base-300 text-primary">{Math.round(Number(selectedFacture.total_ttc)).toLocaleString('fr-FR')} F</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-base-content/50">
                    Aucune ligne de produit pour cette facture.
                  </div>
                )}
                
                {/* Payment Details Section - Show for all paid invoices */}
                {selectedFacture.status === 'PAY' && ticketCaisse && ticketCaisse.paiements_details && ticketCaisse.paiements_details.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-bold text-base mb-3 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      Détails du règlement
                    </h4>
                    <div className="bg-base-200/30 rounded-lg p-4 space-y-2">
                      {ticketCaisse.paiements_details.map((paiement: any, idx: number) => {
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
                        
                        const isPartPatient = paiement.part_patient && paiement.part_patient > 0
                        const isPartAssurance = paiement.part_assurance && paiement.part_assurance > 0
                        
                        return (
                          <div key={idx} className="flex justify-between items-center py-2 px-3 bg-white rounded border border-base-300">
                            <span className="font-medium">
                              {getModeLabel(paiement.mode)}
                              {isPartPatient && <span className="ml-2 badge badge-success badge-sm">Part Patient</span>}
                              {isPartAssurance && <span className="ml-2 badge badge-info badge-sm">Part Assurance</span>}
                            </span>
                            <span className="font-bold">{Math.round(paiement.montant).toLocaleString('fr-FR')} F</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
            
            <div className="modal-action flex justify-between">
               <div className="flex gap-2">
                  <button 
                    className="btn btn-outline gap-2"
                    onClick={async () => {
                         // On charge le ticket s'il n'est pas là, puis on ouvre la preview
                         await handleOpenTicketPreview() 
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Imprimer Ticket
                  </button>
                  
                  <button 
                    className="btn btn-primary gap-2"
                    onClick={handlePrintInvoice}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Imprimer Facture
                  </button>
               </div>
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
                {ticketCaisse.paiements_details ? (
                  <div className="mt-2 text-xs font-normal border-t border-dashed border-gray-400 pt-1">
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
                        
                        const isPartPatient = paiement.part_patient && paiement.part_patient > 0
                        const isPartAssurance = paiement.part_assurance && paiement.part_assurance > 0
                        
                        return (
                          <div key={idx} className="flex justify-between">
                            <span>
                              {getModeLabel(paiement.mode || '')}
                              {isPartPatient && <span className="text-gray-600 italic font-normal"> (Patient)</span>}
                              {isPartAssurance && <span className="text-gray-600 italic font-normal"> (Assur)</span>}
                            </span>
                            <span>{Math.round(paiement.montant)} F</span>
                          </div>
                        )
                      })}
                  </div>
                ) : (
                    <div className="flex justify-between">
                    <span className="font-semibold">Mode de paiement:</span>
                    <span className="uppercase">
                        {ticketCaisse.mode_paiement === 'especes' ? 'Espèces' :
                        ticketCaisse.mode_paiement === 'cheque' ? 'Chèque' :
                        ticketCaisse.mode_paiement === 'carte' ? 'Carte' :
                        ticketCaisse.mode_paiement === 'virement' ? 'Virement' : 
                        ticketCaisse.mode_paiement === 'om' ? 'Orange Money' :
                        ticketCaisse.mode_paiement === 'momo' ? 'Mobile Money' :
                        ticketCaisse.mode_paiement === 'en_compte' ? 'En compte' :
                        ticketCaisse.mode_paiement}
                    </span>
                    </div>
                )}
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
                  <span>TVA:</span>
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
                            ${DOMPurify.sanitize(printContent.innerHTML)}
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

      {/* Modal de Remboursement */}
      {showRefundModal && refundFacture && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg text-error">Remboursement / Annulation</h3>
              <button 
                className="btn btn-sm btn-circle btn-ghost"
                onClick={() => setShowRefundModal(false)}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleConfirmRefund} className="space-y-4">
              <div className="alert alert-warning text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span>Cette action créera une transaction négative dans la caisse pour annuler la vente.</span>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Facture concernée</span>
                </label>
                <input 
                  type="text" 
                  value={refundFacture.numero_facture || `Facture #${refundFacture.id}`} 
                  className="input input-bordered w-full bg-base-200" 
                  disabled 
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Montant à rembourser (Négatif)</span>
                </label>
                <input 
                  type="number" 
                  value={refundAmount} 
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="input input-bordered w-full text-error font-bold" 
                  step="0.01"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Mode de remboursement</span>
                </label>
                <select 
                  value={refundMode} 
                  onChange={(e) => setRefundMode(e.target.value)}
                  className="select select-bordered w-full"
                >
                  <option value="especes">Espèces</option>
                  <option value="cheque">Chèque</option>
                  <option value="carte">Carte Bancaire</option>
                  <option value="virement">Virement</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Référence / Motif (Optionnel)</span>
                </label>
                <input 
                  type="text" 
                  value={refundReference} 
                  onChange={(e) => setRefundReference(e.target.value)}
                  placeholder="Ex: Erreur de saisie, Retour produit..."
                  className="input input-bordered w-full" 
                />
              </div>

              <div className="modal-action">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setShowRefundModal(false)}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn btn-error text-white"
                  disabled={loading}
                >
                  {loading ? <span className="loading loading-spinner"></span> : 'Confirmer Remboursement'}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => setShowRefundModal(false)}></div>
        </div>
      )}
    </div>
  )
}
