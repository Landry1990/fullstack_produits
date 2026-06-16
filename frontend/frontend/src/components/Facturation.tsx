import { useRef, useEffect } from 'react'
import { Eye, EyeOff, Moon, Sun, FileText, ShoppingCart, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../utils/formatters'
import { formatDateShort } from '../utils/dateUtils'
import { Button } from './shadcn/button'
import { Badge } from './shadcn/badge'
import { cn } from '../lib/utils'
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
import { SubstitutionModal } from './SubstitutionModal'
import AlertMessageModal from './facturation/AlertMessageModal'
import DisplayAlertModal from './facturation/DisplayAlertModal'
import PrescriptionScannerModal from './facturation/PrescriptionScannerModal'

import { useFacturationState } from '../hooks/useFacturationState'

export default function Facturation() {
  const hook = useFacturationState()
  const forceStockModalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hook.forceStockProduct && forceStockModalRef.current) {
      const primaryBtn = forceStockModalRef.current.querySelector('.btn-primary') as HTMLButtonElement | null
      primaryBtn?.focus()
    }
  }, [hook.forceStockProduct])

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden">

      {/* ── HEADER SHADCN ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-white shrink-0 shadow-sm">

        {/* Left */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl shrink-0">
            <FileText className="size-5" />
          </div>
          <h1 className="text-base font-bold text-slate-900 uppercase tracking-wider truncate">{hook.t('facturation:title')}</h1>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-3 ml-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={hook.toggleZenithMode}
              className={cn(
                "size-8 rounded-lg transition-all",
                hook.isZenithMode
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              )}
            >
              {hook.isZenithMode ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={hook.toggleMidnightTheme}
              className={cn(
                "size-8 rounded-lg transition-all",
                hook.isMidnightTheme
                  ? 'bg-slate-800 text-amber-400 hover:bg-slate-900'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              )}
            >
              {hook.isMidnightTheme ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          </div>

          {hook.ventesEnAttente.length > 0 && (
            <Button
              onClick={() => hook.setShowPendingSales(true)}
              variant="default"
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-amber-500/20 animate-pulse h-8"
            >
              <ShoppingCart className="size-3.5" />
              <span className="font-bold">{hook.ventesEnAttente.length}</span>
              <span className="hidden sm:inline uppercase text-[10px] tracking-wider">{hook.t('facturation:actions.pending')}</span>
            </Button>
          )}
        </div>

        {/* Right: date + shortcuts */}
        <div className="flex flex-col items-end shrink-0">
          <span className="text-xs font-medium text-slate-500">{formatDateShort(new Date())}</span>
          <div className="hidden sm:flex gap-3 text-[10px] text-slate-400 mt-0.5 uppercase font-semibold tracking-wider">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono text-[9px]">/</kbd> {hook.t('facturation:shortcuts.search')}</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono text-[9px]">F9</kbd> {hook.t('facturation:shortcuts.pay')}</span>
          </div>
        </div>
      </div>

      {/* ── BANNIÈRE MODE MODIFICATION SHADCN ── */}
      {hook.isModificationMode && hook.modificationInvoiceId && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200 shrink-0">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shrink-0">
            <AlertTriangle className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">{hook.t('facturation:modification_mode.title')}</p>
            <div className="flex flex-wrap gap-3 text-[11px] text-amber-700 mt-0.5">
              <span>{hook.t('facturation:modification_mode.original_total')}: <strong className="font-semibold">{formatCurrency(Math.round(hook.originalTotalTtc))}</strong></span>
              <span>{hook.t('facturation:modification_mode.new_total')}: <strong className="font-semibold">{formatCurrency(Math.round(hook.totals.totalTtc))}</strong></span>
              {hook.totals.totalTtc !== hook.originalTotalTtc && (
                <Badge variant={hook.totals.totalTtc > hook.originalTotalTtc ? 'default' : 'destructive'} className="text-[10px] h-5">
                  {hook.totals.totalTtc > hook.originalTotalTtc ? '+' : ''}{formatCurrency(Math.round(hook.totals.totalTtc - hook.originalTotalTtc))}
                  {hook.totals.totalTtc > hook.originalTotalTtc ? ` (${hook.t('facturation:modification_mode.to_collect')})` : ` (${hook.t('facturation:modification_mode.to_refund')})`}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-700 hover:text-amber-800 hover:bg-amber-100 shrink-0"
            onClick={() => {
              hook.setIsModificationMode(false)
              hook.setModificationInvoiceId(null)
              hook.setOriginalTotalTtc(0)
              hook.setLignesFacture([])
            }}
          >
            {hook.t('common:cancel')}
          </Button>
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
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

      {/* ── MAIN LAYOUT ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

        {/* LEFT : Recherche & Client */}
        <div className="shrink-0 lg:flex-1 flex flex-col overflow-y-auto pos-discovery p-4 sm:p-5 lg:p-6 gap-4 min-h-0 bg-slate-50">

          <div className="w-full flex flex-col gap-4 shrink-0">
            {/* Client */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1 relative z-20">
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
                onApplyReward={hook.applyLoyaltyReward}
              />
            </div>

            {/* Produit */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1 relative z-10">
              <ProductSearchSection
                searchQuery={hook.productSearch.searchQuery}
                setSearchQuery={hook.productSearch.setSearchQuery}
                searchLoading={hook.productSearch.loading}
                filteredProduits={hook.productSearch.produits}
                addProduitToFacture={(p) => hook.cart.addProduit(p, { isRetrocession: hook.isRetrocession, markupPercentage: (hook as any).currentMarkup })}
                addPackToFacture={hook.addPackToFacture}
                searchInputRef={hook.searchInputRef}
                placeholder={hook.t('facturation:search.placeholder')}
                onQuantityShortcut={hook.handleQuantityShortcut}
                onCsvImport={hook.handleCsvImport}
              />
            </div>
          </div>

          {/* Zone vide — raccourcis */}
          <div className="flex-1 hidden lg:flex flex-col justify-center items-center text-slate-300 hover:opacity-70 transition-opacity duration-500">
            <div className="w-full max-w-xs rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center gap-5 text-center bg-white/50">
              <div className="size-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">{hook.t('pos.ready_for_sale')}</p>
                <p className="text-[10px] text-slate-400">{hook.t('pos.scan_or_search')}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full">
                {[['F9',hook.t('facturation.shortcuts.validate')],['ENTRÉE',hook.t('facturation.shortcuts.search_enter')],['ESC',hook.t('facturation.shortcuts.cancel')],['F8',hook.t('facturation.shortcuts.pending')]].map(([k,v]) => (
                  <div key={k} className="bg-slate-100 rounded-xl p-2 flex flex-col items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white rounded text-slate-600 font-mono text-[9px] font-bold shadow-sm">{k}</kbd>
                    <span className="text-[9px] uppercase font-semibold text-slate-400">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT : Panier */}
        <aside className="w-full lg:w-[400px] xl:w-[440px] pos-checkout flex flex-col z-10 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-hidden flex-1 lg:flex-none lg:min-h-0 lg:h-full bg-white">

          {/* Panier header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
            <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2 uppercase tracking-wider">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {hook.t('facturation:cart.title')}
            </h2>
            <Badge variant={hook.lignesFacture.length > 0 ? 'default' : 'secondary'} className="h-5 text-xs">
              {hook.lignesFacture.length}
            </Badge>
          </div>

          {/* Alertes cliniques */}
          <ClinicalAlerts alerts={hook.clinicalAlerts} />

          {/* Items panier - scroll area flexible */}
          <div className="flex-1 overflow-y-auto pos-sidebar-scroll min-h-0">
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

          {/* Totaux + actions - FIXE EN BAS */}
          <div className="shrink-0 p-4 border-t border-slate-200 bg-slate-50">
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
            <div className="mt-3">
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
                onScanOrdonnance={() => hook.ui.setIsScannerModalOpen(true)}
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
        title={hook.t('pos.keyboard_shortcuts')}
        icon={<span className="text-primary text-xl">⌨️</span>}
        gradientFrom="primary/10"
        gradientTo="primary/5"
      >
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-bold text-primary border-b border-primary/20 pb-1 mb-2">{hook.t('pos.navigation_search')}</h3>
              <div className="flex justify-between items-center text-sm">
                <span>{hook.t('pos.search_product')}</span>
                <kbd className="kbd kbd-sm font-sans">F2</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>{hook.t('pos.focus_search')}</span>
                <kbd className="kbd kbd-sm font-sans">/</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>{hook.t('pos.search_client_qty')}</span>
                <kbd className="kbd kbd-sm font-sans">F4</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>{hook.t('pos.search_client_direct')}</span>
                <kbd className="kbd kbd-sm font-sans">Ctrl + F</kbd>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-bold text-secondary border-b border-secondary/20 pb-1 mb-2">{hook.t('pos.sales_actions')}</h3>
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-success">{hook.t('pos.pay_cash')}</span>
                <kbd className="kbd kbd-sm font-sans">F9</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-warning">{hook.t('pos.suspend_hold')}</span>
                <kbd className="kbd kbd-sm font-sans">Ctrl + S / F7</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-warning-focus">{hook.t('pos.recall_sale')}</span>
                <kbd className="kbd kbd-sm font-sans">F8</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>{hook.t('pos.zenith_mode')}</span>
                <kbd className="kbd kbd-sm font-sans">Alt + Z</kbd>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>{hook.t('pos.close_cancel')}</span>
                <kbd className="kbd kbd-sm font-sans">Esc</kbd>
              </div>
            </div>
          </div>
          <div className="mt-6 p-3 bg-base-200 rounded-lg text-xs text-center text-base-content/60 italic">
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

      {/* Prescription Scanner Modal */}
      <PrescriptionScannerModal 
        isOpen={hook.ui.isScannerModalOpen}
        onClose={() => hook.ui.setIsScannerModalOpen(false)}
        onAddProducts={(products) => {
          products.forEach(p => hook.cart.addProduit(p, { isRetrocession: hook.isRetrocession }));
        }}
        onExtractionDone={(data) => {
          // Pre-fill Ordonnance Data
          hook.ui.setTempOrdonnanceData({
            patient_nom: data.patient_nom || '',
            prescripteur_nom: data.prescripteur_nom || '',
            lignes: [] // Will be populated by the cart
          });
          
          if (data.imageFile) {
            hook.ui.setPrescriptionImage(data.imageFile);
          }
        }}
      />

      {/* Force Stock Modal */}
      {hook.forceStockProduct && (
        <div
          ref={forceStockModalRef}
          className="modal modal-open z-50"
          onKeyDown={(e) => {
            const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('.modal-action button')
            if (!buttons.length) return
            const current = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement)
            if (e.key === 'ArrowRight') {
              e.preventDefault()
              const next = current >= 0 ? (current + 1) % buttons.length : 0
              buttons[next].focus()
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              const prev = current >= 0 ? (current - 1 + buttons.length) % buttons.length : buttons.length - 1
              buttons[prev].focus()
            } else if (e.key === 'Enter' && current >= 0) {
              e.preventDefault()
              buttons[current].click()
            }
          }}
        >
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-2">
              {hook.t('common:force_stock.title', { produit: hook.forceStockProduct.name, defaultValue: `Stock insuffisant — ${hook.forceStockProduct.name}` })}
            </h3>
            <p className="text-sm text-base-content/70 mb-4">
              {hook.t('common:force_stock.message', { stock: hook.forceStockProduct.stock, defaultValue: `Ce produit a un stock de ${hook.forceStockProduct.stock}. Souhaitez-vous forcer la vente malgré tout ?` })}
            </p>
            <div className="modal-action flex gap-2 justify-end">
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const p = hook.forceStockProduct
                hook.setForceStockProduct(null)
                if (p) hook.setSubstitutionProduct(p)
              }}>
                {hook.t('common:force_stock.substitute', { defaultValue: 'Voir les substituts' })}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => {
                const p = hook.forceStockProduct
                hook.setForceStockProduct(null)
                if (p) hook.cart.addProduit(p, { forceStock: true, isRetrocession: hook.isRetrocession })
              }}>
                {hook.t('common:force_stock.force', { defaultValue: 'Forcer la vente' })}
              </button>
              <button className="btn btn-sm" onClick={() => hook.setForceStockProduct(null)}>
                {hook.t('common:force_stock.cancel', { defaultValue: 'Annuler' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Substitution Modal */}
      <SubstitutionModal
        produitId={hook.substitutionProduct?.id ?? null}
        produitName={hook.substitutionProduct?.name ?? ''}
        onSelect={(substitut) => {
          hook.cart.addProduit(substitut, { isRetrocession: hook.isRetrocession })
          hook.setSubstitutionProduct(null)
        }}
        onClose={() => hook.setSubstitutionProduct(null)}
      />
    </div>
  )
}

