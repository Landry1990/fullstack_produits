import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Calendar, RefreshCw, Package, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface DailyPurchase {
  date: string;
  nb_commandes: number;
  total_achat: number;
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
  const [data, setData] = useState<DailyPurchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Filters
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');

  // Fetch Suppliers on mount
  useEffect(() => {
    const fetchSuppliers = async () => {
        if (!user?.token) return;
        try {
            const response = await axios.get('/api/fournisseurs/', {
                headers: { Authorization: `Token ${user.token}` }
            });
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

      const response = await axios.get(`/api/historique-achats/?${params.toString()}`, {
        headers: {
          Authorization: `Token ${user.token}`
        }
      });
      
      // Handle paginated response
      if (response.data.results) {
        setData(response.data.results);
        setTotalCount(response.data.count);
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
      setPage(1);
      fetchHistory(1);
    }
  }, [dateDebut, dateFin, selectedSupplier, user]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchHistory(newPage);
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat(i18n.language.startsWith('fr') ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 0 }).format(amount);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Summary stats for the current page
  const totalOrdersPage = data.reduce((acc, row) => acc + row.nb_commandes, 0);
  const totalAmountPage = data.reduce((acc, row) => acc + row.total_achat, 0);

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-base-content flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {t('history.title')}
              <span className="text-primary text-sm md:text-xl">
                {forcedType === 'LOC' ? t('history.subtitle_local') : forcedType === 'DIR' ? t('history.subtitle_direct') : t('history.subtitle_daily')}
              </span>
            </h1>
            <p className="text-[10px] text-base-content/50 mt-0.5 uppercase tracking-wider font-semibold">{totalCount} {t('history.results_found')}</p>
          </div>
        </div>

        {/* Compact Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
          <div className="group relative">
            <input 
              type="date" 
              className="input input-sm input-bordered rounded-lg bg-base-100 w-36 text-xs transition-all focus:ring-2 focus:ring-primary/20" 
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>
          <span className="text-base-content/30 text-xs font-bold">→</span>
          <div className="group relative">
            <input 
              type="date" 
              className="input input-sm input-bordered rounded-lg bg-base-100 w-36 text-xs transition-all focus:ring-2 focus:ring-primary/20" 
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
          <select 
            className="select select-sm select-bordered rounded-lg bg-base-100 text-xs min-w-[160px] focus:ring-2 focus:ring-primary/20"
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
          >
            <option value="">{t('history.all_providers')}</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button 
            className="btn btn-sm btn-primary rounded-lg gap-2 shadow-sm hover:shadow-md transition-all active:scale-95"
            onClick={() => fetchHistory(page)}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('history.refresh')}</span>
          </button>
        </div>

        {/* Summary Info - Centered and Compact */}
        <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest leading-none mb-1">{t('history.columns.nb_orders')}</p>
                <p className="text-xl font-black text-base-content antialiased leading-none">{totalOrdersPage}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest leading-none mb-1">{t('history.columns.total_purchase')}</p>
                <p className="text-xl font-black text-base-content antialiased leading-none">
                  {formatMoney(totalAmountPage)} <span className="text-xs font-bold text-base-content/30 ml-0.5">{t('common:currency_symbol')}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loading && data.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-base-100 rounded-3xl border border-base-200">
            <span className="loading loading-spinner loading-lg text-primary/40"></span>
            <p className="text-sm text-base-content/40 mt-4 font-medium italic">{t('history.loading')}</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className={`overflow-auto flex-1 rounded-3xl border-2 border-base-200/60 bg-base-100 shadow-sm transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <table className="table table-sm table-pin-rows w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-base-200/80 text-[11px] font-black text-base-content/50 uppercase tracking-[0.15em]">
                    <th className="py-4 pl-8 border-b border-base-200/60 bg-base-200/80">{t('history.columns.date')}</th>
                    <th className="text-center py-4 border-b border-base-200/60 bg-base-200/80">{t('history.columns.nb_orders')}</th>
                    <th className="text-right py-4 pr-8 border-b border-base-200/60 bg-base-200/80">{t('history.columns.total_purchase')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-100">
                  {data.map((row, i) => (
                    <tr key={row.date} className="group hover:bg-primary/[0.03] transition-colors">
                      <td className="py-3 pl-8">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-primary shadow-[0_0_8px_rgba(var(--p),0.5)]' : 'bg-base-content/10'}`} />
                          <span className="text-sm font-bold text-base-content/70">
                            {format(new Date(row.date), 'dd MMMM yyyy', { 
                                locale: i18n.language.startsWith('fr') ? fr : undefined 
                            })}
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
                          {formatMoney(row.total_achat)}
                        </span>
                        <span className="text-[10px] font-bold text-base-content/30 ml-1">{t('common:currency_symbol')}</span>
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && !loading && (
                    <tr>
                      <td colSpan={3} className="text-center py-24">
                        <div className="flex flex-col items-center gap-3 opacity-20">
                          <Package className="w-12 h-12" />
                          <p className="text-sm font-bold uppercase tracking-widest">{t('history.no_data')}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-5 px-2 shrink-0">
                <div className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">
                  {t('history.pagination.page')} {page} <span className="mx-1 text-base-content/20">/</span> {totalPages}
                </div>
                <div className="flex gap-2">
                  <button 
                    className="btn btn-xs rounded-xl bg-base-100 border-2 border-base-200 hover:border-primary/50 text-base-content transition-all active:scale-90" 
                    disabled={page === 1}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    className="btn btn-xs rounded-xl bg-base-100 border-2 border-base-200 hover:border-primary/50 text-base-content transition-all active:scale-90" 
                    disabled={page === totalPages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoriqueAchats;
