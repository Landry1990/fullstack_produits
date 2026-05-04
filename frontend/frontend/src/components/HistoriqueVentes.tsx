import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';

interface DailySale {
  date: string;
  nb_ventes: number;
  ca_ht: number;
  tva: number;
  ca_ttc: number;
  panier_moyen: number;
  marge: number;
  remise: number;
  especes: number;
  carte: number;
  cheque: number;
  virement: number;
  om: number;
  momo: number;
  coupon: number;
  en_compte: number;
}

const HistoriqueVentes = () => {
  const { user } = useAuth();
  const { t } = useTranslation(['sales_history', 'common']);
  const [data, setData] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(31);
  const [totalItems, setTotalItems] = useState(0);
  const [globalTotals, setGlobalTotals] = useState<any>(null);

  const fetchHistory = useCallback(async () => {
    if (!user?.token) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateDebut) params.append('date_debut', dateDebut);
      if (dateFin) params.append('date_fin', dateFin);
      params.append('page', currentPage.toString());
      params.append('page_size', pageSize.toString());

      const response = await api.get(`historique-ventes/?${params.toString()}`);
      
      const { results, count, totals } = response.data;
      setData(results || []);
      setTotalItems(count || 0);
      setGlobalTotals(totals || null);
    } catch (error) {
      console.error('Error fetching sales history:', error);
      toast.error(t('messages.error_loading'));
    } finally {
      setLoading(false);
    }
  }, [user?.token, dateDebut, dateFin, currentPage, pageSize]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleExportExcel = async () => {
    if (!user?.token) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateDebut) params.append('date_debut', dateDebut);
      if (dateFin) params.append('date_fin', dateFin);

      const response = await api.get(`historique-ventes/exporter_excel/?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Historique_Ventes_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('messages.export_success'));
    } catch (error) {
      console.error('Export Error:', error);
      toast.error(t('messages.export_error'));
    } finally {
      setExporting(false);
    }
  };

  const handleSendTelegramFlash = async (row: DailySale) => {
    setSendingTelegram(row.date);
    try {
      await api.post('telegram/rapport-flash-date/', { date: row.date });
      toast.success(`Rapport du ${row.date} envoyé sur Telegram !`, { icon: '📨' });
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erreur envoi Telegram';
      toast.error(msg);
    } finally {
      setSendingTelegram(null);
    }
  };

  const formatMoney = (amount: number) => {
    return formatCurrency(amount);
  };

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="min-h-screen bg-base-200 p-3 sm:p-6 space-y-4 sm:space-y-6 font-sans">
      
      {/* Header Section */}
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col p-4 sm:p-6 sticky-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-4 sm:mb-6">
            <div>
                <h1 className="text-2xl font-bold text-base-content tracking-tight">
                    {t('title')}
                </h1>
                <p className="text-base-content/60 text-sm mt-1">
                    {t('subtitle')}
                </p>
            </div>
            <button 
                className={`btn btn-outline btn-success gap-2 w-full sm:w-auto ${exporting ? 'loading' : ''}`}
                onClick={handleExportExcel}
                disabled={exporting || data.length === 0}
            >
                {!exporting && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                )}
                {t('export_excel')}
            </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4 bg-base-200/50 p-3 sm:p-4 rounded-xl border border-base-200">
            <div className="form-control w-full sm:min-w-[200px] sm:flex-1">
                <label className="label py-1">
                    <span className="label-text text-xs font-semibold uppercase opacity-60">{t('start_date')}</span>
                </label>
                <input 
                    type="date" 
                    className="input input-bordered input-sm h-10 w-full" 
                    value={dateDebut}
                    onChange={(e) => { setDateDebut(e.target.value); setCurrentPage(1); }}
                />
            </div>
            <div className="form-control w-full sm:min-w-[200px] sm:flex-1">
                <label className="label py-1">
                    <span className="label-text text-xs font-semibold uppercase opacity-60">{t('end_date')}</span>
                </label>
                <input 
                    type="date" 
                    className="input input-bordered input-sm h-10 w-full" 
                    value={dateFin}
                    onChange={(e) => { setDateFin(e.target.value); setCurrentPage(1); }}
                />
            </div>
            <button className="btn btn-primary btn-sm h-10 px-6 w-full sm:w-auto" onClick={() => { setCurrentPage(1); fetchHistory(); }}>
                {t('common:refresh')}
            </button>
        </div>
      </div>

      {/* Main Content: Table */}
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col h-auto min-h-[450px] lg:h-[calc(100vh-28rem)]">
        {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-base-content/60 animate-pulse font-medium">{t('common:loading')}</p>
            </div>
        ) : (
            <>
                <div className="overflow-auto flex-1 relative">
                    <table className="table table-pin-rows table-zebra w-full shadow-inner">
                        <thead>
                            <tr className="bg-base-200 text-base-content/70 border-b border-base-300 text-[10px] uppercase tracking-widest font-bold">
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300">{t('columns.date')}</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-right">{t('columns.ca_ttc')}</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-right">{t('columns.cash')}</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-right">{t('columns.card')}</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-right">{t('columns.check')}</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-right">{t('columns.virement')}</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-right">{t('columns.mobiles')}</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-right">{t('columns.coupons')}</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-right">{t('columns.en_compte')}</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-center">{t('columns.nb_ventes')}</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-right">{t('columns.avg_basket')}</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-right">Marge</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-right">Remises</th>
                                <th className="bg-base-200 sticky top-0 z-30 opacity-100 border-b border-base-300 text-center">Telegram</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-200">
                            {data.map((row) => (
                                <tr key={row.date} className="hover:bg-base-200/30 transition-colors group">
                                    <td className="font-semibold text-base-content/80 whitespace-nowrap py-3">
                                        <div className="flex flex-col">
                                            <span>{format(new Date(row.date), 'dd/MM/yyyy')}</span>
                                            <span className="text-[10px] opacity-40 font-normal">{format(new Date(row.date), 'EEEE', { locale: (window as any).dateLocale })}</span>
                                        </div>
                                    </td>
                                    <td className="text-right py-3">
                                        <div className="badge badge-ghost font-bold text-primary border-none bg-primary/10">
                                            {formatMoney(row.ca_ttc)}
                                        </div>
                                    </td>
                                    <td className="text-right font-mono text-sm py-3">{formatMoney(row.especes)}</td>
                                    <td className="text-right font-mono text-sm py-3 opacity-70">{formatMoney(row.carte)}</td>
                                    <td className="text-right font-mono text-sm py-3 opacity-70">{formatMoney(row.cheque)}</td>
                                    <td className="text-right font-mono text-sm py-3 opacity-70">{formatMoney(row.virement)}</td>
                                    <td className="text-right font-mono text-sm py-3">{formatMoney(row.om + row.momo)}</td>
                                    <td className="text-right font-mono text-sm py-3 text-secondary italic">{formatMoney(row.coupon || 0)}</td>
                                    <td className="text-right font-mono text-sm py-3 text-warning">{formatMoney(row.en_compte || 0)}</td>
                                    <td className="text-center py-3">
                                        <div className="badge badge-sm badge-outline opacity-70">{row.nb_ventes}</div>
                                    </td>
                                    <td className="text-right font-medium py-3">{formatMoney(row.panier_moyen)}</td>
                                    <td className="text-right font-mono text-sm py-3 text-success font-semibold">{formatMoney(row.marge || 0)}</td>
                                    <td className="text-right font-mono text-sm py-3 text-error">{formatMoney(row.remise || 0)}</td>
                                    <td className="text-center py-3">
                                      <button
                                        className={`btn btn-xs btn-ghost text-[#229ED9] hover:bg-[#229ED9]/10 ${sendingTelegram === row.date ? 'loading' : ''}`}
                                        onClick={() => handleSendTelegramFlash(row)}
                                        disabled={sendingTelegram !== null}
                                        title={`Envoyer rapport du ${row.date} sur Telegram`}
                                      >
                                        {sendingTelegram !== row.date && (
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.67l-2.93-.918c-.638-.196-.65-.638.136-.943l11.434-4.41c.53-.194.995.131.822.943z"/>
                                          </svg>
                                        )}
                                      </button>
                                    </td>
                                </tr>
                            ))}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="text-center py-20">
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="text-lg font-medium">{t('no_data')}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {globalTotals && (
                            <tfoot className="bg-base-200/40 border-t-2 border-base-300">
                                <tr className="text-base-content font-bold">
                                    <td className="py-4 whitespace-nowrap">
                                        <span className="uppercase text-[10px] tracking-tight">{t('total_period')}</span>
                                    </td>
                                    <td className="text-right py-4 text-primary text-lg">{formatMoney(globalTotals.ca_ttc)}</td>
                                    <td className="text-right py-4">{formatMoney(globalTotals.especes)}</td>
                                    <td className="text-right py-4 opacity-70">{formatMoney(globalTotals.carte)}</td>
                                    <td className="text-right py-4 opacity-70">{formatMoney(globalTotals.cheque)}</td>
                                    <td className="text-right py-4 opacity-70">{formatMoney(globalTotals.virement)}</td>
                                    <td className="text-right py-4">{formatMoney(globalTotals.om + globalTotals.momo)}</td>
                                    <td className="text-right py-4 text-secondary">{formatMoney(globalTotals.coupon)}</td>
                                    <td className="text-right py-4 text-warning">{formatMoney(globalTotals.en_compte || 0)}</td>
                                    <td className="text-center py-4">
                                        <div className="badge badge-primary">{globalTotals.nb_ventes}</div>
                                    </td>
                                    <td className="text-right py-4">-</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 sm:p-6 border-t border-base-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-base-100 gap-3 sm:gap-4">
                    <div className="text-sm font-medium text-base-content/60 text-center sm:text-left">
                        {t('pagination.showing')} <span className="text-base-content font-bold">{data.length}</span> {t('pagination.days_of')} <span className="text-base-content font-bold">{totalItems}</span> {t('pagination.total')}
                    </div>
                    
                    <div className="join shadow-sm w-full sm:w-auto">
                        <button 
                            className="join-item btn btn-sm btn-outline h-10 px-4"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1 || loading}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            {t('pagination.prev')}
                        </button>
                        <div className="join-item btn btn-sm btn-ghost no-animation h-10 px-6 font-bold bg-base-200">
                            {t('pagination.page')} {currentPage} / {totalPages || 1}
                        </div>
                        <button 
                            className="join-item btn btn-sm btn-outline h-10 px-4"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0 || loading}
                        >
                            {t('pagination.next')}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default HistoriqueVentes;
