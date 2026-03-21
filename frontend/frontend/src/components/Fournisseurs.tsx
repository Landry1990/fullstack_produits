import React from 'react';
import { useFournisseurs } from '../hooks/useFournisseurs';
import FournisseursList from './fournisseurs/FournisseursList';
import FournisseurDetails from './fournisseurs/FournisseurDetails';
import FournisseurFormModals from './fournisseurs/FournisseurFormModals';
import FinanceFournisseurModal from './FinanceFournisseurModal';
import EcheancierFournisseursModal from './EcheancierFournisseursModal';
import PointageReleveModal from './PointageReleveModal';
import SudoValidationModal from './common/SudoValidationModal';

export default function Fournisseurs() {
  const hook = useFournisseurs();
  const { state, actions } = hook;
  
  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {state.error && (
        <div role="alert" className="alert alert-error shrink-0">
          <span>{state.error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full min-h-0">
         {/* Left Panel: List */}
         <FournisseursList hook={hook} />

         {/* Right Panel: Details */}
         <FournisseurDetails hook={hook} />
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
