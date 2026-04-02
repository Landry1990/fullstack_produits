import { Eye, EyeOff, Moon, Sun } from 'lucide-react'
import { formatCurrency } from '../utils/formatters'
import { formatDateShort } from '../utils/dateUtils'
import PaymentModal from './facturation/PaymentModal'
import OrdonnanceModal from './OrdonnanceModal'
import LotSelectionModal from './LotSelectionModal'
import TotalsSection from './facturation/TotalsSection'
import ActionButtons from './facturation/ActionButtons'
import CartTable from './facturation/CartTable'
import ProductSearchSection from './facturation/ProductSearchSection'
import ClientSection from './facturation/ClientSection'
import ClinicalAlerts from './clinical/ClinicalAlerts'
import ClientCreateModal from './facturation/ClientCreateModal'
import PendingSalesDrawer from './facturation/PendingSalesDrawer'
import TicketPreviewModal from './facturation/TicketPreviewModal'
import SudoValidationModal from './common/SudoValidationModal'
import PremiumModal from './common/PremiumModal'
import { ClientNameModal } from './sales/modals/ClientNameModal'
import { StockResolutionHandler } from './facturation/StockResolutionHandler'
import FacturationNotifications from './facturation/FacturationNotifications'
import AlertMessageModal from './facturation/AlertMessageModal'
import DisplayAlertModal from './facturation/DisplayAlertModal'

import { useFacturationState } from '../hooks/useFacturationState'

export default function Facturation() {
  const hook = useFacturationState()

  return (
    <div className="h-full flex flex-col bg-base-100 font-sans text-base-content overflow-hidden">
      {/* Header Minimaliste */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-base-200 bg-base-100 shrink-0 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2 sm:gap-4">
          <h1 className="text-lg sm:text-2xl font-bold text-base-content uppercase tracking-tight truncate max-w-[120px] sm:max-w-none">{hook.t('facturation:title')}</h1>
          
          <div className="flex items-center gap-1 sm:gap-2 border-l border-base-200  pl-2 sm:pl-4 ml-1 sm:ml-2">
            {/* Zenith Mode Toggle */}
            <button 
                onClick={hook.toggleZenithMode}
                className={`btn btn-circle btn-sm ${hook.isZenithMode ? 'btn-primary' : 'btn-ghost'}`}
                title={hook.isZenithMode ? "Quitter Mode Zenith" : "Mode Zenith (Alt+Z)"}
            >
                {hook.isZenithMode ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>

            {/* Midnight Theme Toggle */}
            <button 
                onClick={hook.toggleMidnightTheme}
                className={`btn btn-circle btn-sm ${hook.isMidnightTheme ? 'btn-secondary text-white' : 'btn-ghost'}`}
                title={hook.isMidnightTheme ? "Thème Clair" : "Thème Midnight"}
            >
                {hook.isMidnightTheme ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Ventes en Attente Badge */}
            {hook.ventesEnAttente.length > 0 && (
                <button 
                    onClick={() => hook.setShowPendingSales(true)}
                    className="btn btn-sm btn-warning gap-1 animate-bounce-subtle ml-2 px-3 shadow-lg hover:shadow-warning/20 border-none text-warning-content font-bold"
                    title={hook.t('facturation:actions.view_pending_tooltip')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-xs">{hook.ventesEnAttente.length}</span>
                    <span className="hidden md:inline uppercase text-[10px] tracking-widest">{hook.t('facturation:actions.pending')}</span>
                    <kbd className="kbd kbd-xs bg-warning-focus border-none text-warning-content opacity-50">F8</kbd>
                </button>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <div className="text-[10px] sm:text-sm font-medium text-base-content/60">
            {formatDateShort(new Date())}
          </div>
          <div className="flex gap-2 sm:gap-4 text-[8px] sm:text-[10px] text-base-content/40 mt-1 uppercase font-bold tracking-tight">
            <span className="flex items-center gap-0.5 sm:gap-1"><kbd className="kbd kbd-xs py-0 h-3 sm:h-4 font-sans">/</kbd> <span className="hidden xs:inline">{hook.t('facturation:shortcuts.search')}</span></span>
            <span className="flex items-center gap-0.5 sm:gap-1"><kbd className="kbd kbd-xs py-0 h-3 sm:h-4 font-sans">F9</kbd> <span className="hidden xs:inline">{hook.t('facturation:shortcuts.pay')}</span></span>
          </div>
        </div>
      </div>

      {/* Modification Mode Banner */}
      {hook.isModificationMode && hook.modificationInvoiceId && (
        <div className="alert alert-warning shadow-lg mx-3 md:mx-4 lg:mx-6 mt-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <h3 className="font-bold">{hook.t('facturation:modification_mode.title')}</h3>
            <div className="text-xs flex flex-wrap gap-4">
              <span>{hook.t('facturation:modification_mode.original_total')}: <strong>{formatCurrency(Math.round(hook.originalTotalTtc))}</strong></span>
              <span>{hook.t('facturation:modification_mode.new_total')}: <strong>{formatCurrency(Math.round(hook.totals.totalTtc))}</strong></span>
              {hook.totals.totalTtc !== hook.originalTotalTtc && (
                <span className={hook.totals.totalTtc > hook.originalTotalTtc ? 'text-success font-bold' : 'text-error font-bold'}>
                  {hook.t('facturation:modification_mode.difference')}: {hook.totals.totalTtc > hook.originalTotalTtc ? '+' : ''}{formatCurrency(Math.round(hook.totals.totalTtc - hook.originalTotalTtc))}
                  {hook.totals.totalTtc > hook.originalTotalTtc ? ` (${hook.t('facturation:modification_mode.to_collect')})` : ` (${hook.t('facturation:modification_mode.to_refund')})`}
                </span>
              )}
            </div>
          </div>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              hook.setIsModificationMode(false)
              hook.setModificationInvoiceId(null)
              hook.setOriginalTotalTtc(0)
              hook.setLignesFacture([])
            }}
          >
            {hook.t('common:cancel')}
          </button>
        </div>
      )}

      {/* Notifications */}
      <FacturationNotifications
        error={hook.error}
        setError={hook.setError}
        successInfo={hook.successInfo}
        setSuccessInfo={hook.setSuccessInfo}
        onOpenPaymentModal={hook.ouvrirModalPaiement}
        onShowTicket={() => hook.setShowTicketPreview(true)}
        onPrintA4={hook.handleImprimerFacture}
        ticketCaisse={hook.ticketCaisse}
      />

      {/* Main Layout */}
      <div className="flex-1 flex flex-col overflow-y-auto sm:overflow-hidden p-2 sm:p-4 lg:p-6 gap-3 sm:gap-4 lg:gap-6">
        {/* Top Section: Client & Search */}
        <div className="w-full flex flex-col md:flex-row gap-4 shrink-0">
          {/* Client Selection */}
          <ClientSection
            inputRef={hook.clientSearchRef}
            clients={hook.clientsHook.clients}
            filteredClients={hook.clientsHook.filteredClients}
            useManualClient={hook.clientsHook.useManualClient}
            setUseManualClient={hook.clientsHook.setUseManualClient}
            manualClientName={hook.clientsHook.manualClientName}
            setManualClientName={hook.clientsHook.setManualClientName}
            selectedClient={hook.clientsHook.selectedClient}
            setSelectedClient={hook.clientsHook.setSelectedClient}
            clientSearch={hook.clientsHook.clientSearch}
            setClientSearch={hook.clientsHook.setClientSearch}
            showClientDropdown={hook.clientsHook.showClientDropdown}
            setShowClientDropdown={hook.clientsHook.setShowClientDropdown}
            onOpenCreateClient={(initialName) => {
              hook.clientsHook.setNewClientForm(prev => ({ ...prev, name: initialName }))
              hook.clientsHook.setShowClientCreateModal(true)
            }}
            ayantsDroitList={hook.clientsHook.ayantsDroitList}
            selectedAyantDroit={hook.clientsHook.selectedAyantDroit}
            setSelectedAyantDroit={hook.clientsHook.setSelectedAyantDroit}
            showNewAyantDroit={hook.clientsHook.showNewAyantDroit}
            setShowNewAyantDroit={hook.clientsHook.setShowNewAyantDroit}
            ayantDroitNom={hook.clientsHook.ayantDroitNom}
            setAyantDroitNom={hook.clientsHook.setAyantDroitNom}
            ayantDroitMatricule={hook.clientsHook.ayantDroitMatricule}
            setAyantDroitMatricule={hook.clientsHook.setAyantDroitMatricule}
            ayantDroitSociete={hook.clientsHook.ayantDroitSociete}
            setAyantDroitSociete={hook.clientsHook.setAyantDroitSociete}
            onEnter={() => hook.searchInputRef.current?.focus()}
          />

          {/* Product Search */}
          <ProductSearchSection
            searchQuery={hook.productSearch.searchQuery}
            setSearchQuery={hook.productSearch.setSearchQuery}
            searchLoading={hook.productSearch.loading}
            filteredProduits={hook.productSearch.produits}
            addProduitToFacture={(p) => hook.cart.addProduit(p, { isRetrocession: hook.isRetrocession })}
            addPackToFacture={hook.addPackToFacture}
            searchInputRef={hook.searchInputRef}
            placeholder={hook.t('facturation:search.placeholder')}
            onQuantityShortcut={hook.handleQuantityShortcut}
            onCsvImport={hook.handleCsvImport}
          />
        </div>

        {/* Bottom Section: Cart/Invoice Details */}
        <div className="flex-none sm:flex-1 flex flex-col min-h-[400px] sm:min-h-0 bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden shrink-0 sm:shrink">
          
          {/* Clinical Alerts Banner */}
          <ClinicalAlerts alerts={hook.clinicalAlerts} />

          <div className="p-4 border-b border-base-100 flex justify-between items-center shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <h2 className="font-bold text-lg text-base-content">{hook.t('facturation:cart.title')}</h2>
              <div className="badge badge-ghost font-mono">{hook.lignesFacture.length} {hook.t('facturation:cart.items_count', { count: hook.lignesFacture.length })}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-base-content/60 font-medium">Trier par:</span>
              <select 
                className="select select-bordered select-sm text-xs" 
                value={hook.sortBy} 
                onChange={(e) => hook.setSortBy(e.target.value as any)}
                disabled={hook.lignesFacture.length === 0}
              >
                <option value="chrono">Chronologie</option>
                <option value="stock">Qté en stock</option>
                <option value="name">Nom</option>
                <option value="qty">Qté saisie</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <CartTable
              lignesFacture={hook.sortedLignes}
              updateQuantite={hook.secureUpdateQuantite}
              updatePrix={hook.secureUpdatePrix}
              updateRemiseProduit={hook.secureUpdateRemiseProduit}
              removeLigne={hook.removeLigne}
              onOpenLotModal={(product, currentLotId) => hook.ui.openLotModal(product, currentLotId || null)}
              quantityInputsRef={hook.quantityInputsRef}
              onReturnFocus={() => hook.searchInputRef.current?.focus()}
              selectedIndex={hook.keyboardNav.selectedIndex}
              onSelectLine={hook.keyboardNav.setSelectedIndex}
            />
          </div>

          {/* Footer Totals */}
          <TotalsSection
            totalHT={hook.totals.totalHt}
            remiseGlobale={hook.ui.remiseGlobale}
            setRemiseGlobale={hook.ui.setRemiseGlobale}
            remiseMode={hook.ui.remiseMode}
            setRemiseMode={hook.ui.setRemiseMode}
            remiseMontant={hook.totals.remiseMontant}
            tvaAmount={hook.totals.totalTva}
            totalTTC={hook.totals.totalTtc}
            tauxCouverture={hook.totals.tauxCouverture}
            partAssurance={hook.totals.partAssurance}
            partPatient={hook.totals.partPatient}
            onOpenOrdonnanceModal={() => hook.setShowOrdonnanceModal(true)}
            ordonnanceData={hook.tempOrdonnanceData}
          />

          {/* Action Buttons */}
          <ActionButtons
            onPayment={hook.handlePaymentClick}
            onProforma={hook.handleProforma}
            onBonDeLivraison={hook.handleBonDeLivraison}
            onSuspend={hook.mettreEnAttente}
            onCancel={hook.annulerVente}
            isValid={hook.lignesFacture.length > 0}
            isRetrocession={hook.isRetrocession}
            setIsRetrocession={hook.setIsRetrocession}
            isFactureA4={hook.isFactureA4}
            setIsFactureA4={hook.setIsFactureA4}
            loading={hook.loading}
          />
        </div>
      </div>

      {hook.ui.isPaymentModalOpen && (
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
                    tempOrdonnanceData: hook.tempOrdonnanceData
                 })
             }
          }}
          selectedClient={hook.clientsHook.selectedClient}
          useManualClient={hook.clientsHook.useManualClient}
          paymentInputRef={hook.paymentInputRef}
        />
      )}

      {/* Ticket Preview Modal */}
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

      {/* Stock Resolution Handler */}
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
        setLignesFacture={hook.setLignesFacture as any}
        clients={hook.clientsHook.clients}
        selectedClient={hook.clientsHook.selectedClient}
        setSelectedClient={hook.clientsHook.setSelectedClient}
        useManualClient={hook.clientsHook.useManualClient}
        setUseManualClient={hook.clientsHook.setUseManualClient}
        setManualClientName={hook.clientsHook.setManualClientName}
        onComplete={hook.handlePaymentClickWithSudo}
        requireSudo={hook.requireSudo}
      />

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
        icon={<span className="text-warning text-xl">⚠️</span>}
        gradientFrom="warning/10"
        gradientTo="warning/5"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn" onClick={() => hook.setConfirmModal(null)}>
              {hook.t('common:cancel', { defaultValue: 'Annuler' })}
            </button>
            <button
              className="btn btn-error"
              onClick={() => {
                if (hook.confirmModal?.onConfirm) hook.confirmModal.onConfirm();
                hook.setConfirmModal(null);
              }}
            >
              {hook.t('common:confirm', { defaultValue: 'Confirmer' })}
            </button>
          </div>
        }
      >
        <div className="p-6">
          <p className="text-base-content/80 text-lg">{hook.confirmModal?.message}</p>
        </div>
      </PremiumModal>

      {/* Lot Selection Modal */}
      {hook.lotModal.isOpen && (
        <LotSelectionModal
          isOpen={hook.lotModal.isOpen}
          onClose={hook.closeLotModal}
          produit={hook.lotModal.product}
          onSelectLot={hook.handleLotSelect}
          currentLotId={hook.lotModal.currentLotId}
        />
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
        title="Raccourcis Clavier - Pharmacie"
        icon={<span className="text-primary text-xl">⌨️</span>}
        gradientFrom="primary/10"
        gradientTo="primary/5"
      >
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-bold text-primary border-b border-primary/20 pb-1 mb-2">Navigation & Recherche</h3>
              <div className="flex justify-between items-center text-sm">
                <span>Recherche Produit</span>
                <kbd className="kbd kbd-sm font-sans">F2</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Focus Recherche (si non-input)</span>
                <kbd className="kbd kbd-sm font-sans">/</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Recherche Client / Focus Quantité</span>
                <kbd className="kbd kbd-sm font-sans">F4</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Recherche Client (direct)</span>
                <kbd className="kbd kbd-sm font-sans">Ctrl + F</kbd>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-bold text-secondary border-b border-secondary/20 pb-1 mb-2">Actions Vente</h3>
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-success">Payer / Encaisser</span>
                <kbd className="kbd kbd-sm font-sans">F9</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-warning">Suspendre (Mettre en attente)</span>
                <kbd className="kbd kbd-sm font-sans">Ctrl + S / F7</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-warning-focus">Rappeler Vente en attente</span>
                <kbd className="kbd kbd-sm font-sans">F8</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Mode Zenith (Plein écran)</span>
                <kbd className="kbd kbd-sm font-sans">Alt + Z</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Fermer / Annuler</span>
                <kbd className="kbd kbd-sm font-sans">Esc</kbd>
              </div>
            </div>
          </div>
          <div className="mt-6 p-3 bg-base-200 rounded-lg text-xs text-center text-base-content/60 italic">
            Astuce : Utilisez les touches fléchées pour naviguer dans les résultats de recherche et la touche Entrée pour valider.
          </div>
        </div>
      </PremiumModal>

      {/* Sudo Validation Modal */}
      <SudoValidationModal
        isOpen={hook.sudoState.isOpen}
        onClose={hook.closeSudo}
        onValidate={hook.sudoState.onValidate}
        saving={false}
        title={hook.sudoState.title || "Validation Requise"}
        message={hook.sudoState.message || ""}
        className="z-[9999]"
      />

      <AlertMessageModal
         isOpen={hook.ui.isAlertModalOpen}
         onClose={() => hook.ui.setIsAlertModalOpen(false)}
         target={hook.ui.alertTarget}
         onSuccess={(newTarget) => {
             hook.ui.setAlertTarget(newTarget);
             // Update the current state objects so it reflects immediately
             if (newTarget?.type === 'product') {
                const refreshedLignes = hook.cart.lignesFacture.map((l: any) => {
                   if (l.produit.id === newTarget.id) {
                      return { ...l, produit: { ...l.produit, message_alerte: newTarget.currentMessage }};
                   }
                   return l;
                });
                hook.cart.setLignesFacture(refreshedLignes);
             } else if (newTarget?.type === 'client') {
                // To keep it simple, we don't force a full refetch here directly
                // Next search/reload will pick it up
             }
             setTimeout(() => hook.searchInputRef.current?.focus(), 100);
         }}
      />

      {hook.ui.displayAlertQueue.length > 0 && (
          <DisplayAlertModal
             alerts={hook.ui.displayAlertQueue}
             onAcknowledge={() => {
                 hook.ui.popDisplayAlert();
                 setTimeout(() => hook.searchInputRef.current?.focus(), 100);
             }}
          />
      )}
    </div>
  )
}

