import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { 
  useDashboardStats, 
  useRevenueChart, 
  useLowStock, 
  useUgStats, 
  usePromisDisponibles, 
  useExpiringLots 
} from '../hooks/useDashboard';

import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { t } = useTranslation();
  const [expirationMonths, setExpirationMonths] = useState(1); // Délai par défaut: 1 mois
  const navigate = useNavigate();

  // Queries with refetch functions
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: revenueChart, isLoading: chartLoading, refetch: refetchChart } = useRevenueChart();
  const { data: lowStockItems = [], isFetching: lowStockFetching, refetch: refetchLowStock } = useLowStock();
  const { data: ugStats } = useUgStats();
  const { data: promisDisponibles = [] } = usePromisDisponibles();
  const { data: expiringLots = [], refetch: refetchExpiring } = useExpiringLots(expirationMonths);

  const loading = statsLoading || chartLoading;
  const error = statsError ? 'Impossible de charger les données du tableau de bord.' : null;

  // Refresh all dashboard data
  const handleRefreshAll = async () => {
    await Promise.all([
      refetchStats(),
      refetchChart(),
      refetchLowStock(),
      refetchExpiring()
    ]);
    toast.success('Données mises à jour', { icon: '🔄' });
  };

  // Transform data for Recharts
  const chartData = useMemo(() => {
    if (!revenueChart || !revenueChart.labels || !revenueChart.data) return [];
    return revenueChart.labels.map((label, index) => ({
      jour: label,
      montant: revenueChart.data[index]
    }));
  }, [revenueChart]);

  // Notifications (controlled side effects)
  // We use refs to prevent duplicate toasts in strict mode or react-query refetches
  // However, simple useEffect dependency on data length or ID change is usually enough
  
  // Critical Lots Notification
  useEffect(() => {
    if (expiringLots.length === 0) return;
    
    const today = new Date();
    const criticalLots = expiringLots.filter(lot => {
      if (!lot.date_expiration) return false;
      const daysUntil = Math.floor((new Date(lot.date_expiration).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 7;
    });
    
    // Only show if we have critical lots and haven't shown it recently
    if (criticalLots.length > 0) {
      // Use specific ID to prevent duplicates
      toast.error(
        `⚠️ ${criticalLots.length} lot${criticalLots.length > 1 ? 's' : ''} expire${criticalLots.length > 1 ? 'nt' : ''} dans moins de 7 jours!`,
        { duration: 5000, id: 'critical-expiration-dashboard' }
      );
    }
  }, [expiringLots.length]); // Depend on length to re-trigger if count changes meaningfully

  // Promis Notification
  useEffect(() => {
    if (promisDisponibles.length > 0) {
      toast.success(
        `📦 ${promisDisponibles.length} produit(s) promis disponible(s) !`,
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
        <div className="alert alert-error shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-base-content">{t('dashboard.title')}</h1>
          <p className="text-xs sm:text-sm text-base-content/80">{t('dashboard.subtitle')}</p>
        </div>
        <div className="text-xs sm:text-sm font-medium text-base-content/80 bg-base-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow-sm border border-base-200">
          {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${stats?.role === 'VENDEUR' || stats?.role === 'CAISSIER' ? 'xl:grid-cols-2' : 'xl:grid-cols-4'} gap-4`}>
        {stats && (stats.role === 'VENDEUR' || stats.role === 'CAISSIER' ? (
           // VIEW VENDEUR / CAISSIER (Restricted)
           [
             {
              title: "MES VENTES (JOUR)",
              value: `${Math.round(stats.user_stats?.sales || 0).toLocaleString('fr-FR')} F`,
              change: `${stats.user_stats?.count || 0} ventes`,
              icon: "👤",
              color: "bg-indigo-100 text-indigo-700",
              isPositive: true,
              details: "Encaissements personnels"
             },
             {
              title: "MON PANIER MOYEN",
              value: `${Math.round(stats.user_stats?.avg_basket || 0).toLocaleString('fr-FR')} F`,
              change: "Moyenne par client",
              icon: "🛍️",
              color: "bg-fuchsia-100 text-fuchsia-700",
              isPositive: true
             }
           ]
        ) : (
           // VIEW PHARMACIEN / ADMIN (Full)
           [
            ...(stats.user_stats ? [
                {
                title: "MES VENTES (JOUR)",
                value: `${Math.round(stats.user_stats.sales).toLocaleString('fr-FR')} F`,
                change: `${stats.user_stats.count} ventes`,
                icon: "👤",
                color: "bg-indigo-100 text-indigo-700",
                isPositive: true,
                details: "Encaissements personnels"
                },
                {
                title: "MON PANIER MOYEN",
                value: `${Math.round(stats.user_stats.avg_basket).toLocaleString('fr-FR')} F`,
                change: "Moyenne par client",
                icon: "🛍️",
                color: "bg-fuchsia-100 text-fuchsia-700",
                isPositive: true
                }
            ] : []),
            { title: t('dashboard.stats.revenue'), 
                value: `${Math.round(stats.revenue?.value || 0).toLocaleString('fr-FR')} F`, 
                change: `${(stats.revenue?.change || 0) > 0 ? '+' : ''}${stats.revenue?.change || 0}%`, 
                icon: "💰", 
                color: "bg-emerald-100 text-emerald-700", 
                isPositive: (stats.revenue?.change || 0) >= 0,
                details: t('dashboard.stats.revenue_details', { amount: Math.round(stats.discount?.value || 0).toLocaleString('fr-FR') })
            },
            { title: t('dashboard.stats.receivables'), value: `${Math.round(stats.receivables?.value || 0).toLocaleString('fr-FR')} F`, change: `${stats.receivables?.count || 0} factures`, icon: "credit_card", color: "bg-orange-100 text-orange-700", isPositive: false, link: '/creances' },
            { title: t('dashboard.stats.stock_value'), value: `${Math.round(stats.stock_value?.value || 0).toLocaleString('fr-FR')} F`, change: t('dashboard.stats.stock_value_sub'), icon: "inventory", color: "bg-amber-100 text-amber-700", isPositive: true }
           ]
        )).map((stat: any, index) => {
          const content = (
            <div className={`card-body p-3 sm:p-4 flex flex-row items-center justify-between ${stat.link ? 'cursor-pointer hover:bg-base-200/30' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-base-content/70">{stat.title}</p>
                <h3 className="text-lg sm:text-2xl font-bold text-base-content mt-1 truncate">{stat.value}</h3>
                <span className={`text-xs font-medium ${['Alertes Stock', t('dashboard.stats.stock_alerts'), 'Valeur Stock', t('dashboard.stats.stock_value')].includes(stat.title) ? 'text-base-content/60' : ['Créances Clients', t('dashboard.stats.receivables'), 'MON PANIER MOYEN'].includes(stat.title) ? 'text-primary' : (stat.isPositive ? 'text-emerald-600' : 'text-red-600')}`}>
                  {stat.change} <span className="text-base-content/60 hidden sm:inline">{['Alertes Stock', t('dashboard.stats.stock_alerts')].includes(stat.title) ? '' : ['Valeur Stock', t('dashboard.stats.stock_value')].includes(stat.title) ? t('dashboard.stats.stock_value_details') : ['Créances Clients', t('dashboard.stats.receivables')].includes(stat.title) ? t('dashboard.stats.receivables_pending') : ['MES VENTES (JOUR)', 'MON PANIER MOYEN'].includes(stat.title) ? '' : 'vs hier'}</span>
                </span>
                {stat.details && (
                  <div className="text-xs text-base-content/50 mt-1 font-medium hidden sm:block">
                    {stat.details}
                  </div>
                )}
              </div>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-xl ${stat.color} shrink-0 ml-2`}>
                {stat.icon === 'shopping_cart' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                )}
                {stat.icon === 'group' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                )}
                {stat.icon === 'inventory' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                )}
                {stat.icon === 'warning' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                )}
                {stat.icon === 'credit_card' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                )}
                {stat.icon === '💰' && <span className="text-2xl">💰</span>}
                {stat.icon === '🏷️' && <span className="text-2xl">🏷️</span>}
                {stat.icon === '👤' && <span className="text-2xl">👤</span>}
                {stat.icon === '🛍️' && <span className="text-2xl">🛍️</span>}
              </div>
            </div>
          );

          return (
            <div key={index} className="card bg-base-100 shadow-sm border border-base-200">
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
        <div className="card bg-base-100 shadow-sm border border-base-200 w-full xl:w-2/3">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="card-title text-lg font-bold text-base-content">{t('dashboard.ug.title')}</h2>
                <p className="text-xs text-base-content/60 mt-1">{t('dashboard.ug.subtitle')}</p>
              </div>
              <div className="badge badge-primary badge-lg gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                UG
              </div>
            </div>
            
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="table table-zebra w-full text-sm">
                <thead>
                  <tr className="bg-base-200/50">
                    <th className="font-bold">{t('dashboard.ug.provider')}</th>
                    <th className="font-bold text-right text-purple-700">{t('dashboard.ug.acquired')}</th>
                    <th className="font-bold text-right text-green-700">{t('dashboard.ug.sold')}</th>
                    <th className="font-bold text-right text-blue-700">{t('dashboard.ug.remaining')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(ugStats as any).results.map((stat: any, index: number) => (
                    <tr key={index} className="hover:bg-base-200/50">
                      <td className="font-medium">{stat.fournisseur_nom}</td>
                      <td className="text-right font-medium text-purple-900">
                        {Math.round(stat.valeur_acquise).toLocaleString('fr-FR')} F
                      </td>
                      <td className="text-right font-medium text-green-900">
                        {Math.round(stat.valeur_vendue).toLocaleString('fr-FR')} F
                      </td>
                      <td className="text-right font-medium text-blue-900">
                        {Math.round(stat.valeur_restante).toLocaleString('fr-FR')} F
                      </td>
                    </tr>
                  ))}
                   {/* Total Row */}
                  {(ugStats as any).results.length > 0 && (
                     <tr className="bg-base-200 font-bold border-t-2 border-base-300">
                       <td>{t('dashboard.ug.total')}</td>
                       <td className="text-right text-purple-700">
                         {Math.round((ugStats as any).results.reduce((sum: number, r: any) => sum + r.valeur_acquise, 0)).toLocaleString('fr-FR')} F
                       </td>
                       <td className="text-right text-green-700">
                         {Math.round((ugStats as any).results.reduce((sum: number, r: any) => sum + r.valeur_vendue, 0)).toLocaleString('fr-FR')} F
                       </td>
                       <td className="text-right text-blue-700">
                         {Math.round((ugStats as any).results.reduce((sum: number, r: any) => sum + r.valeur_restante, 0)).toLocaleString('fr-FR')} F
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
        {/* Left Column: Charts & Transactions - Hide charts for VENDEUR */}
        <div className="xl:col-span-2 space-y-6">
          {(!stats?.role || (stats.role !== 'VENDEUR' && stats.role !== 'CAISSIER')) && (
          /* Revenue Bar Chart */
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <h2 className="card-title text-lg font-bold text-base-content mb-4">{t('dashboard.charts.revenue_evolution')}</h2>
              {revenueChart && (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="jour" 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        stroke="#9ca3af"
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        stroke="#9ca3af"
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.5)]}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`${Math.round(value).toLocaleString('fr-FR')} F`, 'Montant']}
                        contentStyle={{ 
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      />
                      <Bar 
                        dataKey="montant" 
                        fill="url(#barGradient)" 
                        radius={[8, 8, 0, 0]}
                        animationDuration={800}
                      />
                    </BarChart>
                  </ResponsiveContainer>
              )}
            </div>
          </div>
          )}

          {(!stats?.role || (stats.role !== 'VENDEUR' && stats.role !== 'CAISSIER')) && (
          /* Revenue Line Chart (Trend) */
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <h2 className="card-title text-lg font-bold text-base-content mb-4">{t('dashboard.charts.sales_trend')}</h2>
               {revenueChart && (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <defs>
                        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="jour" 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        stroke="#9ca3af"
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        stroke="#9ca3af"
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.5)]}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`${Math.round(value).toLocaleString('fr-FR')} F`, 'Chiffre d\'affaires']}
                        contentStyle={{ 
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="montant" 
                        stroke="url(#lineGradient)" 
                        strokeWidth={3}
                        dot={{ fill: '#10b981', r: 5 }}
                        activeDot={{ r: 7, fill: '#059669' }}
                        animationDuration={1000}
                      />
                    </LineChart>
                  </ResponsiveContainer>
               )}
            </div>
          </div>
          )}


        </div>

        {/* Right Column: Quick Actions & Alerts */}
        <div className="space-y-6">
          {/* Quick Actions - Touch-friendly */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-3 sm:p-4">
              <h2 className="card-title text-base sm:text-lg font-bold text-base-content mb-3 sm:mb-4">{t('dashboard.actions.title')}</h2>
              <div className="grid grid-cols-1 gap-2 sm:gap-3">
                <Link to="/facturation" className="btn btn-primary w-full justify-start gap-2 sm:gap-3 text-white shadow-md hover:shadow-lg transition-all min-h-12 sm:min-h-10">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                  {t('dashboard.actions.new_invoice')}
                </Link>
                <Link to="/produits" className="btn btn-outline btn-primary w-full justify-start gap-2 sm:gap-3 hover:bg-primary/10 min-h-12 sm:min-h-10">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  {t('dashboard.actions.manage_products')}
                </Link>
                <Link to="/clients" className="btn btn-outline btn-primary w-full justify-start gap-2 sm:gap-3 hover:bg-primary/10 min-h-12 sm:min-h-10">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                  {t('dashboard.actions.new_client')}
                </Link>
              </div>
            </div>
          </div>

          {/* Promis Disponibles Alert */}
          {promisDisponibles.length > 0 && (
            <div className="card bg-green-50 shadow-sm border border-green-200">
              <div className="card-body p-4">
                <div 
                  className="flex items-center justify-between mb-4 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate('/app/promis')}
                >
                  <h2 className="card-title text-lg font-bold text-green-700">📦 {t('dashboard.alerts.promis_title')}</h2>
                  <span className="badge badge-success text-white badge-sm">{promisDisponibles.length}</span>
                </div>
                <div className="space-y-2">
                  {promisDisponibles.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-green-100/50 border border-green-200">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-base-content block truncate">{p.produit_nom}</span>
                        <span className="text-xs text-base-content/60">{p.client} • {p.quantite} unité(s)</span>
                      </div>
                      <span className="badge badge-ghost text-xs whitespace-nowrap ml-2">
                        {t('dashboard.alerts.days_left', { count: p.jours_attente })}
                      </span>
                    </div>
                  ))}
                </div>
                <Link to="/app/promis" className="btn btn-success btn-sm w-full mt-2 text-white">
                  {t('dashboard.alerts.deliver_promis')}
                </Link>
              </div>
            </div>
          )}

          {/* Stock Alerts */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate('/app/centre-rapports?report=alertes_stock')}
                >
                  <h2 className="card-title text-lg font-bold text-base-content">{t('dashboard.alerts.stock_title')}</h2>
                  {stats && (stats.low_stock?.value || 0) > 0 && (
                    <span className="badge badge-error text-white badge-sm">{stats.low_stock?.value || 0}</span>
                  )}
                </div>
                <button 
                  className="btn btn-ghost btn-xs btn-circle"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefreshAll();
                  }}
                  disabled={lowStockFetching}
                  title="Rafraîchir les données"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${lowStockFetching ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                {lowStockItems.length === 0 ? (
                  <div className="text-sm text-base-content/60 text-center py-2">{t('dashboard.alerts.no_stock_alerts')}</div>
                ) : (
                  lowStockItems.map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-2 rounded-lg border ${item.stock <= 0 ? 'bg-error/5 border-error/10' : 'bg-warning/5 border-warning/10'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${item.stock <= 0 ? 'bg-error' : 'bg-warning'}`}></div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-base-content">{item.name}</span>
                            {(item as any).status && (item as any).status !== 'Rupture' && (item as any).status !== t('dashboard.alerts.rupture') && (
                                <span className="text-[10px] text-base-content/60 font-medium uppercase tracking-wide">
                                    {(item as any).status}
                                </span>
                            )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                            <span className={`text-xs font-bold ${item.stock <= 0 ? 'text-error' : 'text-warning'}`}>
                                {item.stock <= 0 ? t('dashboard.alerts.rupture') : t('dashboard.alerts.remaining_stock', { count: item.stock })}
                            </span>
                            {(item as any).days_remaining > 0 && item.stock > 0 && (
                                <span className="text-[10px] opacity-70">
                                    {t('dashboard.alerts.coverage', { days: Math.round((item as any).days_remaining) })}
                                </span>
                            )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-3">
                {lowStockItems.length > 0 && (
                  <button 
                    className="btn btn-primary btn-sm flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Navigate to Commandes with products pre-filled
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Générer Commande
                  </button>
                )}
                <Link 
                  to="/produits" 
                  className="btn btn-ghost btn-sm flex-1 text-error hover:bg-error/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('dashboard.alerts.view_all_stock')}
                </Link>
              </div>
            </div>
          </div>

          {/* Credit Alerts - Clients Exceeding Plafond */}


          {/* Expiring Lots */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/app/perimes')}
              >
                <h2 className="card-title text-lg font-bold text-base-content">{t('dashboard.alerts.expiry_title')}</h2>
                {expiringLots.length > 0 && (
                  <span className="badge badge-error text-white badge-sm">{expiringLots.length}</span>
                )}
              </div>
              
              {/* Period Selector */}
              <div className="form-control mb-4">
                <label className="label py-1">
                  <span className="label-text text-xs">{t('dashboard.alerts.expiry_period')}</span>
                </label>
                <select 
                  className="select select-bordered select-sm w-full"
                  value={expirationMonths}
                  onChange={(e) => setExpirationMonths(Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value={1}>1 mois</option>
                  <option value={2}>2 mois</option>
                  <option value={3}>3 mois</option>
                  <option value={6}>6 mois</option>
                  <option value={12}>1 an</option>
                </select>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {expiringLots.length === 0 ? (
                  <div className="text-sm text-base-content/60 text-center py-2">{t('dashboard.alerts.no_expiry_alerts')}</div>
                ) : (
                  expiringLots.map((lot) => {
                    const daysUntilExpiry = lot.date_expiration 
                      ? Math.floor((new Date(lot.date_expiration).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    
                    // Color-coded urgency
                    let urgencyColor = 'bg-yellow-100 border-yellow-200 text-yellow-700'; // Default: Caution (< 90 days)
                    let dotColor = 'bg-yellow-500';
                    let badgeClass = 'badge-warning';
                    
                    if (daysUntilExpiry <= 7) {
                      urgencyColor = 'bg-red-100 border-red-200 text-red-700'; // Critical
                      dotColor = 'bg-red-500';
                      badgeClass = 'badge-error';
                    } else if (daysUntilExpiry <= 30) {
                      urgencyColor = 'bg-orange-100 border-orange-200 text-orange-700'; // Warning
                      dotColor = 'bg-orange-500';
                      badgeClass = 'badge-warning';
                    }
                    
                    return (
                      <div key={lot.id} className={`flex items-center justify-between p-2 rounded-lg border ${urgencyColor}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`}></div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-base-content block truncate">{lot.produit_nom}</span>
                            <div className="flex gap-2 text-xs text-base-content/60">
                              <span>Lot: {lot.lot || 'N/A'}</span>
                              <span>•</span>
                              <span>
                                {lot.date_expiration ? (() => { const d = new Date(lot.date_expiration); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className={`badge ${badgeClass} text-xs font-bold whitespace-nowrap ml-2`}>
                          {daysUntilExpiry <= 0 ? t('dashboard.alerts.expired') : t('dashboard.alerts.days_left', { count: daysUntilExpiry })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
              <Link to="/app/perimes" className="btn btn-ghost btn-sm w-full mt-2 text-error hover:bg-error/10">
                {t('dashboard.alerts.manage_expiry')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

