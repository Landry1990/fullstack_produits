import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Badge } from './ui/Badge';
import { formatCurrency } from '../utils/formatters';
import { cn } from '../lib/utils';
import { logger } from '../utils/logger'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, year, userId]);

    const fetchPerformances = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ month, year })
            if (userId) params.append('user_id', userId)
            const response = await api.get(`clotures-caisse/performances_caissiers/?${params.toString()}`);
            setPerformances(response.data);
        } catch (err) {
            logger.error("Error fetching cashier performances:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-8 flex justify-center items-center">
                <Loader2 className="size-5 animate-spin text-primary" />
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

    const getRankBadge = (index: number) => {
        if (index === 0) return <Badge variant="primary" size="sm" className="bg-yellow-400 border-none text-yellow-900 font-black italic px-1.5">{t('performance.badges.1st')}</Badge>;
        if (index === 1) return <Badge variant="primary" size="sm" className="bg-slate-300 border-none text-base-content/90 font-black italic px-1.5">{t('performance.badges.2nd')}</Badge>;
        if (index === 2) return <Badge variant="warning" size="sm" className="border-none text-amber-50 font-black italic px-1.5">{t('performance.badges.3rd')}</Badge>;
        return <span className="text-base-content/30 font-black text-xs pl-1 font-mono w-6 text-center inline-block">{index + 1}</span>;
    };

    return (
        <div className="bg-base-100 rounded-xl border border-base-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-base-200 flex justify-between items-center shrink-0">
                <h3 className="font-black text-xs text-base-content uppercase tracking-widest flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    {t('performance.ranking_title')}
                </h3>
                <span className="text-caption font-bold opacity-40 bg-base-200 px-2 py-0.5 rounded-full shrink-0">Top {performances.length}</span>
            </div>
            <div className="overflow-x-auto">
                <div className="flex items-stretch min-w-max divide-x divide-base-200">
                    {performances.map((perf, index) => {
                        const isTop = index === 0;
                        return (
                            <div key={perf.user_id} className={cn("flex items-center gap-2 px-3 py-2.5 min-w-[14rem]", isTop ? 'bg-emerald-600 text-white' : 'bg-base-100 text-base-content hover:bg-base-200/50 transition-colors')}>
                                <div className="shrink-0">{getRankBadge(index)}</div>
                                <div className="shrink-0">
                                    <div className={cn("size-8 rounded-lg flex items-center justify-center text-xs font-black border", isTop ? 'bg-white/20 border-white/40 text-white' : 'bg-base-200 border-base-300 text-base-content')}>
                                        {perf.username.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                                <div className="min-w-0 shrink-0">
                                    <div className={cn("text-xs font-black leading-tight truncate", isTop ? 'text-white' : 'text-base-content')}>{perf.full_name}</div>
                                    <div className={cn("text-caption font-bold uppercase tracking-tighter", isTop ? 'text-white/70' : 'text-base-content/40')}>@{perf.username}</div>
                                </div>
                                <div className={cn("ml-auto flex items-center gap-3 text-xs shrink-0", isTop ? 'text-white' : 'text-base-content/80')}>
                                    <div className="text-right min-w-[3.5rem]">
                                        <div className="text-caption font-black uppercase tracking-wide opacity-70">{t('table.closures')}</div>
                                        <div className="font-black">{perf.nombre_clotures}</div>
                                    </div>
                                    <div className="text-right min-w-[4rem]">
                                        <div className="text-caption font-black uppercase tracking-wide opacity-70">{t('table.avg_gap')}</div>
                                        <div className={cn("font-black", isTop ? 'text-yellow-300' : 'text-primary')}>{formatCurrency(perf.moyenne_ecart_absolu)}</div>
                                    </div>
                                    <div className="text-right min-w-[4rem]">
                                        <div className="text-caption font-black uppercase tracking-wide opacity-70">{t('table.trend')}</div>
                                        <div className={cn("font-black inline-flex items-center gap-0.5", perf.moyenne_ecart_algebrique > 0 ? (isTop ? 'text-white' : 'text-success') : perf.moyenne_ecart_algebrique < 0 ? (isTop ? 'text-white' : 'text-error') : 'opacity-60')}>
                                            {perf.moyenne_ecart_algebrique > 0 ? '+' : ''}{formatCurrency(perf.moyenne_ecart_algebrique)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BestCashierMetric;
