import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
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

// Sub-components
import PerformanceOverview from './dashboard/PerformanceOverview';
import StockIntelligence from './dashboard/StockIntelligence';
import FinancialSummary from './dashboard/FinancialSummary';
import ExpirationAlertsWidget from './dashboard/ExpirationAlertsWidget';
import { ExpirationAlertToasts } from './ExpirationAlertToast';
import { Link } from 'react-router-dom';
import { usePharmacySettings } from '../hooks/usePharmacySettings';
import api from '../services/api';


export default function Dashboard() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { getServerDate } = useAuth();
  const { settings: pharmSettings } = usePharmacySettings();
  const [expirationMonths, setExpirationMonths] = useState(1); 
  const [activeTab, setActiveTab] = useState<'overview' | 'stock' | 'finance'>('overview');
  const [sendingReport, setSendingReport] = useState(false);


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
  
  const handleSendWhatsAppReport = async () => {
    if (!pharmSettings?.pharmacist_whatsapp_number) {
        toast.error("Le numéro WhatsApp de la pharmacienne n'est pas configuré dans les paramètres.");
        return;
    }

    setSendingReport(true);
    try {
        const numero = pharmSettings.pharmacist_whatsapp_number.replace('+', '');
        await api.post('whatsapp/test/', { numero });
        toast.success('Rapport envoyé sur WhatsApp !', { icon: '📱' });
    } catch (err: any) {
        const msg = err?.response?.data?.message || 'Erreur envoi WhatsApp';
        toast.error(msg);
    } finally {
        setSendingReport(false);
    }
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

  const tabConfig = [
    { key: 'overview', label: t('tabs.overview', { defaultValue: 'Performance' }), icon: TrendingUp, color: 'text-emerald-600', activeBg: 'bg-emerald-500' },
    { key: 'stock',    label: t('tabs.stock',    { defaultValue: 'Stock' }),        icon: Package,    color: 'text-amber-600',   activeBg: 'bg-amber-500'   },
    { key: 'finance',  label: t('tabs.finance',  { defaultValue: 'Finance' }),      icon: Wallet,     color: 'text-indigo-600',  activeBg: 'bg-indigo-500'  },
  ] as const;

  return (
    <div className="min-h-screen bg-base-200/60 font-sans">
      {/* ── ALERTES PÉREMPTION TOAST (au chargement) ─────── */}
      <ExpirationAlertToasts />

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-base-100/95 backdrop-blur-md border-b border-base-200 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3">

          {/* Left: title + date */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-base-content tracking-tight leading-none truncate">{t('title')}</h1>
              <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-0.5 hidden sm:block">
                {getServerDate().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/app/facturation" className="btn btn-sm btn-primary gap-1.5 rounded-xl text-xs font-black">
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('actions.new_invoice')}</span>
              <span className="sm:hidden">Vente</span>
            </Link>
            <button
              className="btn btn-sm btn-ghost btn-circle text-base-content/50 hover:text-primary"
              onClick={handleRefreshAll}
              disabled={loading}
              title={t('common:actions.refresh')}
            >
              {loading ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw className="w-4 h-4" />}
            </button>
            <button
              className={`btn btn-sm btn-ghost btn-circle ${sendingReport ? 'loading' : 'text-[#25D366] hover:bg-[#25D366]/10'}`}
              onClick={handleSendWhatsAppReport}
              disabled={sendingReport}
              title="Rapport Flash WhatsApp"
            >
              {!sendingReport && <MessageCircle className="w-4 h-4" />}
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
                  : 'bg-base-200/50 text-base-content/40 border-transparent hover:text-base-content hover:bg-base-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ────────────────────────────────────── */}
      <div className="p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
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
