import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/formatters';

interface CashierPerformance {
    user_id: number;
    username: string;
    full_name: string;
    moyenne_ecart_absolu: number;
    moyenne_ecart_algebrique: number;
    total_ecart_absolu: number;
    total_ecart_algebrique: number;
    nombre_clotures: number;
    total_theorique: number;
    total_reel: number;
    total_ventes: number;
}

interface BestCashierMetricProps {
    month: string;
    year: string;
    userId?: string;
}

const BestCashierMetric: React.FC<BestCashierMetricProps> = ({ month, year, userId }) => {
    const { t } = useTranslation(['cash_closings', 'common']);
    const [performances, setPerformances] = useState<CashierPerformance[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPerformances();
    }, [month, year, userId]);

    const fetchPerformances = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ month, year })
            if (userId) params.append('user_id', userId)
            const response = await api.get(`clotures-caisse/performances_caissiers/?${params.toString()}`);
            setPerformances(response.data);
        } catch (err) {
            console.error("Error fetching cashier performances:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-8 flex justify-center items-center">
                <span className="loading loading-spinner loading-md text-primary"></span>
            </div>
        );
    }

    if (performances.length === 0) {
        return (
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-10 flex flex-col items-center justify-center text-center space-y-4">
                <div className="bg-base-200 p-4 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-base-content/20"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                </div>
                <div>
                    <h4 className="font-bold text-base-content/40 uppercase tracking-widest text-xs mb-1">{t('performance.waiting_ranking')}</h4>
                    <p className="text-sm text-base-content/30 italic max-w-xs mx-auto">
                        {t('performance.no_closures_desc')}
                    </p>
                </div>
            </div>
        );
    }

    const winner = performances[0];

    return (
        <div className="flex flex-col sm:flex-row gap-3">
            {/* Winner Card — compact horizontal */}
            <div className="sm:w-56 shrink-0 bg-emerald-600 rounded-xl p-3 text-white relative overflow-hidden border border-emerald-700">
                <div className="flex items-center gap-2 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-300 shrink-0"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{t('performance.best_cashier')}</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                    <div className="bg-white/20 text-white rounded-lg size-9 flex items-center justify-center text-sm font-black border border-white/40 shrink-0">
                        {winner.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-black leading-tight truncate">{winner.full_name}</div>
                        <div className="text-white/60 text-[10px] font-bold">@{winner.username}</div>
                    </div>
                </div>
                <div className="space-y-1.5 border-t border-white/20 pt-2">
                    <div className="flex justify-between items-center">
                        <span className="text-white/70 text-[10px] font-bold uppercase tracking-wide">{t('performance.rigor_score')}</span>
                        <span className="text-sm font-black text-yellow-300">{formatCurrency(winner.moyenne_ecart_absolu)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-white/70 text-[10px] font-bold uppercase tracking-wide">{t('performance.avg_trend')}</span>
                        <span className="text-xs font-black">{winner.moyenne_ecart_algebrique > 0 ? '+' : ''}{formatCurrency(winner.moyenne_ecart_algebrique)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-white/70 text-[10px] font-bold uppercase tracking-wide">{t('performance.total_closures')}</span>
                        <span className="text-sm font-black">{winner.nombre_clotures}</span>
                    </div>
                </div>
            </div>

            {/* Ranking Table — compact */}
            <div className="flex-1 bg-base-100 rounded-xl border border-base-200 overflow-hidden flex flex-col">
                <div className="px-4 py-2 border-b border-base-200 flex justify-between items-center">
                    <h3 className="font-black text-xs text-base-content uppercase tracking-widest flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        {t('performance.ranking_title')}
                    </h3>
                    <span className="text-[10px] font-bold opacity-40 bg-base-200 px-2 py-0.5 rounded-full">Top {performances.length}</span>
                </div>
                <div className="overflow-x-auto flex-1">
                    <table className="table table-xs w-full">
                        <thead>
                            <tr className="bg-base-200/40">
                                <th className="text-[10px] uppercase font-black text-base-content/40 px-3 py-2 tracking-widest">{t('table.rank')}</th>
                                <th className="text-[10px] uppercase font-black text-base-content/40 px-3 py-2 tracking-widest">{t('table.operator')}</th>
                                <th className="text-[10px] uppercase font-black text-base-content/40 text-center px-3 py-2 tracking-widest">{t('table.closures')}</th>
                                <th className="text-[10px] uppercase font-black text-base-content/40 text-right px-3 py-2 tracking-widest">{t('table.avg_gap')}</th>
                                <th className="text-[10px] uppercase font-black text-base-content/40 text-right px-3 py-2 tracking-widest">{t('table.trend')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {performances.map((perf, index) => (
                                <tr key={perf.user_id} className="hover:bg-primary/5 transition-colors group border-b border-base-100">
                                    <td className="px-3 py-2">
                                        {index === 0 ? (
                                            <span className="badge badge-xs bg-yellow-400 border-none text-yellow-900 font-black italic px-2">{t('performance.badges.1st')}</span>
                                        ) : index === 1 ? (
                                            <span className="badge badge-xs bg-slate-300 border-none text-base-content/90 font-black italic px-2">{t('performance.badges.2nd')}</span>
                                        ) : index === 2 ? (
                                            <span className="badge badge-xs bg-warning border-none text-amber-50 font-black italic px-2">{t('performance.badges.3rd')}</span>
                                        ) : (
                                            <span className="text-base-content/30 font-black text-xs pl-1 font-mono">{index + 1}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="font-bold text-xs text-base-content group-hover:text-primary transition-colors leading-tight">{perf.full_name}</div>
                                        <div className="text-[10px] font-bold text-base-content/30 uppercase tracking-tighter">@{perf.username}</div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span className="font-black text-xs text-base-content/80">{perf.nombre_clotures}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <span className="font-black text-xs text-primary bg-primary/5 rounded px-2 py-0.5">{formatCurrency(perf.moyenne_ecart_absolu)}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <span className={`text-[11px] font-black inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                                            perf.moyenne_ecart_algebrique > 0 ? 'bg-success/10 text-success'
                                            : perf.moyenne_ecart_algebrique < 0 ? 'bg-error/10 text-error'
                                            : 'bg-base-200 text-base-content/30'
                                        }`}>
                                            {perf.moyenne_ecart_algebrique > 0 ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                                            ) : perf.moyenne_ecart_algebrique < 0 ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
                                            ) : null}
                                            {perf.moyenne_ecart_algebrique > 0 ? '+' : ''}{formatCurrency(perf.moyenne_ecart_algebrique)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BestCashierMetric;
