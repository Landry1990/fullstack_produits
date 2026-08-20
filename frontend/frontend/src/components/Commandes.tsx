import { useEffect, useState, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCommandesState } from '../hooks/useCommandesState';
import { useCommandesStore } from '../stores/useCommandesStore';
import type { Commande, ProduitModel } from '../types';
import { ShoppingCart, Store, Truck } from 'lucide-react';
import { Button } from './shadcn/button';
import { Badge } from './shadcn/badge';
import { cn } from '../lib/utils';

function scrollMainToTop() {
  const main = document.querySelector('main');
  if (main) main.scrollTop = 0;
}

import CommandeList from './Commandes/CommandeList';
import CommandeForm, { type CommandeFormProps } from './Commandes/CommandeForm';
import CommandeDetails, { type CommandeDetailsProps } from './Commandes/CommandeDetails';

import SudoValidationModal from './common/SudoValidationModal';
import { LoadingScreen } from './common/LoadingScreen';
import { useProduit, useProduitLots, useProduitStats, useProduitAchats, useProduitHistory } from '../hooks/useProduits';

const QuickCreateProductModal = lazy(() => import('./Commandes/QuickCreateProductModal'));
const ProductDetailsModal = lazy(() =>
  import('./products/modals/ProductDetailsModal').then((m) => ({ default: m.ProductDetailsModal }))
);
const SimplePrintLabelsModal = lazy(() => import('./SimplePrintLabelsModal'));
const TransferCommandeModal = lazy(() => import('./Commandes/TransferCommandeModal'));
const MergeCommandesModal = lazy(() => import('./Commandes/MergeCommandesModal'));
const SuggestionCommandeModal = lazy(() => import('./Commandes/SuggestionCommandeModal'));
const ReconditionnementModal = lazy(() => import('./Commandes/ReconditionnementModal'));

interface CommandesProps {
    forcedType?: 'LOC' | 'DIR' | 'DIV';
}

export default function Commandes({ forcedType }: CommandesProps) {
  const hook = useCommandesState(forcedType);
  const { state, listProps, detailsProps, formProps, modals, reconditionnement } = hook;
  const queryClient = useQueryClient();
  const setCommandeProduits = useCommandesStore((s) => s.setCommandeProduits);
  const [detailProduitId, setDetailProduitId] = useState<number | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState('general');
  const [editProductId, setEditProductId] = useState<number | null>(null);

  const { data: editProductData } = useProduit(editProductId);
  const { data: detailProduit } = useProduit(detailProduitId);
  const { data: detailLots = [] } = useProduitLots(detailProduitId);
  const { data: detailStats = [] } = useProduitStats(detailProduitId);
  const { data: detailAchats = [] } = useProduitAchats(detailProduitId);
  const { data: detailHistory = [], isLoading: detailHistoryLoading } = useProduitHistory(detailProduitId, detailActiveTab);

  const handleViewProductDetails = (produitId: number) => {
    setDetailProduitId(produitId);
    setDetailActiveTab('general');
  };
  
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const pathname = location.pathname;
    if (location.state?.action === 'NEW_ORDER') {
      listProps.onOpenCreateView();
      navigate(pathname, { replace: true, state: {} });
    } else if (location.state?.action === 'OPEN_SUGGESTIONS') {
      state.setIsSuggestionModalOpen(true);
      navigate(pathname, { replace: true, state: {} });
    } else if (location.state?.selectedCommandeId && listProps.sortedCommandes.length > 0) {
      const cid = location.state.selectedCommandeId;
      const found = listProps.sortedCommandes.find((c: Commande) => c.id === cid);
      if (found) {
        listProps.onViewDetails(found);
        navigate(pathname, { replace: true, state: {} });
      }
    } else if (location.state?.selectedFournisseurId && listProps.sortedCommandes.length > 0) {
      const fid = location.state.selectedFournisseurId;
      // Filtrer les commandes par fournisseur
      const supplierOrders = listProps.sortedCommandes.filter((c: Commande) => c.fournisseur === fid);
      if (supplierOrders.length > 0) {
        listProps.onViewDetails(supplierOrders[0]);
        navigate(pathname, { replace: true, state: {} });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listProps, navigate, state, location.state]);

  useEffect(() => {
    if (state.viewMode !== 'LIST') {
      scrollMainToTop();
    }
  }, [state.viewMode]);
  
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {/* Header moderne */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-lg">
              <ShoppingCart className="size-5 text-emerald-600" />
            </div>
            <h1 className="text-lg font-bold text-slate-800">
                {state.activeTab === 'DIV' ? state.t('orders:title_divers') : state.activeTab === 'DIR' ? state.t('orders:title_direct') : state.t('orders:title_local')}
            </h1>
            <Badge variant="secondary" className="ml-2">
              {listProps.totalCount || 0}
            </Badge>
          </div>

          {!forcedType && (
            <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                <Button
                  variant={state.activeTab === 'LOC' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    "px-5 py-2 rounded-md text-sm font-medium transition-all",
                    state.activeTab === 'LOC' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  )}
                  onClick={() => state.setActiveTab('LOC')}
                >
                  <Store className="size-4 mr-2" />
                  {state.t('orders:tabs.local')}
                </Button>
                <Button
                  variant={state.activeTab === 'DIR' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    "px-5 py-2 rounded-md text-sm font-medium transition-all",
                    state.activeTab === 'DIR' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  )}
                  onClick={() => state.setActiveTab('DIR')}
                >
                  <Truck className="size-4 mr-2" />
                  {state.t('orders:tabs.direct')}
                </Button>
            </div>
          )}
      </div>

      {state.error && (
        <div role="alert" className="mx-4 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm shrink-0">
          {state.error}
        </div>
      )}

      {state.viewMode === 'LIST' && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <CommandeList {...listProps} />
        </div>
      )}

      {state.viewMode === 'DETAILS' && state.selectedCommande && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <CommandeDetails {...(detailsProps as CommandeDetailsProps)} />
        </div>
      )}

      {(state.viewMode === 'CREATE' || state.viewMode === 'EDIT') && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <CommandeForm {...(formProps as CommandeFormProps)} onViewProductDetails={handleViewProductDetails} onEditProduct={(id: number) => setEditProductId(id)} />
        </div>
      )}

      {state.isSuggestionModalOpen && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <SuggestionCommandeModal
            onClose={() => state.setIsSuggestionModalOpen(false)}
            onApply={(products, supplierId) => {
              modals.handleApplySuggestions(products, supplierId);
              state.setIsSuggestionModalOpen(false);
            }}
            fournisseurs={modals.fournisseurs}
            produitsList={modals.produitsList}
          />
        </Suspense>
      )}

      {(state.isCreateProduitModalOpen || (editProductId && editProductData)) && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <QuickCreateProductModal
            open={state.isCreateProduitModalOpen}
            onClose={() => state.setIsCreateProduitModalOpen(false)}
            onCreated={modals.handleProduitCreated}
            rayons={modals.rayons}
          />

          <QuickCreateProductModal
            open={!!editProductId && !!editProductData}
            onClose={() => setEditProductId(null)}
            onCreated={(updatedProduit: ProduitModel) => {
              // Met à jour la ligne de commande concernée sans recharger la page
              setCommandeProduits((prev) =>
                prev.map((line) => {
                  const lineProduitId = line.produit && typeof line.produit === 'object' ? line.produit.id : line.produit;
                  if (lineProduitId !== updatedProduit.id) return line;
                  return {
                    ...line,
                    produit: typeof line.produit === 'object' ? { ...line.produit, ...updatedProduit } : updatedProduit,
                  };
                })
              );
              // Rafraîchit les caches React Query concernés (recherche produit, détails, listes)
              queryClient.setQueryData(['produit', updatedProduit.id], updatedProduit);
              queryClient.invalidateQueries({ queryKey: ['products', 'search'] });
              queryClient.invalidateQueries({ queryKey: ['produits'] });
              setEditProductId(null);
            }}
            rayons={modals.rayons}
            editProduct={editProductData || null}
          />
        </Suspense>
      )}

      {state.showPrintLabelsModal && state.selectedCommande && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <SimplePrintLabelsModal
            commandeId={state.selectedCommande.id}
            commandeNumero={state.selectedCommande.numero_facture || `#${state.selectedCommande.id}`}
            commande={state.selectedCommande}
            produitsList={modals.produitsList}
            selectedRows={modals.selectedRows}
            onClose={() => state.setShowPrintLabelsModal(false)}
          />
        </Suspense>
      )}

      <SudoValidationModal
        isOpen={state.sudoState.isOpen}
        onClose={state.closeSudo}
        onValidate={state.sudoState.onValidate}
        saving={state.sudoState.isValidating}
        title={state.sudoState.title || modals.t('orders:messages.validation_required')}
        message={state.sudoState.message || ""}
      />

      {state.isTransferModalOpen && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <TransferCommandeModal
            isOpen={state.isTransferModalOpen}
            onClose={() => state.setIsTransferModalOpen(false)}
            selectedProducts={modals.commandeProduits.filter((_, idx) => modals.selectedRows.has(idx))}
            fournisseurs={modals.fournisseurs}
            currentSupplierId={modals.newCommandeFournisseurId}
            produitsList={modals.produitsList}
            commandesEndpoint={modals.commandesEndpoint}
            fournisseursEndpoint={modals.fournisseursEndpoint}
            onTransferSuccess={modals.handleTransferSuccess}
          />
        </Suspense>
      )}

      {state.isMergeModalOpen && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <MergeCommandesModal
            isOpen={state.isMergeModalOpen}
            onClose={() => state.setIsMergeModalOpen(false)}
            selectedOrderIds={modals.selectedOrderIds}
            fournisseurs={modals.fournisseurs}
            commandesEndpoint={modals.commandesEndpoint}
            onMergeSuccess={modals.handleMergeSuccess}
          />
        </Suspense>
      )}

      {detailProduitId && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <ProductDetailsModal
            isOpen={!!detailProduitId}
            onClose={() => setDetailProduitId(null)}
            selectedProduit={detailProduit || null}
            activeTab={detailActiveTab}
            setActiveTab={setDetailActiveTab}
            lots={detailLots}
            monthlyStats={detailStats}
            achats={detailAchats}
            stockHistory={detailHistory}
            loadingHistory={detailHistoryLoading}
            onMovementClick={() => {}}
            onOpenAdjustment={() => {}}
            onOpenEdit={() => {}}
            onDelete={() => {}}
          />
        </Suspense>
      )}

      {reconditionnement.modal.open && (
        <Suspense fallback={<LoadingScreen size="sm" overlay={false} />}>
          <ReconditionnementModal
            open={reconditionnement.modal.open}
            onOpenChange={(v) => reconditionnement.setModal((prev) => ({ ...prev, open: v }))}
            commandeId={reconditionnement.modal.commandeId}
            commandeNumero={reconditionnement.modal.commandeNumero}
            transformations={reconditionnement.modal.transformations}
            onDone={reconditionnement.onDone}
          />
        </Suspense>
      )}
    </div>
  )
}
