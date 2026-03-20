import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrice, formatCurrency } from '../../../utils/formatters';
import {
    TrendingDown, TrendingUp, Package, LayoutDashboard,
    Calendar, ArrowLeft, AlertTriangle, ChevronUp, ChevronDown
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell
} from 'recharts';
import { useInventaireAudit } from '../../../hooks/inventaire/useInventaireAudit';

interface InventaireAuditProps {
    onBack: () => void;
}

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

    const renderList = (title: string, data: any[], type: 'negative' | 'positive') => {
        const Icon = type === 'negative' ? AlertTriangle : TrendingUp;
        const colorClass = type === 'negative' ? 'text-error' : 'text-success';
        const bgColorClass = type === 'negative' ? 'bg-error/10' : 'bg-success/10';

        return (
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-base-200 bg-base-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-base-content flex items-center gap-3">
                        <div className={`p-2 ${bgColorClass} rounded-xl`}>
                            <Icon className={`h-5 w-5 ${colorClass}`} />
                        </div>
                        {title}
                    </h3>
                </div>
                <div className="p-0 flex-1 overflow-y-auto max-h-[500px]">
                    {!data || data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-12 gap-3 opacity-20">
                            <Package className="h-10 w-10" />
                            <p className="text-sm font-medium">{t('inventaire.analysis.no_data', { defaultValue: 'Aucune donnée' })}</p>
                        </div>
                    ) : (
                        data.map((p, i) => (
                            <div key={i} className="group flex items-center justify-between p-4 border-b border-base-100 hover:bg-base-200/50 transition-colors last:border-0">
                                <div className="flex items-center gap-4">
                                    <div className={`w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center text-xs font-bold text-base-content/40 group-hover:${bgColorClass} group-hover:${colorClass} transition-colors`}>
                                        {i + 1}
                                    </div>
                                    <div className="max-w-[150px] md:max-w-xs">
                                        <div className="font-bold text-sm text-base-content group-hover:text-primary transition-colors truncate">{p.produit_nom}</div>
                                        <div className={`text-[10px] font-bold ${colorClass}/60 uppercase tracking-tight mt-0.5`}>
                                            {p.ecart > 0 ? '+' : ''}{p.ecart} {t('common:units_short', 'unités')}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-mono font-bold ${colorClass}`}>
                                        {p.valeur > 0 ? '+' : ''}{formatPrice(p.valeur)} F
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    // Logic for dynamic sorting
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

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig.key !== column) return null;
        return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
    };

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-base-content/60 font-medium tracking-tight">{t('inventaire.audit.loading')}</p>
            </div>
        );
    }

    if (!data && !loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center">
                <div className="bg-error/10 p-4 rounded-full">
                    <AlertTriangle className="h-12 w-12 text-error" />
                </div>
                <div>
                    <h2 className="text-xl font-black">{t('inventaire.audit.error_title')}</h2>
                    <p className="text-base-content/60 max-w-sm mt-1">
                        {t('inventaire.audit.error_msg')}
                    </p>
                </div>
                <button className="btn btn-primary btn-sm rounded-xl px-8" onClick={() => window.location.reload()}>
                    {t('inventaire.audit.retry')}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onBack}>
                    {t('inventaire.audit.back')}
                </button>
            </div>
        );
    }

    const stats = data?.stats_globales;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button
                        className="btn btn-ghost btn-circle rounded-xl"
                        onClick={onBack}
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-base-content tracking-tight">{t('inventaire.audit.title')}</h1>
                        <p className="text-sm text-base-content/50">{t('inventaire.audit.subtitle')}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-base-100 p-1 rounded-2xl shadow-sm border border-base-300 flex">
                        <button
                            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${groupBy === 'RAYON' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-base-content/40 hover:text-base-content'}`}
                            onClick={() => setGroupBy('RAYON')}
                        >
                            {t('inventaire.audit.filter_by_rayon')}
                        </button>
                        <button
                            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${groupBy === 'GROUPE' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-base-content/40 hover:text-base-content'}`}
                            onClick={() => setGroupBy('GROUPE')}
                        >
                            {t('inventaire.audit.filter_by_groupe')}
                        </button>
                    </div>

                    <div className="bg-base-100 p-1 rounded-2xl shadow-sm border border-base-300 flex">
                        <button
                            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${metric === 'VALEUR' ? 'bg-info text-white shadow-lg shadow-info/20' : 'text-base-content/40 hover:text-base-content'}`}
                            onClick={() => setMetric('VALEUR')}
                        >
                            {t('inventaire.audit.metric_value')}
                        </button>
                        <button
                            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${metric === 'OCCURRENCE' ? 'bg-info text-white shadow-lg shadow-info/20' : 'text-base-content/40 hover:text-base-content'}`}
                            onClick={() => setMetric('OCCURRENCE')}
                        >
                            {t('inventaire.audit.metric_freq')}
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-base-100 p-2 rounded-2xl shadow-sm border border-base-300">
                        <div className="flex items-center gap-2 px-2">
                            <Calendar className="h-4 w-4 text-base-content/40" />
                            <input
                                type="date"
                                className="input input-ghost input-sm focus:bg-transparent"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                            <span className="text-base-content/20">→</span>
                            <input
                                type="date"
                                className="input input-ghost input-sm focus:bg-transparent"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('inventaire.audit.stats.total_loss')}</span>
                        <TrendingDown className="h-4 w-4 text-error" />
                    </div>
                    <div className="text-2xl font-black text-error font-mono">
                        {formatCurrency(Math.abs(stats?.total_perte || 0))}
                    </div>
                </div>

                <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('inventaire.audit.stats.total_gain')}</span>
                        <TrendingUp className="h-4 w-4 text-success" />
                    </div>
                    <div className="text-2xl font-black text-success font-mono">
                        {formatCurrency(Math.abs(stats?.total_gain || 0))}
                    </div>
                </div>

                <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('inventaire.audit.stats.net_result')}</span>
                        <LayoutDashboard className="h-4 w-4 text-primary" />
                    </div>
                    <div className={`text-2xl font-black font-mono ${(stats?.net || 0) < 0 ? 'text-error' : 'text-success'}`}>
                        {formatPrice(stats?.net || 0)} F
                    </div>
                </div>

                <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('inventaire.audit.stats.analyzed_count')}</span>
                        <Package className="h-4 w-4 text-info" />
                    </div>
                    <div className="text-2xl font-black text-info font-mono">
                        {stats?.nombre_inventaires || 0}
                    </div>
                    <div className="text-[10px] text-base-content/30 italic">{t('inventaire.audit.stats.lines_info', { count: stats?.nombre_lignes || 0 })}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chart: Losses by Rayon */}
                <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-6">
                    <h3 className="font-bold text-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-warning" />
                            {metric === 'VALEUR' 
                                ? t('inventaire.audit.chart.title_value', { type: groupBy === 'RAYON' ? 'Rayon' : 'Groupe' }) 
                                : t('inventaire.audit.chart.title_freq', { type: groupBy === 'RAYON' ? 'Rayon' : 'Groupe' })}
                        </div>
                        <span className="text-[10px] font-black opacity-30 uppercase tracking-widest">{metric} / {groupBy}</span>
                    </h3>
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
                                    tickFormatter={(val) => val || 'N/A'}
                                />
                                <Tooltip 
                                    formatter={(value: any) => [
                                        metric === 'VALEUR' ? `${formatPrice(Math.abs(value))} F` : `${value} fois`, 
                                        metric === 'VALEUR' ? t('inventaire.detail.col_gap') : t('inventaire.audit.table.col_occurrences')
                                    ]}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -10px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar 
                                    dataKey={metric === 'VALEUR' ? "total_valeur" : "nombre_lignes"} 
                                    radius={[0, 4, 4, 0]}
                                    animationDuration={1500}
                                >
                                    {(groupBy === 'RAYON' ? data?.par_rayon : data?.par_groupe)?.map((entry: any, index: number) => (
                                        <Cell 
                                            key={`cell-${index}`} 
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
                </div>

                {/* Top Products Table */}
                <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg text-error">{t('inventaire.audit.table.title')}</h3>
                        <div className="badge badge-error badge-outline text-[10px] font-black">{t('inventaire.audit.table.critical_badge')}</div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="table table-xs w-full">
                            <thead className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                <tr className="border-b border-base-200">
                                    <th className="py-3">{t('inventaire.audit.table.col_product')}</th>
                                    <th className="text-right py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('total_quantite')}>
                                        {t('inventaire.audit.table.col_gap_qty')} <SortIcon column="total_quantite" />
                                    </th>
                                    <th className="text-right py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('total_valeur')}>
                                        {t('inventaire.audit.table.col_total_val')} <SortIcon column="total_valeur" />
                                    </th>
                                    <th className="text-center py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('occurrence')}>
                                        {t('inventaire.audit.table.col_occurrences')} <SortIcon column="occurrence" />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="font-medium text-xs">
                                {sortedProducts.slice(0, 10).map((p, idx) => (
                                    <tr key={idx} className="hover:bg-base-200/50 border-b border-base-100 transition-colors">
                                        <td className="max-w-[150px] truncate font-bold flex flex-col py-2">
                                            <span>{p.produit__name}</span>
                                            <span className="text-[10px] font-normal opacity-40">CIP: {p.produit__cip1}</span>
                                        </td>
                                        <td className="text-right text-error font-mono">{p.total_quantite > 0 ? `+${p.total_quantite}` : p.total_quantite}</td>
                                        <td className="text-right font-black text-error font-mono">{formatPrice(Math.abs(p.total_valeur))} F</td>
                                        <td className="text-center">
                                            <div className={`badge badge-sm rounded-full ${p.occurrence > 5 ? 'badge-error text-white' : 'badge-ghost opacity-60'}`}>
                                                {p.occurrence}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {(!data?.top_pertes || data.top_pertes.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12">
                                            <div className="flex flex-col items-center opacity-30 gap-2">
                                                <Package className="h-12 w-12" />
                                                <p className="text-sm font-bold uppercase tracking-widest">{t('inventaire.audit.table.empty')}</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
