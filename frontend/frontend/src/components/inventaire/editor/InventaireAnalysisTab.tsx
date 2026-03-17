import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, AlertTriangle, TrendingUp, PieChart } from 'lucide-react';
import { formatPrice } from '../../../utils/formatters';
import type { InventoryStats } from '../../../types';

interface InventaireAnalysisTabProps {
    inventoryStats: InventoryStats;
    handlePrintEcartsFrontend: () => void;
}

export const InventaireAnalysisTab: React.FC<InventaireAnalysisTabProps> = ({
    inventoryStats,
    handlePrintEcartsFrontend
}) => {
    const { t } = useTranslation(['stock', 'common']);

    const renderList = (title: string, data: any[], type: 'negative' | 'positive') => {
        const Icon = type === 'negative' ? AlertTriangle : TrendingUp;
        const colorClass = type === 'negative' ? 'text-error' : 'text-success';
        const bgColorClass = type === 'negative' ? 'bg-error/10' : 'bg-success/10';

        return (
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-base-200 bg-base-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-base-content flex items-center gap-3">
                        <div className={`p-2 ${bgColorClass} rounded-xl`}>
                            <Icon className={`h-5 w-5 ${colorClass}`} />
                        </div>
                        {title}
                    </h3>
                </div>
                <div className="p-0 flex-1 overflow-y-auto max-h-[500px]">
                    {!data || data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-12 gap-3 opacity-20">
                            <PieChart className="h-10 w-10" />
                            <p className="text-sm font-medium">{t('inventaire.analysis.no_data', { defaultValue: 'Aucune donnée' })}</p>
                        </div>
                    ) : (
                        data.map((p, i) => (
                            <div key={i} className="group flex items-center justify-between p-4 border-b border-base-100 hover:bg-base-200/50 transition-colors last:border-0">
                                <div className="flex items-center gap-4">
                                    <div className={`w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center text-xs font-bold text-base-content/40 group-hover:${bgColorClass} group-hover:${colorClass} transition-colors`}>
                                        {i + 1}
                                    </div>
                                    <div className="max-w-[150px] md:max-w-xs">
                                        <div className="font-bold text-sm text-base-content group-hover:text-primary transition-colors truncate">{p.produit_nom}</div>
                                        <div className={`text-[10px] font-bold ${colorClass}/60 uppercase tracking-tight mt-0.5`}>
                                            {p.ecart > 0 ? '+' : ''}{p.ecart} {t('common:units_short', 'unités')}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-mono font-bold ${colorClass}`}>
                                        {p.valeur > 0 ? '+' : ''}{formatPrice(p.valeur)} F
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {renderList(
                    t('inventaire.analysis.top_losses'), 
                    inventoryStats?.top_pertes || [], 
                    'negative'
                )}
                {renderList(
                    t('inventaire.analysis.top_surplus'), 
                    inventoryStats?.top_surplus || [], 
                    'positive'
                )}
            </div>

            {/* Print action at bottom */}
            {(inventoryStats?.top_pertes?.length > 0 || inventoryStats?.top_surplus?.length > 0) && (
                <div className="flex justify-center">
                    <button 
                        className="btn btn-ghost hover:bg-base-300 rounded-xl gap-2 text-base-content/40 hover:text-primary transition-all px-8"
                        onClick={handlePrintEcartsFrontend}
                    >
                        <Download className="h-5 w-5" />
                        {t('inventaire.analysis.print_report')}
                    </button>
                </div>
            )}
        </div>
    );
};
