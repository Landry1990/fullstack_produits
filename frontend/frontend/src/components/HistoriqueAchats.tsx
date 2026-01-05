import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

interface DailyPurchase {
  date: string;
  nb_commandes: number;
  total_achat: number;
}

interface Supplier {
  id: number;
  name: string;
}

const HistoriqueAchats = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DailyPurchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  
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

  const fetchHistory = async () => {
    if (!user?.token) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateDebut) params.append('date_debut', dateDebut);
      if (dateFin) params.append('date_fin', dateFin);
      if (selectedSupplier) params.append('fournisseur_id', selectedSupplier);

      const response = await axios.get(`/api/historique-achats/?${params.toString()}`, {
        headers: {
          Authorization: `Token ${user.token}`
        }
      });
      setData(response.data);
    } catch (error) {
      console.error('Error fetching purchase history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchHistory();
    }
  }, [dateDebut, dateFin, selectedSupplier, user]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Historique des Achats par Jour</h1>

      <div className="flex flex-wrap gap-4 mb-6 bg-base-200 p-4 rounded-lg items-end">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Date début</span>
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
            <span className="label-text">Date fin</span>
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
            <span className="label-text">Fournisseur</span>
          </label>
          <select 
            className="select select-bordered"
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
          >
            <option value="">Tous les fournisseurs</option>
            {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="form-control">
             <button className="btn btn-primary" onClick={fetchHistory}>Actualiser</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full shadow-xl bg-base-100 rounded-box">
            <thead>
              <tr className="bg-base-200 text-base-content uppercase text-sm">
                <th>Date</th>
                <th className="text-right">Nb Commandes</th>
                <th className="text-right">Total Achat</th>
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
                    Aucun achat trouvé pour cette période
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-base-200 font-bold text-base-content">
                <tr>
                    <td>TOTAL</td>
                    <td className="text-right">{data.reduce((acc, row) => acc + row.nb_commandes, 0)}</td>
                    <td className="text-right">{formatMoney(data.reduce((acc, row) => acc + row.total_achat, 0))}</td>
                </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default HistoriqueAchats;
