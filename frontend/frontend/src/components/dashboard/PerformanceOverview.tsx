import { Suspense } from 'react';
import { 
  TrendingUp, 
  Wallet, 
  Users, 
  Package, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  History,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  LineChart,
  Line,
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatters';

interface PerformanceOverviewProps {
  stats: any;
  revenueChart: any;
  hourlyTraffic: any;
  reapproStats?: { product_count: number; total_units_suggested: number };
  t: any;
  formatCurrencyLocal: (val: number) => string;
}

export default function PerformanceOverview({ 
  stats, 
  revenueChart, 
  hourlyTraffic, 
  reapproStats,
  t, 
  formatCurrencyLocal 
}: PerformanceOverviewProps) {
  const navigate = useNavigate();
  
  const chartData = revenueChart && revenueChart.labels ? revenueChart.labels.map((label: string, index: number) => ({
    jour: label,
    montant: revenueChart.data[index],
    nb_ventes: revenueChart.nb_ventes?.[index] ?? 0,
  })) : [];

  const isVendeur = stats?.role === 'VENDEUR' || stats?.role === 'CAISSIER';

  // KPI cards config
  const kpiCards = stats ? (isVendeur ? [
    {
      title: t('stats.my_sales'),
      value: formatCurrencyLocal(stats.user_stats?.sales ?? 0),
      sub: t('stats.sales_count', { count: stats.user_stats?.count || 0 }),
      icon: TrendingUp, accent: '#6366f1', isPositive: true,
    },
    {
      title: t('stats.my_avg_basket'),
      value: formatCurrencyLocal(stats.user_stats?.avg_basket ?? 0),
      sub: t('stats.avg_per_client'),
      icon: Package, accent: '#d946ef', isPositive: true,
    },
  ] : [
    ...(stats.user_stats ? [{
      title: t('stats.my_sales'),
      value: formatCurrencyLocal(stats.user_stats.sales ?? 0),
      sub: t('stats.sales_count', { count: stats.user_stats.count ?? 0 }),
      icon: TrendingUp, accent: '#6366f1', isPositive: true,
    }] : []),
    {
      title: t('stats.revenue'),
      value: formatCurrencyLocal(stats.revenue?.value ?? 0),
      sub: `${(stats.revenue?.change || 0) > 0 ? '+' : ''}${stats.revenue?.change || 0}% ${t('stats.vs_yesterday')}`,
      icon: Wallet, accent: '#10b981',
      isPositive: (stats.revenue?.change || 0) >= 0,
      highlight: true,
    },
    ...(stats.margin_today !== undefined ? [{
      title: t('dashboard.stats.margin_today', { defaultValue: 'Marge brute (jour)' }),
      value: formatCurrencyLocal(stats.margin_today),
      sub: `${((stats.margin_today / (stats.revenue?.value || 1)) * 100).toFixed(1)}% ${t('dashboard.stats.margin_rate', { defaultValue: 'taux de marge' })}`,
      icon: Target, accent: '#a855f7', isPositive: true,
    }] : []),
    {
      title: t('stats.receivables'),
      value: formatCurrency(stats.receivables?.value ?? 0),
      sub: t('stats.invoices_count', { count: stats.receivables?.count || 0 }),
      icon: Users, accent: '#f97316', isPositive: false,
      link: '/app/creances',
    },
    {
      title: t('stats.stock_value'),
      value: formatCurrencyLocal(stats.stock_value?.value ?? 0),
      sub: t('stats.products_count', { count: stats.stock_value?.count ?? 0 }),
      icon: Package, accent: '#f59e0b', isPositive: true,
    },
  ]) : [];

  return (
    <div className="space-y-5">

      {/* ── KPI CARDS ──────────────────────────────────────── */}
      <div className={`grid gap-3 ${
        isVendeur
          ? 'grid-cols-1 sm:grid-cols-2'
          : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      }`}>
        {kpiCards.map((card: any, i: number) => {
          const Icon = card.icon;
          const inner = (
            <div className="relative p-4 sm:p-5 flex flex-col gap-3 h-full overflow-hidden">
              {/* accent bar top */}
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: card.accent }} />

              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-base-content/50 leading-tight">
                  {card.title}
                </p>
                <div className="size-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: card.accent + '20', color: card.accent }}>
                  <Icon className="size-4.5" style={{ width: 18, height: 18 }} />
                </div>
              </div>

              <p className={`text-xl sm:text-2xl font-black text-base-content tracking-tight leading-none ${card.highlight ? 'text-3xl sm:text-4xl' : ''}`}>
                {card.value}
              </p>

              <div className="flex items-center gap-1.5 mt-auto">
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded ${
                  card.isPositive ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
                }`}>
                  {card.isPositive ? <ArrowUpRight className="size-2.5" /> : <ArrowDownRight className="size-2.5" />}
                  {card.sub}
                </span>
              </div>
            </div>
          );

          return (
            <div key={i} className={`bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden transition-all ${card.link ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]' : ''}`}>
              {card.link ? <Link to={card.link} className="block h-full">{inner}</Link> : inner}
            </div>
          );
        })}
      </div>

      {/* ── REAPPRO ALERT ──────────────────────────────────── */}
      {reapproStats && reapproStats.product_count > 0 && (
        <div
          className="flex items-center justify-between p-4 sm:p-5 bg-info rounded-2xl shadow-lg shadow-info/20 cursor-pointer hover:bg-info-focus transition-all group"
          onClick={() => navigate('/app/reappro-rayon')}
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="size-10 sm:w-12 sm:h-12 bg-info-content/20 rounded-xl flex items-center justify-center shrink-0 border border-info-content/30">
              <Package className="size-5 sm:w-6 sm:h-6 text-info-content" />
            </div>
            <div className="text-info-content min-w-0">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide leading-tight">{t('reappro.alert_title', { defaultValue: 'Réapprovisionnement rayon nécessaire' })}</h3>
              <p className="text-[10px] sm:text-xs font-bold opacity-75 mt-0.5 truncate">
                {reapproStats.product_count} produits · +{reapproStats.total_units_suggested} unités à transférer
              </p>
            </div>
          </div>
          <div className="size-8 rounded-full bg-info-content/10 flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform border border-info-content/20 ml-3">
            <ArrowRight className="size-4 text-info-content" />
          </div>
        </div>
      )}

      {/* ── CHARTS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Revenue Bar Chart */}
        <div className="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-base-200">
            <div className="p-2 bg-success/10 text-success rounded-lg">
              <TrendingUp className="size-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-base-content tracking-tight uppercase">{t('charts.revenue_evolution')}</h2>
              <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest">{t('charts.last_7_days')}</p>
            </div>
          </div>
          <div className="p-4 sm:p-5 h-64 sm:h-72">
            {revenueChart ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--bc) / 0.1)" />
                  <XAxis dataKey="jour" tick={{ fontSize: 11, fontWeight: 800, fill: 'hsl(var(--bc) / 0.6)' }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis yAxisId="ca" tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--bc) / 0.5)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrencyLocal(v)} width={80} />
                  <YAxis yAxisId="ventes" orientation="right" tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--wa))' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    formatter={(v: number, name: string) => name === 'montant' ? [formatCurrencyLocal(v), 'CA'] : [v, 'Ventes']}
                    contentStyle={{ backgroundColor: 'hsl(var(--b1))', border: '1px solid hsl(var(--bc) / 0.1)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,.2)', padding: '10px 14px' }}
                    itemStyle={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--bc))' }}
                    labelStyle={{ fontSize: 10, fontWeight: 900, color: 'hsl(var(--bc) / 0.5)', marginBottom: 4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', paddingTop: 8 }} />
                  <Line
                    yAxisId="ca"
                    type="monotone"
                    dataKey="montant"
                    name="CA"
                    stroke="url(#revenueGradient)"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: 'hsl(var(--b1))' }}
                    activeDot={{ r: 7, fill: '#10b981', strokeWidth: 2, stroke: 'hsl(var(--b1))' }}
                    animationDuration={1200}
                  />
                  <Line
                    yAxisId="ventes"
                    type="monotone"
                    dataKey="nb_ventes"
                    name="Ventes"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: 'hsl(var(--b1))' }}
                    activeDot={{ r: 6, fill: '#f59e0b' }}
                    animationDuration={1200}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-base-content/20">
                <TrendingUp className="size-12" />
              </div>
            )}
          </div>
        </div>

        {/* Hourly Traffic Chart */}
        <div className="bg-base-100 border border-base-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-base-200">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <History className="size-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-base-content tracking-tight uppercase">{t('hourly_traffic_title')}</h2>
              <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest">{t('hourly_traffic_desc')}</p>
            </div>
          </div>
          <div className="p-4 sm:p-5 h-64 sm:h-72">
            {hourlyTraffic ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyTraffic} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--bc) / 0.5)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--bc) / 0.5)' }} axisLine={false} tickLine={false} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--bc) / 0.1)" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--b1))', border: '1px solid hsl(var(--bc) / 0.1)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,.2)', padding: '10px 14px' }}
                    itemStyle={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--bc))' }}
                    labelStyle={{ fontSize: 10, fontWeight: 900, color: 'hsl(var(--bc) / 0.5)', marginBottom: 4 }}
                  />
                  <Area type="monotone" dataKey="sales_count" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" fillOpacity={0} fill="#6366f1" name={t('dashboard.charts.avg_sales_label', { defaultValue: 'Moy. 30j' })} animationDuration={1200} />
                  <Area type="monotone" dataKey="today_sales_count" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTraffic)" name={t('dashboard.charts.today_sales_label', { defaultValue: "Aujourd'hui" })} animationDuration={1200} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-base-content/20">
                <History className="size-12" />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
