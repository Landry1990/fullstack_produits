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
                    className="lg:col-span-4 expert-card stagger-1 bg-base-100 p-8 rounded-[40px] border border-base-200 shadow-sm flex flex-col items-center justify-center text-center relative group !overflow-visible [&::after]:rounded-[40px] z-10 hover:z-[100]"
                >
                    <div className={`absolute inset-0 rounded-[40px] opacity-5 ${getScoreBg(data.health_score)} transition-colors duration-500`}></div>
                    
                    {/* Settings Trigger */}
                    <div className="absolute top-6 right-6 flex gap-2">
                         <button 
                            onClick={() => setIsSettingsOpen(true)}
                            className="btn btn-circle btn-ghost btn-sm bg-base-200/50 text-base-content/40 hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <Settings className="size-4" />
                        </button>
                        <button 
                            onClick={refresh}
                            className="btn btn-circle btn-ghost btn-sm bg-base-200/50 text-base-content/40 hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <RefreshCw className="size-4" />
                        </button>
                    </div>

                    <div className="relative">
                        <div className={`size-36 rounded-full border-8 border-base-200 flex items-center justify-center mb-6 transition-all duration-1000 group-hover:scale-105 shadow-[0_0_40px_rgba(0,0,0,0.02)]`}>
                            <span className={`text-5xl font-black tracking-tighter ${getScoreColor(data.health_score)}`}>
                                <AnimatedNumber value={data.health_score} />
                                <span className="text-2xl ml-0.5">%</span>
                            </span>
                            {/* SVG Ring for Circular Progress */}
                            <svg className="absolute size-36 -rotate-90">
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
                        <div className="dropdown dropdown-hover dropdown-end dropdown-bottom">
                            <label tabIndex={0} className="cursor-help">
                                <Info className="size-4 text-base-content/40 hover:text-base-content transition-colors" />
                            </label>
                            <div tabIndex={0} className="dropdown-content z-[100] card card-compact w-72 p-2 shadow-xl bg-base-100 border border-base-200 text-left mt-2">
                                <div className="card-body">
                                    <h4 className="font-bold text-sm text-base-content mb-1">Interprétation du Score</h4>
                                    <ul className="text-xs space-y-2">
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 font-bold w-12 shrink-0">&ge; 80%</span> 
                                            <span className="text-base-content/80"><strong>Sain</strong> : Stock optimal, peu de ruptures, rotation fluide.</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-amber-500 font-bold w-12 shrink-0">50-79%</span> 
                                            <span className="text-base-content/80"><strong>Moyen</strong> : Attention à l'accumulation de stock dormant ou aux ruptures à venir.</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-rose-500 font-bold w-12 shrink-0">&lt; 50%</span> 
                                            <span className="text-base-content/80"><strong>Critique</strong> : Fort dysfonctionnement. Trop de liquidités immobilisées ou trop de ventes manquées.</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
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
                        className="expert-card stagger-2 bg-base-100 p-8 rounded-[40px] border border-red-100 shadow-sm relative group hover:shadow-xl hover:shadow-red-500/5 transition-all duration-500 !overflow-visible [&::after]:rounded-[40px] z-10 hover:z-[100]"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity animate-float">
                            <TrendingDown className="size-24 text-red-600" />
                        </div>
                        <div className="size-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6 font-bold shadow-inner">
                            <AlertCircle className="size-7" />
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-600/50">
                                {t('stock:analyse.dashboard.missed_sales')}
                            </div>
                            <div className="dropdown dropdown-hover dropdown-end dropdown-bottom">
                                <label tabIndex={0} className="cursor-help">
                                    <Info className="size-3.5 text-red-600/50 hover:text-red-600 transition-colors" />
                                </label>
                                <div tabIndex={0} className="dropdown-content z-[100] card card-compact w-72 p-2 shadow-xl bg-base-100 border border-red-100 text-left mt-2">
                                    <div className="card-body">
                                        <h4 className="font-bold text-sm text-red-600 mb-1">Ventes Manquées</h4>
                                        <p className="text-xs text-base-content/80 whitespace-normal leading-relaxed">Estimation de la perte de chiffre d'affaires sur les 30 derniers jours à cause des ruptures de stock sur des produits habituellement très demandés.</p>
                                    </div>
                                </div>
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
                                <div className="size-1.5 rounded-full bg-red-600 animate-pulse"></div>
                                {t('stock:analyse.dashboard.lost_revenue_label')}
                            </div>
                        </div>

                        <button 
                            onClick={() => navigate('/app/commandes', { state: { action: 'OPEN_SUGGESTIONS', mode: 'optimise' } })}
                            className="btn btn-sm btn-error text-white rounded-xl gap-2 shadow-lg shadow-red-500/20 hover:scale-105 active:scale-95 transition-all w-full md:w-auto h-11"
                        >
                            <ShoppingCart className="size-4" />
                            {t('stock:analyse.dashboard.fix_ruptures_btn')}
                        </button>
                        
                        <p className="mt-4 text-xs text-base-content/40 font-medium leading-relaxed italic">
                            {t('stock:analyse.dashboard.lost_revenue_desc')}
                        </p>
                    </div>

                    {/* Dead Capital Card */}
                    <div 
                        onMouseMove={handleMouseMove}
                        className="expert-card stagger-3 bg-base-100 p-8 rounded-[40px] border border-amber-100 shadow-sm relative group hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-500 !overflow-visible [&::after]:rounded-[40px] z-10 hover:z-[100]"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity animate-float">
                            <Clock className="size-24 text-amber-600" />
                        </div>
                        <div className="size-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-6 shadow-inner">
                            <Wallet className="size-7" />
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-600/50">
                                {t('stock:analyse.dashboard.dead_stock')}
                            </div>
                            <div className="dropdown dropdown-hover dropdown-end dropdown-bottom">
                                <label tabIndex={0} className="cursor-help">
                                    <Info className="size-3.5 text-amber-600/50 hover:text-amber-600 transition-colors" />
                                </label>
                                <div tabIndex={0} className="dropdown-content z-[100] card card-compact w-72 p-2 shadow-xl bg-base-100 border border-amber-100 text-left mt-2">
                                    <div className="card-body">
                                        <h4 className="font-bold text-sm text-amber-600 mb-1">Stock Dormant</h4>
                                        <p className="text-xs text-base-content/80 whitespace-normal leading-relaxed">Valeur d'achat totale des produits qui n'ont fait l'objet d'aucune vente depuis plus de {data.dead_stock.days_threshold} jours. C'est de l'argent immobilisé qui bloque votre trésorerie.</p>
                                    </div>
                                </div>
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
                            <Filter className="size-4" />
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
                    className="expert-card stagger-4 bg-base-100 p-6 rounded-[24px] border border-base-200 shadow-sm flex items-center gap-4 group hover:border-emerald-500/30 transition-all !overflow-visible [&::after]:rounded-[24px] z-10 hover:z-[100]"
                >
                    <div className="size-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="size-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-black uppercase text-base-content/30 tracking-widest">
                                {t('stock:analyse.dashboard.availability')}
                            </div>
                            <div className="dropdown dropdown-hover dropdown-top dropdown-start">
                                <label tabIndex={0} className="cursor-help">
                                    <Info className="size-3 text-base-content/20 hover:text-base-content transition-colors" />
                                </label>
                                <div tabIndex={0} className="dropdown-content z-[100] card card-compact w-56 p-2 shadow-xl bg-base-100 border border-base-200 text-left mb-2">
                                    <div className="card-body">
                                        <h4 className="font-bold text-sm text-base-content mb-1">Disponibilité</h4>
                                        <p className="text-xs text-base-content/80 whitespace-normal">Pourcentage de vos produits en catalogue qui sont actuellement en stock (quantité &gt; 0).</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="text-lg font-black text-base-content">
                            <AnimatedNumber value={data.availability_rate} />%
                        </div>
                    </div>
                </div>

                <div 
                    onMouseMove={handleMouseMove}
                    className="expert-card stagger-4 bg-base-100 p-6 rounded-[24px] border border-base-200 shadow-sm flex items-center gap-4 group hover:border-indigo-500/30 transition-all !overflow-visible [&::after]:rounded-[24px] z-10 hover:z-[100]"
                >
                    <div className="size-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <Activity className="size-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-black uppercase text-base-content/30 tracking-widest">
                                {t('stock:analyse.dashboard.rotation')}
                            </div>
                            <div className="dropdown dropdown-hover dropdown-top dropdown-start">
                                <label tabIndex={0} className="cursor-help">
                                    <Info className="size-3 text-base-content/20 hover:text-base-content transition-colors" />
                                </label>
                                <div tabIndex={0} className="dropdown-content z-[100] card card-compact w-56 p-2 shadow-xl bg-base-100 border border-base-200 text-left mb-2">
                                    <div className="card-body">
                                        <h4 className="font-bold text-sm text-base-content mb-1">Rotation</h4>
                                        <p className="text-xs text-base-content/80 whitespace-normal">Part de vos produits qui ont généré au moins une vente récemment, indiquant la fluidité de votre stock.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="text-lg font-black text-base-content">
                            <AnimatedNumber value={data.rotation_rate} />%
                        </div>
                    </div>
                </div>

                <div 
                    onMouseMove={handleMouseMove}
                    className="expert-card stagger-4 bg-base-100 p-6 rounded-[24px] border border-base-200 shadow-sm flex items-center gap-4 group hover:border-rose-500/30 transition-all !overflow-visible [&::after]:rounded-[24px] z-10 hover:z-[100]"
                >
                    <div className="size-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
                        <AlertCircle className="size-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-black uppercase text-base-content/30 tracking-widest">
                                {t('stock:analyse.dashboard.imminent_shortages')}
                            </div>
                            <div className="dropdown dropdown-hover dropdown-top dropdown-start">
                                <label tabIndex={0} className="cursor-help">
                                    <Info className="size-3 text-base-content/20 hover:text-base-content transition-colors" />
                                </label>
                                <div tabIndex={0} className="dropdown-content z-[100] card card-compact w-56 p-2 shadow-xl bg-base-100 border border-base-200 text-left mb-2">
                                    <div className="card-body">
                                        <h4 className="font-bold text-sm text-base-content mb-1">Ruptures Imminentes</h4>
                                        <p className="text-xs text-base-content/80 whitespace-normal">Nombre de produits dont le niveau de stock a atteint ou est en dessous du seuil minimum défini.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="text-lg font-black text-base-content">
                            <AnimatedNumber value={data.critical_alerts.soon_out_of_stock_count} />
                        </div>
                    </div>
                </div>

                <div 
                    onMouseMove={handleMouseMove}
                    className="expert-card stagger-4 bg-base-100 p-6 rounded-[24px] border border-base-200 shadow-sm flex items-center gap-4 group hover:border-emerald-500/30 transition-all !overflow-visible [&::after]:rounded-[24px] z-10 hover:z-[100]"
                >
                    <div className="size-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                        <DollarSign className="size-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-black uppercase text-base-content/30 tracking-widest">
                                {t('stock:analyse.dashboard.total_stock_value')}
                            </div>
                            <div className="dropdown dropdown-hover dropdown-top dropdown-end">
                                <label tabIndex={0} className="cursor-help">
                                    <Info className="size-3 text-base-content/20 hover:text-base-content transition-colors" />
                                </label>
                                <div tabIndex={0} className="dropdown-content z-[100] card card-compact w-56 p-2 shadow-xl bg-base-100 border border-base-200 text-left mb-2">
                                    <div className="card-body">
                                        <h4 className="font-bold text-sm text-base-content mb-1">Valeur Totale</h4>
                                        <p className="text-xs text-base-content/80 whitespace-normal">Valeur totale d'achat de l'ensemble de votre stock physique disponible.</p>
                                    </div>
                                </div>
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
