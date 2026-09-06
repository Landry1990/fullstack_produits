import { useMemo } from 'react';
import { 
  TrendingUp, 
  Wallet, 
  Users, 
  Package, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  History,
  ArrowRight,
  HandCoins,
  AlertTriangle,
  Receipt
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRecharts } from '../../hooks/useRecharts';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatters';
import type { TFunction } from 'i18next';
import type { DashboardStats, RevenueChartData, HourlyTrafficData, SupplierDebtsResponse, FrequentStockoutItem } from '../../hooks/useDashboard';

interface KpiCard {
  title: string;
  value: string;
  sub: string;
  icon: typeof TrendingUp;
  accent: string;
  isPositive: boolean;
  highlight?: boolean;
  link?: string;
}

interface PerformanceOverviewProps {
  stats: DashboardStats | undefined;
  revenueChart: RevenueChartData | undefined;
  hourlyTraffic: HourlyTrafficData[] | undefined;
  reapproStats?: { product_count: number; total_units_suggested: number };
  supplierDebts?: SupplierDebtsResponse | undefined;
  frequentStockouts?: FrequentStockoutItem[];
  t: TFunction;
  formatCurrencyLocal: (val: number) => string;
}

export default function PerformanceOverview({
  stats,
  revenueChart,
  hourlyTraffic,
  reapproStats,
  supplierDebts,
  frequentStockouts,
  t,
  formatCurrencyLocal
}: PerformanceOverviewProps) {
  const navigate = useNavigate();
  const Recharts = useRecharts();
  if (!Recharts) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" /></div>;
  const { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } = Recharts;
  
  const chartData = useMemo(() => revenueChart && revenueChart.labels ? revenueChart.labels.map((label: string, index: number) => ({
    jour: label,
    montant: revenueChart.data[index],
    nb_ventes: (revenueChart as RevenueChartData & { nb_ventes?: number[] }).nb_ventes?.[index] ?? 0,
  })) : [], [revenueChart]);

  const isVendeur = stats?.role === 'VENDEUR' || stats?.role === 'CAISSIER';

  const totalDettes = supplierDebts?.total_debt ?? 0;
  const nbFournisseursDetteurs = supplierDebts?.suppliers?.length ?? 0;

  // KPI cards config
  const kpiCards = useMemo(() => stats ? (isVendeur ? [
    {
      title: t('stats.my_avg_basket'),
      value: formatCurrencyLocal(stats.user_stats?.avg_basket ?? 0),
      sub: t('stats.avg_per_client'),
      icon: Package, accent: '#10b981', isPositive: true,
    },
    {
      title: t('stats.supplier_debts_title', 'Dettes fournisseurs'),
      value: formatCurrencyLocal(totalDettes),
      sub: nbFournisseursDetteurs > 1
        ? t('stats.supplier_debts_sub_plural', '{{count}} fournisseurs concernés', { count: nbFournisseursDetteurs })
        : t('stats.supplier_debts_sub', '{{count}} fournisseur concerné', { count: nbFournisseursDetteurs }),
      icon: HandCoins, accent: '#10b981', isPositive: true,
      link: '/app/fournisseurs',
    },
  ] : [
    {
      title: t('stats.revenue'),
      value: formatCurrencyLocal(stats.revenue?.value ?? 0),
      sub: `${(stats.revenue?.change || 0) > 0 ? '+' : ''}${stats.revenue?.change || 0}% ${t('stats.vs_yesterday')}`,
      icon: Wallet, accent: '#10b981',
      isPositive: (stats.revenue?.change || 0) >= 0,
      highlight: true,
      link: '/app/historique-ventes',
    },
    ...(stats.margin_today !== undefined ? [{
      title: t('stats.margin_today'),
      value: formatCurrencyLocal(stats.margin_today),
      sub: `${((stats.margin_today / (stats.revenue?.value || 1)) * 100).toFixed(1)}% ${t('stats.margin_rate')}`,
      icon: Target, accent: '#10b981', isPositive: true,
    }] : []),
    {
      title: t('stats.receivables'),
      value: formatCurrency(stats.receivables?.value ?? 0),
      sub: t('stats.invoices_count', { count: stats.receivables?.count || 0 }),
      icon: Users, accent: '#10b981', isPositive: true,
      link: '/app/creances',
    },
    {
      title: t('stats.supplier_debts_title', 'Dettes fournisseurs'),
      value: formatCurrencyLocal(totalDettes),
      sub: nbFournisseursDetteurs > 1
        ? t('stats.supplier_debts_sub_plural', '{{count}} fournisseurs concernés', { count: nbFournisseursDetteurs })
        : t('stats.supplier_debts_sub', '{{count}} fournisseur concerné', { count: nbFournisseursDetteurs }),
      icon: HandCoins, accent: '#10b981', isPositive: true,
      link: '/app/fournisseurs',
    },
    {
      title: t('stats.stock_value'),
      value: formatCurrencyLocal(stats.stock_value?.value ?? 0),
      sub: t('stats.products_count', { count: stats.stock_value?.count ?? 0 }),
      icon: Package, accent: '#10b981', isPositive: true,
    },
  ]) : [], [isVendeur, stats, totalDettes, nbFournisseursDetteurs, t, formatCurrencyLocal]);

  return (
    <div className="space-y-5">

      {/* ── KPI CARDS ──────────────────────────────────────── */}
      <div className={`grid gap-3 ${
        isVendeur
          ? 'grid-cols-1 sm:grid-cols-2'
          : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5'
      }`}>
        {kpiCards.map((card: KpiCard, _i: number) => {
          const Icon = card.icon;
          const inner = (
            <div className="relative p-2 sm:p-3 xl:p-3.5 flex flex-col gap-1 sm:gap-1.5 h-full overflow-hidden">
              {/* accent bar top */}
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: card.accent }} />

              <div className="flex items-start justify-between gap-2">
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 leading-tight">
                  {card.title}
                </p>
                <div className="size-7 xl:size-8 rounded-lg xl:rounded-xl flex items-center justify-center shrink-0" style={{ background: card.accent + '20', color: card.accent }}>
                  <Icon className="size-3.5 xl:size-4" />
                </div>
              </div>

              <p className={`text-base sm:text-lg xl:text-xl font-black text-slate-800 tracking-tight leading-none ${card.highlight ? 'xl:text-2xl' : ''}`}>
                {card.value}
              </p>

              <div className="flex items-center gap-1.5 mt-auto">
                <span className={`inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded ${
                  card.isPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                }`}>
                  {card.isPositive ? <ArrowUpRight className="size-2.5" /> : <ArrowDownRight className="size-2.5" />}
                  {card.sub}
                </span>
              </div>
            </div>
          );

          return (
            <div key={card.title} className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all ${card.link ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]' : ''}`}>
              {card.link ? <Link to={card.link} className="block h-full">{inner}</Link> : inner}
            </div>
          );
        })}
      </div>

      {/* ── REAPPRO ALERT ──────────────────────────────────── */}
      {reapproStats && reapproStats.product_count > 0 && (
        <div
          className="flex items-center justify-between p-4 sm:p-5 bg-cyan-700 rounded-2xl shadow-lg shadow-cyan-700/20 cursor-pointer hover:bg-cyan-800 transition-all group"
          onClick={() => navigate('/app/reappro-rayon')}
          role="button"
          tabIndex={0}
          aria-label={t('reappro.alert_title')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/app/reappro-rayon'); } }}
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="size-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0 border border-white/30">
              <Package className="size-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="text-white min-w-0">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide leading-tight">{t('reappro.alert_title', { defaultValue: 'Réapprovisionnement rayon nécessaire' })}</h3>
              <p className="text-[10px] sm:text-xs font-bold opacity-75 mt-0.5 truncate">
                {t('reappro.products_waiting', '{{count}} produits', { count: reapproStats.product_count })} · +{reapproStats.total_units_suggested} {t('reappro.units_to_transfer', 'unités à transférer')}
              </p>
            </div>
          </div>
          <div className="size-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform border border-white/20 ml-3">
            <ArrowRight className="size-4 text-white" />
          </div>
        </div>
      )}

      {/* ── CHARTS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Revenue Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <TrendingUp className="size-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-700 tracking-tight uppercase">{t('charts.revenue_evolution')}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('charts.last_7_days')}</p>
            </div>
          </div>
          <div className="p-4 sm:p-5 h-64 sm:h-72">
            {revenueChart ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="jour" tick={{ fontSize: 11, fontWeight: 800, fill: '#64748b' }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis yAxisId="ca" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrencyLocal(v)} width={80} />
                  <YAxis yAxisId="ventes" orientation="right" tick={{ fontSize: 10, fontWeight: 700, fill: '#f59e0b' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    formatter={(v: number, name: string) => name === 'montant' ? [formatCurrencyLocal(v), t('charts.ca_label')] : [v, t('charts.sales_label')]}
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,.2)', padding: '10px 14px' }}
                    itemStyle={{ fontSize: 12, fontWeight: 700, color: '#334155' }}
                    labelStyle={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', marginBottom: 4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', paddingTop: 8 }} />
                  <Line
                    yAxisId="ca"
                    type="monotone"
                    dataKey="montant"
                    name={t('charts.ca_label')}
                    stroke="url(#revenueGradient)"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 7, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                    animationDuration={1200}
                  />
                  <Line
                    yAxisId="ventes"
                    type="monotone"
                    dataKey="nb_ventes"
                    name={t('charts.sales_label')}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#f59e0b' }}
                    animationDuration={1200}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300">
                <TrendingUp className="size-12" />
              </div>
            )}
          </div>
        </div>

        {/* Hourly Traffic Chart */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <History className="size-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-700 tracking-tight uppercase">{t('hourly_traffic_title')}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('hourly_traffic_desc')}</p>
            </div>
          </div>
          <div className="p-4 sm:p-5 h-64 sm:h-72">
            {hourlyTraffic ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyTraffic} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,.2)', padding: '10px 14px' }}
                    itemStyle={{ fontSize: 12, fontWeight: 700, color: '#334155' }}
                    labelStyle={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', marginBottom: 4 }}
                  />
                  <Area type="monotone" dataKey="sales_count" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fillOpacity={0} fill="#94a3b8" name={t('charts.avg_sales_label')} animationDuration={1200} />
                  <Area type="monotone" dataKey="today_sales_count" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTraffic)" name={t('charts.today_sales_label')} animationDuration={1200} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300">
                <History className="size-12" />
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── P&L HISTORY + FREQUENT STOCKOUTS (same grid as charts) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

      {/* ── 7-DAY P&L HISTORY TABLE ─────────────────────────── */}
      {revenueChart && revenueChart.labels && revenueChart.couts && revenueChart.marges && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Receipt className="size-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-700 tracking-tight uppercase">{t('charts.pnl_history_title', 'Historique CA & Marges (7 jours)')}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('charts.pnl_history_desc', "Chiffre d'affaires, coûts d'achat et marges par jour")}</p>
            </div>
          </div>
          <div className="p-4 sm:p-5 h-64 sm:h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th scope="col" className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left px-5 py-2">{t('charts.pnl_day')}</th>
                  <th scope="col" className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right px-3 py-2">{t('charts.pnl_ca_ttc')}</th>
                  <th scope="col" className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right px-3 py-2">{t('charts.pnl_cout_achat')}</th>
                  <th scope="col" className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right px-3 py-2">{t('charts.pnl_marge_brute')}</th>
                  <th scope="col" className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right px-3 py-2">{t('charts.pnl_tx_marge')}</th>
                  <th scope="col" className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-center px-3 py-2">{t('charts.pnl_ventes')}</th>
                </tr>
              </thead>
              <tbody>
                {revenueChart.labels.map((label: string, i: number) => {
                  const ca = revenueChart.data[i] ?? 0;
                  const cout = revenueChart.couts?.[i] ?? 0;
                  const marge = revenueChart.marges?.[i] ?? 0;
                  const margePct = revenueChart.marges_pct?.[i] ?? 0;
                  const nbVentes = revenueChart.nb_ventes?.[i] ?? 0;
                  const isToday = i === revenueChart.labels.length - 1;
                  return (
                    <tr key={label} className={`border-b border-slate-50 ${isToday ? 'bg-emerald-50/30' : ''}`}>
                      <td className="px-5 py-2.5">
                        <span className="font-bold text-slate-700 text-xs">{label}</span>
                        {isToday && <span className="ml-2 text-[9px] font-black uppercase text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">{t('charts.pnl_today')}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-800 text-xs">{formatCurrencyLocal(ca)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500 text-xs font-medium">{formatCurrencyLocal(cout)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-xs" style={{ color: marge >= 0 ? '#059669' : '#dc2626' }}>{formatCurrencyLocal(marge)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`inline-flex items-center gap-0.5 text-xs font-black px-1.5 py-0.5 rounded ${margePct >= 25 ? 'bg-emerald-100 text-emerald-600' : margePct >= 15 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                          {margePct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-500 text-xs font-medium">{nbVentes}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                  <td className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">{t('charts.pnl_total')}</td>
                  <td className="px-3 py-3 text-right font-black text-slate-800 text-xs">{formatCurrencyLocal(revenueChart.data.reduce((a: number, b: number) => a + b, 0))}</td>
                  <td className="px-3 py-3 text-right font-bold text-slate-500 text-xs">{formatCurrencyLocal((revenueChart.couts ?? []).reduce((a: number, b: number) => a + b, 0))}</td>
                  <td className="px-3 py-3 text-right font-black text-xs" style={{ color: '#059669' }}>{formatCurrencyLocal((revenueChart.marges ?? []).reduce((a: number, b: number) => a + b, 0))}</td>
                  <td className="px-3 py-3 text-right">
                    {(() => {
                      const totalCa = (revenueChart.couts ?? []).reduce((a: number, b: number) => a + b, 0) + (revenueChart.marges ?? []).reduce((a: number, b: number) => a + b, 0);
                      const totalMarge = (revenueChart.marges ?? []).reduce((a: number, b: number) => a + b, 0);
                      const avgPct = totalCa > 0 ? (totalMarge / totalCa * 100) : 0;
                      return <span className="inline-flex items-center gap-0.5 text-xs font-black px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">{avgPct.toFixed(1)}%</span>;
                    })()}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-slate-500 text-xs">{(revenueChart.nb_ventes ?? []).reduce((a: number, b: number) => a + b, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── FREQUENT STOCKOUTS ─────────────────────────────── */}
      {frequentStockouts && frequentStockouts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <AlertTriangle className="size-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-700 tracking-tight uppercase">{t('charts.frequent_stockouts_title', 'Top 10 ruptures fréquentes (30 jours)')}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('charts.frequent_stockouts_desc', 'Produits qui tombent à 0 le plus souvent')}</p>
            </div>
          </div>
          <div className="p-4 sm:p-5 h-64 sm:h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th scope="col" className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left px-5 py-2">#</th>
                  <th scope="col" className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left px-3 py-2">{t('charts.fs_product')}</th>
                  <th scope="col" className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-center px-3 py-2">{t('charts.fs_ruptures')}</th>
                  <th scope="col" className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-center px-3 py-2">{t('charts.fs_stock_current')}</th>
                  <th scope="col" className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-center px-3 py-2">{t('charts.fs_stock_min')}</th>
                  <th scope="col" className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-center px-3 py-2">{t('charts.fs_rotation')}</th>
                </tr>
              </thead>
              <tbody>
                {frequentStockouts.map((item, idx) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/app/produits?search=${encodeURIComponent(item.name)}`)}>
                    <td className="px-5 py-2.5 text-slate-400 font-black text-xs">{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-800 text-xs leading-tight">{item.name}</div>
                      {item.cip && <div className="text-[10px] text-slate-400 font-mono">{item.cip}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-black text-xs">
                        {item.rupture_count}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`font-bold text-xs ${item.stock <= 0 ? 'text-red-600' : 'text-slate-700'}`}>{item.stock}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-500 text-xs font-medium">{item.stock_minimum}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500 text-xs font-medium">{item.rotation.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>

    </div>
  );
}
