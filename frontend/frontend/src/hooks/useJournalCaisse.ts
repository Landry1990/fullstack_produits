import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api from '../services/api';
import type { CaisseTransaction, MouvementCaisse } from '../types';
import { usePharmacySettings } from './usePharmacySettings';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { normalizeNumberInput } from '../utils/formatters';
import { toApiDateTime, toApiDateEnd } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { useJournalCaissePrinting, type ClosingPrintData } from './caisse/useJournalCaissePrinting';
import { useJournalCaisseClosing } from './caisse/useJournalCaisseClosing';
import { useJournalCaisseShift } from './caisse/useJournalCaisseShift';

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
  mouvements_audit?: Array<{ type: string; montant: number; motif: string; user_nom?: string; date?: string }>;
}

export function useJournalCaisse() {
  const { t } = useTranslation(['cash_journal', 'common']);
  const PAGE_SIZE = 50;

  const [transactions, setTransactions] = useState<CaisseTransaction[]>([]);
  const [mouvements, setMouvements] = useState<MouvementCaisse[]>([]);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'entrees' | 'sorties'>('all');
  const [expandedReleves, setExpandedReleves] = useState<Set<number>>(new Set());

  const { settings: pharmacySettings } = usePharmacySettings();
  const { getServerDate } = useAuth();

  const [dateDebut, setDateDebut] = useState<Date | null>(() => {
    const today = getServerDate();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [dateFin, setDateFin] = useState<Date | null>(() => {
    const endToday = getServerDate();
    endToday.setHours(23, 59, 59, 999);
    return endToday;
  });

  const [users, setUsers] = useState<{ id: number; username: string; full_name: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [serverTotals, setServerTotals] = useState<{
    total_theorique: number,
    total_ventes: number,
    total_entrees: number,
    total_sorties: number,
    total_coupons: number,
    total_recouvrement: number,
    details: Record<string, number>,
    mouvements_audit?: Pick<MouvementCaisse, 'motif' | 'montant'>[]
  } | null>(null);

  const isInitialMount = useRef(true);
  const hasLoadedOnce = useRef(false);

  const toggleReleve = (releveId: number) => {
    setExpandedReleves(prev => {
        const next = new Set(prev);
        if (next.has(releveId)) {
            next.delete(releveId);
        } else {
            next.add(releveId);
        }
        return next;
    });
  };

  const processTransactionsData = useCallback((data: { results?: CaisseTransaction[]; count?: number } | CaisseTransaction[]) => {
    if (Array.isArray(data)) {
      setTransactions(data);
      setTotalCount(data.length);
      setTotalPages(1);
    } else {
      setTransactions(data.results ?? []);
      setTotalCount(data.count ?? 0);
      setTotalPages(Math.ceil((data.count ?? 0) / PAGE_SIZE));
    }
  }, [PAGE_SIZE]);

  const fetchPageInit = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        page: '1',
        page_size: PAGE_SIZE.toString()
      };
      if (selectedUser) params.user = selectedUser;
      if (dateDebut) params.date_debut = toApiDateTime(dateDebut);
      if (dateFin) params.date_fin = toApiDateEnd(dateFin);

      const response = await api.get('caisse/page_init/', { params, signal });
      const { transactions: txData, mouvements: mouvData, totals: totalsData, users: usersData } = response.data;

      processTransactionsData(txData);
      setMouvements(Array.isArray(mouvData) ? mouvData : (mouvData?.results || []));
      if (totalsData) setServerTotals(totalsData);
      if (usersData) setUsers(usersData);
    } catch (err) {
      if (err instanceof Error && err.name === 'CanceledError') return;
      setError(t('table.loading_error') || 'Erreur lors du chargement des données');
      logger.error('Erreur page_init caisse:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedUser, dateDebut, dateFin, processTransactionsData, t]);

  useEffect(() => {
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      const controller = new AbortController();
      fetchPageInit(controller.signal);
      return () => controller.abort();
    }
  }, [fetchPageInit]);

  useEffect(() => {
    if (isInitialMount.current) return;
    const controller = new AbortController();
    fetchTransactions(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ── Shift detection hook ──
  const {
    detectedShift,
    isDetectingShift,
    handleUserShiftDetection,
    resetShift,
  } = useJournalCaisseShift({
    getServerDate,
    onShiftDetected: (start, end) => {
      setDateDebut(start);
      setDateFin(end);
    },
    onNoShift: (todayStart, todayEnd) => {
      setDateDebut(todayStart);
      setDateFin(todayEnd);
    },
  });

  // Fetch quand les dates changent (sélection manuelle ou détection shift terminée)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Attendre que la détection de shift soit terminée avant de fetch (évite double requête)
    if (isDetectingShift) return;

    setPage(1);
    const controller = new AbortController();
    fetchPageInit(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateDebut, dateFin, isDetectingShift, selectedUser]);

  useEffect(() => {
    if (selectedUser) {
      // Ne détecter le shift que si on est sur aujourd'hui.
      // Si l'utilisateur a choisi une date antérieure, on garde sa plage
      // et on ne remplace pas les dates par le shift/aujourd'hui.
      const todayStart = getServerDate();
      todayStart.setHours(0, 0, 0, 0);
      const isToday = dateDebut && dateDebut.getTime() === todayStart.getTime();

      if (isToday) {
        handleUserShiftDetection(selectedUser);
      } else {
        // Date antérieure : conserver les dates de l'utilisateur,
        // juste reset le shift détecté (pas de blocage clôture).
        resetShift();
        // Le fetch sera déclenché par l'effect [dateDebut, dateFin, selectedUser].
      }
    } else {
      // Retour à "toutes les caissières" - réinitialiser complètement
      resetShift();
      const today = getServerDate();
      today.setHours(0, 0, 0, 0);
      const endToday = getServerDate();
      endToday.setHours(23, 59, 59, 999);
      setDateDebut(today);
      setDateFin(endToday);
      setPage(1); // Réinitialiser la pagination
      // Le rechargement sera déclenché par l'effect des dates
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  const fetchData = async () => {
    await fetchPageInit();
  };

  const fetchTransactions = async (signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('page_size', PAGE_SIZE.toString());
      if (selectedUser) params.append('user', selectedUser);
      if (dateDebut) params.append('date_debut', toApiDateTime(dateDebut));
      if (dateFin) params.append('date_fin', toApiDateEnd(dateFin));

      const response = await api.get('caisse/', { params, signal });
      processTransactionsData(response.data);
    } catch (err) {
      if (err instanceof Error && err.name === 'CanceledError') return;
      logger.error('Erreur:', err);
      throw err;
    }
  };

  const filteredItems = useMemo(() => {
    // NOTE: Les transactions et mouvements viennent déjà filtrés par date de l'API
    // On ne refiltre PAS par date ici pour éviter les incohérences
    const filteredTrans = transactions.filter(transaction => {
      const matchesSearch = searchQuery === '' ||
        transaction.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.facture_numero?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.user_details?.full_name.toLowerCase().includes(searchQuery.toLowerCase());

      // Filtre type: les transactions sont des "entrées" de trésorerie
      const matchesType = filterType === 'all' ||
        filterType === 'entrees' || // Les transactions sont des entrées de caisse
        (filterType === 'sorties' && false); // Les transactions ne sont jamais des sorties

      const matchesMode = filterMode === 'all' || transaction.mode_paiement === filterMode;

      return matchesSearch && matchesType && matchesMode;
    });

    const filteredMouvs = mouvements.filter(mouv => {
       const matchesSearch = searchQuery === '' ||
        mouv.motif.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (mouv.description && mouv.description.toLowerCase().includes(searchQuery.toLowerCase()));

       const matchesMode = filterMode === 'all' || filterMode === 'especes';

       const matchesType = filterType === 'all' ||
        (filterType === 'entrees' && mouv.type === 'ENTREE') ||
        (filterType === 'sorties' && mouv.type === 'SORTIE');

      return matchesSearch && matchesMode && matchesType;
    });

    const combined = [
        ...filteredTrans.map(t => ({ ...t, _kind: 'transaction' as const })),
        ...filteredMouvs.map(m => ({ ...m, _kind: 'mouvement' as const, date_paiement: m.date }))
    ];

    return combined.sort((a, b) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime());

  }, [transactions, mouvements, searchQuery, filterMode, filterType]); // ← Plus de dateDebut/dateFin

  type GroupedItem =
    | (CaisseTransaction & { _kind: 'transaction'; isReleveGroup?: boolean; items?: CaisseTransaction[] })
    | (MouvementCaisse & { _kind: 'mouvement'; date_paiement: string });

  const groupedItems = useMemo(() => {
     const result: GroupedItem[] = [];
     const processedReleves = new Set<number>();

     filteredItems.forEach((item) => {
         if (item._kind === 'mouvement') {
             result.push(item);
         } else {
             const t = item as CaisseTransaction;
             if (t.releve_id) {
                 if (!processedReleves.has(t.releve_id)) {
                     const releveItems = filteredItems.filter((rt) => rt._kind === 'transaction' && (rt as CaisseTransaction).releve_id === t.releve_id) as CaisseTransaction[];
                     const totalAmount = releveItems.reduce((sum, item) => sum + normalizeNumberInput(item.montant), 0);

                     result.push({
                         ...t,
                         id: -t.releve_id,
                         releve_reference: t.releve_reference,
                         montant: totalAmount.toString(),
                         isReleveGroup: true,
                         items: releveItems,
                         facture_numero: `${releveItems.length} factures`,
                         _kind: 'transaction'
                     });
                     processedReleves.add(t.releve_id);
                 }
             } else {
                 result.push({ ...t, _kind: 'transaction' as const });
             }
         }
     });

     return result;
  }, [filteredItems]);

  // Utiliser uniquement serverTotals comme source de vérité
  // Les totaux côté client sont désactivés pour éviter les incohérences
  const totauxParMode = useMemo(() => {
    // Fallback si serverTotals n'est pas encore chargé
    const details = serverTotals?.details || {};

    return {
      especes: details.especes || 0,
      cheque: details.cheque || 0,
      carte: details.carte || 0,
      virement: details.virement || 0,
      om: details.om || 0,
      momo: details.momo || 0,
      en_compte: details.en_compte || 0,
      depot: details.depot || 0,
      recouvrement: details.recouvrement || 0,
      total: serverTotals?.total_theorique || 0,
      entrees: serverTotals?.total_entrees || 0,
      sorties: serverTotals?.total_sorties || 0,
      ventes: serverTotals?.total_ventes || 0,
      ventes_par_mode: {
        especes: 0, cheque: 0, carte: 0, virement: 0,
        om: 0, momo: 0, depot: 0, en_compte: 0
      },
      recouv_par_mode: {
        especes: 0, cheque: 0, carte: 0, virement: 0, om: 0, momo: 0
      },
      global_par_mode: details
    };
  }, [serverTotals]);

  // ── Printing hook ──
  // Utilise des refs pour actualAmount et closingTotals afin d'éviter
  // les dépendances circulaires avec le closing hook.
  const actualAmountRef = useRef('');
  const closingTotalsRef = useRef<ClosingPrintData | null>(null);

  const { handleImprimerCloture, formatCurrencyLocal, currentLocale } = useJournalCaissePrinting({
    pharmacySettings,
    actualAmountRef,
    closingTotalsRef,
  });

  // ── Closing hook ──
  const {
    isClosingModalOpen,
    setIsClosingModalOpen,
    closingTotals,
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
  } = useJournalCaisseClosing({
    serverTotals: serverTotals as ClosingTotalsSource | null,
    totauxParMode: totauxParMode as ClosingTotalsSource,
    dateDebut,
    dateFin,
    selectedUser,
    users,
    fetchData,
    onPrint: handleImprimerCloture,
  });

  // Synchroniser les refs pour le printing hook
  actualAmountRef.current = actualAmount;
  closingTotalsRef.current = closingTotals;

  const setTodayDateRange = () => {
    const today = getServerDate();
    today.setHours(0, 0, 0, 0);
    const endToday = getServerDate();
    endToday.setHours(23, 59, 59, 999);
    setDateDebut(today);
    setDateFin(endToday);
  };

  return {
    // State
    transactions,
    mouvements,
    loading,
    error,
    searchQuery,
    filterMode,
    filterType,
    expandedReleves,
    dateDebut,
    dateFin,
    users,
    selectedUser,
    page,
    totalPages,
    totalCount,
    serverTotals,
    detectedShift,
    isClosingModalOpen,
    closingTotals,
    actualAmount,
    isMovementModalOpen,
    manualMovements,
    fondDeCaisse,

    // Setters
    setSearchQuery,
    setFilterMode,
    setFilterType,
    setDateDebut,
    setDateFin,
    setSelectedUser,
    setPage,
    setIsClosingModalOpen,
    setActualAmount,
    setIsMovementModalOpen,
    setManualMovements,
    setFondDeCaisse,

    // Derived
    filteredItems,
    groupedItems,
    totauxParMode,

    // Actions
    fetchData,
    toggleReleve,
    openClosingModal,
    handleCloseCaisse,
    setBilletage,
    handleImprimerCloture,
    setTodayDateRange,

    theoriqueFrontend: computedTheorique,

    // Utils out for components
    t,
    currentLocale,
    formatCurrencyLocal
  };
}
