import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { Eye, DollarSign, ArrowUpRight, ChevronRight, Hash, Calendar, Users } from 'lucide-react';
import type { Creance, Client } from '../../types';
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

interface CreancesTableProps {
    mode: 'clients' | 'invoices';
    groupedClients: { client: Client, total: number, paye: number, reste: number, count: number }[];
    filteredCreances: Creance[];
    loading: boolean;
    showHistory: boolean;
    selectedIds: number[];
    onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSelectOne: (id: number) => void;
    onViewClient: (id: string) => void;
    onViewDetails: (creance: Creance) => void;
    onPay: (creance: Creance) => void;
    sortConfig: { key: string, direction: 'asc' | 'desc' };
    onSort: (key: unknown) => void;
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
    onViewDetails,
    onPay,
    sortConfig,
    onSort
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
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">{t('creances:client_list.client')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right py-4">{t('creances:client_list.nb_invoices')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right py-4">{t('creances:client_list.total_amount')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right py-4">{t('creances:client_list.already_paid')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right py-4">{t('creances:client_list.remaining_due')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center py-4">{t('creances:client_list.actions')}</th>
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
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-4">
                                        <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xs uppercase shadow-sm border border-emerald-200 group-hover:scale-110 transition-transform">
                                            {groupe.client.name.substring(0, 2)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-black text-sm text-slate-800 group-hover:text-emerald-600 transition-colors">{groupe.client.name}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('creances:client_type_label')}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="text-right py-4 px-6">
                                    <span className="px-2 py-1 bg-slate-100 rounded-lg font-mono text-xs font-black text-slate-500">{groupe.count}</span>
                                </td>
                                <td className="text-right py-4 px-6">
                                    <span className="font-black text-sm text-slate-800">{formatCurrency(groupe.total)}</span>
                                </td>
                                <td className="text-right py-4 px-6 font-bold text-emerald-600 text-sm">
                                    {formatCurrency(groupe.paye)}
                                </td>
                                <td className="text-right py-4 px-6">
                                    <span className="bg-amber-50 text-amber-600 px-4 py-2 rounded-xl font-black text-sm shadow-sm border border-amber-200">
                                        {formatCurrency(groupe.reste)}
                                    </span>
                                </td>
                                <td className="text-center py-4 px-6">
                                    <button
                                        className="inline-flex items-center justify-center size-8 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-50 hover:text-emerald-600"
                                        aria-label={t('common:details', { defaultValue: 'Voir le détail' })}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewClient(groupe.client.id.toString());
                                        }}
                                    >
                                        <ChevronRight className="size-5" />
                                    </button>
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
            <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        {!showHistory && (
                            <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 w-12 text-center p-4">
                                <input
                                    type="checkbox"
                                    aria-label={t('common:select_all', { defaultValue: 'Tout sélectionner' })}
                                    className="size-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    onChange={onSelectAll}
                                    checked={filteredCreances.length > 0 && selectedIds.length === filteredCreances.filter(c => normalizeNumberInput(c.reste_a_payer) > 0).length}
                                />
                            </th>
                        )}
                        {([
                            { key: 'date', label: t('creances:invoice_list.date'), icon: <Calendar className="size-3.5" />, align: 'left' },
                            { key: 'numero_facture', label: t('creances:invoice_list.invoice_number'), icon: <Hash className="size-3.5" />, align: 'left' },
                            { key: 'ayant_droit', label: t('creances:invoice_list.beneficiary'), icon: <Users className="size-3.5" />, align: 'left' },
                            { key: 'total_ttc', label: t('creances:invoice_list.total'), icon: null, align: 'right' },
                            { key: 'montant_paye', label: t('creances:invoice_list.paid'), icon: null, align: 'right' },
                            { key: 'reste_a_payer', label: t('creances:invoice_list.remaining'), icon: null, align: 'right' },
                        ] as const).map((col) => (
                            <th
                                key={col.key}
                                className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-emerald-600 transition-colors p-4 whitespace-nowrap"
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
                        <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center p-4">{t('creances:invoice_list.status')}</th>
                        <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center p-4">{t('creances:invoice_list.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredCreances.map((creance) => {
                        const selectedSet = new Set(selectedIds);
                        const isSelected = selectedSet.has(creance.id);
                        const remaining = normalizeNumberInput(creance.reste_a_payer);
                        const isPaid = remaining <= 0;

                        return (
                            <tr key={creance.id} className={`hover:bg-slate-50/50 transition-all group ${isSelected ? 'bg-emerald-50/30' : ''}`}>
                                {!showHistory && (
                                    <td className="text-center p-4">
                                        <input
                                            type="checkbox"
                                            aria-label={t('common:select_row', { defaultValue: 'Sélectionner cette facture' })}
                                            className="size-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            checked={isSelected}
                                            onChange={() => onSelectOne(creance.id)}
                                            disabled={isPaid}
                                        />
                                    </td>
                                )}
                                <td className="p-4">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-xs font-black text-slate-500">
                                            {formatDate(creance.date)}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {formatTime(creance.date)}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className="font-black text-sm text-emerald-600 tracking-tight">{creance.numero_facture || '-'}</span>
                                </td>
                                <td className="p-4 font-bold text-sm text-slate-500">{creance.ayant_droit_details?.nom || '-'}</td>
                                <td className="p-4 text-right font-black text-sm text-slate-800 tabular-nums whitespace-nowrap">{formatCurrency(normalizeNumberInput(creance.total_ttc))}</td>
                                <td className="p-4 text-right text-emerald-600 font-black text-sm tabular-nums whitespace-nowrap">{formatCurrency(normalizeNumberInput(creance.montant_paye))}</td>
                                <td className="p-4 text-right">
                                    <span className={`${isPaid ? 'text-slate-300' : 'text-amber-600'} font-black text-sm tabular-nums whitespace-nowrap`}>
                                        {formatCurrency(remaining)}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
                                        isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600 animate-pulse'
                                    }`}>
                                        {isPaid ? t('creances:invoice_list.paid_badge') : t('creances:invoice_list.pending_badge')}
                                    </div>
                                </td>
                                <td className="p-4">
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
