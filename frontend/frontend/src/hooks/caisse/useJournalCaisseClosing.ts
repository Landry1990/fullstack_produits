import { useState, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import { getApiErrorDetail } from '../../utils/errorHandling';
import { normalizeNumberInput } from '../../utils/formatters';
import { toApiDateTime, toApiDateEnd } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import type { ClosingPrintData } from './useJournalCaissePrinting';

interface ClosingTotalsSource {
  start_date?: string | null;
  total_theorique?: number;
  total_ventes?: number;
  total_ca_pharmacie?: number;
  total_ca_divers?: number;
  total_recouvrement?: number;
  total_entrees?: number;
  total_sorties?: number;
  total?: number;
  ventes?: number;
  recouvrement?: number;
  entrees?: number;
  sorties?: number;
  especes?: number;
  cheque?: number;
  carte?: number;
  virement?: number;
  om?: number;
  momo?: number;
  details?: Record<string, number | Record<string, unknown>>;
}

interface ClosingTotals {
  start_date: string | null;
  end_date?: string | null;
  total_theorique: number;
  total_ventes: number;
  total_recouvrement: number;
  total_entrees: number;
  total_sorties: number;
  total_ca_pharmacie?: number;
  total_ca_divers?: number;
  details: Record<string, number | Record<string, unknown>>;
  user?: string;
}

interface UserInfo {
  id: number;
  username: string;
  full_name: string;
}

interface UseJournalCaisseClosingParams {
  serverTotals: ClosingTotalsSource | null;
  totauxParMode: ClosingTotalsSource;
  dateDebut: Date | null;
  dateFin: Date | null;
  selectedUser: string;
  users: UserInfo[];
  fetchData: () => Promise<void>;
  onPrint: (data?: ClosingPrintData) => void;
}

/**
 * Gère la clôture de caisse : ouverture modal, mouvements manuels,
 * calcul du théorique, et envoi de la clôture au backend.
 */
export function useJournalCaisseClosing({
  serverTotals,
  totauxParMode,
  dateDebut,
  dateFin,
  selectedUser,
  users,
  fetchData,
  onPrint,
}: UseJournalCaisseClosingParams) {
  const { t } = useTranslation(['cash_journal', 'common']);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingTotals, setClosingTotals] = useState<ClosingTotals | null>(null);
  const [actualAmount, setActualAmount] = useState<string>('');
  const [manualMovements, setManualMovements] = useState<
    { id: number; motif: string; montant: number; type: 'ENTREE' | 'SORTIE' }[]
  >([]);
  const [fondDeCaisse, setFondDeCaisse] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billetage, setBilletage] = useState<Record<string, unknown> | null>(null);

  const computedTheorique = useMemo(() => {
    if (!closingTotals) return null;
    const manualEntrees = manualMovements.filter(m => m.type === 'ENTREE').reduce((s, m) => s + m.montant, 0);
    const manualSorties = manualMovements.filter(m => m.type === 'SORTIE').reduce((s, m) => s + m.montant, 0);
    const baseTheorique = closingTotals.total_theorique || 0;
    return baseTheorique + manualEntrees - manualSorties;
  }, [closingTotals, manualMovements]);

  const openClosingModal = useCallback(() => {
    const currentTotals = (serverTotals || totauxParMode) as ClosingTotalsSource;

    const modalTotals: ClosingTotals = {
      start_date: dateDebut ? toApiDateTime(dateDebut) : currentTotals?.start_date || null,
      end_date: dateFin ? toApiDateEnd(dateFin) : null,
      total_theorique: currentTotals.total_theorique ?? currentTotals.total ?? 0,
      total_ventes: currentTotals.total_ventes ?? currentTotals.ventes ?? 0,
      total_ca_pharmacie: currentTotals.total_ca_pharmacie,
      total_ca_divers: currentTotals.total_ca_divers,
      total_recouvrement: currentTotals.total_recouvrement ?? currentTotals.recouvrement ?? 0,
      total_entrees: currentTotals.total_entrees ?? currentTotals.entrees ?? 0,
      total_sorties: currentTotals.total_sorties ?? currentTotals.sorties ?? 0,
      details: currentTotals.details || {
        especes: currentTotals.especes ?? 0,
        cheque: currentTotals.cheque ?? 0,
        carte: currentTotals.carte ?? 0,
        virement: currentTotals.virement ?? 0,
        om: currentTotals.om ?? 0,
        momo: currentTotals.momo ?? 0
      },
      user: selectedUser ? users.find(u => u.id.toString() === selectedUser)?.full_name : 'Admin'
    };

    setClosingTotals(modalTotals);
    setActualAmount('');
    setManualMovements([]);
    setBilletage(null);
    setFondDeCaisse(
      ((currentTotals.details as Record<string, Record<string, unknown>> | undefined)?.__meta__?.fond_de_caisse as number) || 0
    );
    setIsClosingModalOpen(true);
  }, [serverTotals, totauxParMode, dateDebut, dateFin, selectedUser, users]);

  const handleCloseCaisse = useCallback(async () => {
    if (!actualAmount) return;

    setLoading(true);
    try {
      const response = await api.post('caisse/cloturer/', {
        montant_reel: normalizeNumberInput(actualAmount),
        montant_theorique_frontend: computedTheorique,
        date_debut: dateDebut ? toApiDateTime(dateDebut) : null,
        date_fin: dateFin ? toApiDateEnd(dateFin) : null,
        user_id: selectedUser,
        mouvements_manuels: manualMovements.map(m => ({ motif: m.motif, montant: m.montant, type: m.type })),
        billetage: billetage || {}
      });

      gooeyToast.success(t('messages.close_success'));
      const completeData = response.data.cloture;
      if (completeData) {
        setClosingTotals(completeData);
        setTimeout(() => {
          onPrint(completeData);
        }, 500);
      }

      setIsClosingModalOpen(false);
      setManualMovements([]);
      fetchData();
    } catch (err) {
      logger.error('Erreur clôture:', err);
      const errorMessage = getApiErrorDetail(err, err instanceof Error ? err.message : 'Erreur inconnue');
      setError(`${t('messages.close_error')}: ${errorMessage}`);
      gooeyToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [actualAmount, computedTheorique, dateDebut, dateFin, selectedUser, manualMovements, billetage, fetchData, onPrint, t]);

  return {
    isClosingModalOpen,
    setIsClosingModalOpen,
    closingTotals,
    setClosingTotals,
    actualAmount,
    setActualAmount,
    manualMovements,
    setManualMovements,
    fondDeCaisse,
    setFondDeCaisse,
    computedTheorique,
    openClosingModal,
    handleCloseCaisse,
    setBilletage,
    closingLoading: loading,
    closingError: error,
  };
}
