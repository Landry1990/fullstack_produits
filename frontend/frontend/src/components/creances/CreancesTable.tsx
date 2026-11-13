import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { Eye, DollarSign, ArrowUpRight, ChevronRight, Hash, Calendar, Users, Clock, MessageCircle } from 'lucide-react';
import type { Creance } from '../../types';
import type { GroupedClient } from '../../hooks/useCreancesData';
import { EmptyState } from '../ui/EmptyState';
import SkeletonTable from '../ui/SkeletonTable';

interface SortIconProps {
    column: string;
    sortConfig: { key: string, direction: 'asc' | 'desc' };
}

const SortIcon: React.FC<SortIconProps> = ({ column, sortConfig }) => {
    if (sortConfig.key !== column) return null;
    return <ArrowUpRight className={`size-3 transition-transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} />;
};

const ageInDays = (dateStr?: string | null): number | null => {
    if (!dateStr) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
};

const ageBadgeClass = (days: number | null) =>
    days === null ? 'bg-slate-50 text-slate-300 border-slate-200'
    : days >= 60 ? 'bg-red-50 text-red-600 border-red-200'
    : days >= 30 ? 'bg-amber-50 text-amber-600 border-amber-200'
    : 'bg-slate-100 text-slate-500 border-slate-200';

interface CreancesTableProps {
    mode: 'clients' | 'invoices';
    groupedClients: GroupedClient[];
    filteredCreances: Creance[];
    loading: boolean;
    showHistory: boolean;
    selectedIds: number[];
    onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSelectOne: (id: number) => void;
    onViewClient: (id: string) => void;
    onRelance: (clientId: number) => void;
    onViewDetails: (creance: Creance) => void;
    onPay: (creance: Creance) => void;
    sortConfig: { key: string, direction: 'asc' | 'desc' };
    onSort: (key: unknown) => void;
    /** Délai de règlement (jours) du client sélectionné — 0 = pas d'échéance */
    clientDelai?: number;
}

export const CreancesTable: React.FC<CreancesTableProps> = ({
    mode,
    groupedClients,
    filteredCreances,
    loading,
    showHistory,
    selectedIds,
    onSelectAll,
    onSelectOne,
    onViewClient,
    onRelance,
    onViewDetails,
    onPay,
    sortConfig,
    onSort,
    clientDelai = 0
}) => {
    const { t } = useTranslation(['creances', 'common']);

    if (loading) {
        return (
            <div className="p-4">
                <SkeletonTable rows={6} columns={6} />
            </div>
        );
    }

    if (mode === 'clients') {
        if (groupedClients.length === 0) {
            return (
                <EmptyState
                    className="py-20 bg-white rounded-xl border border-dashed border-slate-200"
                    icon={<Users className="size-8" />}
                    title={t('creances:client_list.empty')}
                />
            );
        }

        return (
            <div className="overflow-auto h-full w-full relative">
                <table className="w-full min-w-[900px] text-sm">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="text-caption font-bold uppercase tracking-widest text-slate-400 py-2 px-3">{t('creances:client_list.client')}</th>
                            <th className="text-caption font-bold uppercase tracking-widest text-slate-400 text-right py-2 px-3">{t('creances:client_list.nb_invoices')}</th>
                            <th className="text-caption font-bold uppercase tracking-widest text-slate-400 text-center py-2 px-3">{t('creances:client_list.oldest_debt')}</th>
                            <th className="text-caption font-bold uppercase tracking-widest text-slate-400 text-center py-2 px-3">{t('creances:client_list.last_payment')}</th>
                            <th className="text-caption font-bold uppercase tracking-widest text-slate-400 text-right py-2 px-3">{t('creances:client_list.total_amount')}</th>
                            <th className="text-caption font-bold uppercase tracking-widest text-slate-400 text-right py-2 px-3">{t('creances:client_list.already_paid')}</th>
                            <th className="text-caption font-bold uppercase tracking-widest text-slate-400 text-right py-2 px-3">{t('creances:client_list.remaining_due')}</th>
                            <th className="text-caption font-bold uppercase tracking-widest text-slate-400 text-center py-2 px-3">{t('creances:client_list.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {groupedClients.map((groupe) => (
                            <tr
                                key={groupe.client.id}
                                className="hover:bg-slate-50/50 transition-all cursor-pointer group"
                                onClick={() => onViewClient(groupe.client.id.toString())}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                                        e.preventDefault();
                                        onViewClient(groupe.client.id.toString());
                                    }
                                }}
                            >
                                <td className="py-2 px-3">
                                    <div className="flex items-center gap-2">
                                        <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-xs uppercase shadow-sm border border-emerald-200 group-hover:scale-110 transition-transform">
                                            {groupe.client.name.substring(0, 2)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-slate-800 group-hover:text-emerald-600 transition-colors">{groupe.client.name}</span>
                                            {(() => {
                                                const oldestAge = ageInDays(groupe.plusAncienne);
                                                const isOverdue = groupe.delaiPaiementJours > 0 && oldestAge !== null && oldestAge > groupe.delaiPaiementJours;
                                                const overLimit = groupe.plafond !== null && groupe.plafond >= 0 && groupe.reste > groupe.plafond;
                                                if (!isOverdue && !overLimit) {
                                                    return <span className="text-caption font-bold text-slate-400 uppercase tracking-widest">{t('creances:client_type_label')}</span>;
                                                }
                                                return (
                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                        {isOverdue && (
                                                            <span
                                                                className="w-fit px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded text-[9px] font-bold uppercase tracking-widest"
                                                                title={`${t('creances:client_list.due_in')} : ${groupe.delaiPaiementJours} j`}
                                                            >
                                                                {t('creances:client_list.overdue_badge')}
                                                            </span>
                                                        )}
                                                        {overLimit && (
                                                            <span
                                                                className="w-fit px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-200 rounded text-[9px] font-bold uppercase tracking-widest"
                                                                title={`${t('creances:client_list.credit_limit')} : ${formatCurrency(groupe.plafond)}`}
                                                            >
                                                                {t('creances:client_list.over_limit')}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </td>
                                <td className="text-right py-2 px-3">
                                    <span className="px-2 py-1 bg-slate-100 rounded-lg font-mono text-xs font-bold text-slate-500">{groupe.count}</span>
                                </td>
                                <td className="text-center py-2 px-3">
                                    <span className={`inline-flex px-2 py-0.5 rounded-lg border text-xs font-bold ${ageBadgeClass(ageInDays(groupe.plusAncienne))}`}>
                                        {t('creances:age_days', { count: ageInDays(groupe.plusAncienne) ?? 0 })}
                                    </span>
                                </td>
                                <td className="text-center py-2 px-3">
                                    <div className="flex flex-col items-center">
                                        <span className={`text-xs font-bold ${groupe.dernierPaiement ? 'text-slate-600' : 'text-slate-300'}`}>
                                            {groupe.dernierPaiement ? formatDate(groupe.dernierPaiement) : t('creances:client_list.never')}
                                        </span>
                                        {groupe.derniereRelance && (
                                            <span className="text-micro font-bold text-slate-400 uppercase tracking-widest">
                                                {t('creances:client_list.last_relance', { date: formatDate(groupe.derniereRelance) })}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-right py-2 px-3">
                                    <span className="font-bold text-sm text-slate-800">{formatCurrency(groupe.total)}</span>
                                </td>
                                <td className="text-right py-2 px-3 font-bold text-emerald-600 text-sm">
                                    {formatCurrency(groupe.paye)}
                                </td>
                                <td className="text-right py-2 px-3">
                                    <span className="bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg font-bold text-sm shadow-sm border border-amber-200">
                                        {formatCurrency(groupe.reste)}
                                    </span>
                                </td>
                                <td className="text-center py-2 px-3">
                                    <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button
                                            className="inline-flex items-center justify-center size-8 rounded-full text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
                                            aria-label={t('creances:client_list.relance')}
                                            title={t('creances:client_list.relance')}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRelance(groupe.client.id);
                                            }}
                                        >
                                            <MessageCircle className="size-4" />
                                        </button>
                                        <button
                                            className="inline-flex items-center justify-center size-8 rounded-full text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600"
                                            aria-label={t('common:details', { defaultValue: 'Voir le détail' })}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onViewClient(groupe.client.id.toString());
                                            }}
                                        >
                                            <ChevronRight className="size-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // mode === 'invoices'
    if (filteredCreances.length === 0) {
        return (
            <EmptyState
                className="py-24 m-8 bg-white rounded-2xl border-2 border-dashed border-slate-100"
                icon={<Hash className="size-8" />}
                title={t('creances:invoice_list.empty')}
            />
        );
    }

    return (
        <div className="overflow-auto h-full w-full relative">
            <table className="w-full min-w-[900px] text-sm border-separate border-spacing-0">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        {!showHistory && (
                            <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 w-12 h-9 text-center px-3">
                                <input
                                    type="checkbox"
                                    aria-label={t('common:select_all')}
                                    className="size-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    onChange={onSelectAll}
                                    checked={filteredCreances.length > 0 && selectedIds.length === filteredCreances.filter(c => normalizeNumberInput(c.reste_a_payer) > 0).length}
                                />
                            </th>
                        )}
                        {([
                            { key: 'date', label: t('creances:invoice_list.date'), icon: <Calendar className="size-3.5" />, align: 'left' },
                            { key: 'age', label: t('creances:invoice_list.age'), icon: <Clock className="size-3.5" />, align: 'left' },
                            { key: 'numero_facture', label: t('creances:invoice_list.invoice_number'), icon: <Hash className="size-3.5" />, align: 'left' },
                            { key: 'ayant_droit', label: t('creances:invoice_list.beneficiary'), icon: <Users className="size-3.5" />, align: 'left' },
                            { key: 'total_ttc', label: t('creances:invoice_list.total'), icon: null, align: 'right' },
                            { key: 'montant_paye', label: t('creances:invoice_list.paid'), icon: null, align: 'right' },
                            { key: 'reste_a_payer', label: t('creances:invoice_list.remaining'), icon: null, align: 'right' },
                        ] as const).map((col) => (
                            <th
                                key={col.key}
                                className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-caption font-bold uppercase tracking-widest text-slate-400 cursor-pointer hover:text-emerald-600 transition-colors h-9 px-3 whitespace-nowrap"
                                onClick={() => onSort(col.key)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onSort(col.key);
                                    }
                                }}
                                tabIndex={0}
                                aria-sort={sortConfig.key === col.key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                            >
                                <div className={`flex items-center gap-2 ${col.align === 'right' ? 'justify-end' : ''}`}>
                                    {col.icon} {col.label} <SortIcon column={col.key} sortConfig={sortConfig} />
                                </div>
                            </th>
                        ))}
                        <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-caption font-bold uppercase tracking-widest text-slate-400 text-center h-9 px-3">{t('creances:invoice_list.status')}</th>
                        <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-caption font-bold uppercase tracking-widest text-slate-400 text-center h-9 px-3">{t('creances:invoice_list.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredCreances.map((creance) => {
                        const selectedSet = new Set(selectedIds);
                        const isSelected = selectedSet.has(creance.id);
                        const remaining = normalizeNumberInput(creance.reste_a_payer);
                        const isPaid = remaining <= 0;
                        const invoiceAge = ageInDays(creance.date);
                        const isOverdue = !isPaid && clientDelai > 0 && invoiceAge !== null && invoiceAge > clientDelai;

                        return (
                            <tr key={creance.id} className={`hover:bg-slate-50/50 transition-all group ${isSelected ? 'bg-emerald-50/30' : ''}`}>
                                {!showHistory && (
                                    <td className="text-center py-2 px-3">
                                        <input
                                            type="checkbox"
                                            aria-label={t('common:select_row')}
                                            className="size-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            checked={isSelected}
                                            onChange={() => onSelectOne(creance.id)}
                                            disabled={isPaid}
                                        />
                                    </td>
                                )}
                                <td className="py-2 px-3">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-xs font-bold text-slate-500">
                                            {formatDate(creance.date)}
                                        </span>
                                        <span className="text-caption font-bold text-slate-400 uppercase tracking-widest">
                                            {formatTime(creance.date)}
                                        </span>
                                    </div>
                                </td>
                                <td className="py-2 px-3">
                                    <span className={`inline-flex px-2 py-0.5 rounded-lg border text-xs font-bold ${isOverdue ? 'bg-red-50 text-red-600 border-red-200' : ageBadgeClass(invoiceAge)}`}>
                                        {t('creances:age_days', { count: invoiceAge ?? 0 })}
                                    </span>
                                </td>
                                <td className="py-2 px-3">
                                    <span className="font-bold text-sm text-emerald-600 tracking-tight">{creance.numero_facture || '-'}</span>
                                </td>
                                <td className="py-2 px-3 font-bold text-sm text-slate-500">{creance.ayant_droit_details?.nom || '-'}</td>
                                <td className="py-2 px-3 text-right font-bold text-sm text-slate-800 tabular-nums whitespace-nowrap">{formatCurrency(normalizeNumberInput(creance.total_ttc))}</td>
                                <td className="py-2 px-3 text-right text-emerald-600 font-bold text-sm tabular-nums whitespace-nowrap">{formatCurrency(normalizeNumberInput(creance.montant_paye))}</td>
                                <td className="py-2 px-3 text-right">
                                    <span className={`${isPaid ? 'text-slate-300' : 'text-amber-600'} font-bold text-sm tabular-nums whitespace-nowrap`}>
                                        {formatCurrency(remaining)}
                                    </span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
                                        isPaid ? 'bg-emerald-50 text-emerald-600'
                                        : isOverdue ? 'bg-red-50 text-red-600 animate-pulse'
                                        : 'bg-amber-50 text-amber-600 animate-pulse'
                                    }`}>
                                        {isPaid ? t('creances:invoice_list.paid_badge')
                                        : isOverdue ? t('creances:invoice_list.overdue_badge')
                                        : t('creances:invoice_list.pending_badge')}
                                    </div>
                                </td>
                                <td className="py-2 px-3">
                                    <div className="flex gap-2 justify-center">
                                        <button
                                            onClick={() => onViewDetails(creance)}
                                            className="inline-flex items-center justify-center size-8 rounded-full text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm group/btn"
                                            title={t('creances:invoice_list.view_payments')}
                                            aria-label={t('creances:invoice_list.view_payments')}
                                        >
                                            <Eye className="size-4" />
                                        </button>
                                        {!isPaid && (
                                            <button
                                                onClick={() => onPay(creance)}
                                                className="inline-flex items-center justify-center size-8 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:scale-110 active:scale-95 transition-all"
                                                title={t('creances:invoice_list.add_payment')}
                                                aria-label={t('creances:invoice_list.add_payment')}
                                            >
                                                <DollarSign className="size-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
