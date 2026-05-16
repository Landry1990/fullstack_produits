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
    const { t } = useTranslation(['dashboard', 'common']);

    return (
        <div className="bg-base-100 rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Zap className="size-5 text-amber-600 fill-warning/20" /> 
                    {t('manager_dashboard.alerts_title', 'Alertes Intelligentes')}
                </h3>
            </div>
            
            <div className="p-6 space-y-4">
                {alerts && alerts.length > 0 ? (
                    alerts.map((alert, idx) => (
                        <div 
                            key={idx} 
                            className={`flex items-start gap-4 p-4 rounded-xl border ${
                                alert.type === 'danger' ? 'bg-error/5 border-error/20 text-red-600' : 
                                alert.type === 'warning' ? 'bg-warning/5 border-warning/20 text-amber-600' : 
                                'bg-info/5 border-info/20 text-blue-600'
                            }`}
                        >
                            <AlertCircle className="size-5 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-sm uppercase tracking-tight">{t(alert.title_key)}</h4>
                                <p className="text-sm font-medium opacity-80 mt-1">{t(alert.message_key, alert.params)}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-300 font-medium">
                        <Zap className="size-12 opacity-10 mb-2" />
                        <p>{t('manager_dashboard.no_alerts', 'Aucune alerte pour le moment.')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
