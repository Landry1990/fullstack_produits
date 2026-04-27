import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  useCAEvolution,
  useMargesEvolution,
  usePredictions,
  useKPIs,
  useTopProducts,
  useRepartitionCA,
  useAnalyseCategories,
  useAnalyseMarges,
  useAnalyseFournisseurs,
  useMarginVarianceAnalysis
} from '../hooks/useFinanceStats';

import { formatCurrency, formatNumber } from '../utils/formatters';

// Color palette
const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

// Format currency
const formatMoney = (value: number) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return formatNumber(value);
};

const formatMoneyFull = (value: number) => {
  return formatCurrency(value);
};

export default function ModuleFinancier() {
  const { t } = useTranslation(['finance', 'common', 'sidebar']);
  const [periode, setPeriode] = useState<'mois' | 'trimestre' | 'annee'>('mois');
  const [critereTop, setCritereTop] = useState<'ca' | 'marge'>('ca');
  const [repartitionBy, setRepartitionBy] = useState<'categorie' | 'fournisseur'>('categorie');
  const [activeChart, setActiveChart] = useState<'ca' | 'marges' | 'predictions'>('ca');
  const [categoryType, setCategoryType] = useState<'rayon' | 'groupe' | 'forme'>('rayon');

  // Fetch data
  const { data: caEvolution, isLoading: loadingCA } = useCAEvolution();
  const { data: margesData, isLoading: loadingMarges } = useMargesEvolution();
  const { data: predictions, isLoading: loadingPredictions } = usePredictions();
  const { data: kpis, isLoading: loadingKPIs } = useKPIs();
  const { data: topProducts, isLoading: loadingTop } = useTopProducts(periode, critereTop);
  const { data: repartition, isLoading: loadingRepartition } = useRepartitionCA(repartitionBy, periode);
  const { data: categoryAnalysis, isLoading: loadingCategories } = useAnalyseCategories(categoryType, periode);
  const { data: marginAnalysis, isLoading: loadingMarginAnalysis } = useAnalyseMarges();
  const { data: supplierAnalysis, isLoading: loadingSupplierAnalysis } = useAnalyseFournisseurs();
  const { data: varianceReport, isLoading: loadingVariance } = useMarginVarianceAnalysis();

  const isEnglish = useTranslation().i18n.language.startsWith('en');

  // Prepare chart data for CA Evolution
  const caChartData = caEvolution?.labels.map((label, i) => ({
    name: label,
    current: caEvolution.data[i],
    n1: caEvolution.comparaison_n1[i]
  })) || [];

  // Prepare chart data for Margins
  const margesChartData = margesData?.labels.map((label, i) => ({
    name: label,
    marge: margesData.marge_brute[i],
    taux: margesData.taux_marge[i]
  })) || [];

  // Prepare predictions chart data
  const predictionsChartData = [
    ...(predictions?.labels.map((label, i) => ({
      name: label,
      historique: predictions.historique[i],
      prediction: null as number | null
    })) || []),
    ...(predictions?.prediction_labels.map((label, i) => ({
      name: label,
      historique: null as number | null,
      prediction: predictions.predictions[i]
    })) || [])
  ];

  // Get trend icon and color
  const getTrendInfo = (tendance: string) => {
    switch (tendance) {
      case 'hausse':
        return { icon: '📈', color: 'text-green-500', label: t('trend.up', 'En hausse') };
      case 'baisse':
        return { icon: '📉', color: 'text-red-500', label: t('trend.down', 'En baisse') };
      default:
        return { icon: '➡️', color: 'text-yellow-500', label: t('trend.stable', 'Stable') };
    }
  };

  const trendInfo = predictions ? getTrendInfo(predictions.tendance) : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-base-content">
            {t('title', 'Module Financier')}
          </h1>
          <p className="text-base-content/60">
            {t('subtitle', 'Analyse et prédictions du chiffre d\'affaires')}
          </p>
        </div>
        <div className="flex gap-2">
          <select 
            className="select select-bordered select-sm"
            value={periode}
            onChange={(e) => setPeriode(e.target.value as 'mois' | 'trimestre' | 'annee')}
          >
            <option value="mois">{t('periode.mois', 'Ce mois')}</option>
            <option value="trimestre">{t('periode.trimestre', 'Ce trimestre')}</option>
            <option value="annee">{t('periode.annee', 'Cette année')}</option>
          </select>
        </div>
      </div>

      {/* KPIs Cards */}
      {loadingKPIs ? (
        <div data-testid="finance-loading" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card bg-base-100 shadow-lg animate-pulse h-32"></div>
          ))}
        </div>
      ) : kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Panier Moyen */}
          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
            <div className="card-body p-4">
              <h3 className="text-sm font-medium opacity-80">
                {t('kpis.avg_basket', 'Panier Moyen')}
              </h3>
              <p className="text-3xl font-bold">{formatMoneyFull(kpis.panier_moyen.mois)}</p>
              <p className="text-xs opacity-70">
                {t('kpis.annual')}: {formatMoneyFull(kpis.panier_moyen.annee)}
              </p>
            </div>
          </div>

          {/* Taux de Marge */}
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
            <div className="card-body p-4">
              <h3 className="text-sm font-medium opacity-80">
                {t('kpis.margin_rate', 'Taux de Marge')}
              </h3>
              <p className="text-3xl font-bold">{kpis.taux_marge}%</p>
              <p className="text-xs opacity-70">
                {kpis.nb_ventes_mois} {t('charts.sales_count', 'ventes ce mois')}
              </p>
            </div>
          </div>

          {/* DSI */}
          <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
            <div className="card-body p-4">
              <h3 className="text-sm font-medium opacity-80">
                {t('kpis.dsi', 'Jours Stock (DSI)')}
              </h3>
              <p className="text-3xl font-bold">{kpis.dsi} j</p>
              <p className="text-xs opacity-70">
                Stock: {formatMoneyFull(kpis.stock_value)}
              </p>
            </div>
          </div>

          {/* Croissance */}
          <div className={`card shadow-lg ${kpis.croissance_mensuelle >= 0 
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' 
            : 'bg-gradient-to-br from-red-500 to-red-600'} text-white`}>
            <div className="card-body p-4">
              <h3 className="text-sm font-medium opacity-80">
                {t('kpis.growth', 'Croissance Mensuelle')}
              </h3>
              <p className="text-3xl font-bold">
                {kpis.croissance_mensuelle >= 0 ? '+' : ''}{kpis.croissance_mensuelle}%
              </p>
              <p className="text-xs opacity-70">
                CA: {formatMoneyFull(kpis.ca_mois)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Margin Variance Report (NEW) */}
      <div className="card bg-base-100 shadow-xl border-t-4 border-primary overflow-hidden">
        <div className="card-body p-0">
          <div className="bg-primary/5 p-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">📊</span>
                {isEnglish ? 'Margin Variance Report' : 'Rapport de Variation de Marge'}
              </h2>
              <p className="text-sm opacity-70">
                {isEnglish ? 'Analysis of profit fluctuations and data integrity' : 'Analyse des fluctuations de profit et intégrité des données'}
              </p>
            </div>
            {varianceReport && (
              <div className={`px-4 py-2 rounded-lg font-bold text-lg ${varianceReport.variance_pct >= 0 ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
                {varianceReport.variance_pct >= 0 ? '+' : ''}{varianceReport.variance_pct}%
              </div>
            )}
          </div>

          {loadingVariance ? (
            <div className="p-8 flex justify-center"><span className="loading loading-spinner loading-lg"></span></div>
          ) : varianceReport && (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Summary & Insights */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-base-200 rounded-xl">
                    <p className="text-xs uppercase font-bold opacity-50 mb-1">{isEnglish ? 'Current Period' : 'Période Actuelle'}</p>
                    <p className="text-2xl font-black">{varianceReport.period1.stats.margin_pct.toFixed(1)}%</p>
                    <p className="text-xs opacity-70">{formatMoney(varianceReport.period1.stats.margin)} {isEnglish ? 'Profit' : 'Marge'}</p>
                  </div>
                  <div className="p-4 bg-base-200 rounded-xl">
                    <p className="text-xs uppercase font-bold opacity-50 mb-1">{isEnglish ? 'Baseline' : 'Référence (Hier)'}</p>
                    <p className="text-2xl font-black">{varianceReport.period2.stats.margin_pct.toFixed(1)}%</p>
                    <p className="text-xs opacity-70">{formatMoney(varianceReport.period2.stats.margin)} {isEnglish ? 'Profit' : 'Marge'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-sm uppercase tracking-wider opacity-60">{isEnglish ? 'Key Insights' : 'Analyses Clés'}</h3>
                  {varianceReport.insights.map((insight: any, idx: number) => (
                    <div key={idx} className="alert alert-info shadow-sm bg-info/10 border-info/20 text-sm">
                      <span>{isEnglish ? insight.en : insight.fr}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Suspicious Products */}
              <div className="bg-base-200/50 rounded-2xl p-4 border border-base-content/5">
                <h3 className="font-bold text-sm uppercase tracking-wider opacity-60 mb-4 flex items-center gap-2">
                  <span className="text-warning">🚩</span>
                  {isEnglish ? 'Atypical Margins Detected' : 'Marges Atypiques Détectées'}
                </h3>
                
                {varianceReport.suspicious_products.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="table table-xs w-full">
                      <thead>
                        <tr className="opacity-50">
                          <th>{isEnglish ? 'Product' : 'Produit'}</th>
                          <th className="text-right">{isEnglish ? 'Margin' : 'Marge'}</th>
                          <th className="text-right">{isEnglish ? 'Cost (PMP)' : 'Coût (PMP)'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {varianceReport.suspicious_products.map((p: any) => (
                          <tr key={p.produit__id} className="hover:bg-base-content/5 transition-colors">
                            <td className="font-medium max-w-[150px] truncate">{p.produit__name}</td>
                            <td className={`text-right font-bold ${p.unit_margin_pct > 80 ? 'text-purple-500' : 'text-orange-500'}`}>
                              {parseFloat(p.unit_margin_pct).toFixed(1)}%
                            </td>
                            <td className="text-right opacity-70">{formatMoney(p.produit__pmp)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-[10px] mt-4 italic opacity-50">
                      {isEnglish 
                        ? '* High margins (>80%) often indicate missing cost prices (PMP = 0).' 
                        : '* Les marges élevées (>80%) indiquent souvent des prix d\'achat manquants (PMP = 0).'}
                    </p>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-sm opacity-40 italic">
                    {isEnglish ? 'No abnormal margins detected today.' : 'Aucune marge anormale détectée aujourd\'hui.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Charts */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          {/* Chart Tabs */}
          <div className="tabs tabs-boxed mb-4 w-fit">
            <button 
              className={`tab ${activeChart === 'ca' ? 'tab-active' : ''}`}
              onClick={() => setActiveChart('ca')}
            >
              {t('charts.ca_evolution', 'Évolution CA')}
            </button>
            <button 
              className={`tab ${activeChart === 'marges' ? 'tab-active' : ''}`}
              onClick={() => setActiveChart('marges')}
            >
              {t('charts.margins', 'Marges')}
            </button>
            <button 
              className={`tab ${activeChart === 'predictions' ? 'tab-active' : ''}`}
              onClick={() => setActiveChart('predictions')}
            >
              {t('charts.predictions', 'Prédictions')} {trendInfo && <span className="ml-1">{trendInfo.icon}</span>}
            </button>
          </div>

          {/* CA Evolution Chart */}
          {activeChart === 'ca' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {t('charts.ca_12_months', 'Chiffre d\'Affaires (12 derniers mois)')}
                </h3>
                {caEvolution && (
                  <div className={`badge ${caEvolution.croissance_yoy >= 0 ? 'badge-success' : 'badge-error'} badge-lg`}>
                    {caEvolution.croissance_yoy >= 0 ? '+' : ''}{caEvolution.croissance_yoy}% vs N-1
                  </div>
                )}
              </div>
              {loadingCA ? (
                <div className="h-80 flex items-center justify-center">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={caChartData}>
                    <defs>
                      <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis tickFormatter={formatMoney} fontSize={12} />
                    <Tooltip formatter={(value: number) => formatMoneyFull(value)} />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="current" 
                      name={t('charts.current_revenue', 'CA Actuel')}
                      stroke="#10B981" 
                      fillOpacity={1} 
                      fill="url(#colorCurrent)" 
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="n1" 
                      name={t('charts.n1_revenue', 'CA N-1')}
                      stroke="#6B7280" 
                      strokeDasharray="5 5" 
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Margins Chart */}
          {activeChart === 'marges' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {t('charts.margin_evolution', 'Évolution des Marges')}
                </h3>
                {margesData && (
                  <div className="badge badge-primary badge-lg">
                    Taux moyen: {margesData.taux_moyen}%
                  </div>
                )}
              </div>
              {loadingMarges ? (
                <div className="h-80 flex items-center justify-center">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={margesChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis yAxisId="left" tickFormatter={formatMoney} fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" unit="%" fontSize={12} />
                    <Tooltip formatter={(value: number, name: string) => 
                      name === 'taux' ? `${value}%` : formatMoneyFull(value)
                    } />
                    <Legend />
                    <Bar yAxisId="left" dataKey="marge" name={t('margin', 'Marge Brute')} fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="taux" name={t('margin_rate', 'Taux %')} stroke="#F59E0B" strokeWidth={2} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Predictions Chart */}
          {activeChart === 'predictions' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {t('charts.predictions_3m', 'Prédictions CA (3 prochains mois)')}
                </h3>
                {predictions && (
                  <div className="flex items-center gap-2">
                    <span className={`badge ${
                      predictions.confiance === 'haute' ? 'badge-success' :
                      predictions.confiance === 'moyenne' ? 'badge-warning' : 'badge-error'
                    }`}>
                      Confiance: {predictions.confiance}
                    </span>
                    <span className={`font-medium ${trendInfo?.color}`}>
                      {trendInfo?.icon} {trendInfo?.label}
                    </span>
                  </div>
                )}
              </div>
              {loadingPredictions ? (
                <div className="h-80 flex items-center justify-center">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={predictionsChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis tickFormatter={formatMoney} fontSize={12} />
                    <Tooltip formatter={(value: number) => value ? formatMoneyFull(value) : '-'} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="historique" 
                      name={t('charts.history', 'Historique')}
                      stroke="#10B981" 
                      strokeWidth={2}
                      dot={{ fill: '#10B981' }}
                      connectNulls={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="prediction" 
                      name={t('charts.prediction', 'Prédiction')}
                      stroke="#8B5CF6" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: '#8B5CF6' }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Repartition + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Repartition CA */}
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {t('charts.repartition', 'Répartition CA')}
              </h3>
              <select 
                className="select select-bordered select-sm"
                value={repartitionBy}
                onChange={(e) => setRepartitionBy(e.target.value as 'categorie' | 'fournisseur')}
              >
                <option value="categorie">{t('by_category', 'Par Catégorie')}</option>
                <option value="fournisseur">{t('by_supplier', 'Par Fournisseur')}</option>
              </select>
            </div>
            {loadingRepartition ? (
              <div className="h-64 flex items-center justify-center">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : repartition && repartition.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={repartition.data.map(item => ({ ...item, name: item.nom }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="ca"
                    nameKey="name"
                    label={({ name, percent }) => 
                      `${String(name || '').substring(0, 10)}... ${((percent || 0) * 100).toFixed(0)}%`
                    }
                  >
                    {repartition.data.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatMoneyFull(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-base-content/50">
                {t('common:no_data', 'Aucune donnée')}
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {t('top_products', 'Top Produits')}
              </h3>
              <select 
                className="select select-bordered select-sm"
                value={critereTop}
                onChange={(e) => setCritereTop(e.target.value as 'ca' | 'marge')}
              >
                <option value="ca">{t('by_revenue', 'Par CA')}</option>
                <option value="marge">{t('by_margin', 'Par Marge')}</option>
              </select>
            </div>
            {loadingTop ? (
              <div className="h-64 flex items-center justify-center">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : topProducts && topProducts.data.length > 0 ? (
              <div className="overflow-x-auto max-h-72">
                <table className="table table-sm table-zebra">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('product', 'Produit')}</th>
                      <th className="text-right">CA</th>
                      <th className="text-right">{t('margin', 'Marge')}</th>
                      <th className="text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.data.map((product, index) => (
                      <tr key={product.id}>
                        <td className="font-bold text-primary">{index + 1}</td>
                        <td className="max-w-[150px] truncate" title={product.nom}>
                          {product.nom}
                        </td>
                        <td className="text-right font-mono">{formatMoneyFull(product.ca)}</td>
                        <td className="text-right font-mono text-success">{formatMoneyFull(product.marge)}</td>
                        <td className="text-right">{product.taux_marge}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-base-content/50">
                {t('common:no_data', 'Aucune donnée')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Analysis Section */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold">
              {t('category_analysis', 'Analyse par Catégorie')}
            </h3>
            <div className="flex gap-2">
              <div className="btn-group">
                <button
                  className={`btn btn-sm ${categoryType === 'rayon' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setCategoryType('rayon')}
                >
                  {t('category.rayon', 'Rayon')}
                </button>
                <button
                  className={`btn btn-sm ${categoryType === 'groupe' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setCategoryType('groupe')}
                >
                  {t('category.groupe', 'Groupe')}
                </button>
                <button
                  className={`btn btn-sm ${categoryType === 'forme' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setCategoryType('forme')}
                >
                  {t('category.forme', 'Forme')}
                </button>
              </div>
            </div>
          </div>
          
          {loadingCategories ? (
            <div className="h-64 flex items-center justify-center">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : categoryAnalysis && categoryAnalysis.data.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryAnalysis.data.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" tickFormatter={(v) => formatMoney(v)} />
                    <YAxis 
                      type="category" 
                      dataKey="nom" 
                      width={120} 
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={(value: number) => formatMoneyFull(value)} />
                    <Bar dataKey="ca" fill="#3B82F6" name="CA" />
                    <Bar dataKey="marge" fill="#10B981" name={t('margin', 'Marge')} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Table */}
              <div className="overflow-x-auto max-h-80">
                <table className="table table-sm table-zebra">
                  <thead className="sticky top-0 z-10 bg-base-100 opacity-100">
                    <tr>
                      <th>{categoryType === 'rayon' ? t('category.rayon', 'Rayon') : categoryType === 'groupe' ? t('category.groupe', 'Groupe') : t('category.forme', 'Forme')}</th>
                      <th className="text-right">CA</th>
                      <th className="text-right">{t('margin', 'Marge')}</th>
                      <th className="text-right">{t('margin_rate', 'Taux')}</th>
                      <th className="text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryAnalysis.data.map((item) => (
                      <tr key={item.id}>
                        <td className="max-w-[150px] truncate" title={item.nom}>
                          {item.nom}
                        </td>
                        <td className="text-right font-mono">{formatMoneyFull(item.ca)}</td>
                        <td className="text-right font-mono text-success">{formatMoneyFull(item.marge)}</td>
                        <td className="text-right">{item.taux_marge}%</td>
                        <td className="text-right">
                          <span className="badge badge-primary badge-sm">{item.pourcentage_ca}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-base-content/50">
              {t('category.no_data', 'Aucune donnée pour cette catégorie')}
            </div>
          )}
          
          {/* Category Summary */}
          {categoryAnalysis && (
            <div className="mt-4 flex gap-4 flex-wrap">
              <div className="stat bg-base-200 rounded-lg p-3">
                <div className="stat-title text-xs">{t('category.total_ca', 'CA Total')}</div>
                <div className="stat-value text-lg text-primary">{formatMoneyFull(categoryAnalysis.total_ca)}</div>
              </div>
              <div className="stat bg-base-200 rounded-lg p-3">
                <div className="stat-title text-xs">{t('category.total_margin', 'Marge Totale')}</div>
                <div className="stat-value text-lg text-success">{formatMoneyFull(categoryAnalysis.total_marge)}</div>
              </div>
              <div className="stat bg-base-200 rounded-lg p-3">
                <div className="stat-title text-xs">{t('category.global_rate', 'Taux Marge Global')}</div>
                <div className="stat-value text-lg">{categoryAnalysis.taux_marge_global}%</div>
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Margin Analysis Section */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h3 className="text-lg font-semibold mb-4">
            {t('margin_analysis', 'Analyse Avancée et Opportunités')}
          </h3>
          
          {loadingMarginAnalysis ? (
            <div className="h-48 flex items-center justify-center">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : marginAnalysis ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Opportunités Moyenne Marge */}
              <div className="card bg-base-200">
                <div className="card-body p-4">
                  <h4 className="card-title text-sm flex items-center gap-2">
                    <span className="text-warning">⚠️</span>
                    {t('analysis.opportunities', 'Faible Marge / Fort Volume')}
                  </h4>
                  <p className="text-xs opacity-70 mb-2">
                    {t('analysis.negotiation', 'Opportunités de négociation fournisseur')}
                  </p>
                  
                  <div className="overflow-x-auto max-h-60">
                    <table className="table table-xs">
                      <thead>
                        <tr>
                          <th>{t('product', 'Produit')}</th>
                          <th className="text-right">{t('margin', 'Marge')}</th>
                          <th className="text-right">{t('analysis.gain', 'Gain Pot.')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marginAnalysis.opportunites_nego.length > 0 ? (
                          marginAnalysis.opportunites_nego.map((item) => (
                            <tr key={item.id}>
                              <td className="max-w-[120px] truncate" title={item.nom}>
                                {item.nom}
                              </td>
                              <td className="text-right text-warning font-bold">
                                {item.taux_marge}%
                              </td>
                              <td className="text-right text-success">
                                +{formatMoney(item.marge_perdue)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={3} className="text-center opacity-50">{t('analysis.no_opportunity', 'Aucune opportunité détectée')}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Stock Dormant */}
              <div className="card bg-base-200">
                <div className="card-body p-4">
                  <h4 className="card-title text-sm flex items-center gap-2">
                    <span className="text-error">🛑</span>
                    {t('analysis.dormant', 'Forte Marge / Faible Rotation')}
                  </h4>
                  <p className="text-xs opacity-70 mb-2">
                    {t('analysis.dormant_risk', 'Risque de stock dormant (Argent immobilisé)')}
                  </p>
                  
                  <div className="overflow-x-auto max-h-60">
                    <table className="table table-xs">
                      <thead>
                        <tr>
                          <th>{t('product', 'Produit')}</th>
                          <th className="text-right">{t('margin', 'Marge')}</th>
                          <th className="text-right">{t('analysis.price', 'Prix')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marginAnalysis.stock_dormant.length > 0 ? (
                          marginAnalysis.stock_dormant.map((item) => (
                            <tr key={item.id}>
                              <td className="max-w-[120px] truncate" title={item.nom}>
                                {item.nom}
                              </td>
                              <td className="text-right text-success font-bold">
                                {item.taux_marge}%
                              </td>
                              <td className="text-right">
                                {formatMoney(item.prix_actuel)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={3} className="text-center opacity-50">{t('analysis.no_dormant', 'Aucun produit dormant détecté')}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Suggestions Prix */}
              <div className="card bg-base-200">
                <div className="card-body p-4">
                  <h4 className="card-title text-sm flex items-center gap-2">
                    <span className="text-success">💡</span>
                    {t('analysis.price_opt', 'Optimisation Prix (+5%)')}
                  </h4>
                  <p className="text-xs opacity-70 mb-2">
                    {t('analysis.low_margin_impact', 'Produits à marge très faible (Impact estimé)')}
                  </p>
                  
                  <div className="overflow-x-auto max-h-60">
                    <table className="table table-xs">
                      <thead>
                        <tr>
                          <th>{t('product', 'Produit')}</th>
                          <th className="text-right">{t('analysis.current_price', 'Actuel')}</th>
                          <th className="text-right">{t('analysis.suggested_price', 'Suggéré')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marginAnalysis.suggestions_prix.length > 0 ? (
                          marginAnalysis.suggestions_prix.map((item) => (
                            <tr key={item.id}>
                              <td className="max-w-[120px] truncate" title={item.nom}>
                                {item.nom}
                              </td>
                              <td className="text-right text-error font-bold">
                                {item.taux_actuel}%
                              </td>
                              <td className="text-right text-success font-bold">
                                {formatMoney(item.prix_suggere)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={3} className="text-center opacity-50">{t('analysis.optimized', 'Prix optimisés')}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-base-content/50">
              {t('common:no_data', 'Aucune donnée disponible')}
            </div>
          )}
        </div>
      </div>



      {/* Supplier Analysis Section */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h3 className="text-lg font-semibold mb-4">
            {t('supplier_analysis', 'Analyse Fournisseurs')}
          </h3>

          {loadingSupplierAnalysis ? (
            <div className="h-48 flex items-center justify-center">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : supplierAnalysis && supplierAnalysis.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('supplier.name', 'Fournisseur')}</th>
                    <th className="text-center">{t('supplier.score', 'Score Global')}</th>
                    <th className="text-center">{t('supplier.volume', 'Volume (30%)')}</th>
                    <th className="text-center">{t('supplier.quality', 'Qualité (30%)')}</th>
                    <th className="text-center">{t('supplier.regularity', 'Régularité (40%)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierAnalysis.slice(0, 10).map((item, index) => (
                    <tr key={item.id}>
                      <td className="font-bold">{index + 1}</td>
                      <td>{item.nom}</td>
                      <td className="text-center">
                        <div className="flex flex-col items-center">
                          <div className={`radial-progress text-xs ${
                            item.score_global >= 80 ? 'text-success' : 
                            item.score_global >= 50 ? 'text-warning' : 'text-error'
                          }`} style={{ "--value": item.score_global, "--size": "3rem" } as any}>
                            {item.score_global}
                          </div>
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="tooltip" data-tip={`${formatMoneyFull(item.details.volume.valeur || 0)}`}>
                          <progress className="progress progress-primary w-20" value={item.details.volume.score} max="100"></progress>
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="tooltip" data-tip={`${item.details.qualite.incidents} incidents`}>
                          <progress className={`progress w-20 ${
                            item.details.qualite.score >= 90 ? 'progress-success' : 'progress-error'
                          }`} value={item.details.qualite.score} max="100"></progress>
                        </div>
                      </td>
                      <td className="text-center">
                         <div className="tooltip" data-tip={`${item.details.regularite.nb_livraisons} livraisons`}>
                          <progress className="progress progress-info w-20" value={item.details.regularite.score} max="100"></progress>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
             <div className="h-48 flex items-center justify-center text-base-content/50">
              {t('supplier.no_data_12m', 'Aucune donnée fournisseur disponible sur 12 mois')}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {caEvolution && (
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <h3 className="text-lg font-semibold mb-4">
              {t('summary', 'Résumé Annuel')}
            </h3>
            <div className="stats stats-vertical lg:stats-horizontal w-full">
              <div className="stat">
                <div className="stat-title">{t('summary_stats.total_ca_12m', 'CA Total (12 mois)')}</div>
                <div className="stat-value text-primary">{formatMoneyFull(caEvolution.total_current)}</div>
                <div className="stat-desc">{t('summary_stats.vs_n1', { amount: formatMoneyFull(caEvolution.total_n1) })}</div>
              </div>
              {margesData && (
                <div className="stat">
                  <div className="stat-title">{t('summary_stats.total_margin', 'Marge Totale')}</div>
                  <div className="stat-value text-success">{formatMoneyFull(margesData.total_marge)}</div>
                  <div className="stat-desc">{t('summary_stats.avg_rate', { rate: margesData.taux_moyen })}</div>
                </div>
              )}
              {kpis && (
                <div className="stat">
                  <div className="stat-title">{t('summary_stats.annual_ca', 'CA Annuel')}</div>
                  <div className="stat-value">{formatMoneyFull(kpis.ca_annee)}</div>
                  <div className="stat-desc">{t('summary_stats.sales_count', { count: kpis.nb_ventes_annee })}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

