import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Trophy, ChevronRight, Users, User, Package, Target, CalendarClock, Sparkles } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../shadcn/card';
import { Badge } from '../shadcn/badge';
import { Progress } from '../shadcn/progress';
import { Button } from '../shadcn/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../shadcn/table';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';

import { formatCurrency } from '../../utils/formatters';
import { getLocale } from '../../utils/dateUtils';
import { useChallengesSummary, type ChallengeSummaryItem } from '../../hooks/useDashboard';

/* ─── Type helpers ─── */
const typeConfig: Record<ChallengeSummaryItem['type_objectif'], { color: string; bg: string; icon: React.ElementType }> = {
  CA: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Target },
  BOITES: { color: 'text-blue-600', bg: 'bg-blue-50', icon: Package },
  POINTS: { color: 'text-amber-600', bg: 'bg-amber-50', icon: Sparkles },
};

function formatMetric(item: ChallengeSummaryItem, value: number, currencySymbol: string): string {
  if (item.type_objectif === 'CA') {
    return formatCurrency(value, getLocale(), currencySymbol);
  }
  if (item.type_objectif === 'BOITES') {
    return `${value} boîte(s)`;
  }
  return `${value} pts`;
}

/* ─── Single challenge card ─── */
function ChallengeCard({ item, currencySymbol }: { item: ChallengeSummaryItem; currencySymbol: string }) {
  const { t } = useTranslation(['dashboard', 'common']);
  const navigate = useNavigate();
  const cfg = typeConfig[item.type_objectif] || typeConfig.CA;
  const TypeIcon = cfg.icon;
  const isEnded = item.jours_restants <= 0;
  const hasObjective = item.objectif_valeur !== null && item.objectif_valeur > 0;

  return (
    <div
      className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-slate-300 cursor-pointer"
      onClick={() => navigate('/app/challenges')}
      role="button"
      tabIndex={0}
      aria-label={item.nom}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('/app/challenges');
        }
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`${cfg.bg} rounded-xl p-2.5 shrink-0`}>
            <TypeIcon className={`size-5 ${cfg.color}`} />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate">{item.nom}</h4>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant="outline" className="text-caption font-semibold">
                {item.type_objectif_display}
              </Badge>
              <Badge variant="secondary" className="text-caption font-semibold gap-1">
                {item.mode === 'EQUIPES' ? <Users className="size-2.5" /> : <User className="size-2.5" />}
                {item.mode_display}
              </Badge>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {isEnded ? (
            <Badge variant="outline" className="text-caption text-slate-500">
              {t('dashboard.manager_dashboard.challenges_ended', 'Terminé')}
            </Badge>
          ) : (
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
              <CalendarClock className="size-3.5" />
              {t('dashboard.manager_dashboard.challenges_days_left', '{{count}} jour(s) restant(s)', { count: item.jours_restants })}
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4 space-y-1.5">
        <div className="flex justify-between text-xs font-semibold text-slate-400">
          <span>{t('dashboard.manager_dashboard.challenges_progress', 'Progression globale')}</span>
          <span className={hasObjective ? 'text-slate-600' : 'text-slate-400'}>
            {hasObjective
              ? `${item.progression_globale}%`
              : t('dashboard.manager_dashboard.challenges_no_objective', 'Sans objectif')}
          </span>
        </div>
        {hasObjective && (
          <Progress
            value={item.progression_globale}
            className={`h-2 rounded-full ${item.progression_globale >= 100 ? '[&>div]:bg-emerald-500' : `[&>div]:${cfg.color.replace('text-', 'bg-')}`}`}
          />
        )}
      </div>

      {/* Top 3 */}
      <div className="mt-4">
        <p className="text-caption font-bold uppercase tracking-widest text-slate-400 mb-2">
          {t('dashboard.manager_dashboard.challenges_top3', 'Top 3')}
        </p>
        {item.top3.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-100 hover:bg-transparent">
                <TableHead className="h-7 py-1 px-2 text-caption font-bold uppercase tracking-wider text-slate-400 w-8">
                  {t('dashboard.manager_dashboard.challenges_rank', 'Rang')}
                </TableHead>
                <TableHead className="h-7 py-1 px-2 text-caption font-bold uppercase tracking-wider text-slate-400">
                  {t('dashboard.manager_dashboard.challenges_participant', 'Participant')}
                </TableHead>
                <TableHead className="h-7 py-1 px-2 text-caption font-bold uppercase tracking-wider text-slate-400 text-right">
                  {t('dashboard.manager_dashboard.challenges_value', 'Valeur')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {item.top3.map((entry) => (
                <TableRow key={entry.rang} className="border-slate-50">
                  <TableCell className="py-1.5 px-2">
                    <span className={`inline-flex items-center justify-center size-5 rounded-full text-caption font-bold ${
                      entry.rang === 1 ? 'bg-amber-100 text-amber-700'
                      : entry.rang === 2 ? 'bg-slate-100 text-slate-600'
                      : 'bg-orange-50 text-orange-700'
                    }`}>
                      {entry.rang}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5 px-2 text-xs font-semibold text-slate-700 truncate max-w-0">
                    {entry.entity_name}
                  </TableCell>
                  <TableCell className="py-1.5 px-2 text-xs font-bold text-slate-900 text-right tabular-nums">
                    {formatMetric(item, entry.valeur, currencySymbol)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            compact
            icon={<Trophy className="size-6" />}
            title={<span className="text-xs italic font-normal">{t('dashboard.manager_dashboard.challenges_no_ranking', 'Aucun classement disponible')}</span>}
            className="py-2"
          />
        )}
      </div>
    </div>
  );
}

/* ─── Main widget ─── */
export function ChallengesSummary() {
  const { t } = useTranslation(['dashboard', 'common']);
  const navigate = useNavigate();
  const { data: challenges, isLoading } = useChallengesSummary();
  const currencySymbol = t('common:currency_symbol', 'F');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-50 rounded-xl p-2">
              <Trophy className="size-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">
                {t('dashboard.manager_dashboard.challenges_title', 'Challenges en cours')}
              </CardTitle>
              <CardDescription>
                {t('dashboard.manager_dashboard.challenges_subtitle', 'Suivi des défis commerciaux actifs')}
              </CardDescription>
            </div>
          </div>
          {challenges && challenges.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 rounded-lg text-xs"
              onClick={() => navigate('/app/challenges')}
            >
              {t('dashboard.manager_dashboard.challenges_view_all', 'Voir tous les challenges')}
              <ChevronRight className="size-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
        ) : challenges && challenges.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {challenges.map((item: ChallengeSummaryItem) => (
              <ChallengeCard key={item.id} item={item} currencySymbol={currencySymbol} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Trophy className="size-8" />}
            title={t('dashboard.manager_dashboard.challenges_empty', 'Aucun challenge en cours')}
            description={t('dashboard.manager_dashboard.challenges_empty_desc', 'Créez un challenge pour suivre les performances de vos équipes')}
            className="py-10"
            action={
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-lg"
                onClick={() => navigate('/app/challenges')}
              >
                <Trophy className="size-4" />
                {t('dashboard.manager_dashboard.challenges_view_all', 'Voir tous les challenges')}
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
