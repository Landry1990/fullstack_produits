import React, { useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, AlertTriangle, TrendingUp, PieChart } from 'lucide-react';
import { formatPrice } from '../../../utils/formatters';
import type { InventoryStats } from '../../../types';
import api from '../../../services/api';
import { toast } from 'react-hot-toast';

// Composant séparé pour éviter les re-renders
interface StatsListProps {
    title: string;
    data: any[];
    type: 'negative' | 'positive';
    t: any;
}

const StatsList = memo(({ title, data, type, t }: StatsListProps) => {
    const Icon = type === 'negative' ? AlertTriangle : TrendingUp;
    const colorClass = type === 'negative' ? 'text-error' : 'text-success';
    const bgColorClass = type === 'negative' ? 'bg-error/10' : 'bg-success/10';

    return (
        <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
            <div className={`p-4 border-b border-base-200 flex items-center gap-3 ${bgColorClass}`}>
                <Icon className={`h-5 w-5 ${colorClass}`} />
                <h3 className="font-bold text-sm">{title}</h3>
                <span className={`ml-auto text-xs font-bold ${colorClass} bg-base-100/50 px-2 py-1 rounded-full`}>
                    {data?.length || 0}
                </span>
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
                                <div className={`size-8 rounded-lg bg-base-200 flex items-center justify-center text-xs font-bold text-base-content/40 group-hover:${bgColorClass} group-hover:${colorClass} transition-colors`}>
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
});

interface InventaireAnalysisTabProps {
    inventoryStats: InventoryStats;
    handlePrintEcartsFrontend: () => void;
    inventaireId?: number;
}

export const InventaireAnalysisTab: React.FC<InventaireAnalysisTabProps> = ({
    inventoryStats,
    handlePrintEcartsFrontend,
    inventaireId
}) => {
    const { t } = useTranslation(['stock', 'common']);
    const [sendingTelegram, setSendingTelegram] = useState(false);

    const handleSendTelegram = async () => {
        setSendingTelegram(true);
        try {
            await api.post('telegram/rapport-inventaire/', inventaireId ? { inventaire_id: inventaireId } : {});
            toast.success(t('common:telegram.send_success'), { icon: '📨' });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || t('common:telegram.send_error'));
        } finally {
            setSendingTelegram(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StatsList
                    title={t('inventaire.analysis.top_losses')}
                    data={inventoryStats?.top_pertes || []}
                    type="negative"
                    t={t}
                />
                <StatsList
                    title={t('inventaire.analysis.top_surplus')}
                    data={inventoryStats?.top_surplus || []}
                    type="positive"
                    t={t}
                />
            </div>

            {/* Print action at bottom */}
            {(inventoryStats?.top_pertes?.length > 0 || inventoryStats?.top_surplus?.length > 0) && (
                <div className="flex justify-center gap-3">
                    <button 
                        className="btn btn-ghost hover:bg-base-300 rounded-xl gap-2 text-base-content/40 hover:text-primary transition-all px-8"
                        onClick={handlePrintEcartsFrontend}
                    >
                        <Download className="h-5 w-5" />
                        {t('inventaire.analysis.print_report')}
                    </button>
                    <button
                        className={`btn rounded-xl gap-2 px-8 text-[#229ED9] border-[#229ED9]/30 hover:bg-[#229ED9]/10 hover:border-[#229ED9] transition-all ${sendingTelegram ? 'loading' : ''}`}
                        onClick={handleSendTelegram}
                        disabled={sendingTelegram}
                        title={t('common:telegram.inventory_report')}
                    >
                        {!sendingTelegram && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.67l-2.93-.918c-.638-.196-.65-.638.136-.943l11.434-4.41c.53-.194.995.131.822.943z"/>
                            </svg>
                        )}
                        Envoyer sur Telegram
                    </button>
                </div>
            )}
        </div>
    );
};
