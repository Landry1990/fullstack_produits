import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Clock } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { CaisseParTranche } from '../../types';

interface SalesSessionStatsProps {
    session: CaisseParTranche | null;
}

export const SalesSessionStats: React.FC<SalesSessionStatsProps> = ({ session }) => {
    const { t } = useTranslation(['sales', 'common']);

    if (!session) return null;

    return (
        <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-6 text-primary-content shadow-xl shadow-primary/20 relative overflow-hidden group border border-white/10">
            <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
            
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 text-primary-content/90 bg-white/10 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
                        <TrendingUp className="w-3 h-3" />
                         {t('stats.session_total', { defaultValue: "Caisse Session" })}
                    </div>
                </div>

                <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-bold tracking-tight text-white">
                        {formatCurrency(parseFloat(session.total_ttc))}
                    </span>
                    <span className="text-xl font-medium text-primary-content/70">F</span>
                </div>

                <div className="flex flex-col gap-1 text-xs text-primary-content/80">
                   <div className="flex items-center gap-1.5 opacity-90">
                        <Clock className="w-3 h-3" />
                        Tranche: {session.tranche}
                   </div>
                   <div className="opacity-90">
                       {new Date(session.date_debut).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})} - {new Date(session.date_fin).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                   </div>
                   <div className="mt-1 font-medium bg-white/10 self-start px-2 py-0.5 rounded text-white">
                       {session.nombre_factures} ventes
                   </div>
                </div>
            </div>
        </div>
    );
};
