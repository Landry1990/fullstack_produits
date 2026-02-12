import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

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
}

const HistoriqueVentes = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const fetchHistory = async () => {
    if (!user?.token) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateDebut) params.append('date_debut', dateDebut);
      if (dateFin) params.append('date_fin', dateFin);

      const response = await axios.get(`/api/historique-ventes/?${params.toString()}`, {
        headers: {
          Authorization: `Token ${user.token}`
        }
      });
      setData(response.data);
    } catch (error) {
      console.error('Error fetching sales history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchHistory();
    }
  }, [dateDebut, dateFin, user]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t('salesHistory.title')}</h1>

      <div className="flex items-end gap-4 mb-6 bg-base-200 p-4 rounded-lg">
        <div className="form-control">
          <label className="label">
            <span className="label-text">{t('salesHistory.start_date')}</span>
          </label>
          <input 
            type="date" 
            className="input input-bordered" 
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            lang="fr"
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">{t('salesHistory.end_date')}</span>
          </label>
          <input 
            type="date" 
            className="input input-bordered" 
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            lang="fr"
          />
        </div>
        <button className="btn btn-primary" onClick={fetchHistory}>{t('common.refresh')}</button>
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
                <th>{t('salesHistory.columns.date')}</th>
                <th className="text-right">{t('salesHistory.columns.ca_ttc')}</th>
                <th className="text-right">{t('salesHistory.columns.ca_ht')}</th>
                <th className="text-right">{t('salesHistory.columns.tva')}</th>
                <th className="text-right">{t('salesHistory.columns.cash')}</th>
                <th className="text-right">{t('salesHistory.columns.card')}</th>
                <th className="text-right">{t('salesHistory.columns.check')}</th>
                <th className="text-right">{t('salesHistory.columns.mobile_money')}</th>
                <th className="text-center">{t('salesHistory.columns.nb_invoices')}</th>
                <th className="text-right">{t('salesHistory.columns.avg_basket')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.date} className="hover">
                  <td className="font-medium whitespace-nowrap">{format(new Date(row.date), 'dd/MM/yyyy')}</td>
                  <td className="text-right font-bold">{formatMoney(row.ca_ttc)}</td>
                  <td className="text-right opacity-70">{formatMoney(row.ca_ht)}</td>
                  <td className="text-right opacity-70">{formatMoney(row.tva)}</td>
                  <td className="text-right font-mono">{formatMoney(row.especes)}</td>
                  <td className="text-right font-mono">{formatMoney(row.carte)}</td>
                  <td className="text-right font-mono">{formatMoney(row.cheque)}</td>
                  <td className="text-right font-mono">{formatMoney(row.om + row.momo)}</td>
                  <td className="text-center font-bold">{row.nb_ventes}</td>
                  <td className="text-right">{formatMoney(row.panier_moyen)}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center p-8 text-base-content/50">
                    {t('salesHistory.no_data')}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-base-200 font-bold text-base-content">
                <tr>
                    <td>{t('salesHistory.total')}</td>
                    <td className="text-right">{formatMoney(data.reduce((acc, row) => acc + row.ca_ttc, 0))}</td>
                    <td className="text-right">{formatMoney(data.reduce((acc, row) => acc + row.ca_ht, 0))}</td>
                    <td className="text-right">{formatMoney(data.reduce((acc, row) => acc + row.tva, 0))}</td>
                    <td className="text-right">{formatMoney(data.reduce((acc, row) => acc + row.especes, 0))}</td>
                    <td className="text-right">{formatMoney(data.reduce((acc, row) => acc + row.carte, 0))}</td>
                    <td className="text-right">{formatMoney(data.reduce((acc, row) => acc + row.cheque, 0))}</td>
                    <td className="text-right">{formatMoney(data.reduce((acc, row) => acc + row.om + row.momo, 0))}</td>
                    <td className="text-center">{data.reduce((acc, row) => acc + row.nb_ventes, 0)}</td>
                    <td className="text-right">-</td>
                </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default HistoriqueVentes;
