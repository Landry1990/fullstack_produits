import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Trophy, TrendingUp, TrendingDown, ShoppingCart,
    Target, Clock, Star, Package, BarChart2, Zap,
    Medal, RefreshCw
} from 'lucide-react';
import { useRecharts } from '../../hooks/useRecharts';
import { useVendeurStats } from '../../hooks/useDashboard';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

function RangBadge({ rang, total }: { rang: number | null; total: number }) {
    if (rang === null) return <span className="text-slate-400 text-xs font-bold">—</span>;
    const medal = rang === 1 ? '🥇' : rang === 2 ? '🥈' : rang === 3 ? '🥉' : null;
    return (
        <div className="flex items-center gap-1.5">
            {medal && <span className="text-xl">{medal}</span>}
            <div>
                <span className={`text-2xl font-black ${rang <= 3 ? 'text-amber-500' : 'text-slate-700'}`}>
                    #{rang}
                </span>
                <span className="text-xs text-slate-400 font-medium ml-1">/ {total}</span>
            </div>
        </div>
    );
}

function ProgressBar({ value, color = 'bg-indigo-500' }: { value: number; color?: string }) {
    const clamped = Math.min(value, 100);
    const overflow = value > 100;
    return (
        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-700 ${overflow ? 'bg-emerald-500' : color}`}
                style={{ width: `${clamped}%` }}
            />
        </div>
    );
}

const SPARKLINE_COLORS = ['#818cf8', '#818cf8', '#818cf8', '#818cf8', '#818cf8', '#818cf8', '#6366f1'];

export default function DashboardVendeur({ formatCurrencyLocal }: { formatCurrencyLocal: (v: number) => string }) {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const dateLocale = i18n.language?.startsWith('en') ? enUS : fr;
    const { data, isLoading, refetch, dataUpdatedAt } = useVendeurStats();
    const lastRefresh = useMemo(() => {
        if (!dataUpdatedAt) return null;
        return formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: dateLocale });
    }, [dataUpdatedAt, dateLocale]);

    const Recharts = useRecharts();
    if (!Recharts) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" /></div>;
    const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } = Recharts;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="loading loading-spinner loading-lg text-indigo-500" />
                <span className="mt-3 text-xs font-black uppercase tracking-widest text-slate-300">{t('vendeur.loading')}</span>
            </div>
        );
    }

    if (!data) return null;

    const progressColor = data.progression_perso >= 100
        ? 'bg-emerald-500'
        : data.progression_perso >= 70
            ? 'bg-amber-400'
            : 'bg-indigo-500';

    const maxSparkCA = Math.max(...data.sparkline.map(d => d.ca), 1);

    return (
        <div className="space-y-5">

            {/* ── Header vendeur ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="size-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
                        {data.vendeur[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('vendeur.my_dashboard')}</p>
                        <p className="text-lg font-black text-slate-800 leading-tight">{data.vendeur}</p>
                    </div>
                </div>
                <button
                    onClick={() => refetch()}
                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    title={t('vendeur.refresh')}
                >
                    <RefreshCw className="size-4" />
                </button>
            </div>

            {/* ── Objectif du jour ─────────────────────────────────────────── */}
            {data.objectif_jour_perso > 0 && (
                <div className={`rounded-2xl p-4 border ${data.progression_perso >= 100 ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Target className={`size-4 ${data.progression_perso >= 100 ? 'text-emerald-600' : 'text-indigo-500'}`} />
                            <span className="text-xs font-black uppercase text-slate-500 tracking-widest">{t('vendeur.daily_target')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                                data.progression_perso >= 100
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : data.progression_perso >= 70
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-indigo-50 text-indigo-600'
                            }`}>
                                {data.progression_perso >= 100 ? t('vendeur.achieved') : `${data.progression_perso.toFixed(0)}%`}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-end justify-between mb-2">
                        <div>
                            <p className="text-2xl font-black text-slate-800">{formatCurrencyLocal(data.ca_jour)}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{t('vendeur.on_estimated', { value: formatCurrencyLocal(data.objectif_jour_perso) })}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400">{t('vendeur.sales_count', { count: data.nb_jour })}</p>
                            {data.panier_jour > 0 && (
                                <p className="text-[10px] text-slate-300">moy. {formatCurrencyLocal(data.panier_jour)}</p>
                            )}
                        </div>
                    </div>
                    <ProgressBar value={data.progression_perso} color={progressColor} />
                </div>
            )}

            {/* ── KPI Cards ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    {
                        label: t('vendeur.this_week'),
                        value: formatCurrencyLocal(data.ca_sem),
                        sub: t('vendeur.sales_count', { count: data.nb_sem }),
                        icon: TrendingUp,
                        color: 'text-sky-600',
                        bg: 'bg-sky-50',
                    },
                    {
                        label: t('vendeur.this_month'),
                        value: formatCurrencyLocal(data.ca_mois),
                        sub: t('vendeur.sales_count', { count: data.nb_mois }),
                        icon: BarChart2,
                        color: 'text-purple-600',
                        bg: 'bg-purple-50',
                    },
                    {
                        label: t('vendeur.avg_basket_month'),
                        value: formatCurrencyLocal(data.panier_mois),
                        sub: t('vendeur.per_transaction'),
                        icon: ShoppingCart,
                        color: 'text-amber-600',
                        bg: 'bg-amber-50',
                    },
                    {
                        label: t('vendeur.ranking_month'),
                        value: null,
                        sub: t('vendeur.on_sellers', { count: data.total_vendeurs }),
                        icon: Trophy,
                        color: 'text-amber-500',
                        bg: 'bg-amber-50',
                        custom: <RangBadge rang={data.rang} total={data.total_vendeurs} />,
                    },
                ].map((kpi, i) => (
                    <div key={kpi.label} className="bg-white border border-slate-200 rounded-2xl p-4">
                        <div className={`inline-flex p-1.5 rounded-lg ${kpi.bg} mb-2`}>
                            <kpi.icon className={`size-3.5 ${kpi.color}`} />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{kpi.label}</p>
                        {kpi.custom ?? <p className="text-xl font-black text-slate-800">{kpi.value}</p>}
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Sparkline 7 jours ────────────────────────────────────────── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Zap className="size-3.5 text-indigo-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('vendeur.last_7_days')}</span>
                    </div>
                    {lastRefresh && <span className="text-[9px] text-slate-300 font-medium">{t('vendeur.updated_ago', { time: lastRefresh })}</span>}
                </div>
                <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={data.sparkline} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis
                            dataKey="label"
                            fontSize={10}
                            fontWeight={700}
                            tick={{ fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis hide />
                        <Tooltip
                            formatter={(value: number) => [formatCurrencyLocal(value), t('vendeur.ca_label')]}
                            labelStyle={{ fontSize: 11, fontWeight: 700 }}
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        />
                        <Bar dataKey="ca" radius={[4, 4, 0, 0]}>
                            {data.sparkline.map((entry, i) => (
                                <Cell
                                    key={entry.label}
                                    fill={entry.is_today ? '#6366f1' : entry.ca === 0 ? '#f1f5f9' : '#c7d2fe'}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
                {/* Labels nb ventes sous le graphe */}
                <div className="flex justify-around mt-1">
                    {data.sparkline.map((d, i) => (
                        <div key={d.label} className="flex flex-col items-center">
                            <span className={`text-[9px] font-black ${d.is_today ? 'text-indigo-600' : 'text-slate-300'}`}>
                                {d.nb > 0 ? d.nb : ''}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Top produits perso ───────────────────────────────────────── */}
            {data.top_produits.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                        <Star className="size-3.5 text-amber-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('vendeur.top_products_month')}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {data.top_produits.map((p, i) => {
                            const maxRev = data.top_produits[0]?.revenue ?? 1;
                            return (
                                <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                                    <span className="text-xs font-black text-slate-300 w-4 shrink-0">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-700 truncate">{p.name}</p>
                                        <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-300 rounded-full"
                                                style={{ width: `${(p.revenue / maxRev) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs font-black text-slate-700">{formatCurrencyLocal(p.revenue)}</p>
                                        <p className="text-[9px] text-slate-400">{t('vendeur.units_count', { count: p.qty })}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Dernière vente ───────────────────────────────────────────── */}
            {data.derniere_vente && (
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <Clock className="size-4 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-600">
                            {t('vendeur.last_sale')} · <span className="text-indigo-600">{data.derniere_vente.numero}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                            {formatDistanceToNow(parseISO(data.derniere_vente.date), { addSuffix: true, locale: dateLocale })}
                        </p>
                    </div>
                    <p className="text-sm font-black text-slate-700 shrink-0">{formatCurrencyLocal(data.derniere_vente.montant)}</p>
                </div>
            )}
        </div>
    );
}
