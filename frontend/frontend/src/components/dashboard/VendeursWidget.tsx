import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, TrendingUp, TrendingDown, Minus, ArrowRight, Users } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell
} from 'recharts';
import { useVendeursRanking } from '../../hooks/useDashboard';

interface VendeursWidgetProps {
    formatCurrencyLocal: (val: number) => string;
}

const BAR_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function EvolutionBadge({ value }: { value?: number | null }) {
    if (value === null || value === undefined) return <span className="text-base-content/30 text-xs">—</span>;
    if (value > 0) return (
        <span className="inline-flex items-center gap-0.5 text-emerald-500 font-black text-xs">
            <TrendingUp className="w-3 h-3" />+{value}%
        </span>
    );
    if (value < 0) return (
        <span className="inline-flex items-center gap-0.5 text-rose-500 font-black text-xs">
            <TrendingDown className="w-3 h-3" />{value}%
        </span>
    );
    return (
        <span className="inline-flex items-center gap-0.5 text-base-content/40 font-bold text-xs">
            <Minus className="w-3 h-3" />0%
        </span>
    );
}

export default function VendeursWidget({ formatCurrencyLocal }: VendeursWidgetProps) {
    const now = new Date();
    const currentMois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [mois, setMois] = useState(currentMois);
    const [view, setView] = useState<'ranking' | 'chart'>('ranking');

    const { data: rankingData, isLoading } = useVendeursRanking(mois);

    const vendeurs = rankingData?.data ?? [];
    const maxCA = vendeurs[0]?.chiffre_affaires ?? 1;

    const chartData = vendeurs.slice(0, 5).map(v => ({
        name: v.vendeur.split(' ')[0],
        ca: v.chiffre_affaires,
        ventes: v.nbre_ventes,
    }));

    const getMedalEmoji = (rang: number) => {
        if (rang === 1) return '🥇';
        if (rang === 2) return '🥈';
        if (rang === 3) return '🥉';
        return rang;
    };

    return (
        <div className="space-y-5">

            {/* ── Header contrôles ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-500/10 rounded-xl">
                        <Trophy className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-base-content/40">Classement</p>
                        <p className="text-sm font-black text-base-content leading-none">Performances Vendeurs</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="month"
                        value={mois}
                        onChange={e => setMois(e.target.value)}
                        className="input input-bordered input-xs h-7 text-xs"
                    />
                    <div className="join">
                        <button
                            className={`join-item btn btn-xs ${view === 'ranking' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setView('ranking')}
                        >Liste</button>
                        <button
                            className={`join-item btn btn-xs ${view === 'chart' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setView('chart')}
                        >Graph</button>
                    </div>
                    <Link to="/app/classement-vendeurs" className="btn btn-xs btn-ghost gap-1 text-primary">
                        Voir tout <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <span className="loading loading-spinner loading-md text-primary" />
                </div>
            ) : vendeurs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-base-content/30 gap-2">
                    <Users className="w-8 h-8" />
                    <p className="text-sm font-bold">Aucune donnée pour cette période</p>
                </div>
            ) : view === 'ranking' ? (
                <>
                    {/* ── Podium Top 3 ── */}
                    {vendeurs.length >= 1 && (
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                vendeurs[1] ?? null,
                                vendeurs[0] ?? null,
                                vendeurs[2] ?? null,
                            ].map((v, pos) => {
                                if (!v) return <div key={pos} />;
                                const isFirst = pos === 1;
                                return (
                                    <div
                                        key={v.vendeur_id}
                                        className={`relative flex flex-col items-center rounded-2xl p-3 border transition-all ${
                                            isFirst
                                                ? 'bg-gradient-to-b from-amber-50 to-amber-100/60 border-amber-200 dark:from-amber-900/20 dark:to-amber-800/10 dark:border-amber-700/30 shadow-md'
                                                : 'bg-base-200/50 border-base-200'
                                        }`}
                                    >
                                        {isFirst && (
                                            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-400 text-white text-[9px] font-black uppercase rounded-full tracking-widest shadow">
                                                Top
                                            </div>
                                        )}
                                        <span className="text-2xl mb-1">{getMedalEmoji(v.rang)}</span>
                                        <p className={`font-black text-center leading-tight text-base-content truncate w-full text-center ${isFirst ? 'text-sm' : 'text-xs'}`}>
                                            {v.vendeur.split(' ')[0]}
                                        </p>
                                        <p className={`font-black text-amber-600 dark:text-amber-400 mt-0.5 ${isFirst ? 'text-sm' : 'text-xs'}`}>
                                            {formatCurrencyLocal(v.chiffre_affaires)}
                                        </p>
                                        <p className="text-[10px] text-base-content/40 font-medium">{v.nbre_ventes} ventes</p>
                                        <div className="mt-1">
                                            <EvolutionBadge value={v.evolution} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Liste complète avec barres de progression ── */}
                    <div className="bg-base-100 rounded-2xl border border-base-200 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-base-200 bg-base-200/30">
                            <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                Classement Complet · {vendeurs.length} vendeur{vendeurs.length > 1 ? 's' : ''}
                            </p>
                        </div>
                        <div className="divide-y divide-base-200">
                            {vendeurs.map((v, idx) => (
                                <div key={v.vendeur_id} className="px-4 py-3 hover:bg-base-200/40 transition-colors">
                                    <div className="flex items-center justify-between gap-3 mb-1.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="text-base font-black text-base-content/50 w-5 shrink-0 text-center">
                                                {getMedalEmoji(v.rang)}
                                            </span>
                                            <p className="font-black text-sm text-base-content truncate">{v.vendeur}</p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <EvolutionBadge value={v.evolution} />
                                            <p className="font-black text-sm text-base-content font-mono">
                                                {formatCurrencyLocal(v.chiffre_affaires)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-base-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${Math.round((v.chiffre_affaires / maxCA) * 100)}%`,
                                                    backgroundColor: BAR_COLORS[idx % BAR_COLORS.length],
                                                }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-bold text-base-content/40 w-10 text-right shrink-0">
                                            {v.nbre_ventes} vte{v.nbre_ventes > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                /* ── Vue graphique ── */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Bar CA */}
                    <div className="bg-base-100 rounded-2xl border border-base-200 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-3">CA par vendeur</p>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                                <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} fontSize={10} />
                                <YAxis type="category" dataKey="name" width={55} fontSize={11} fontWeight={700} />
                                <Tooltip
                                    formatter={(value: number) => [formatCurrencyLocal(value), 'CA']}
                                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                                />
                                <Bar dataKey="ca" radius={[0, 4, 4, 0]}>
                                    {chartData.map((_, i) => (
                                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Bar Ventes */}
                    <div className="bg-base-100 rounded-2xl border border-base-200 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-3">Nombre de ventes</p>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={chartData} margin={{ left: 0, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                                <XAxis dataKey="name" fontSize={11} fontWeight={700} />
                                <YAxis fontSize={10} />
                                <Tooltip
                                    formatter={(value: number) => [value, 'Ventes']}
                                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                                />
                                <Bar dataKey="ventes" radius={[4, 4, 0, 0]}>
                                    {chartData.map((_, i) => (
                                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} opacity={0.8} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Tableau récap */}
                    <div className="lg:col-span-2 bg-base-100 rounded-2xl border border-base-200 overflow-hidden">
                        <table className="table table-sm w-full">
                            <thead className="bg-base-200/50">
                                <tr className="text-[10px] uppercase tracking-widest text-base-content/40">
                                    <th>#</th>
                                    <th>Vendeur</th>
                                    <th className="text-right">Ventes</th>
                                    <th className="text-right">CA</th>
                                    <th className="text-right">Panier moy.</th>
                                    <th className="text-right">Évolution</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vendeurs.map(v => (
                                    <tr key={v.vendeur_id} className="hover:bg-base-200/30">
                                        <td className="font-black text-base-content/60">{getMedalEmoji(v.rang)}</td>
                                        <td className="font-bold">{v.vendeur}</td>
                                        <td className="text-right font-mono text-sm">{v.nbre_ventes}</td>
                                        <td className="text-right font-mono font-black text-sm">{formatCurrencyLocal(v.chiffre_affaires)}</td>
                                        <td className="text-right font-mono text-xs text-base-content/60">{formatCurrencyLocal(v.panier_moyen)}</td>
                                        <td className="text-right"><EvolutionBadge value={v.evolution} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
