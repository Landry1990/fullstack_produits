import { useTranslation } from 'react-i18next'
import { gooeyToast } from 'goey-toast'
import { Package, Upload, RefreshCw } from 'lucide-react'

import type { ProduitModel } from '../types'
import type { Groupe } from '../types/catalog'
import { cn } from '../lib/utils'
import { useProduitPage } from '../hooks/useProduitPage'
import type { ActiveTab } from '../hooks/useProduitPage'

import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { ErrorState } from './ui/ErrorState'
import { ProductListPanel } from './products/ProductListPanel'
import { ProductDetailHeader } from './products/ProductDetailHeader'
import { ProduitPageModals } from './products/ProduitPageModals'
import { ProductTabsContent } from './products/ProductTabsContent'
import { QuantityInputDialog } from './products/modals/QuantityInputDialog'

/* ------------------------------------------------------------------ */
/*  Component — orchestrateur : layout + composition                    */
/*  État/logique : hooks/useProduitPage.ts                              */
/* ------------------------------------------------------------------ */
export default function ProduitShadcn() {
  const { t } = useTranslation(['products', 'common'])
  const state = useProduitPage()
  const {
    page, setPage,
    produits, totalCount, totalPages, isLoading, error, refetch,
    lots, monthlyStats, achats, stockHistory, loadingHistory,
    rayons, fournisseurs, formes, groupes,
    searchQuery, setSearchQuery,
    filterRayon, setFilterRayon,
    filterForme, setFilterForme,
    showInactive, setShowInactive,
    showInStockOnly, setShowInStockOnly,
    resetFilters,
    selectedProduit, setSelectedProduit,
    activeTab, setActiveTab,
    lowStockCount, outOfStockCount,
    isCreateOpen, setIsCreateOpen,
    isEditOpen, setIsEditOpen,
    isAdjustOpen, setIsAdjustOpen,
    isPasswordOpen, setIsPasswordOpen, passwordConfig, setPasswordConfig,
    isImportOpen, setIsImportOpen,
    showSalesModal, setShowSalesModal, selectedFacture, setSelectedFacture, loadingFacture,
    showAvoirModal, setShowAvoirModal, selectedAvoirId, setSelectedAvoirId,
    pendingActionRef,
    editForm, adjustForm, setAdjustForm, adjustStockMutation, transferLoading,
    labelProduct, setLabelProduct, transferProduct, setTransferProduct,
    handleDelete, handleStockAdjustmentSubmit, handleOpenAdjust,
    handleToggleActive, handleGenerateLabels, confirmGenerateLabels,
    handleTransferToRayon, confirmTransferToRayon,
    handleMovementClick, handleOpenEdit,
    queryClient,
  } = state

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">

      {/* ── Header ── */}
      <header className="px-6 py-4 border-b border-slate-200 bg-white shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-xl">
            <Package className="size-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{t('products:title', { defaultValue: 'Gestion des produits' })}</h1>
            <p className="text-xs text-slate-400 font-medium">{t('products:subtitle', { defaultValue: 'Créez et gérez vos produits et services' })}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading} leftIcon={isLoading ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}>
            {t('common:actions.refresh', { defaultValue: 'Rafraîchir' })}
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Package className="size-4" />} onClick={() => setIsCreateOpen(true)}>
            {t('products:actions.new', { defaultValue: 'Nouveau' })}
          </Button>
          <Button variant="outline" size="sm" leftIcon={<Upload className="size-4" />} onClick={() => {
            setPasswordConfig({
              title: t('products:messages.password_confirm_import_title', { defaultValue: 'Confirmation requise' }),
              message: t('products:messages.password_confirm_import_body', { defaultValue: 'Veuillez saisir votre mot de passe pour importer des produits.' })
            })
            pendingActionRef.current = async () => { setIsImportOpen(true) }
            setIsPasswordOpen(true)
          }}>
            {t('products:import.title', { defaultValue: 'Importer' })}
          </Button>
        </div>
      </header>

      {/* ── Error Banner ── */}
      <ErrorState error={error} onRetry={() => refetch()} retrying={isLoading} className="mx-6 mt-4" />

      {/* ── Main Content ── */}
      <main className="flex-1 p-4 min-h-0 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full min-h-0 w-full overflow-hidden">

          {/* ═════ Left Panel : List ═════ */}
          <section className={cn('lg:col-span-5 flex flex-col h-full min-h-0 min-w-0 gap-3', selectedProduit && 'max-lg:hidden')}>
            <ProductListPanel
              produits={produits}
              isLoading={isLoading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              showInStockOnly={showInStockOnly}
              onShowInStockOnlyChange={setShowInStockOnly}
              showInactive={showInactive}
              onShowInactiveChange={setShowInactive}
              filterRayon={filterRayon}
              onFilterRayonChange={setFilterRayon}
              filterForme={filterForme}
              onFilterFormeChange={setFilterForme}
              rayons={rayons}
              formes={formes}
              hasActiveFilters={Boolean(filterRayon || filterForme || showInactive || showInStockOnly)}
              hasFilterRayon={Boolean(filterRayon)}
              hasFilterForme={Boolean(filterForme)}
              onResetFilters={resetFilters}
              selectedProduit={selectedProduit}
              onSelectProduit={setSelectedProduit}
              totalCount={totalCount}
              lowStockCount={lowStockCount}
              outOfStockCount={outOfStockCount}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              onNewProduct={() => setIsCreateOpen(true)}
            />
          </section>

          {/* ═════ Right Panel : Details ═════ */}
          <section className={cn('lg:col-span-7 h-full min-h-0 min-w-0', !selectedProduit && 'max-lg:hidden')}>
            <Card variant="default" padding="none" className="h-full flex flex-col overflow-hidden">
              {selectedProduit ? (
                <>
                  <ProductDetailHeader
                    produit={selectedProduit}
                    transferLoading={transferLoading}
                    onBack={() => setSelectedProduit(null)}
                    onOpenAdjust={handleOpenAdjust}
                    onOpenEdit={handleOpenEdit}
                    onTransferToRayon={handleTransferToRayon}
                    onGenerateLabels={handleGenerateLabels}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                  />
                  <ProductTabsContent
                    selectedProduit={selectedProduit}
                    activeTab={activeTab}
                    setActiveTab={(tab) => setActiveTab(tab as ActiveTab)}
                    lots={lots}
                    monthlyStats={monthlyStats}
                    achats={achats}
                    stockHistory={stockHistory}
                    loadingHistory={loadingHistory}
                    onMovementClick={handleMovementClick}
                  />
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                  <Package className="size-16 mb-4 opacity-30" />
                  <p className="text-sm font-medium">{t('products:detail.select_hint')}</p>
                </div>
              )}
            </Card>
          </section>
        </div>
      </main>

      {/* ── Modals ── */}
      <QuantityInputDialog
        open={Boolean(labelProduct)}
        title={t('products:quantity_dialog.labels_title')}
        description={t('products:quantity_dialog.labels_description', { name: labelProduct?.name || '' })}
        initialValue={1}
        onClose={() => setLabelProduct(null)}
        onConfirm={confirmGenerateLabels}
      />
      <QuantityInputDialog
        open={Boolean(transferProduct)}
        title={t('products:quantity_dialog.transfer_title')}
        description={t('products:quantity_dialog.transfer_description', {
          name: transferProduct?.name || '',
          reserve: transferProduct?.stock_reserve ?? 0,
          capacity: transferProduct?.capacite_rayon ?? 0,
        })}
        initialValue={transferProduct ? Math.max(1, Math.min(
          Math.max(0, (transferProduct.capacite_rayon ?? 0) - (transferProduct.stock ?? 0)),
          transferProduct.stock_reserve ?? 0,
        )) : 1}
        max={transferProduct?.stock_reserve ?? undefined}
        loading={transferLoading}
        onClose={() => setTransferProduct(null)}
        onConfirm={confirmTransferToRayon}
      />
      <ProduitPageModals
        isEditOpen={isEditOpen}
        editForm={editForm}
        onEditClose={() => setIsEditOpen(false)}
        onEditSuccess={(updated: ProduitModel) => { setSelectedProduit(updated); setIsEditOpen(false); refetch(); gooeyToast.success(t('products:messages.update_success')); }}
        isAdjustOpen={isAdjustOpen}
        onAdjustClose={() => setIsAdjustOpen(false)}
        selectedProduit={selectedProduit}
        adjustForm={adjustForm}
        setAdjustForm={setAdjustForm}
        onAdjustSubmit={handleStockAdjustmentSubmit}
        isAdjusting={adjustStockMutation.isPending}
        isPasswordOpen={isPasswordOpen}
        onPasswordClose={() => setIsPasswordOpen(false)}
        onPasswordConfirm={() => pendingActionRef.current()}
        passwordTitle={passwordConfig.title}
        passwordMessage={passwordConfig.message}
        isCreateOpen={isCreateOpen}
        onCreateClose={() => setIsCreateOpen(false)}
        onCreated={(produit: ProduitModel) => { refetch(); setIsCreateOpen(false); setSelectedProduit(produit); gooeyToast.success(t('products:messages.create_success_named', { name: produit.name })); }}
        isImportOpen={isImportOpen}
        onImportClose={() => setIsImportOpen(false)}
        onImportSuccess={() => { queryClient.invalidateQueries({ queryKey: ['produits'] }); setIsImportOpen(false); }}
        showSalesModal={showSalesModal}
        onSalesClose={() => { setShowSalesModal(false); setSelectedFacture(null); }}
        selectedFacture={selectedFacture}
        loadingFacture={loadingFacture}
        showAvoirModal={showAvoirModal}
        onAvoirClose={() => { setShowAvoirModal(false); setSelectedAvoirId(null); }}
        selectedAvoirId={selectedAvoirId}
        rayons={rayons}
        fournisseurs={fournisseurs}
        formes={formes}
        groupes={groupes as unknown as Groupe[]}
      />
    </div>
  )
}
