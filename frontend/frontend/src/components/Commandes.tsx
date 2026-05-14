import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCommandesState } from '../hooks/useCommandesState';

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

interface CommandesProps {
    forcedType?: 'LOC' | 'DIR' | 'DIV';
}

export default function Commandes({ forcedType }: CommandesProps) {
  const hook = useCommandesState(forcedType);
  const { state, listProps, detailsProps, formProps, modals } = hook;
  const [editingSchedule, setEditingSchedule] = useState<any>(null); // State for editing
  const [schedulesRefreshKey, setSchedulesRefreshKey] = useState(0);
  const [isScheduledListOpen, setIsScheduledListOpen] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.state?.action === 'NEW_ORDER') {
      listProps.onOpenCreateView();
      navigate(location.pathname, { replace: true, state: {} });
    } else if (location.state?.action === 'OPEN_SUGGESTIONS') {
      state.setIsSuggestionModalOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, listProps, navigate, location.pathname, state]);
  
  return (
    <div className="h-full flex flex-col overflow-hidden bg-base-100">
      <div className="flex flex-col items-center pt-4 mb-4 shrink-0">
          <h1 className="text-xl md:text-2xl font-bold text-center mb-4">
              {state.activeTab === 'DIV' ? 'Commandes Divers' : state.activeTab === 'DIR' ? state.t('orders:title_direct') : state.t('orders:title_local')}
          </h1>
          
          {!forcedType && (
            <div className="tabs tabs-boxed">
                <a 
                className={`tab ${state.activeTab === 'LOC' ? 'tab-active' : ''}`}
                onClick={() => state.setActiveTab('LOC')}
                >
                {state.t('orders:tabs.local')}
                </a> 
                <a 
                className={`tab ${state.activeTab === 'DIR' ? 'tab-active' : ''}`}
                onClick={() => state.setActiveTab('DIR')}
                >
                {state.t('orders:tabs.direct')}
                </a>
            </div>
          )}
      </div>

      {state.error && (
        <div role="alert" className="alert alert-error mb-4 shrink-0 mx-4 w-auto">
          <span>{state.error}</span>
        </div>
      )}

      {state.viewMode === 'LIST' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <CommandeList {...listProps} onOpenScheduledList={() => setIsScheduledListOpen(true)} />
        </div>
      )}

      {state.viewMode === 'DETAILS' && state.selectedCommande && (
        <CommandeDetails {...(detailsProps as any)} />
      )}

      {(state.viewMode === 'CREATE' || state.viewMode === 'EDIT') && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <CommandeForm {...(formProps as any)} />
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
        produitsEndpoint={modals.produitsEndpoint}
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
        saving={false}
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
    </div>
  )
}
