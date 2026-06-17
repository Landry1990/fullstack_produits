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
            <div className="lg:col-span-4 h-80 bg-white rounded-[40px] border border-slate-200 animate-pulse"></div>
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-40 bg-white rounded-[40px] border border-slate-200 animate-pulse"></div>
                <div className="h-40 bg-white rounded-[40px] border border-slate-200 animate-pulse"></div>
            </div>
        </div>
    );

    if (error || !data) return null;

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-600';
        if (score >= 50) return 'text-amber-500';
        return 'text-red-500';
    };

    const getScoreBg = (score: number) => {
        if (score >= 80) return 'bg-emerald-50';
        if (score >= 50) return 'bg-amber-50';
        return 'bg-red-50';
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
                    className="lg:col-span-4 expert-card stagger-1 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col items-center justify-center relative group !overflow-visible z-10 hover:z-[100]"
                >
                    <div className={`absolute inset-0 rounded-[40px] opacity-5 ${getScoreBg(data.health_score)} transition-colors duration-500`}></div>

                    {/* Settings Trigger */}
                    <div className="absolute top-6 right-6 flex gap-2">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="inline-flex items-center justify-center rounded-full size-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <Settings className="size-4" />
                        </button>
                        <button
                            onClick={refresh}
                            className="inline-flex items-center justify-center rounded-full size-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <RefreshCw className="size-4" />
                        </button>
                    </div>

                    <div className="relative">
                        <div className="size-36 rounded-full border-8 border-slate-100 flex items-center justify-center mb-6 transition-all duration-1000 group-hover:scale-105">
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
                        <h3 className="text-xl font-black text-slate-800 tracking-tighter">
                            {t('stock:analyse.dashboard.health_score')}
                        </h3>
                        <div className="relative group/tooltip">
                            <Info className="size-4 text-slate-400 hover:text-slate-700 transition-colors cursor-help" />
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 hidden group-hover/tooltip:block z-[100] bg-white border border-slate-200 rounded-2xl shadow-xl p-4 text-left">
                                <h4 className="font-bold text-sm text-slate-700 mb-2">Interprétation du Score</h4>
                                <ul className="text-xs space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-600 font-bold w-12 shrink-0">&ge; 80%</span>
                                        <span className="text-slate-600"><strong>Sain</strong> : Stock optimal, peu de ruptures, rotation fluide.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-amber-500 font-bold w-12 shrink-0">50-79%</span>
                                        <span className="text-slate-600"><strong>Moyen</strong> : Attention à l'accumulation de stock dormant ou aux ruptures à venir.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500 font-bold w-12 shrink-0">&lt; 50%</span>
                                        <span className="text-slate-600"><strong>Critique</strong> : Fort dysfonctionnement. Trop de liquidités immobilisées ou trop de ventes manquées.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <p className="relative text-sm text-slate-400 font-medium mt-1">
                        {t('stock:analyse.dashboard.health_score_desc')}
                    </p>
                </div>

                {/* Financial Impact Cards */}
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Lost Revenue Card */}
                    <div
                        onMouseMove={handleMouseMove}
                        className="expert-card stagger-2 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative group hover:shadow-xl hover:shadow-red-500/5 transition-all duration-500 !overflow-visible z-10 hover:z-[100]"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <TrendingDown className="size-24 text-red-500" />
                        </div>
                        <div className="size-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                            <AlertCircle className="size-7" />
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                                {t('stock:analyse.dashboard.missed_sales')}
                            </div>
                            <div className="relative group/tip">
                                <Info className="size-3.5 text-red-300 hover:text-red-500 transition-colors cursor-help" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 hidden group-hover/tip:block z-[100] bg-white border border-slate-200 rounded-2xl shadow-xl p-4 text-left">
                                    <h4 className="font-bold text-sm text-red-500 mb-1">Ventes Manquées</h4>
                                    <p className="text-xs text-slate-600 whitespace-normal leading-relaxed">Estimation de la perte de chiffre d'affaires sur les 30 derniers jours à cause des ruptures de stock sur des produits habituellement très demandés.</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-3xl font-black text-red-500 tracking-tighter mb-2">
                            -<AnimatedNumber
                                value={data.missed_sales.monthly_revenue}
                                formatValue={(v) => formatCurrency(v)}
                            />
                        </div>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="flex items-center gap-2 text-sm font-bold text-red-400 bg-red-50 w-fit px-3 py-1 rounded-full">
                                <div className="size-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                {t('stock:analyse.dashboard.lost_revenue_label')}
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/app/commandes', { state: { action: 'OPEN_SUGGESTIONS', mode: 'optimise' } })}
                            className="inline-flex items-center justify-center h-11 px-4 text-sm font-bold bg-red-500 text-white hover:bg-red-600 rounded-xl gap-2 shadow-lg shadow-red-500/20 hover:scale-105 active:scale-95 transition-all w-full md:w-auto"
                        >
                            <ShoppingCart className="size-4" />
                            {t('stock:analyse.dashboard.fix_ruptures_btn')}
                        </button>

                        <p className="mt-4 text-xs text-slate-400 font-medium leading-relaxed italic">
                            {t('stock:analyse.dashboard.lost_revenue_desc')}
                        </p>
                    </div>

                    {/* Dead Capital Card */}
                    <div
                        onMouseMove={handleMouseMove}
                        className="expert-card stagger-3 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative group hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500 !overflow-visible z-10 hover:z-[100]"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Clock className="size-24 text-amber-500" />
                        </div>
                        <div className="size-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                            <Wallet className="size-7" />
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">
                                {t('stock:analyse.dashboard.dead_stock')}
                            </div>
                            <div className="relative group/tip">
                                <Info className="size-3.5 text-amber-400 hover:text-amber-600 transition-colors cursor-help" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 hidden group-hover/tip:block z-[100] bg-white border border-slate-200 rounded-2xl shadow-xl p-4 text-left">
                                    <h4 className="font-bold text-sm text-blue-600 mb-1">Stock Dormant</h4>
                                    <p className="text-xs text-slate-600 whitespace-normal leading-relaxed">Valeur d'achat totale des produits qui n'ont fait l'objet d'aucune vente depuis plus de {data.dead_stock.days_threshold} jours. C'est de l'argent immobilisé qui bloque votre trésorerie.</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-3xl font-black text-blue-600 tracking-tighter mb-2">
                            <AnimatedNumber
                                value={data.dead_stock.value}
                                formatValue={(v) => formatCurrency(v)}
                            />
                        </div>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="flex items-center gap-2 text-sm font-bold text-blue-400 bg-blue-50 w-fit px-3 py-1 rounded-full">
                                {t('stock:analyse.dashboard.dead_stock_impact', { count: data.dead_stock.count, days: data.dead_stock.days_threshold })}
                            </div>
                        </div>

                        <button
                            onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                            className="inline-flex items-center justify-center h-11 px-4 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2 shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all w-full md:w-auto"
                        >
                            <Filter className="size-4" />
                            {t('stock:analyse.dashboard.optimize_cash_btn')}
                        </button>

                        <p className="mt-4 text-xs text-slate-400 font-medium leading-relaxed italic">
                            {t('stock:analyse.dashboard.dead_stock_desc', { days: data.dead_stock.days_threshold })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Sub Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div
                    onMouseMove={handleMouseMove}
                    className="expert-card stagger-4 bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-emerald-300 transition-all !overflow-visible z-10 hover:z-[100]"
                >
                    <div className="size-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="size-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                {t('stock:analyse.dashboard.availability')}
                            </div>
                            <div className="relative group/tip">
                                <Info className="size-3 text-slate-400 hover:text-slate-700 transition-colors cursor-help" />
                                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 hidden group-hover/tip:block z-[100] bg-white border border-slate-200 rounded-2xl shadow-xl p-3 text-left">
                                    <h4 className="font-bold text-sm text-slate-700 mb-1">Disponibilité</h4>
                                    <p className="text-xs text-slate-500 whitespace-normal">Pourcentage de vos produits en catalogue qui sont actuellement en stock (quantité &gt; 0).</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-lg font-black text-slate-800">
                            <AnimatedNumber value={data.availability_rate} />%
                        </div>
                    </div>
                </div>

                <div
                    onMouseMove={handleMouseMove}
                    className="expert-card stagger-4 bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-blue-300 transition-all !overflow-visible z-10 hover:z-[100]"
                >
                    <div className="size-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        <Activity className="size-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                {t('stock:analyse.dashboard.rotation')}
                            </div>
                            <div className="relative group/tip">
                                <Info className="size-3 text-slate-400 hover:text-slate-700 transition-colors cursor-help" />
                                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 hidden group-hover/tip:block z-[100] bg-white border border-slate-200 rounded-2xl shadow-xl p-3 text-left">
                                    <h4 className="font-bold text-sm text-slate-700 mb-1">Rotation</h4>
                                    <p className="text-xs text-slate-500 whitespace-normal">Part de vos produits qui ont généré au moins une vente récemment, indiquant la fluidité de votre stock.</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-lg font-black text-slate-800">
                            <AnimatedNumber value={data.rotation_rate} />%
                        </div>
                    </div>
                </div>

                <div
                    onMouseMove={handleMouseMove}
                    className="expert-card stagger-4 bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-red-300 transition-all !overflow-visible z-10 hover:z-[100]"
                >
                    <div className="size-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                        <AlertCircle className="size-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                {t('stock:analyse.dashboard.imminent_shortages')}
                            </div>
                            <div className="relative group/tip">
                                <Info className="size-3 text-slate-400 hover:text-slate-700 transition-colors cursor-help" />
                                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 hidden group-hover/tip:block z-[100] bg-white border border-slate-200 rounded-2xl shadow-xl p-3 text-left">
                                    <h4 className="font-bold text-sm text-slate-700 mb-1">Ruptures Imminentes</h4>
                                    <p className="text-xs text-slate-500 whitespace-normal">Nombre de produits dont le niveau de stock a atteint ou est en dessous du seuil minimum défini.</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-lg font-black text-slate-800">
                            <AnimatedNumber value={data.critical_alerts.soon_out_of_stock_count} />
                        </div>
                    </div>
                </div>

                <div
                    onMouseMove={handleMouseMove}
                    className="expert-card stagger-4 bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-emerald-300 transition-all !overflow-visible z-10 hover:z-[100]"
                >
                    <div className="size-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                        <DollarSign className="size-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                {t('stock:analyse.dashboard.total_stock_value')}
                            </div>
                            <div className="relative group/tip">
                                <Info className="size-3 text-slate-400 hover:text-slate-700 transition-colors cursor-help" />
                                <div className="absolute right-0 top-full mt-2 w-56 hidden group-hover/tip:block z-[100] bg-white border border-slate-200 rounded-2xl shadow-xl p-3 text-left">
                                    <h4 className="font-bold text-sm text-slate-700 mb-1">Valeur Totale</h4>
                                    <p className="text-xs text-slate-500 whitespace-normal">Valeur totale d'achat de l'ensemble de votre stock physique disponible.</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-lg font-black text-slate-800">
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
