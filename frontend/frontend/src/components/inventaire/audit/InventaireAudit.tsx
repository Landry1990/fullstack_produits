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

// Module-level component to avoid recreation on every render
const SortIcon = ({ column, sortConfig }: { column: string; sortConfig: { key: string; direction: 'asc' | 'desc' } }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
};

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
        const colorClass = type === 'negative' ? 'text-red-500' : 'text-emerald-600';
        const bgColorClass = type === 'negative' ? 'bg-red-50' : 'bg-emerald-50';

        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-700 flex items-center gap-3">
                        <div className={`p-2 ${bgColorClass} rounded-xl`}>
                            <Icon className={`h-5 w-5 ${colorClass}`} />
                        </div>
                        {title}
                    </h3>
                </div>
                <div className="p-0 flex-1 overflow-y-auto max-h-[500px]">
                    {!data || data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-12 gap-3 text-slate-200">
                            <Package className="h-10 w-10" />
                            <p className="text-sm font-medium text-slate-400">{t('inventaire.analysis.no_data', { defaultValue: 'Aucune donnée' })}</p>
                        </div>
                    ) : (
                        data.map((p, i) => (
                            <div key={i} className="group flex items-center justify-between p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0">
                                <div className="flex items-center gap-4">
                                    <div className={`size-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400`}>
                                        {i + 1}
                                    </div>
                                    <div className="max-w-[150px] md:max-w-xs">
                                        <div className="font-bold text-sm text-slate-700 group-hover:text-emerald-600 transition-colors truncate">{p.produit_nom}</div>
                                        <div className={`text-[10px] font-bold uppercase tracking-tight mt-0.5 ${colorClass}`}>
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

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="animate-spin rounded-full size-12 border-b-2 border-emerald-500"></div>
                <p className="text-slate-500 font-medium tracking-tight">{t('inventaire.audit.loading')}</p>
            </div>
        );
    }

    if (!data && !loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center">
                <div className="bg-red-50 p-4 rounded-full">
                    <AlertTriangle className="h-12 w-12 text-red-500" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-800">{t('inventaire.audit.error_title')}</h2>
                    <p className="text-slate-500 max-w-sm mt-1">
                        {t('inventaire.audit.error_msg')}
                    </p>
                </div>
                <button className="inline-flex items-center justify-center h-9 px-8 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors" onClick={() => window.location.reload()}>
                    {t('inventaire.audit.retry')}
                </button>
                <button className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors" onClick={onBack}>
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
                        className="inline-flex items-center justify-center size-9 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                        onClick={onBack}
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">{t('inventaire.audit.title')}</h1>
                        <p className="text-sm text-slate-400">{t('inventaire.audit.subtitle')}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-200 flex">
                        <button
                            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${groupBy === 'RAYON' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'text-slate-400 hover:text-slate-700'}`}
                            onClick={() => setGroupBy('RAYON')}
                        >
                            {t('inventaire.audit.filter_by_rayon')}
                        </button>
                        <button
                            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${groupBy === 'GROUPE' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'text-slate-400 hover:text-slate-700'}`}
                            onClick={() => setGroupBy('GROUPE')}
                        >
                            {t('inventaire.audit.filter_by_groupe')}
                        </button>
                    </div>

                    <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-200 flex">
                        <button
                            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${metric === 'VALEUR' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:text-slate-700'}`}
                            onClick={() => setMetric('VALEUR')}
                        >
                            {t('inventaire.audit.metric_value')}
                        </button>
                        <button
                            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${metric === 'OCCURRENCE' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:text-slate-700'}`}
                            onClick={() => setMetric('OCCURRENCE')}
                        >
                            {t('inventaire.audit.metric_freq')}
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 px-2">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <input
                                type="date"
                                className="h-8 bg-transparent text-sm text-slate-700 outline-none"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                            <span className="text-slate-300">→</span>
                            <input
                                type="date"
                                className="h-8 bg-transparent text-sm text-slate-700 outline-none"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('inventaire.audit.stats.total_loss')}</span>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="text-2xl font-black text-red-500 font-mono">
                        {formatCurrency(Math.abs(stats?.total_perte || 0))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('inventaire.audit.stats.total_gain')}</span>
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-black text-emerald-600 font-mono">
                        {formatCurrency(Math.abs(stats?.total_gain || 0))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('inventaire.audit.stats.net_result')}</span>
                        <LayoutDashboard className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className={`text-2xl font-black font-mono ${(stats?.net || 0) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {formatPrice(stats?.net || 0)} F
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('inventaire.audit.stats.analyzed_count')}</span>
                        <Package className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-black text-blue-600 font-mono">
                        {stats?.nombre_inventaires || 0}
                    </div>
                    <div className="text-[10px] text-slate-300 italic">{t('inventaire.audit.stats.lines_info', { count: stats?.nombre_lignes || 0 })}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chart: Losses by Rayon */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-6">
                    <h3 className="font-bold text-lg flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-700">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            {metric === 'VALEUR'
                                ? t('inventaire.audit.chart.title_value', { type: groupBy === 'RAYON' ? 'Rayon' : 'Groupe' })
                                : t('inventaire.audit.chart.title_freq', { type: groupBy === 'RAYON' ? 'Rayon' : 'Groupe' })}
                        </div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{metric} / {groupBy}</span>
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
                                    tickFormatter={(val: string) => val || 'N/A'}
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
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg text-red-500">{t('inventaire.audit.table.title')}</h3>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border border-red-200 text-red-500 bg-red-50">{t('inventaire.audit.table.critical_badge')}</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <tr className="border-b border-slate-100">
                                    <th className="py-3 text-left font-black">{t('inventaire.audit.table.col_product')}</th>
                                    <th className="text-right py-3 cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('total_quantite')}>
                                        {t('inventaire.audit.table.col_gap_qty')} <SortIcon column="total_quantite" sortConfig={sortConfig} />
                                    </th>
                                    <th className="text-right py-3 cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('total_valeur')}>
                                        {t('inventaire.audit.table.col_total_val')} <SortIcon column="total_valeur" sortConfig={sortConfig} />
                                    </th>
                                    <th className="text-center py-3 cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('occurrence')}>
                                        {t('inventaire.audit.table.col_occurrences')} <SortIcon column="occurrence" sortConfig={sortConfig} />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="font-medium">
                                {sortedProducts.slice(0, 10).map((p, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 border-b border-slate-50 transition-colors">
                                        <td className="max-w-[150px] truncate font-bold py-2">
                                            <div className="flex flex-col">
                                                <span className="text-slate-700">{p.produit__name}</span>
                                                <span className="text-[10px] font-normal text-slate-400">CIP: {p.produit__cip1}</span>
                                            </div>
                                        </td>
                                        <td className="text-right text-red-500 font-mono">{p.total_quantite > 0 ? `+${p.total_quantite}` : p.total_quantite}</td>
                                        <td className="text-right font-black text-red-500 font-mono">{formatPrice(Math.abs(p.total_valeur))} F</td>
                                        <td className="text-center">
                                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold ${p.occurrence > 5 ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-slate-100 text-slate-400'}`}>
                                                {p.occurrence}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {(!data?.top_pertes || data.top_pertes.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12">
                                            <div className="flex flex-col items-center text-slate-200 gap-2">
                                                <Package className="h-12 w-12" />
                                                <p className="text-sm font-bold uppercase tracking-widest text-slate-400">{t('inventaire.audit.table.empty')}</p>
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
