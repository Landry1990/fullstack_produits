import React from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Clock, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { StockAnalysisItem } from '../../hooks/useStockAnalysis';

interface StockAnalysisTableProps {
    items: StockAnalysisItem[];
    loading: boolean;
    activeTab: 'unsold' | 'overstock' | 'shortage';
    selectedItems: Set<number>;
    onToggleSelect: (id: number) => void;
    onToggleSelectAll: () => void;
}

export const StockAnalysisTable: React.FC<StockAnalysisTableProps> = ({
    items,
    loading,
    activeTab,
    selectedItems,
    onToggleSelect,
    onToggleSelectAll
}) => {
    const { t, i18n } = useTranslation(['stock', 'common']);

    const getUrgencyBadge = (urgency: string) => {
        switch (urgency) {
            case 'critical':
                return (
                    <div className="inline-flex items-center px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-500 gap-1.5">
                        <AlertTriangle className="size-3" /> {t('stock:analyse.shortage.urgency.critical')}
                    </div>
                );
            case 'warning':
                return (
                    <div className="inline-flex items-center px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 gap-1.5">
                        <AlertTriangle className="size-3" /> {t('stock:analyse.shortage.urgency.warning')}
                    </div>
                );
            case 'caution':
                return (
                    <div className="inline-flex items-center px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 gap-1.5">
                        <AlertTriangle className="size-3" /> {t('stock:analyse.shortage.urgency.caution')}
                    </div>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="animate-spin rounded-full size-8 border-b-2 border-emerald-500"></div>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-widest animate-pulse">
                    {t('stock:analyse.messages.loading')}
                </p>
            </div>
        );
    }

    if (items.length === 0) {
        const getEmptyIcon = () => {
            switch (activeTab) {
                case 'unsold': return <Clock className="size-12 text-slate-300" />;
                case 'overstock': return <TrendingUp className="size-12 text-slate-300" />;
                case 'shortage': return <CheckCircle2 className="size-12 text-slate-300" />;
                default: return <Package className="size-12 text-slate-300" />;
            }
        };

        const getEmptyText = () => {
            switch (activeTab) {
                case 'unsold': return t('stock:analyse.empty.unsold');
                case 'overstock': return t('stock:analyse.empty.overstock');
                case 'shortage': return t('stock:analyse.empty.shortage');
                default: return '-';
            }
        };

        return (
            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border-2 border-dashed border-slate-200 m-6">
                <div className="p-6 bg-slate-100 rounded-full mb-6">
                    {getEmptyIcon()}
                </div>
                <h3 className="text-xl font-black text-slate-400">{getEmptyText()}</h3>
                <p className="text-sm font-semibold text-slate-400 mt-2">{t('stock:analyse.empty.all_good')}</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                        {(activeTab === 'shortage' || activeTab === 'overstock') && (
                            <th className="w-12 text-center">
                                <input
                                    type="checkbox"
                                    className="size-4 rounded border-slate-300 accent-emerald-600"
                                    checked={selectedItems.size === items.length && items.length > 0}
                                    onChange={onToggleSelectAll}
                                />
                            </th>
                        )}
                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-6 py-4 text-left">
                            <div className="flex items-center gap-1.5"><Package className="size-3" /> {t('stock:analyse.columns.product')}</div>
                        </th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                            {t('stock:analyse.columns.current_stock')}
                        </th>

                        {activeTab === 'unsold' ? (
                            <>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">{t('stock:analyse.columns.last_purchase')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">{t('stock:analyse.columns.last_sale')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">{t('stock:analyse.columns.inactive_since')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">{t('stock:analyse.columns.cost_price')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right px-6">{t('stock:analyse.columns.stock_value')}</th>
                            </>
                        ) : activeTab === 'overstock' ? (
                            <>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">{t('stock:analyse.columns.avg_rotation')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">{t('stock:analyse.columns.threshold')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">{t('stock:analyse.columns.excess_qty')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right px-6">{t('stock:analyse.columns.excess_value')}</th>
                            </>
                        ) : (
                            <>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">{t('stock:analyse.columns.avg_daily_sales')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">{t('stock:analyse.columns.days_until_stockout')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">{t('stock:analyse.columns.urgency')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right px-6">{t('stock:analyse.columns.value_at_risk')}</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {items.map((item) => {
                        const isSelected = selectedItems.has(item.id);
                        return (
                            <tr
                                key={item.id}
                                className={`hover:bg-slate-50 transition-colors border-b border-slate-50 ${isSelected ? 'bg-emerald-50/30' : ''}`}
                            >
                                {(activeTab === 'shortage' || activeTab === 'overstock') && (
                                    <td className="text-center">
                                        <input
                                            type="checkbox"
                                            className="size-4 rounded border-slate-300 accent-emerald-600"
                                            checked={isSelected}
                                            onChange={() => onToggleSelect(item.id)}
                                        />
                                    </td>
                                )}
                                <td className="px-4 py-3">
                                    <div className="font-bold text-slate-700 tracking-tight uppercase">{item.name}</div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5" title="CIP / Code Barre">
                                        CIP: {item.cip || item.id}
                                    </div>
                                </td>
                                <td className="text-center py-3">
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[10px] font-black bg-slate-100 text-slate-600 italic min-w-10">
                                        {item.stock}
                                    </span>
                                </td>

                                {activeTab === 'unsold' ? (
                                    <>
                                        <td className="font-mono text-xs text-slate-500 py-3">
                                            {item.dernier_achat ? new Date(item.dernier_achat).toLocaleDateString(i18n.language) : '-'}
                                        </td>
                                        <td className="font-mono text-xs text-slate-500 py-3">
                                            {item.derniere_vente ? new Date(item.derniere_vente).toLocaleDateString(i18n.language) : <span className="text-red-500 font-black italic">{t('stock:analyse.messages.never_sold')}</span>}
                                        </td>
                                        <td className="text-center py-3">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black italic bg-amber-50 text-amber-600">
                                                {item.days_since_sale ?? '-'} {t('stock:analyse.day_short', { defaultValue: 'j' })}
                                            </span>
                                        </td>
                                        <td className="text-right font-mono font-bold text-slate-500 py-3">
                                            {formatCurrency(Math.round(item.cost_price))}
                                        </td>
                                        <td className="text-right font-black text-red-500 px-6 py-3">
                                            {formatCurrency(Math.round(item.value))}
                                        </td>
                                    </>
                                ) : activeTab === 'overstock' ? (
                                    <>
                                        <td className="text-center font-mono py-3">
                                            <span className="font-bold text-slate-700">{Number(item.rotation || 0).toFixed(0)}</span>
                                            <span className="text-[10px] text-slate-400 ml-1">/ {t('stock:analyse.per_month')}</span>
                                        </td>
                                        <td className="text-center font-bold text-slate-500 py-3">{item.threshold}</td>
                                        <td className="text-center py-3">
                                            <span className="text-red-500 font-black italic">+{item.excess_qty}</span>
                                        </td>
                                        <td className="text-right font-black text-red-500 px-6 py-3">
                                            {formatCurrency(Math.round(item.value))}
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="text-center font-mono py-3">
                                            <span className="font-bold text-slate-700">{item.avg_daily_sales}</span>
                                            <span className="text-[10px] text-slate-400 ml-1">/ {t('stock:analyse.per_day')}</span>
                                        </td>
                                        <td className="text-center py-3">
                                            <span className={`font-black italic ${
                                                (item.days_until_stockout || 0) < 7 ? 'text-red-500' :
                                                (item.days_until_stockout || 0) < 14 ? 'text-amber-600' : 'text-blue-500'
                                            }`}>
                                                {item.days_until_stockout} {t('stock:analyse.days')}
                                            </span>
                                        </td>
                                        <td className="text-center py-3">
                                            {getUrgencyBadge(item.urgency || '')}
                                        </td>
                                        <td className="text-right font-black text-red-500 px-6 py-3">
                                            {formatCurrency(Math.round(item.value))}
                                        </td>
                                    </>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};


