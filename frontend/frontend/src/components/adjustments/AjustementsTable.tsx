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
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-sm font-medium text-base-content/40 uppercase tracking-widest animate-pulse">
                    {t('ajustements.table.loading')}
                </p>
            </div>
        );
    }

    if (adjustments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-base-100 rounded-2xl border border-dashed border-base-300">
                <div className="p-4 bg-base-200 rounded-full mb-4">
                    <ClipboardList className="w-8 h-8 text-base-content/20" />
                </div>
                <p className="text-base-content/50 font-medium">{t('ajustements.table.empty')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="overflow-x-auto">
                <table className="table w-full">
                    <thead>
                        <tr className="bg-base-200/50 border-b border-base-200">
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 px-6">
                                <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {t('ajustements.table.date_header')}</div>
                            </th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                <div className="flex items-center gap-1.5"><Package className="w-3 h-3" /> {t('ajustements.table.product_header')}</div>
                            </th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                <div className="flex items-center gap-1.5"><Hash className="w-3 h-3" /> {t('ajustements.table.cip_header')}</div>
                                </th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                <div className="flex items-center gap-1.5"><User className="w-3 h-3" /> {t('ajustements.table.user_header')}</div>
                            </th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right">{t('ajustements.table.before_header')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right">{t('ajustements.table.after_header')}</th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">
                                <div className="flex items-center justify-center gap-1.5"><ArrowLeftRight className="w-3 h-3" /> {t('ajustements.table.diff_header')}</div>
                            </th>
                            <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 px-6">{t('ajustements.table.reason_header')}</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {adjustments.map((adj) => (
                            <tr key={adj.id} className="hover:bg-base-200/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-mono text-xs text-base-content/60">
                                        {formatDate(adj.created_at)}
                                    </div>
                                    <div className="text-[10px] font-bold text-base-content/40">
                                        {formatDateTime(adj.created_at).split(' ').slice(1).join(' ')}
                                    </div>
                                </td>
                                <td className="font-bold text-base-content tracking-tight">{adj.produit_name}</td>
                                <td className="font-mono text-xs text-base-content/50">{adj.produit_cip || '-'}</td>
                                <td>
                                    <div className="badge badge-ghost badge-sm font-semibold tracking-tighter">
                                        {adj.user_name || adj.username || '-'}
                                    </div>
                                </td>
                                <td className="text-right font-mono text-base-content/60">{adj.quantity_before}</td>
                                <td className="text-right font-bold">{adj.quantity_after}</td>
                                <td className="text-center">
                                    <div className={`badge badge-sm font-black italic shadow-sm border-none ${
                                        adj.quantity_change > 0 ? 'bg-success/20 text-success' : 
                                        adj.quantity_change < 0 ? 'bg-error/20 text-error' : 
                                        'bg-base-200 text-base-content/40'
                                    }`}>
                                        {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                                    </div>
                                </td>
                                <td className="px-6">
                                    <span className="text-[10px] font-black uppercase tracking-tighter text-primary/60 bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                                        {t(`ajustements.filters.reasons.${adj.reason_type}`, { defaultValue: adj.reason_type_display })}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="mt-auto border-t border-base-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-base-100">
                <div className="text-xs font-bold text-base-content/40 uppercase tracking-widest">
                    {t('ajustements.table.pagination', { current: currentPage, total: totalPages, count: totalCount })}
                </div>
                <div className="flex items-center gap-1 bg-base-200 p-1 rounded-2xl shadow-inner">
                    <button 
                        className="btn btn-sm btn-ghost btn-circle hover:bg-base-100 hover:text-primary transition-all disabled:opacity-30"
                        disabled={currentPage <= 1}
                        onClick={() => onPageChange(currentPage - 1)}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="px-4 text-sm font-black text-primary">
                        {currentPage}
                    </div>
                    <button 
                        className="btn btn-sm btn-ghost btn-circle hover:bg-base-100 hover:text-primary transition-all disabled:opacity-30"
                        disabled={currentPage >= totalPages}
                        onClick={() => onPageChange(currentPage + 1)}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
