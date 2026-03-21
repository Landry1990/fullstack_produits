import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import type { CaisseTransaction, MouvementCaisse } from '../types';
import { usePharmacySettings } from './usePharmacySettings';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { formatCurrency, normalizeNumberInput } from '../utils/formatters';

export function useJournalCaisse() {
  const { t } = useTranslation(['cash_journal', 'common']);
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

  const [users, setUsers] = useState<any[]>([]);
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
    mouvements_audit?: any[]
  } | null>(null);

  const [detectedShift, setDetectedShift] = useState<{
    start: Date,
    end: Date,
    active: boolean
  } | null>(null);

  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingTotals, setClosingTotals] = useState<{
    start_date: string | null,
    end_date?: string | null,
    total_theorique: number,
    total_ventes: number,
    total_recouvrement: number,
    total_entrees: number,
    total_sorties: number,
    details: Record<string, number>,
    user?: string
  } | null>(null);
  const [actualAmount, setActualAmount] = useState<string>('');

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

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : '';
  }, []);

  const caisseEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/caisse/` : '/api/caisse/';

  const isInitialMount = useRef(true);
  const hasLoadedOnce = useRef(false);

  const formatLocalISOString = (date: Date): string => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  const processTransactionsData = useCallback((data: any) => {
    if (data.results) {
      setTransactions(data.results);
      setTotalCount(data.count || 0);
      setTotalPages(Math.ceil((data.count || 0) / 50));
    } else {
      setTransactions(Array.isArray(data) ? data : []);
      setTotalCount(Array.isArray(data) ? data.length : 0);
      setTotalPages(1);
    }
  }, []);

  const fetchPageInit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', '1');
      if (selectedUser) params.append('user', selectedUser);
      if (dateDebut) params.append('date_debut', formatLocalISOString(dateDebut));
      if (dateFin) params.append('date_fin', formatLocalISOString(dateFin));

      const response = await axios.get(`${caisseEndpoint}page_init/`, { params });
      const { transactions: txData, mouvements: mouvData, totals: totalsData, users: usersData } = response.data;

      processTransactionsData(txData);
      setMouvements(Array.isArray(mouvData) ? mouvData : (mouvData?.results || []));
      if (totalsData) setServerTotals(totalsData);
      if (usersData) setUsers(usersData);
    } catch (err) {
      setError(t('table.loading_error') || 'Erreur lors du chargement des données');
      console.error('Erreur page_init caisse:', err);
    } finally {
      setLoading(false);
    }
  }, [caisseEndpoint, selectedUser, dateDebut, dateFin, processTransactionsData, t]);

  useEffect(() => {
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      fetchPageInit();
    }
  }, [fetchPageInit]);

  useEffect(() => {
    if (isInitialMount.current) return;
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setPage(1);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, dateDebut, dateFin]);

  useEffect(() => {
    if (selectedUser) {
      handleUserShiftDetection(selectedUser);
    } else {
      setDetectedShift(null);
      const today = getServerDate();
      today.setHours(0, 0, 0, 0);
      const endToday = getServerDate();
      endToday.setHours(23, 59, 59, 999);
      setDateDebut(today);
      setDateFin(endToday);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  const handleUserShiftDetection = async (userId: string) => {
    try {
      const response = await axios.get(`${caisseEndpoint}get_user_shift/`, {
        params: { user_id: userId }
      });
      const { start_date, end_date, has_activity } = response.data;
      
      if (has_activity && start_date) {
        const start = new Date(start_date);
        const end = end_date ? new Date(end_date) : new Date();
        
        setDetectedShift({ start, end, active: true });
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
      }
    } catch (err) {
      console.error("Erreur détection shift:", err);
      setDetectedShift(null);
    }
  };

  const fetchData = async () => {
    await fetchPageInit();
  };

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      if (selectedUser) params.append('user', selectedUser);
      if (dateDebut) params.append('date_debut', formatLocalISOString(dateDebut));
      if (dateFin) params.append('date_fin', formatLocalISOString(dateFin));
      
      const response = await axios.get(caisseEndpoint, { params });
      processTransactionsData(response.data);
    } catch (err) {
      console.error('Erreur:', err);
      throw err;
    }
  };

  const filteredItems = useMemo(() => {
    const filteredTrans = transactions.filter(transaction => {
      const matchesSearch = searchQuery === '' || 
        transaction.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.facture_numero?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.user_details?.full_name.toLowerCase().includes(searchQuery.toLowerCase());

      if (transaction.mode_paiement === 'en_compte') return false;
      if (filterType !== 'all') return false;

      const matchesMode = filterMode === 'all' || transaction.mode_paiement === filterMode;

      let matchesDate = true;
      if (dateDebut && dateFin) {
        const transactionDate = new Date(transaction.date_paiement);
        const debut = dateDebut;
        const fin = new Date(dateFin);
        fin.setHours(23, 59, 59, 999);
        matchesDate = transactionDate >= debut && transactionDate <= fin;
      }

      return matchesSearch && matchesMode && matchesDate;
    });

    const filteredMouvs = mouvements.filter(mouv => {
       const matchesSearch = searchQuery === '' || 
        mouv.motif.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (mouv.description && mouv.description.toLowerCase().includes(searchQuery.toLowerCase()));

       const matchesMode = filterMode === 'all' || filterMode === 'especes';

       const matchesType = filterType === 'all' || 
        (filterType === 'entrees' && mouv.type === 'ENTREE') ||
        (filterType === 'sorties' && mouv.type === 'SORTIE');

       let matchesDate = true;
       if (dateDebut && dateFin) {
        const d = new Date(mouv.date);
        const debut = dateDebut;
        const fin = new Date(dateFin);
        fin.setHours(23, 59, 59, 999);
        matchesDate = d >= debut && d <= fin;
      }
      return matchesSearch && matchesMode && matchesDate && matchesType;
    });

    const combined = [
        ...filteredTrans.map(t => ({ ...t, _kind: 'transaction' as const })),
        ...filteredMouvs.map(m => ({ ...m, _kind: 'mouvement' as const, date_paiement: m.date }))
    ];
    
    return combined.sort((a, b) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime());

  }, [transactions, mouvements, searchQuery, filterMode, filterType, dateDebut, dateFin]);

  const groupedItems = useMemo(() => {
     const result: any[] = [];
     const processedReleves = new Set<number>();
     
     filteredItems.forEach((item: any) => {
         if (item._kind === 'mouvement') {
             result.push(item);
         } else {
             const t = item as CaisseTransaction;
             if (t.releve_id) {
                 if (!processedReleves.has(t.releve_id)) {
                     const releveItems = filteredItems.filter((rt: any) => rt._kind === 'transaction' && rt.releve_id === t.releve_id) as CaisseTransaction[];
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
                 result.push(t);
             }
         }
     });
     
     return result;
  }, [filteredItems]);

  const totauxParMode = useMemo(() => {
    const totaux = {
      especes: 0,
      cheque: 0,
      carte: 0,
      virement: 0,
      om: 0,
      momo: 0,
      en_compte: 0,
      total: 0,
      entrees: 0,
      sorties: 0,
      recouvrement: 0,
      ventes: 0,
      ventes_par_mode: { especes: 0, cheque: 0, carte: 0, virement: 0, om: 0, momo: 0 } as Record<string, number>,
      recouv_par_mode: { especes: 0, cheque: 0, carte: 0, virement: 0, om: 0, momo: 0 } as Record<string, number>
    };

    filteredItems.forEach((item: any) => {
       const montant = normalizeNumberInput(item.montant);
       if (item._kind === 'mouvement') {
           if (item.type === 'ENTREE') {
               totaux.entrees += montant;
               totaux.total += montant;
           } else {
               totaux.sorties += montant;
               totaux.total -= montant;
           }
       } else {
          if (item.statut === 'completee') {
            const isRecouvrement = item.mode_paiement === 'recouvrement' || item.is_creance_settlement || (item.reference && item.reference.includes('[RECOUV]'));
            
            if (isRecouvrement) {
                totaux.recouvrement += montant;
                if (totaux.recouv_par_mode[item.mode_paiement] !== undefined) {
                    totaux.recouv_par_mode[item.mode_paiement] += montant;
                }
            } else {
                totaux.ventes += montant;
                if (totaux.ventes_par_mode[item.mode_paiement] !== undefined) {
                    totaux.ventes_par_mode[item.mode_paiement] += montant;
                }
                
                if (totaux[item.mode_paiement as keyof typeof totaux] !== undefined) {
                    (totaux as any)[item.mode_paiement] += montant;
                }
                
                if (item.mode_paiement === 'especes') {
                    totaux.total += montant;
                }
            }
          }
       }
    });

    return totaux;
  }, [filteredItems]);

  const openClosingModal = () => {
      const currentTotals = (serverTotals || totauxParMode) as any;
      
      const modalTotals = {
          start_date: dateDebut ? formatLocalISOString(dateDebut) : currentTotals?.start_date || null,
          end_date: dateFin ? formatLocalISOString(dateFin) : null,
          total_theorique: currentTotals.total_theorique ?? currentTotals.total,
          total_ventes: currentTotals.total_ventes ?? currentTotals.ventes,
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
      setIsClosingModalOpen(true);
  };

  const handleImprimerCloture = (dataToPrint?: any) => {
    const data = dataToPrint || closingTotals;
    if (!data) return;

    const win = window.open('', '_blank', 'width=800,height=600');
    if (win) {
      const startStr = data.start_date ? new Date(data.start_date).toLocaleString(currentLocale) : '--';
      const endStr = data.date_fin ? new Date(data.date_fin).toLocaleString(currentLocale) : '--';
      
      const soldeOp = (data.total_ventes || 0) + (data.total_entrees || 0) - (data.total_sorties || 0);
      
      const displayDetails = Object.entries(data.details || {}).filter(
        ([key]) => !key.startsWith('__') && key !== 'mouvements_audit' && key !== 'mouvements'
      );

      const movementsAudit = data.mouvements_audit || [];

      const content = `
        <div style="font-family: monospace; width: 80mm; margin: 0 auto; padding: 10px; color: black; line-height: 1.2;">
            <div style="text-align: center; margin-bottom: 10px; border-bottom: 2px solid black; padding-bottom: 5px;">
                <h2 style="margin: 0; font-size: 1.1em; font-weight: bold;">${pharmacySettings?.pharmacy_name || 'Ma Pharmacie'}</h2>
                <div style="font-size: 0.8em; margin-top: 2px;">${t('print.report_title')}</div>
            </div>

            <div style="font-size: 0.8em; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>${t('print.print_date')}:</span>
                    <span>${new Date().toLocaleDateString(currentLocale)} ${new Date().toLocaleTimeString(currentLocale)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>${t('print.operator')}:</span>
                    <span>${data.user || 'Admin'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px dotted #ccc; padding-top: 5px;">
                    <span>${t('print.from')}: ${startStr}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>${t('print.to')}: ${endStr}</span>
                </div>
            </div>

            <div style="margin-bottom: 10px; background: #f9f9f9; padding: 5px; border: 1px solid #eee;">
                <div style="font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid black; font-size: 0.85em;">${t('print.activity_title')}</div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>${t('print.net_sales')}</span>
                    <span>${formatCurrencyLocal(data.total_ventes)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>${t('print.misc_entries')}</span>
                    <span>${formatCurrencyLocal(data.total_entrees)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>${t('print.expenses')}</span>
                    <span>-${formatCurrencyLocal(data.total_sorties)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px dashed black; margin-top: 3px; padding-top: 2px;">
                    <span>${t('print.solde_to_justify')}</span>
                    <span>${formatCurrencyLocal(soldeOp)}</span>
                </div>
            </div>

            ${movementsAudit.length > 0 ? `
            <div style="margin-bottom: 10px;">
                <div style="font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid black; font-size: 0.85em;">${t('print.expense_details')}</div>
                ${movementsAudit.map((m: any) => `
                    <div style="display: flex; justify-content: space-between; font-size: 0.75em; margin-bottom: 2px;">
                        <span style="max-width: 70%;">${m.motif} (${m.user_nom})</span>
                        <span style="font-weight: bold;">${formatCurrencyLocal(m.montant)}</span>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <div style="margin-bottom: 15px;">
                <div style="font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid black; font-size: 0.85em;">${t('print.mode_summary')}</div>
                ${displayDetails.map(([mode, montant]) => `
                    <div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-bottom: 1px;">
                        <span style="text-transform: capitalize;">${mode}</span>
                        <span>${formatCurrencyLocal(normalizeNumberInput(montant as any))}</span>
                    </div>
                `).join('')}
            </div>

            <div style="border-top: 2px solid black; padding-top: 5px; margin-top: 5px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.05em;">
                    <span>${t('print.total_to_justify')}</span>
                    <span>${formatCurrencyLocal(data.total_theorique)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 3px;">
                    <span>${t('print.actual_amount')}</span>
                    <span>${actualAmount ? formatCurrencyLocal(normalizeNumberInput(actualAmount)) : '_________'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px solid black; margin-top: 3px; padding-top: 3px;">
                    <span>${t('print.cash_gap')}</span>
                    <span>${actualAmount ? formatCurrencyLocal(normalizeNumberInput(actualAmount) - data.total_theorique) : '_________'}</span>
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
                ${t('print.footer', { date: new Date().toLocaleDateString(currentLocale) })}
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
      const response = await axios.post(`${caisseEndpoint}cloturer/`, {
        montant_reel: normalizeNumberInput(actualAmount),
        date_debut: dateDebut ? formatLocalISOString(dateDebut) : null,
        date_fin: dateFin ? formatLocalISOString(dateFin) : null,
        user_id: selectedUser
      });
      
      toast.success(t('messages.close_success'));
      const completeData = response.data.cloture;
      setClosingTotals(completeData);
      
      setTimeout(() => {
          handleImprimerCloture(completeData);
      }, 500);
      
      setIsClosingModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Erreur clôture:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Erreur inconnue';
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
    
    // Utils out for components
    t,
    currentLocale,
    formatCurrencyLocal
  };
}
