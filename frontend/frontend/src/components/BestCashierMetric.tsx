import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
            const response = await axios.get(`/api/clotures-caisse/performances_caissiers/?${params.toString()}`);
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Winner Card */}
            <div className="lg:col-span-1 bg-primary rounded-2xl shadow-lg p-6 text-primary-content relative overflow-hidden group border border-primary-focus">
                {/* Subtle pattern instead of big icon */}
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <svg width="100%" height="100%"><rect width="100%" height="100%" fill="url(#grid)"/><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="1"/></pattern></defs></svg>
                </div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="bg-white/20 p-2 rounded-xl border border-white/30 backdrop-blur-sm">
                             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-300"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                        </div>
                        <h3 className="font-black text-lg uppercase tracking-widest">{t('performance.best_cashier')}</h3>
                    </div>

                    <div className="flex items-center gap-5 mb-6 pt-2">
                        <div className="avatar placeholder">
                            <div className="bg-white/30 text-white rounded-2xl w-20 h-20 flex items-center justify-center text-3xl font-black border-2 border-white/50 shadow-inner">
                                <span>{winner.username.charAt(0).toUpperCase()}</span>
                            </div>
                        </div>
                        <div className="min-w-0">
                            <div className="text-2xl font-black leading-tight truncate drop-shadow-sm">{winner.full_name}</div>
                            <div className="text-white/70 text-sm font-bold flex items-center gap-1">
                                <span className="opacity-50">@</span>{winner.username}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-5 border-t border-white/20">
                        <div className="flex justify-between items-end">
                            <span className="text-white/80 text-xs font-bold uppercase tracking-wider">{t('performance.rigor_score')}</span>
                            <span className="text-2xl font-black text-yellow-300 drop-shadow-md">{formatCurrency(winner.moyenne_ecart_absolu)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/10 p-2 px-3 rounded-lg border border-white/5">
                            <span className="text-white/80 text-[10px] font-bold uppercase tracking-wider">{t('performance.avg_trend')}</span>
                            <span className="font-black text-xs">
                                {winner.moyenne_ecart_algebrique > 0 ? '+' : ''}{formatCurrency(winner.moyenne_ecart_algebrique)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/5">
                            <span className="text-white/80 text-xs font-bold uppercase tracking-wider">{t('performance.total_closures')}</span>
                            <span className="font-black text-lg">{winner.nombre_clotures}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ranking List Card */}
            <div className="lg:col-span-2 bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
                <div className="px-6 py-5 border-b border-base-200 flex justify-between items-center bg-base-100/50 backdrop-blur-sm">
                    <h3 className="font-black text-base-content flex items-center gap-3 text-lg uppercase tracking-tight">
                         <div className="bg-primary/10 p-2 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                         </div>
                        {t('performance.ranking_title')}
                    </h3>
                    <div className="text-xs font-bold uppercase opacity-40 bg-base-200 px-3 py-1.5 rounded-full border border-base-300">
                        Top {performances.length}
                    </div>
                </div>
                <div className="overflow-x-auto flex-1">
                    <table className="table table-zebra w-full border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-base-200/50 border-b border-base-300">
                                <th className="text-[10px] uppercase font-black text-base-content/40 px-6 py-4 tracking-widest">{t('table.rank')}</th>
                                <th className="text-[10px] uppercase font-black text-base-content/40 px-6 py-4 tracking-widest">{t('table.operator')}</th>
                                <th className="text-[10px] uppercase font-black text-base-content/40 text-center px-6 py-4 tracking-widest">{t('table.closures')}</th>
                                <th className="text-[10px] uppercase font-black text-base-content/40 text-right px-6 py-4 tracking-widest">{t('table.avg_gap')}</th>
                                <th className="text-[10px] uppercase font-black text-base-content/40 text-right px-6 py-4 tracking-widest">{t('table.trend')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-200">
                            {performances.map((perf, index) => (
                                <tr key={perf.user_id} className="hover:bg-primary/5 transition-all duration-200 group">
                                    <td className="px-6 py-4">
                                        {index === 0 ? (
                                            <div className="badge bg-yellow-400 border-none text-yellow-900 font-black px-3 h-7 italic shadow-sm">{t('performance.badges.1st')}</div>
                                        ) : index === 1 ? (
                                            <div className="badge bg-slate-300 border-none text-base-content/90 font-black px-3 h-7 italic shadow-sm">{t('performance.badges.2nd')}</div>
                                        ) : index === 2 ? (
                                             <div className="badge bg-amber-600 border-none text-amber-50 font-black px-3 h-7 italic shadow-sm">{t('performance.badges.3rd')}</div>
                                        ) : (
                                            <span className="text-base-content/30 font-black pl-2 font-mono">{index + 1}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-base-content group-hover:text-primary transition-colors">{perf.full_name}</span>
                                            <span className="text-[10px] font-bold opacity-30 uppercase tracking-tighter cursor-default">@{perf.username}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="font-black text-base-content/80 text-sm">
                                            {perf.nombre_clotures}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-black text-primary text-sm tracking-tight bg-primary/5 rounded-lg py-1 px-3 inline-block">
                                            {formatCurrency(perf.moyenne_ecart_absolu)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`text-[11px] font-black inline-flex items-center gap-1 px-2 py-1 rounded-md ${
                                            perf.moyenne_ecart_algebrique > 0 
                                                ? 'bg-success/10 text-success' 
                                                : perf.moyenne_ecart_algebrique < 0 
                                                    ? 'bg-error/10 text-error' 
                                                    : 'bg-base-200 text-base-content/30'
                                        }`}>
                                            {perf.moyenne_ecart_algebrique > 0 ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                                            ) : perf.moyenne_ecart_algebrique < 0 ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
                                            ) : null}
                                            {perf.moyenne_ecart_algebrique > 0 ? '+' : ''}{formatCurrency(perf.moyenne_ecart_algebrique)}
                                        </div>
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
