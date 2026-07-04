import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  PlusCircle, Settings, Calendar, BarChart3, TrendingUp,
  Trophy, Zap, AlertCircle, Target, RefreshCw, Download,
  ArrowUpRight, Activity, FileSpreadsheet,
  TrendingDown, PackageX, CreditCard, Archive, Clock, CheckCircle2, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useManagerDashboard } from '../hooks/useManagerDashboard';
import { ObjectivesSettings } from './dashboard/ObjectivesSettings';

import { Button } from './shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './shadcn/card';
import { Badge } from './shadcn/badge';
import { Progress } from './shadcn/progress';
import { Tabs, TabsList, TabsTrigger } from './shadcn/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from './shadcn/dialog';

import { formatCurrency } from '../utils/formatters';
import { formatDate, getLocale } from '../utils/dateUtils';

/* ─── Types ─── */
interface KPIData {
  actual: number;
  margin?: number;
  target: number;
  rate: number;
}

/* ─── KPI Cards ─── */
function KPIsShadcn({ kpis }: { kpis: { jour: KPIData; semaine: KPIData; mois: KPIData } }) {
  const { t } = useTranslation(['dashboard', 'common']);
  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' });
  const currencySymbol = t('common:currency_symbol', 'F');
  const fmt = (n: number) => formatCurrency(n, currentLocale, currencySymbol);

  const items = [
    {
      label: t("manager_dashboard.periods.today", "Aujourd'hui"),
      key: 'jour' as const,
      icon: Calendar,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      badgeVariant: 'default' as const,
      barColor: 'bg-emerald-500',
      gradient: 'from-emerald-500/5 to-transparent',
    },
    {
      label: t('manager_dashboard.periods.week', 'Semaine'),
      key: 'semaine' as const,
      icon: BarChart3,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      badgeVariant: 'secondary' as const,
      barColor: 'bg-blue-500',
      gradient: 'from-blue-500/5 to-transparent',
    },
    {
      label: t('manager_dashboard.periods.month', 'Mois'),
      key: 'mois' as const,
      icon: TrendingUp,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      badgeVariant: 'outline' as const,
      barColor: 'bg-amber-500',
      gradient: 'from-amber-500/5 to-transparent',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
      {items.map((item) => {
        const data = kpis[item.key];
        const isSuccess = data.rate >= 100 && data.target > 0;
        const Icon = item.icon;

        return (
          <Card
            key={item.key}
            className={`
              relative overflow-hidden transition-all duration-300
              ${isSuccess ? 'ring-1 ring-emerald-200 shadow-lg shadow-emerald-500/10' : 'hover:shadow-md'}
            `}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} pointer-events-none`} />

            {isSuccess && (
              <div className="absolute top-4 right-4">
                <Badge variant="default" className="bg-emerald-500 text-white gap-1">
                  <Trophy className="size-3" />
                  {t('manager_dashboard.achieved_badge', 'Atteint')}
                </Badge>
              </div>
            )}

            <CardContent className="p-4 lg:p-6 relative z-10">
              <div className="flex items-start gap-3 lg:gap-4">
                <div className={`${item.iconBg} rounded-xl lg:rounded-2xl p-2.5 lg:p-3.5 shrink-0`}>
                  <Icon className={`size-5 lg:size-6 ${item.iconColor}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-slate-500 uppercase tracking-wide">
                    {item.label}
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-1.5 lg:gap-2">
                    <span className={`text-2xl lg:text-3xl font-bold tracking-tight ${isSuccess ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {fmt(data.actual)}
                    </span>
                    <Badge variant={isSuccess ? 'default' : item.badgeVariant} className="text-[10px] lg:text-xs">
                      {Math.round(data.rate)}%
                    </Badge>
                  </div>

                  {data.margin !== undefined && (
                    <div className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                      <ArrowUpRight className="size-3.5 text-emerald-500" />
                      {t('manager_dashboard.margin_display', 'Marge : {{value}}', { value: fmt(data.margin) })}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>{t('manager_dashboard.progression', 'Progression')}</span>
                  <span className="text-slate-600">{t('manager_dashboard.target', 'Cible')} : {fmt(data.target)}</span>
                </div>
                <Progress value={Math.min(data.rate, 100)} className={`h-2.5 rounded-full ${isSuccess ? '[&>div]:bg-emerald-500' : `[&>div]:${item.barColor}`}`} />
              </div>

              {isSuccess && (
                <div className="mt-4 pt-3 border-t border-dashed border-slate-200 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-amber-600">
                    <span className="flex items-center gap-1"><Zap className="size-3.5" /> {t('manager_dashboard.next_tier', 'Prochain palier')}</span>
                    <span>{fmt(data.target * 1.2)}</span>
                  </div>
                  <Progress value={Math.min((data.actual / (data.target * 1.2)) * 100, 100)} className="h-1.5 rounded-full [&>div]:bg-amber-400" />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ─── Alerts ─── */
function AlertsShadcn({ alerts }: { alerts?: any[] }) {
  const { t } = useTranslation(['dashboard', 'common']);
  const navigate = useNavigate();

  const alertStyles: Record<string, { border: string; iconBg: string; iconColor: string; titleColor: string; badgeClass: string }> = {
    danger: {
      border: 'border-l-4 border-l-red-500',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      titleColor: 'text-red-700',
      badgeClass: 'bg-red-100 text-red-700',
    },
    warning: {
      border: 'border-l-4 border-l-amber-400',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      titleColor: 'text-amber-700',
      badgeClass: 'bg-amber-100 text-amber-700',
    },
    success: {
      border: 'border-l-4 border-l-emerald-500',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      titleColor: 'text-emerald-700',
      badgeClass: 'bg-emerald-100 text-emerald-700',
    },
    info: {
      border: 'border-l-4 border-l-blue-500',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
      titleColor: 'text-blue-700',
      badgeClass: 'bg-blue-100 text-blue-700',
    },
  };

  const iconMap: Record<string, React.ReactNode> = {
    trending_down: <TrendingDown className="size-4" />,
    package_x: <PackageX className="size-4" />,
    credit_card: <CreditCard className="size-4" />,
    archive: <Archive className="size-4" />,
    clock: <Clock className="size-4" />,
    trophy: <Trophy className="size-4" />,
  };

  const sorted = alerts ? [...alerts].sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9)) : [];
  const criticalCount = sorted.filter(a => a.type === 'danger').length;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-amber-50 rounded-xl p-2">
              <Zap className="size-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                {t('manager_dashboard.alerts_title', 'Alertes Intelligentes')}
                {criticalCount > 0 && (
                  <span className="inline-flex items-center justify-center size-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {criticalCount}
                  </span>
                )}
              </CardTitle>
              <CardDescription>{t('manager_dashboard.alerts_subtitle', 'Actions recommandées')}</CardDescription>
            </div>
          </div>
          {sorted.length > 0 && (
            <span className="text-xs text-slate-400 font-medium">
              {t('manager_dashboard.alerts_count', '{{count}} alerte(s)', { count: sorted.length })}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-2.5">
        {sorted.length > 0 ? (
          sorted.map((alert, idx) => {
            const style = alertStyles[alert.type] || alertStyles.info;
            const icon = iconMap[alert.icon] || <AlertCircle className="size-4" />;
            return (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-100 ${style.border} shadow-sm transition-all hover:shadow-md`}
              >
                <div className={`${style.iconBg} rounded-lg p-2 shrink-0 mt-0.5`}>
                  <span className={style.iconColor}>{icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-bold ${style.titleColor}`}>{t(alert.title_key)}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t(alert.message_key, alert.params) as string}</p>
                  {alert.action_key && alert.action_route && (
                    <button
                      onClick={() => navigate(alert.action_route)}
                      className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${style.badgeClass} hover:opacity-80 transition-opacity`}
                    >
                      {t(alert.action_key, 'Voir')}
                      <ChevronRight className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <div className="bg-emerald-50 rounded-2xl p-4 mb-3">
              <CheckCircle2 className="size-8 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">{t('manager_dashboard.all_good', 'Tout va bien !')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('manager_dashboard.no_alerts_sub', 'Aucune alerte pour le moment.')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Objectives ─── */
function ObjectivesShadcn({ currentObj, onEdit, onRefresh }: { currentObj: any; onEdit: any; onRefresh: () => void }) {
  const { t } = useTranslation(['dashboard', 'common']);
  const fmt = (n: number) => formatCurrency(n, getLocale(), t('common:currency_symbol', 'F'));

  const types = [
    { label: t('manager_dashboard.periods.daily', 'Journalier'), code: 'JOUR', color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
    { label: t('manager_dashboard.periods.weekly', 'Hebdomadaire'), code: 'SEMAINE', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
    { label: t('manager_dashboard.periods.monthly', 'Mensuel'), code: 'MOIS', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  ];

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-50 rounded-xl p-2">
              <Target className="size-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">{t('manager_dashboard.active_objectives', 'Objectifs')}</CardTitle>
              <CardDescription>{t('manager_dashboard.objectives_subtitle', 'Cibles commerciales actives')}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onRefresh} className="h-9 w-9 rounded-xl">
            <RefreshCw className="size-4 text-slate-500" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {types.map((p) => {
          const obj = currentObj ? currentObj[p.code.toLowerCase()] : null;
          return (
            <div
              key={p.code}
              className="group flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all cursor-pointer"
              onClick={() => onEdit(p.code, obj)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${p.dot} shrink-0`} />
                <div>
                  <span className={`text-xs font-bold uppercase tracking-wider ${p.color}`}>{p.label}</span>
                  <div className="text-lg font-bold text-slate-900">
                    {obj ? fmt(Number(obj.marge_objectif)) : t('manager_dashboard.not_defined', 'Non défini')}
                  </div>
                  {obj && Number(obj.ca_objectif) > 0 && (
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {t('manager_dashboard.ca_target_display', 'CA cible : {{value}}', { value: fmt(Number(obj.ca_objectif)) })}
                    </div>
                  )}
                  {obj && obj.date_debut && (
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {t('manager_dashboard.since_date', 'Depuis le {{date}}', { date: formatDate(obj.date_debut) })}
                    </div>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                {t('manager_dashboard.modify', 'Modifier')}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ─── Reports ─── */
function ReportsShadcn({ onExport, exporting }: { onExport: (type: 'csv' | 'pdf' | 'dead_stock' | 'rapport_general') => void; exporting: boolean }) {
  const { t } = useTranslation(['dashboard', 'common']);
  const reports: { key: 'csv' | 'pdf' | 'dead_stock'; label: string; desc: string }[] = [
    { key: 'csv', label: t('manager_dashboard.report_daily_title', 'Rapport Journalier'), desc: t('manager_dashboard.report_daily_desc', 'Export CSV du jour') },
    { key: 'pdf', label: t('manager_dashboard.report_weekly_title', 'Rapport Hebdo'), desc: t('manager_dashboard.report_weekly_desc', 'PDF de la semaine') },
    { key: 'dead_stock', label: t('manager_dashboard.dead_stock_short_title', 'Stocks Dormants'), desc: t('manager_dashboard.dead_stock_short_desc', 'Excel stocks inactifs') },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 rounded-xl p-2">
            <Download className="size-5 text-slate-600" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">{t('manager_dashboard.exports_title', 'Exports & Rapports')}</CardTitle>
            <CardDescription>{t('manager_dashboard.exports_subtitle', 'Téléchargez vos rapports et analyses')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bouton Rapport Général mis en avant */}
        <Button
          variant="default"
          onClick={() => onExport('rapport_general')}
          disabled={exporting}
          className="w-full h-auto py-4 px-5 flex items-center gap-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all"
        >
          {exporting
            ? <span className="size-6 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
            : <FileSpreadsheet className="size-6 flex-shrink-0" />
          }
          <div className="text-left flex-1">
            <p className="font-bold text-base leading-tight">{t('manager_dashboard.rapport_general_title', 'Rapport Général du Mois')}</p>
            <p className="text-xs text-emerald-100 font-normal mt-0.5">
              {t('manager_dashboard.rapport_general_desc', 'Excel 10 feuilles — CA, marges, caisses, dettes, dépenses…')}
            </p>
          </div>
          <Download className="size-4 flex-shrink-0 opacity-70" />
        </Button>

        {/* Autres exports */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {reports.map((r) => (
            <Button
              key={r.key}
              variant="outline"
              onClick={() => onExport(r.key)}
              disabled={exporting}
              className="h-auto py-4 px-4 flex-col items-start gap-1 rounded-xl border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all"
            >
              <span className="font-semibold text-slate-900">{r.label}</span>
              <span className="text-xs text-slate-500 font-normal">{r.desc}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Header ─── */
function HeaderShadcn({
  onOpenSettings,
  onOpenObjective,
}: {
  onOpenSettings: () => void;
  onOpenObjective: () => void;
}) {
  const { t } = useTranslation(['dashboard', 'common']);

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            {t('manager_dashboard.title', 'Tableau de Bord')}
          </h1>
          <Badge variant="outline" className="hidden lg:inline-flex text-[10px] uppercase tracking-wider font-semibold bg-white">
            shadcn/ui
          </Badge>
        </div>
        <p className="text-slate-500 text-sm">
          {t('manager_dashboard.subtitle', 'Suivi des performances et objectifs commerciaux')}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onOpenSettings} className="h-10 w-10 rounded-xl">
          <Settings className="size-5 text-slate-500" />
        </Button>
        <Button onClick={onOpenObjective} className="gap-2 rounded-xl px-3 lg:px-4">
          <PlusCircle className="size-5" />
          <span className="hidden sm:inline">{t('manager_dashboard.set_objective', 'Fixer un Objectif')}</span>
        </Button>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function DashboardManagerShadcn() {
  const { t } = useTranslation(['dashboard', 'common']);
  const {
    stats,
    statsLoading,
    currentObj,
    isModalOpen,
    setIsModalOpen,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    exporting,
    editingObjectif,
    setEditingObjectif,
    actions,
  } = useManagerDashboard();

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <div className="size-12 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-400">
          {t('manager_dashboard.loading', 'Chargement du tableau de bord...')}
        </p>
      </div>
    );
  }

  const kpis = stats?.kpis || {
    jour: { actual: 0, target: 0, rate: 0 },
    semaine: { actual: 0, target: 0, rate: 0 },
    mois: { actual: 0, target: 0, rate: 0 },
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <Toaster position="top-right" />

      <div className="max-w-[1400px] mx-auto space-y-6">
        <HeaderShadcn
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenObjective={() => actions.openObjectiveModal()}
        />

        <KPIsShadcn kpis={kpis} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AlertsShadcn alerts={stats?.alerts} />
          <ObjectivesShadcn
            currentObj={currentObj}
            onEdit={actions.openObjectiveModal}
            onRefresh={actions.refetchStats}
          />
        </div>

        <ReportsShadcn onExport={actions.handleExport} exporting={exporting} />
      </div>

      {/* Settings Modal */}
      <ObjectivesSettings
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* Objective Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{t('manager_dashboard.modal_title', 'Fixer un Objectif')}</DialogTitle>
            <DialogDescription className="text-slate-500">
              {t('manager_dashboard.modal_define_subtitle', 'Définissez un nouvel objectif commercial pour la période sélectionnée.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">{t('manager_dashboard.period_label', 'Période')}</label>
              <Tabs value={editingObjectif.periode} onValueChange={(v) => setEditingObjectif({ ...editingObjectif, periode: v })}>
                <TabsList className="grid w-full grid-cols-3 rounded-xl bg-slate-100 p-1">
                  <TabsTrigger value="JOUR" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    {t('manager_dashboard.period_tab_daily', 'Journalier')}
                  </TabsTrigger>
                  <TabsTrigger value="SEMAINE" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    {t('manager_dashboard.period_tab_weekly', 'Hebdo')}
                  </TabsTrigger>
                  <TabsTrigger value="MOIS" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    {t('manager_dashboard.period_tab_monthly', 'Mensuel')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">{t('manager_dashboard.amount_label', 'Montant Objectif (F)')}</label>
              <input
                type="number"
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium shadow-sm transition-all placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                placeholder="500000"
                value={editingObjectif.ca_objectif}
                onChange={(e) => setEditingObjectif({ ...editingObjectif, ca_objectif: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl"
            >
              {t('manager_dashboard.cancel', 'Annuler')}
            </Button>
            <Button
              onClick={() => {
                actions.handleSaveObjectif();
              }}
              className="rounded-xl"
            >
              {t('manager_dashboard.save', 'Enregistrer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
