import ClientSection from './ClientSection'
import ProductSearchSection from './ProductSearchSection'
import type { FacturationState } from '../../hooks/useFacturationState'
import type { useDatamatrixScan } from '../../hooks/useDatamatrixScan'

type ScanHook = ReturnType<typeof useDatamatrixScan>

interface FacturationLeftPanelProps {
  hook: FacturationState
  datamatrixEnabled: boolean
  scan: ScanHook
}

export default function FacturationLeftPanel({ hook, datamatrixEnabled, scan }: FacturationLeftPanelProps) {
  return (
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
            addProduitToFacture={(p) => hook.cart.addProduit(p, { isRetrocession: hook.isRetrocession, markupPercentage: hook.currentMarkup })}
            addPackToFacture={hook.addPackToFacture}
            searchInputRef={hook.searchInputRef}
            placeholder={hook.t('facturation:search.placeholder')}
            onQuantityShortcut={hook.handleQuantityShortcut}
            onCsvImport={hook.handleCsvImport}
            user={hook.user}
            scanInput={datamatrixEnabled ? scan.scanInput : undefined}
            scanStatus={datamatrixEnabled ? scan.scanStatus : undefined}
            scanLastScanned={datamatrixEnabled ? scan.lastScanned : undefined}
            onScanChange={datamatrixEnabled ? scan.handleScanChange : undefined}
            onScanKeyDown={datamatrixEnabled ? scan.handleScanKeyDown : undefined}
            onSelectOutOfStock={(p) => {
              hook.requireSudo(
                async () => {
                  hook.cart.addProduit(p, { isRetrocession: hook.isRetrocession, markupPercentage: hook.currentMarkup })
                  hook.productSearch.setSearchQuery('')
                },
                {
                  permission: 'can_sell_negative_stock',
                  title: hook.t('facturation:search.out_of_stock_sudo_title', { defaultValue: 'Vente hors stock' }),
                  message: hook.t('facturation:search.out_of_stock_sudo_message', { name: p.name, stock: p.stock ?? 0, defaultValue: `Le produit "${p.name}" n'a pas de stock disponible (${p.stock ?? 0}). Confirmez votre identité pour forcer la vente.` })
                }
              )
            }}
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
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">{hook.t('sales:pos.ready_for_sale')}</p>
            <p className="text-[10px] text-slate-400">{hook.t('sales:pos.scan_or_search')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full">
            {[['F9',hook.t('facturation:shortcuts.validate')],['ENTRÉE',hook.t('facturation:shortcuts.search_enter')],['ESC',hook.t('facturation:shortcuts.cancel')],['F8',hook.t('facturation:shortcuts.pending')]].map(([k,v]) => (
              <div key={k} className="bg-slate-100 rounded-xl p-2 flex flex-col items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded text-slate-600 font-mono text-[10px] font-bold shadow-sm">{k}</kbd>
                <span className="text-[10px] uppercase font-semibold text-slate-400">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
