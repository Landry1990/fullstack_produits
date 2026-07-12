import React, { useMemo } from 'react';
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
        label: 'Moteur',
        icon: Zap,
        accent: 'text-emerald-600',
        dot: 'bg-emerald-500',
        badge: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
        description: 'Se vend bien · bien en stock',
        impact: 'Positif',
    },
    HEMORRAGIE: {
        label: 'Hémorragie',
        icon: Flame,
        accent: 'text-red-600',
        dot: 'bg-red-500',
        badge: 'text-red-700 bg-red-50 border border-red-100',
        description: 'Très demandé · en rupture',
        impact: 'Critique',
    },
    SOMNIFERE: {
        label: 'Somnifère',
        icon: Moon,
        accent: 'text-slate-600',
        dot: 'bg-slate-400',
        badge: 'text-slate-600 bg-slate-50 border border-slate-200',
        description: 'Surstock · aucune vente +90j',
        impact: 'Pénalisant',
    },
    NEUTRE: {
        label: 'Neutre',
        icon: Minus,
        accent: 'text-slate-400',
        dot: 'bg-slate-300',
        badge: 'text-slate-500 bg-slate-50 border border-slate-100',
        description: 'Flux tendu · à la demande',
        impact: 'Neutre',
    },
};

// ─── Génération du diagnostic contextuel ─────────────────────────────────────
// TODO: Le backend peut enrichir ce texte via un champ "diagnostic_text" dans la réponse
function buildDiagnostic(data: StockHealthData): string {
    const score = data.health_score;
    const deadCount = data.dead_stock.count;
    const shortageCount = data.critical_alerts.rupture_count
        ?? data.critical_alerts.soon_out_of_stock_count;

    if (score >= 80) {
        return 'Excellent ! Votre stock est sain, bien équilibré et tourne efficacement.';
    }
    if (deadCount > shortageCount * 2) {
        return `Votre score est freiné par ${deadCount} produit${deadCount > 1 ? 's' : ''} somnifère${deadCount > 1 ? 's' : ''} qui immobilisent votre trésorerie.`;
    }
    if (shortageCount > 0) {
        return `${shortageCount} produit${shortageCount > 1 ? 's' : ''} moteur${shortageCount > 1 ? 's' : ''} en rupture font chuter votre score. Agissez maintenant.`;
    }
    return 'Plusieurs déséquilibres détectés. Consultez les quadrants pour identifier les actions prioritaires.';
}

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
    const topPenalties = products ?? data.top_penalties ?? [];
    const diagnostic = buildDiagnostic(data);
    const stats = useMemo(() => computeMatrixStats(data), [data]);

    return (
        <div className="space-y-6">

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

const scoreCardLabels: Record<string, string> = {
    disponibilite: 'Dispo', fluidite: 'Fluidité',
    couverture: 'Couvert.', activite: 'Activité', immobilisation: 'Immo'
};

const ScoreCard: React.FC<{ data: StockHealthData; diagnostic: string }> = ({ data, diagnostic }) => {
    const score = data.health_score;
    const strokeColor = score >= 80 ? '#059669' : score >= 50 ? '#64748b' : '#ef4444';
    const scoreLabel = score >= 80 ? 'Stock Sain' : score >= 50 ? 'À Surveiller' : 'Critique';
    const circumference = 2 * Math.PI * 52;
    const offset = circumference * (1 - score / 100);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Ring */}
            <div className="relative size-32 shrink-0 mx-auto sm:mx-0">
                <svg className="size-32 -rotate-90" viewBox="0 0 120 120">
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
                    <span className="text-4xl font-black text-slate-800">{Math.round(score)}</span>
                    <span className="text-sm text-slate-400 font-semibold">/100</span>
                </div>
            </div>

            {/* Texte */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Score de Santé</span>
                    <div className="relative group/tooltip">
                        <Info className="size-3.5 text-slate-300 hover:text-slate-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 hidden group-hover/tooltip:block z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-left">
                            <p className="text-sm font-semibold text-slate-700 mb-2">5 composantes (100 pts)</p>
                            <ul className="text-sm space-y-1.5 text-slate-600">
                                <li>Disponibilité — 30 pts</li>
                                <li>Fluidité — 25 pts</li>
                                <li>Couverture — 20 pts</li>
                                <li>Activité récente — 15 pts</li>
                                <li>Immobilisation — 10 pts</li>
                            </ul>
                        </div>
                    </div>
                </div>
                <p className="text-lg font-bold text-slate-800">{scoreLabel}</p>
                <p className="text-base text-slate-500 mt-1 leading-relaxed">{diagnostic}</p>
            </div>

            {/* Barres composantes */}
            {data.score_details && (
                <div className="w-full sm:w-56 shrink-0 space-y-2">
                    {(Object.entries(data.score_details) as [string, { score: number; weight: number }][]).map(([key, comp]) => {
                        const pct = Math.round((comp.score / comp.weight) * 100);
                        const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-slate-400' : 'bg-red-400';
                        return (
                            <div key={key} className="flex items-center gap-2.5">
                                <span className="text-xs text-slate-500 w-16 shrink-0">{scoreCardLabels[key]}</span>
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-slate-600 w-10 text-right">{comp.score.toFixed(0)}/{comp.weight}</span>
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
    const quadrants: { key: Quadrant; count: number; value?: number; valueLabel?: string }[] = [
        { key: 'MOTEUR', count: 0 },
        { key: 'HEMORRAGIE', count: stats.hemorragieCount, value: stats.manqueAGagner7j, valueLabel: 'Manque à gagner / 7j' },
        { key: 'SOMNIFERE', count: stats.somifreCount, value: stats.tresorerieBloqueé, valueLabel: 'Trésorerie bloquée' },
        { key: 'NEUTRE', count: 0 },
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
                <p className="text-base font-semibold text-slate-800">Matrice Performance</p>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><TrendingUp className="size-3.5" /> Rotation forte</span>
                    <span className="flex items-center gap-1"><TrendingDown className="size-3.5" /> Rotation faible</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {quadrants.map(({ key, count, value, valueLabel }) => {
                    const cfg = QUADRANT_CONFIG[key];
                    const Icon = cfg.icon;
                    return (
                        <div key={key} className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className={`size-2 rounded-full ${cfg.dot}`} />
                                    <span className="text-sm font-semibold text-slate-800">{cfg.label}</span>
                                </div>
                                <Icon className={`size-5 ${cfg.accent}`} />
                            </div>
                            <p className="text-sm text-slate-500 mb-4">{cfg.description}</p>
                            {count > 0 ? (
                                <>
                                    <span className={`text-2xl font-bold ${cfg.accent}`}>{count}</span>
                                    <span className="text-sm text-slate-500 ml-1.5">produit{count > 1 ? 's' : ''}</span>
                                    {value !== undefined && value > 0 && (
                                        <p className="text-sm text-slate-600 mt-2">{valueLabel} : <span className="font-semibold">{formatCurrency(Math.round(value))}</span></p>
                                    )}
                                </>
                            ) : (
                                <span className="text-base text-slate-300 italic">—</span>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 flex justify-between text-xs text-slate-400">
                <span>← Dispo. Basse</span>
                <span>Dispo. Haute →</span>
            </div>
        </div>
    );
};

// ─── Tableau Top 5 Pénalités ──────────────────────────────────────────────────

const TopPenaltiesTable: React.FC<{ products: MatrixProduct[] }> = ({ products }) => {
    const sorted = products.slice().sort((a, b) => a.impact_pts - b.impact_pts).slice(0, 5);

    if (sorted.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <p className="text-base font-semibold text-slate-800 mb-2">Top 5 — Pénalités de score</p>
                <p className="text-sm text-slate-500">Aucune pénalité significative détectée. Votre stock est équilibré.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
                <p className="text-base font-semibold text-slate-800">Top 5 — Pénalités de score</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Désignation</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Jours</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Valeur</th>
                            <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Impact</th>
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
                                            {cfg.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right text-sm text-slate-600">
                                        {p.days_since_sale === 0 ? <span className="text-red-500 font-semibold">Rupture</span> : `${p.days_since_sale}j`}
                                    </td>
                                    <td className="px-4 py-3.5 text-right text-sm text-slate-700">
                                        {p.stock_value > 0 ? formatCurrency(p.stock_value) : '—'}
                                    </td>
                                    <td className="px-6 py-3.5 text-right">
                                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
                                            <ArrowRight className="size-3.5 rotate-45 text-slate-400" />
                                            {p.impact_pts.toFixed(1)} pts
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
