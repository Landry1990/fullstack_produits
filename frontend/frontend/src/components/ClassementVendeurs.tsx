import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { gooeyToast } from 'goey-toast';
import { formatCurrency } from '../utils/formatters';
import { useRecharts } from '../hooks/useRecharts';
import { logger } from '../utils/logger'
import i18n from '../i18n';


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
  return formatCurrency(value, i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR', currencySymbol);
};

const getMedal = (rang: number) => {
  switch (rang) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return rang;
  }
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
        gooeyToast.error(t('common:messages.error_loading'));
        logger.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        logger.error(err);
      }
    };
    fetchEvolution();
  }, []);

  // Format data for Recharts (merge series by month)
  const chartData = evolutionData.length > 0 ? evolutionData[0].data.map((point, index) => {
    const mergedPoint: unknown = { label: point.label };
    evolutionData.forEach(series => {
        mergedPoint[series.vendeur] = series.data[index]?.chiffre_affaires || 0;
    });
    return mergedPoint;
  }) : [];

  const Recharts = useRecharts();
  if (!Recharts) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" /></div>;
  const { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = Recharts;

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-4 py-2.5">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            🏆 {t('sellers:ranking.title')}
          </h1>
          <p className="hidden xl:block text-slate-500 text-xs">
            {t('sellers:ranking.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="month"
            aria-label={t('sellers:ranking.period.month')}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
          />
          <select
            aria-label={t('sellers:ranking.subtitle')}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {ranking.data.slice(0, 3).map((v, i) => (
            <div 
              key={v.vendeur_id}
              className={`rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow px-3 py-2 flex items-center gap-3 ${
                i === 0 ? 'bg-amber-50 border-amber-200' :
                i === 1 ? 'bg-slate-50 border-slate-200' :
                'bg-orange-50 border-orange-200'
              }`}
              onClick={() => setSelectedVendeur(v.vendeur_id)}
              role="button"
              tabIndex={0}
              aria-pressed={selectedVendeur === v.vendeur_id}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedVendeur(v.vendeur_id);
                }
              }}
            >
              <span className="text-2xl leading-none shrink-0">{getMedal(v.rang)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 truncate">{v.vendeur}</h3>
                  {v.evolution !== null && v.evolution !== undefined && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      v.evolution >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {v.evolution >= 0 ? '+' : ''}{v.evolution}%
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold text-slate-800 leading-tight">{formatMoney(v.chiffre_affaires, t('common:currency'))}</p>
                <p className="text-xs text-slate-500">
                  {v.nbre_ventes} {t('sellers:ranking.sales_count')} · {t('sellers:ranking.avg_basket')}: {formatMoney(v.panier_moyen, t('common:currency'))}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Ranking Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
          <h3 className="text-base font-bold text-slate-800 mb-3">
            {t('sellers:ranking.table_title')}
          </h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <span className="size-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></span>
            </div>
          ) : ranking && ranking.data.length > 0 ? (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-slate-50 text-label font-black text-slate-400 uppercase tracking-widest">
                    <th className="sticky top-0 bg-slate-50 py-1.5 pl-3 text-left border-b border-slate-200">#</th>
                    <th className="sticky top-0 bg-slate-50 py-1.5 text-left border-b border-slate-200">{t('sellers:ranking.seller')}</th>
                    <th className="sticky top-0 bg-slate-50 py-1.5 text-right border-b border-slate-200">{t('sellers:ranking.sales')}</th>
                    <th className="sticky top-0 bg-slate-50 py-1.5 text-right border-b border-slate-200">{t('sellers:ranking.revenue')}</th>
                    <th className="sticky top-0 bg-slate-50 py-1.5 text-right border-b border-slate-200">{t('sellers:ranking.avg_basket')}</th>
                    <th className="sticky top-0 bg-slate-50 py-1.5 text-right border-b border-slate-200 pr-3">{t('sellers:ranking.evolution')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ranking.data.map((v) => (
                    <tr 
                      key={v.vendeur_id}
                      className={`cursor-pointer transition-colors ${
                        selectedVendeur === v.vendeur_id ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedVendeur(v.vendeur_id)}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selectedVendeur === v.vendeur_id}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedVendeur(v.vendeur_id);
                        }
                      }}
                    >
                      <td className="py-2 pl-3 font-bold text-slate-700">{getMedal(v.rang)}</td>
                      <td className="py-2 text-slate-700">{v.vendeur}</td>
                      <td className="py-2 text-right text-slate-600">{v.nbre_ventes}</td>
                      <td className="py-2 text-right font-mono text-slate-800 font-bold">{formatMoney(v.chiffre_affaires, t('common:currency'))}</td>
                      <td className="py-2 text-right font-mono text-sm text-slate-600">{formatMoney(v.panier_moyen, t('common:currency'))}</td>
                      <td className="py-2 text-right pr-3">
                        {v.evolution !== null && v.evolution !== undefined ? (
                          <span className={`font-bold ${
                            v.evolution >= 0 ? 'text-emerald-600' : 'text-red-500'
                          }`}>
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
            <div className="h-64 flex items-center justify-center text-slate-400">
              {t('sellers:ranking.no_data')}
            </div>
          )}
        </div>

        {/* Evolution Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
          <h3 className="text-base font-bold text-slate-800 mb-3">
            {t('sellers:ranking.evolution_chart')}
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
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
            <div className="h-64 flex items-center justify-center text-slate-400">
              {t('common:loading')}
            </div>
          )}
        </div>
      </div>

      {/* Bar Chart Comparison (Top 5) */}
      {ranking && ranking.data.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
          <h3 className="text-base font-bold text-slate-800 mb-3">
            {t('sellers:ranking.comparison')}
          </h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ranking.data.slice(0, 5)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="vendeur" width={100} fontSize={12} />
                <Tooltip formatter={(value: number) => formatMoney(value, t('common:currency'))} />
                <Bar dataKey="chiffre_affaires" name={t('sellers:ranking.revenue')} radius={[0, 4, 4, 0]}>
                  {ranking.data.slice(0, 5).map((entry) => (
                    <Cell key={entry.vendeur} fill={entry.vendeur_id === selectedVendeur ? '#10B981' : '#CBD5E1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
