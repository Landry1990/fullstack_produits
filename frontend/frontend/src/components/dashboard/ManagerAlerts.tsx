import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Zap } from 'lucide-react';

interface Alert {
    type: 'danger' | 'warning' | 'info';
    title_key: string;
    message_key: string;
    params?: Record<string, any>;
}

interface ManagerAlertsProps {
    alerts?: Alert[];
}

export const ManagerAlerts: React.FC<ManagerAlertsProps> = ({ alerts }) => {
    const { t } = useTranslation();

    return (
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-base-200">
                <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
                    <Zap className="w-5 h-5 text-warning fill-warning/20" /> 
                    {t('manager_dashboard.alerts_title', 'Alertes Intelligentes')}
                </h3>
            </div>
            
            <div className="p-6 space-y-4">
                {alerts && alerts.length > 0 ? (
                    alerts.map((alert, idx) => (
                        <div 
                            key={idx} 
                            className={`flex items-start gap-4 p-4 rounded-xl border ${
                                alert.type === 'danger' ? 'bg-error/5 border-error/20 text-error' : 
                                alert.type === 'warning' ? 'bg-warning/5 border-warning/20 text-warning' : 
                                'bg-info/5 border-info/20 text-info'
                            }`}
                        >
                            <AlertCircle className="w-5 h-5 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-sm uppercase tracking-tight">{t(alert.title_key)}</h4>
                                <p className="text-sm font-medium opacity-80 mt-1">{t(alert.message_key, alert.params)}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-base-content/20 font-medium">
                        <Zap className="w-12 h-12 opacity-10 mb-2" />
                        <p>{t('manager_dashboard.no_alerts', 'Aucune alerte pour le moment.')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
