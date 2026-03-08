import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
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
import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  Package, 
  Wallet, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ArrowRight,
  RefreshCw,
  History,
  LayoutDashboard,
  CalendarDays
} from 'lucide-react';
import { 
  useDashboardStats, 
  useRevenueChart, 
  useHourlyTraffic, 
  useLowStock, 
  useUgStats, 
  usePromisDisponibles, 
  useExpiringLots,
  useSupplierDebts
} from '../hooks/useDashboard';

import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { t } = useTranslation();
  const { getServerDate } = useAuth();
  const [expirationMonths, setExpirationMonths] = useState(1); 
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: revenueChart, isLoading: chartLoading, refetch: refetchChart } = useRevenueChart();
  const { data: lowStockItems = [], refetch: refetchLowStock } = useLowStock();
  const { data: ugStats } = useUgStats();
  const { data: promisDisponibles = [] } = usePromisDisponibles();
  const { data: expiringLots = [], refetch: refetchExpiring } = useExpiringLots(expirationMonths);
  const { data: supplierDebts, refetch: refetchSupplierDebts, isRefetching: isRefetchingSupplierDebts } = useSupplierDebts();
  const { data: hourlyTraffic } = useHourlyTraffic();

  const loading = statsLoading || chartLoading;
  const error = statsError ? t('dashboard.error_loading') : null;

  const handleRefreshAll = async () => {
    await Promise.all([
      refetchStats(),
      refetchChart(),
      refetchLowStock(),
      refetchExpiring()
    ]);
    toast.success(t('dashboard.refresh_success'), { icon: '🔄' });
  };

  const chartData = useMemo(() => {
    if (!revenueChart || !revenueChart.labels || !revenueChart.data) return [];
    return revenueChart.labels.map((label, index) => ({
      jour: label,
      montant: revenueChart.data[index]
    }));
  }, [revenueChart]);

  useEffect(() => {
    if (expiringLots.length === 0) return;
    const today = getServerDate();
    const criticalLots = expiringLots.filter(lot => {
      if (!lot.date_expiration) return false;
      const daysUntil = Math.floor((new Date(lot.date_expiration).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 7;
    });
    if (criticalLots.length > 0) {
      toast.error(
        t('dashboard.alerts.critical_lots_toast', { count: criticalLots.length }),
        { duration: 5000, id: 'critical-expiration-dashboard' }
      );
    }
  }, [expiringLots.length]);

  useEffect(() => {
    if (promisDisponibles.length > 0) {
      toast.success(
        t('dashboard.alerts.promis_toast', { count: promisDisponibles.length }),
        { duration: 5000, id: 'promis-dispo-dashboard' }
      );
    }
  }, [promisDisponibles.length]);

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-96">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="alert alert-error shadow-sm rounded-2xl border-none">
          <AlertTriangle className="w-6 h-6" />
          <span className="font-bold text-sm tracking-tight">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl shadow-sm border border-primary/20">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-base-content tracking-tight">{t('dashboard.title')}</h1>
            <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-0.5">{t('dashboard.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-base-100 px-4 py-2.5 rounded-xl shadow-sm border border-base-300">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-base-content/60">
            {getServerDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button 
            className={`btn btn-xs btn-ghost btn-circle ${statsLoading || chartLoading ? 'loading' : 'hover:bg-primary/10 hover:text-primary'}`}
            onClick={handleRefreshAll}
            title="Actualiser les données"
          >
            {!(statsLoading || chartLoading) && <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${stats?.role === 'VENDEUR' || stats?.role === 'CAISSIER' ? 'xl:grid-cols-2' : 'xl:grid-cols-4'} gap-4`}>
        {(stats && (stats.role === 'VENDEUR' || stats.role === 'CAISSIER' ? [
          {
            title: t('dashboard.stats.my_sales'),
            value: formatCurrency(stats?.user_stats?.sales ?? 0),
            change: t('dashboard.stats.sales_count', { count: stats?.user_stats?.count || 0 }),
            icon: TrendingUp,
            color: "text-indigo-600",
            bgColor: "bg-indigo-100/50",
            borderColor: "border-indigo-200/50",
            isPositive: true,
            details: t('dashboard.stats.personal_cash')
          },
          {
            title: t('dashboard.stats.my_avg_basket'),
            value: formatCurrency(stats?.user_stats?.avg_basket ?? 0),
            change: t('dashboard.stats.avg_per_client'),
            icon: ShoppingBag,
            color: "text-fuchsia-600",
            bgColor: "bg-fuchsia-100/50",
            borderColor: "border-fuchsia-200/50",
            isPositive: true
          }
        ] : [
          ...(stats?.user_stats ? [
            {
              title: t('dashboard.stats.my_sales'),
              value: formatCurrency(stats?.user_stats?.sales ?? 0),
              change: t('dashboard.stats.sales_count', { count: stats?.user_stats?.count ?? 0 }),
              icon: TrendingUp,
              color: "text-indigo-600",
              bgColor: "bg-indigo-100/50",
              borderColor: "border-indigo-200/50",
              isPositive: true,
              details: t('dashboard.stats.personal_cash')
            }
          ] : []),
          { 
            title: t('dashboard.stats.revenue'), 
            value: formatCurrency(stats?.revenue?.value ?? 0), 
            change: `${(stats?.revenue?.change || 0) > 0 ? '+' : ''}${stats?.revenue?.change || 0}%`, 
            icon: Wallet, 
            color: "text-emerald-600", 
            bgColor: "bg-emerald-100/50", 
            borderColor: "border-emerald-200/50",
            isPositive: (stats?.revenue?.change || 0) >= 0,
            details: t('dashboard.stats.revenue_details', { amount: formatCurrency(stats?.discount?.value ?? 0) })
          },
          { title: t('dashboard.stats.receivables'), value: formatCurrency(stats?.receivables?.value ?? 0), change: t('dashboard.stats.invoices_count', { count: stats?.receivables?.count || 0 }), icon: Users, color: "text-orange-600", bgColor: "bg-orange-100/50", borderColor: "border-orange-200/50", isPositive: false, link: '/creances' },
          { title: t('dashboard.stats.stock_value'), value: formatCurrency(stats?.stock_value?.value ?? 0), change: t('dashboard.stats.products_count', { count: stats?.stock_value?.count ?? 0 }), icon: Package, color: "text-amber-600", bgColor: "bg-amber-100/50", borderColor: "border-amber-200/50", isPositive: true }
        ])).map((stat: any, index) => {
          const Icon = stat.icon;
          const content = (
            <div className={`card-body p-5 flex flex-row items-center justify-between ${stat.link ? 'hover:bg-primary/5 active:scale-[0.98]' : ''} transition-all`}>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-1">{stat.title}</p>
                <h3 className="text-2xl font-black text-base-content tracking-tight truncate">{stat.value}</h3>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 ${
                    [t('dashboard.stats.stock_alerts'), t('dashboard.stats.stock_value')].includes(stat.title) 
                      ? 'bg-base-200 text-base-content/60' 
                      : (stat.isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')
                  }`}>
                    {stat.isPositive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                    {stat.change}
                  </span>
                  <span className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">
                    {stat.details ? stat.details : t('dashboard.stats.vs_yesterday')}
                  </span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.bgColor} ${stat.color} border ${stat.borderColor} shadow-sm shrink-0 ml-4`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );

          return (
            <div key={index} className="card bg-white shadow-sm border border-base-300 rounded-2xl overflow-hidden">
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

      {/* Section Unités Gratuites (UG) - Hide for VENDEUR */}
      {ugStats && (ugStats as any).results && stats?.role !== 'VENDEUR' && stats?.role !== 'CAISSIER' && (
        <div className="card bg-white shadow-sm border border-base-300 rounded-2xl overflow-hidden">
          <div className="card-body p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('dashboard.ug.title')}</h2>
                  <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">{t('dashboard.ug.subtitle')}</p>
                </div>
              </div>
              <div className="badge bg-purple-100 text-purple-700 border-none font-black text-[10px] uppercase tracking-widest h-6 px-3">
                UG
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="table w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="bg-base-200/50 text-[10px] font-black uppercase tracking-widest text-base-content/40 py-3 rounded-l-xl">{t('dashboard.ug.provider')}</th>
                    <th className="bg-base-200/50 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right py-3">{t('dashboard.ug.acquired')}</th>
                    <th className="bg-base-200/50 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right py-3">{t('dashboard.ug.sold')}</th>
                    <th className="bg-base-200/50 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right py-3 rounded-r-xl">{t('dashboard.ug.remaining')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-100">
                  {(ugStats as any).results.map((stat: any, index: number) => (
                    <tr key={index} className="hover:bg-base-200/30 transition-all group">
                      <td className="py-4 font-black text-sm text-base-content group-hover:text-primary transition-colors">{stat.fournisseur_nom}</td>
                      <td className="text-right py-4 font-mono font-black text-xs text-purple-600">
                        {formatCurrency(stat.valeur_acquise)}
                      </td>
                      <td className="text-right py-4 font-mono font-black text-xs text-emerald-600">
                        {formatCurrency(stat.valeur_vendue)}
                      </td>
                      <td className="text-right py-4">
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg font-mono font-black text-xs border border-blue-100">
                          {formatCurrency(stat.valeur_restante)}
                        </span>
                      </td>
                    </tr>
                  ))}
                   {/* Total Row */}
                  {(ugStats as any).results.length > 0 && (
                      <tr className="bg-base-200/30 font-black border-t-2 border-base-200">
                        <td className="py-4 uppercase tracking-widest text-[10px] text-base-content/60">{t('dashboard.ug.total')}</td>
                        <td className="text-right py-4 text-purple-700 font-mono text-sm">
                          {formatCurrency((ugStats as any).results.reduce((sum: number, r: any) => sum + r.valeur_acquise, 0))}
                        </td>
                        <td className="text-right py-4 text-emerald-700 font-mono text-sm">
                          {formatCurrency((ugStats as any).results.reduce((sum: number, r: any) => sum + r.valeur_vendue, 0))}
                        </td>
                        <td className="text-right py-4 text-blue-700 font-mono text-sm">
                          {formatCurrency((ugStats as any).results.reduce((sum: number, r: any) => sum + r.valeur_restante, 0))}
                        </td>
                      </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {(!stats?.role || (stats.role !== 'VENDEUR' && stats.role !== 'CAISSIER')) && (
          /* Revenue Bar Chart */
          <div className="card bg-white shadow-sm border border-base-300 rounded-2xl overflow-hidden">
            <div className="card-body p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('dashboard.charts.revenue_evolution')}</h2>
                    <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">7 derniers jours</p>
                  </div>
                </div>
              </div>

              {revenueChart && (
                  <ResponsiveContainer width="100%" height={300}>
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
                         formatter={(value: number) => [formatCurrency(value), t('dashboard.charts.amount')]}
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
          )}

          {(!stats?.role || (stats.role !== 'VENDEUR' && stats.role !== 'CAISSIER')) && (
          /* Hourly Traffic Chart */
          <div className="card bg-white shadow-sm border border-base-300 rounded-2xl overflow-hidden">
            <div className="card-body p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('dashboard.charts.hourly_traffic_title')}</h2>
                    <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">Fréquentation horaire</p>
                  </div>
                </div>
              </div>

              {hourlyTraffic && (
                  <ResponsiveContainer width="100%" height={250}>
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
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorTraffic)" 
                        name={t('dashboard.charts.sales_label')}
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
              )}
            </div>
          </div>
          )}

          {(!stats?.role || (stats.role !== 'VENDEUR' && stats.role !== 'CAISSIER')) && (
          /* Supplier Debts Section */
          <div className="card bg-white shadow-sm border border-base-300 rounded-2xl overflow-hidden">
            <div className="card-body p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('dashboard.debts.supplier_debts_title')}</h2>
                    <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">Dettes envers les fournisseurs</p>
                  </div>
                </div>
                 <div className="flex items-center gap-3">
                      {supplierDebts && supplierDebts.total_debt > 0 && (
                         <div className="bg-red-50 text-red-700 px-4 py-1.5 rounded-xl font-black text-xs border border-red-100 shadow-sm animate-pulse">
                             {formatCurrency(supplierDebts.total_debt)}
                         </div>
                      )}
                     <button 
                        className={`btn btn-sm btn-circle btn-ghost ${isRefetchingSupplierDebts ? 'loading' : 'hover:bg-red-50 hover:text-red-600'}`}
                        onClick={() => refetchSupplierDebts()}
                     >
                        {!isRefetchingSupplierDebts && <RefreshCw className="w-4 h-4" />}
                     </button>
                 </div>
              </div>
              
              {supplierDebts?.suppliers && supplierDebts.suppliers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="table w-full border-separate border-spacing-y-2">
                        <thead>
                            <tr>
                                <th className="bg-base-200/50 text-[10px] font-black uppercase tracking-widest text-base-content/40 py-3 rounded-l-xl">{t('dashboard.debts.supplier')}</th>
                                <th className="bg-base-200/50 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right py-3">{t('dashboard.debts.debt')}</th>
                                <th className="bg-base-200/50 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center py-3 rounded-r-xl">{t('dashboard.debts.action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-100">
                            {supplierDebts.suppliers.map((supplier: any) => (
                                <tr key={supplier.id} className="hover:bg-red-50 transition-all group">
                                    <td className="py-4 font-black text-sm text-base-content group-hover:text-red-700 transition-colors">{supplier.name}</td>
                                     <td className="text-right py-4 font-mono font-black text-sm text-red-600">
                                         {formatCurrency(supplier.debt)}
                                     </td>
                                    <td className="text-center py-4">
                                        <Link 
                                            to="/app/fournisseurs" 
                                            className="btn btn-sm btn-ghost btn-circle text-base-content/20 group-hover:text-red-600 transition-all"
                                        >
                                            <ArrowRight className="w-5 h-5" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
              ) : (
                  <div className="flex flex-col items-center justify-center py-12 rounded-2xl bg-base-200/30 border-2 border-dashed border-base-300">
                      <div className="p-4 bg-white shadow-sm rounded-2xl mb-4">
                        <ShoppingBag className="w-8 h-8 text-base-content/10" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-base-content/30">{t('dashboard.debts.no_supplier_debts')}</p>
                  </div>
              )}
            </div>
          </div>
          )}


        </div>

        {/* Right Column: Quick Actions & Alerts */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card bg-white shadow-sm border border-base-300 rounded-2xl overflow-hidden">
            <div className="card-body p-6">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-4">{t('dashboard.actions.title')}</h2>
              <div className="grid grid-cols-1 gap-3">
                <Link to="/facturation" className="btn btn-primary h-14 w-full justify-between gap-3 text-white shadow-md hover:shadow-lg transition-all rounded-xl border-none group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest">{t('dashboard.actions.new_invoice')}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                </Link>
                <Link to="/produits" className="btn bg-base-100 hover:bg-base-200 h-12 w-full justify-between gap-3 text-base-content shadow-sm transition-all rounded-xl border border-base-300 group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-base-200 rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      <Package className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{t('dashboard.actions.manage_products')}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-base-content/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
                <Link to="/clients" className="btn bg-base-100 hover:bg-base-200 h-12 w-full justify-between gap-3 text-base-content shadow-sm transition-all rounded-xl border border-base-300 group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-base-200 rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{t('dashboard.actions.new_client')}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-base-content/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              </div>
            </div>
          </div>

          {/* Promis Disponibles Alert */}
          {promisDisponibles.length > 0 && (
            <div className="card bg-emerald-50 shadow-sm border border-emerald-100 rounded-2xl overflow-hidden">
              <div className="card-body p-6">
                <div 
                  className="flex items-center justify-between mb-4 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate('/app/promis')}
                >
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-sm font-black text-emerald-800 tracking-tight uppercase">{t('dashboard.alerts.promis_title')}</h2>
                  </div>
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-black">{promisDisponibles.length}</span>
                </div>
                <div className="space-y-2">
                  {promisDisponibles.slice(0, 3).map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-emerald-100 shadow-sm transition-all hover:border-emerald-300">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-black text-base-content block truncate">{p.produit_nom}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{p.client.length > 15 ? p.client.substring(0, 15) + '...' : p.client}</span>
                          <span className="text-[10px] text-base-content/30">•</span>
                          <span className="text-[10px] font-black text-base-content/50">{p.quantite} UNITÉS</span>
                        </div>
                      </div>
                      <div className="bg-emerald-50 text-emerald-700 font-black text-[9px] px-2 py-1 rounded-lg uppercase tracking-widest">
                        {t('dashboard.alerts.days_left', { count: p.jours_attente })}
                      </div>
                    </div>
                  ))}
                </div>
                <Link to="/app/promis" className="btn btn-sm btn-ghost w-full mt-4 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border-none font-black text-[10px] uppercase tracking-widest">
                  {t('dashboard.alerts.deliver_promis')}
                </Link>
              </div>
            </div>
          )}

          {/* Stock Alerts */}
          <div className="card bg-white shadow-sm border border-base-300 rounded-2xl overflow-hidden">
            <div className="card-body p-6">
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate('/app/centre-rapports?report=alertes_stock')}
                >
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-base-content tracking-tight uppercase">{t('dashboard.alerts.stock_title')}</h2>
                    <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">Alertes de rupture</p>
                  </div>
                </div>
                {stats && (stats.low_stock?.value || 0) > 0 && (
                  <span className="bg-amber-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-black animate-pulse">{stats.low_stock?.value || 0}</span>
                )}
              </div>
              <div className="space-y-3">
                {lowStockItems.length === 0 ? (
                  <div className="text-[10px] font-black uppercase tracking-widest text-base-content/30 text-center py-6 border-2 border-dashed border-base-200 rounded-xl">{t('dashboard.alerts.no_stock_alerts')}</div>
                ) : (
                  lowStockItems.slice(0, 4).map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${item.stock <= 0 ? 'bg-red-50 border-red-100 shadow-sm' : 'bg-amber-50 border-amber-100'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.stock <= 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-base-content truncate">{item.name}</span>
                            {(item as any).status && (item as any).status !== 'Rupture' && (item as any).status !== t('dashboard.alerts.rupture') && (
                                <span className="text-[9px] text-base-content/40 font-black uppercase tracking-widest">
                                    {(item as any).status}
                                </span>
                            )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 ml-3">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${item.stock <= 0 ? 'text-red-700' : 'text-amber-700'}`}>
                                {item.stock <= 0 ? t('dashboard.alerts.rupture') : t('dashboard.alerts.remaining_stock', { count: item.stock })}
                            </span>
                            {(item as any).days_remaining > 0 && item.stock > 0 && (
                                <span className="text-[9px] font-bold text-base-content/20 uppercase tracking-widest">
                                    {Math.round((item as any).days_remaining)} JOURS RESTANTS
                                </span>
                            )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-4">
                {lowStockItems.length > 0 && (
                  <button 
                    className="btn btn-primary btn-sm flex-1 text-[9px] font-black uppercase tracking-widest rounded-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/app/commandes/locales', { 
                        state: { 
                          createFromStockAlert: {
                            products: lowStockItems.map(item => ({
                              id: item.id,
                              name: item.name,
                              stock: item.stock
                            }))
                          }
                        }
                      });
                    }}
                  >
                    Commander
                  </button>
                )}
                <Link 
                  to="/app/produits" 
                  className="btn btn-ghost bg-base-100 hover:bg-base-200 btn-sm flex-1 text-base-content/60 text-[9px] font-black uppercase tracking-widest rounded-lg border border-base-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  Tout voir
                </Link>
              </div>
            </div>
          </div>

          {/* Expiring Lots */}
          <div className="card bg-white shadow-sm border border-base-300 rounded-2xl overflow-hidden">
            <div className="card-body p-6">
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate('/app/perimes')}
                >
                  <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-base-content tracking-tight uppercase">{t('dashboard.alerts.expiry_title')}</h2>
                    <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">Produits périmés bientôt</p>
                  </div>
                </div>
              </div>
              
              <div className="form-control mb-4">
                <select 
                  className="select select-bordered select-xs h-8 text-[10px] font-black uppercase tracking-widest text-base-content/50 rounded-lg bg-base-100 border-base-300 w-full focus:outline-none focus:border-primary"
                  value={expirationMonths}
                  onChange={(e) => setExpirationMonths(Number(e.target.value))}
                >
                  <option value={1}>1 MOIS (URGENT)</option>
                  <option value={2}>2 MOIS</option>
                  <option value={3}>3 MOIS</option>
                  <option value={6}>6 MOIS</option>
                  <option value={12}>1 AN</option>
                </select>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                {expiringLots.length === 0 ? (
                  <div className="text-[10px] font-black uppercase tracking-widest text-base-content/30 text-center py-6 border-2 border-dashed border-base-200 rounded-xl">{t('dashboard.alerts.no_expiry_alerts')}</div>
                ) : (
                  expiringLots.slice(0, 5).map((lot) => {
                    const today = getServerDate();
                    const daysUntilExpiry = lot.date_expiration 
                      ? Math.floor((new Date(lot.date_expiration).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    
                    let urgencyStyle = 'bg-amber-50 border-amber-100 text-amber-900';
                    let dotStyle = 'bg-amber-500';
                    
                    if (daysUntilExpiry <= 7) {
                      urgencyStyle = 'bg-red-50 border-red-200 text-red-900 shadow-sm';
                      dotStyle = 'bg-red-500';
                    } else if (daysUntilExpiry <= 30) {
                      urgencyStyle = 'bg-orange-50 border-orange-200 text-orange-900';
                      dotStyle = 'bg-orange-500';
                    }
                    
                    return (
                      <div key={lot.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all hover:scale-[1.02] ${urgencyStyle}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyle} ${daysUntilExpiry <= 7 ? 'animate-ping' : ''}`}></div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-black block truncate">{lot.produit_nom}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">LOT {lot.lot || 'N/A'}</span>
                              <span className="text-[9px] font-black opacity-60 uppercase tracking-widest">
                                EXP: {lot.date_expiration ? (() => { const d = new Date(lot.date_expiration); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white/50 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ml-3 shrink-0 whitespace-nowrap border border-current opacity-70">
                          {daysUntilExpiry <= 0 ? t('dashboard.alerts.expired') : t('dashboard.alerts.days_left', { count: daysUntilExpiry })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <Link to="/app/perimes" className="btn btn-ghost bg-base-100 hover:bg-base-200 btn-sm w-full mt-4 text-base-content/60 text-[9px] font-black uppercase tracking-widest rounded-lg border border-base-300">
                Gérer les périmés
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

