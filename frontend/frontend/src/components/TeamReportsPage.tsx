import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Users, TrendingUp, Calendar, ChevronDown, ChevronRight } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './shadcn/card';
import { Badge } from './shadcn/badge';
import { Button } from './shadcn/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './shadcn/table';

import { formatCurrency } from '../utils/formatters';
import { getLocale, formatDate } from '../utils/dateUtils';
import { useTeamReport, type TeamReportEquipe } from '../hooks/useDashboard';
import { getLocalDateString } from '../utils/dateUtils';

/* ─── Team detail row (expandable) ─── */
function TeamDetailRow({ equipe, currencySymbol }: { equipe: TeamReportEquipe; currencySymbol: string }) {
  const { t } = useTranslation(['dashboard', 'common']);
  const [expanded, setExpanded] = useState(false);
  const fmt = (n: number) => formatCurrency(n, getLocale(), currencySymbol);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="py-3 px-4">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="size-4 text-slate-400" /> : <ChevronRight className="size-4 text-slate-400" />}
            <span className="font-semibold text-slate-800">{equipe.nom}</span>
          </div>
        </TableCell>
        <TableCell className="py-3 px-4 text-center">
          <Badge variant="secondary" className="gap-1">
            <Users className="size-3" />
            {equipe.membres_count}
          </Badge>
        </TableCell>
        <TableCell className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
          {fmt(equipe.ca_total)}
        </TableCell>
        <TableCell className="py-3 px-4 text-right tabular-nums text-slate-600">
          {equipe.nb_ventes}
        </TableCell>
        <TableCell className="py-3 px-4 text-right tabular-nums text-slate-600">
          {equipe.nb_boites}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-slate-50/50">
          <TableCell colSpan={5} className="py-3 px-4">
            <div className="ml-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                {t('dashboard.manager_dashboard.teams_report_details', 'Détail par vendeur')}
              </p>
              {equipe.membres.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100">
                      <TableHead className="h-7 py-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {t('dashboard.manager_dashboard.teams_report_seller', 'Vendeur')}
                      </TableHead>
                      <TableHead className="h-7 py-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">
                        {t('dashboard.manager_dashboard.teams_report_ca', 'CA')}
                      </TableHead>
                      <TableHead className="h-7 py-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">
                        {t('dashboard.manager_dashboard.teams_report_nb_ventes', 'Nb Ventes')}
                      </TableHead>
                      <TableHead className="h-7 py-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">
                        {t('dashboard.manager_dashboard.teams_report_nb_boites', 'Nb Boîtes')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipe.membres.map((m) => (
                      <TableRow key={m.id} className="border-slate-100">
                        <TableCell className="py-1.5 px-2 text-xs font-semibold text-slate-700">
                          {m.full_name || m.username}
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-xs font-bold text-slate-900 text-right tabular-nums">
                          {fmt(m.ca)}
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-xs text-slate-600 text-right tabular-nums">
                          {m.nb_ventes}
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-xs text-slate-600 text-right tabular-nums">
                          {m.nb_boites}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  {t('dashboard.manager_dashboard.teams_report_empty', 'Aucune donnée sur cette période')}
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ─── Main page ─── */
export default function TeamReportsPage() {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const currencySymbol = t('common:currency_symbol', 'F');
  const fmt = (n: number) => formatCurrency(n, getLocale(), currencySymbol);

  // Default period: current month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const [dateDebut, setDateDebut] = useState(getLocalDateString(firstDay));
  const [dateFin, setDateFin] = useState(getLocalDateString());

  const { data: report, isLoading } = useTeamReport(dateDebut, dateFin);

  const classement = report?.classement || [];
  const equipes = report?.equipes || [];

  return (
    <div className="h-full flex flex-col bg-slate-50 p-4 sm:p-6 font-sans overflow-hidden">
      <div className="max-w-[1400px] mx-auto w-full flex-1 overflow-y-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
                {t('dashboard.manager_dashboard.teams_report_title', 'Rapport d\'Équipes')}
              </h1>
            </div>
            <p className="text-slate-500 text-sm">
              {t('dashboard.manager_dashboard.teams_report_subtitle', 'Performance des équipes commerciales')}
            </p>
          </div>
        </div>

        {/* Period filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <Calendar className="size-4" />
                {t('dashboard.manager_dashboard.teams_report_period', 'Période')}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">
                  {t('dashboard.manager_dashboard.teams_report_from', 'Du')}
                </label>
                <input
                  key={`from-${i18n.language}`}
                  type="date"
                  lang={i18n.language}
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <label className="text-xs text-slate-500">
                  {t('dashboard.manager_dashboard.teams_report_to', 'Au')}
                </label>
                <input
                  key={`to-${i18n.language}`}
                  type="date"
                  lang={i18n.language}
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="size-12 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : equipes.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-slate-400">
                <div className="bg-slate-50 rounded-2xl p-4 mb-3">
                  <Users className="size-8 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-600">
                  {t('dashboard.manager_dashboard.teams_report_no_teams', 'Aucune équipe configurée')}
                </p>
                <p className="text-xs text-slate-400 mt-1 text-center max-w-md">
                  {t('dashboard.manager_dashboard.teams_report_no_teams_desc', 'Créez des équipes dans le planning opérateurs pour voir les rapports')}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Ranking cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {classement.slice(0, 3).map((item, idx) => {
                const cfg = [
                  { icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50', border: 'ring-amber-200' },
                  { icon: Trophy, color: 'text-slate-500', bg: 'bg-slate-50', border: 'ring-slate-200' },
                  { icon: Trophy, color: 'text-orange-600', bg: 'bg-orange-50', border: 'ring-orange-200' },
                ][idx];
                const Icon = cfg.icon;
                return (
                  <Card key={item.equipe_id} className={`relative overflow-hidden ring-1 ${cfg.border}`}>
                    <CardContent className="p-4 lg:p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`${cfg.bg} rounded-xl p-2.5`}>
                            <Icon className={`size-5 ${cfg.color}`} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {t('dashboard.manager_dashboard.teams_report_rank', 'Rang')} {item.rang}
                            </p>
                            <p className="text-sm font-bold text-slate-900">{item.nom}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">{t('dashboard.manager_dashboard.teams_report_ca_total', 'CA Total')}</span>
                          <span className="font-bold text-slate-900 tabular-nums">{fmt(item.ca_total)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">{t('dashboard.manager_dashboard.teams_report_nb_ventes', 'Nb Ventes')}</span>
                          <span className="font-semibold text-slate-700 tabular-nums">{item.nb_ventes}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">{t('dashboard.manager_dashboard.teams_report_nb_boites', 'Nb Boîtes')}</span>
                          <span className="font-semibold text-slate-700 tabular-nums">{item.nb_boites}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Detailed table */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-50 rounded-xl p-2">
                    <TrendingUp className="size-5 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">
                      {t('dashboard.manager_dashboard.teams_report_title', 'Rapport d\'Équipes')}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(dateDebut)} — {formatDate(dateFin)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {t('dashboard.manager_dashboard.teams_report_team', 'Équipe')}
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center">
                        {t('dashboard.manager_dashboard.teams_report_members', 'Membres')}
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-400 text-right">
                        {t('dashboard.manager_dashboard.teams_report_ca_total', 'CA Total')}
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-400 text-right">
                        {t('dashboard.manager_dashboard.teams_report_nb_ventes', 'Nb Ventes')}
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-400 text-right">
                        {t('dashboard.manager_dashboard.teams_report_nb_boites', 'Nb Boîtes')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipes.map((equipe) => (
                      <TeamDetailRow key={equipe.id} equipe={equipe} currencySymbol={currencySymbol} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
