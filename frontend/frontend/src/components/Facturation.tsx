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

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT SECTION: Discovery (Search & Client) */}
        <div className="flex-1 flex flex-col overflow-y-auto pos-discovery p-2 sm:p-4 lg:p-6 gap-6">
          
          {/* Top Selection: Client & Search */}
          <div className="w-full flex flex-col gap-6 shrink-0">
            {/* Client Selection (Neutralized Glass Design) */}
            <div className="pos-glass-input-container rounded-2xl relative z-20">
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
            </div>

            {/* Product Search (Neutralized Glass Design) */}
            <div className="pos-glass-input-container rounded-2xl relative z-10">
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
          </div>

          {/* Quick Info & Keyboard Shortcuts (Fills empty space elegantly) */}
          <div className="flex-1 flex flex-col justify-center items-center opacity-30 hover:opacity-100 transition-opacity duration-500 mt-8 mb-4 min-h-[250px]">
            <div className="w-full max-w-md glass-panel rounded-3xl p-6 flex flex-col items-center justify-center gap-6 text-center">
               <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center relative animate-pulse">
                 <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping" style={{ animationDuration: '3s' }}></div>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                 </svg>
               </div>
               
               <div>
                  <h3 className="text-lg font-black tracking-widest text-white mb-1">PRÊT POUR LA VENTE</h3>
                  <p className="text-xs text-white/50 font-medium">Lecteur de code-barres actif. Scannez un article.</p>
               </div>

               <div className="grid grid-cols-2 gap-3 w-full mt-2">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex flex-col items-center gap-1">
                     <span className="kbd kbd-sm bg-base-300/50 border-none text-white font-black text-[10px]">F9</span>
                     <span className="text-[9px] uppercase font-bold text-white/40">Valider Panier</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex flex-col items-center gap-1">
                     <span className="kbd kbd-sm bg-base-300/50 border-none text-white font-black text-[10px]">ENTRÉE</span>
                     <span className="text-[9px] uppercase font-bold text-white/40">Retour Recherche</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex flex-col items-center gap-1">
                     <span className="kbd kbd-sm bg-base-300/50 border-none text-white font-black text-[10px]">ESC</span>
                     <span className="text-[9px] uppercase font-bold text-white/40">Annuler Vente</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex flex-col items-center gap-1">
                     <span className="kbd kbd-sm bg-base-300/50 border-none text-white font-black text-[10px]">F8 / LOT</span>
                     <span className="text-[9px] uppercase font-bold text-white/40">Gestion FEFO</span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* RIGHT SECTION: Checkout Sidebar */}
        <aside className="w-full lg:w-[420px] xl:w-[480px] pos-checkout flex flex-col shadow-2xl z-10 border-l border-white/5 overflow-hidden">
          
          {/* Sidebar Header */}
          <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between shrink-0">
             <h2 className="font-bold text-base text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {hook.t('facturation:cart.title')}
             </h2>
             <div className="badge badge-primary font-mono text-xs">{hook.lignesFacture.length}</div>
          </div>

          {/* Clinical Alerts Banner */}
          <ClinicalAlerts alerts={hook.clinicalAlerts} />

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto pos-sidebar-scroll">
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
              refreshTrigger={hook.refreshTrigger}
              isSidebarStyle={true}
            />
          </div>

          {/* Bottom Checkout Controls (Glass Effect) */}
          <div className="shrink-0 p-4 border-t border-white/10 bg-black/20 backdrop-blur-md">
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
              isSidebarStyle={true}
            />

            <div className="mt-4">
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
                isSidebarStyle={true}
              />
            </div>
          </div>
        </aside>
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
          isMultiCaisse={hook.isMultiCaisse}
          postesCaissesActive={hook.postesCaisses}
          selectedPosteCaisseId={hook.selectedPosteCaisseId}
          setSelectedPosteCaisseId={hook.setSelectedPosteCaisseId}
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
    </div>
  )
}

