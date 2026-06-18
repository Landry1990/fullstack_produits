import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { getApiErrorDetail } from '../utils/errorHandling';
import { formatCurrency } from '../utils/formatters';
import { Button } from './shadcn/button';
import { Badge } from './shadcn/badge';
import { cn } from '../lib/utils';
import {
  FileSpreadsheet,
  CalendarDays,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileText,
  Send,
  Loader2
} from 'lucide-react';

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
      toast.success(t('common:telegram.send_success'), { icon: '📨' });
    } catch (err) {
      toast.error(getApiErrorDetail(err, t('common:telegram.send_error')));
    } finally {
      setSendingTelegram(null);
    }
  };

  const formatMoney = (amount: number) => {
    return formatCurrency(amount);
  };

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6 space-y-4 sm:space-y-6 font-sans">

      {/* Header Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-4 sm:mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {t('title')}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {t('subtitle')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 w-full sm:w-auto"
            onClick={handleExportExcel}
            disabled={exporting || data.length === 0}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
            {t('export_excel')}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4 bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-100">
          <div className="w-full sm:min-w-[200px] sm:flex-1">
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
              {t('start_date')}
            </label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="date"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={dateDebut}
                onChange={(e) => { setDateDebut(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
          <div className="w-full sm:min-w-[200px] sm:flex-1">
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
              {t('end_date')}
            </label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="date"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={dateFin}
                onChange={(e) => { setDateFin(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
          <Button
            size="sm"
            className="h-10 px-6 w-full sm:w-auto"
            onClick={() => { setCurrentPage(1); fetchHistory(); }}
          >
            <RefreshCw className="size-4" />
            {t('common:refresh')}
          </Button>
        </div>
      </div>

      {/* Main Content: Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-auto min-h-[450px] lg:h-[calc(100vh-28rem)]">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <div className="animate-spin rounded-full size-10 border-b-2 border-emerald-600"></div>
            <p className="text-slate-500 animate-pulse font-medium">{t('common:loading')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-auto flex-1 relative">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100 sticky top-0 z-10 opacity-100">
                  <tr>
                    <th className="py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('columns.date')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('columns.ca_ttc')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('columns.cash')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('columns.card')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('columns.check')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('columns.virement')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('columns.mobiles')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('columns.coupons')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('columns.en_compte')}</th>
                    <th className="text-center py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('columns.nb_ventes')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('columns.avg_basket')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">Marge</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">Remises</th>
                    <th className="text-center py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">Telegram</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {data.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50 transition-colors">
                      <td className="font-semibold text-slate-700 whitespace-nowrap py-3 px-2">
                        <div className="flex flex-col">
                          <span className="text-sm">{format(new Date(row.date), 'dd/MM/yyyy')}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{format(new Date(row.date), 'EEEE', { locale: (window as any).dateLocale })}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2">
                        <Badge variant="default" className="font-bold">
                          {formatMoney(row.ca_ttc)}
                        </Badge>
                      </td>
                      <td className="text-right font-mono text-sm py-3 px-2 text-slate-700">{formatMoney(row.especes)}</td>
                      <td className="text-right font-mono text-sm py-3 px-2 text-slate-500">{formatMoney(row.carte)}</td>
                      <td className="text-right font-mono text-sm py-3 px-2 text-slate-500">{formatMoney(row.cheque)}</td>
                      <td className="text-right font-mono text-sm py-3 px-2 text-slate-500">{formatMoney(row.virement)}</td>
                      <td className="text-right font-mono text-sm py-3 px-2 text-slate-700">{formatMoney(row.om + row.momo)}</td>
                      <td className="text-right font-mono text-sm py-3 px-2 text-slate-500 italic">{formatMoney(row.coupon || 0)}</td>
                      <td className="text-right font-mono text-sm py-3 px-2 text-amber-600">{formatMoney(row.en_compte || 0)}</td>
                      <td className="text-center py-3 px-2">
                        <Badge variant="outline" className="text-slate-600 border-slate-200">
                          {row.nb_ventes}
                        </Badge>
                      </td>
                      <td className="text-right font-medium py-3 px-2 text-slate-700">{formatMoney(row.panier_moyen)}</td>
                      <td className="text-right font-mono text-sm py-3 px-2 text-emerald-600 font-semibold">{formatMoney(row.marge || 0)}</td>
                      <td className="text-right font-mono text-sm py-3 px-2 text-red-600">{formatMoney(row.remise || 0)}</td>
                      <td className="text-center py-3 px-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#229ED9] hover:bg-[#229ED9]/10 h-8 w-8 p-0"
                          onClick={() => handleSendTelegramFlash(row)}
                          disabled={sendingTelegram !== null}
                          title={t('common:telegram.send_report')}
                        >
                          {sendingTelegram === row.date ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Send className="size-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={14} className="h-64 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <FileText className="size-12 text-slate-300" />
                          <p className="text-lg font-medium">{t('no_data')}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                {globalTotals && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr className="text-slate-700 font-bold">
                      <td className="py-4 px-2 whitespace-nowrap">
                        <span className="uppercase text-[10px] tracking-tight">{t('total_period')}</span>
                      </td>
                      <td className="text-right py-4 px-2 text-emerald-600 text-lg">{formatMoney(globalTotals.ca_ttc)}</td>
                      <td className="text-right py-4 px-2">{formatMoney(globalTotals.especes)}</td>
                      <td className="text-right py-4 px-2 text-slate-500">{formatMoney(globalTotals.carte)}</td>
                      <td className="text-right py-4 px-2 text-slate-500">{formatMoney(globalTotals.cheque)}</td>
                      <td className="text-right py-4 px-2 text-slate-500">{formatMoney(globalTotals.virement)}</td>
                      <td className="text-right py-4 px-2">{formatMoney(globalTotals.om + globalTotals.momo)}</td>
                      <td className="text-right py-4 px-2 text-slate-500">{formatMoney(globalTotals.coupon)}</td>
                      <td className="text-right py-4 px-2 text-amber-600">{formatMoney(globalTotals.en_compte || 0)}</td>
                      <td className="text-center py-4 px-2">
                        <Badge variant="default">{globalTotals.nb_ventes}</Badge>
                      </td>
                      <td className="text-right py-4 px-2">-</td>
                      <td className="text-right py-4 px-2 text-emerald-600 font-semibold">{formatMoney(globalTotals.marge || 0)}</td>
                      <td className="text-right py-4 px-2 text-red-600">{formatMoney(globalTotals.remise || 0)}</td>
                      <td className="px-2"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="bg-white border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
              <span className="text-sm text-slate-500">
                {t('pagination.showing')} <span className="font-bold text-slate-700">{data.length}</span> {t('pagination.days_of')} <span className="font-bold text-slate-700">{totalItems}</span> {t('pagination.total')}
              </span>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="size-4" />
                  {t('pagination.prev')}
                </Button>
                <span className="px-3 py-1.5 text-xs font-bold bg-slate-100 rounded-md flex items-center">
                  {t('pagination.page')} {currentPage} / {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0 || loading}
                >
                  {t('pagination.next')}
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HistoriqueVentes;
