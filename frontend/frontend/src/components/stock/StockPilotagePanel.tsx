import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ShoppingCart, CalendarClock, PackageX, FileSpreadsheet,
    RefreshCw, AlertTriangle, Flame, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useStockPilotage } from '../../hooks/useStockPilotage';
import type { PilotageOrderItem } from '../../hooks/useStockPilotage';
import { usePharmacySettings } from '../../hooks/usePharmacySettings';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';
import { exportToExcel } from '../../utils/excelExport';
import { Badge } from '../shadcn/badge';
import { Button } from '../shadcn/button';
import { Checkbox } from '../shadcn/checkbox';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';

type Section = 'commander' | 'bientot' | 'ne_pas_commander';

const TOP_N = 10;

const URGENCE_STYLE: Record<PilotageOrderItem['urgence'], string> = {
    rupture: 'text-red-700 bg-red-50 border border-red-200',
    critique: 'text-amber-700 bg-amber-50 border border-amber-200',
    alerte: 'text-slate-600 bg-slate-50 border border-slate-200',
};

const URGENCE_ICON: Record<PilotageOrderItem['urgence'], React.ComponentType<{ className?: string }>> = {
    rupture: Flame,
    critique: AlertTriangle,
    alerte: CalendarClock,
};

const StockPilotagePanel: React.FC = () => {
    const { t } = useTranslation(['stock', 'common']);
    const { data, loading, error, refresh } = useStockPilotage(30);
    const { settings } = usePharmacySettings();
    const navigate = useNavigate();
    const [section, setSection] = useState<Section>('commander');
    const [expanded, setExpanded] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());

    const orderItems = useMemo(() => {
        if (!data) return [];
        return section === 'commander' ? data.commander : data.bientot;
    }, [data, section]);

    const noOrderItems = useMemo(() => data?.ne_pas_commander ?? [], [data]);
    const isOrderSection = section !== 'ne_pas_commander';
    const visibleItems = expanded ? orderItems : orderItems.slice(0, TOP_N);
    const visibleNoOrder = expanded ? noOrderItems : noOrderItems.slice(0, TOP_N);

    const switchSection = (s: Section) => {
        setSection(s);
        setExpanded(false);
    };

    const toggleSelect = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allSelected = isOrderSection && orderItems.length > 0 &&
        orderItems.every(i => selected.has(i.produit_id));
    const someSelected = isOrderSection && orderItems.some(i => selected.has(i.produit_id));

    const toggleSelectAll = () => {
        setSelected(prev => {
            const next = new Set(prev);
            if (allSelected) orderItems.forEach(i => next.delete(i.produit_id));
            else orderItems.forEach(i => next.add(i.produit_id));
            return next;
        });
    };

    const allOrderItems = useMemo(
        () => data ? [...data.commander, ...data.bientot] : [],
        [data]
    );
    const selectedProducts = useMemo(
        () => allOrderItems.filter(i => selected.has(i.produit_id)),
        [allOrderItems, selected]
    );

    const handleCreateOrder = () => {
        if (selectedProducts.length === 0) return;
        navigate('/app/commandes/locales', {
            state: {
                createFromStockAlert: {
                    products: selectedProducts.map(i => ({
                        id: i.produit_id,
                        name: i.produit_nom,
                        stock: i.stock,
                        quantity: i.quantite_suggeree,
                        price: i.prix_achat,
                        fournisseur_id: i.fournisseur_id,
                        avg_daily_sales: i.vmd,
                    })),
                },
            },
        });
    };

    const handleExport = () => {
        if (!data) return;
        const dateStr = new Date().toISOString().slice(0, 10);
        let records: Record<string, string | number>[] = [];
        if (isOrderSection) {
            records = orderItems.map(i => ({
                [t('stock:pilotage.columns.product')]: i.produit_nom,
                CIP: i.produit_ref || '-',
                [t('stock:pilotage.columns.stock')]: i.stock,
                [t('stock:pilotage.columns.rotation_mois')]: i.rotation_mois ?? '-',
                [t('stock:pilotage.columns.stock_min')]: i.stock_minimum ?? '-',
                [t('stock:pilotage.columns.stock_max')]: i.stock_maximum ?? '-',
                [t('stock:pilotage.columns.coverage')]: i.couverture_jours,
                [t('stock:pilotage.columns.urgency')]: t(`stock:pilotage.urgence.${i.urgence}`),
                [t('stock:pilotage.columns.qty')]: i.quantite_suggeree,
                [t('stock:pilotage.columns.amount')]: i.montant_ht,
                [t('stock:pilotage.columns.order_by')]: formatDate(i.date_limite),
            }));
        } else {
            records = noOrderItems.map(i => ({
                [t('stock:pilotage.columns.product')]: i.produit_nom,
                CIP: i.produit_ref || '-',
                [t('stock:pilotage.columns.supplier')]: i.fournisseur_nom,
                [t('stock:pilotage.columns.stock')]: i.stock,
                [t('stock:pilotage.columns.value')]: i.valeur_stock,
                [t('stock:pilotage.columns.no_sale_since')]: i.jours_sans_vente,
                [t('stock:pilotage.columns.reason')]: i.en_rupture
                    ? t('stock:pilotage.dormant_reason_rupture')
                    : t('stock:pilotage.dormant_reason_stock'),
            }));
        }
        exportToExcel(records, settings, {
            filename: `pilotage_${section}_${dateStr}.xlsx`,
            title: `${t('stock:pilotage.title')} — ${t(`stock:pilotage.tabs.${section}`)}`,
            sheetName: section,
        });
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="h-5 w-56 bg-slate-100 rounded animate-pulse" />
                <div className="h-9 w-full bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-48 w-full bg-slate-50 rounded-xl animate-pulse" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <ErrorState error={error} onRetry={refresh} retrying={loading} />
            </div>
        );
    }

    const tabs: { key: Section; icon: React.ComponentType<{ className?: string }>; count: number; amount: number }[] = [
        { key: 'commander', icon: ShoppingCart, count: data.summary.commander_count, amount: data.summary.commander_montant_ht },
        { key: 'bientot', icon: CalendarClock, count: data.summary.bientot_count, amount: data.summary.bientot_montant_ht },
        { key: 'ne_pas_commander', icon: PackageX, count: data.summary.ne_pas_commander_count, amount: data.summary.ne_pas_commander_valeur },
    ];

    const activeCount = isOrderSection ? orderItems.length : noOrderItems.length;
    const hiddenCount = Math.max(0, activeCount - TOP_N);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* En-tête */}
            <div className="px-4 pt-3 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <p className="text-xs font-semibold text-slate-800">{t('stock:pilotage.title')}</p>
                    <p className="text-caption text-slate-400">
                        {t('stock:pilotage.subtitle', { days: data.periode })}
                        {data.jours_donnees !== undefined && data.jours_donnees < 90 && (
                            <span className="ml-1.5 text-amber-600 font-medium">
                                · {t('stock:pilotage.data_age', { days: data.jours_donnees })}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {selected.size > 0 && (
                        <Button size="sm" onClick={handleCreateOrder} className="h-8 text-xs gap-1.5">
                            <ShoppingCart className="size-3.5" />
                            {t('stock:pilotage.create_order', { count: selected.size })}
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleExport} className="h-8 text-xs gap-1.5">
                        <FileSpreadsheet className="size-3.5 text-emerald-600" />
                        {t('stock:pilotage.export_excel')}
                    </Button>
                    <button
                        onClick={refresh}
                        aria-label={t('common:refresh')}
                        className="inline-flex items-center justify-center rounded-full size-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                    >
                        <RefreshCw className="size-4" />
                    </button>
                </div>
            </div>

            {/* Onglets — largeur fixe égale : aucun redimensionnement au changement */}
            <div className="px-4 pb-2 grid grid-cols-3 gap-1.5">
                {tabs.map(({ key, icon: Icon, count, amount }) => (
                    <button
                        key={key}
                        onClick={() => switchSection(key)}
                        className={`inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-w-0 ${
                            section === key
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        <Icon className="size-3.5 shrink-0" />
                        <span className="truncate">{t(`stock:pilotage.tabs.${key}`)}</span>
                        <Badge
                            variant="secondary"
                            className={`text-caption px-1.5 py-0 shrink-0 ${section === key ? 'bg-white/20 text-white' : ''}`}
                        >
                            {count}
                        </Badge>
                        {amount > 0 && (
                            <span className={`text-caption truncate hidden xl:inline ${section === key ? 'text-emerald-100' : 'text-slate-400'}`}>
                                {formatCurrency(Math.round(amount))}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tableaux */}
            {isOrderSection ? (
                orderItems.length === 0 ? (
                    <EmptyState
                        compact
                        title={section === 'commander'
                            ? t('stock:pilotage.empty_commander')
                            : t('stock:pilotage.empty_bientot', { days: data.periode })}
                        className="p-4"
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-y border-slate-100 bg-slate-50/50">
                                    <th scope="col" className="w-8 px-3 py-2">
                                        <Checkbox
                                            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label={t('stock:pilotage.select_all')}
                                        />
                                    </th>
                                    <th scope="col" className="text-left px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500">{t('stock:pilotage.columns.product')}</th>
                                    <th scope="col" className="text-left px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">{t('stock:pilotage.columns.cip')}</th>
                                    <th scope="col" className="text-right px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500">{t('stock:pilotage.columns.stock')}</th>
                                    <th scope="col" className="text-right px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">{t('stock:pilotage.columns.rotation_mois')}</th>
                                    <th scope="col" className="text-right px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">{t('stock:pilotage.columns.stock_min')}</th>
                                    <th scope="col" className="text-right px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">{t('stock:pilotage.columns.stock_max')}</th>
                                    <th scope="col" className="text-right px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500">{t('stock:pilotage.columns.coverage')}</th>
                                    <th scope="col" className="text-center px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500">{t('stock:pilotage.columns.urgency')}</th>
                                    <th scope="col" className="text-right px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500">
                                        {section === 'commander' ? t('stock:pilotage.columns.stockout_date') : t('stock:pilotage.columns.order_by')}
                                    </th>
                                    <th scope="col" className="text-right px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500">{t('stock:pilotage.columns.qty')}</th>
                                    <th scope="col" className="text-right px-4 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500">{t('stock:pilotage.columns.amount')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {visibleItems.map((item) => {
                                    const UrgenceIcon = URGENCE_ICON[item.urgence];
                                    return (
                                        <tr key={item.produit_id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-3 py-2.5">
                                                <Checkbox
                                                    checked={selected.has(item.produit_id)}
                                                    onCheckedChange={() => toggleSelect(item.produit_id)}
                                                    aria-label={item.produit_nom}
                                                />
                                            </td>
                                            <td className="px-3 py-2.5 min-w-0">
                                                <div className="text-sm font-medium text-slate-800 leading-tight truncate max-w-[280px]">{item.produit_nom}</div>
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-slate-500 font-mono hidden md:table-cell whitespace-nowrap">{item.produit_ref || '—'}</td>
                                            <td className="px-3 py-2.5 text-right text-sm text-slate-700 tabular-nums">{item.stock}</td>
                                            <td className="px-3 py-2.5 text-right text-sm text-slate-600 tabular-nums hidden lg:table-cell">{item.rotation_mois ?? '—'}</td>
                                            <td className="px-3 py-2.5 text-right text-sm text-amber-700 font-semibold tabular-nums hidden lg:table-cell">{item.stock_minimum ?? '—'}</td>
                                            <td className="px-3 py-2.5 text-right text-sm text-emerald-700 font-semibold tabular-nums hidden lg:table-cell">{item.stock_maximum ?? '—'}</td>
                                            <td className="px-3 py-2.5 text-right text-sm text-slate-700 tabular-nums">
                                                {t('stock:pilotage.coverage_days', { count: item.couverture_jours })}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex items-center gap-1 text-caption font-semibold px-2 py-0.5 rounded-full ${URGENCE_STYLE[item.urgence]}`}>
                                                    <UrgenceIcon className="size-3" />
                                                    {t(`stock:pilotage.urgence.${item.urgence}`)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-xs text-slate-600 whitespace-nowrap">
                                                {section === 'commander'
                                                    ? formatDate(item.date_rupture)
                                                    : formatDate(item.date_limite)}
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className="text-sm font-bold text-emerald-700 tabular-nums">{item.quantite_suggeree}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-sm text-slate-700 tabular-nums whitespace-nowrap">
                                                {formatCurrency(Math.round(item.montant_ht))}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            ) : (
                noOrderItems.length === 0 ? (
                    <EmptyState compact title={t('stock:pilotage.empty_no_order')} className="p-4" />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-y border-slate-100 bg-slate-50/50">
                                    <th scope="col" className="text-left px-4 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500">{t('stock:pilotage.columns.product')}</th>
                                    <th scope="col" className="text-left px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">{t('stock:pilotage.columns.supplier')}</th>
                                    <th scope="col" className="text-right px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500">{t('stock:pilotage.columns.stock')}</th>
                                    <th scope="col" className="text-right px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500">{t('stock:pilotage.columns.value')}</th>
                                    <th scope="col" className="text-right px-3 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500">{t('stock:pilotage.columns.no_sale_since')}</th>
                                    <th scope="col" className="text-left px-4 py-2 text-caption font-semibold uppercase tracking-wider text-slate-500">{t('stock:pilotage.columns.reason')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {visibleNoOrder.map((item) => (
                                    <tr key={item.produit_id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-4 py-2.5 min-w-0">
                                            <div className="text-sm font-medium text-slate-800 leading-tight truncate max-w-[280px]">{item.produit_nom}</div>
                                            <div className="text-caption text-slate-400 font-mono mt-0.5">{item.produit_ref || '—'}</div>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-slate-500 hidden lg:table-cell truncate max-w-[140px]">{item.fournisseur_nom}</td>
                                        <td className="px-3 py-2.5 text-right text-sm text-slate-700 tabular-nums">{item.stock}</td>
                                        <td className="px-3 py-2.5 text-right text-sm text-slate-700 tabular-nums whitespace-nowrap">
                                            {item.valeur_stock > 0 ? formatCurrency(Math.round(item.valeur_stock)) : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-sm text-slate-600 tabular-nums whitespace-nowrap">
                                            {t('stock:pilotage.no_sale_days', { count: item.jours_sans_vente })}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-flex items-center gap-1 text-caption font-semibold px-2 py-0.5 rounded-full ${
                                                item.en_rupture
                                                    ? 'text-amber-700 bg-amber-50 border border-amber-200'
                                                    : 'text-slate-600 bg-slate-100 border border-slate-200'
                                            }`}>
                                                {item.en_rupture
                                                    ? t('stock:pilotage.dormant_reason_rupture')
                                                    : t('stock:pilotage.dormant_reason_stock')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {/* Voir tout / réduire */}
            {hiddenCount > 0 && (
                <div className="px-4 py-2 border-t border-slate-100 text-center">
                    <button
                        onClick={() => setExpanded(v => !v)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                    >
                        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        {expanded
                            ? t('stock:pilotage.see_less')
                            : t('stock:pilotage.see_all', { count: activeCount })}
                    </button>
                </div>
            )}
        </div>
    );
};

export default StockPilotagePanel;
