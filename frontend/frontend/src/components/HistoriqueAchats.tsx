import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(amount);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        {t('orders.history.title')} 
        {forcedType === 'LOC' ? t('orders.history.subtitle_local') : forcedType === 'DIR' ? t('orders.history.subtitle_direct') : t('orders.history.subtitle_daily')}
      </h1>

      <div className="flex flex-wrap gap-4 mb-6 bg-base-200 p-4 rounded-lg items-end shadow-sm">
        <div className="form-control">
          <label className="label">
            <span className="label-text">{t('orders.history.start_date')}</span>
          </label>
          <input 
            type="date" 
            className="input input-bordered" 
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">{t('orders.history.end_date')}</span>
          </label>
          <input 
            type="date" 
            className="input input-bordered" 
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
          />
        </div>
        
        <div className="form-control min-w-[200px]">
          <label className="label">
            <span className="label-text">{t('orders.history.provider_filter')}</span>
          </label>
          <select 
            className="select select-bordered"
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
          >
            <option value="">{t('orders.history.all_providers')}</option>
            {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="form-control">
             <button className="btn btn-primary" onClick={() => fetchHistory(page)}>{t('orders.history.refresh')}</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full shadow-xl bg-base-100 rounded-box">
              <thead>
                <tr className="bg-base-200 text-base-content uppercase text-sm">
                  <th>{t('orders.history.columns.date')}</th>
                  <th className="text-right">{t('orders.history.columns.nb_orders')}</th>
                  <th className="text-right">{t('orders.history.columns.total_purchase')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.date} className="hover">
                    <td className="font-medium whitespace-nowrap">{format(new Date(row.date), 'dd/MM/yyyy')}</td>
                    <td className="text-right font-bold">{row.nb_commandes}</td>
                    <td className="text-right font-bold">{formatMoney(row.total_achat)}</td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center p-8 text-base-content/50">
                      {t('orders.history.no_data')}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-base-200 font-bold text-base-content">
                  <tr>
                      <td>{t('orders.history.total')} (page)</td>
                      <td className="text-right">{data.reduce((acc, row) => acc + row.nb_commandes, 0)}</td>
                      <td className="text-right">{formatMoney(data.reduce((acc, row) => acc + row.total_achat, 0))}</td>
                  </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-4 mt-8">
              <div className="join shadow-lg">
                <button 
                  className="join-item btn btn-md" 
                  disabled={page === 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  «
                </button>
                <button className="join-item btn btn-md no-animation">
                  Page {page} / {totalPages}
                </button>
                <button 
                  className="join-item btn btn-md" 
                  disabled={page === totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  »
                </button>
              </div>
              <div className="text-sm text-base-content/60 italic">
                {totalCount} {t('orders.history.results_found')}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HistoriqueAchats;
