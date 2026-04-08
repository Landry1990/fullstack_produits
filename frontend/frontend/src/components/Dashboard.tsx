import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  LayoutDashboard, 
  CalendarDays, 
  RefreshCw,
  TrendingUp,
  Package,
  Wallet,
  AlertTriangle,
  Plus
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

// Sub-components
import PerformanceOverview from './dashboard/PerformanceOverview';
import StockIntelligence from './dashboard/StockIntelligence';
import FinancialSummary from './dashboard/FinancialSummary';
import { Link } from 'react-router-dom';


export default function Dashboard() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { getServerDate } = useAuth();
  const [expirationMonths, setExpirationMonths] = useState(1); 
  const [activeTab, setActiveTab] = useState<'overview' | 'stock' | 'finance'>('overview');


  // Onglet Overview : toujours chargé
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: revenueChart, isLoading: chartLoading, refetch: refetchChart } = useRevenueChart();
  const { data: hourlyTraffic } = useHourlyTraffic();

  // Onglet Stock : lazy-loaded uniquement quand l'onglet est actif
  const isStockTab = activeTab === 'stock';
  const { data: lowStockItems = [], refetch: refetchLowStock } = useLowStock(isStockTab);
  const { data: promisDisponibles = [] } = usePromisDisponibles(isStockTab);
  const { data: expiringLots = [], refetch: refetchExpiring } = useExpiringLots(expirationMonths, isStockTab);

  // Onglet Finance : lazy-loaded uniquement quand l'onglet est actif
  const isFinanceTab = activeTab === 'finance';
  const { data: ugStats } = useUgStats(isFinanceTab);
  const { data: supplierDebts, refetch: refetchSupplierDebts, isRefetching: isRefetchingSupplierDebts } = useSupplierDebts(isFinanceTab);

  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' });
  const currencySymbol = t('common:currency_symbol', { defaultValue: 'F' });
  const formatCurrencyLocal = (val: number) => formatCurrency(val, currentLocale, currencySymbol);

  const loading = statsLoading || chartLoading;
  const error = statsError ? t('messages.error_loading') : null;

  const handleRefreshAll = async () => {
    await Promise.all([
      refetchStats(),
      refetchChart(),
      refetchLowStock(),
      refetchExpiring(),
      refetchSupplierDebts()
    ]);
    toast.success(t('refresh_success'), { icon: '🔄' });
  };

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
        t('alerts.critical_lots_toast', { count: criticalLots.length }),
        { duration: 5000, id: 'critical-expiration-dashboard' }
      );
    }
  }, [expiringLots.length]);

  useEffect(() => {
    if (promisDisponibles.length > 0) {
      toast.success(
        t('alerts.promis_toast', { count: promisDisponibles.length }),
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
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl shadow-sm border border-primary/20">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-base-content tracking-tight">{t('title')}</h1>
            <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-0.5">{t('subtitle')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
            {/* Quick Actions - Always visible */}
            <div className="flex items-center gap-2 bg-base-100 p-1.5 rounded-xl shadow-sm border border-base-300">
                <Link to="/app/facturation" className="btn btn-sm btn-primary text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg">
                    <Plus className="w-3.5 h-3.5" />
                    {t('actions.new_invoice')}
                </Link>
                <Link to="/app/produits" className="btn btn-sm btn-ghost hover:bg-base-200 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg">
                    <Package className="w-3.5 h-3.5" />
                    {t('actions.manage_products')}
                </Link>
            </div>

            <div className="flex items-center gap-3 bg-base-100 px-4 py-2 rounded-xl shadow-sm border border-base-300 h-10">
                <CalendarDays className="w-4 h-4 text-primary" />
                <span className="text-xs font-black uppercase tracking-widest text-base-content/60">
                    {getServerDate().toLocaleDateString(currentLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <div className="divider divider-horizontal mx-0"></div>
                <button 
                    className={`btn btn-xs btn-ghost btn-circle ${statsLoading || chartLoading ? 'loading' : 'hover:bg-primary/10 hover:text-primary'}`}
                    onClick={handleRefreshAll}
                    title={t('refresh_tooltip')}
                >
                    {!(statsLoading || chartLoading) && <RefreshCw className="w-3.5 h-3.5" />}
                </button>
            </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-col space-y-4">
        <div className="tabs tabs-boxed bg-base-100 p-1 rounded-2xl border border-base-300 w-fit">
            <button 
                className={`tab tab-lg px-6 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'tab-active bg-primary text-primary-content shadow-md' : 'text-base-content/50 hover:text-primary'}`}
                onClick={() => setActiveTab('overview')}
            >
                <TrendingUp className={`w-4 h-4 mr-2 ${activeTab === 'overview' ? 'opacity-100' : 'opacity-40'}`} />
                {t('tabs.overview', { defaultValue: 'Performance' })}
            </button>
            <button 
                className={`tab tab-lg px-6 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'stock' ? 'tab-active bg-primary text-primary-content shadow-md' : 'text-base-content/50 hover:text-primary'}`}
                onClick={() => setActiveTab('stock')}
            >
                <Package className={`w-4 h-4 mr-2 ${activeTab === 'stock' ? 'opacity-100' : 'opacity-40'}`} />
                {t('tabs.stock', { defaultValue: 'Stock & Intelligence' })}
            </button>
            <button 
                className={`tab tab-lg px-6 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'finance' ? 'tab-active bg-primary text-primary-content shadow-md' : 'text-base-content/50 hover:text-primary'}`}
                onClick={() => setActiveTab('finance')}
            >
                <Wallet className={`w-4 h-4 mr-2 ${activeTab === 'finance' ? 'opacity-100' : 'opacity-40'}`} />
                {t('tabs.finance', { defaultValue: 'Finance' })}
            </button>
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
            {activeTab === 'overview' && (
                <PerformanceOverview 
                    stats={stats}
                    revenueChart={revenueChart}
                    hourlyTraffic={hourlyTraffic}
                    t={t}
                    formatCurrencyLocal={formatCurrencyLocal}
                />
            )}
            {activeTab === 'stock' && (
                <StockIntelligence 
                    stats={stats}
                    lowStockItems={lowStockItems}
                    expiringLots={expiringLots}
                    promisDisponibles={promisDisponibles}
                    expirationMonths={expirationMonths}
                    setExpirationMonths={setExpirationMonths}
                    getServerDate={getServerDate}
                    t={t}
                    formatCurrencyLocal={formatCurrencyLocal}
                />
            )}
            {activeTab === 'finance' && (
                <FinancialSummary 
                    stats={stats}
                    ugStats={ugStats}
                    supplierDebts={supplierDebts}
                    isRefetchingSupplierDebts={isRefetchingSupplierDebts}
                    refetchSupplierDebts={refetchSupplierDebts}
                    t={t}
                    formatCurrencyLocal={formatCurrencyLocal}
                />
            )}
        </div>
      </div>
    </div>
  );
}
