import React, { useState } from 'react';
import { Clock, Search } from 'lucide-react';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
import { getLocale } from '../../utils/dateUtils';
import { getApiErrorDetail } from '../../utils/errorHandling';


interface TrancheHoraireStatsProps {
    onVerify?: (data: any) => void;
    startDate: string;
    endDate: string;
}

export const TrancheHoraireStats: React.FC<TrancheHoraireStatsProps> = ({ onVerify, startDate, endDate }) => {
    const { t } = useTranslation(['sales', 'common']);
    const dateDebutStr = startDate || new Date().toISOString().split('T')[0];
    const dateFinStr = endDate || new Date().toISOString().split('T')[0];
    
    const [startTime, setStartTime] = useState("00:00");
    const [endTime, setEndTime] = useState("23:59");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTrancheStats = async () => {
        setLoading(true);
        setError(null);
        try {
            // Format to YYYY-MM-DDTHH:MM
            const dateDebut = `${dateDebutStr}T${startTime}`;
            const dateFin = `${dateFinStr}T${endTime}`;

            const response = await api.get('factures/caisse_par_tranche_horaire/', {
                params: { date_debut: dateDebut, date_fin: dateFin }
            });
            onVerify?.(response.data);
        } catch (err) {
            console.error("Failed to fetch tranche stats", err);
            setError(getApiErrorDetail(err, t('sales:tranche_horaire.error_loading')));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-base-200 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Clock className="size-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base-content">
                            {t('sales:tranche_horaire.title')}
                        </h3>
                        <p className="text-xs text-base-content/60">
                            {t('sales:tranche_horaire.subtitle')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
                <div>
                    <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('sales:tranche_horaire.start_time')}</label>
                    <input
                        type="time"
                        lang={getLocale()}
                        className="rounded-lg border border-base-300 bg-base-100 h-9 px-3 text-sm text-base-content focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('sales:tranche_horaire.end_time')}</label>
                    <input
                        type="time"
                        lang={getLocale()}
                        className="rounded-lg border border-base-300 bg-base-100 h-9 px-3 text-sm text-base-content focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                    />
                </div>
                <button
                    className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-focus transition-colors shadow-sm flex items-center gap-2 disabled:text-base-content/50"
                    onClick={fetchTrancheStats}
                    disabled={loading}
                >
                    {loading ? <span className="inline-block size-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="size-4" />}
                    {t('sales:tranche_horaire.verify_btn')}
                </button>
            </div>

            {error && (
                <div className="bg-error/10 border border-red-100 rounded-lg p-3 text-sm text-error flex items-center gap-2">
                    <span>⚠️</span> {error}
                </div>
            )}

        </div>
    );
};
