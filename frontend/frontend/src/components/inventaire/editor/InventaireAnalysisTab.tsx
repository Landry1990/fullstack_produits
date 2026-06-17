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
    const colorClass = type === 'negative' ? 'text-red-500' : 'text-emerald-600';
    const bgColorClass = type === 'negative' ? 'bg-red-50' : 'bg-emerald-50';
    const borderClass = type === 'negative' ? 'border-red-100' : 'border-emerald-100';

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className={`p-4 border-b border-slate-100 flex items-center gap-3 ${bgColorClass}`}>
                <Icon className={`h-5 w-5 ${colorClass}`} />
                <h3 className="font-bold text-sm text-slate-700">{title}</h3>
                <span className={`ml-auto text-xs font-bold ${colorClass} bg-white/70 px-2 py-1 rounded-full border ${borderClass}`}>
                    {data?.length || 0}
                </span>
            </div>
            <div className="p-0 flex-1 overflow-y-auto max-h-[500px]">
                {!data || data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 gap-3 text-slate-200">
                        <PieChart className="h-10 w-10" />
                        <p className="text-sm font-medium text-slate-400">{t('inventaire.analysis.no_data', { defaultValue: 'Aucune donnée' })}</p>
                    </div>
                ) : (
                    data.map((p, i) => (
                        <div key={i} className="group flex items-center justify-between p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0">
                            <div className="flex items-center gap-4">
                                <div className={`size-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:${bgColorClass} group-hover:${colorClass} transition-colors`}>
                                    {i + 1}
                                </div>
                                <div className="max-w-[150px] md:max-w-xs">
                                    <div className="font-bold text-sm text-slate-700 group-hover:text-emerald-600 transition-colors truncate">{p.produit_nom}</div>
                                    <div className={`text-[10px] font-bold uppercase tracking-tight mt-0.5 ${colorClass}`}>
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
                        className="inline-flex items-center justify-center h-10 px-8 rounded-xl gap-2 text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-emerald-600 transition-all"
                        onClick={handlePrintEcartsFrontend}
                    >
                        <Download className="h-5 w-5" />
                        {t('inventaire.analysis.print_report')}
                    </button>
                    <button
                        className="inline-flex items-center justify-center h-10 px-8 rounded-xl gap-2 text-sm font-bold text-[#229ED9] border border-[#229ED9]/30 hover:bg-[#229ED9]/10 hover:border-[#229ED9] transition-all disabled:opacity-60"
                        onClick={handleSendTelegram}
                        disabled={sendingTelegram}
                        title={t('common:telegram.inventory_report')}
                    >
                        {sendingTelegram
                            ? <div className="animate-spin rounded-full size-4 border-b-2 border-[#229ED9]"></div>
                            : (
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
