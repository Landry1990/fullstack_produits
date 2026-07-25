import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Zap, Moon, Flame, Minus,
    Info, TrendingDown, TrendingUp, ArrowRight
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { StockHealthData, MatrixProduct } from '../../hooks/useStockHealth';

// ─── Types ────────────────────────────────────────────────────────────────────

type Quadrant = MatrixProduct['quadrant'];

interface StockMatrixPanelProps {
    data: StockHealthData;
    // Prop optionnelle pour forcer les données produits (tests/mock)
    products?: MatrixProduct[];
}

// ─── Algorithme de classement matrice ─────────────────────────────────────────
// Logique : Rotation Forte = rotation_moyenne > seuil  |  Disponibilité Haute = stock > 0
//
// MOTEUR      → Rotation Forte  + Disponibilité Haute  (+)
// HÉMORRAGIE  → Rotation Forte  + Disponibilité Basse  (---)
// SOMNIFÈRE   → Rotation Faible + Disponibilité Haute  (--)
// NEUTRE      → Rotation Faible + Disponibilité Basse  (neutre)
//
// L'impact sur le score est estimé selon le poids de chaque composante :
//   Hémorragie pénalise A (disponibilité 30 pts) + D (activité 15 pts)
//   Somnifère  pénalise B (fluidité 25 pts) + E (immobilisation 10 pts)

// ─── Helpers ──────────────────────────────────────────────────────────────────

const QUADRANT_CONFIG = {
    MOTEUR: {
        icon: Zap,
        accent: 'text-emerald-600',
        dot: 'bg-emerald-500',
        badge: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
    },
    HEMORRAGIE: {
        icon: Flame,
        accent: 'text-red-600',
        dot: 'bg-red-500',
        badge: 'text-red-700 bg-red-50 border border-red-100',
    },
    SOMNIFERE: {
        icon: Moon,
        accent: 'text-slate-600',
        dot: 'bg-slate-400',
        badge: 'text-slate-600 bg-slate-50 border border-slate-200',
    },
    NEUTRE: {
        icon: Minus,
        accent: 'text-slate-400',
        dot: 'bg-slate-300',
        badge: 'text-slate-500 bg-slate-50 border border-slate-100',
    },
};

// ─── Calcul des stats matrice depuis les données disponibles ──────────────────
// Hémorragie = produits déjà en rupture (missed_sales.monthly_revenue > 0 → on déduit le nb)
//            + produits imminents (critical_alerts.soon_out_of_stock_count)
// Somnifère  = dead_stock.count (produits avec stock > 0 mais aucune vente depuis +90j)
// TODO: Le backend peut exposer GET statistiques/stock_health/matrix/ pour des counts exacts
function computeMatrixStats(data: StockHealthData) {
    const somifreCount = data.dead_stock.count;

    // Hémorragie = produits en rupture active (stock <= 0 avec rotation > 0)
    // Le backend expose désormais critical_alerts.rupture_count
    // Fallback : soon_out_of_stock_count (ruptures imminentes)
    const hemorragieCount = data.critical_alerts.rupture_count
        ?? data.critical_alerts.soon_out_of_stock_count;

    const hemorragiePts = Math.min(hemorragieCount * 2.5, 40);
    const somnifèrePts = Math.min(somifreCount * 1.8, 30);

    const manqueAGagner7j = data.missed_sales.daily_revenue * 7;

    return {
        hemorragieCount,
        somifreCount,
        hemorragiePts: Math.round(hemorragiePts * 10) / 10,
        somnifèrePts: Math.round(somnifèrePts * 10) / 10,
        manqueAGagner7j,
        tresorerieBloqueé: data.dead_stock.value,
    };
}

// ─── Composant ────────────────────────────────────────────────────────────────

const StockMatrixPanel: React.FC<StockMatrixPanelProps> = ({ data, products }) => {
    const { t } = useTranslation('stock');
    const topPenalties = products ?? data.top_penalties ?? [];
    const diagnostic = useMemo(() => {
        const score = data.health_score;
        const deadCount = data.dead_stock.count;
        const shortageCount = data.critical_alerts.rupture_count ?? data.critical_alerts.soon_out_of_stock_count;
        if (score >= 80) return t('matrix.diagnostic.excellent');
        if (deadCount > shortageCount * 2) return t('matrix.diagnostic.dead_stock', { count: deadCount, plural: deadCount > 1 ? 's' : '' });
        if (shortageCount > 0) return t('matrix.diagnostic.shortage', { count: shortageCount, plural: shortageCount > 1 ? 's' : '' });
        return t('matrix.diagnostic.unbalanced');
    }, [data, t]);
    const stats = useMemo(() => computeMatrixStats(data), [data]);

    return (
        <div className="space-y-3">

            {/* ── Bloc Score + Diagnostic ───────────────────────────────── */}
            <ScoreCard data={data} diagnostic={diagnostic} />

            {/* ── Matrice 4 Quadrants ───────────────────────────────────── */}
            <MatrixGrid data={data} stats={stats} />

            {/* ── Tableau Top 5 Pénalités ───────────────────────────────── */}
            <TopPenaltiesTable products={topPenalties} />
        </div>
    );
};

// ─── ScoreCard ────────────────────────────────────────────────────────────────

const ScoreCard: React.FC<{ data: StockHealthData; diagnostic: string }> = ({ data, diagnostic }) => {
    const { t } = useTranslation('stock');
    const score = data.health_score;
    const strokeColor = score >= 80 ? '#059669' : score >= 50 ? '#64748b' : '#ef4444';
    const scoreLabel = score >= 80 ? t('matrix.score_card.status.healthy') : score >= 50 ? t('matrix.score_card.status.warning') : t('matrix.score_card.status.critical');
    const circumference = 2 * Math.PI * 52;
    const offset = circumference * (1 - score / 100);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Ring */}
            <div className="relative size-20 shrink-0 mx-auto sm:mx-0">
                <svg className="size-20 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                    <circle
                        cx="60" cy="60" r="52" fill="none"
                        stroke={strokeColor} strokeWidth="10"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-800">{Math.round(score)}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">/{t('matrix.score_card.out_of')}</span>
                </div>
            </div>

            {/* Texte */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{t('matrix.score_card.title')}</span>
                    <div className="relative group/tooltip">
                        <Info className="size-3.5 text-slate-300 hover:text-slate-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 hidden group-hover/tooltip:block z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-left">
                            <p className="text-sm font-semibold text-slate-700 mb-2">{t('matrix.score_card.tooltip_title')}</p>
                            <ul className="text-sm space-y-1.5 text-slate-600">
                                <li>{t('matrix.score_card.tooltip_items.disponibilite')}</li>
                                <li>{t('matrix.score_card.tooltip_items.fluidite')}</li>
                                <li>{t('matrix.score_card.tooltip_items.couverture')}</li>
                                <li>{t('matrix.score_card.tooltip_items.activite')}</li>
                                <li>{t('matrix.score_card.tooltip_items.immobilisation')}</li>
                            </ul>
                        </div>
                    </div>
                </div>
                <p className="text-sm font-bold text-slate-800">{scoreLabel}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{diagnostic}</p>
            </div>

            {/* Barres composantes */}
            {data.score_details && (
                <div className="w-full sm:w-48 shrink-0 space-y-1.5">
                    {(Object.entries(data.score_details) as [string, { score: number; weight: number }][]).map(([key, comp]) => {
                        const pct = Math.round((comp.score / comp.weight) * 100);
                        const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-slate-400' : 'bg-red-400';
                        return (
                            <div key={key} className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 w-14 shrink-0">{t(`matrix.score_card.labels.${key}`)}</span>
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] font-semibold text-slate-600 w-8 text-right">{comp.score.toFixed(0)}/{comp.weight}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── MatrixGrid ───────────────────────────────────────────────────────────────

interface MatrixStats {
    hemorragieCount: number;
    somifreCount: number;
    hemorragiePts: number;
    somnifèrePts: number;
    manqueAGagner7j: number;
    tresorerieBloqueé: number;
}

const MatrixGrid: React.FC<{ data: StockHealthData; stats: MatrixStats }> = ({ data: _data, stats }) => {
    const { t } = useTranslation('stock');
    const quadrants: { key: Quadrant; count: number; value?: number; valueLabel?: string }[] = [
        { key: 'MOTEUR', count: 0 },
        { key: 'HEMORRAGIE', count: stats.hemorragieCount, value: stats.manqueAGagner7j, valueLabel: t('matrix.grid.value_labels.missed_sales') },
        { key: 'SOMNIFERE', count: stats.somifreCount, value: stats.tresorerieBloqueé, valueLabel: t('matrix.grid.value_labels.blocked_cash') },
        { key: 'NEUTRE', count: 0 },
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-800">{t('matrix.grid.title')}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><TrendingUp className="size-2.5" /> {t('matrix.grid.high_rotation')}</span>
                    <span className="flex items-center gap-1"><TrendingDown className="size-2.5" /> {t('matrix.grid.low_rotation')}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
                {quadrants.map(({ key, count, value, valueLabel }) => {
                    const cfg = QUADRANT_CONFIG[key];
                    const Icon = cfg.icon;
                    return (
                        <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                    <div className={`size-1.5 rounded-full ${cfg.dot}`} />
                                    <span className="text-[10px] font-semibold text-slate-800">{t(`matrix.quadrants.${key}.label`)}</span>
                                </div>
                                <Icon className={`size-3.5 ${cfg.accent}`} />
                            </div>
                            <p className="text-[10px] text-slate-500 mb-1 leading-tight">{t(`matrix.quadrants.${key}.description`)}</p>
                            {count > 0 ? (
                                <>
                                    <span className={`text-lg font-bold ${cfg.accent}`}>{count}</span>
                                    <span className="text-[10px] text-slate-500 ml-1">{t('matrix.grid.product', { count })}</span>
                                    {value !== undefined && value > 0 && (
                                        <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">{valueLabel} : <span className="font-semibold">{formatCurrency(Math.round(value))}</span></p>
                                    )}
                                </>
                            ) : (
                                <span className="text-xs text-slate-300 italic">—</span>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                <span>{t('matrix.grid.low_availability')}</span>
                <span>{t('matrix.grid.high_availability')}</span>
            </div>
        </div>
    );
};

// ─── Tableau Top 5 Pénalités ──────────────────────────────────────────────────

const TopPenaltiesTable: React.FC<{ products: MatrixProduct[] }> = ({ products }) => {
    const { t } = useTranslation('stock');
    const sorted = products.slice().sort((a, b) => a.impact_pts - b.impact_pts).slice(0, 5);

    if (sorted.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-800 mb-1">{t('matrix.penalties.title')}</p>
                <p className="text-xs text-slate-500">{t('matrix.penalties.empty')}</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-800">{t('matrix.penalties.title')}</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('matrix.penalties.headers.designation')}</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('matrix.penalties.headers.type')}</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('matrix.penalties.headers.days')}</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('matrix.penalties.headers.value')}</th>
                            <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('matrix.penalties.headers.impact')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {sorted.map((p) => {
                            const cfg = QUADRANT_CONFIG[p.quadrant];
                            const Icon = cfg.icon;
                            return (
                                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-6 py-3.5">
                                        <div className="text-sm font-medium text-slate-800 leading-tight">{p.name}</div>
                                        <div className="text-xs text-slate-400 font-mono mt-1">{p.cip}</div>
                                    </td>
                                    <td className="px-4 py-3.5 text-center">
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.badge}`}>
                                            <Icon className="size-3" />
                                            {t(`matrix.quadrants.${p.quadrant}.label`)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right text-sm text-slate-600">
                                        {p.days_since_sale === 0 ? <span className="text-red-500 font-semibold">{t('matrix.penalties.rupture')}</span> : `${p.days_since_sale}j`}
                                    </td>
                                    <td className="px-4 py-3.5 text-right text-sm text-slate-700">
                                        {p.stock_value > 0 ? formatCurrency(p.stock_value) : '—'}
                                    </td>
                                    <td className="px-6 py-3.5 text-right">
                                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
                                            <ArrowRight className="size-3.5 rotate-45 text-slate-400" />
                                            {t('matrix.penalties.impact_pts', { pts: p.impact_pts.toFixed(1) })}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StockMatrixPanel;
