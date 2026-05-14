import React from 'react';
import { 
  TrendingDown, 
  AlertCircle, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  PieChart as PieChartIcon,
  ChevronRight,
  RefreshCw,
  Clock
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { useSupplierDashboard } from '../../hooks/useSupplierDashboard';
import { useTranslation } from 'react-i18next';

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#a855f7', '#64748b'];

interface SupplierDashboardProps {
  onViewAllDeadlines?: () => void;
}

export default function SupplierDashboard({ onViewAllDeadlines }: SupplierDashboardProps) {
  const { stats, loading, error, refresh } = useSupplierDashboard();
  const { t } = useTranslation(['providers', 'common']);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="size-8 text-primary animate-spin" />
        <p className="text-sm font-bold text-base-content/40 uppercase tracking-widest animate-pulse">{t('providers:dashboard.loading')}</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="alert alert-error shadow-lg rounded-2xl">
        <AlertCircle className="size-6" />
        <span>{error || t('providers:messages.load_error')}</span>
        <button className="btn btn-sm btn-ghost" onClick={refresh}>{t('common:retry')}</button>
      </div>
    );
  }

  const kpis = [
    {
      title: t('providers:dashboard.kpis.total_debt'),
      value: formatCurrency(stats?.total_dette ?? 0),
      sub: t('providers:dashboard.kpis.active_providers', { count: stats?.nb_fournisseurs_actifs ?? 0 }),
      icon: TrendingDown,
      accent: '#ef4444',
      isPositive: false,
    },
    {
      title: t('providers:dashboard.kpis.overdue'),
      value: formatCurrency(stats?.stats_echeances?.en_retard ?? 0),
      sub: t('providers:dashboard.kpis.late_schedules', { count: stats?.stats_echeances?.count_retard ?? 0 }),
      icon: AlertCircle,
      accent: '#f97316',
      isPositive: false,
      alert: (stats?.stats_echeances?.count_retard ?? 0) > 0
    },
    {
      title: t('providers:dashboard.kpis.due_today'),
      value: formatCurrency(stats?.stats_echeances?.aujourdhui ?? 0),
      sub: t('providers:dashboard.kpis.immediate_pay'),
      icon: Clock,
      accent: '#f59e0b',
      isPositive: false,
    },
    {
      title: t('providers:dashboard.kpis.due_soon'),
      value: formatCurrency(stats?.stats_echeances?.a_venir ?? 0),
      sub: t('providers:dashboard.kpis.upcoming'),
      icon: Calendar,
      accent: '#6366f1',
      isPositive: true,
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((card, i) => (
          <div key={i} className="bg-base-100 border border-base-200 rounded-3xl shadow-sm overflow-hidden group hover:shadow-md transition-all">
            <div className="relative p-5 flex flex-col gap-3 h-full">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: card.accent }} />
              
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 leading-tight">
                  {card.title}
                </p>
                <div className={`size-10 rounded-2xl flex items-center justify-center shrink-0 ${card.alert ? 'animate-pulse' : ''}`} style={{ background: card.accent + '15', color: card.accent }}>
                  <card.icon className="size-5" />
                </div>
              </div>

              <p className="text-2xl font-black text-base-content tracking-tight leading-none">
                {card.value}
              </p>

              <div className="flex items-center gap-1.5 mt-auto">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  card.accent === '#ef4444' || card.accent === '#f97316' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {card.sub}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Evolution Chart */}
        <div className="xl:col-span-2 bg-base-100 border border-base-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 border-b border-base-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-2xl">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('providers:dashboard.charts.evolution_title')}</h2>
                <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">{t('providers:dashboard.charts.evolution_subtitle')}</p>
              </div>
            </div>
            <button onClick={refresh} className="btn btn-ghost btn-circle btn-xs opacity-40 hover:opacity-100 transition-opacity">
               <RefreshCw className="size-3" />
            </button>
          </div>
          
          <div className="p-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.evolution_dette ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDette" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                  tickFormatter={(v: number) => `${v/1000}k`}
                  width={40}
                />
                <Tooltip 
                  contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  labelStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}
                  formatter={(v: number) => [formatCurrency(v), t('providers:dashboard.kpis.total_debt')]}
                />
                <Area 
                  type="monotone" 
                  dataKey="dette" 
                  stroke="#ef4444" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorDette)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Pie Chart */}
        <div className="bg-base-100 border border-base-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-base-100 bg-slate-50/50">
            <div className="p-2.5 bg-amber-100 text-amber-600 rounded-2xl">
              <PieChartIcon className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('providers:dashboard.charts.distribution_title')}</h2>
              <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">{t('providers:dashboard.charts.distribution_subtitle')}</p>
            </div>
          </div>
          
          <div className="p-6 flex-1 flex flex-col justify-center items-center">
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.repartition_dette}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {stats.repartition_dette.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                     formatter={(v: number) => formatCurrency(v)}
                     contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="w-full space-y-2 mt-4">
              {stats.repartition_dette.map((item, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-[11px] font-bold text-base-content/70 truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="text-[11px] font-black text-base-content">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Upcoming Deadlines Table */}
      <div className="bg-base-100 border border-base-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-base-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-2xl">
              <Calendar className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('providers:dashboard.deadlines.title')}</h2>
              <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">{t('providers:dashboard.deadlines.subtitle')}</p>
            </div>
          </div>
          <button 
            onClick={onViewAllDeadlines}
            className="btn btn-ghost btn-sm text-[10px] font-black uppercase tracking-widest"
          >
            {t('providers:dashboard.deadlines.view_all')} <ChevronRight className="size-3 ml-1" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-lg">
            <thead>
              <tr className="text-[10px] font-black uppercase text-base-content/40 bg-base-200/30 border-none">
                <th className="pl-6">{t('providers:table.provider')}</th>
                <th>{t('providers:finance.table.reference')}</th>
                <th>{t('providers:schedule.table.due_date')}</th>
                <th className="text-right">{t('providers:schedule.table.amount')}</th>
                <th className="text-center">{t('providers:schedule.table.status')}</th>
                <th className="pr-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-100">
              {(stats?.prochaines_echeances ?? []).length === 0 ? (
                 <tr>
                    <td colSpan={6} className="text-center py-8 text-base-content/30 font-bold uppercase text-xs tracking-widest">{t('providers:dashboard.deadlines.no_deadlines')}</td>
                 </tr>
              ) : (stats?.prochaines_echeances ?? []).map((ech, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="pl-6 py-4">
                    <span className="font-black text-base-content text-sm">{ech.fournisseur_nom}</span>
                  </td>
                  <td>
                    <span className="font-mono text-[11px] text-base-content/50 uppercase">{ech.numero_facture}</span>
                  </td>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs">{new Date(ech.date_echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                      <span className={`text-[10px] font-bold ${ech.jours_restants < 0 ? 'text-red-500' : 'text-base-content/40'}`}>
                        {ech.jours_restants < 0 
                          ? t('providers:dashboard.deadlines.days_late', { count: Math.abs(ech.jours_restants) }) 
                          : t('providers:dashboard.deadlines.in_days', { count: ech.jours_restants })}
                      </span>
                    </div>
                  </td>
                  <td className="text-right">
                    <span className="font-black text-base-content text-sm">{formatCurrency(ech.montant_du)}</span>
                  </td>
                  <td className="text-center">
                    <span className={`badge badge-sm font-black text-[9px] uppercase py-2 px-3 border-none ${
                      ech.status === 'EN RETARD' ? 'bg-red-50 text-red-600' : 
                      ech.status === "AUJOURD'HUI" ? 'bg-amber-50 text-amber-600' : 
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      {ech.status}
                    </span>
                  </td>
                  <td className="pr-6 text-right">
                    <button className="btn btn-ghost btn-sm btn-circle opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowUpRight className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
