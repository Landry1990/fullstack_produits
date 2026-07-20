import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { getApiErrorDetail } from '../utils/errorHandling';
import type { CaisseTransaction, MouvementCaisse } from '../types';
import { usePharmacySettings } from './usePharmacySettings';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { formatCurrency, normalizeNumberInput } from '../utils/formatters';
import { escHtml } from '../utils/print/printHelpers';
import { formatDate, formatDateTime, toApiDateTime, toApiDateEnd } from '../utils/dateUtils';
import { getPaymentModeLabel } from '../config/paymentModes';

export function useJournalCaisse() {
  const { t } = useTranslation(['cash_journal', 'common']);
  const PAGE_SIZE = 50;
  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' });
  const currencySymbol = t(['common:currency_symbol', 'currency_symbol'], 'F');

  const formatCurrencyLocal = useCallback((amount: number) => formatCurrency(amount, currentLocale, currencySymbol), [currentLocale, currencySymbol]);

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

  const [detectedShift, setDetectedShift] = useState<{
    start: Date,
    end: Date,
    active: boolean,
    posteCaisseId?: number | null,
    posteCaisseNom?: string | null,
    hasActiveSession?: boolean
  } | null>(null);
  const [isDetectingShift, setIsDetectingShift] = useState(false);

  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingTotals, setClosingTotals] = useState<{
    start_date: string | null,
    end_date?: string | null,
    total_theorique: number,
    total_ventes: number,
    total_recouvrement: number,
    total_entrees: number,
    total_sorties: number,
    total_ca_pharmacie?: number,
    total_ca_divers?: number,
    details: Record<string, number | Record<string, unknown>>,
    user?: string
  } | null>(null);
  const [actualAmount, setActualAmount] = useState<string>('');
  const [manualMovements, setManualMovements] = useState<{ id: number; motif: string; montant: number; type: 'ENTREE' | 'SORTIE' }[]>([]);
  const [fondDeCaisse, setFondDeCaisse] = useState<number>(0);

  const computedTheorique = useMemo(() => {
    if (!closingTotals) return null;
    const manualEntrees = manualMovements.filter(m => m.type === 'ENTREE').reduce((s, m) => s + m.montant, 0);
    const manualSorties = manualMovements.filter(m => m.type === 'SORTIE').reduce((s, m) => s + m.montant, 0);
    const baseTheorique = closingTotals.total_theorique || 0;
    return baseTheorique + manualEntrees - manualSorties;
  }, [closingTotals, manualMovements]);

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

  const isInitialMount = useRef(true);
  const hasLoadedOnce = useRef(false);

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
      console.error('Erreur page_init caisse:', err);
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
      handleUserShiftDetection(selectedUser);
    } else {
      // Retour à "toutes les caissières" - réinitialiser complètement
      setDetectedShift(null);
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

  const handleUserShiftDetection = async (userId: string) => {
    setIsDetectingShift(true);
    setLoading(true); // Bloquer l'UI pendant la détection
    try {
      const response = await api.get('caisse/get_user_shift/', {
        params: { user_id: userId }
      });
      const { start_date, end_date, has_activity, has_active_session } = response.data;

      if (has_activity && start_date) {
        const start = new Date(start_date);
        const end = end_date ? new Date(end_date) : new Date();

        setDetectedShift({ start, end, active: true, hasActiveSession: has_active_session });
        // Mettre à jour les dates ET fetcher les données dans la foulée
        setDateDebut(start);
        setDateFin(end);
        toast.success(t('messages.shift_detected'));
      } else {
        setDetectedShift(null);
        const today = getServerDate();
        today.setHours(0,0,0,0);
        const endToday = getServerDate();
        endToday.setHours(23,59,59,999);
        setDateDebut(today);
        setDateFin(endToday);
        toast(t('messages.no_shift_found', { defaultValue: 'Aucune activité pour ce caissier...' }), { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error("Erreur détection shift:", err);
      setDetectedShift(null);
      toast.error(t('messages.shift_error', { defaultValue: 'Erreur lors de la détection du shift' }));
    } finally {
      setIsDetectingShift(false);
      setLoading(false);
    }
  };

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
      console.error('Erreur:', err);
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

  const openClosingModal = () => {
      const currentTotals = (serverTotals || totauxParMode) as unknown;
      
      const modalTotals = {
          start_date: dateDebut ? toApiDateTime(dateDebut) : currentTotals?.start_date || null,
          end_date: dateFin ? toApiDateEnd(dateFin) : null,
          total_theorique: currentTotals.total_theorique ?? currentTotals.total,
          total_ventes: currentTotals.total_ventes ?? currentTotals.ventes,
          total_ca_pharmacie: currentTotals.total_ca_pharmacie,
          total_ca_divers: currentTotals.total_ca_divers,
          total_recouvrement: currentTotals.total_recouvrement ?? currentTotals.recouvrement,
          total_entrees: currentTotals.total_entrees ?? currentTotals.entrees,
          total_sorties: currentTotals.total_sorties ?? currentTotals.sorties,
          details: currentTotals.details || {
              especes: currentTotals.especes,
              cheque: currentTotals.cheque,
              carte: currentTotals.carte,
              virement: currentTotals.virement,
              om: currentTotals.om,
              momo: currentTotals.momo
          },
          user: selectedUser ? users.find(u => u.id.toString() === selectedUser)?.full_name : 'Admin'
      };
      
      setClosingTotals(modalTotals);
      setActualAmount('');
      setManualMovements([]);
      setFondDeCaisse((currentTotals.details?.__meta__?.fond_de_caisse as number) || 0);
      setIsClosingModalOpen(true);
  };

  const handleImprimerCloture = (dataToPrint?: unknown) => {
    const data = dataToPrint || closingTotals;
    if (!data) return;

    const win = window.open('', '_blank', 'width=800,height=600');
    if (win) {
      const startStr = (data.date_debut || data.start_date) ? new Date(data.date_debut || data.start_date).toLocaleString(currentLocale) : '--';
      const endStr = (data.date_fin || data.end_date) ? new Date(data.date_fin || data.end_date).toLocaleString(currentLocale) : '--';
      
      const totalTheorique = data.montant_theorique ?? data.total_theorique ?? 0;
      const montantReel = data.montant_reel ?? normalizeNumberInput(actualAmount);
      // Solde à justifier = théorique backend (inclut recouvrements + fond + entrées - sorties)
      const soldeOp = totalTheorique;
      
      const getModeLabel = (mode: string) => getPaymentModeLabel(mode, t);

      const displayDetails = Object.entries(data.details || {}).filter(
        ([key]) => !key.startsWith('__') && key !== 'mouvements_audit' && key !== 'mouvements'
      );

      const manualMovements = (data.mouvements_manuels || []).map((m: unknown) => ({
        type: m.type,
        montant: m.montant,
        motif: m.motif,
        user_nom: data.user || 'Caissier',
        date: data.date_fin || data.end_date
      }));
      const existingMovements = (data.mouvements_audit || (data.details?.mouvements_audit) || []).map((m: unknown) => ({
        type: m.type,
        montant: m.montant,
        motif: m.motif,
        user_nom: m.user_nom,
        date: m.date
      }));
      const allMovements = [...manualMovements, ...existingMovements];

      const content = `
        <div style="font-family: monospace; width: 80mm; margin: 0 auto; padding: 10px; color: black; line-height: 1.2;">
            <div style="text-align: center; margin-bottom: 10px; border-bottom: 0.5px solid #999; padding-bottom: 5px;">
                <h2 style="margin: 0; font-size: 1.1em; font-weight: 500;">${escHtml(pharmacySettings?.pharmacy_name || 'Ma Pharmacie')}</h2>
                <div style="font-size: 0.8em; margin-top: 2px;">${t('print.report_title')}</div>
            </div>

            <div style="font-size: 0.8em; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>${t('print.print_date')}:</span>
                    <span>${formatDateTime(new Date().toISOString())}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>${t('print.operator')}:</span>
                    <span>${escHtml(data.user || 'Admin')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px dotted #ccc; padding-top: 5px;">
                    <span>${t('print.from')}: ${startStr}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>${t('print.to')}: ${endStr}</span>
                </div>
            </div>

            <div style="margin-bottom: 10px; background: #fff; padding: 5px; border: 0.5px solid #ccc;">
                <div style="font-weight: 500; margin-bottom: 3px; border-bottom: 0.5px solid #999; font-size: 0.85em;">${t('print.activity_title')}</div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>Ventes Pharmacie</span>
                    <span>${formatCurrencyLocal(data.total_ca_pharmacie ?? (data.details_paiement?.__meta__?.total_ca_pharmacie) ?? data.total_ventes)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>Ventes Diverses</span>
                    <span>${formatCurrencyLocal(data.total_ca_divers ?? data.details_paiement?.__meta__?.total_ca_divers ?? 0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 3px; padding-top: 2px; border-top: 1px dashed #ccc;">
                    <span style="font-weight: 500;">Total Ventes</span>
                    <span style="font-weight: 500;">${formatCurrencyLocal(data.total_ventes)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>${t('print.misc_entries')}</span>
                    <span>${formatCurrencyLocal(data.total_entrees)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>${t('print.expenses')}</span>
                    <span>-${formatCurrencyLocal(data.total_sorties)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 500; border-top: 0.5px dashed #999; margin-top: 3px; padding-top: 2px;">
                    <span>${t('print.solde_to_justify')}</span>
                    <span>${formatCurrencyLocal(soldeOp)}</span>
                </div>
            </div>

            ${allMovements.length > 0 ? `
            <div style="margin-bottom: 10px;">
                <div style="font-weight: 500; margin-bottom: 3px; border-bottom: 0.5px solid #999; font-size: 0.85em;">${t('print.expense_details')}</div>
                ${allMovements.map((m: unknown) => `
                    <div style="display: flex; justify-content: space-between; font-size: 0.75em; margin-bottom: 2px;">
                        <span style="max-width: 70%;">${escHtml(m.motif)} (${escHtml(m.user_nom)})</span>
                        <span style="font-weight: 500;">${formatCurrencyLocal(m.montant)}</span>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <div style="margin-bottom: 15px;">
                <div style="font-weight: 500; margin-bottom: 3px; border-bottom: 0.5px solid #999; font-size: 0.85em;">${t('print.mode_summary')}</div>
                ${displayDetails.map(([mode, montant]) => `
                    <div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-bottom: 1px;">
                        <span style="text-transform: capitalize;">${getModeLabel(mode)}</span>
                        <span>${formatCurrencyLocal(normalizeNumberInput(montant as unknown))}</span>
                    </div>
                `).join('')}
            </div>

            <div style="border-top: 0.5px solid #999; padding-top: 5px; margin-top: 5px;">
                <div style="display: flex; justify-content: space-between; font-weight: 500; font-size: 1.05em;">
                    <span>${t('print.total_to_justify')}</span>
                    <span>${formatCurrencyLocal(totalTheorique)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 3px;">
                    <span>${t('print.actual_amount')}</span>
                    <span>${formatCurrencyLocal(montantReel)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 500; border-top: 0.5px solid #999; margin-top: 3px; padding-top: 3px;">
                    <span>${t('print.cash_gap')}</span>
                    <span>${formatCurrencyLocal(montantReel - totalTheorique)}</span>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 30px; font-size: 0.7em;">
                <div style="text-align: center; width: 45%;">
                    <p style="margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">${t('print.cashier')}</p>
                </div>
                <div style="text-align: center; width: 45%;">
                    <p style="margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">${t('print.manager')}</p>
                </div>
            </div>
            
            <div style="text-align: center; font-size: 0.6em; margin-top: 15px; font-style: italic; opacity: 0.5;">
                ${t('print.footer', { date: formatDate(new Date().toISOString()) })}
            </div>
        </div>
      `;
      
      win.document.write('<html><head><title>' + t('print.window_title') + '</title>');
      win.document.write('<style>body { font-family: monospace; padding: 0; margin: 0; } @media print { body { padding: 0; margin: 0; } }</style>');
      win.document.write('</head><body>');
      win.document.write(content);
      win.document.write('</body></html>');
      win.document.close();
      win.print();
    }
  };

  const handleCloseCaisse = async () => {
    if (!actualAmount) return;
    
    setLoading(true);
    try {
      const response = await api.post('caisse/cloturer/', {
        montant_reel: normalizeNumberInput(actualAmount),
        montant_theorique_frontend: computedTheorique,
        date_debut: dateDebut ? toApiDateTime(dateDebut) : null,
        date_fin: dateFin ? toApiDateEnd(dateFin) : null,
        user_id: selectedUser,
        mouvements_manuels: manualMovements.map(m => ({ motif: m.motif, montant: m.montant, type: m.type }))
      });
      
      toast.success(t('messages.close_success'));
      const completeData = response.data.cloture;
      if (completeData) {
        setClosingTotals(completeData);
        setTimeout(() => {
            handleImprimerCloture(completeData);
        }, 500);
      }
      
      setIsClosingModalOpen(false);
      setManualMovements([]);
      fetchData();
    } catch (err) {
      console.error('Erreur clôture:', err);
      const errorMessage = getApiErrorDetail(err, err instanceof Error ? err.message : 'Erreur inconnue');
      setError(`${t('messages.close_error')}: ${errorMessage}`);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
    handleImprimerCloture,
    setTodayDateRange,
    
    theoriqueFrontend: computedTheorique,

    // Utils out for components
    t,
    currentLocale,
    formatCurrencyLocal
  };
}
