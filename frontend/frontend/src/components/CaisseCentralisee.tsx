import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import type { Facture, TicketCaisse, CouponMonnaie } from '../types'
import { FacturesTable } from './caisse/FacturesTable'
import { CouponPanel } from './caisse/CouponPanel'
import { CaisseModals } from './caisse/CaisseModals'
import PremiumModal from './common/PremiumModal'
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
import { useBulkCancel } from '../hooks/useBulkCancel'
import { useCaisseRealtime } from '../hooks/caisse/useCaisseRealtime'
import { useCaisseSession } from '../hooks/caisse/useCaisseSession'
import { CaisseHeader } from './caisse/CaisseHeader'
import { CaisseStatsCards } from './caisse/CaisseStatsCards'
import { SessionRecapBar } from './caisse/SessionRecapBar'
import { logger } from '../utils/logger'

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
  // État pour afficher l'aide des raccourcis
  const [showCaisseHelp, setShowCaisseHelp] = useState(false)
  
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
    handleAppliquerCouponBase(coupon, facture)
    setFactureForCoupon(null)
    setIsDetailsCouponModalOpen(false)
    setCouponTrouve(null)
  }, [handleAppliquerCouponBase])

  const handleRechercherCoupon = useCallback(() => {
    handleRechercherCouponBase(searchCouponNumero)
  }, [handleRechercherCouponBase, searchCouponNumero])

  const handleRetirerCouponWrapper = useCallback((factureId: number) => {
    handleRetirerCouponDeFacture(factureId)
  }, [handleRetirerCouponDeFacture])

  // Rafraîchissement automatique via WebSocket + polling de fallback
  const { refresh: refreshFromRealtime } = useCaisseRealtime({
    selectedPosteCaisseId,
    fetchFacturesEnAttente,
    fetchCoupons,
  })

  // Wrapper pour la génération de coupon
  const handleGenererCouponWrapper = useCallback(async () => {
    await handleGenererCoupon(nouveauCouponMontant, nouveauCouponNotes, selectedFacture?.id || null)
  }, [handleGenererCoupon, nouveauCouponMontant, nouveauCouponNotes, selectedFacture])

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
      onToggleShowHelp: () => setShowCaisseHelp(prev => !prev),
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
      isCouponPanelOpen,
      showCaisseHelp
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
    enregistrerPaiementHook(paiements, user)
  }, [enregistrerPaiementHook, user])
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

  // Sélection en lot — gérée par useBulkCancel
  const {
    selectedFactureIds,
    showBulkCancelModal,
    setShowBulkCancelModal,
    bulkCancelLoading,
    bulkProgress,
    toggleSelectFacture,
    selectAllFactures,
    canBulkCancel,
    handleBulkCancelClick,
    handleConfirmBulkCancel,
  } = useBulkCancel({
    facturesEnAttente,
    fetchFacturesEnAttente,
    requireSudo,
    user,
  })

  // Hooks pour les modifications
  const {
    handleFullModification,
    handleUpdateQuantity,
    handleRemoveProduct: handleRemoveProductBase
  } = useInvoiceModification({
    setLoading,
    fetchFacturesEnAttente
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
        canManageSecurity={!!user?.is_superuser}
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

      {/* Récap Session Live — visible selon le paramètre global hide_cash_totals (titulaire), sauf superuser */}
      {sessionRecap?.has_session && (user?.is_superuser || !pharmacySettings?.hide_cash_totals) && (
        <SessionRecapBar sessionRecap={sessionRecap} />
      )}

      </div>

      <CaisseModals
        // Payment
        isPaymentModalOpen={isPaymentModalOpen}
        selectedFacture={selectedFacture}
        couponForSelectedFacture={selectedFacture ? couponsParFacture[selectedFacture.id] : undefined}
        onConfirmPayment={enregistrerPaiement}
        onClosePayment={() => setIsPaymentModalOpen(false)}
        paymentLoading={paymentLoading}
        // Ticket preview
        showTicketPreview={showTicketPreview}
        ticketCaisse={ticketCaisse}
        pharmacySettings={pharmacySettings}
        onSendWhatsApp={handleSendWhatsApp}
        onCloseTicketPreview={() => setShowTicketPreview(false)}
        loading={loading}
        // Coupon generate
        isGenererCouponModalOpen={isGenererCouponModalOpen}
        nouveauCouponMontant={nouveauCouponMontant}
        nouveauCouponNotes={nouveauCouponNotes}
        onMontantChange={setNouveauCouponMontant}
        onNotesChange={setNouveauCouponNotes}
        onSubmitCouponGenerate={() => setIsSudoModalOpen(true)}
        onCloseCouponGenerate={() => setIsGenererCouponModalOpen(false)}
        // Sudo coupon
        isSudoModalOpen={isSudoModalOpen}
        onCloseSudo={() => setIsSudoModalOpen(false)}
        onConfirmSudo={handleGenererCouponWrapper}
        // Coupon details
        isDetailsCouponModalOpen={isDetailsCouponModalOpen}
        couponTrouve={couponTrouve}
        factureForCoupon={factureForCoupon}
        onAppliquerCoupon={handleAppliquerCouponAFacture}
        onCloseCouponDetails={() => { setIsDetailsCouponModalOpen(false); setCouponTrouve(null); setSearchCouponNumero(''); }}
        // Open session
        showOpenSessionModal={showOpenSessionModal}
        onCloseOpenSession={() => setShowOpenSessionModal(false)}
        onSessionOpened={async (poste) => {
          if (poste) {
            setMyActivePoste(poste)
            if ((poste as { caisse?: number }).caisse) {
              setSelectedPosteCaisseId(String((poste as { caisse: number }).caisse))
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
        // Closing report
        showClosingReport={showClosingReport}
        closingReport={closingReport}
        onCloseClosingReport={() => setShowClosingReport(false)}
        // Bulk cancel
        showBulkCancelModal={showBulkCancelModal}
        onCloseBulkCancel={() => setShowBulkCancelModal(false)}
        onConfirmBulkCancel={handleConfirmBulkCancel}
        facturesEnAttente={facturesEnAttente}
        selectedFactureIds={selectedFactureIds}
        bulkCancelLoading={bulkCancelLoading}
        bulkProgress={bulkProgress}
        // Sudo validation
        sudoState={{
          isOpen: sudoState.isOpen,
          onClose: closeSudo,
          onValidate: sudoState.onValidate,
          isValidating: sudoState.isValidating,
          title: sudoState.title ?? '',
          message: sudoState.message ?? '',
        }}
      />
      <PremiumModal
        isOpen={showCaisseHelp}
        onClose={() => setShowCaisseHelp(false)}
        title={t('shortcuts.title', { defaultValue: 'Raccourcis :' })}
        icon={<Keyboard className="size-5" />}
        footer={
          <button
            type="button"
            onClick={() => setShowCaisseHelp(false)}
            className="inline-flex items-center justify-center h-8 px-4 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            {t('shortcuts.close', { defaultValue: 'Fermer' })}
          </button>
        }
      >
        <div className="p-5 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="font-mono font-bold text-slate-700">↑ ↓ / j k</span>
            <span className="text-slate-600">{t('shortcuts.navigate', { defaultValue: 'Naviguer' })}</span>
            <span className="font-mono font-bold text-slate-700">Home / End</span>
            <span className="text-slate-600">{t('shortcuts.home_end', { defaultValue: 'Début / Fin' })}</span>
            <span className="font-mono font-bold text-slate-700">PageUp / PageDown</span>
            <span className="text-slate-600">{t('shortcuts.page', { defaultValue: 'Page précédente / suivante' })}</span>
            <span className="font-mono font-bold text-slate-700">1 - 9</span>
            <span className="text-slate-600">{t('shortcuts.quick_select', { defaultValue: 'Sélection rapide' })}</span>
            <span className="font-mono font-bold text-slate-700">Entrée</span>
            <span className="text-slate-600">{t('shortcuts.cash_in', { defaultValue: 'Encaisser' })}</span>
            <span className="font-mono font-bold text-slate-700">Espace</span>
            <span className="text-slate-600">{t('shortcuts.view_products', { defaultValue: 'Voir les produits' })}</span>
            <span className="font-mono font-bold text-slate-700">c</span>
            <span className="text-slate-600">{t('shortcuts.coupon', { defaultValue: 'Appliquer coupon' })}</span>
            <span className="font-mono font-bold text-slate-700">r</span>
            <span className="text-slate-600">{t('shortcuts.refresh', { defaultValue: 'Rafraîchir' })}</span>
            <span className="font-mono font-bold text-slate-700">?</span>
            <span className="text-slate-600">{t('shortcuts.help', { defaultValue: 'Aide' })}</span>
            <span className="font-mono font-bold text-slate-700">Esc</span>
            <span className="text-slate-600">{t('shortcuts.close', { defaultValue: 'Fermer' })}</span>
          </div>
        </div>
      </PremiumModal>
    </div>
  )
}


