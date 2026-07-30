import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { getApiErrorDetail } from '../utils/errorHandling';
import {
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  Package,
  Wallet,
  Plus,
  MessageCircle,
  Calendar
} from 'lucide-react';
import {
  useDashboardStats,
  useDashboardHeavyStats,
  useRevenueChart,
  useHourlyTraffic,
  useExpiringLots,
  useReapproStats,
  useLowStock,
  usePromisDisponibles,
  useUgStats,
  useEcheances,
  useSupplierDebts,
  useFrequentStockouts
} from '../hooks/useDashboard';

import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useLicence } from '../context/LicenceContext';

import { Link } from 'react-router-dom';
import { usePharmacySettings } from '../hooks/usePharmacySettings';
import api from '../services/api';

import { Button } from './shadcn/button';
import { Card, CardContent } from './shadcn/card';
import { Badge } from './shadcn/badge';
import { Tabs, TabsList, TabsTrigger } from './shadcn/tabs';
import { cn } from '../lib/utils';

// Sub-components (réutilisés)
import PerformanceOverview from './dashboard/PerformanceOverview';
import StockIntelligence from './dashboard/StockIntelligence';
import FinancialSummary from './dashboard/FinancialSummary';
import ExpirationAlertsWidget from './dashboard/ExpirationAlertsWidget';
import DashboardVendeur from './dashboard/DashboardVendeur';

export default function DashboardShadcn() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { getServerDate } = useAuth();
  const { licence, daysRemaining } = useLicence();
  const { settings: pharmSettings } = usePharmacySettings();
  const [expirationMonths, setExpirationMonths] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'stock' | 'finance'>('overview');
  const [sendingReport, setSendingReport] = useState(false);
  const [sendingInventaire, setSendingInventaire] = useState(false);

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: heavyStats } = useDashboardHeavyStats();
  const { data: revenueChart, isLoading: chartLoading, refetch: refetchChart } = useRevenueChart();
  const { data: hourlyTraffic } = useHourlyTraffic();

  const isStockTab = activeTab === 'stock';
  const { data: lowStockItems = [], refetch: refetchLowStock } = useLowStock(isStockTab);
  const { data: promisDisponibles = [] } = usePromisDisponibles(isStockTab);
  const { data: expiringLots = [], refetch: refetchExpiring } = useExpiringLots(expirationMonths, isStockTab);
  const { data: reapproStats } = useReapproStats(true);

  const { data: supplierDebts } = useSupplierDebts(true);

  const isFinanceTab = activeTab === 'finance';
  const { data: ugStats } = useUgStats(isFinanceTab);
  const { data: echeances = [] } = useEcheances(isFinanceTab);

  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' });
  const currencySymbol = t('common:currency_symbol', { defaultValue: 'F' });
  const formatCurrencyLocal = (val: number) => formatCurrency(val, currentLocale, currencySymbol);

  const isVendeur = stats?.role === 'VENDEUR' || stats?.role === 'CAISSIER';
  const { data: frequentStockouts } = useFrequentStockouts(!isVendeur);

  const mergedStats = stats ? {
    ...stats,
    // margin_today: prioriser stats (rafraîchi toutes les 15s) sur heavyStats (5 min)
    margin_today: stats.margin_today ?? heavyStats?.margin_today,
    dormant_stock: heavyStats?.dormant_stock ?? stats.dormant_stock,
  } : stats;

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

  useEffect(() => {
    const retards = echeances.filter(e => e.status === 'EN RETARD');
    if (retards.length > 0) {
      toast.error(
        retards.length > 1
          ? t('echeances_overdue_toast_plural', '{{count}} échéances fournisseurs en retard !', { count: retards.length })
          : t('echeances_overdue_toast', '{{count}} échéance fournisseur en retard !', { count: retards.length }),
        { duration: 6000, id: 'echeances-retard-dashboard', icon: '💳' }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echeances.length]);

  useEffect(() => {
    if (promisDisponibles.length > 0) {
      toast.success(
        t('alerts.promis_toast', { count: promisDisponibles.length }),
        { duration: 5000, id: 'promis-dispo-dashboard' }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promisDisponibles.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-400">{t('loading', 'Chargement...')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 flex items-center gap-3 text-red-700">
            <span className="font-semibold">{error}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabConfig = [
    { key: 'overview', label: t('tabs.overview', { defaultValue: 'Performance' }), icon: TrendingUp, color: 'text-emerald-600' },
    { key: 'stock', label: t('tabs.stock', { defaultValue: 'Stock' }), icon: Package, color: 'text-amber-600' },
    { key: 'finance', label: t('tabs.finance', { defaultValue: 'Finance' }), icon: Wallet, color: 'text-blue-600' },
  ] as const;

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans overflow-hidden">
      {/* ── HEADER ── */}
      <div className="shrink-0 z-30 bg-white/70 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: title + info */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="bg-emerald-100 text-emerald-600 rounded-xl p-2.5 shrink-0">
              <LayoutDashboard className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">
                  {licence?.pharmacie_nom || t('title')}
                </h1>
                {daysRemaining !== null && daysRemaining <= 30 && (
                  <Badge variant={daysRemaining <= 7 ? 'destructive' : daysRemaining <= 30 ? 'default' : 'secondary'}
                    className="text-[10px] shrink-0">
                    {t('licence_days_remaining', { count: daysRemaining })}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-sm text-slate-500">
                <Calendar className="size-3.5" />
                <span className="hidden sm:inline">
                  {licence?.pharmacien_nom || getServerDate().toLocaleDateString(currentLocale, { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/app/facturation">
              <Button className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700">
                <Plus className="size-4" />
                <span className="hidden sm:inline">{t('actions.new_invoice')}</span>
                <span className="sm:hidden">{t('new_sale_short', 'Vente')}</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefreshAll}
              disabled={loading}
              className="rounded-xl"
            >
              {loading ? (
                <div className="size-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
              ) : (
                <RefreshCw className="size-4 text-slate-500" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSendTelegramReport}
              disabled={sendingReport}
              className="rounded-xl"
            >
              {sendingReport ? (
                <div className="size-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
              ) : (
                <MessageCircle className="size-4 text-blue-500" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSendTelegramInventaire}
              disabled={sendingInventaire}
              className="rounded-xl"
            >
              {sendingInventaire ? (
                <div className="size-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
              ) : (
                <Package className="size-4 text-amber-500" />
              )}
            </Button>
          </div>
        </div>

        {/* ── TABS — masqués pour les vendeurs ── */}
        {!isVendeur && (
          <div className="mt-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList className="grid w-full max-w-md grid-cols-3 rounded-xl bg-slate-100 p-1">
                {tabConfig.map(({ key, label, icon: Icon }) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className={cn(
                      "flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900",
                      "text-sm font-medium text-slate-500 transition-all"
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
        {isVendeur && (
          <DashboardVendeur formatCurrencyLocal={formatCurrencyLocal} />
        )}
        {!isVendeur && activeTab === 'overview' && (
          <PerformanceOverview
            stats={mergedStats}
            revenueChart={revenueChart}
            hourlyTraffic={hourlyTraffic}
            reapproStats={reapproStats}
            supplierDebts={supplierDebts}
            frequentStockouts={frequentStockouts}
            t={t}
            formatCurrencyLocal={formatCurrencyLocal}
          />
        )}
        {!isVendeur && activeTab === 'stock' && (
          <div className="space-y-6">
            <ExpirationAlertsWidget />
            <StockIntelligence
              stats={mergedStats}
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
        {!isVendeur && activeTab === 'finance' && (
          <FinancialSummary
            stats={mergedStats}
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
