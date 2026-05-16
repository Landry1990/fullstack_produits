import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, BarChart3, TrendingUp, Trophy, Zap } from 'lucide-react';
import Confetti from 'react-confetti';

interface ProgressBarProps {
    rate: number;
    colorClass?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ rate, colorClass = 'bg-primary' }) => {
    const displayRate = Math.min(rate, 100);
    return (
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner border border-gray-200">
            <div 
                className={`h-full transition-all duration-1000 ease-out fill-mode-forwards rounded-full ${colorClass}`}
                style={{ width: `${displayRate}%` }}
            />
        </div>
    );
};

import { formatCurrency as formatCurrencyStandard } from '../../utils/formatters';

interface KPIData {
    actual: number;
    margin?: number;
    target: number;
    rate: number;
}

interface ManagerKPIsProps {
    kpis: {
        jour: KPIData;
        semaine: KPIData;
        mois: KPIData;
    };
}

// Helper to calculate infinite stretch goals (Paliers)
// Each palier is +20% of the original target
const getPalierInfo = (actual: number, target: number) => {
    if (target === 0 || actual < target) return null;
    
    const factor = 0.20; // 20% steps
    const overflow = actual - target;
    const palierSteps = Math.floor(overflow / (target * factor));
    
    const currentPalier = palierSteps + 1; 
    const nextPalierLevel = currentPalier + 1;
    
    const nextPalierTarget = target * (1 + (nextPalierLevel - 1) * factor);
    
    return {
        level: nextPalierLevel,
        target: nextPalierTarget,
        rate: Math.min((actual / nextPalierTarget) * 100, 100)
    };
};

export const ManagerKPIs: React.FC<ManagerKPIsProps> = ({ kpis }) => {
    const { t } = useTranslation(['dashboard', 'common']);
    const currentLocale = t('common:locale', { defaultValue: 'fr-FR' });
    const currencySymbol = t('common:currency_symbol', 'F');

    const formatCurrencyLocal = (amount: number) => formatCurrencyStandard(amount, currentLocale, currencySymbol);

    const items = [
        {
            label: t('manager_dashboard.periods.today', "Aujourd'hui"),
            key: 'jour',
            color: 'bg-indigo-500',
            icon: <Calendar className="size-5" />,
            colorText: 'text-indigo-600'
        },
        {
            label: t('manager_dashboard.periods.week', 'Semaine'),
            key: 'semaine',
            color: 'bg-blue-500',
            icon: <BarChart3 className="size-5" />,
            colorText: 'text-blue-600'
        },
        {
            label: t('manager_dashboard.periods.month', 'Mois'),
            key: 'mois',
            color: 'bg-amber-500',
            icon: <TrendingUp className="size-5" />,
            colorText: 'text-amber-600'
        }
    ];

    const [showConfetti, setShowConfetti] = useState(false);
    
    // Trigger confetti once if today's goal is reached
    useEffect(() => {
        if (kpis.jour?.rate >= 100 && kpis.jour?.target > 0) {
            // Check session storage to avoid spamming confetti on every render/navigation
            const todayStr = new Date().toISOString().split('T')[0];
            const confettiKey = `goal_reached_${todayStr}`;
            
            if (!sessionStorage.getItem(confettiKey)) {
                setShowConfetti(true);
                sessionStorage.setItem(confettiKey, 'true');
                
                // Stop confetti after 5 seconds
                setTimeout(() => setShowConfetti(false), 5000);
            }
        }
    }, [kpis.jour]);

    return (
        <div className="relative">
            {showConfetti && (
                <div className="fixed inset-0 z-[100] pointer-events-none flex justify-center items-center">
                    <Confetti 
                        width={window.innerWidth} 
                        height={window.innerHeight} 
                        recycle={false}
                        numberOfPieces={500}
                        gravity={0.15}
                    />
                </div>
            )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {items.map((item) => {
                const data = kpis[item.key as keyof typeof kpis];
                const isSuccess = data.rate >= 100 && data.target > 0;
                
                return (
                    <div key={item.key} className={`bg-white rounded-xl shadow-sm border ${isSuccess ? 'border-emerald-200 shadow-emerald-100 shadow-lg relative overflow-visible' : 'border-gray-200 overflow-hidden'} transition-all duration-500`}>
                        {isSuccess && (
                            <div className="absolute -top-3 -right-3 bg-emerald-500 text-white rounded-full p-2 shadow-lg animate-pulse z-10 scale-110">
                                <Trophy size={20} />
                            </div>
                        )}
                        <div className="p-6 h-full flex flex-col justify-between relative overflow-hidden">
                            {isSuccess && (
                                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-50 to-transparent pointer-events-none" />
                            )}
                            <div className="flex justify-between items-center mb-4 relative z-10">
                                <div className={`flex items-center gap-2 font-bold ${isSuccess ? 'text-emerald-600' : item.colorText} uppercase tracking-tight transition-colors duration-500`}>
                                    {item.icon}
                                    <span>{item.label}</span>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors duration-500 ${isSuccess ? 'bg-emerald-100 text-emerald-700 animate-pulse shadow-sm' : item.key === 'jour' ? 'bg-indigo-100 text-indigo-700' : item.key === 'semaine' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {Math.round(data.rate)}%
                                </span>
                            </div>
                            
                            <div className="mb-4 relative z-10">
                                <span className={`text-3xl font-black ${isSuccess ? 'text-emerald-600 drop-shadow-sm' : 'text-gray-900'} transition-colors duration-500`}>
                                    {formatCurrencyLocal(data.actual)}
                                </span>
                                {data.margin !== undefined && (
                                    <div className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-1">
                                        <TrendingUp size={12} className="text-emerald-500" />
                                        <span>{t('manager_dashboard.margin_label')} : {formatCurrencyLocal(data.margin)}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-tight opacity-50">
                                    <span>{t('manager_dashboard.progression', 'Progression')}</span>
                                    <span>{t('manager_dashboard.target', 'Cible')}: {formatCurrencyLocal(data.target)}</span>
                                </div>
                                <ProgressBar
                                    rate={data.rate}
                                    colorClass={isSuccess ? 'bg-emerald-500' : item.color}
                                />
                            </div>

                            {/* Section Palier / Stretch Goal */}
                            {isSuccess && (
                                <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
                                    {(() => {
                                        const palier = getPalierInfo(data.actual, data.target);
                                        if (!palier) return null;
                                        return (
                                            <>
                                                <div className="flex justify-between text-xs font-bold uppercase tracking-tight text-amber-600">
                                                    <span className="flex items-center gap-1"><Zap size={12} className="text-amber-500" /> {t('manager_dashboard.palier_label', { level: palier.level })}</span>
                                                    <span>{formatCurrencyLocal(palier.target)}</span>
                                                </div>
                                                <ProgressBar 
                                                    rate={palier.rate} 
                                                    colorClass="bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" 
                                                />
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
        </div>
    );
};
