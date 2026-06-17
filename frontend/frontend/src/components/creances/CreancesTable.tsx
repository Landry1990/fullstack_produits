import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { Eye, DollarSign, ArrowUpRight, ChevronRight, Hash, Calendar, Users } from 'lucide-react';
import type { Creance, Client } from '../../types';

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
    onSort: (key: any) => void;
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
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="animate-spin rounded-full size-10 border-b-2 border-emerald-600"></div>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-widest animate-pulse">
                    {t('creances:loading')}
                </p>
            </div>
        );
    }

    if (mode === 'clients') {
        if (groupedClients.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                    <div className="p-4 bg-slate-100 rounded-full mb-4">
                        <Users className="size-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">{t('creances:client_list.empty')}</p>
                </div>
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
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-100 m-8">
                <div className="p-5 bg-white shadow-xl shadow-slate-100/50 rounded-xl mb-6">
                    <Hash className="size-10 text-slate-200" />
                </div>
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">{t('creances:invoice_list.empty')}</p>
            </div>
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
                                    className="size-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    onChange={onSelectAll}
                                    checked={filteredCreances.length > 0 && selectedIds.length === filteredCreances.filter(c => normalizeNumberInput(c.reste_a_payer) > 0).length}
                                />
                            </th>
                        )}
                        <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-emerald-600 transition-colors p-4" onClick={() => onSort('date')}>
                            <div className="flex items-center gap-2"><Calendar className="size-3.5" /> {t('creances:invoice_list.date')} <SortIcon column="date" sortConfig={sortConfig} /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-emerald-600 transition-colors p-4" onClick={() => onSort('numero_facture')}>
                            <div className="flex items-center gap-2"><Hash className="size-3.5" /> {t('creances:invoice_list.invoice_number')} <SortIcon column="numero_facture" sortConfig={sortConfig} /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-emerald-600 transition-colors p-4" onClick={() => onSort('ayant_droit')}>
                            <div className="flex items-center gap-2"><Users className="size-3.5" /> {t('creances:invoice_list.beneficiary')} <SortIcon column="ayant_droit" sortConfig={sortConfig} /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right cursor-pointer hover:text-emerald-600 transition-colors p-4" onClick={() => onSort('total_ttc')}>
                            <div className="flex items-center justify-end gap-2">{t('creances:invoice_list.total')} <SortIcon column="total_ttc" sortConfig={sortConfig} /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right cursor-pointer hover:text-emerald-600 transition-colors p-4" onClick={() => onSort('montant_paye')}>
                            <div className="flex items-center justify-end gap-2">{t('creances:invoice_list.paid')} <SortIcon column="montant_paye" sortConfig={sortConfig} /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right cursor-pointer hover:text-emerald-600 transition-colors p-4" onClick={() => onSort('reste_a_payer')}>
                            <div className="flex items-center justify-end gap-2">{t('creances:invoice_list.remaining')} <SortIcon column="reste_a_payer" sortConfig={sortConfig} /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center p-4">{t('creances:invoice_list.status')}</th>
                        <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center p-4">{t('creances:invoice_list.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredCreances.map((creance) => {
                        const isSelected = selectedIds.includes(creance.id);
                        const remaining = normalizeNumberInput(creance.reste_a_payer);
                        const isPaid = remaining <= 0;

                        return (
                            <tr key={creance.id} className={`hover:bg-slate-50/50 transition-all group ${isSelected ? 'bg-emerald-50/30' : ''}`}>
                                {!showHistory && (
                                    <td className="text-center p-4">
                                        <input
                                            type="checkbox"
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
                                <td className="p-4 text-right font-black text-sm text-slate-800">{formatCurrency(normalizeNumberInput(creance.total_ttc))}</td>
                                <td className="p-4 text-right text-emerald-600 font-black text-sm">{formatCurrency(normalizeNumberInput(creance.montant_paye))}</td>
                                <td className="p-4 text-right">
                                    <span className={`${isPaid ? 'text-slate-300' : 'text-amber-600'} font-black text-sm bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shadow-inner`}>
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
                                        >
                                            <Eye className="size-4" />
                                        </button>
                                        {!isPaid && (
                                            <button
                                                onClick={() => onPay(creance)}
                                                className="inline-flex items-center justify-center size-8 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:scale-110 active:scale-95 transition-all"
                                                title={t('creances:invoice_list.add_payment')}
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
