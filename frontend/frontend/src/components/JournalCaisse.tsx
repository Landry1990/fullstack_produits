import { useJournalCaisse } from '../hooks/useJournalCaisse';
import CashMovementModal from './CashMovementModal';
import JournalCaisseFilters from './caisse/JournalCaisseFilters';
import JournalCaisseStats from './caisse/JournalCaisseStats';
import JournalCaisseTable from './caisse/JournalCaisseTable';
import JournalCaisseClosingModal from './caisse/JournalCaisseClosingModal';
import 'react-datepicker/dist/react-datepicker.css';

export default function JournalCaisse() {
  const state = useJournalCaisse();

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-auto">
      <div className="mx-4 md:mx-6 mt-4 md:mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
        <JournalCaisseFilters state={state} />
      </div>
      <div className="flex-1 min-h-0 mx-4 md:mx-6 my-4 space-y-4 transition-all">
        <JournalCaisseStats state={state} />
        <JournalCaisseTable state={state} />
      </div>
      <JournalCaisseClosingModal state={state} />

      <CashMovementModal
        isOpen={state.isMovementModalOpen}
        onClose={() => state.setIsMovementModalOpen(false)}
        onSuccess={state.fetchData}
      />
    </div>
  );
}
