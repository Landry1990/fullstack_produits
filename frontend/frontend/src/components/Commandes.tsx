import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCommandesState } from '../hooks/useCommandesState';
import { ShoppingCart, Store, Truck } from 'lucide-react';
import { Button } from './shadcn/button';
import { Badge } from './shadcn/badge';
import { cn } from '../lib/utils';

function scrollMainToTop() {
  const main = document.querySelector('main');
  if (main) main.scrollTop = 0;
}

import CommandeList from './Commandes/CommandeList';
import CommandeForm from './Commandes/CommandeForm';
import CommandeDetails from './Commandes/CommandeDetails';

import ScheduledOrdersListModal from './Commandes/ScheduledOrdersListModal';
import OrderSchedulingModal from './Commandes/OrderSchedulingModal';
import ProduitFormModal from './ProduitFormModal';
import SimplePrintLabelsModal from './SimplePrintLabelsModal';
import SudoValidationModal from './common/SudoValidationModal';
import TransferCommandeModal from './Commandes/TransferCommandeModal';
import MergeCommandesModal from './Commandes/MergeCommandesModal';
import SuggestionCommandeModal from './Commandes/SuggestionCommandeModal';
import { ProductDetailsModal } from './products/modals/ProductDetailsModal';
import { useProduit, useProduitLots, useProduitStats, useProduitAchats, useProduitHistory } from '../hooks/useProduits';

interface CommandesProps {
    forcedType?: 'LOC' | 'DIR' | 'DIV';
}

export default function Commandes({ forcedType }: CommandesProps) {
  const hook = useCommandesState(forcedType);
  const { state, listProps, detailsProps, formProps, modals } = hook;
  const [editingSchedule, setEditingSchedule] = useState<any>(null); // State for editing
  const [schedulesRefreshKey, setSchedulesRefreshKey] = useState(0);
  const [isScheduledListOpen, setIsScheduledListOpen] = useState(false);
  const [detailProduitId, setDetailProduitId] = useState<number | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState('general');

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
      const found = listProps.sortedCommandes.find((c: any) => c.id === cid);
      if (found) {
        listProps.onViewDetails(found);
        navigate(pathname, { replace: true, state: {} });
      }
    } else if (location.state?.selectedFournisseurId && listProps.sortedCommandes.length > 0) {
      const fid = location.state.selectedFournisseurId;
      // Filtrer les commandes par fournisseur
      const supplierOrders = listProps.sortedCommandes.filter((c: any) => c.fournisseur === fid || c.fournisseur_id === fid);
      if (supplierOrders.length > 0) {
        listProps.onViewDetails(supplierOrders[0]);
        navigate(pathname, { replace: true, state: {} });
      }
    }
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
                {state.activeTab === 'DIV' ? 'Commandes Divers' : state.activeTab === 'DIR' ? state.t('orders:title_direct') : state.t('orders:title_local')}
            </h1>
            <Badge variant="secondary" className="ml-2">
              {listProps.sortedCommandes?.length || 0}
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
          <CommandeList {...listProps} onOpenScheduledList={() => setIsScheduledListOpen(true)} />
        </div>
      )}

      {state.viewMode === 'DETAILS' && state.selectedCommande && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <CommandeDetails {...(detailsProps as any)} />
        </div>
      )}

      {(state.viewMode === 'CREATE' || state.viewMode === 'EDIT') && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <CommandeForm {...(formProps as any)} onViewProductDetails={handleViewProductDetails} />
        </div>
      )}

      {state.isSuggestionModalOpen && (
        <SuggestionCommandeModal 
          onClose={() => state.setIsSuggestionModalOpen(false)}
          onApply={(products, supplierId) => {
            modals.handleApplySuggestions(products, supplierId);
            state.setIsSuggestionModalOpen(false);
          }}
          fournisseurs={modals.fournisseurs}
          produitsList={modals.produitsList}
        />
      )}

      {isScheduledListOpen && (
        <ScheduledOrdersListModal
          isOpen={isScheduledListOpen}
          onClose={() => setIsScheduledListOpen(false)}
          onEditSchedule={(s) => {
            setEditingSchedule(s);
            state.setIsSchedulingModalOpen(true);
          }}
          onCreateSchedule={() => {
            setEditingSchedule(null);
            state.setIsSchedulingModalOpen(true);
          }}
          fournisseurs={modals.fournisseurs}
          refreshTrigger={schedulesRefreshKey}
        />
      )}

      {state.isSchedulingModalOpen && (
        <OrderSchedulingModal
           isOpen={state.isSchedulingModalOpen}
           onClose={() => {
              state.setIsSchedulingModalOpen(false);
              setEditingSchedule(null);
           }}
           initialSchedule={editingSchedule}
           onSave={() => {
              state.setIsSchedulingModalOpen(false);
              setEditingSchedule(null);
              setSchedulesRefreshKey(prev => prev + 1);
           }}
           onApplySuggestions={modals.handleApplySuggestions}
           fournisseurs={modals.fournisseurs}
           produitsList={modals.produitsList}
        />
      )}

      <ProduitFormModal
        open={state.isCreateProduitModalOpen}
        onClose={() => state.setIsCreateProduitModalOpen(false)}
        produitsEndpoint="produits/"
        onCreated={modals.handleProduitCreated}
        rayons={modals.rayons}
        fournisseurs={modals.fournisseurs}
        formes={modals.formes}
        title={modals.t('orders:messages.create_new_product')}
      />

      {state.showPrintLabelsModal && state.selectedCommande && (
        <SimplePrintLabelsModal
          commandeId={state.selectedCommande.id}
          commandeNumero={state.selectedCommande.numero_facture || `#${state.selectedCommande.id}`}
          commande={state.selectedCommande}
          produitsList={modals.produitsList}
          selectedRows={modals.selectedRows}
          onClose={() => state.setShowPrintLabelsModal(false)}
        />
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
      )}

      {state.isMergeModalOpen && (
        <MergeCommandesModal
          isOpen={state.isMergeModalOpen}
          onClose={() => state.setIsMergeModalOpen(false)}
          selectedOrderIds={modals.selectedOrderIds}
          fournisseurs={modals.fournisseurs}
          commandesEndpoint={modals.commandesEndpoint}
          onMergeSuccess={modals.handleMergeSuccess}
        />
      )}

      {detailProduitId && (
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
      )}
    </div>
  )
}
