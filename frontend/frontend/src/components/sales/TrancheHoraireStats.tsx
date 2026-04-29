import React, { useState } from 'react';
import { Clock, Search } from 'lucide-react';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';


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
        } catch (err: any) {
            console.error("Failed to fetch tranche stats", err);
            setError(err.response?.data?.detail || t('sales:tranche_horaire.error_loading'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-base-200 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Clock className="w-5 h-5 text-primary" />
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
                <div className="form-control">
                    <label className="label py-1">
                        <span className="label-text text-xs font-semibold">{t('sales:tranche_horaire.start_time')}</span>
                    </label>
                    <input 
                        type="time" 
                        className="input input-bordered input-sm"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                    />
                </div>
                <div className="form-control">
                    <label className="label py-1">
                        <span className="label-text text-xs font-semibold">{t('sales:tranche_horaire.end_time')}</span>
                    </label>
                    <input 
                        type="time" 
                        className="input input-bordered input-sm"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                    />
                </div>
                <button 
                    className={`btn btn-primary btn-sm flex items-center gap-2 ${loading ? 'loading' : ''}`}
                    onClick={fetchTrancheStats}
                    disabled={loading}
                >
                    {!loading && <Search className="w-4 h-4" />}
                    {t('sales:tranche_horaire.verify_btn')}
                </button>
            </div>

            {error && (
                <div className="alert alert-error py-2 text-sm">
                    {error}
                </div>
            )}

        </div>
    );
};
