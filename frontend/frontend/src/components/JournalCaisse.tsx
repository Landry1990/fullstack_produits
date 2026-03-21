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
    <div className="h-full flex flex-col bg-base-200/50">
      <JournalCaisseFilters state={state} />
      <JournalCaisseStats state={state} />
      <JournalCaisseTable state={state} />
      <JournalCaisseClosingModal state={state} />
      
      <CashMovementModal 
        isOpen={state.isMovementModalOpen}
        onClose={() => state.setIsMovementModalOpen(false)}
        onSuccess={state.fetchData}
      />
    </div>
  );
}
