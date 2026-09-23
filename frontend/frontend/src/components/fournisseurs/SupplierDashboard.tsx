import React from 'react';
import { 
  TrendingDown, 
  AlertCircle, 
  Calendar, 
  ArrowUpRight,
  TrendingUp,
  PieChart as PieChartIcon,
  ChevronRight,
  RefreshCw,
  Clock
} from 'lucide-react';
import { useRecharts } from '../../hooks/useRecharts';
import { formatCurrency } from '../../utils/formatters';
import { useSupplierDashboard } from '../../hooks/useSupplierDashboard';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { useTranslation } from 'react-i18next';

// Palette alignée sur les tokens sémantiques du design system (index.css @theme).
// Les références var(--color-*) s'adaptent au thème (clair / midnight) ;
// les hex restent pour les teintes sans token dédié (violet, ardoise).
const COLORS = [
  'var(--color-success)',  // ex-#10b981
  'var(--color-info)',     // ex-#6366f1 → info (bleu médical)
  'var(--color-warning)',  // ex-#f59e0b (identique au token)
  'var(--color-error)',    // ex-#ef4444 (identique au token)
  '#a855f7',               // violet — aucun token dédié dans @theme
  '#64748b',               // ardoise — aucun token dédié dans @theme
];

const getStatusKey = (status: string) => {
  const normalized = status?.toUpperCase().replace(/\s+/g, '_').replace(/'/g, '') ?? '';
  switch (normalized) {
    case 'EN_RETARD': return 'schedule.status_late';
    case 'AUJOURDHUI':
    case 'AUJOURD_HUI': return 'schedule.status_today';
    default: return 'schedule.status_upcoming';
  }
};

interface SupplierDashboardProps {
  onViewAllDeadlines?: () => void;
}

export default function SupplierDashboard({ onViewAllDeadlines }: SupplierDashboardProps) {
  const { stats, loading, error, refresh } = useSupplierDashboard();
  const { t } = useTranslation(['providers', 'common']);
  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' });
  const Recharts = useRecharts();
  if (!Recharts) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } = Recharts;


  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-4">
        <ErrorState error={error || t('providers:messages.load_error')} onRetry={() => refresh()} />
      </div>
    );
  }

  const kpis = [
    {
      title: t('providers:dashboard.kpis.total_debt'),
      value: formatCurrency(stats?.total_dette ?? 0),
      sub: t('providers:dashboard.kpis.active_providers', { count: stats?.nb_fournisseurs_actifs ?? 0 }),
      icon: TrendingDown,
      accent: 'var(--color-success)',
      isPositive: true,
    },
    {
      title: t('providers:dashboard.kpis.overdue'),
      value: formatCurrency(stats?.stats_echeances?.en_retard ?? 0),
      sub: t('providers:dashboard.kpis.late_schedules', { count: stats?.stats_echeances?.count_retard ?? 0 }),
      icon: AlertCircle,
      accent: 'var(--color-primary)',
      isPositive: false,
      alert: (stats?.stats_echeances?.count_retard ?? 0) > 0
    },
    {
      title: t('providers:dashboard.kpis.due_today'),
      value: formatCurrency(stats?.stats_echeances?.aujourdhui ?? 0),
      sub: t('providers:dashboard.kpis.immediate_pay'),
      icon: Clock,
      accent: 'color-mix(in srgb, var(--color-success) 80%, white)',
      isPositive: true,
    },
    {
      title: t('providers:dashboard.kpis.due_soon'),
      value: formatCurrency(stats?.stats_echeances?.a_venir ?? 0),
      sub: t('providers:dashboard.kpis.upcoming'),
      icon: Calendar,
      accent: 'color-mix(in srgb, var(--color-success) 55%, white)',
      isPositive: true,
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((card) => (
          <div key={card.title} className="bg-base-100 border border-base-300 rounded-2xl shadow-sm overflow-hidden group hover:shadow-md transition-all">
            <div className="relative p-4 flex flex-col gap-2 h-full">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: card.accent }} />
              
              <div className="flex items-start justify-between">
                <p className="text-caption font-black uppercase tracking-widest text-base-content/40 leading-tight">
                  {card.title}
                </p>
                <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${card.alert ? 'animate-pulse' : ''}`} style={{ background: `color-mix(in srgb, ${card.accent} 10%, transparent)`, color: card.accent }}>
                  <card.icon className="size-4" />
                </div>
              </div>

              <p className="text-xl font-black text-base-content tracking-tight leading-none">
                {card.value}
              </p>

              <div className="flex items-center gap-1.5 mt-auto">
                <span className={`inline-flex items-center gap-1 text-caption font-bold px-2 py-0.5 rounded-full ${
                  card.accent === 'var(--color-error)' || card.accent === 'var(--color-warning)' ? 'bg-error/10 text-error' : 'bg-info/10 text-info'
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
        <div className="xl:col-span-2 bg-base-100 border border-base-300 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 border-b border-base-200 bg-base-200/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-2xl">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('providers:dashboard.charts.evolution_title')}</h2>
                <p className="text-caption font-bold text-base-content/30 uppercase tracking-widest">{t('providers:dashboard.charts.evolution_subtitle')}</p>
              </div>
            </div>
            <button onClick={() => refresh()} className="inline-flex items-center justify-center size-7 rounded-full text-base-content/60 hover:bg-base-200 opacity-40 hover:opacity-100 transition-opacity" aria-label={t('common:refresh')}>
               <RefreshCw className="size-3" />
            </button>
          </div>
          
          <div className="p-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.evolution_dette ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDette" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-base-300)" />
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
                  stroke="var(--color-success)"
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
        <div className="bg-base-100 border border-base-300 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-base-200 bg-base-200/50">
            <div className="p-2.5 bg-warning/20 text-warning rounded-2xl">
              <PieChartIcon className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('providers:dashboard.charts.distribution_title')}</h2>
              <p className="text-caption font-bold text-base-content/30 uppercase tracking-widest">{t('providers:dashboard.charts.distribution_subtitle')}</p>
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
                      <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
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
                <div key={item.name} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-label font-bold text-base-content/70 truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="text-label font-black text-base-content">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Upcoming Deadlines Table */}
      <div className="bg-base-100 border border-base-300 rounded-3xl shadow-sm overflow-hidden flex flex-col max-h-[420px]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-base-200 bg-base-200/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-success/20 text-success rounded-2xl">
              <Calendar className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('providers:dashboard.deadlines.title')}</h2>
              <p className="text-caption font-bold text-base-content/30 uppercase tracking-widest">{t('providers:dashboard.deadlines.subtitle')}</p>
            </div>
          </div>
          <button 
            onClick={onViewAllDeadlines}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-base-content/60 hover:bg-base-200 text-caption font-black uppercase tracking-widest transition-colors"
          >
            {t('providers:dashboard.deadlines.view_all')} <ChevronRight className="size-3 ml-1" />
          </button>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead>
              <tr className="text-caption font-black uppercase text-base-content/40 bg-base-200/30 border-none">
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
                    <td colSpan={6}><EmptyState compact variant="base" title={t('providers:dashboard.deadlines.no_deadlines')} /></td>
                 </tr>
              ) : (stats?.prochaines_echeances ?? []).map((ech, _i) => (
                <tr key={ech.numero_facture} className="hover:bg-base-200/50 transition-colors group">
                  <td className="pl-6 py-4">
                    <span className="font-black text-base-content text-sm">{ech.fournisseur_nom}</span>
                  </td>
                  <td>
                    <span className="font-mono text-label text-base-content/50 uppercase">{ech.numero_facture}</span>
                  </td>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs">{new Date(ech.date_echeance).toLocaleDateString(currentLocale, { day: 'numeric', month: 'short' })}</span>
                      <span className={`text-caption font-bold ${ech.jours_restants < 0 ? 'text-error' : 'text-base-content/40'}`}>
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
                    <span className={`inline-flex items-center rounded-full font-black text-micro uppercase py-2 px-3 ${
                      ech.status === 'EN RETARD' ? 'bg-error/10 text-error' : 
                      ech.status === "AUJOURD'HUI" ? 'bg-warning/10 text-warning' : 
                      'bg-success/10 text-success'
                    }`}>
                      {t(getStatusKey(ech.status))}
                    </span>
                  </td>
                  <td className="pr-6 text-right">
                    <button className="inline-flex items-center justify-center size-7 rounded-full text-base-content/60 hover:bg-base-200 opacity-0 group-hover:opacity-100 transition-opacity" aria-label={t('providers:dashboard.deadlines.view_all')}>
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
