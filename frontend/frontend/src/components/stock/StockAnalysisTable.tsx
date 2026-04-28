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
                    <div className="badge border-none bg-error/20 text-error gap-1.5 font-black uppercase text-[10px] tracking-widest px-3 py-2">
                        <AlertTriangle className="w-3 h-3" /> {t('stock:analyse.shortage.urgency.critical')}
                    </div>
                );
            case 'warning':
                return (
                    <div className="badge border-none bg-warning/20 text-warning gap-1.5 font-black uppercase text-[10px] tracking-widest px-3 py-2">
                        <AlertTriangle className="w-3 h-3" /> {t('stock:analyse.shortage.urgency.warning')}
                    </div>
                );
            case 'caution':
                return (
                    <div className="badge border-none bg-info/20 text-info gap-1.5 font-black uppercase text-[10px] tracking-widest px-3 py-2">
                        <AlertTriangle className="w-3 h-3" /> {t('stock:analyse.shortage.urgency.caution')}
                    </div>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-sm font-medium text-base-content/40 uppercase tracking-widest animate-pulse">
                    {t('stock:analyse.messages.loading')}
                </p>
            </div>
        );
    }

    if (items.length === 0) {
        const getEmptyIcon = () => {
            switch (activeTab) {
                case 'unsold': return <Clock className="w-12 h-12 text-base-content/20" />;
                case 'overstock': return <TrendingUp className="w-12 h-12 text-base-content/20" />; // Note: TrendingUp should be imported or use a fallback
                case 'shortage': return <CheckCircle2 className="w-12 h-12 text-base-content/20" />;
                default: return <Package className="w-12 h-12 text-base-content/20" />;
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
            <div className="flex flex-col items-center justify-center py-32 bg-base-100 rounded-3xl border-2 border-dashed border-base-200 m-6">
                <div className="p-6 bg-base-200 rounded-full mb-6">
                    {getEmptyIcon()}
                </div>
                <h3 className="text-xl font-black text-base-content/60">{getEmptyText()}</h3>
                <p className="text-sm font-semibold text-base-content/30 mt-2">{t('stock:analyse.empty.all_good')}</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="table w-full">
                <thead>
                    <tr className="bg-base-200/50 border-b border-base-200">
                        {(activeTab === 'shortage' || activeTab === 'overstock') && (
                            <th className="w-12 text-center">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm checkbox-primary"
                                    checked={selectedItems.size === items.length && items.length > 0}
                                    onChange={onToggleSelectAll}
                                />
                            </th>
                        )}
                        <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 px-6 py-4">
                            <div className="flex items-center gap-1.5"><Package className="w-3 h-3" /> {t('stock:analyse.columns.product')}</div>
                        </th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">
                            {t('stock:analyse.columns.current_stock')}
                        </th>

                        {activeTab === 'unsold' ? (
                            <>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('stock:analyse.columns.last_purchase')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('stock:analyse.columns.last_sale')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">{t('stock:analyse.columns.inactive_since')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right">{t('stock:analyse.columns.cost_price')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right px-6">{t('stock:analyse.columns.stock_value')}</th>
                            </>
                        ) : activeTab === 'overstock' ? (
                            <>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">{t('stock:analyse.columns.avg_rotation')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">{t('stock:analyse.columns.threshold')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">{t('stock:analyse.columns.excess_qty')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right px-6">{t('stock:analyse.columns.excess_value')}</th>
                            </>
                        ) : (
                            <>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">{t('stock:analyse.columns.avg_daily_sales')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">{t('stock:analyse.columns.days_until_stockout')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">{t('stock:analyse.columns.urgency')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right px-6">{t('stock:analyse.columns.value_at_risk')}</th>
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
                                className={`hover:bg-base-200/30 transition-colors group ${isSelected ? 'bg-primary/5' : ''}`}
                            >
                                {(activeTab === 'shortage' || activeTab === 'overstock') && (
                                    <td className="text-center">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-sm checkbox-primary"
                                            checked={isSelected}
                                            onChange={() => onToggleSelect(item.id)}
                                        />
                                    </td>
                                )}
                                <td className="px-4 py-2">
                                    <div className="font-bold text-base-content tracking-tight uppercase">{item.name}</div>
                                    <div className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mt-0.5" title="CIP / Code Barre">
                                        CIP: {item.cip || item.id}
                                    </div>
                                </td>
                                <td className="text-center py-2">
                                    <div className="badge badge-md bg-base-200 border-none font-black min-w-10 rounded-lg shadow-inner italic">
                                        {item.stock}
                                    </div>
                                </td>

                                {activeTab === 'unsold' ? (
                                    <>
                                        <td className="font-mono text-xs text-base-content/60">
                                            {item.dernier_achat ? new Date(item.dernier_achat).toLocaleDateString(i18n.language) : '-'}
                                        </td>
                                        <td className="font-mono text-xs text-base-content/60">
                                            {item.derniere_vente ? new Date(item.derniere_vente).toLocaleDateString(i18n.language) : <span className="text-error font-black italic">{t('stock:analyse.messages.never_sold')}</span>}
                                        </td>
                                        <td className="text-center">
                                            <div className="badge border-none bg-warning/20 text-warning font-black italic">
                                                {item.days_since_sale ?? '-'} {t('stock:analyse.day_short', { defaultValue: 'j' })}
                                            </div>
                                        </td>
                                        <td className="text-right font-mono font-bold text-base-content/40">
                                            {formatCurrency(Math.round(item.cost_price))}
                                        </td>
                                        <td className="text-right font-black text-error px-6">
                                            {formatCurrency(Math.round(item.value))}
                                        </td>
                                    </>
                                ) : activeTab === 'overstock' ? (
                                    <>
                                        <td className="text-center font-mono">
                                            <span className="font-bold">{Number(item.rotation || 0).toFixed(0)}</span>
                                            <span className="text-[10px] text-base-content/30 ml-1">/ {t('stock:analyse.per_month')}</span>
                                        </td>
                                        <td className="text-center font-bold text-base-content/40">{item.threshold}</td>
                                        <td className="text-center">
                                            <span className="text-error font-black italic">+{item.excess_qty}</span>
                                        </td>
                                        <td className="text-right font-black text-error px-6">
                                            {formatCurrency(Math.round(item.value))}
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="text-center font-mono">
                                            <span className="font-bold">{item.avg_daily_sales}</span>
                                            <span className="text-[10px] text-base-content/30 ml-1">/ {t('stock:analyse.per_day')}</span>
                                        </td>
                                        <td className="text-center">
                                            <div className={`font-black italic ${
                                                (item.days_until_stockout || 0) < 7 ? 'text-error' :
                                                (item.days_until_stockout || 0) < 14 ? 'text-warning' : 'text-info'
                                            }`}>
                                                {item.days_until_stockout} {t('stock:analyse.days')}
                                            </div>
                                        </td>
                                        <td className="text-center">
                                            {getUrgencyBadge(item.urgency || '')}
                                        </td>
                                        <td className="text-right font-black text-error px-6">
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


