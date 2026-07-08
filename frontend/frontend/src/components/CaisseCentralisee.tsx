import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import type { Facture, TicketCaisse, CouponMonnaie } from '../types'
import PasswordConfirmModal from './PasswordConfirmModal'
import { PaymentModal } from './caisse/PaymentModal'
import { FacturesTable } from './caisse/FacturesTable'
import { CouponPanel } from './caisse/CouponPanel'
import { useTranslation } from 'react-i18next'
import { getApiErrorDetail } from '../utils/errorHandling'
import { Keyboard } from 'lucide-react'
import { OpenCashSessionModal } from './caisse/OpenCashSessionModal'
import { cashSessionService } from '../services/cashSessionService'
import { useCaisseKeyboard } from '../hooks/useCaisseKeyboard'
import { useCaissePayment } from '../hooks/useCaissePayment'
import { useCaisseCoupons } from '../hooks/useCaisseCoupons'
import { useCaisseStats } from '../hooks/useCaisseStats'
import { useInvoiceModification } from '../hooks/useInvoiceModification'
import { useSudo } from '../hooks/useSudo'
import type { PosteCaisse } from '../types'
import SudoValidationModal from './common/SudoValidationModal'
import { CaisseTicketPreviewModal } from './caisse/CaisseTicketPreviewModal'
import { CouponGenerateModal } from './caisse/CouponGenerateModal'
import { CouponDetailsModal } from './caisse/CouponDetailsModal'
import { ClosingReportModal } from './caisse/ClosingReportModal'
import { BulkCancelModal } from './caisse/BulkCancelModal'
import { CaisseHeader } from './caisse/CaisseHeader'
import { CaisseStatsCards } from './caisse/CaisseStatsCards'
import { SessionRecapBar } from './caisse/SessionRecapBar'

export default function CaisseCentralisee() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('caisse')
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
  const [selectedFactureIds, setSelectedFactureIds] = useState<Set<number>>(new Set())
  const [showBulkCancelModal, setShowBulkCancelModal] = useState(false)
  const [bulkCancelLoading, setBulkCancelLoading] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ processed: number; total: number } | null>(null)
  const { sudoState, requireSudo, closeSudo } = useSudo()
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
      toast.success(response.data.detail || t('messages.whatsapp_sent'))
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

  // Sélection en lot
  const toggleSelectFacture = useCallback((id: number) => {
    setSelectedFactureIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllFactures = useCallback(() => {
    setSelectedFactureIds(prev => {
      if (prev.size === facturesEnAttente.length) return new Set()
      return new Set(facturesEnAttente.map(f => f.id))
    })
  }, [facturesEnAttente])

  const canBulkCancel = user?.is_superuser || (user as any)?.can_cancel_invoice || (user as any)?.profile?.can_cancel_invoice

  // Ouvrir le modal de confirmation
  const handleBulkCancelClick = () => {
    if (selectedFactureIds.size === 0 && facturesEnAttente.length === 0) return
    setShowBulkCancelModal(true)
  }

  // Confirmer → demander sudo → exécuter par lots
  const handleConfirmBulkCancel = () => {
    const BATCH_SIZE = 50
    const factureIdsToSend = selectedFactureIds.size > 0 ? Array.from(selectedFactureIds) : null
    const isAllPending = !factureIdsToSend || factureIdsToSend.length === facturesEnAttente.length

    requireSudo(
      async (validatorId: number, password: string) => {
        setBulkCancelLoading(true)
        setBulkProgress({ processed: 0, total: factureIdsToSend ? factureIdsToSend.length : facturesEnAttente.length })
        let totalSuccess = 0
        let totalError = 0
        let totalStockReintegrated = 0

        try {
          let remainingIds = factureIdsToSend ? [...factureIdsToSend] : null
          let totalProcessed = 0
          let totalRemaining = remainingIds ? remainingIds.length : facturesEnAttente.length
          let hasMore = true

          while (hasMore) {
            const payload: Record<string, any> = {
              motif: 'Vidange caisse centrale',
              sudo_user: validatorId,
              sudo_password: password,
              batch_size: BATCH_SIZE,
            }
            if (isAllPending) {
              payload.all_pending = true
            } else {
              payload.facture_ids = remainingIds!.slice(0, BATCH_SIZE)
            }

            const { data } = await api.post('factures/bulk_cancel/', payload)
            totalSuccess += data.success_count || 0
            totalError += data.error_count || 0
            totalStockReintegrated += data.total_stock_reintegrated || 0
            totalProcessed += data.processed || 0
            totalRemaining = data.remaining ?? 0

            setBulkProgress({ processed: totalProcessed, total: totalProcessed + totalRemaining })

            if (totalRemaining === 0) {
              hasMore = false
            } else if (!isAllPending) {
              remainingIds = remainingIds!.slice(data.processed)
              if (remainingIds.length === 0) hasMore = false
            }
          }

          toast.success(`${totalSuccess} facture(s) annulée(s). ${totalStockReintegrated} lignes de stock réintégrées.`)
          if (totalError > 0) {
            toast.error(`${totalError} erreur(s) au total`)
          }
          setSelectedFactureIds(new Set())
          setShowBulkCancelModal(false)
          fetchFacturesEnAttente()
        } catch (err: any) {
          toast.error(getApiErrorDetail(err, t('messages.bulk_cancel_error')))
          throw err
        } finally {
          setBulkCancelLoading(false)
          setBulkProgress(null)
        }
      },
      {
        title: t('bulk_cancel_sudo_title', { defaultValue: 'Validation requise — Vidange caisse' }),
        message: t('bulk_cancel_sudo_msg', { defaultValue: 'Cette action annule des factures et réintègre le stock. Validation d\'un administrateur requise.' }),
      }
    )
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
      <CaisseHeader
        isMultiCaisse={isMultiCaisse}
        selectedPosteCaisseId={selectedPosteCaisseId}
        onPosteCaisseChange={setSelectedPosteCaisseId}
        postesCaisses={postesCaisses}
        myActivePoste={myActivePoste}
        hideAmounts={hideAmounts}
        onHideAmountsChange={setHideAmounts}
        onCloseSession={handleCloseSession}
        onOpenSession={() => setShowOpenSessionModal(true)}
        isCouponPanelOpen={isCouponPanelOpen}
        onToggleCouponPanel={() => setIsCouponPanelOpen(!isCouponPanelOpen)}
        activeCouponsCount={activeCouponsCount}
        appliedCouponsCount={appliedCouponsCount}
        canBulkCancel={canBulkCancel}
        facturesCount={facturesEnAttente.length}
        selectedFactureIds={selectedFactureIds}
        onBulkCancelClick={handleBulkCancelClick}
      />

      {/* Quick Stats Cards */}
      <CaisseStatsCards
        facturesCount={facturesEnAttente.length}
        totalMontantEnAttente={totalMontantEnAttente}
        activeCouponsCount={activeCouponsCount}
        appliedCouponsCount={appliedCouponsCount}
      />

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
              selectedIds={selectedFactureIds}
              onToggleSelect={toggleSelectFacture}
              onSelectAll={selectAllFactures}
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
        <SessionRecapBar sessionRecap={sessionRecap} />
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

      <CaisseTicketPreviewModal
        isOpen={showTicketPreview}
        onClose={() => setShowTicketPreview(false)}
        ticket={ticketCaisse}
        settings={pharmacySettings}
        onSendWhatsApp={handleSendWhatsApp}
        loading={loading}
      />

      {/* Modals pour les Coupons */}
      <CouponGenerateModal
        isOpen={isGenererCouponModalOpen}
        onClose={() => setIsGenererCouponModalOpen(false)}
        montant={nouveauCouponMontant}
        onMontantChange={setNouveauCouponMontant}
        notes={nouveauCouponNotes}
        onNotesChange={setNouveauCouponNotes}
        onSubmit={() => setIsSudoModalOpen(true)}
        loading={loading}
      />

      {/* Modal Confirmation Sudo pour Coupon */}
      <PasswordConfirmModal
        isOpen={isSudoModalOpen}
        onClose={() => setIsSudoModalOpen(false)}
        onConfirm={handleGenererCouponWrapper}
        title={t('coupons.sudo_title')}
        message={t('coupons.sudo_confirm', { amount: nouveauCouponMontant })}
      />

      {/* Modal Détails Coupon */}
      <CouponDetailsModal
        isOpen={isDetailsCouponModalOpen}
        onClose={() => { setIsDetailsCouponModalOpen(false); setCouponTrouve(null); setSearchCouponNumero(''); }}
        coupon={couponTrouve}
        factureForCoupon={factureForCoupon}
        onAppliquer={handleAppliquerCouponAFacture}
        settings={pharmacySettings}
      />

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
      <ClosingReportModal
        isOpen={showClosingReport}
        onClose={() => setShowClosingReport(false)}
        report={closingReport}
      />

      {/* Modal de confirmation — Vidange caisse */}
      <BulkCancelModal
        isOpen={showBulkCancelModal}
        onClose={() => setShowBulkCancelModal(false)}
        onConfirm={handleConfirmBulkCancel}
        facturesEnAttente={facturesEnAttente}
        selectedFactureIds={selectedFactureIds}
        loading={bulkCancelLoading}
        progress={bulkProgress}
      />

      {/* Modal Sudo pour la vidange */}
      <SudoValidationModal
        isOpen={sudoState.isOpen}
        onClose={closeSudo}
        onValidate={sudoState.onValidate}
        saving={sudoState.isValidating}
        title={sudoState.title}
        message={sudoState.message}
      />
    </div>
  )
}


