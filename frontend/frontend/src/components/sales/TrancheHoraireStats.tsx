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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <Clock className="size-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">
                            {t('sales:tranche_horaire.title')}
                        </h3>
                        <p className="text-xs text-gray-500">
                            {t('sales:tranche_horaire.subtitle')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('sales:tranche_horaire.start_time')}</label>
                    <input
                        type="time"
                        lang={getLocale()}
                        className="rounded-lg border border-gray-200 bg-white h-9 px-3 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 outline-none transition-all"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('sales:tranche_horaire.end_time')}</label>
                    <input
                        type="time"
                        lang={getLocale()}
                        className="rounded-lg border border-gray-200 bg-white h-9 px-3 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 outline-none transition-all"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                    />
                </div>
                <button
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                    onClick={fetchTrancheStats}
                    disabled={loading}
                >
                    {loading ? <span className="inline-block size-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="size-4" />}
                    {t('sales:tranche_horaire.verify_btn')}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                    <span>⚠️</span> {error}
                </div>
            )}

        </div>
    );
};
