import { Badge } from '../shadcn/badge'
import TotalsSection from './TotalsSection'
import ActionButtons from './ActionButtons'
import CartTable from './CartTable'
import ClinicalAlerts from '../clinical/ClinicalAlerts'
import type { FacturationState } from '../../hooks/useFacturationState'

interface FacturationRightPanelProps {
  hook: FacturationState
}

export default function FacturationRightPanel({ hook }: FacturationRightPanelProps) {
  return (
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
          onOpenLotModal={(product, currentLotId, quantity, currentAllocations, lineId) => hook.ui.openLotModal(product, currentLotId || null, quantity, currentAllocations, lineId)}
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
          onRemiseChange={(value, mode, totalTTC, setRemise) =>
            hook.secureSetRemiseGlobale(value, mode, totalTTC, setRemise)
          }
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
  )
}
