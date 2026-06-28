import { useTranslation } from 'react-i18next';
import {
  PlusCircle, Settings, Calendar, BarChart3, TrendingUp,
  Trophy, Zap, AlertCircle, Target, RefreshCw, Download,
  ArrowUpRight, Activity
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useManagerDashboard } from '../hooks/useManagerDashboard';

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
                  Atteint
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
                      Marge : {fmt(data.margin)}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Progression</span>
                  <span className="text-slate-600">Cible : {fmt(data.target)}</span>
                </div>
                <Progress value={Math.min(data.rate, 100)} className={`h-2.5 rounded-full ${isSuccess ? '[&>div]:bg-emerald-500' : `[&>div]:${item.barColor}`}`} />
              </div>

              {isSuccess && (
                <div className="mt-4 pt-3 border-t border-dashed border-slate-200 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-amber-600">
                    <span className="flex items-center gap-1"><Zap className="size-3.5" /> Prochain palier</span>
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

  const alertStyles: Record<string, { border: string; iconBg: string; iconColor: string; titleColor: string }> = {
    danger: {
      border: 'border-l-4 border-l-red-500',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      titleColor: 'text-red-700',
    },
    warning: {
      border: 'border-l-4 border-l-amber-500',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      titleColor: 'text-amber-700',
    },
    info: {
      border: 'border-l-4 border-l-blue-500',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
      titleColor: 'text-blue-700',
    },
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-amber-50 rounded-xl p-2">
            <Zap className="size-5 text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">{t('manager_dashboard.alerts_title', 'Alertes')}</CardTitle>
            <CardDescription>Actions recommandées</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {alerts && alerts.length > 0 ? (
          alerts.map((alert, idx) => {
            const style = alertStyles[alert.type] || alertStyles.info;
            return (
              <div
                key={idx}
                className={`flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-100 ${style.border} shadow-sm`}
              >
                <div className={`${style.iconBg} rounded-lg p-2 shrink-0`}>
                  <AlertCircle className={`size-4 ${style.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <h4 className={`text-sm font-bold ${style.titleColor}`}>{t(alert.title_key)}</h4>
                  <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{t(alert.message_key, alert.params) as string}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <div className="bg-slate-50 rounded-2xl p-4 mb-3">
              <Activity className="size-8 text-slate-300" />
            </div>
            <p className="text-sm font-medium">{t('manager_dashboard.no_alerts', 'Aucune alerte pour le moment.')}</p>
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
    { label: 'Journalier', code: 'JOUR', color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
    { label: 'Hebdomadaire', code: 'SEMAINE', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
    { label: 'Mensuel', code: 'MOIS', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500' },
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
              <CardDescription>Cibles commerciales actives</CardDescription>
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
                    {obj ? fmt(Number(obj.ca_objectif)) : t('manager_dashboard.not_defined', 'Non défini')}
                  </div>
                  {obj && obj.date_debut && (
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Depuis le {formatDate(obj.date_debut)}
                    </div>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                Modifier
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ─── Reports ─── */
function ReportsShadcn({ onExport, exporting }: { onExport: (type: 'csv' | 'pdf' | 'dead_stock') => void; exporting: boolean }) {
  const { t } = useTranslation(['dashboard', 'common']);
  const reports: { key: 'csv' | 'pdf' | 'dead_stock'; label: string; desc: string }[] = [
    { key: 'csv', label: 'Rapport Journalier', desc: 'Export CSV du jour' },
    { key: 'pdf', label: 'Rapport Hebdo', desc: 'PDF de la semaine' },
    { key: 'dead_stock', label: 'Rapport Mensuel', desc: 'Analyse complète' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 rounded-xl p-2">
            <Download className="size-5 text-slate-600" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Exports</CardTitle>
            <CardDescription>Téléchargez vos rapports</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
            Tableau de Bord
          </h1>
          <Badge variant="outline" className="hidden lg:inline-flex text-[10px] uppercase tracking-wider font-semibold bg-white">
            shadcn/ui
          </Badge>
        </div>
        <p className="text-slate-500 text-sm">
          Suivi des performances et objectifs commerciaux
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onOpenSettings} className="h-10 w-10 rounded-xl">
          <Settings className="size-5 text-slate-500" />
        </Button>
        <Button onClick={onOpenObjective} className="gap-2 rounded-xl px-3 lg:px-4">
          <PlusCircle className="size-5" />
          <span className="hidden sm:inline">Fixer un Objectif</span>
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
          Chargement du tableau de bord...
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
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Paramètres</DialogTitle>
            <DialogDescription className="text-slate-500">
              Configuration des objectifs et préférences.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600">Les paramètres avancés sont disponibles dans l&apos;administration.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsSettingsModalOpen(false)} className="rounded-xl">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Objective Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Fixer un Objectif</DialogTitle>
            <DialogDescription className="text-slate-500">
              Définissez un nouvel objectif commercial pour la période sélectionnée.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Période</label>
              <Tabs value={editingObjectif.periode} onValueChange={(v) => setEditingObjectif({ ...editingObjectif, periode: v })}>
                <TabsList className="grid w-full grid-cols-3 rounded-xl bg-slate-100 p-1">
                  <TabsTrigger value="JOUR" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Journalier
                  </TabsTrigger>
                  <TabsTrigger value="SEMAINE" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Hebdo
                  </TabsTrigger>
                  <TabsTrigger value="MOIS" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Mensuel
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Montant Objectif (F)</label>
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
              Annuler
            </Button>
            <Button
              onClick={() => {
                actions.handleSaveObjectif();
              }}
              className="rounded-xl"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
