import React from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { StockAnalysisItem } from '../../hooks/useStockAnalysis';
import { Checkbox } from '../shadcn/checkbox';
import { Badge } from '../shadcn/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/Table';

interface StockAnalysisTableProps {
    items: StockAnalysisItem[];
    loading: boolean;
    activeTab: 'unsold' | 'overstock' | 'shortage';
    selectedItems: Set<number>;
    onToggleSelect: (id: number) => void;
    onToggleSelectAll: () => void;
}

const emptyStateIcons = {
    unsold: <Clock className="size-10 text-slate-300" />,
    overstock: <TrendingUp className="size-10 text-slate-300" />,
    shortage: <CheckCircle2 className="size-10 text-emerald-500" />,
};

const SkeletonRow = ({ widths, hasCheckbox }: { widths: string[]; hasCheckbox: boolean }) => (
    <TableRow className="border-b border-slate-100 animate-pulse hover:bg-transparent">
        {hasCheckbox && <TableCell className="py-2 px-3 text-center"><div className="size-4 rounded bg-slate-200 mx-auto" /></TableCell>}
        {widths.map((_, i) => (
            <TableCell key={i} className="py-2 px-3">
                <div className="h-4 rounded bg-slate-200" style={{ width: `${60 + Math.random() * 30}%` }} />
            </TableCell>
        ))}
    </TableRow>
);

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
            case 'rupture':
                return <Badge className="bg-red-700 hover:bg-red-800 text-white">{t('stock:analyse.shortage.urgency.rupture', 'RUPTURE')}</Badge>;
            case 'critical':
                return <Badge variant="destructive">{t('stock:analyse.shortage.urgency.critical')}</Badge>;
            case 'warning':
                return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">{t('stock:analyse.shortage.urgency.warning')}</Badge>;
            case 'caution':
                return <Badge variant="secondary">{t('stock:analyse.shortage.urgency.caution')}</Badge>;
            default:
                return null;
        }
    };

    const allSelected = items.length > 0 && selectedItems.size === items.length;
    const hasSelection = activeTab === 'shortage' || activeTab === 'overstock';

    const config = activeTab === 'unsold'
        ? {
            headers: [
                t('stock:analyse.columns.product'),
                t('stock:analyse.columns.current_stock'),
                t('stock:analyse.columns.last_purchase'),
                t('stock:analyse.columns.last_sale'),
                t('stock:analyse.columns.inactive_since'),
                t('stock:analyse.columns.cost_price'),
                t('stock:analyse.columns.stock_value'),
            ],
            widths: ['w-[32%]', 'w-16', 'w-28', 'w-28', 'w-24', 'w-32', 'w-32'],
        }
        : activeTab === 'overstock'
        ? {
            headers: [
                t('stock:analyse.columns.product'),
                t('stock:analyse.columns.current_stock'),
                t('stock:analyse.columns.avg_rotation'),
                t('stock:analyse.columns.threshold'),
                t('stock:analyse.columns.excess_qty'),
                t('stock:analyse.columns.excess_value'),
            ],
            widths: ['w-[36%]', 'w-16', 'w-24', 'w-24', 'w-24', 'w-32'],
        }
        : {
            headers: [
                t('stock:analyse.columns.product'),
                t('stock:analyse.columns.current_stock'),
                t('stock:analyse.columns.avg_daily_sales'),
                t('stock:analyse.columns.days_until_stockout'),
                t('stock:analyse.columns.urgency'),
                t('stock:analyse.columns.value_at_risk'),
            ],
            widths: ['w-[36%]', 'w-16', 'w-28', 'w-28', 'w-24', 'w-32'],
        };

    const { headers, widths } = config;

    if (loading) {
        return (
            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                <Table className="w-full table-fixed text-sm">
                    <TableHeader className="sticky top-0 z-10">
                        <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
                            {hasSelection && (
                                <TableHead className="w-12 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <span className="sr-only">Sélection</span>
                                </TableHead>
                            )}
                            {headers.map((h, i) => (
                                <TableHead
                                    key={h}
                                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 ${widths[i]} ${
                                        i === 0 ? 'text-left' : i === headers.length - 1 ? 'text-right' : 'text-center'
                                    }`}
                                >
                                    {h}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <SkeletonRow key={i} widths={widths} hasCheckbox={hasSelection} />
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    if (items.length === 0) {
        const labels = {
            unsold: t('stock:analyse.empty.unsold'),
            overstock: t('stock:analyse.empty.overstock'),
            shortage: t('stock:analyse.empty.shortage'),
        };

        return (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="p-4 bg-slate-100 rounded-2xl mb-4">
                    {emptyStateIcons[activeTab]}
                </div>
                <h3 className="text-base font-semibold text-slate-700">{labels[activeTab]}</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">
                    {t('stock:analyse.empty.all_good')}
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-auto flex-1 min-h-0">
            <Table className="w-full table-fixed text-sm">
                <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
                        {hasSelection && (
                            <TableHead className="w-12 px-3 py-2 text-center">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={onToggleSelectAll}
                                    aria-label="Sélectionner tout"
                                />
                            </TableHead>
                        )}
                        {headers.map((h, i) => (
                            <TableHead
                                key={h}
                                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 ${widths[i]} ${
                                    i === 0 ? 'text-left' : i === headers.length - 1 ? 'text-right' : 'text-center'
                                }`}
                            >
                                {i === 0 ? (
                                    <div className="flex items-center gap-1.5">
                                        <Package className="size-3.5" /> {h}
                                    </div>
                                ) : h}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody className="text-sm">
                    {items.map((item) => {
                        const isSelected = selectedItems.has(item.id);
                        return (
                            <TableRow
                                key={item.id}
                                className={`border-b border-slate-100 transition-colors hover:bg-slate-50/80 ${isSelected ? 'bg-emerald-50/40' : ''}`}
                            >
                                {hasSelection && (
                                    <TableCell className="px-3 py-2 text-center">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => onToggleSelect(item.id)}
                                            aria-label={`Sélectionner ${item.name}`}
                                        />
                                    </TableCell>
                                )}
                                <TableCell className="px-3 py-2">
                                    <div className="font-semibold text-slate-900 truncate text-sm" title={item.name}>{item.name}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                        CIP: {item.cip || item.id}
                                    </div>
                                </TableCell>
                                <TableCell className="px-3 py-2 text-center">
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {item.stock}
                                    </Badge>
                                </TableCell>

                                {activeTab === 'unsold' ? (
                                    <>
                                        <TableCell className="px-3 py-2 font-mono text-xs text-slate-600">
                                            {item.dernier_achat ? new Date(item.dernier_achat).toLocaleDateString(i18n.language) : '-'}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 font-mono text-xs text-slate-600">
                                            {item.derniere_vente ? new Date(item.derniere_vente).toLocaleDateString(i18n.language) : (
                                                <span className="text-red-600 font-semibold">{t('stock:analyse.messages.never_sold')}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-center">
                                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
                                                {item.days_since_sale ?? '-'} {t('stock:analyse.day_short', { defaultValue: 'j' })}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-right font-mono text-xs text-slate-600">
                                            {formatCurrency(Math.round(item.cost_price))}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-right font-semibold text-red-600 text-sm">
                                            {formatCurrency(Math.round(item.value))}
                                        </TableCell>
                                    </>
                                ) : activeTab === 'overstock' ? (
                                    <>
                                        <TableCell className="px-3 py-2 text-center font-mono text-xs text-slate-700">
                                            {Number(item.rotation || 0).toFixed(0)}
                                            <span className="text-[10px] text-slate-400 ml-1">/ {t('stock:analyse.per_month')}</span>
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-center font-semibold text-slate-700 text-sm">
                                            {item.threshold}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-center font-semibold text-red-600 text-sm">
                                            +{item.excess_qty}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-right font-semibold text-red-600 text-sm">
                                            {formatCurrency(Math.round(item.value))}
                                        </TableCell>
                                    </>
                                ) : (
                                    <>
                                        <TableCell className="px-3 py-2 text-center font-mono text-xs text-slate-700">
                                            {item.avg_daily_sales}
                                            <span className="text-[10px] text-slate-400 ml-1">/ {t('stock:analyse.per_day')}</span>
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-center font-semibold text-sm">
                                            <span className={`text-xs ${
                                                (item.days_until_stockout || 0) < 7 ? 'text-red-600' :
                                                (item.days_until_stockout || 0) < 14 ? 'text-amber-600' : 'text-blue-600'
                                            }`}>
                                                {item.days_until_stockout} {t('stock:analyse.days')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-center">
                                            {getUrgencyBadge(item.urgency || '')}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-right font-semibold text-red-600 text-sm">
                                            {formatCurrency(Math.round(item.value))}
                                        </TableCell>
                                    </>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};


