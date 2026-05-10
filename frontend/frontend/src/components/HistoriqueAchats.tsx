import { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Calendar, RefreshCw, Package, TrendingUp, ChevronLeft, ChevronRight, FileDown, Printer } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { usePharmacySettings } from '../hooks/usePharmacySettings';
import { exportToExcel } from '../utils/excelExport';

interface DailyPurchase {
  date: string;
  nb_commandes: number;
  total_achat: number;
}

interface DetailedPurchase {
  produit_id: number;
  produit__name: string;
  produit__cip1: string;
  total_quantite: number;
  total_achat: number;
  nb_commandes: number;
}

interface Supplier {
  id: number;
  name: string;
}

interface HistoriqueAchatsProps {
    forcedType?: 'LOC' | 'DIR';
}

const HistoriqueAchats = ({ forcedType }: HistoriqueAchatsProps) => {
  const { t, i18n } = useTranslation('orders');
  const { user } = useAuth();
  const { settings: pharmacySettings } = usePharmacySettings();
  const [data, setData] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Global Totals from Backend
  const [globalTotals, setGlobalTotals] = useState({
    total_achat_global: 0,
    nb_commandes_global: 0,
    total_produits_global: 0
  });

  // Filters
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'summary' | 'details'>('summary');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Suppliers on mount
  useEffect(() => {
    const fetchSuppliers = async () => {
        if (!user?.token) return;
        try {
            const response = await api.get('fournisseurs/');
            const data = response.data;
            setSuppliers(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        }
    };
    fetchSuppliers();
  }, [user]);

  const fetchHistory = async (targetPage = page) => {
    if (!user?.token) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', targetPage.toString());
      if (dateDebut) params.append('date_debut', dateDebut);
      if (dateFin) params.append('date_fin', dateFin);
      if (selectedSupplier) params.append('fournisseur_id', selectedSupplier);
      if (forcedType) params.append('type', forcedType);

      const endpoint = activeTab === 'summary' ? 'historique-achats/' : 'historique-achats/produits_details/';
      
      const response = await api.get(`${endpoint}?${params.toString()}`);
      
      if (response.data.results) {
        setData(response.data.results);
        setTotalCount(response.data.count);
        if (response.data.extras) {
          setGlobalTotals(response.data.extras);
        }
      } else {
        setData(response.data);
        setTotalCount(response.data.length);
      }
    } catch (error) {
      console.error('Error fetching purchase history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      setData([]); // Reset data to avoid "Invalid Date" errors when switching tabs
      setPage(1);
      fetchHistory(1);
    }
  }, [dateDebut, dateFin, selectedSupplier, user, activeTab, forcedType]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchHistory(newPage);
  };

  const formatMoney = (amount: number) => {
    return formatCurrency(amount);
  };

  function normalizeNumber(val: any) {
    if (typeof val === 'string') return parseFloat(val);
    return val;
  }

  const handleExportExcel = async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
        const params = new URLSearchParams();
        params.append('no_pagination', 'true');
        if (dateDebut) params.append('date_debut', dateDebut);
        if (dateFin) params.append('date_fin', dateFin);
        if (selectedSupplier) params.append('fournisseur_id', selectedSupplier);
        if (forcedType) params.append('type', forcedType);
        
        const endpoint = activeTab === 'summary' ? 'historique-achats/' : 'historique-achats/produits_details/';
        
        const response = await api.get(`${endpoint}?${params.toString()}`);
        
        const exportData = response.data;
        if (!exportData || exportData.length === 0) return;

        let dataToExport: any[] = [];
        if (activeTab === 'summary') {
            dataToExport = exportData.map((row: any) => ({
                [t('history.columns.date')]: format(new Date(row.date), 'dd/MM/yyyy'),
                [t('history.columns.nb_orders')]: row.nb_commandes,
                [t('history.columns.total_purchase')]: normalizeNumber(row.total_achat)
            }));
        } else {
            dataToExport = exportData.map((row: any) => ({
                [t('history.columns.product')]: row.produit__name,
                [t('history.columns.cip')]: row.produit__cip1,
                [t('history.columns.quantity')]: row.total_quantite,
                [t('history.columns.nb_purchases')]: row.nb_commandes,
                [t('history.columns.total_purchase')]: normalizeNumber(row.total_achat)
            }));
        }

        const filename = `historique_achats_${activeTab}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        exportToExcel(dataToExport, pharmacySettings, {
            sheetName: activeTab === 'summary' ? t('tabs.purchase_summary') : t('tabs.purchase_details'),
            filename,
            title: activeTab === 'summary' ? t('tabs.purchase_summary') : t('tabs.purchase_details'),
        });
    } catch (error) {
        console.error('Error exporting history:', error);
    } finally {
        setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  // Using global totals instead of page-only totals as requested
  const totalDisplayCount = activeTab === 'summary' 
    ? globalTotals.nb_commandes_global 
    : globalTotals.total_produits_global;
  const totalDisplayAmount = globalTotals.total_achat_global;

  return (
    <>
      <div className="h-full flex flex-col p-3 sm:p-6 overflow-hidden">
        <div className="w-full max-w-4xl mx-auto flex flex-col h-full min-h-0 overflow-hidden">
          {/* Header */}
          <div className="flex flex-col gap-3 mb-4 sm:mb-5 shrink-0">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-base-content flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
                <span className="inline-flex items-center gap-2">
                  <Calendar className="size-5 text-primary" />
                  {t('history.title')}
                </span>
                <span className="text-primary text-sm sm:text-xl sm:ml-1">
                  {forcedType === 'LOC' ? t('history.subtitle_local') : forcedType === 'DIR' ? t('history.subtitle_direct') : t('history.subtitle_daily')}
                </span>
              </h1>
              <p className="text-[10px] text-base-content/50 mt-0.5 uppercase tracking-wider font-semibold">{totalCount} {t('history.results_found')}</p>
            </div>

            <div className="w-full max-w-full overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0">
              <div className="tabs tabs-boxed bg-base-200/50 p-1 rounded-xl no-print w-max min-w-full sm:min-w-0 sm:w-auto">
                <button
                  className={`tab tab-sm font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'summary' ? 'tab-active !bg-primary !text-primary-content shadow-lg' : 'text-base-content/50 hover:text-base-content'}`}
                  onClick={() => setActiveTab('summary')}
                >
                  {t('tabs.purchase_summary')}
                </button>
                <button
                  className={`tab tab-sm font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'details' ? 'tab-active !bg-primary !text-primary-content shadow-lg' : 'text-base-content/50 hover:text-base-content'}`}
                  onClick={() => setActiveTab('details')}
                >
                  {t('tabs.purchase_details')}
                </button>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="mb-4 shrink-0 no-print">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <div className="relative w-full">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/30" />
                  <input
                    type="date"
                    className="input input-sm input-bordered w-full pl-10 pr-4 font-bold bg-base-100 focus:border-primary transition-all text-xs"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                  />
                </div>
                <div className="relative w-full">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/30" />
                  <input
                    type="date"
                    className="input input-sm input-bordered w-full pl-10 pr-4 font-bold bg-base-100 focus:border-primary transition-all text-xs"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto lg:min-w-[280px]">
                <select
                  className="select select-sm select-bordered font-bold bg-base-100 focus:border-primary transition-all text-xs w-full"
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                >
                  <option value="">{t('history.all_providers')}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-stretch sm:justify-end gap-1 w-full sm:w-auto">
                  <button
                    className="btn btn-sm btn-ghost flex-1 sm:flex-initial sm:btn-square hover:bg-base-200 transition-all text-primary tooltip tooltip-bottom"
                    onClick={() => fetchHistory()}
                    disabled={loading}
                    data-tip={t('history.refresh')}
                    type="button"
                  >
                    <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    className="btn btn-sm btn-ghost flex-1 sm:flex-initial sm:btn-square hover:bg-base-200 transition-all text-success tooltip tooltip-bottom"
                    onClick={handleExportExcel}
                    disabled={loading}
                    data-tip={t('history.export_excel')}
                    type="button"
                  >
                    <FileDown className="size-4" />
                  </button>
                  <button
                    className="btn btn-sm btn-ghost flex-1 sm:flex-initial sm:btn-square hover:bg-base-200 transition-all text-info tooltip tooltip-bottom"
                    onClick={handlePrint}
                    disabled={loading || data.length === 0}
                    data-tip={t('history.print_pdf')}
                    type="button"
                  >
                    <Printer className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Search bar inside filters bar logic or below */}
          {activeTab === 'details' && (
            <div className="mb-4 no-print">
              <input 
                type="text"
                className="input input-sm input-bordered rounded-lg bg-base-100 w-full text-xs"
                placeholder={t('history.product_search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Package className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest leading-none mb-1">
                    {activeTab === 'summary' ? t('history.columns.nb_orders') : t('history.columns.nb_products', { defaultValue: 'Nombre de produits' })}
                  </p>
                  <p className="text-xl font-black text-base-content leading-none">{totalDisplayCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="size-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest leading-none mb-1">{t('history.columns.total_purchase')}</p>
                  <p className="text-xl font-black text-base-content leading-none">
                    {formatMoney(totalDisplayAmount)} <span className="text-xs font-bold text-base-content/30 ml-0.5">{t('common:currency_symbol')}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className={`overflow-auto flex-1 rounded-3xl border-2 border-base-200/60 bg-base-100 shadow-sm transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <table className="table table-sm w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-base-300 text-[11px] font-black text-base-content uppercase tracking-[0.15em]">
                    {activeTab === 'summary' ? (
                      <>
                        <th className="sticky top-0 z-30 py-4 pl-8 border-b border-base-300/60 bg-base-300">{t('history.columns.date')}</th>
                        <th className="sticky top-0 z-30 text-center py-4 border-b border-base-300/60 bg-base-300">{t('history.columns.nb_orders')}</th>
                        <th className="sticky top-0 z-30 text-right py-4 pr-8 border-b border-base-300/60 bg-base-300">{t('history.columns.total_purchase')}</th>
                      </>
                    ) : (
                      <>
                        <th className="sticky top-0 z-30 py-4 pl-8 border-b border-base-300/60 bg-base-300">{t('history.columns.product')}</th>
                        <th className="sticky top-0 z-30 py-4 border-b border-base-300/60 bg-base-300">{t('history.columns.cip')}</th>
                        <th className="sticky top-0 z-30 text-center py-4 border-b border-base-300/60 bg-base-300">{t('history.columns.quantity')}</th>
                        <th className="sticky top-0 z-30 text-center py-4 border-b border-base-300/60 bg-base-300">{t('history.columns.nb_purchases')}</th>
                        <th className="sticky top-0 z-30 text-right py-4 pr-8 border-b border-base-300/60 bg-base-300">{t('history.columns.total_purchase')}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-100 font-sans">
                  {loading && data.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'summary' ? 3 : 5} className="py-20 text-center">
                        <span className="loading loading-spinner loading-lg text-primary/40"></span>
                      </td>
                    </tr>
                  ) : data.filter(row => {
                      if (activeTab === 'summary' || !searchQuery) return true;
                      const d = row as DetailedPurchase;
                      return d.produit__name?.toLowerCase().includes(searchQuery.toLowerCase()) || d.produit__cip1?.includes(searchQuery);
                  }).map((row, i) => (
                    <tr key={activeTab === 'summary' ? row.date : row.produit_id} className="group hover:bg-primary/[0.03] transition-colors">
                      {activeTab === 'summary' ? (
                        <>
                          <td className="py-3 pl-8">
                            <div className="flex items-center gap-3">
                              <div className={`size-1.5 rounded-full ${i === 0 ? 'bg-primary shadow-[0_0_8px_rgba(var(--p),0.5)]' : 'bg-base-content/10'}`} />
                              <span className="text-sm font-bold text-base-content/70">
                                {row.date ? format(new Date(row.date), 'dd MMMM yyyy', { locale: i18n.language.startsWith('fr') ? fr : undefined }) : '---'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <span className="inline-flex items-center justify-center h-7 px-3 rounded-full bg-base-200 text-base-content/70 text-xs font-black group-hover:bg-primary group-hover:text-primary-content transition-colors">
                              {row.nb_commandes}
                            </span>
                          </td>
                          <td className="py-3 text-right pr-8">
                            <span className="text-base font-black text-base-content group-hover:text-primary transition-colors">
                              {formatMoney(normalizeNumber(row.total_achat))}
                            </span>
                            <span className="text-[10px] font-bold text-base-content/30 ml-1">{t('common:currency_symbol')}</span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 pl-8">
                            <div className="font-bold text-sm text-base-content/80 group-hover:text-primary">{row.produit__name}</div>
                          </td>
                          <td className="py-3">
                            <div className="font-mono text-xs opacity-50">{row.produit__cip1}</div>
                          </td>
                          <td className="py-3 text-center">
                            <span className="badge badge-sm font-bold bg-base-200 border-none">{row.total_quantite}</span>
                          </td>
                          <td className="py-3 text-center">
                            <span className="text-xs font-bold opacity-70">{row.nb_commandes}</span>
                          </td>
                          <td className="py-3 text-right pr-8">
                            <span className="text-sm font-black text-base-content">
                              {formatMoney(normalizeNumber(row.total_achat))}
                            </span>
                            <span className="text-[10px] font-bold text-base-content/30 ml-1">{t('common:currency_symbol')}</span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {data.length === 0 && !loading && (
                    <tr>
                      <td colSpan={activeTab === 'summary' ? 3 : 5} className="text-center py-24 bg-base-100">
                        <div className="flex flex-col items-center gap-3 opacity-20">
                          <Package className="size-12" />
                          <p className="text-sm font-bold uppercase tracking-widest">{t('history.no_data')}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Component */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-5 px-2 shrink-0 no-print">
                <div className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">
                  {t('history.pagination.page')} {page} <span className="mx-1 text-base-content/20">/</span> {totalPages}
                </div>
                <div className="flex gap-2">
                  <button 
                    className="btn btn-xs rounded-xl bg-base-100 border-2 border-base-200 hover:border-primary/50 text-base-content transition-all active:scale-90" 
                    disabled={page === 1}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button 
                    className="btn btn-xs rounded-xl bg-base-100 border-2 border-base-200 hover:border-primary/50 text-base-content transition-all active:scale-90" 
                    disabled={page === totalPages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          .no-print, .tabs, .pagination, button, .select, input, .tooltip {
            display: none !important;
          }
          .card, .rounded-3xl, .border-2, .shadow-sm, .shadow-lg {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .p-6, .max-w-4xl {
            padding: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th {
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
            color: black !important;
            border-bottom: 2px solid #e2e8f0 !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .h-full, .overflow-hidden, .overflow-auto {
            height: auto !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </>
  );
};

export default HistoriqueAchats;
