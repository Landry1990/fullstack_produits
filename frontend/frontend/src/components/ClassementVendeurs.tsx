import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';


interface VendeurRanking {
  vendeur_id: number;
  vendeur: string;
  rang: number;
  nbre_ventes: number;
  chiffre_affaires: number;
  panier_moyen: number;
  evolution?: number | null;
}

interface RankingResponse {
  periode: {
    debut: string;
    fin: string;
    type: string;
  };
  data: VendeurRanking[];
}

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface EvolutionSeries {
  vendeur: string;
  vendeur_id: number;
  data: {
    mois: string;
    label: string;
    chiffre_affaires: number;
  }[];
}

const formatMoney = (value: number, currencySymbol: string) => {
  return formatCurrency(value, 'fr-FR', currencySymbol);
};

export default function ClassementVendeurs() {
  const { t } = useTranslation(['sellers', 'common']);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [evolutionData, setEvolutionData] = useState<EvolutionSeries[]>([]);
  const [selectedVendeur, setSelectedVendeur] = useState<number | null>(null);
  const [periode, setPeriode] = useState<'mois' | 'trimestre' | 'annee'>('mois');
  const [mois, setMois] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Fetch ranking data
  useEffect(() => {
    const fetchRanking = async () => {
      // Basic validation for YYYY-MM format
      if (!mois || !/^\d{4}-\d{2}$/.test(mois)) {
        console.warn("Format mois invalide:", mois);
        return;
      }

      setLoading(true);
      try {
        const res = await api.get<RankingResponse>('rapports/classement_vendeurs_mensuel/', {
          params: { mois, periode }
        });
        setRanking(res.data);
        
        // Auto-select first vendeur for evolution chart
        if (res.data.data.length > 0 && !selectedVendeur) {
          setSelectedVendeur(res.data.data[0].vendeur_id);
        }
      } catch (err) {
        toast.error(t('common:messages.error_loading'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, [mois, periode]);

  // Fetch global evolution data
  useEffect(() => {
    const fetchEvolution = async () => {
      try {
        const res = await api.get<EvolutionSeries[]>('rapports/evolution_vendeur/', {
          params: { vendeur_id: 'all' }
        });
        setEvolutionData(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchEvolution();
  }, []);

  // Format data for Recharts (merge series by month)
  const chartData = evolutionData.length > 0 ? evolutionData[0].data.map((point, index) => {
    const mergedPoint: any = { label: point.label };
    evolutionData.forEach(series => {
        mergedPoint[series.vendeur] = series.data[index]?.chiffre_affaires || 0;
    });
    return mergedPoint;
  }) : [];

  // Get medal icon
  const getMedal = (rang: number) => {
    switch (rang) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return rang;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-base-content flex items-center gap-2">
            🏆 {t('sellers:ranking.title')}
          </h1>
          <p className="text-base-content/60">
            {t('sellers:ranking.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="month"
            className="input input-bordered input-sm"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
          />
          <select
            className="select select-bordered select-sm"
            value={periode}
            onChange={(e) => setPeriode(e.target.value as 'mois' | 'trimestre' | 'annee')}
          >
            <option value="mois">{t('sellers:ranking.period.month')}</option>
            <option value="trimestre">{t('sellers:ranking.period.quarter')}</option>
            <option value="annee">{t('sellers:ranking.period.year')}</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      {ranking && ranking.data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ranking.data.slice(0, 3).map((v, i) => (
            <div 
              key={v.vendeur_id}
              className={`card shadow-lg cursor-pointer hover:shadow-xl transition-shadow ${
                i === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' :
                i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white' :
                'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
              }`}
              onClick={() => setSelectedVendeur(v.vendeur_id)}
            >
              <div className="card-body p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-4xl font-bold">{getMedal(v.rang)}</p>
                    <h3 className="text-lg font-semibold mt-2">{v.vendeur}</h3>
                  </div>
                  {v.evolution !== null && v.evolution !== undefined && (
                    <div className={`badge ${v.evolution >= 0 ? 'badge-success' : 'badge-error'}`}>
                      {v.evolution >= 0 ? '+' : ''}{v.evolution}%
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-2xl font-bold">{formatMoney(v.chiffre_affaires, t('common:currency'))}</p>
                  <p className="text-sm opacity-80">
                    {v.nbre_ventes} ventes · Panier: {formatMoney(v.panier_moyen, t('common:currency'))}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking Table */}
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <h3 className="text-lg font-semibold mb-4">
              {t('sellers:ranking.table_title')}
            </h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : ranking && ranking.data.length > 0 ? (
              <div className="overflow-x-auto max-h-96">
                <table className="table table-sm table-zebra">
                  <thead className="sticky top-0 bg-base-100">
                    <tr>
                      <th>#</th>
                      <th>{t('sellers:ranking.seller')}</th>
                      <th className="text-right">{t('sellers:ranking.sales')}</th>
                      <th className="text-right">{t('sellers:ranking.revenue')}</th>
                      <th className="text-right">{t('sellers:ranking.avg_basket')}</th>
                      <th className="text-right">{t('sellers:ranking.evolution')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.data.map((v) => (
                      <tr 
                        key={v.vendeur_id}
                        className={`cursor-pointer hover:bg-base-200 ${selectedVendeur === v.vendeur_id ? 'bg-primary/10' : ''}`}
                        onClick={() => setSelectedVendeur(v.vendeur_id)}
                      >
                        <td className="font-bold">{getMedal(v.rang)}</td>
                        <td>{v.vendeur}</td>
                        <td className="text-right">{v.nbre_ventes}</td>
                        <td className="text-right font-mono">{formatMoney(v.chiffre_affaires, t('common:currency'))}</td>
                        <td className="text-right font-mono text-sm">{formatMoney(v.panier_moyen, t('common:currency'))}</td>
                        <td className="text-right">
                          {v.evolution !== null && v.evolution !== undefined ? (
                            <span className={v.evolution >= 0 ? 'text-success' : 'text-error'}>
                              {v.evolution >= 0 ? '+' : ''}{v.evolution}%
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-base-content/50">
                {t('sellers:ranking.no_data')}
              </div>
            )}
          </div>
        </div>

        {/* Evolution Chart */}
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <h3 className="text-lg font-semibold mb-4">
              {t('sellers:ranking.evolution_chart')}
            </h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                  <Tooltip formatter={(value: number) => formatMoney(value, t('common:currency'))} />
                  <Legend />
                  {evolutionData.map((series, index) => (
                    <Line 
                        key={series.vendeur_id}
                        type="monotone" 
                        dataKey={series.vendeur} 
                        name={series.vendeur} 
                        stroke={COLORS[index % COLORS.length]} 
                        strokeWidth={2}
                        dot={false}
                        opacity={selectedVendeur === null || selectedVendeur === series.vendeur_id ? 1 : 0.2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-base-content/50">
                {t('common:loading')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bar Chart Comparison (Top 5) */}
      {ranking && ranking.data.length > 0 && (
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <h3 className="text-lg font-semibold mb-4">
              {t('sellers:ranking.comparison')}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ranking.data.slice(0, 5)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="vendeur" width={100} fontSize={12} />
                <Tooltip formatter={(value: number) => formatMoney(value, t('common:currency'))} />
                <Bar dataKey="chiffre_affaires" name={t('sellers:ranking.revenue')} radius={[0, 4, 4, 0]}>
                  {ranking.data.slice(0, 5).map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
