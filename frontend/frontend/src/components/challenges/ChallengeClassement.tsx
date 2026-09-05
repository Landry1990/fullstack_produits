import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Trophy, Medal, Users, CheckCircle2, XCircle } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../shadcn/table';
import { cn } from '../../lib/utils';
import { useChallengeClassement } from '../../hooks/useChallenges';
import type { ChallengeClassementEntry } from '../../types';

interface Props {
    challengeId: number;
}

const MEDAL_CONFIG: Record<number, { className: string; rowClassName: string; icon: React.ReactNode }> = {
    1: {
        className: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white',
        rowClassName: 'bg-yellow-50/60',
        icon: <Trophy className="size-4" />,
    },
    2: {
        className: 'bg-gradient-to-br from-slate-300 to-slate-500 text-white',
        rowClassName: 'bg-slate-50/60',
        icon: <Medal className="size-4" />,
    },
    3: {
        className: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white',
        rowClassName: 'bg-orange-50/60',
        icon: <Medal className="size-4" />,
    },
};

const ChallengeClassement: React.FC<Props> = ({ challengeId }) => {
    const { t } = useTranslation(['challenges', 'common']);
    const locale = t('common:locale', { defaultValue: 'fr-FR' });
    const { data, isLoading, isError } = useChallengeClassement(challengeId);

    const formatCurrency = (value: number) => {
        const num = Number(value) || 0;
        try {
            return new Intl.NumberFormat(locale, {
                style: 'decimal',
                minimumFractionDigits: 0,
            }).format(num) + ' FCFA';
        } catch {
            return `${num.toLocaleString(locale)} FCFA`;
        }
    };

    const formatNumber = (value: number) => {
        const num = Number(value) || 0;
        try {
            return new Intl.NumberFormat(locale).format(num);
        } catch {
            return String(num);
        }
    };

    const formatMetric = (value: number, typeObjectif: string) => {
        return typeObjectif === 'CA' ? formatCurrency(value) : formatNumber(value);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="size-8 animate-spin text-emerald-600" />
                <span className="text-sm text-slate-500">{t('challenges:loading')}</span>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="py-12 text-center text-slate-400 text-sm">
                {t('challenges:classement.error')}
            </div>
        );
    }

    const { challenge, classement } = data;
    const hasObjectif = challenge.objectif_valeur != null;
    const isTeamMode = challenge.mode === 'EQUIPES';
    const typeObjectif = challenge.type_objectif ?? 'CA';

    return (
        <div className="space-y-4">
            {/* Challenge summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
                        {t('challenges:form.date_debut')}
                    </span>
                    <span className="font-medium text-sm">
                        {challenge.date_debut
                            ? new Date(challenge.date_debut).toLocaleDateString(locale)
                            : '—'}
                    </span>
                </div>
                <div>
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
                        {t('challenges:form.date_fin')}
                    </span>
                    <span className="font-medium text-sm">
                        {challenge.date_fin
                            ? new Date(challenge.date_fin).toLocaleDateString(locale)
                            : '—'}
                    </span>
                </div>
                <div>
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
                        {t('challenges:type_objectif')}
                    </span>
                    <span className="font-medium text-sm">
                        {t(`challenges:type_objectif_${typeObjectif.toLowerCase()}`)}
                    </span>
                </div>
                <div>
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">
                        {t('challenges:mode')}
                    </span>
                    <span className="font-medium text-sm">
                        {t(`challenges:mode_${challenge.mode?.toLowerCase() ?? 'individuel'}`)}
                    </span>
                </div>
            </div>

            {/* Classement table */}
            {classement.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
                    {t('challenges:classement.no_data')}
                </div>
            ) : (
                <div className="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-lg border border-slate-100">
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50 sticky top-0 z-10">
                                <TableHead className="w-[8%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:classement.rang')}
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {isTeamMode
                                        ? t('challenges:classement_entity_equipe')
                                        : t('challenges:classement_entity_vendeur')}
                                </TableHead>
                                <TableHead className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:classement.nb_boites')}
                                </TableHead>
                                <TableHead className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:classement.ca')}
                                </TableHead>
                                <TableHead className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:classement.nb_ventes')}
                                </TableHead>
                                {typeObjectif === 'POINTS' && (
                                    <TableHead className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-amber-600">
                                        {t('challenges:classement_points')}
                                    </TableHead>
                                )}
                                {hasObjectif && (
                                    <>
                                        <TableHead className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            {t('challenges:classement_objectif')}
                                        </TableHead>
                                        <TableHead className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            {t('challenges:classement_progression')}
                                        </TableHead>
                                    </>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {classement.map((entry: ChallengeClassementEntry) => {
                                const medal = MEDAL_CONFIG[entry.rang];
                                return (
                                    <TableRow
                                        key={`${entry.entity_type}-${entry.entity_id}`}
                                        className={cn(
                                            'hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-0',
                                            medal?.rowClassName
                                        )}
                                    >
                                        <TableCell className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {medal ? (
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center justify-center size-7 rounded-full font-bold text-xs',
                                                            medal.className
                                                        )}
                                                    >
                                                        {medal.icon ?? entry.rang}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center justify-center size-7 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
                                                        {entry.rang}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-sm font-semibold text-slate-700">
                                            <div className="flex items-center gap-2">
                                                {isTeamMode && (
                                                    <Users className="size-3.5 text-slate-400 shrink-0" />
                                                )}
                                                <span className="truncate">{entry.entity_name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                                            {formatNumber(entry.nb_boites)}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-sm font-bold text-slate-800">
                                            {formatCurrency(entry.ca)}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-sm text-slate-600">
                                            {formatNumber(entry.nb_ventes)}
                                        </TableCell>
                                        {typeObjectif === 'POINTS' && (
                                            <TableCell className="px-4 py-3 text-right text-sm font-bold text-amber-700">
                                                {formatNumber(entry.points ?? 0)}
                                            </TableCell>
                                        )}
                                        {hasObjectif && (
                                            <>
                                                <TableCell className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                                                    {entry.objectif != null
                                                        ? formatMetric(entry.objectif, typeObjectif)
                                                        : '—'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="w-full max-w-[120px] h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    'h-full rounded-full transition-all',
                                                                    entry.atteint
                                                                        ? 'bg-emerald-500'
                                                                        : 'bg-amber-500'
                                                                )}
                                                                style={{
                                                                    width: `${Math.min(100, entry.progression ?? 0)}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] font-bold text-slate-600">
                                                                {(entry.progression ?? 0).toFixed(0)}%
                                                            </span>
                                                            {entry.atteint ? (
                                                                <CheckCircle2 className="size-3.5 text-emerald-600" />
                                                            ) : (
                                                                <XCircle className="size-3.5 text-slate-300" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default ChallengeClassement;
