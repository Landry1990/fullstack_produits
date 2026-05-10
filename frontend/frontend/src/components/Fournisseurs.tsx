import React from 'react';
import { useFournisseurs } from '../hooks/useFournisseurs';
import FournisseursList from './fournisseurs/FournisseursList';
import FournisseurDetails from './fournisseurs/FournisseurDetails';
import FournisseurFormModals from './fournisseurs/FournisseurFormModals';
import FinanceFournisseurModal from './FinanceFournisseurModal';
import EcheancierFournisseursModal from './EcheancierFournisseursModal';
import PointageReleveModal from './PointageReleveModal';
import SudoValidationModal from './common/SudoValidationModal';
import SupplierDashboard from './fournisseurs/SupplierDashboard';

export default function Fournisseurs() {
  const hook = useFournisseurs();
  const { state, actions } = hook;
  const { t } = state;
  
  const [activeTab, setActiveTab] = React.useState<'dashboard' | 'management'>('dashboard');
  
  return (
    <div className="flex flex-col h-full p-4 space-y-4 overflow-hidden">
      {state.error && (
        <div role="alert" className="alert alert-error shrink-0 rounded-2xl">
          <span>{state.error}</span>
        </div>
      )}

      {/* Header with Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
           <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
           </div>
           <div>
              <h1 className="text-xl font-black text-base-content tracking-tight uppercase">Gestion Fournisseurs</h1>
              <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest">Finance & Approvisionnement</p>
           </div>
        </div>

        <div className="bg-base-200/50 p-1 rounded-2xl flex gap-1 self-stretch sm:self-auto">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'dashboard' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-base-content/40 hover:text-base-content/70'
            }`}
          >
            {t('providers:dashboard.tabs.overview')}
          </button>
          <button 
            onClick={() => setActiveTab('management')}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'management' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-base-content/40 hover:text-base-content/70'
            }`}
          >
            {t('providers:dashboard.tabs.management')}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
        {activeTab === 'dashboard' ? (
          <SupplierDashboard onViewAllDeadlines={() => state.setIsEcheancierModalOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full min-h-0">
             {/* Left Panel: List */}
             <FournisseursList hook={hook} />

             {/* Right Panel: Details */}
             <FournisseurDetails hook={hook} />
          </div>
        )}
      </div>

      {/* Add & Edit Modals */}
      <FournisseurFormModals hook={hook} />

      {/* Finance Modal */}
      {state.selectedFournisseur && (
          <FinanceFournisseurModal 
            isOpen={state.financeModalState.isOpen}
            onClose={() => state.setFinanceModalState({ isOpen: false })}
            fournisseur={state.selectedFournisseur}
            onSuccess={actions.fetchFournisseurs}
            prefilledMontant={state.financeModalState.prefilledMontant}
            commandeIds={state.financeModalState.commandeIds}
          />
      )}

      {/* Sudo Mode Password Modal */}
      <SudoValidationModal
         isOpen={state.sudoState.isOpen}
         onClose={actions.closeSudo}
         onValidate={state.sudoState.onValidate}
         title={state.sudoState.title}
         message={state.sudoState.message}
         saving={state.isSubmitting}
      />

      {/* Modal Échéancier */}
      <EcheancierFournisseursModal 
        isOpen={state.isEcheancierModalOpen}
        onClose={() => state.setIsEcheancierModalOpen(false)}
        onRegler={(fournisseurId: number) => {
          state.setIsEcheancierModalOpen(false);
          const f = state.fournisseurs.find(x => x.id === fournisseurId);
          if (f) {
            state.setSelectedFournisseur(f);
            state.setFinanceModalState({ isOpen: true });
          }
        }}
        onPointer={(id: number) => {
          state.setIsEcheancierModalOpen(false);
          state.setIsPointageModalOpen(true);
          const f = state.fournisseurs.find(x => x.id === id);
          if (f) state.setSelectedFournisseur(f);
        }}
      />

      {/* Modal Pointage des Factures Global */}
      <PointageReleveModal 
          isOpen={state.isPointageModalOpen}
          initialFournisseurId={state.selectedFournisseur?.id}
          onClose={() => state.setIsPointageModalOpen(false)}
          fournisseurs={state.fournisseurs}
          onReglerSelection={(fId, cmds, montant) => {
             state.setIsPointageModalOpen(false);
             const f = state.fournisseurs.find(x => x.id === fId);
             if (f) {
                state.setSelectedFournisseur(f);
                state.setFinanceModalState({
                   isOpen: true,
                   prefilledMontant: montant,
                   commandeIds: cmds
                });
             }
          }}
      />
    </div>
  );
}
