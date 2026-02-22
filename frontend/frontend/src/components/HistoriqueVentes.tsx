import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';

interface DailySale {
  date: string;
  nb_ventes: number;
  ca_ht: number;
  tva: number;
  ca_ttc: number;
  panier_moyen: number;
  especes: number;
  carte: number;
  cheque: number;
  virement: number;
  om: number;
  momo: number;
  coupon: number;
}

const HistoriqueVentes = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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

      const response = await axios.get(`/api/historique-ventes/?${params.toString()}`, {
        headers: {
          Authorization: `Token ${user.token}`
        }
      });
      
      const { results, count, totals } = response.data;
      setData(results || []);
      setTotalItems(count || 0);
      setGlobalTotals(totals || null);
    } catch (error) {
      console.error('Error fetching sales history:', error);
      toast.error("Erreur lors du chargement de l'historique");
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

      const response = await axios.get(`/api/historique-ventes/exporter_excel/?${params.toString()}`, {
        headers: { Authorization: `Token ${user.token}` },
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
      toast.success("Export Excel réussi");
    } catch (error) {
      console.error('Export Error:', error);
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setExporting(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(amount);
  };

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
      
      {/* Header Section */}
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col p-6">
        <div className="flex justify-between items-start mb-6">
            <div>
                <h1 className="text-2xl font-bold text-base-content tracking-tight">
                    {t('salesHistory.title') || "Historique des Ventes"}
                </h1>
                <p className="text-base-content/60 text-sm mt-1">
                    Consultez et exportez vos statistiques de ventes quotidiennes
                </p>
            </div>
            <button 
                className={`btn btn-outline btn-success gap-2 ${exporting ? 'loading' : ''}`}
                onClick={handleExportExcel}
                disabled={exporting || data.length === 0}
            >
                {!exporting && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                )}
                Exporter Excel
            </button>
        </div>

        <div className="flex flex-wrap items-end gap-4 bg-base-200/50 p-4 rounded-xl border border-base-200">
            <div className="form-control">
                <label className="label py-1">
                    <span className="label-text text-xs font-semibold uppercase opacity-60">{t('salesHistory.start_date')}</span>
                </label>
                <input 
                    type="date" 
                    className="input input-bordered input-sm h-10" 
                    value={dateDebut}
                    onChange={(e) => { setDateDebut(e.target.value); setCurrentPage(1); }}
                />
            </div>
            <div className="form-control">
                <label className="label py-1">
                    <span className="label-text text-xs font-semibold uppercase opacity-60">{t('salesHistory.end_date')}</span>
                </label>
                <input 
                    type="date" 
                    className="input input-bordered input-sm h-10" 
                    value={dateFin}
                    onChange={(e) => { setDateFin(e.target.value); setCurrentPage(1); }}
                />
            </div>
            <button className="btn btn-primary btn-sm h-10 px-6" onClick={() => { setCurrentPage(1); fetchHistory(); }}>
                {t('common.refresh')}
            </button>
        </div>
      </div>

      {/* Main Content: Table */}
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden">
        {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-base-content/60 animate-pulse font-medium">Chargement de l'historique...</p>
            </div>
        ) : (
            <>
                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead>
                            <tr className="bg-base-200/50 text-base-content/70 border-b border-base-200 text-[10px] uppercase tracking-widest font-bold">
                                <th className="bg-transparent">{t('salesHistory.columns.date')}</th>
                                <th className="bg-transparent text-right">{t('salesHistory.columns.ca_ttc')}</th>
                                <th className="bg-transparent text-right">Espèces</th>
                                <th className="bg-transparent text-right">Cartes</th>
                                <th className="bg-transparent text-right">Chèques</th>
                                <th className="bg-transparent text-right">Virem.</th>
                                <th className="bg-transparent text-right">Mobiles</th>
                                <th className="bg-transparent text-right">Coupons</th>
                                <th className="bg-transparent text-center">Ventes</th>
                                <th className="bg-transparent text-right">Panier M.</th>
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
                                    <td className="text-center py-3">
                                        <div className="badge badge-sm badge-outline opacity-70">{row.nb_ventes}</div>
                                    </td>
                                    <td className="text-right font-medium py-3">{formatMoney(row.panier_moyen)}</td>
                                </tr>
                            ))}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="text-center py-20">
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="text-lg font-medium">{t('salesHistory.no_data')}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {globalTotals && (
                            <tfoot className="bg-base-200/40 border-t-2 border-base-300">
                                <tr className="text-base-content font-bold">
                                    <td className="py-4 whitespace-nowrap">
                                        <span className="uppercase text-[10px] tracking-tight">TOTAL PÉRIODE</span>
                                    </td>
                                    <td className="text-right py-4 text-primary text-lg">{formatMoney(globalTotals.ca_ttc)}</td>
                                    <td className="text-right py-4">{formatMoney(globalTotals.especes)}</td>
                                    <td className="text-right py-4 opacity-70">{formatMoney(globalTotals.carte)}</td>
                                    <td className="text-right py-4 opacity-70">{formatMoney(globalTotals.cheque)}</td>
                                    <td className="text-right py-4 opacity-70">{formatMoney(globalTotals.virement)}</td>
                                    <td className="text-right py-4">{formatMoney(globalTotals.om + globalTotals.momo)}</td>
                                    <td className="text-right py-4 text-secondary">{formatMoney(globalTotals.coupon)}</td>
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
                <div className="p-6 border-t border-base-200 flex flex-col sm:flex-row items-center justify-between bg-base-100 gap-4">
                    <div className="text-sm font-medium text-base-content/60">
                        Affichage de <span className="text-base-content font-bold">{data.length}</span> jours sur <span className="text-base-content font-bold">{totalItems}</span> au total
                    </div>
                    
                    <div className="join shadow-sm">
                        <button 
                            className="join-item btn btn-sm btn-outline h-10 px-4"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1 || loading}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Précédent
                        </button>
                        <div className="join-item btn btn-sm btn-ghost no-animation h-10 px-6 font-bold bg-base-200">
                            Page {currentPage} / {totalPages || 1}
                        </div>
                        <button 
                            className="join-item btn btn-sm btn-outline h-10 px-4"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0 || loading}
                        >
                            Suivant
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
