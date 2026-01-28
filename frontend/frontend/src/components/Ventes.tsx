import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import DOMPurify from 'dompurify'
import type { Facture, TicketCaisse, CaisseParTranche } from '../types'
import { safeStorage } from '../utils/storage'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import { TicketTemplate } from './printing/TicketTemplate'

export default function Ventes() {
  const { t } = useTranslation()
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

  const { settings: pharmacySettings } = usePharmacySettings()

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
            facture: facture,
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
      const response = await axios.get<any>(`${caisseEndpoint}?facture=${selectedFacture.id}`)
      const data = response.data
      
      // Gérer la pagination (DRF peut retourner { results: [...] } ou [...])
      const results = Array.isArray(data) ? data : (data.results || [])

      if (!results || results.length === 0) {
        setTicketCaisse(null)
        setShowTicketPreview(false)
        setError(t('sales.messages.no_results'))
        return
      }

      // Créer un ticket agrégé avec tous les paiements
      const paiementsDetails = results.map((p: any) => ({
        mode: p.mode_paiement,
        montant: Number(p.montant),
        part_patient: p.part_patient ? Number(p.part_patient) : null,
        part_assurance: p.part_assurance ? Number(p.part_assurance) : null
      }))

      setTicketCaisse({
        ...results[0],
        facture: selectedFacture,
        paiements_details: paiementsDetails
      } as TicketCaisse)
      
      setShowTicketPreview(true)
    } catch (err) {
      setTicketCaisse(null)
      setShowTicketPreview(false)
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Erreur lors de la récupération du ticket de caisse.')
      } else {
        setError(t('sales.messages.no_results')) // Using generic or specific error if needed
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
      clientName = window.prompt(t('sales.messages.prompt_client_name'), '')
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

      setSuccessMessage(t('sales.messages.refund_success'))
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
        setError(t('sales.messages.refund_error'))
      }
      console.error('Erreur remboursement:', err)
    } finally {
      setLoading(false)
    }
  }

  const printInvoicePDF = async (factureId: number, clientName?: string | null) => {
    // Open the new print page in a new tab
    const url = `/app/print-invoice/${factureId}`;
    window.open(url, '_blank');
  }


  const handleDeleteBrouillons = async () => {
    if (!confirm(t('sales.messages.delete_drafts_confirm'))) {
      return
    }

    setDeletingBrouillons(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await axios.delete(`${facturesEndpoint}supprimer_brouillons/`)
      setSuccessMessage(response.data.detail || t('sales.messages.delete_drafts_success', { count: response.data.count, defaultValue: `${response.data.count} facture(s) brouillon supprimée(s) avec succès.` }))
      // Rafraîchir la liste des factures
      await fetchFactures()
      // Effacer le message de succès après 5 secondes
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Erreur lors de la suppression des factures brouillons.')
      } else {
        setError(t('sales.messages.delete_drafts_error'))
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
      
      // Stocker le devis dans safeStorage pour qu'il puisse être chargé par Facturation
      safeStorage.setItem('devis_to_load', JSON.stringify(factureComplete), 'local')
      
      // Naviguer vers l'interface de facturation
      navigate('/app/facturation')
    } catch (err) {
      console.error('Erreur lors du chargement du devis:', err)
      setError(t('sales.messages.error_loading_quote', { defaultValue: 'Impossible de charger le devis' }))
    }
  }, [facturesEndpoint])


  const fetchCaisseParTranche = async () => {
    const dateDebutObj = new Date(dateDebut)
    const dateFinObj = new Date(dateFin)
    
    if (dateDebutObj >= dateFinObj) {
      setError(t('sales.messages.date_error'))
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
        setError(t('sales.messages.cash_report_error', { defaultValue: 'Erreur lors du calcul de la caisse par tranche horaire.' }))
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
          <h1 className="text-2xl font-bold text-base-content">{t('sales.title')}</h1>
          <p className="text-base-content/70 text-sm">{t('sales.subtitle')}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-base-200 px-4 py-2 flex items-center gap-6">
          <div className="flex flex-col items-center">
            <span className="text-xs uppercase tracking-wider font-bold opacity-50">{t('sales.total_invoices')}</span>
            <span className="text-xl font-bold text-primary">{totalCount}</span>
          </div>
          
          {brouillonsCount > 0 && (
            <div className="flex flex-col items-center border-l pl-6 border-base-200">
              <span className="text-xs uppercase tracking-wider font-bold text-warning">{t('sales.drafts')}</span>
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
              placeholder={t('sales.filters.search_placeholder')}
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
                {t('sales.filters.all')}
              </button>
              <button 
                className={`join-item btn btn-sm ${filterStatus === 'validated' ? 'btn-success text-white' : ''}`}
                onClick={() => setFilterStatus('validated')}
              >
                {t('sales.filters.validated')}
              </button>
              <button 
                className={`join-item btn btn-sm ${filterStatus === 'cancelled' ? 'btn-error text-white' : ''}`}
                onClick={() => setFilterStatus('cancelled')}
              >
                {t('sales.filters.cancelled')}
              </button>
            </div>

            <button
              onClick={() => setShowCaisseTranches(!showCaisseTranches)}
              className={`btn btn-sm gap-2 ${showCaisseTranches ? 'btn-primary' : 'btn-outline'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {showCaisseTranches ? t('sales.actions.hide_report') : t('sales.actions.generate_report')}
            </button>
            
            {brouillonsCount > 0 && (
              <button
                onClick={handleDeleteBrouillons}
                disabled={deletingBrouillons}
                className="btn btn-sm btn-error text-white gap-2"
              >
                {deletingBrouillons ? <span className="loading loading-spinner loading-xs"></span> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                {t('sales.actions.delete_drafts')}
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
              {t('sales.cash_report')}
            </h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="form-control flex-1">
                <label className="label"><span className="label-text font-medium text-xs uppercase">{t('sales.filters.start_date')}</span></label>
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
                <label className="label"><span className="label-text font-medium text-xs uppercase">{t('sales.filters.end_date')}</span></label>
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
                {loadingCaisse ? <span className="loading loading-spinner"></span> : t('sales.actions.generate_report')}
              </button>
            </div>

            {new Date(dateDebut) >= new Date(dateFin) && (
              <div className="alert alert-warning mt-4 text-sm py-2 rounded-lg">
                <span>{t('sales.messages.date_error')}</span>
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
                <th>{t('sales.table.invoice_number')}</th>
                <th>{t('sales.table.client')}</th>
                <th>{t('sales.table.date')}</th>
                <th>{t('sales.table.status')}</th>
                {filterStatus === 'cancelled' && <th>{t('sales.table.cancellation_reason')}</th>}
                <th className="text-right">{t('sales.table.discount')}</th>
                <th className="text-right">{t('sales.table.amount_ttc')}</th>
                <th className="text-center">{t('sales.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {factures.length === 0 ? (
                <tr>
                  <td colSpan={filterStatus === 'cancelled' ? 8 : 7} className="text-center py-12 text-base-content/50">
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-3xl">📭</span>
                        <span>{searchQuery ? t('sales.messages.no_results') : t('sales.messages.no_invoices')}</span>
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
                      <div className="flex flex-col">
                        <span>{facture.numero_facture || <span className="italic text-base-content/50">Brouillon #{facture.id}</span>}</span>
                        {facture.type === 'RETROCESSION' && (
                            <span className="badge badge-xs badge-warning mt-1">RÉTROCESSION</span>
                        )}
                      </div>
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
                          title={t('sales.actions.view_details')}
                        >
                          👁️
                        </button>
                        {/* Bouton pour ouvrir/modifier dans Facturation (toutes sauf annulées) */}
                        {facture.status !== 'ANN' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenDevisInFacturation(facture); }}
                            className="btn btn-xs btn-ghost btn-square text-success"
                            title={t('sales.actions.edit_invoice')}
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenRefundModal(facture); }}
                          className={`btn btn-xs btn-ghost btn-square ${facture.status === 'ANN' ? 'opacity-0 cursor-default' : 'text-error'}`}
                          title={facture.status === 'ANN' ? 'Déjà annulée' : t('sales.actions.cancel_refund')}
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
                  ← {t('common.prev', { defaultValue: 'Précédent' })}
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
                  {t('common.next', { defaultValue: 'Suivant' })} →
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
              {t('sales.invoice_details')} {selectedFacture.numero_facture || t('sales.draft_label', { id: selectedFacture.id, defaultValue: `Brouillon ${selectedFacture.id}` })}
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
                      <span className="font-semibold">{t('sales.table.client')}:</span> {selectedFacture.client_name || 'N/A'}
                    </div>
                    <div>
                      <span className="font-semibold">{t('sales.table.date')}:</span> {new Date(selectedFacture.date).toLocaleString('fr-FR')}
                    </div>
                  </div>
                </div>

                {selectedFacture.produits && selectedFacture.produits.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="table table-zebra w-full table-xs">
                      <thead>
                        <tr>
                          <th>{t('sales.fields.product')}</th>
                          <th className="text-right">{t('sales.fields.unit_price')}</th>
                          <th className="text-right">{t('sales.fields.quantity')}</th>
                          <th className="text-right">{t('sales.fields.total')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedFacture.produits.map((p, index) => {
                           const produitNom = (p.produit && typeof p.produit === 'object') ? p.produit.name : (p.produit_nom ?? `Produit #${p.produit}`)
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
                            <td colSpan={3} className="text-right font-normal text-base-content/70 border-b-0 pb-1">{t('sales.fields.subtotal_ht')}:</td>
                            <td className="text-right border-b-0 pb-1">{Math.round(Number(selectedFacture.total_ht)).toLocaleString('fr-FR')} F</td>
                        </tr>
                        {Number(selectedFacture.remise) > 0 && (
                            <tr>
                                <td colSpan={3} className="text-right font-normal text-error border-b-0 py-1">{t('sales.table.discount')}:</td>
                                <td className="text-right text-error border-b-0 py-1">-{Math.round(Number(selectedFacture.remise)).toLocaleString('fr-FR')} F</td>
                            </tr>
                        )}
                        <tr>
                            <td colSpan={3} className="text-right font-normal text-base-content/70 border-b-0 py-1">{t('sales.fields.vat')}:</td>
                            <td className="text-right border-b-0 py-1">{Math.round(Number(selectedFacture.total_tva)).toLocaleString('fr-FR')} F</td>
                        </tr>
                        <tr className="text-lg">
                          <td colSpan={3} className="text-right pt-2 border-t border-base-300">{t('sales.fields.total_ttc')}:</td>
                  <td className="text-right pt-2 border-t border-base-300 text-primary">{Math.round(Number(selectedFacture.total_ttc)).toLocaleString('fr-FR')} F</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-base-content/50">
                    {t('sales.messages.no_products')}
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
                            'especes': t('sales.payment_modes.cash'),
                            'carte': t('sales.payment_modes.card'),
                            'cheque': t('sales.payment_modes.check'),
                            'virement': t('sales.payment_modes.transfer'),
                            'om': t('sales.payment_modes.orange_money'),
                            'momo': t('sales.payment_modes.mobile_money'),
                            'en_compte': t('sales.payment_modes.account')
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
                    {t('sales.actions.print_ticket')}
                  </button>
                  
                  <button 
                    className="btn btn-primary gap-2"
                    onClick={handlePrintInvoice}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    {t('sales.actions.print_invoice')}
                  </button>
               </div>
              <button className="btn" onClick={() => setSelectedFacture(null)}>{t('sales.actions.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aperçu Ticket */}
      {/* Modal Aperçu Ticket */}
      {showTicketPreview && ticketCaisse && selectedFacture && (
        <div className="modal modal-open">
          <div className="modal-box p-0 max-w-sm bg-white overflow-hidden">
             <div className="bg-base-50 p-3 flex justify-between items-center border-b border-base-200">
              <h3 className="font-bold text-lg">{t('sales.ticket_preview')}</h3>
              <button 
                className="btn btn-sm btn-circle btn-ghost"
                onClick={() => setShowTicketPreview(false)}
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto bg-gray-50 flex justify-center py-4" id="ticket-preview-container">
                 {/* Container for print content */}
                 <div id="ticket-preview">
                    <TicketTemplate ticket={ticketCaisse} settings={pharmacySettings} />
                 </div>
            </div>

            <div className="p-3 bg-base-50 border-t border-base-200 flex justify-end gap-2">
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => setShowTicketPreview(false)}
              >
                {t('sales.actions.close')}
              </button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const printContent = document.getElementById('ticket-preview')
                  if (printContent) {
                    const printWindow = window.open('', '_blank', 'height=600,width=400')
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Ticket de Caisse - ${selectedFacture.numero_facture || ''}</title>
                            <style>
                              @media print {
                                @page { margin: 0; size: 80mm auto; }
                                body { margin: 0; padding: 0; }
                              }
                              body { margin: 0; padding: 0; background: white; }
                            </style>
                          </head>
                          <body>
                            ${DOMPurify.sanitize(printContent.innerHTML)}
                          </body>
                        </html>
                      `)
                      printWindow.document.close()
                      printWindow.focus()
                      setTimeout(() => {
                        printWindow.print()
                        printWindow.close()
                      }, 250)
                    }
                  }
                }}
              >
                {t('sales.actions.print_ticket')}
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
              <h3 className="font-bold text-lg text-error">{t('sales.refund_title')}</h3>
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
                  <span className="label-text font-medium">{t('sales.refund.invoice_concerned')}</span>
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
                  <span className="label-text font-medium">{t('sales.refund.refund_amount')}</span>
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
                  <span className="label-text font-medium">{t('sales.refund.refund_mode')}</span>
                </label>
                <select 
                  value={refundMode} 
                  onChange={(e) => setRefundMode(e.target.value)}
                  className="select select-bordered w-full"
                >
                  <option value="especes">{t('sales.payment_modes.cash')}</option>
                  <option value="cheque">{t('sales.payment_modes.check')}</option>
                  <option value="carte">{t('sales.payment_modes.card')}</option>
                  <option value="virement">{t('sales.payment_modes.transfer')}</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">{t('sales.refund.refund_reason')}</span>
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
                  {t('sales.actions.cancel')}
                </button>
                <button 
                  type="submit" 
                  className="btn btn-error text-white"
                  disabled={loading}
                >
                  {loading ? <span className="loading loading-spinner"></span> : t('sales.actions.confirm_refund')}
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
