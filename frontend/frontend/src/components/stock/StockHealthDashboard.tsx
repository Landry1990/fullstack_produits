import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Activity, 
    TrendingDown, 
    Wallet, 
    AlertCircle, 
    RefreshCw,
    Clock,
    CheckCircle2,
    DollarSign,
    ShoppingCart,
    Filter,
    Info,
    Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStockHealth } from '../../hooks/useStockHealth';
import { formatCurrency } from '../../utils/formatters';
import { AnimatedNumber } from '../common/AnimatedNumber';
import StockHealthSettingsModal from './StockHealthSettingsModal';

const StockHealthDashboard: React.FC = () => {
    const { t } = useTranslation(['stock', 'common']);
    const { data, loading, error, refresh } = useStockHealth();
    const navigate = useNavigate();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    if (loading) return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 h-80 bg-base-100 rounded-[40px] border border-base-200 animate-pulse"></div>
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-40 bg-base-100 rounded-[40px] border border-base-200 animate-pulse"></div>
                <div className="h-40 bg-base-100 rounded-[40px] border border-base-200 animate-pulse"></div>
            </div>
        </div>
    );

    if (error || !data) return null;

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-500';
        if (score >= 50) return 'text-amber-500';
        return 'text-rose-500';
    };

    const getScoreBg = (score: number) => {
        if (score >= 80) return 'bg-emerald-500/10';
        if (score >= 50) return 'bg-amber-500/10';
        return 'bg-rose-500/10';
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mouse-x', `${x}%`);
        card.style.setProperty('--mouse-y', `${y}%`);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {/* Main Health Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Health Score Card */}
                <div 
                    onMouseMove={handleMouseMove}
                    className="lg:col-span-4 expert-card stagger-1 bg-base-100 p-8 rounded-[40px] border border-base-200 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group"
                >
                    <div className={`absolute inset-0 opacity-5 ${getScoreBg(data.health_score)} transition-colors duration-500`}></div>
                    
                    {/* Settings Trigger */}
                    <div className="absolute top-6 right-6 flex gap-2">
                         <button 
                            onClick={() => setIsSettingsOpen(true)}
                            className="btn btn-circle btn-ghost btn-sm bg-base-200/50 text-base-content/40 hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={refresh}
                            className="btn btn-circle btn-ghost btn-sm bg-base-200/50 text-base-content/40 hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="relative">
                        <div className={`w-36 h-36 rounded-full border-8 border-base-200 flex items-center justify-center mb-6 transition-all duration-1000 group-hover:scale-105 shadow-[0_0_40px_rgba(0,0,0,0.02)]`}>
                            <span className={`text-5xl font-black tracking-tighter ${getScoreColor(data.health_score)}`}>
                                <AnimatedNumber value={data.health_score} />
                                <span className="text-2xl ml-0.5">%</span>
                            </span>
                            {/* SVG Ring for Circular Progress */}
                            <svg className="absolute w-36 h-36 -rotate-90">
                                <circle
                                    cx="72" cy="72" r="64"
                                    className="stroke-current opacity-10"
                                    strokeWidth="8" fill="transparent"
                                />
                                <circle
                                    cx="72" cy="72" r="64"
                                    className={`stroke-current ${getScoreColor(data.health_score)} transition-all duration-1000`}
                                    strokeWidth="8" fill="transparent"
                                    strokeDasharray={402.12}
                                    strokeDashoffset={402.12 * (1 - data.health_score / 100)}
                                    strokeLinecap="round"
                                />
                            </svg>
                        </div>
                    </div>
                    
                    <div className="relative flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-black text-base-content tracking-tighter">
                            {t('stock:analyse.dashboard.health_score')}
                        </h3>
                        <div className="tooltip tooltip-bottom" data-tip={t('stock:analyse.dashboard.health_score_tooltip', { avail: data.availability_weight, rot: data.rotation_weight })}>
                            <Info className="w-4 h-4 text-base-content/20 cursor-help" />
                        </div>
                    </div>
                    <p className="relative text-sm text-base-content/40 font-medium mt-1">
                        {t('stock:analyse.dashboard.health_score_desc')}
                    </p>
                </div>

                {/* Financial Impact Cards */}
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Lost Revenue Card */}
                    <div 
                        onMouseMove={handleMouseMove}
                        className="expert-card stagger-2 bg-base-100 p-8 rounded-[40px] border border-red-100 shadow-sm relative overflow-hidden group hover:shadow-xl hover:shadow-red-500/5 transition-all duration-500"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity animate-float">
                            <TrendingDown className="w-24 h-24 text-red-600" />
                        </div>
                        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6 font-bold shadow-inner">
                            <AlertCircle className="w-7 h-7" />
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-600/50">
                                {t('stock:analyse.dashboard.missed_sales')}
                            </div>
                            <div className="tooltip tooltip-left" data-tip={t('stock:analyse.dashboard.missed_sales_tooltip')}>
                                <Info className="w-3.5 h-3.5 text-red-600/30 cursor-help" />
                            </div>
                        </div>
                        <div className="text-3xl font-black text-red-600 tracking-tighter mb-2">
                           -<AnimatedNumber 
                                value={data.missed_sales.monthly_revenue} 
                                formatValue={(v) => formatCurrency(v)} 
                            />
                        </div>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="flex items-center gap-2 text-sm font-bold text-red-600/60 bg-red-50 w-fit px-3 py-1 rounded-full">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></div>
                                {t('stock:analyse.dashboard.lost_revenue_label')}
                            </div>
                        </div>

                        <button 
                            onClick={() => navigate('/app/commandes', { state: { action: 'OPEN_SUGGESTIONS', mode: 'optimise' } })}
                            className="btn btn-sm btn-error text-white rounded-xl gap-2 shadow-lg shadow-red-500/20 hover:scale-105 active:scale-95 transition-all w-full md:w-auto h-11"
                        >
                            <ShoppingCart className="w-4 h-4" />
                            {t('stock:analyse.dashboard.fix_ruptures_btn')}
                        </button>
                        
                        <p className="mt-4 text-xs text-base-content/40 font-medium leading-relaxed italic">
                            {t('stock:analyse.dashboard.lost_revenue_desc')}
                        </p>
                    </div>

                    {/* Dead Capital Card */}
                    <div 
                        onMouseMove={handleMouseMove}
                        className="expert-card stagger-3 bg-base-100 p-8 rounded-[40px] border border-amber-100 shadow-sm relative overflow-hidden group hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-500"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity animate-float">
                            <Clock className="w-24 h-24 text-amber-600" />
                        </div>
                        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-6 shadow-inner">
                            <Wallet className="w-7 h-7" />
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-600/50">
                                {t('stock:analyse.dashboard.dead_stock')}
                            </div>
                            <div className="tooltip tooltip-left" data-tip={t('stock:analyse.dashboard.dead_stock_tooltip')}>
                                <Info className="w-3.5 h-3.5 text-amber-600/30 cursor-help" />
                            </div>
                        </div>
                        <div className="text-3xl font-black text-amber-600 tracking-tighter mb-2">
                            <AnimatedNumber 
                                value={data.dead_stock.value} 
                                formatValue={(v) => formatCurrency(v)} 
                            />
                        </div>
                        <div className="flex items-center gap-2 mb-6">
                           <div className="flex items-center gap-2 text-sm font-bold text-amber-600/60 bg-amber-50 w-fit px-3 py-1 rounded-full">
                                {t('stock:analyse.dashboard.dead_stock_impact', { count: data.dead_stock.count, days: data.dead_stock.days_threshold })}
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                            className="btn btn-sm bg-amber-500 hover:bg-amber-600 text-white border-none rounded-xl gap-2 shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all w-full md:w-auto h-11"
                        >
                            <Filter className="w-4 h-4" />
                            {t('stock:analyse.dashboard.optimize_cash_btn')}
                        </button>

                        <p className="mt-4 text-xs text-base-content/40 font-medium leading-relaxed italic">
                            {t('stock:analyse.dashboard.dead_stock_desc', { days: data.dead_stock.days_threshold })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Sub Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div 
                    onMouseMove={handleMouseMove}
                    className="expert-card stagger-4 bg-base-100 p-6 rounded-[24px] border border-base-200 shadow-sm flex items-center gap-4 group hover:border-emerald-500/30 transition-all"
                >
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-black uppercase text-base-content/30 tracking-widest">
                                {t('stock:analyse.dashboard.availability')}
                            </div>
                            <div className="tooltip tooltip-top" data-tip={t('stock:analyse.dashboard.availability_tooltip')}>
                                <Info className="w-3 h-3 text-base-content/20" />
                            </div>
                        </div>
                        <div className="text-lg font-black text-base-content">
                            <AnimatedNumber value={data.availability_rate} />%
                        </div>
                    </div>
                </div>

                <div 
                    onMouseMove={handleMouseMove}
                    className="expert-card stagger-4 bg-base-100 p-6 rounded-[24px] border border-base-200 shadow-sm flex items-center gap-4 group hover:border-indigo-500/30 transition-all"
                >
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-black uppercase text-base-content/30 tracking-widest">
                                {t('stock:analyse.dashboard.rotation')}
                            </div>
                            <div className="tooltip tooltip-top" data-tip={t('stock:analyse.dashboard.rotation_tooltip')}>
                                <Info className="w-3 h-3 text-base-content/20" />
                            </div>
                        </div>
                        <div className="text-lg font-black text-base-content">
                            <AnimatedNumber value={data.rotation_rate} />%
                        </div>
                    </div>
                </div>

                <div 
                    onMouseMove={handleMouseMove}
                    className="expert-card stagger-4 bg-base-100 p-6 rounded-[24px] border border-base-200 shadow-sm flex items-center gap-4 group hover:border-rose-500/30 transition-all"
                >
                    <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-black uppercase text-base-content/30 tracking-widest">
                                {t('stock:analyse.dashboard.imminent_shortages')}
                            </div>
                            <div className="tooltip tooltip-top" data-tip={t('stock:analyse.dashboard.imminent_shortages_tooltip')}>
                                <Info className="w-3 h-3 text-base-content/20" />
                            </div>
                        </div>
                        <div className="text-lg font-black text-base-content">
                            <AnimatedNumber value={data.critical_alerts.soon_out_of_stock_count} />
                        </div>
                    </div>
                </div>

                <div 
                    onMouseMove={handleMouseMove}
                    className="expert-card stagger-4 bg-base-100 p-6 rounded-[24px] border border-base-200 shadow-sm flex items-center gap-4 group hover:border-emerald-500/30 transition-all"
                >
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-black uppercase text-base-content/30 tracking-widest">
                                {t('stock:analyse.dashboard.total_stock_value')}
                            </div>
                            <div className="tooltip tooltip-top" data-tip={t('stock:analyse.dashboard.total_stock_value_tooltip')}>
                                <Info className="w-3 h-3 text-base-content/20" />
                            </div>
                        </div>
                        <div className="text-lg font-black text-base-content">
                            <AnimatedNumber 
                                value={data.total_stock_value} 
                                formatValue={(v) => formatCurrency(v)} 
                            />
                        </div>
                    </div>
                </div>
            </div>

            <StockHealthSettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)}
                onSaved={refresh}
            />
        </div>
    );
};

export default StockHealthDashboard;
