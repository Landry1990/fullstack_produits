import { 
  TrendingUp, 
  Wallet, 
  Users, 
  Package, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  History
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatters';

interface PerformanceOverviewProps {
  stats: any;
  revenueChart: any;
  hourlyTraffic: any;
  t: any;
  formatCurrencyLocal: (val: number) => string;
}

export default function PerformanceOverview({ 
  stats, 
  revenueChart, 
  hourlyTraffic, 
  t, 
  formatCurrencyLocal 
}: PerformanceOverviewProps) {
  
  const chartData = revenueChart && revenueChart.labels ? revenueChart.labels.map((label: string, index: number) => ({
    jour: label,
    montant: revenueChart.data[index]
  })) : [];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${stats?.role === 'VENDEUR' || stats?.role === 'CAISSIER' ? 'xl:grid-cols-2' : 'xl:grid-cols-4'} gap-4 auto-rows-fr`}>
        {(stats ? (stats.role === 'VENDEUR' || stats.role === 'CAISSIER' ? [
          {
            title: t('stats.my_sales'),
            value: formatCurrencyLocal(stats.user_stats?.sales ?? 0),
            change: t('stats.sales_count', { count: stats.user_stats?.count || 0 }),
            icon: TrendingUp,
            color: "text-indigo-600",
            bgColor: "bg-indigo-100/50",
            borderColor: "border-indigo-200/50",
            isPositive: true,
            details: t('stats.personal_cash')
          },
          {
            title: t('stats.my_avg_basket'),
            value: formatCurrencyLocal(stats.user_stats?.avg_basket ?? 0),
            change: t('stats.avg_per_client'),
            icon: Package,
            color: "text-fuchsia-600",
            bgColor: "bg-fuchsia-100/50",
            borderColor: "border-fuchsia-200/50",
            isPositive: true
          }
        ] : [
          ...(stats.user_stats ? [
            {
              title: t('stats.my_sales'),
              value: formatCurrencyLocal(stats.user_stats.sales ?? 0),
              change: t('stats.sales_count', { count: stats.user_stats.count ?? 0 }),
              icon: TrendingUp,
              color: "text-indigo-600",
              bgColor: "bg-indigo-100/50",
              borderColor: "border-indigo-200/50",
              isPositive: true,
              details: t('stats.personal_cash')
            }
          ] : []),
          { 
            title: t('stats.revenue'), 
            value: formatCurrencyLocal(stats.revenue?.value ?? 0), 
            change: `${(stats.revenue?.change || 0) > 0 ? '+' : ''}${stats.revenue?.change || 0}%`, 
            icon: Wallet, 
            color: "text-emerald-600", 
            bgColor: "bg-emerald-100/50", 
            borderColor: "border-emerald-200/50",
            isPositive: (stats.revenue?.change || 0) >= 0,
            details: t('stats.revenue_details', { amount: formatCurrency(stats.discount?.value ?? 0) })
          },
          ...(stats.margin_today !== undefined ? [{
            title: t('dashboard.stats.margin_today', { defaultValue: 'Marge Brute (Jour)' }),
            value: formatCurrencyLocal(stats.margin_today),
            change: `${((stats.margin_today / (stats.revenue?.value || 1)) * 100).toFixed(1)}%`,
            icon: Target,
            color: "text-purple-600",
            bgColor: "bg-purple-100/50",
            borderColor: "border-purple-200/50",
            isPositive: true,
            details: t('dashboard.stats.margin_rate', { defaultValue: 'Taux de marge estimé' })
          }] : []),
          { title: t('stats.receivables'), value: formatCurrency(stats.receivables?.value ?? 0), change: t('stats.invoices_count', { count: stats.receivables?.count || 0 }), icon: Users, color: "text-orange-600", bgColor: "bg-orange-100/50", borderColor: "border-orange-200/50", isPositive: false, link: '/app/creances' },
          { title: t('stats.stock_value'), value: formatCurrencyLocal(stats.stock_value?.value ?? 0), change: t('stats.products_count', { count: stats.stock_value?.count ?? 0 }), icon: Package, color: "text-amber-600", bgColor: "bg-amber-100/50", borderColor: "border-amber-200/50", isPositive: true }
        ]) : []).map((stat: any, index) => {
          const Icon = stat.icon;
          const content = (
            <div className={`card-body p-5 flex flex-row items-center justify-between h-full ${stat.link ? 'hover:bg-primary/5 active:scale-[0.98]' : ''} transition-all`}>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-1">{stat.title}</p>
                <h3 className="text-2xl font-black text-base-content tracking-tight truncate">{stat.value}</h3>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 ${
                    [t('stats.stock_alerts'), t('stats.stock_value')].includes(stat.title) 
                      ? 'bg-base-200 text-base-content/60' 
                      : (stat.isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')
                  }`}>
                    {stat.isPositive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                    {stat.change}
                  </span>
                  <span className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">
                    {stat.details ? stat.details : t('stats.vs_yesterday')}
                  </span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.bgColor} ${stat.color} border ${stat.borderColor} shadow-sm shrink-0 ml-4`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );

          return (
            <div key={index} className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden h-full">
              {stat.link ? (
                <Link to={stat.link} className="block h-full">
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-fr">
          {/* Revenue Bar Chart */}
          <div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden h-full flex flex-col">
            <div className="card-body p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('charts.revenue_evolution')}</h2>
                    <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">{t('charts.last_7_days')}</p>
                  </div>
                </div>
              </div>

              <div className="flex-grow min-h-[300px]">
                {revenueChart && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="jour" 
                          tick={{ fontSize: 10, fontWeight: 900, fill: '#9ca3af' }}
                          axisLine={false}
                          tickLine={false}
                          dy={10}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fontWeight: 900, fill: '#9ca3af' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                          domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.5)]}
                        />
                         <Tooltip 
                           formatter={(value: number) => [formatCurrencyLocal(value), t('charts.amount')]}
                           contentStyle={{ 
                            backgroundColor: '#fff',
                            border: 'none',
                            borderRadius: '12px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            padding: '12px'
                          }}
                           itemStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}
                           labelStyle={{ fontSize: '10px', fontWeight: 900, color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}
                          cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                        />
                        <Bar 
                          dataKey="montant" 
                          fill="url(#barGradient)" 
                          radius={[6, 6, 0, 0]}
                          animationDuration={1500}
                          barSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Hourly Traffic Chart */}
          <div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden h-full flex flex-col">
            <div className="card-body p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('hourly_traffic_title')}</h2>
                    <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">{t('hourly_traffic_desc')}</p>
                  </div>
                </div>
              </div>

              <div className="flex-grow min-h-[300px]">
                {hourlyTraffic && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={hourlyTraffic} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="hour" 
                          tick={{ fontSize: 10, fontWeight: 900, fill: '#9ca3af' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fontWeight: 900, fill: '#9ca3af' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <Tooltip 
                           contentStyle={{ 
                            backgroundColor: '#fff',
                            border: 'none',
                            borderRadius: '12px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            padding: '12px'
                          }}
                          itemStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}
                          labelStyle={{ fontSize: '10px', fontWeight: 900, color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="sales_count" 
                          stroke="#6366f1" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          fillOpacity={0.1} 
                          fill="#6366f1" 
                          name={t('dashboard.charts.avg_sales_label', { defaultValue: 'Moyenne (30j)' })}
                          animationDuration={1500}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="today_sales_count" 
                          stroke="#10b981" 
                          strokeWidth={4} 
                          fillOpacity={0.2} 
                          fill="url(#colorTraffic)" 
                          name={t('dashboard.charts.today_sales_label', { defaultValue: 'Aujourd\'hui' })}
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
