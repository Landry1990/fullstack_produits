import { Suspense, lazy } from 'react'
import { Button } from '../shadcn/button'
import ClientCreateModal from './ClientCreateModal'
import PendingSalesDrawer from './PendingSalesDrawer'
import SudoValidationModal from '../common/SudoValidationModal'
import PremiumModal from '../common/PremiumModal'
import { ClientNameModal } from '../sales/modals/ClientNameModal'
import AlertMessageModal from './AlertMessageModal'
import DisplayAlertModal from './DisplayAlertModal'
import ForceStockModal from './ForceStockModal'
import type { FacturationState } from '../../hooks/useFacturationState'

// Lazy-loaded modales (lourdes ou rarement ouvertes)
const PaymentModal = lazy(() => import('./PaymentModal'))
const OrdonnanceModal = lazy(() => import('../OrdonnanceModal'))
const LotSelectionModal = lazy(() => import('../LotSelectionModal'))
const TicketPreviewModal = lazy(() => import('./TicketPreviewModal'))
const StockResolutionHandler = lazy(() => import('./StockResolutionHandler').then(m => ({ default: m.StockResolutionHandler })))
const SubstitutionModal = lazy(() => import('../SubstitutionModal').then(m => ({ default: m.SubstitutionModal })))
const PrescriptionScannerModal = lazy(() => import('./PrescriptionScannerModal'))
const OpenPointDeVenteModal = lazy(() => import('../caisse/OpenPointDeVenteModal').then(m => ({ default: m.OpenPointDeVenteModal })))

interface FacturationModalsProps {
  hook: FacturationState
  showOpenPosteModal: boolean
  setShowOpenPosteModal: (open: boolean) => void
}

export default function FacturationModals({ hook, showOpenPosteModal, setShowOpenPosteModal }: FacturationModalsProps) {
  return (
    <>
      {hook.ui.isPaymentModalOpen && (
        <Suspense fallback={null}>
        <PaymentModal
          isOpen={hook.ui.isPaymentModalOpen}
          onClose={hook.ui.closePaymentModal}
          loading={hook.loading}
          facturePourPaiement={hook.ui.facturePourPaiement}
          isNewSale={hook.isNewSale}
          totals={hook.totals}
          montantPaye={hook.ui.montantPaye}
          setMontantPaye={hook.ui.setMontantPaye}
          modePaiement={hook.ui.modePaiement}
          setModePaiement={hook.ui.setModePaiement}
          paiements={hook.ui.paiements}
          setPaiements={hook.ui.setPaiements}
          onCompleteSale={hook.handleCompleteSale}
          clientSoldeDepot={hook.clientsHook.selectedClientData?.solde_depot}
          onRegisterPayment={async () => {
             if (hook.ui.facturePourPaiement) {
                 await hook.completeExistingInvoicePayment({
                    facture: hook.ui.facturePourPaiement,
                    paiements: hook.ui.paiements,
                    montantPaye: hook.ui.montantPaye,
                    modePaiement: hook.ui.modePaiement,
                    reference: hook.ui.reference,
                    lignesFacture: hook.lignesFacture,
                    tempOrdonnanceData: hook.tempOrdonnanceData,
                    prescriptionImage: hook.ui.prescriptionImage
                 })
             }
          }}
          selectedClient={hook.clientsHook.selectedClient}
          useManualClient={hook.clientsHook.useManualClient}
          paymentInputRef={hook.paymentInputRef}
          isMultiCaisse={hook.isMultiCaisse}
          centralizedCashRegister={hook.centralizedCashRegister}
          postesVenteActifs={hook.activePostesVente}
          selectedPosteVenteId={hook.activePoste?.id ?? null}
          setSelectedPosteVenteId={(id) => {
            if (id) {
              const poste = hook.activePostesVente.find(p => p.id === id)
              if (poste?.caisse) {
                hook.setSelectedPosteCaisseId(poste.caisse)
              }
            }
          }}
          selectedPosteCaisseId={hook.selectedPosteCaisseId}
        />
        </Suspense>
      )}

      {/* Ticket Preview Modal */}
      <Suspense fallback={null}>
      <TicketPreviewModal
        isOpen={hook.showTicketPreview}
        onClose={() => {
            hook.setShowTicketPreview(false)
            setTimeout(() => hook.searchInputRef.current?.focus(), 100)
        }}
        ticket={hook.ticketCaisse}
        settings={hook.pharmacySettings}
        onSendWhatsApp={hook.handleSendWhatsApp}
      />
      </Suspense>

      {/* Stock Resolution Handler */}
      <Suspense fallback={null}>
      <StockResolutionHandler
        isOpen={hook.showStockResolution}
        onClose={() => hook.setShowStockResolution(false)}
        stockResolutionItems={hook.ui.stockResolutionItems}
        resolutionActions={hook.ui.resolutionActions}
        setResolutionActions={hook.ui.setResolutionActions}
        promisPhone={hook.ui.promisPhone}
        setPromisPhone={hook.ui.setPromisPhone}
        promisClientName={hook.ui.promisClientName}
        setPromisClientName={hook.ui.setPromisClientName}
        lignesFacture={hook.lignesFacture}
        setLignesFacture={hook.setLignesFacture}
        clients={hook.clientsHook.clients}
        selectedClient={hook.clientsHook.selectedClient}
        setSelectedClient={hook.clientsHook.setSelectedClient}
        useManualClient={hook.clientsHook.useManualClient}
        setUseManualClient={hook.clientsHook.setUseManualClient}
        setManualClientName={hook.clientsHook.setManualClientName}
        onComplete={hook.handlePaymentClickWithSudo}
        requireSudo={hook.requireSudo}
      />
      </Suspense>

      {/* Pending Sales Drawer */}
      <PendingSalesDrawer
        isOpen={hook.showPendingSales}
        onClose={() => hook.setShowPendingSales(false)}
        ventesEnAttente={hook.ventesEnAttente}
        onRestore={hook.restaurerVente}
        onDelete={hook.supprimerVenteEnAttente}
      />

      {/* Confirmation Modal */}
      <PremiumModal
        isOpen={!!hook.confirmModal?.isOpen}
        onClose={() => hook.setConfirmModal(null)}
        title={hook.t('common:confirmation', { defaultValue: 'Confirmation' })}
        icon={<span className="text-amber-500 text-xl">⚠️</span>}
        gradientFrom="warning/10"
        gradientTo="warning/5"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => hook.setConfirmModal(null)}>
              {hook.t('common:cancel', { defaultValue: 'Annuler' })}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (hook.confirmModal?.onConfirm) hook.confirmModal.onConfirm();
                hook.setConfirmModal(null);
              }}
            >
              {hook.t('common:confirm', { defaultValue: 'Confirmer' })}
            </Button>
          </div>
        }
      >
        <div className="p-6">
          <p className="text-slate-600 text-lg">{hook.confirmModal?.message}</p>
        </div>
      </PremiumModal>

      {/* Lot Selection Modal */}
      {hook.lotModal.isOpen && (
        <Suspense fallback={null}>
        <LotSelectionModal
          isOpen={hook.lotModal.isOpen}
          onClose={hook.closeLotModal}
          produit={hook.lotModal.product}
          quantity={hook.lotModal.quantity}
          currentAllocations={hook.lotModal.currentAllocations}
          onSelectAllocations={hook.handleLotSelect}
        />
        </Suspense>
      )}

      {/* Client Creation Modal */}
      <ClientCreateModal
        isOpen={hook.clientsHook.showClientCreateModal}
        onClose={() => hook.clientsHook.setShowClientCreateModal(false)}
        newClientForm={hook.clientsHook.newClientForm}
        setNewClientForm={hook.clientsHook.setNewClientForm}
        isCreatingClient={hook.clientsHook.isCreatingClient}
        handleCreateClient={hook.clientsHook.handleCreateClient}
      />

      {/* Ordonnance Modal */}
      {hook.showOrdonnanceModal && (
          <Suspense fallback={null}>
          <OrdonnanceModal
              isOpen={hook.showOrdonnanceModal}
              onClose={() => {
                  hook.setShowOrdonnanceModal(false)
                  hook.setPendingOrdonnanceFacture(null)
              }}
              onSave={hook.handleOrdonnanceSave}
              facture={hook.pendingOrdonnanceFacture}
              lignes={hook.lignesFacture}
              loading={hook.loading}
          />
          </Suspense>
      )}

      {/* Client Name Modal for A4 Invoice */}
      <ClientNameModal
          isOpen={hook.showClientNameModal}
          onClose={() => {
              hook.setShowClientNameModal(false);
              hook.setPendingPrintFacture(null);
              setTimeout(() => hook.searchInputRef.current?.focus(), 100);
          }}
          onConfirm={hook.handleConfirmPrintClientName}
          facture={hook.pendingPrintFacture}
      />

      {/* Shortcut Help Modal (F1) */}
      <PremiumModal
        isOpen={hook.showHelp}
        onClose={() => hook.setShowHelp(false)}
        title={hook.t('pos.keyboard_shortcuts')}
        icon={<span className="text-sky-500 text-xl">⌨️</span>}
        gradientFrom="primary/10"
        gradientTo="primary/5"
      >
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-bold text-sky-600 border-b border-sky-200 pb-1 mb-2">{hook.t('pos.navigation_search')}</h3>
              <div className="flex justify-between items-center text-sm">
                <span>{hook.t('pos.search_product')}</span>
                <kbd>F2</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>{hook.t('pos.focus_search')}</span>
                <kbd>/</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>{hook.t('pos.search_client_qty')}</span>
                <kbd>F4</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>{hook.t('pos.search_client_direct')}</span>
                <kbd>Ctrl + F</kbd>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-slate-600 border-b border-slate-200 pb-1 mb-2">{hook.t('pos.sales_actions')}</h3>
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-emerald-600">{hook.t('pos.pay_cash')}</span>
                <kbd>F9</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-amber-500">{hook.t('pos.suspend_hold')}</span>
                <kbd>Ctrl + S / F7</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-amber-600">{hook.t('pos.recall_sale')}</span>
                <kbd>F8</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>{hook.t('pos.zenith_mode')}</span>
                <kbd>Alt + Z</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>{hook.t('pos.close_cancel')}</span>
                <kbd>Esc</kbd>
              </div>
            </div>
          </div>
          <div className="mt-6 p-3 bg-slate-100 rounded-lg text-xs text-center text-slate-500 italic">
            {hook.t('pos.keyboard_shortcuts_tip')}
          </div>
        </div>
      </PremiumModal>

      {/* Sudo Validation Modal */}
      <SudoValidationModal
        isOpen={hook.sudoState.isOpen}
        onClose={hook.closeSudo}
        onValidate={hook.sudoState.onValidate}
        saving={hook.sudoState.isValidating}
        title={hook.sudoState.title || hook.t('facturation.payment.sudo_title')}
        message={hook.sudoState.message || ""}
        forceCurrentUser={hook.sudoState.forceCurrentUser}
        className="z-[9999]"
      />

      <AlertMessageModal
         isOpen={hook.ui.isAlertModalOpen}
         onClose={() => hook.ui.setIsAlertModalOpen(false)}
         target={hook.ui.alertTarget}
         onSuccess={(newTarget) => {
             hook.ui.setAlertTarget(newTarget);
             if (newTarget?.type === 'product') {
                const refreshedLignes = hook.cart.lignesFacture.map((l: unknown) => {
                   if (l.produit.id === newTarget.id) {
                      return { ...l, produit: { ...l.produit, message_alerte: newTarget.currentMessage }};
                   }
                   return l;
                });
                hook.cart.setLignesFacture(refreshedLignes);
             } else if (newTarget?.type === 'client') {
                // Next search/reload will pick it up
             }
             setTimeout(() => hook.searchInputRef.current?.focus(), 100);
         }}
      />

      {hook.ui.displayAlertQueue.length > 0 && (
          <DisplayAlertModal
             alerts={hook.ui.displayAlertQueue}
             onAcknowledge={() => {
                 const currentAlert = hook.ui.displayAlertQueue[0];
                 hook.ui.popDisplayAlert();
                 setTimeout(() => {
                     if (currentAlert?.targetId && hook.quantityInputsRef?.current) {
                         const qtyInput = hook.quantityInputsRef.current.get(currentAlert.targetId);
                         if (qtyInput) {
                             qtyInput.focus();
                             qtyInput.select();
                             return;
                         }
                     }
                     hook.searchInputRef.current?.focus();
                 }, 100);
             }}
          />
      )}

      {/* Prescription Scanner Modal */}
      <Suspense fallback={null}>
      <PrescriptionScannerModal
        isOpen={hook.ui.isScannerModalOpen}
        onClose={() => hook.ui.setIsScannerModalOpen(false)}
        onAddProducts={(products) => {
          products.forEach(p => hook.cart.addProduit(p, { isRetrocession: hook.isRetrocession }));
        }}
        onExtractionDone={(data) => {
          hook.ui.setTempOrdonnanceData({
            patient_nom: data.patient_nom || '',
            prescripteur_nom: data.prescripteur_nom || '',
            lignes: []
          });

          if (data.imageFile) {
            hook.ui.setPrescriptionImage(data.imageFile);
          }
        }}
      />
      </Suspense>

      {/* Force Stock Modal */}
      <ForceStockModal
        product={hook.forceStockProduct}
        onClose={() => hook.setForceStockProduct(null)}
        onSubstitute={(p) => hook.setSubstitutionProduct(p)}
        onForceStock={(p) => hook.cart.addProduit(p, { forceStock: true, isRetrocession: hook.isRetrocession })}
      />

      {/* Substitution Modal */}
      <Suspense fallback={null}>
      <SubstitutionModal
        produitId={hook.substitutionProduct?.id ?? null}
        produitName={hook.substitutionProduct?.name ?? ''}
        onSelect={(substitut) => {
          hook.cart.addProduit(substitut, { isRetrocession: hook.isRetrocession })
          hook.setSubstitutionProduct(null)
        }}
        onClose={() => hook.setSubstitutionProduct(null)}
      />
      </Suspense>

      {/* Open Point-of-Sale Modal */}
      <Suspense fallback={null}>
      <OpenPointDeVenteModal
        isOpen={showOpenPosteModal}
        onClose={() => setShowOpenPosteModal(false)}
        onSessionOpened={() => {
          // Le contexte PosteCaisseMode active automatiquement le mode point de vente
        }}
      />
      </Suspense>
    </>
  )
}
