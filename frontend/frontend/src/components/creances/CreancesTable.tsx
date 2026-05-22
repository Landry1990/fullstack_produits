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
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-sm font-medium text-base-content/50 uppercase tracking-widest animate-pulse">
                    {t('creances:loading')}
                </p>
            </div>
        );
    }

    if (mode === 'clients') {
        if (groupedClients.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 bg-base-100 rounded-xl border border-dashed border-base-300">
                    <div className="p-4 bg-base-200 rounded-full mb-4">
                        <Users className="size-8 text-base-content/40" />
                    </div>
                    <p className="text-base-content/60 font-medium">{t('creances:client_list.empty')}</p>
                </div>
            );
        }

        return (
            <div className="overflow-auto h-full w-full relative">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-base-200 opacity-100">
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/50 py-4">{t('creances:client_list.client')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/50 text-right py-4">{t('creances:client_list.nb_invoices')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/50 text-right py-4">{t('creances:client_list.total_amount')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/50 text-right py-4">{t('creances:client_list.already_paid')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/50 text-right py-4">{t('creances:client_list.remaining_due')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/50 text-center py-4">{t('creances:client_list.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200">
                        {groupedClients.map((groupe) => (
                            <tr 
                                key={groupe.client.id} 
                                className="hover:bg-base-200/30 transition-all cursor-pointer group"
                                onClick={() => onViewClient(groupe.client.id.toString())}
                            >
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-4">
                                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs uppercase shadow-sm border border-indigo-200 group-hover:scale-110 transition-transform">
                                            {groupe.client.name.substring(0, 2)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-black text-sm text-base-content group-hover:text-primary transition-colors">{groupe.client.name}</span>
                                            <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest">{t('creances:client_type_label')}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="text-right py-4 px-6">
                                    <span className="px-2 py-1 bg-base-200 rounded-lg font-mono text-xs font-black text-base-content/60">{groupe.count}</span>
                                </td>
                                <td className="text-right py-4 px-6">
                                    <span className="font-black text-sm text-base-content">{formatCurrency(groupe.total)}</span>
                                </td>
                                <td className="text-right py-4 px-6 font-bold text-success text-sm">
                                    {formatCurrency(groupe.paye)}
                                </td>
                                <td className="text-right py-4 px-6">
                                    <span className="bg-warning/10 text-warning px-4 py-2 rounded-xl font-black text-sm shadow-sm border border-warning/20">
                                        {formatCurrency(groupe.reste)}
                                    </span>
                                </td>
                                <td className="text-center py-4 px-6">
                                    <button 
                                        className="btn btn-sm btn-circle btn-ghost opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 hover:text-primary"
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
            <div className="flex flex-col items-center justify-center py-24 bg-base-100 rounded-2xl border-2 border-dashed border-base-200 m-8">
                <div className="p-5 bg-base-100 shadow-xl shadow-base-200/50 rounded-xl mb-6">
                    <Hash className="size-10 text-gray-200" />
                </div>
                <p className="text-base-content/50 font-black uppercase tracking-widest text-xs">{t('creances:invoice_list.empty')}</p>
            </div>
        );
    }

    return (
        <div className="overflow-auto h-full w-full relative">
            <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                    <tr className="bg-base-200 opacity-100 border-b border-base-300">
                        {!showHistory && (
                            <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 w-12 text-center p-4">
                                <input 
                                    type="checkbox" 
                                    className="size-4 rounded border-base-300 text-primary focus:ring-primary cursor-pointer" 
                                    onChange={onSelectAll}
                                    checked={filteredCreances.length > 0 && selectedIds.length === filteredCreances.filter(c => normalizeNumberInput(c.reste_a_payer) > 0).length}
                                />
                            </th>
                        )}
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 cursor-pointer hover:text-primary transition-colors p-4" onClick={() => onSort('date')}>
                            <div className="flex items-center gap-2"><Calendar className="size-3.5" /> {t('creances:invoice_list.date')} <SortIcon column="date" sortConfig={sortConfig} /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 cursor-pointer hover:text-primary transition-colors p-4" onClick={() => onSort('numero_facture')}>
                            <div className="flex items-center gap-2"><Hash className="size-3.5" /> {t('creances:invoice_list.invoice_number')} <SortIcon column="numero_facture" sortConfig={sortConfig} /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 cursor-pointer hover:text-primary transition-colors p-4" onClick={() => onSort('ayant_droit')}>
                            <div className="flex items-center gap-2"><Users className="size-3.5" /> {t('creances:invoice_list.beneficiary')} <SortIcon column="ayant_droit" sortConfig={sortConfig} /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 text-right cursor-pointer hover:text-primary transition-colors p-4" onClick={() => onSort('total_ttc')}>
                            <div className="flex items-center justify-end gap-2">{t('creances:invoice_list.total')} <SortIcon column="total_ttc" sortConfig={sortConfig} /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 text-right cursor-pointer hover:text-primary transition-colors p-4" onClick={() => onSort('montant_paye')}>
                            <div className="flex items-center justify-end gap-2">{t('creances:invoice_list.paid')} <SortIcon column="montant_paye" sortConfig={sortConfig} /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 text-right cursor-pointer hover:text-primary transition-colors p-4" onClick={() => onSort('reste_a_payer')}>
                            <div className="flex items-center justify-end gap-2">{t('creances:invoice_list.remaining')} <SortIcon column="reste_a_payer" sortConfig={sortConfig} /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 text-center p-4">{t('creances:invoice_list.status')}</th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 text-center p-4">{t('creances:invoice_list.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-base-200">
                    {filteredCreances.map((creance) => {
                        const isSelected = selectedIds.includes(creance.id);
                        const remaining = normalizeNumberInput(creance.reste_a_payer);
                        const isPaid = remaining <= 0;

                        return (
                            <tr key={creance.id} className={`hover:bg-base-200/50 transition-all group ${isSelected ? 'bg-primary/10/50' : ''}`}>
                                {!showHistory && (
                                    <td className="text-center p-4">
                                        <input 
                                            type="checkbox" 
                                            className="size-4 rounded border-base-300 text-primary focus:ring-primary cursor-pointer" 
                                            checked={isSelected}
                                            onChange={() => onSelectOne(creance.id)}
                                            disabled={isPaid}
                                        />
                                    </td>
                                )}
                                <td className="p-4">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-xs font-black text-base-content/60">
                                            {formatDate(creance.date)}
                                        </span>
                                        <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">
                                            {formatTime(creance.date)}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className="font-black text-sm text-primary tracking-tight">{creance.numero_facture || '-'}</span>
                                </td>
                                <td className="p-4 font-bold text-sm text-base-content/60">{creance.ayant_droit_details?.nom || '-'}</td>
                                <td className="p-4 text-right font-black text-sm text-base-content">{formatCurrency(normalizeNumberInput(creance.total_ttc))}</td>
                                <td className="p-4 text-right text-success font-black text-sm">{formatCurrency(normalizeNumberInput(creance.montant_paye))}</td>
                                <td className="p-4 text-right">
                                    <span className={`${isPaid ? 'text-base-content/30' : 'text-warning'} font-black text-sm bg-base-200/50 px-3 py-1.5 rounded-lg border border-base-300/30 shadow-inner`}>
                                        {formatCurrency(remaining)}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
                                        isPaid ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning animate-pulse'
                                    }`}>
                                        {isPaid ? t('creances:invoice_list.paid_badge') : t('creances:invoice_list.pending_badge')}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex gap-2 justify-center">
                                        <button
                                            onClick={() => onViewDetails(creance)}
                                            className="btn btn-sm btn-circle btn-ghost hover:bg-primary/10 hover:text-primary transition-all shadow-sm group/btn"
                                            title={t('creances:invoice_list.view_payments')}
                                        >
                                            <Eye className="size-4" />
                                        </button>
                                        {!isPaid && (
                                            <button
                                                onClick={() => onPay(creance)}
                                                className="btn btn-sm btn-circle btn-primary shadow-lg shadow-indigo-200 hover:scale-110 active:scale-95 transition-all"
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
