import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../../utils/formatters';
import {
    TrendingDown, TrendingUp, Package, LayoutDashboard,
    Calendar, ArrowLeft, AlertTriangle, ChevronUp, ChevronDown
} from 'lucide-react';
import { useRecharts } from '../../../hooks/useRecharts';
import { useInventaireAudit } from '../../../hooks/inventaire/useInventaireAudit';
import { LocalizedDateInput } from '../../LocalizedDateInput';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { Button } from '../../shadcn/button';
import { Badge } from '../../shadcn/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../shadcn/card';
import { Tabs, TabsList, TabsTrigger } from '../../shadcn/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../shadcn/table';

interface InventaireAuditProps {
    onBack: () => void;
}

interface AuditChartDatum {
    produit__rayon__name?: string;
    produit__groupe__name?: string;
    total_valeur: number;
    nombre_lignes: number;
}

// Module-level component to avoid recreation on every render
const SortIcon = ({ column, sortConfig }: { column: string; sortConfig: { key: string; direction: 'asc' | 'desc' } }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
};

const STAT_LABEL_CLASS = 'text-xs font-semibold uppercase tracking-wider text-slate-400';

export const InventaireAudit: React.FC<InventaireAuditProps> = ({ onBack }) => {
    const { t } = useTranslation(['stock', 'common']);

    const {
        data, loading,
        startDate, setStartDate,
        endDate, setEndDate
    } = useInventaireAudit();

    const [sortConfig, setSortConfig] = React.useState<{ key: string, direction: 'asc' | 'desc' }>({
        key: 'total_valeur',
        direction: 'asc' // Car les pertes sont négatives, on veut les plus petites d'abord
    });
    const [groupBy, setGroupBy] = React.useState<'RAYON' | 'GROUPE'>('RAYON');
    const [metric, setMetric] = React.useState<'VALEUR' | 'OCCURRENCE'>('VALEUR');

    // Logic for dynamic sorting (must be before any early return to respect hooks rules)
    const sortedProducts = React.useMemo(() => {
        if (!data?.top_pertes) return [];

        const products = [...data.top_pertes];
        return products.sort((a, b) => {
            const key = sortConfig.key as keyof typeof a;
            const aValue = Number(a[key] || 0);
            const bValue = Number(b[key] || 0);

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [data?.top_pertes, sortConfig]);

    const Recharts = useRecharts();
    if (!Recharts) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } = Recharts;

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    if (loading && !data) {
        return (
            <div className="min-h-[400px] p-4 space-y-4">
                <Skeleton className="h-6 w-56" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!data && !loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
                <div className="bg-red-50 p-4 rounded-full">
                    <AlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">{t('inventaire.audit.error_title')}</h2>
                    <p className="text-sm text-slate-500 max-w-sm mt-1">
                        {t('inventaire.audit.error_msg')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => window.location.reload()}>
                        {t('inventaire.audit.retry')}
                    </Button>
                    <Button variant="ghost" onClick={onBack}>
                        {t('inventaire.audit.back')}
                    </Button>
                </div>
            </div>
        );
    }

    const stats = data?.stats_globales;

    return (
        <div className="space-y-3 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={onBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-base font-bold text-slate-800 tracking-tight">{t('inventaire.audit.title')}</h1>
                        <p className="text-xs text-slate-400">{t('inventaire.audit.subtitle')}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as 'RAYON' | 'GROUPE')}>
                        <TabsList className="h-8 bg-white border border-slate-200">
                            <TabsTrigger value="RAYON" className="text-xs h-6 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                                {t('inventaire.audit.filter_by_rayon')}
                            </TabsTrigger>
                            <TabsTrigger value="GROUPE" className="text-xs h-6 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                                {t('inventaire.audit.filter_by_groupe')}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <Tabs value={metric} onValueChange={(v) => setMetric(v as 'VALEUR' | 'OCCURRENCE')}>
                        <TabsList className="h-8 bg-white border border-slate-200">
                            <TabsTrigger value="VALEUR" className="text-xs h-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                                {t('inventaire.audit.metric_value')}
                            </TabsTrigger>
                            <TabsTrigger value="OCCURRENCE" className="text-xs h-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                                {t('inventaire.audit.metric_freq')}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex items-center gap-2 bg-white px-2 rounded-lg border border-slate-200 h-8">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <LocalizedDateInput
                            className="h-6 bg-transparent text-sm text-slate-700 outline-none"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            aria-label={t('common:from')}
                        />
                        <span className="text-slate-300">→</span>
                        <LocalizedDateInput
                            className="h-6 bg-transparent text-sm text-slate-700 outline-none"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            aria-label={t('common:to')}
                        />
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Card className="rounded-lg p-3">
                    <div className="flex items-center justify-between">
                        <span className={STAT_LABEL_CLASS}>{t('inventaire.audit.stats.total_loss')}</span>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="text-lg font-bold text-red-500 font-mono">
                        {formatCurrency(Math.abs(stats?.total_perte || 0))}
                    </div>
                </Card>

                <Card className="rounded-lg p-3">
                    <div className="flex items-center justify-between">
                        <span className={STAT_LABEL_CLASS}>{t('inventaire.audit.stats.total_gain')}</span>
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-lg font-bold text-emerald-600 font-mono">
                        {formatCurrency(Math.abs(stats?.total_gain || 0))}
                    </div>
                </Card>

                <Card className="rounded-lg p-3">
                    <div className="flex items-center justify-between">
                        <span className={STAT_LABEL_CLASS}>{t('inventaire.audit.stats.net_result')}</span>
                        <LayoutDashboard className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className={`text-lg font-bold font-mono ${(stats?.net || 0) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {formatCurrency(stats?.net || 0)}
                    </div>
                </Card>

                <Card className="rounded-lg p-3">
                    <div className="flex items-center justify-between">
                        <span className={STAT_LABEL_CLASS}>{t('inventaire.audit.stats.analyzed_count')}</span>
                        <Package className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-lg font-bold text-blue-600 font-mono">
                        {stats?.nombre_inventaires || 0}
                    </div>
                    <div className="text-xs text-slate-400 italic">{t('inventaire.audit.stats.lines_info', { count: stats?.nombre_lignes || 0 })}</div>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Chart: Losses by Rayon */}
                <Card className="rounded-lg">
                    <CardHeader className="p-3 pb-0 flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            {metric === 'VALEUR'
                                ? t('inventaire.audit.chart.title_value', { type: groupBy === 'RAYON' ? t('common:rayon') : t('common:groupe') })
                                : t('inventaire.audit.chart.title_freq', { type: groupBy === 'RAYON' ? t('common:rayon') : t('common:groupe') })}
                        </CardTitle>
                        <Badge variant="outline" className="uppercase">{metric} / {groupBy}</Badge>
                    </CardHeader>
                    <CardContent className="p-3">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={groupBy === 'RAYON' ? data?.par_rayon.slice(0, 10) : data?.par_groupe.slice(0, 10)}
                                    layout="vertical"
                                    margin={{ left: 40, right: 40 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey={groupBy === 'RAYON' ? "produit__rayon__name" : "produit__groupe__name"}
                                        type="category"
                                        tick={{ fontSize: 10, fontWeight: 'bold' }}
                                        width={120}
                                        tickFormatter={(val: string) => val || t('common:not_available')}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => [
                                            metric === 'VALEUR' ? formatCurrency(Math.abs(value)) : `${value} ${t('common:times')}`,
                                            metric === 'VALEUR' ? t('inventaire.detail.col_gap') : t('inventaire.audit.table.col_occurrences')
                                        ]}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -10px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar
                                        dataKey={metric === 'VALEUR' ? "total_valeur" : "nombre_lignes"}
                                        radius={[0, 4, 4, 0]}
                                        animationDuration={1500}
                                    >
                                        {(groupBy === 'RAYON' ? data?.par_rayon : data?.par_groupe)?.map((entry: AuditChartDatum) => (
                                            <Cell
                                                key={`cell-${groupBy}-${entry.produit__rayon__name ?? entry.produit__groupe__name}`}
                                                fill={metric === 'VALEUR'
                                                    ? (entry.total_valeur < 0 ? '#ff5252' : '#4caf50')
                                                    : '#2196f3'
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Top Products Table */}
                <Card className="rounded-lg">
                    <CardHeader className="p-3 pb-0 flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm text-red-500">{t('inventaire.audit.table.title')}</CardTitle>
                        <Badge variant="destructive">{t('inventaire.audit.table.critical_badge')}</Badge>
                    </CardHeader>
                    <CardContent className="p-3">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="h-8 px-2">{t('inventaire.audit.table.col_product')}</TableHead>
                                    <TableHead className="h-8 px-2 text-right cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('total_quantite')}>
                                        {t('inventaire.audit.table.col_gap_qty')} <SortIcon column="total_quantite" sortConfig={sortConfig} />
                                    </TableHead>
                                    <TableHead className="h-8 px-2 text-right cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('total_valeur')}>
                                        {t('inventaire.audit.table.col_total_val')} <SortIcon column="total_valeur" sortConfig={sortConfig} />
                                    </TableHead>
                                    <TableHead className="h-8 px-2 text-center cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('occurrence')}>
                                        {t('inventaire.audit.table.col_occurrences')} <SortIcon column="occurrence" sortConfig={sortConfig} />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedProducts.slice(0, 10).map((p) => (
                                    <TableRow key={p.produit__cip1 || p.produit__name}>
                                        <TableCell className="px-2 py-1.5 max-w-[150px]">
                                            <div className="flex flex-col">
                                                <span className="text-slate-700 font-medium truncate">{p.produit__name}</span>
                                                <span className="text-xs font-normal text-slate-400">{t('common:cip')}: {p.produit__cip1}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-2 py-1.5 text-right text-red-500 font-mono">{p.total_quantite > 0 ? `+${p.total_quantite}` : p.total_quantite}</TableCell>
                                        <TableCell className="px-2 py-1.5 text-right font-bold text-red-500 font-mono">{formatCurrency(Math.abs(p.total_valeur))}</TableCell>
                                        <TableCell className="px-2 py-1.5 text-center">
                                            <Badge variant={p.occurrence > 5 ? 'destructive' : 'outline'} className="justify-center">
                                                {p.occurrence}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!data?.top_pertes || data.top_pertes.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-6">
                                            <EmptyState
                                                compact
                                                icon={<Package className="size-6" />}
                                                title={t('inventaire.audit.table.empty')}
                                            />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
