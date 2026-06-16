import React from 'react';
import { Building2, LayoutDashboard, List } from 'lucide-react';
import { useFournisseurs } from '../hooks/useFournisseurs';
import FournisseursList from './fournisseurs/FournisseursList';
import FournisseurDetails from './fournisseurs/FournisseurDetails';
import FournisseurFormModals from './fournisseurs/FournisseurFormModals';
import FinanceFournisseurModal from './FinanceFournisseurModal';
import EcheancierFournisseursModal from './EcheancierFournisseursModal';
import PointageReleveModal from './PointageReleveModal';
import SudoValidationModal from './common/SudoValidationModal';
import SupplierDashboard from './fournisseurs/SupplierDashboard';
import { Button } from './shadcn/button';
import { Badge } from './shadcn/badge';
import { cn } from '../lib/utils';

export default function Fournisseurs() {
  const hook = useFournisseurs();
  const { state, actions } = hook;
  const { t } = state;
  
  const [activeTab, setActiveTab] = React.useState<'dashboard' | 'management'>('dashboard');
  
  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {state.error && (
        <div role="alert" className="mx-4 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm shrink-0">
          {state.error}
        </div>
      )}

      {/* Header with Tabs */}
      <div className="px-6 py-4 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
           <div className="p-2.5 bg-emerald-100 rounded-lg">
              <Building2 className="size-5 text-emerald-600" />
           </div>
           <div>
              <h1 className="text-lg font-bold text-slate-800">Gestion Fournisseurs</h1>
              <p className="text-xs text-slate-500 font-medium">Finance & Approvisionnement</p>
           </div>
        </div>

        <div className="bg-slate-100 p-1 rounded-lg flex gap-1 self-stretch sm:self-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex-1 sm:flex-none px-5 py-2 rounded-md text-sm font-medium transition-all gap-2",
              activeTab === 'dashboard' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <LayoutDashboard className="size-4" /> {t('providers:dashboard.tabs.overview')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('management')}
            className={cn(
              "flex-1 sm:flex-none px-5 py-2 rounded-md text-sm font-medium transition-all gap-2",
              activeTab === 'management' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <List className="size-4" /> {t('providers:dashboard.tabs.management')}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'dashboard' ? (
          <SupplierDashboard onViewAllDeadlines={() => state.setIsEcheancierModalOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full min-h-0 p-4">
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
         saving={state.sudoState.isValidating}
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
