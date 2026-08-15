import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import type { Facture, TicketCaisse, CouponMonnaie, PosteVente } from '../../types'
import PasswordConfirmModal from '../PasswordConfirmModal'
import SudoValidationModal from '../common/SudoValidationModal'
import { LoadingScreen } from '../common/LoadingScreen'

// Lazy-load des modals lourds (rarement ouverts)
const PaymentModal = lazy(() => import('./PaymentModal').then(m => ({ default: m.PaymentModal })))
const CaisseTicketPreviewModal = lazy(() => import('./CaisseTicketPreviewModal').then(m => ({ default: m.CaisseTicketPreviewModal })))
const CouponDetailsModal = lazy(() => import('./CouponDetailsModal').then(m => ({ default: m.CouponDetailsModal })))
const OpenCashSessionModal = lazy(() => import('./OpenCashSessionModal').then(m => ({ default: m.OpenCashSessionModal })))
const ClosingReportModal = lazy(() => import('./ClosingReportModal').then(m => ({ default: m.ClosingReportModal })))
const BulkCancelModal = lazy(() => import('./BulkCancelModal').then(m => ({ default: m.BulkCancelModal })))
const CouponGenerateModal = lazy(() => import('./CouponGenerateModal').then(m => ({ default: m.CouponGenerateModal })))

interface CaisseModalsProps {
  // Payment
  isPaymentModalOpen: boolean
  selectedFacture: Facture | null
  couponForSelectedFacture: CouponMonnaie | undefined
  onConfirmPayment: (paiements: { mode: string; montant: number }[]) => void
  onClosePayment: () => void
  paymentLoading: boolean
  // Ticket preview
  showTicketPreview: boolean
  ticketCaisse: TicketCaisse | null
  pharmacySettings: unknown
  onSendWhatsApp: () => Promise<void>
  onCloseTicketPreview: () => void
  loading: boolean
  // Coupon generate
  isGenererCouponModalOpen: boolean
  nouveauCouponMontant: string
  nouveauCouponNotes: string
  onMontantChange: (v: string) => void
  onNotesChange: (v: string) => void
  onSubmitCouponGenerate: () => void
  onCloseCouponGenerate: () => void
  // Sudo coupon
  isSudoModalOpen: boolean
  onCloseSudo: () => void
  onConfirmSudo: () => Promise<void>
  // Coupon details
  isDetailsCouponModalOpen: boolean
  couponTrouve: CouponMonnaie | null
  factureForCoupon: Facture | null
  onAppliquerCoupon: (coupon: CouponMonnaie, facture: Facture) => void
  onCloseCouponDetails: () => void
  // Open session
  showOpenSessionModal: boolean
  onCloseOpenSession: () => void
  onSessionOpened: (poste?: PosteVente | null) => void
  // Closing report
  showClosingReport: boolean
  closingReport: unknown
  onCloseClosingReport: () => void
  // Bulk cancel
  showBulkCancelModal: boolean
  onCloseBulkCancel: () => void
  onConfirmBulkCancel: () => void
  facturesEnAttente: Facture[]
  selectedFactureIds: Set<number>
  bulkCancelLoading: boolean
  bulkProgress: { processed: number; total: number } | null
  // Sudo validation (for bulk cancel)
  sudoState: {
    isOpen: boolean
    onClose: () => void
    onValidate: ((id: number, pwd: string) => Promise<void>) | null
    isValidating: boolean
    title: string
    message: string
  }
}

export function CaisseModals({
  isPaymentModalOpen,
  selectedFacture,
  couponForSelectedFacture,
  onConfirmPayment,
  onClosePayment,
  paymentLoading,
  showTicketPreview,
  ticketCaisse,
  pharmacySettings,
  onSendWhatsApp,
  onCloseTicketPreview,
  loading,
  isGenererCouponModalOpen,
  nouveauCouponMontant,
  nouveauCouponNotes,
  onMontantChange,
  onNotesChange,
  onSubmitCouponGenerate,
  onCloseCouponGenerate,
  isSudoModalOpen,
  onCloseSudo,
  onConfirmSudo,
  isDetailsCouponModalOpen,
  couponTrouve,
  factureForCoupon,
  onAppliquerCoupon,
  onCloseCouponDetails,
  showOpenSessionModal,
  onCloseOpenSession,
  onSessionOpened,
  showClosingReport,
  closingReport,
  onCloseClosingReport,
  showBulkCancelModal,
  onCloseBulkCancel,
  onConfirmBulkCancel,
  facturesEnAttente,
  selectedFactureIds,
  bulkCancelLoading,
  bulkProgress,
  sudoState,
}: CaisseModalsProps) {
  const { t } = useTranslation('caisse')

  return (
    <>
      {/* Modal de paiement */}
      {isPaymentModalOpen && selectedFacture && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <PaymentModal
            isOpen={isPaymentModalOpen}
            onClose={onClosePayment}
            facture={selectedFacture}
            coupon={couponForSelectedFacture}
            onConfirm={onConfirmPayment}
            loading={paymentLoading}
          />
        </Suspense>
      )}

      {showTicketPreview && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <CaisseTicketPreviewModal
            isOpen={showTicketPreview}
            onClose={onCloseTicketPreview}
            ticket={ticketCaisse}
            settings={pharmacySettings}
            onSendWhatsApp={onSendWhatsApp}
            loading={loading}
          />
        </Suspense>
      )}

      {/* Modals pour les Coupons */}
      {isGenererCouponModalOpen && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <CouponGenerateModal
            isOpen={isGenererCouponModalOpen}
            onClose={onCloseCouponGenerate}
            montant={nouveauCouponMontant}
            onMontantChange={onMontantChange}
            notes={nouveauCouponNotes}
            onNotesChange={onNotesChange}
            onSubmit={onSubmitCouponGenerate}
            loading={loading}
          />
        </Suspense>
      )}

      {/* Modal Confirmation Sudo pour Coupon */}
      <PasswordConfirmModal
        isOpen={isSudoModalOpen}
        onClose={onCloseSudo}
        onConfirm={onConfirmSudo}
        title={t('coupons.sudo_title')}
        message={t('coupons.sudo_confirm', { amount: nouveauCouponMontant })}
      />

      {/* Modal Détails Coupon */}
      {isDetailsCouponModalOpen && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <CouponDetailsModal
            isOpen={isDetailsCouponModalOpen}
            onClose={onCloseCouponDetails}
            coupon={couponTrouve}
            factureForCoupon={factureForCoupon}
            onAppliquer={onAppliquerCoupon}
            settings={pharmacySettings}
          />
        </Suspense>
      )}

      {/* Modal Ouvrir Caisse */}
      {showOpenSessionModal && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <OpenCashSessionModal
            isOpen={showOpenSessionModal}
            onClose={onCloseOpenSession}
            onSessionOpened={onSessionOpened}
          />
        </Suspense>
      )}

      {/* Modal Rapport de Clôture */}
      {showClosingReport && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <ClosingReportModal
            isOpen={showClosingReport}
            onClose={onCloseClosingReport}
            report={closingReport}
          />
        </Suspense>
      )}

      {/* Modal de confirmation — Vidange caisse */}
      {showBulkCancelModal && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <BulkCancelModal
            isOpen={showBulkCancelModal}
            onClose={onCloseBulkCancel}
            onConfirm={onConfirmBulkCancel}
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
        onClose={sudoState.onClose}
        onValidate={sudoState.onValidate}
        saving={sudoState.isValidating}
        title={sudoState.title}
        message={sudoState.message}
      />
    </>
  )
}
