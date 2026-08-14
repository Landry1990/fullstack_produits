import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import type { Facture, TicketCaisse, CouponMonnaie } from '../types'
import PasswordConfirmModal from './PasswordConfirmModal'
import { FacturesTable } from './caisse/FacturesTable'
import { CouponPanel } from './caisse/CouponPanel'
import { useTranslation } from 'react-i18next'
import { getApiErrorDetail } from '../utils/errorHandling'
import { Keyboard } from 'lucide-react'
import { cashSessionService } from '../services/cashSessionService'
import { useCaisseKeyboard } from '../hooks/useCaisseKeyboard'
import { useCaissePayment } from '../hooks/useCaissePayment'
import { useCaisseCoupons } from '../hooks/useCaisseCoupons'
import { useCaisseStats } from '../hooks/useCaisseStats'
import { useInvoiceModification } from '../hooks/useInvoiceModification'
import { useSudo } from '../hooks/useSudo'
import { useCaisseRealtime } from '../hooks/caisse/useCaisseRealtime'
import { useCaisseSession } from '../hooks/caisse/useCaisseSession'
import SudoValidationModal from './common/SudoValidationModal'
import { CaisseHeader } from './caisse/CaisseHeader'
import { CaisseStatsCards } from './caisse/CaisseStatsCards'
import { SessionRecapBar } from './caisse/SessionRecapBar'
import { logger } from '../utils/logger'

// Lazy-load des modals lourds (rarement ouverts)
const PaymentModal = lazy(() => import('./caisse/PaymentModal').then(m => ({ default: m.PaymentModal })))
const CaisseTicketPreviewModal = lazy(() => import('./caisse/CaisseTicketPreviewModal').then(m => ({ default: m.CaisseTicketPreviewModal })))
const CouponDetailsModal = lazy(() => import('./caisse/CouponDetailsModal').then(m => ({ default: m.CouponDetailsModal })))
const OpenCashSessionModal = lazy(() => import('./caisse/OpenCashSessionModal').then(m => ({ default: m.OpenCashSessionModal })))
const ClosingReportModal = lazy(() => import('./caisse/ClosingReportModal').then(m => ({ default: m.ClosingReportModal })))
const BulkCancelModal = lazy(() => import('./caisse/BulkCancelModal').then(m => ({ default: m.BulkCancelModal })))
const CouponGenerateModal = lazy(() => import('./caisse/CouponGenerateModal').then(m => ({ default: m.CouponGenerateModal })))

export default function CaisseCentralisee() {
const _queryClient = useQueryClient()
  const { t } = useTranslation('caisse')
const _navigate = useNavigate()
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
  // État pour ouvrir le preview produits via raccourci clavier
  const [previewFactureId, setPreviewFactureId] = useState<number | null>(null)
  
  // États pour le multi-caisse et sessions — gérés par useCaisseSession
  const {
    postesCaisses,
    selectedPosteCaisseId,
    setSelectedPosteCaisseId,
    isMultiCaisse,
    myActivePoste,
    setMyActivePoste,
    hideAmounts,
    setHideAmounts,
    sessionRecap,
    setSessionRecap,
    fetchSessionRecap,
  } = useCaisseSession()

  const [showOpenSessionModal, setShowOpenSessionModal] = useState(false)
  const [closingReport, setClosingReport] = useState<unknown>(null)
  const [showClosingReport, setShowClosingReport] = useState(false)
  const [selectedFactureIds, setSelectedFactureIds] = useState<Set<number>>(new Set())
  const [showBulkCancelModal, setShowBulkCancelModal] = useState(false)
  const [bulkCancelLoading, setBulkCancelLoading] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ processed: number; total: number } | null>(null)
  const { sudoState, requireSudo, closeSudo } = useSudo()

  // Fonction pour récupérer les factures en attente
  const fetchingRef = useRef(false)
  const fetchFacturesEnAttente = useCallback(async () => {
    // Éviter les refetchs concurrents (cause du flash)
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const params: Record<string, unknown> = {
        status__in: 'BROU,VAL,PROF',
        include_pending: true,
        include_details: true
      }
      if (selectedPosteCaisseId !== 'all') params.poste_caisse = selectedPosteCaisseId

      const response = await api.get('factures/', { params })
      const facturesList = response.data.results || response.data || []

      setFacturesEnAttente(facturesList)
    } catch (err) {
      logger.error('Erreur lors du chargement des factures en attente:', err)
    } finally {
      fetchingRef.current = false
    }
  }, [selectedPosteCaisseId])


  // Hook pour la logique des coupons
  const {
    loading: _couponLoading,
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

  // Rafraîchissement automatique via WebSocket + polling de fallback
  const { refresh: refreshFromRealtime } = useCaisseRealtime({
    selectedPosteCaisseId,
    fetchFacturesEnAttente,
    fetchCoupons,
  })

  // Wrapper pour la génération de coupon
  const handleGenererCouponWrapper = useCallback(async () => {
    await handleGenererCoupon(nouveauCouponMontant, nouveauCouponNotes, selectedFacture?.id || null, t)
  }, [handleGenererCoupon, nouveauCouponMontant, nouveauCouponNotes, selectedFacture, t])

  // Ouvrir le panneau pour sélectionner un coupon pour une facture
  const openCouponSelectionForFacture = (facture: Facture) => {
    setFactureForCoupon(facture)
    setIsCouponPanelOpen(true)
  }

  // Trier les factures par date chronologique (plus ancienne en premier)
  const sortedFactures = useMemo(() => 
    facturesEnAttente.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
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
      const { data } = await cashSessionService.closePosteVente(myActivePoste.id, hideAmounts)
      setClosingReport(data)
      setShowClosingReport(true)
      setMyActivePoste(null)
      setSessionRecap(null)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      toast.error(axiosErr.response?.data?.detail || t('cash_session.close_error', { defaultValue: 'Erreur fermeture' }))
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
      onViewProducts: (facture) => setPreviewFactureId(facture.id),
      onRefresh: () => {
        refreshFromRealtime()
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
      canCashOut: user?.can_cash_out || user?.is_superuser || false
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
    
    const facture = ticketCaisse.facture as unknown as {
      id: number;
      client: number | { phone?: string };
      client_phone?: string;
    }
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
      logger.error('Erreur envoi WhatsApp:', err)
      toast.error(getApiErrorDetail(err, t('messages.whatsapp_send_error')))
    } finally {
      setLoading(false)
    }
  }



  // Annuler une facture
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleAnnuler = async (facture: Facture) => {
    if (!window.confirm(t('confirm_cancel_invoice', { numero: facture.numero_facture }))) return

    try {
      await api.post(`factures/${facture.id}/annuler/`, { motif: 'Annulation depuis Caisse Centrale' })
      toast.success(t('messages.cancel_invoice_success'))
      fetchFacturesEnAttente()
    } catch (err) {
      logger.error('Erreur annulation:', err)
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

  const canBulkCancel = user?.is_superuser || (user as { can_cancel_invoice?: boolean } | null)?.can_cancel_invoice || (user as { profile?: { can_cancel_invoice?: boolean } } | null)?.profile?.can_cancel_invoice || false

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
            const payload: Record<string, unknown> = {
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
        } catch (err: unknown) {
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
        permission: 'can_cancel_invoice',
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
            onClose={() => {
              setIsCouponPanelOpen(false)
              setFactureForCoupon(null)
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
              forcePreviewFactureId={previewFactureId}
              onPreviewClosed={() => setPreviewFactureId(null)}
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
              <span><kbd className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono">{t('shortcuts.space_key', 'Espace')}</kbd> {t('shortcuts.view_products')}</span>
              <span><kbd className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono">C</kbd> {t('shortcuts.coupon')}</span>
              <span><kbd className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono">R</kbd> {t('shortcuts.refresh')}</span>
              <span><kbd className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono">1-9</kbd> {t('shortcuts.quick_select')}</span>
              <span><kbd className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono">Esc</kbd> {t('shortcuts.close')}</span>
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
        <Suspense fallback={null}>
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          facture={selectedFacture}
          coupon={couponsParFacture[selectedFacture.id]}
          onConfirm={enregistrerPaiement}
          loading={paymentLoading}
        />
        </Suspense>
      )}

      {showTicketPreview && (
        <Suspense fallback={null}>
        <CaisseTicketPreviewModal
          isOpen={showTicketPreview}
          onClose={() => setShowTicketPreview(false)}
          ticket={ticketCaisse}
          settings={pharmacySettings}
          onSendWhatsApp={handleSendWhatsApp}
          loading={loading}
        />
        </Suspense>
      )}

      {/* Modals pour les Coupons */}
      {isGenererCouponModalOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Modal Confirmation Sudo pour Coupon */}
      <PasswordConfirmModal
        isOpen={isSudoModalOpen}
        onClose={() => setIsSudoModalOpen(false)}
        onConfirm={handleGenererCouponWrapper}
        title={t('coupons.sudo_title')}
        message={t('coupons.sudo_confirm', { amount: nouveauCouponMontant })}
      />

      {/* Modal Détails Coupon */}
      {isDetailsCouponModalOpen && (
        <Suspense fallback={null}>
        <CouponDetailsModal
          isOpen={isDetailsCouponModalOpen}
          onClose={() => { setIsDetailsCouponModalOpen(false); setCouponTrouve(null); setSearchCouponNumero(''); }}
          coupon={couponTrouve}
          factureForCoupon={factureForCoupon}
          onAppliquer={handleAppliquerCouponAFacture}
          settings={pharmacySettings}
        />
        </Suspense>
      )}

      {/* Modal Ouvrir Caisse */}
      {showOpenSessionModal && (
        <Suspense fallback={null}>
        <OpenCashSessionModal
          isOpen={showOpenSessionModal}
          onClose={() => setShowOpenSessionModal(false)}
          onSessionOpened={async (poste) => {
            if (poste) {
              setMyActivePoste(poste)
              if (poste.caisse) {
                setSelectedPosteCaisseId(String(poste.caisse))
              }
            } else {
              const myActive = await cashSessionService.getMyActivePostesVente().catch(() => [])
              const activePoste = myActive.length > 0 ? myActive[0] : null
              setMyActivePoste(activePoste)
              if (activePoste?.caisse) {
                setSelectedPosteCaisseId(String(activePoste.caisse))
              }
            }
          }}
        />
        </Suspense>
      )}

      {/* Modal Rapport de Clôture */}
      {showClosingReport && (
        <Suspense fallback={null}>
        <ClosingReportModal
          isOpen={showClosingReport}
          onClose={() => setShowClosingReport(false)}
          report={closingReport}
        />
        </Suspense>
      )}

      {/* Modal de confirmation — Vidange caisse */}
      {showBulkCancelModal && (
        <Suspense fallback={null}>
        <BulkCancelModal
          isOpen={showBulkCancelModal}
          onClose={() => setShowBulkCancelModal(false)}
          onConfirm={handleConfirmBulkCancel}
          facturesEnAttente={facturesEnAttente}
          selectedFactureIds={selectedFactureIds}
          loading={bulkCancelLoading}
          progress={bulkProgress}
        />
        </Suspense>
      )}

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


