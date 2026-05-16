import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { getApiErrorDetail } from '../utils/errorHandling';
import { 
  LayoutDashboard, 
  RefreshCw,
  TrendingUp,
  Package,
  Wallet,
  AlertTriangle,
  Plus,
  MessageCircle
} from 'lucide-react';
import { 
  useDashboardStats, 
  useRevenueChart, 
  useHourlyTraffic, 
  useExpiringLots,
  useReapproStats,
  useLowStock,
  usePromisDisponibles,
  useUgStats,
  useEcheances
} from '../hooks/useDashboard';

import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useLicence } from '../context/LicenceContext';

// Sub-components
import PerformanceOverview from './dashboard/PerformanceOverview';
import StockIntelligence from './dashboard/StockIntelligence';
import FinancialSummary from './dashboard/FinancialSummary';
import ExpirationAlertsWidget from './dashboard/ExpirationAlertsWidget';
import { Link } from 'react-router-dom';
import { usePharmacySettings } from '../hooks/usePharmacySettings';
import api from '../services/api';


export default function Dashboard() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { getServerDate } = useAuth();
  const { licence, daysRemaining } = useLicence();
  const { settings: pharmSettings } = usePharmacySettings();
  const [expirationMonths, setExpirationMonths] = useState(1); 
  const [activeTab, setActiveTab] = useState<'overview' | 'stock' | 'finance'>('overview');
  const [sendingReport, setSendingReport] = useState(false);
  const [sendingInventaire, setSendingInventaire] = useState(false);


  // Onglet Overview : toujours chargé
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: revenueChart, isLoading: chartLoading, refetch: refetchChart } = useRevenueChart();
  const { data: hourlyTraffic } = useHourlyTraffic();

  // Onglet Stock : lazy-loaded uniquement quand l'onglet est actif
  const isStockTab = activeTab === 'stock';
  const { data: lowStockItems = [], refetch: refetchLowStock } = useLowStock(isStockTab);
  const { data: promisDisponibles = [] } = usePromisDisponibles(isStockTab);
  const { data: expiringLots = [], refetch: refetchExpiring } = useExpiringLots(expirationMonths, isStockTab);
  const { data: reapproStats } = useReapproStats(true); // Toujours chargé pour l'alerte

  // Onglet Finance : lazy-loaded uniquement quand l'onglet est actif
  const isFinanceTab = activeTab === 'finance';
  const { data: ugStats } = useUgStats(isFinanceTab);
  const { data: echeances = [] } = useEcheances(isFinanceTab);

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
    ]);
    toast.success(t('refresh_success'), { icon: '🔄' });
  };
  
  const handleSendTelegramInventaire = async () => {
    if (!pharmSettings?.telegram_enabled) {
        toast.error(t('common:telegram.not_enabled'));
        return;
    }
    setSendingInventaire(true);
    try {
        await api.post('telegram/rapport-inventaire/');
        toast.success(t('common:telegram.send_success'), { icon: '📦' });
    } catch (err) {
        toast.error(getApiErrorDetail(err, t('common:telegram.send_error')));
    } finally {
        setSendingInventaire(false);
    }
  };

  const handleSendTelegramReport = async () => {
    if (!pharmSettings?.telegram_enabled) {
        toast.error(t('common:telegram.not_enabled'));
        return;
    }
    if (!pharmSettings?.telegram_chat_id) {
        toast.error(t('common:telegram.chat_id_missing'));
        return;
    }

    setSendingReport(true);
    try {
        await api.post('telegram/rapport-flash/', { stats });
        toast.success(t('common:telegram.send_success'), { icon: '📊' });
    } catch (err) {
        toast.error(getApiErrorDetail(err, t('common:telegram.send_error')));
    } finally {
        setSendingReport(false);
    }
  };

  useEffect(() => {
    const retards = echeances.filter(e => e.status === 'EN RETARD');
    if (retards.length > 0) {
      toast.error(
        `${retards.length} échéance${retards.length > 1 ? 's' : ''} fournisseur${retards.length > 1 ? 's' : ''} en retard !`,
        { duration: 6000, id: 'echeances-retard-dashboard', icon: '💳' }
      );
    }
  }, [echeances.length]);

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
        <div className="size-10 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <AlertTriangle className="size-6" />
          <span className="font-bold text-sm tracking-tight">{error}</span>
        </div>
      </div>
    );
  }

  const tabConfig = [
    { key: 'overview', label: t('tabs.overview', { defaultValue: 'Performance' }), icon: TrendingUp, color: 'text-emerald-600', activeBg: 'bg-emerald-500' },
    { key: 'stock',    label: t('tabs.stock',    { defaultValue: 'Stock' }),        icon: Package,    color: 'text-amber-600',   activeBg: 'bg-amber-500'   },
    { key: 'finance',  label: t('tabs.finance',  { defaultValue: 'Finance' }),      icon: Wallet,     color: 'text-indigo-600',  activeBg: 'bg-indigo-500'  },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3">

          {/* Left: title + date */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
              <LayoutDashboard className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 tracking-tight leading-none truncate">
                {licence?.pharmacie_nom || t('title')}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest hidden sm:block">
                  {licence?.pharmacien_nom || getServerDate().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {daysRemaining !== null && (
                  <div className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${
                    daysRemaining <= 7 ? 'bg-red-500/10 text-red-500' : 
                    daysRemaining <= 30 ? 'bg-amber-500/10 text-amber-500' : 
                    'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    {daysRemaining} JOURS RESTANTS
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/app/facturation" className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm">
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">{t('actions.new_invoice')}</span>
              <span className="sm:hidden">Vente</span>
            </Link>
            <button
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
              onClick={handleRefreshAll}
              disabled={loading}
              title={t('common:actions.refresh')}
            >
              {loading ? <span className="inline-block size-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /> : <RefreshCw className="size-4" />}
            </button>
            <button
              className={`p-2 rounded-lg transition-colors ${sendingReport ? 'text-gray-300' : 'text-sky-500 hover:bg-sky-50'}`}
              onClick={handleSendTelegramReport}
              disabled={sendingReport}
              title={t('common:telegram.flash_report')}
            >
              {sendingReport ? <span className="inline-block size-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" /> : <MessageCircle className="size-4" />}
            </button>
            <button
              className={`p-2 rounded-lg transition-colors ${sendingInventaire ? 'text-gray-300' : 'text-sky-500 hover:bg-sky-50'}`}
              onClick={handleSendTelegramInventaire}
              disabled={sendingInventaire}
              title={t('common:telegram.inventory_report')}
            >
              {sendingInventaire ? <span className="inline-block size-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" /> : <Package className="size-4" />}
            </button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 mt-3 -mb-px">
          {tabConfig.map(({ key, label, icon: Icon, activeBg }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${
                activeTab === key
                  ? `${activeBg} text-white border-transparent shadow-sm`
                  : 'bg-gray-50 text-gray-400 border-transparent hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="size-3.5" />
              <span className="hidden xs:inline sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ────────────────────────────────────── */}
      <div className="p-4 sm:p-6">
        {activeTab === 'overview' && (
          <PerformanceOverview
            stats={stats}
            revenueChart={revenueChart}
            hourlyTraffic={hourlyTraffic}
            reapproStats={reapproStats}
            t={t}
            formatCurrencyLocal={formatCurrencyLocal}
          />
        )}
        {activeTab === 'stock' && (
          <div className="space-y-6">
            {/* Widget Alertes Péremption en haut de l'onglet Stock */}
            <ExpirationAlertsWidget />

            <StockIntelligence
              stats={stats}
              lowStockItems={lowStockItems}
              expiringLots={expiringLots}
              promisDisponibles={promisDisponibles}
              expirationMonths={expirationMonths}
              setExpirationMonths={setExpirationMonths}
              getServerDate={getServerDate}
              reapproStats={reapproStats}
              t={t}
              formatCurrencyLocal={formatCurrencyLocal}
            />
          </div>
        )}
        {activeTab === 'finance' && (
          <FinancialSummary
            stats={stats}
            ugStats={ugStats}
            echeances={echeances}
            t={t}
            formatCurrencyLocal={formatCurrencyLocal}
          />
        )}
      </div>
    </div>
  );
}
