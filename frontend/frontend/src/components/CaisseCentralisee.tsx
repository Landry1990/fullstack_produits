import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import { formatCurrency } from '../utils/formatters'
import type { Facture, TicketCaisse, CouponMonnaie } from '../types'
import PasswordConfirmModal from './PasswordConfirmModal'
import { PaymentModal } from './caisse/PaymentModal'
import { FacturesTable } from './caisse/FacturesTable'
import { CouponPanel } from './caisse/CouponPanel'
import { useTranslation } from 'react-i18next'
import { getApiErrorDetail } from '../utils/errorHandling'
import PremiumModal from './common/PremiumModal'
import { TicketTemplate } from './printing/TicketTemplate'
import { RefreshCw, Ticket, Banknote, Clock, Keyboard, Monitor, Unlock, Lock, TrendingUp } from 'lucide-react'
import { OpenCashSessionModal } from './caisse/OpenCashSessionModal'
import { cashSessionService } from '../services/cashSessionService'
import { useCaisseKeyboard } from '../hooks/useCaisseKeyboard'
import { useCaissePayment } from '../hooks/useCaissePayment'
import { useCaisseCoupons } from '../hooks/useCaisseCoupons'
import { useCaisseStats } from '../hooks/useCaisseStats'
import { useInvoiceModification } from '../hooks/useInvoiceModification'
import type { PosteCaisse } from '../types'

// TicketTemplate is used for preview and print

export default function CaisseCentralisee() {
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation('caisse')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { settings: pharmacySettings } = usePharmacySettings()
  const [facturesEnAttente, setFacturesEnAttente] = useState<Facture[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [ticketCaisse, setTicketCaisse] = useState<TicketCaisse | null>(null)
  const [showTicketPreview, setShowTicketPreview] = useState(false)
  
  // États pour les coupons
  const [coupons, setCoupons] = useState<CouponMonnaie[]>([])
  const [isCouponPanelOpen, setIsCouponPanelOpen] = useState(false)
  const [isGenererCouponModalOpen, setIsGenererCouponModalOpen] = useState(false)
  const [nouveauCouponMontant, setNouveauCouponMontant] = useState('')
  const [nouveauCouponNotes, setNouveauCouponNotes] = useState('')
  const [couponTrouve, setCouponTrouve] = useState<CouponMonnaie | null>(null)
  const [isDetailsCouponModalOpen, setIsDetailsCouponModalOpen] = useState(false)
  const [isSudoModalOpen, setIsSudoModalOpen] = useState(false)
  
  
  // Coupon à appliquer PAR VENTE (clé = factureId, valeur = coupon)
  const [couponsParFacture, setCouponsParFacture] = useState<Record<number, CouponMonnaie>>({})
  // Modal pour sélectionner un coupon pour une facture spécifique
  const [factureForCoupon, setFactureForCoupon] = useState<Facture | null>(null)
  
  // État pour la navigation clavier (mouse killing)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0)
  
  // États pour le multi-caisse et sessions
  const [postesCaisses, setPostesCaisses] = useState<any[]>([])
  const [selectedPosteCaisseId, setSelectedPosteCaisseId] = useState<string>('all')
  const [isMultiCaisse, setIsMultiCaisse] = useState(false)
  const [myActivePoste, setMyActivePoste] = useState<PosteCaisse | null>(null)
  const [showOpenSessionModal, setShowOpenSessionModal] = useState(false)
  const [closingReport, setClosingReport] = useState<any>(null)
  const [showClosingReport, setShowClosingReport] = useState(false)
  const [hideAmounts, setHideAmounts] = useState(false) // Mode sécurité: masquer les montants aux caissiers
  const [sessionRecap, setSessionRecap] = useState<{
    has_session: boolean
    poste_nom?: string
    date_ouverture?: string
    fond_de_caisse?: number
    total_encaisse?: number
    total_avec_fond?: number
    nb_transactions?: number
    details_par_mode?: Record<string, number>
  } | null>(null)

  // Fonction pour récupérer les factures en attente
  const fetchFacturesEnAttente = useCallback(async () => {
    try {
      const params: Record<string, any> = { 
        status__in: 'BROU,VAL,PROF', 
        include_pending: true,
        include_details: true 
      }
      if (selectedPosteCaisseId !== 'all') params.poste_caisse = selectedPosteCaisseId

      const response = await api.get('factures/', { params })
      const facturesList = response.data.results || response.data || []
      
      setFacturesEnAttente(facturesList)
    } catch (err) {
      console.error('Erreur lors du chargement des factures en attente:', err)
    }
  }, [selectedPosteCaisseId])


  // Hook pour la logique des coupons
  const {
    loading: couponLoading,
    searchCouponNumero,
    setSearchCouponNumero,
    fetchCoupons,
    handleGenererCoupon,
    handleRechercherCoupon: handleRechercherCouponBase,
    handleAppliquerCouponAFacture: handleAppliquerCouponBase,
    handleRetirerCouponDeFacture,
    utiliserCouponApresEncaissement
  } = useCaisseCoupons({
    coupons,
    setCoupons,
    couponsParFacture,
    setCouponsParFacture,
    setIsGenererCouponModalOpen,
    setIsDetailsCouponModalOpen,
    setCouponTrouve,
    selectedFacture,
    onSuccess: () => {
      setNouveauCouponMontant('')
      setNouveauCouponNotes('')
    }
  })

  // Wrappers pour adapter les signatures avec traduction
  const handleAppliquerCouponAFacture = useCallback((coupon: CouponMonnaie, facture: Facture) => {
    handleAppliquerCouponBase(coupon, facture, t)
    setFactureForCoupon(null)
    setIsDetailsCouponModalOpen(false)
    setCouponTrouve(null)
  }, [handleAppliquerCouponBase, t])

  const handleRechercherCoupon = useCallback(() => {
    handleRechercherCouponBase(searchCouponNumero, t)
  }, [handleRechercherCouponBase, searchCouponNumero, t])

  const handleRetirerCouponWrapper = useCallback((factureId: number) => {
    handleRetirerCouponDeFacture(factureId, t)
  }, [handleRetirerCouponDeFacture, t])

  const fetchSessionRecap = useCallback(async () => {
    try {
      const res = await api.get('postes-caisses/recap_session/')
      setSessionRecap(res.data)
    } catch {
      // silencieux si pas de session
    }
  }, [])

  // Rafraîchissement automatique - toutes les 5 secondes pour plus de réactivité
  useEffect(() => {
    fetchFacturesEnAttente()
    fetchCoupons()
    const interval = setInterval(() => {
      fetchFacturesEnAttente()
      fetchCoupons()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchFacturesEnAttente, fetchCoupons, selectedPosteCaisseId])

  // Récap session : toutes les 15 secondes
  useEffect(() => {
    fetchSessionRecap()
    const interval = setInterval(fetchSessionRecap, 15000)
    return () => clearInterval(interval)
  }, [fetchSessionRecap])

  // Wrapper pour la génération de coupon
  const handleGenererCouponWrapper = useCallback(async () => {
    await handleGenererCoupon(nouveauCouponMontant, nouveauCouponNotes, selectedFacture?.id || null, t)
  }, [handleGenererCoupon, nouveauCouponMontant, nouveauCouponNotes, selectedFacture, t])

  // Charger les postes de caisse et réglages
  useEffect(() => {
    const initPage = async () => {
      try {
        const [settingsRes, postesRes, myActive] = await Promise.all([
          api.get('parametres/').catch(() => ({ data: {} })),
          api.get('postes-caisses/').catch(() => ({ data: { results: [] } })),
          cashSessionService.getMyActiveSessions().catch(() => [])
        ])
        
        // Charger le paramètre de sécurité caisse
        const settings = settingsRes.data
        if (settings.hide_cash_totals) {
          setHideAmounts(true)
        }
        
        const postesList = postesRes.data.results || postesRes.data || []
        setPostesCaisses(postesList)
        setMyActivePoste(myActive.length > 0 ? myActive[0] : null)
        
        // Détecter si on est en mode multi-caisse
        const hasMultipleActive = postesList.filter((p: PosteCaisse) => p.est_ouvert).length > 1
        setIsMultiCaisse(hasMultipleActive)
      } catch (err) {
        console.error('Erreur initialisation page:', err)
      }
    }
    initPage()
  }, [])

  // Ouvrir le panneau pour sélectionner un coupon pour une facture
  const openCouponSelectionForFacture = (facture: Facture) => {
    setFactureForCoupon(facture)
    setIsCouponPanelOpen(true)
  }

  // Trier les factures par date chronologique (plus ancienne en premier)
  const sortedFactures = useMemo(() => 
    facturesEnAttente.toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [facturesEnAttente]
  )

  // Ouvrir la modale de paiement (useCallback pour les raccourcis clavier)
  const handleCloseSession = async () => {
    if (!myActivePoste) return

    // Vérifier si des ventes en attente sont présentes
    if (facturesEnAttente.length > 0) {
      toast.error(
        t('cash_session.pending_sales_error', {
          defaultValue: `Impossible de fermer : ${facturesEnAttente.length} vente(s) en attente de règlement. Veuillez régler ou annuler les ventes avant de clôturer.`,
          count: facturesEnAttente.length
        }),
        { duration: 5000 }
      )
      return
    }

    if (!window.confirm(t('cash_session.confirm_close', { defaultValue: 'Fermer votre caisse ?' }))) return
    try {
      const { data } = await cashSessionService.closePoste(myActivePoste.id, hideAmounts)
      setClosingReport(data)
      setShowClosingReport(true)
      setMyActivePoste(null)
      setSessionRecap(null)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('cash_session.close_error', { defaultValue: 'Erreur fermeture' }))
    }
  }

  const handleEncaisser = useCallback((facture: Facture) => {
    setSelectedFacture(facture)
    setIsPaymentModalOpen(true)
  }, [])

  // Utiliser le hook personnalisé pour les raccourcis clavier
  useCaisseKeyboard(
    {
      onEncaisser: handleEncaisser,
      onOpenCouponPanel: openCouponSelectionForFacture,
      onRefresh: () => {
        fetchFacturesEnAttente()
        fetchCoupons()
        toast.success(t('messages.refreshed'))
      },
      onToggleCouponPanel: () => {
        setIsCouponPanelOpen(false)
        setFactureForCoupon(null)
      },
      onCloseModal: () => {
        setIsPaymentModalOpen(false)
        setIsGenererCouponModalOpen(false)
        setIsDetailsCouponModalOpen(false)
        setShowTicketPreview(false)
      },
      canCashOut: (user as any)?.can_cash_out || user?.is_superuser || false
    },
    {
      sortedFactures,
      selectedRowIndex,
      isPaymentModalOpen,
      isGenererCouponModalOpen,
      isDetailsCouponModalOpen,
      isSudoModalOpen,
      showTicketPreview,
      isCouponPanelOpen
    },
    setSelectedRowIndex
  )

  // Garder l'index valide quand la liste change
  useEffect(() => {
    if (selectedRowIndex >= facturesEnAttente.length && facturesEnAttente.length > 0) {
      setSelectedRowIndex(facturesEnAttente.length - 1)
    }
  }, [facturesEnAttente.length, selectedRowIndex])

  // Hook pour la logique de paiement
  const { loading: paymentLoading, enregistrerPaiement: enregistrerPaiementHook } = useCaissePayment({
    selectedFacture,
    couponsParFacture,
    setCouponsParFacture,
    setTicketCaisse,
    setIsPaymentModalOpen,
    setShowTicketPreview,
    fetchFacturesEnAttente,
    fetchSessionRecap,
    fetchCoupons,
    utiliserCouponApresEncaissement,
    onSuccess: () => toast.success(t('messages.modification_success'))
  })

  // Wrapper pour adapter la signature au PaymentModal
  const enregistrerPaiement = useCallback((paiements: { mode: string; montant: number }[]) => {
    enregistrerPaiementHook(paiements, t, user)
  }, [enregistrerPaiementHook, t, user])
  // Envoi WhatsApp
  const handleSendWhatsApp = async () => {
    if (!ticketCaisse || !ticketCaisse.facture || typeof ticketCaisse.facture === 'number') return
    
    const facture = ticketCaisse.facture as any
    // Déterminer le numéro (priorité au numéro du client si présent)
    const clientPhone = (typeof facture.client === 'object' ? facture.client?.phone : '') || facture.client_phone
    const phone = window.prompt(t('messages.enter_whatsapp_number') || t('messages.enter_whatsapp_number_desc'), clientPhone || '')
    
    if (!phone) return

    setLoading(true)
    try {
      const response = await api.post(`factures/${facture.id}/send_whatsapp/`, {
        phone: phone
      })
      toast.success(response.data.detail || 'Ticket envoyé par WhatsApp !')
    } catch (err) {
      console.error('Erreur envoi WhatsApp:', err)
      toast.error(getApiErrorDetail(err, t('messages.whatsapp_send_error')))
    } finally {
      setLoading(false)
    }
  }



  // Annuler une facture
  const handleAnnuler = async (facture: Facture) => {
    if (!window.confirm(t('confirm_cancel_invoice', { numero: facture.numero_facture }))) return

    try {
      await api.post(`factures/${facture.id}/annuler/`, { motif: 'Annulation depuis Caisse Centrale' })
      toast.success(t('messages.cancel_invoice_success'))
      fetchFacturesEnAttente()
    } catch (err) {
      console.error('Erreur annulation:', err)
      toast.error(t('messages.cancel_invoice_error'))
    }
  }

  // Hooks pour les modifications
  const {
    handleFullModification,
    handleUpdateQuantity,
    handleRemoveProduct: handleRemoveProductBase
  } = useInvoiceModification({
    setLoading,
    fetchFacturesEnAttente,
    t
  })

  // Wrappers pour les modifications partielles
  const handleModifier = useCallback((facture: Facture) => {
    handleFullModification(facture)
  }, [handleFullModification])

  const handleUpdateProductQuantity = useCallback((factureId: number, produitId: number, newQty: number) => {
    handleUpdateQuantity(factureId, produitId, newQty, facturesEnAttente)
  }, [handleUpdateQuantity, facturesEnAttente])

  const handleRemoveProduct = useCallback((factureId: number, produitId: number) => {
    handleRemoveProductBase(factureId, produitId, facturesEnAttente, handleAnnuler)
  }, [handleRemoveProductBase, facturesEnAttente, handleAnnuler])

  // Hook pour les statistiques
  const {
    totalMontantEnAttente,
    activeCouponsCount,
    appliedCouponsCount
  } = useCaisseStats({
    facturesEnAttente,
    coupons,
    couponsParFacture
  })

  return (
    <div className="h-full bg-slate-50 flex flex-col overflow-hidden font-sans">
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">

      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
        <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('title')}</h1>
            <p className="text-slate-500 text-sm mt-1">{t('subtitle')}</p>
          </div>

          {isMultiCaisse && (
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 px-3 text-slate-500">
                <Monitor className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{t('poste_label')}</span>
              </div>
              <select
                className="h-8 px-2 rounded-md bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-300"
                value={selectedPosteCaisseId}
                onChange={(e) => setSelectedPosteCaisseId(e.target.value)}
              >
                <option value="all">{t('all_posts')}</option>
                {postesCaisses.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {/* Toggle Mode Sécurité (masquer les montants) */}
            {myActivePoste && (
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors" title={t('cash_session.security_mode', { defaultValue: 'Mode sécurité: masquer les montants aux caissiers' })}>
                <input
                  type="checkbox"
                  checked={hideAmounts}
                  onChange={(e) => setHideAmounts(e.target.checked)}
                  className="size-4 accent-amber-500"
                />
                <span className="text-xs hidden sm:inline text-slate-600 font-medium">🔒 {t('cash_session.hide_amounts', { defaultValue: 'Masquer montants' })}</span>
              </label>
            )}

            {/* Session de caisse - Bouton principal pour la caissière */}
            {myActivePoste ? (
              <button
                onClick={handleCloseSession}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-amber-500 text-white shadow-sm hover:bg-amber-600 transition-colors"
                title={t('cash_session.close_title', { defaultValue: 'Fermer ma caisse' })}
              >
                <Lock className="size-4" />
                <span className="hidden sm:inline">🔴 {myActivePoste.nom} - {t('cash_session.close_short', { defaultValue: 'Fermer' })}</span>
                {myActivePoste.fond_de_caisse && (
                  <span className="text-[10px] opacity-80">({Number(myActivePoste.fond_de_caisse).toLocaleString()} F)</span>
                )}
              </button>
            ) : (
              <button
                onClick={() => setShowOpenSessionModal(true)}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors"
                title={t('cash_session.open_title', { defaultValue: 'Ouvrir ma caisse' })}
              >
                <Unlock className="size-4" />
                <span className="hidden sm:inline">{t('cash_session.open_short', { defaultValue: 'Ouvrir caisse' })}</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full font-medium">
              <RefreshCw className="size-3.5 animate-spin" />
              {t('auto_refresh')}
            </div>
            <button
              onClick={() => setIsCouponPanelOpen(!isCouponPanelOpen)}
              className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-semibold transition-all ${isCouponPanelOpen ? 'bg-emerald-600 text-white shadow-sm' : 'border-2 border-slate-200 bg-white text-emerald-600 hover:border-emerald-500'}`}
            >
              <Ticket className="size-4" />
              {t('coupons_active', { count: activeCouponsCount })}
            </button>
            {appliedCouponsCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full font-medium">
                <span>{t('coupons_applied', { count: appliedCouponsCount })}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pending Invoices */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock className="size-3" /> {t('stats_pending_title', { defaultValue: 'En Attente' })}
            </div>
            <div className="text-2xl font-bold text-slate-800">{facturesEnAttente.length}</div>
            <div className="text-xs text-slate-500">{t('stats_pending_desc', { defaultValue: 'facture(s) à encaisser' })}</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-red-500">
            <Clock className="size-6" />
          </div>
        </div>

        {/* Total Amount */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Banknote className="size-3" /> {t('stats_total_title', { defaultValue: 'Montant Total' })}
            </div>
            <div className="text-2xl font-bold text-slate-800">{formatCurrency(Math.round(totalMontantEnAttente))}</div>
            <div className="text-xs text-slate-500">{t('stats_total_desc', { defaultValue: 'à encaisser' })}</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <Banknote className="size-6" />
          </div>
        </div>

        {/* Active Coupons */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Ticket className="size-3" /> {t('stats_coupons_title', { defaultValue: 'Coupons Actifs' })}
            </div>
            <div className="text-2xl font-bold text-slate-800">{activeCouponsCount}</div>
            <div className="text-xs text-slate-500">{appliedCouponsCount > 0 ? t('coupons_applied', { count: appliedCouponsCount }) : t('stats_coupons_desc', { defaultValue: 'coupon(s) disponible(s)' })}</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <Ticket className="size-6" />
          </div>
        </div>
      </div>

      {/* Main Content: Sidebar + Table */}
      <div className="flex gap-6 min-h-0" style={{ height: 'calc(100vh - 340px)' }}>
        {/* Panneau des Coupons (Sidebar Gauche) */}
        {isCouponPanelOpen && (
          <CouponPanel
            coupons={coupons}
            onGenerateCoupon={() => setIsGenererCouponModalOpen(true)}
            searchNumero={searchCouponNumero}
            onSearchChange={setSearchCouponNumero}
            onSearch={handleRechercherCoupon}
            onSelectCoupon={(c) => {
              setCouponTrouve(c)
              setIsDetailsCouponModalOpen(true)
            }}
            user={user}
          />
        )}

        {/* Table Card */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <FacturesTable
              sortedFactures={sortedFactures}
              loading={loading}
              selectedRowIndex={selectedRowIndex}
              onSelectRow={setSelectedRowIndex}
              onEncaisser={handleEncaisser}
              onRemoveCoupon={handleRetirerCouponWrapper}
              onModify={handleModifier}
              onCancel={handleAnnuler}
              onApplyCoupon={openCouponSelectionForFacture}
              onUpdateProductQuantity={handleUpdateProductQuantity}
              onRemoveProduct={handleRemoveProduct}
              couponsParFacture={couponsParFacture}
              user={user}
              myActivePoste={myActivePoste}
            />
          </div>
          {/* Keyboard Shortcuts Footer */}
          <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400 bg-white">
            <div className="flex items-center gap-1">
              <Keyboard className="size-3.5" />
              <span className="hidden sm:inline">{t('shortcuts.title')}</span>
            </div>
            <div className="flex gap-3">
              <span><kbd className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono">↑↓</kbd> {t('shortcuts.navigate')}</span>
              <span><kbd className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono">{t('shortcuts.enter_key', 'Entrée')}</kbd> {t('shortcuts.cash_in')}</span>
              <span><kbd className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono">C</kbd> {t('shortcuts.coupon')}</span>
              <span><kbd className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono">R</kbd> {t('shortcuts.refresh')}</span>
              <span><kbd className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono">1-9</kbd> {t('shortcuts.quick_select')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Récap Session Live — visible selon paramètre hide_cash_totals */}
      {sessionRecap?.has_session && (user?.is_superuser || !pharmacySettings?.hide_cash_totals) && (
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 overflow-hidden">
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-emerald-600" />
              <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">
                {t('recap.title', { defaultValue: 'Récap caisse' })} — {sessionRecap.poste_nom}
              </span>
              {sessionRecap.date_ouverture && (
                <span className="text-[10px] text-slate-400 font-mono">
                  {t('recap.since', { defaultValue: 'depuis' })} {new Date(sessionRecap.date_ouverture).toLocaleTimeString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-500">
                <RefreshCw className="size-3 animate-spin" />
                live
              </div>
            </div>
          </div>
          <div className="p-4 flex flex-wrap gap-3 items-center">
            {(sessionRecap.fond_de_caisse ?? 0) > 0 && (
              <div className="flex flex-col items-center px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl min-w-[100px]">
                <span className="text-[10px] font-bold text-blue-500/70 uppercase tracking-wider">{t('recap.fond', { defaultValue: 'Fond' })}</span>
                <span className="text-base font-black text-blue-600">+{formatCurrency(Math.round(sessionRecap.fond_de_caisse ?? 0))}</span>
              </div>
            )}
            {Object.entries(sessionRecap.details_par_mode ?? {})
              .filter(([, v]) => v > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([mode, montant]) => {
                const labels: Record<string, string> = {
                  especes: `💵 ${t('journal.modes.especes')}`,
                  cheque: `📋 ${t('journal.modes.cheque')}`,
                  carte: `💳 ${t('journal.modes.carte')}`,
                  virement: `🏦 ${t('journal.modes.virement')}`,
                  om: `📱 ${t('journal.modes.om')}`,
                  momo: `📱 ${t('journal.modes.momo')}`,
                  recouvrement: `🔄 ${t('journal.modes.recouvrement')}`,
                  coupon: `🎫 ${t('recap.coupons', { defaultValue: 'Coupons' })}`
                }
                const isNegative = mode === 'coupon'
                return (
                  <div key={mode} className={`flex flex-col items-center px-4 py-2 rounded-xl min-w-[100px] border ${isNegative ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isNegative ? 'text-red-400' : 'text-emerald-500'}`}>
                      {labels[mode] ?? mode}
                    </span>
                    <span className={`text-base font-black ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isNegative ? '-' : ''}{formatCurrency(Math.round(montant))}
                    </span>
                  </div>
                )
              })
            }
            <div className="ml-auto flex flex-col items-end gap-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {sessionRecap.nb_transactions} {t('recap.sales', { defaultValue: 'vente(s)', count: sessionRecap.nb_transactions ?? 0 })}
              </div>
              <div className="text-2xl font-black text-emerald-600">
                {formatCurrency(Math.round(sessionRecap.total_avec_fond ?? 0))}
              </div>
              <div className="text-[10px] text-slate-400">{t('recap.total_register', { defaultValue: 'total caisse' })}</div>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Modal de paiement */}
      {isPaymentModalOpen && selectedFacture && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          facture={selectedFacture}
          coupon={couponsParFacture[selectedFacture.id]}
          onConfirm={enregistrerPaiement}
          loading={paymentLoading}
        />
      )}

      <PremiumModal
        isOpen={showTicketPreview && !!ticketCaisse}
        onClose={() => setShowTicketPreview(false)}
        title={t('ticket.title')}
        icon={<span className="text-emerald-600 text-xl">📄</span>}
        maxWidth="max-w-sm"
        footer={
            <div className="flex justify-end gap-2 w-full">
              <button className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors" onClick={() => setShowTicketPreview(false)}>{t('coupons.details_modal.close') || 'Fermer'} (Esc)</button>
              {pharmacySettings?.whatsapp_enabled && (
                <button
                  className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 transition-colors"
                  onClick={handleSendWhatsApp}
                  disabled={loading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 448 512">
                    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 54 81.2 54 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.4-8.6-44.4-27.4-16.4-14.6-27.4-32.7-30.6-38.2-3.2-5.6-.3-8.6 2.5-11.3 2.5-2.4 5.5-6.5 8.3-9.7 2.8-3.3 3.7-5.6 5.5-9.3 1.9-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 13.2 5.8 23.5 9.2 31.5 11.8 13.3 4.2 25.4 3.6 35 2.2 10.7-1.5 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                  </svg>
                  WhatsApp
                </button>
              )}
              <button
                className="inline-flex items-center justify-center h-8 px-6 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors"
                onClick={() => {
                  const ticketElement = document.getElementById('ticket-preview');
                  if (!ticketElement) return;
                  
                  const ticketWidth = pharmacySettings.ticket_paper_width || 80;
                  const content = ticketElement.outerHTML;
                  const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                    .map(node => node.outerHTML)
                    .join('\n');
                  
                  const win = window.open('', '', 'height=800,width=600');
                  if (win && content) {
                    win.document.write(`<!DOCTYPE html>
<html data-theme="light" lang="fr">
<head>
  <title>Ticket de Caisse</title>
  <base href="${window.location.origin}/">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  ${styleTags}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @media print {
      @page { 
        size: ${ticketWidth}mm auto; 
        margin: 0; 
      }
      html, body { 
        width: ${ticketWidth}mm !important;
        margin: 0 !important; 
        padding: 0 !important; 
        background: white !important;
        color: black !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    html, body {
      width: ${ticketWidth}mm;
      max-width: ${ticketWidth}mm;
      margin: 0 auto;
      padding: 0;
      background: white !important;
      color: black !important;
      font-family: 'Inter', 'Poppins', sans-serif;
      overflow: hidden;
    }
    #print-root {
      width: ${ticketWidth}mm;
      max-width: ${ticketWidth}mm;
      overflow: hidden;
    }
    #ticket-preview {
      width: ${ticketWidth}mm !important;
      max-width: ${ticketWidth}mm !important;
      min-width: 0 !important;
      margin: 0 !important;
      padding: 2mm !important;
      background: white !important;
      color: black !important;
      box-shadow: none !important;
      outline: none !important;
      overflow: hidden;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    #ticket-preview * {
      color: black !important;
    }
    #ticket-preview table { table-layout: fixed; width: 100% !important; }
    #ticket-preview td, #ticket-preview th { overflow: hidden; text-overflow: ellipsis; }
    :root, [data-theme="light"] {
      --b1: 100% 0 0;
      --bc: 0% 0 0;
      --p: 49.12% 0.3096 275.75;
      --pc: 89.824% 0.06192 275.75;
    }
  </style>
</head>
<body>
  <div id="print-root">
    ${content}
  </div>
  <script>
    window.onload = () => {
        const doPrint = () => {
            window.print();
            window.close();
        };
        if (document.fonts) {
            document.fonts.ready.then(() => {
                setTimeout(doPrint, 500);
            });
        } else {
            setTimeout(doPrint, 1500);
        }
    };
  </script>
</body>
</html>`);
                    win.document.close();
                    win.focus();
                  }
                }}
              >
                {t('common:print')}
              </button>
            </div>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto bg-slate-100 flex justify-center py-4">
          {ticketCaisse && (
            <div id="ticket-preview" className="shadow-lg bg-white">
              <TicketTemplate ticket={ticketCaisse} settings={pharmacySettings} />
            </div>
          )}
        </div>
      </PremiumModal>

      {/* Modals pour les Coupons */}
      <PremiumModal
        isOpen={isGenererCouponModalOpen}
        onClose={() => setIsGenererCouponModalOpen(false)}
        title={t('coupons.generate_modal.title')}
        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
        footer={
            <div className="flex justify-end gap-2 w-full">
              <button className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors" onClick={() => setIsGenererCouponModalOpen(false)}>{t('table.cancel')}</button>
              <button
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors"
                onClick={() => setIsSudoModalOpen(true)}
                disabled={loading || !nouveauCouponMontant}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Valider (Mode Sudo)
              </button>
            </div>
        }
      >
        <div className="p-6">
            <div className="w-full mb-4">
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">Montant à rendre (F)</label>
              <input
                type="number"
                className="w-full h-12 rounded-lg border border-slate-200 bg-white px-3 text-2xl font-bold text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="Ex: 250"
                value={nouveauCouponMontant}
                onChange={(e) => setNouveauCouponMontant(e.target.value)}
                autoFocus
              />
            </div>

            <div className="w-full mb-4">
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">Notes (Optionnel)</label>
              <textarea
                className="w-full h-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                placeholder="Raison du coupon..."
                value={nouveauCouponNotes}
                onChange={(e) => setNouveauCouponNotes(e.target.value)}
              ></textarea>
            </div>
        </div>
      </PremiumModal>

      {/* Modal Confirmation Sudo pour Coupon */}
      <PasswordConfirmModal
        isOpen={isSudoModalOpen}
        onClose={() => setIsSudoModalOpen(false)}
        onConfirm={handleGenererCouponWrapper}
        title="Validation par mot de passe"
        message={`Confirmez la génération du coupon de ${nouveauCouponMontant} F.`}
      />

      {/* Modal Détails Coupon */}
      <PremiumModal
        isOpen={isDetailsCouponModalOpen && !!couponTrouve}
        onClose={() => { setIsDetailsCouponModalOpen(false); setCouponTrouve(null); setSearchCouponNumero(''); }}
        title="Détails du Coupon"
        icon={<span className="text-emerald-600 text-xl">🎫</span>}
        footer={
            <div className="flex justify-between gap-2 w-full">
              <button
                className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold border-2 border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
                onClick={() => {
                  if (!couponTrouve) return;
                  const win = window.open('', '', 'height=600,width=400');
                  if (win) {
                    const dateStr = new Date(couponTrouve.date_creation).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    });
                    
                    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Coupon de Monnaie</title>
  <style>
    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 10mm 5mm;
      }
    }
    body {
      font-family: 'Courier New', monospace;
      width: 80mm;
      margin: 0 auto;
      padding: 10mm 5mm;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .pharmacy-name {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .pharmacy-info {
      font-size: 10px;
      line-height: 1.3;
    }
    .coupon-box {
      border: 2px dashed #000;
      padding: 15px;
      margin: 15px 0;
      text-align: center;
    }
    .coupon-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
      font-weight: bold;
    }
    .coupon-number {
      font-size: 24px;
      font-weight: bold;
      margin: 8px 0;
      font-family: 'Courier New', monospace;
    }
    .coupon-amount {
      font-size: 32px;
      font-weight: bold;
      margin: 10px 0;
      color: #000;
    }
    .info-section {
      margin-top: 15px;
      font-size: 10px;
      text-align: left;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .info-label {
      font-weight: bold;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border: 1px solid #000;
      font-size: 9px;
      margin-left: 5px;
    }
    .notes {
      margin-top: 12px;
      padding: 8px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      font-size: 9px;
      font-style: italic;
      text-align: left;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #000;
      font-size: 9px;
    }
    .warning {
      font-size: 9px;
      color: #666;
      margin-top: 10px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="pharmacy-name">${pharmacySettings.pharmacy_name || 'PHARMACIE'}</div>
    <div class="pharmacy-info">
      ${pharmacySettings.city ? `${pharmacySettings.city}` : ''}${pharmacySettings.country ? `, ${pharmacySettings.country}` : ''}<br>
      ${pharmacySettings.phone ? `Tel: ${pharmacySettings.phone}` : ''}<br>
      ${pharmacySettings.niu ? `NIU: ${pharmacySettings.niu}` : ''}<br>
      ${pharmacySettings.registre_commerce ? `RC: ${pharmacySettings.registre_commerce}` : ''}
    </div>
  </div>
  
  <div class="coupon-box">
    <div class="coupon-label">Coupon de Monnaie</div>
    <div class="coupon-number">#${couponTrouve.numero}</div>
    <div class="coupon-amount">${formatCurrency(Math.round(Number(couponTrouve.montant)))}</div>
  </div>
  
  <div class="info-section">
    <div class="info-row">
      <span class="info-label">Statut:</span>
      <span>${couponTrouve.status_display || couponTrouve.status}<span class="status-badge">${couponTrouve.status}</span></span>
    </div>
    <div class="info-row">
      <span class="info-label">Généré par:</span>
      <span>${couponTrouve.cree_par_nom || 'Système'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Date:</span>
      <span>${dateStr}</span>
    </div>
    ${couponTrouve.facture_origine ? `
    <div class="info-row">
      <span class="info-label">Facture origine:</span>
      <span>#${couponTrouve.facture_origine}</span>
    </div>
    ` : ''}
  </div>
  
  ${couponTrouve.notes ? `
  <div class="notes">
    <strong>Notes:</strong><br>
    ${couponTrouve.notes}
  </div>
  ` : ''}
  
  <div class="warning">
    Ce coupon est valable uniquement dans cette pharmacie
  </div>
  
  <div class="footer">
    ${pharmacySettings.ticket_footer_message || 'Merci de votre visite !'}
  </div>
</body>
</html>`);
                    win.document.close();
                    // Attendre que le contenu soit chargé avant d'imprimer
                    win.onload = () => {
                      setTimeout(() => {
                        win.print();
                      }, 250);
                    };
                  }
                }}
              > {t('coupons.details_modal.print')} </button>
              <div className="flex gap-2">
                <button className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors" onClick={() => { setIsDetailsCouponModalOpen(false); setCouponTrouve(null); setSearchCouponNumero(''); }}>{t('coupons.details_modal.close') || 'Fermer'}</button>
                {couponTrouve && couponTrouve.status === 'ACTIF' && factureForCoupon && (
                  <button className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors" onClick={() => handleAppliquerCouponAFacture(couponTrouve, factureForCoupon)}>
                    {t('table.apply_coupon')} #{factureForCoupon.session_ticket_number}
                  </button>
                )}
                {couponTrouve && couponTrouve.status === 'ACTIF' && !factureForCoupon && (
                  <div className="text-xs text-amber-600">Sélectionnez d'abord une vente pour appliquer le coupon</div>
                )}
              </div>
            </div>
        }
      >
        <div className="p-6">
            {couponTrouve && (
            <div className="text-center p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Coupon de Monnaie</div>
              <div className="text-4xl font-black text-emerald-600 font-mono mb-2">#{couponTrouve.numero}</div>
              <div className="text-3xl font-bold text-slate-800 mb-4">{Math.round(Number(couponTrouve.montant))} F</div>
              <div className="border-t border-slate-200 my-2"></div>
              <div className="text-left space-y-2 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`inline-flex items-center px-2 h-5 text-[10px] rounded font-semibold ${
                    couponTrouve.status === 'ACTIF' ? 'bg-emerald-100 text-emerald-700' :
                    couponTrouve.status === 'UTILISE' ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-500'
                  }`}>
                    {couponTrouve.status_display || couponTrouve.status}
                  </span>
                </div>

                <div className="border-t border-slate-200 my-1"></div>

                <div className="bg-white p-2 rounded border border-slate-200 space-y-1">
                  <div className="font-bold text-[10px] uppercase text-slate-500 mb-1">Création</div>
                  <div className="flex justify-between">
                    <span>Généré par:</span>
                    <span className="font-medium">{couponTrouve.cree_par_nom || 'Système'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span className="font-medium">{new Date(couponTrouve.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>

                {couponTrouve.status === 'UTILISE' && (
                  <div className="bg-emerald-50 p-2 rounded border border-emerald-100 space-y-1">
                    <div className="font-bold text-[10px] uppercase text-emerald-600 text-slate-500 mb-1">Utilisation</div>
                    <div className="flex justify-between">
                      <span>Utilisé par:</span>
                      <span className="font-medium">{couponTrouve.utilise_par_nom || 'N/A'}</span>
                    </div>
                    {couponTrouve.date_utilisation && (
                      <div className="flex justify-between">
                        <span>Date:</span>
                        <span>{new Date(couponTrouve.date_utilisation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                )}

                {couponTrouve.notes && (
                  <div className="mt-2 p-2 bg-white rounded italic border border-slate-200 text-slate-600">
                    <span className="font-bold not-italic text-slate-500 block text-[10px] mb-1">Notes:</span>
                    "{couponTrouve.notes}"
                  </div>
                )}
              </div>
            </div>
            )}
        </div>
      </PremiumModal>

      {/* Modal Ouvrir Caisse */}
      <OpenCashSessionModal
        isOpen={showOpenSessionModal}
        onClose={() => setShowOpenSessionModal(false)}
        onSessionOpened={async () => {
          const myActive = await cashSessionService.getMyActiveSessions().catch(() => [])
          setMyActivePoste(myActive.length > 0 ? myActive[0] : null)
        }}
      />

      {/* Modal Rapport de Clôture */}
      <PremiumModal
        isOpen={showClosingReport}
        onClose={() => setShowClosingReport(false)}
        title={t('cash_session.closing_report', { defaultValue: 'Rapport de Clôture' })}
        icon={<Ticket className="text-emerald-600 size-5" />}
        footer={
          <div className="flex justify-end w-full">
            <button
              className="inline-flex items-center justify-center h-8 px-4 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors"
              onClick={() => setShowClosingReport(false)}
            >
              {t('common:actions.close', { defaultValue: 'Fermer' })}
            </button>
          </div>
        }
      >
        {closingReport && (
          <div className="p-5 space-y-4">
            {/* En-tête */}
            <div className="text-center border-b border-slate-200 pb-4">
              <h3 className="font-bold text-lg text-slate-800">{closingReport.poste?.nom}</h3>
              <p className="text-sm text-slate-500">
                {new Date(closingReport.session?.date_fermeture).toLocaleString('fr-FR')}
              </p>
            </div>

            {/* Stats - masquées si sécurité activée */}
            {!closingReport.hide_amounts ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <p className="text-[10px] uppercase text-slate-500">{t('cash_session.fond_initial', { defaultValue: 'Fond Initial' })}</p>
                    <p className="font-mono font-bold text-lg text-slate-800">
                      {closingReport.session?.fond_de_caisse?.toLocaleString('fr-FR')} F
                    </p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                    <p className="text-[10px] uppercase text-emerald-600">{t('cash_session.encaisse', { defaultValue: 'Encaissé' })}</p>
                    <p className="font-mono font-bold text-lg text-emerald-600">
                      {closingReport.session?.montant_encaisse?.toLocaleString('fr-FR')} F
                    </p>
                  </div>
                </div>

                {/* Total théorique */}
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                  <p className="text-[10px] uppercase text-emerald-600 font-semibold mb-1">
                    {t('cash_session.total_theorique', { defaultValue: 'Total Théorique en Caisse' })}
                  </p>
                  <p className="font-mono font-bold text-2xl text-emerald-600">
                    {closingReport.session?.montant_theorique?.toLocaleString('fr-FR')} F
                  </p>
                </div>
              </>
            ) : (
              /* Mode sécurité - montants masqués */
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-center">
                <p className="text-amber-600 text-sm font-medium mb-2">🔒 Mode Sécurité</p>
                <p className="text-slate-500 text-xs">
                  Les montants sont masqués pour des raisons de sécurité.
                  Consultez le pharmacien pour les détails financiers.
                </p>
                <div className="mt-3 space-y-2">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-2xl font-mono text-slate-800">*** *** F</span>
                  </div>
                </div>
              </div>
            )}

            {/* Transactions */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">{t('cash_session.transactions', { defaultValue: 'Transactions' })}</span>
              <span className="font-bold text-slate-800">{closingReport.transactions?.total || 0}</span>
            </div>

            {/* Message de confirmation */}
            <div className="text-center pt-2">
              <p className="text-sm text-emerald-600 font-medium">✓ {closingReport.detail}</p>
            </div>
          </div>
        )}
      </PremiumModal>
    </div>
  )
}


