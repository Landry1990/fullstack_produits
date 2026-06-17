import React from 'react';
import { Calendar, Package, Hash, User, ArrowLeftRight, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { StockAdjustment } from '../../types';
import { formatDate, formatDateTime } from '../../utils/dateUtils';

interface AjustementsTableProps {
    adjustments: StockAdjustment[];
    loading: boolean;
    currentPage: number;
    totalPages: number;
    totalCount: number;
    onPageChange: (page: number) => void;
}

export const AjustementsTable: React.FC<AjustementsTableProps> = ({
    adjustments,
    loading,
    currentPage,
    totalPages,
    totalCount,
    onPageChange
}) => {
    const { t, i18n } = useTranslation(['stock', 'common']);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="animate-spin rounded-full size-8 border-b-2 border-emerald-500"></div>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-widest animate-pulse">
                    {t('ajustements.table.loading')}
                </p>
            </div>
        );
    }

    if (adjustments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-200 m-4">
                <div className="p-4 bg-slate-100 rounded-full mb-4">
                    <ClipboardList className="size-8 text-slate-300" />
                </div>
                <p className="text-slate-400 font-medium">{t('ajustements.table.empty')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-6 py-3 text-left">
                                <div className="flex items-center gap-1.5"><Calendar className="size-3" /> {t('ajustements.table.date_header')}</div>
                            </th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-left">
                                <div className="flex items-center gap-1.5"><Package className="size-3" /> {t('ajustements.table.product_header')}</div>
                            </th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-left">
                                <div className="flex items-center gap-1.5"><Hash className="size-3" /> {t('ajustements.table.cip_header')}</div>
                            </th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-left">
                                <div className="flex items-center gap-1.5"><User className="size-3" /> {t('ajustements.table.user_header')}</div>
                            </th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-right">{t('ajustements.table.before_header')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-right">{t('ajustements.table.after_header')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-center">
                                <div className="flex items-center justify-center gap-1.5"><ArrowLeftRight className="size-3" /> {t('ajustements.table.diff_header')}</div>
                            </th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-6 py-3 text-left">{t('ajustements.table.reason_header')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {adjustments.map((adj) => (
                            <tr key={adj.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                                <td className="px-6 py-3">
                                    <div className="font-mono text-xs text-slate-500">
                                        {formatDate(adj.created_at)}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400">
                                        {formatDateTime(adj.created_at).split(' ').slice(1).join(' ')}
                                    </div>
                                </td>
                                <td className="font-bold text-slate-800 tracking-tight py-3">{adj.produit_name}</td>
                                <td className="font-mono text-xs text-slate-400 py-3">{adj.produit_cip || '-'}</td>
                                <td className="py-3">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600">
                                        {adj.user_name || adj.username || '-'}
                                    </span>
                                </td>
                                <td className="text-right font-mono text-slate-500 py-3">{adj.quantity_before}</td>
                                <td className="text-right font-bold text-slate-700 py-3">{adj.quantity_after}</td>
                                <td className="text-center py-3">
                                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-black italic ${
                                        adj.quantity_change > 0 ? 'bg-emerald-50 text-emerald-600' :
                                        adj.quantity_change < 0 ? 'bg-red-50 text-red-500' :
                                        'bg-slate-100 text-slate-400'
                                    }`}>
                                        {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                                    </span>
                                </td>
                                <td className="px-6 py-3">
                                    <span className="text-[10px] font-black uppercase tracking-tighter text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                        {t(`ajustements.filters.reasons.${adj.reason_type}`, { defaultValue: adj.reason_type_display })}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="mt-auto border-t border-slate-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {t('ajustements.table.pagination', { current: currentPage, total: totalPages, count: totalCount })}
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                    <button
                        className="inline-flex items-center justify-center size-8 rounded-xl text-slate-500 hover:bg-white hover:text-emerald-600 transition-all disabled:opacity-30"
                        disabled={currentPage <= 1}
                        onClick={() => onPageChange(currentPage - 1)}
                    >
                        <ChevronLeft className="size-4" />
                    </button>
                    <div className="px-4 text-sm font-black text-emerald-600">
                        {currentPage}
                    </div>
                    <button
                        className="inline-flex items-center justify-center size-8 rounded-xl text-slate-500 hover:bg-white hover:text-emerald-600 transition-all disabled:opacity-30"
                        disabled={currentPage >= totalPages}
                        onClick={() => onPageChange(currentPage + 1)}
                    >
                        <ChevronRight className="size-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
