import { useTranslation } from 'react-i18next';
import { PlusCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useManagerDashboard } from '../hooks/useManagerDashboard';
import { ManagerKPIs } from './dashboard/ManagerKPIs';
import { ManagerAlerts } from './dashboard/ManagerAlerts';
import { ManagerObjectives } from './dashboard/ManagerObjectives';
import { FinancialReports } from './dashboard/FinancialReports';
import { ObjectiveModal } from './dashboard/ObjectiveModal';
import { ObjectivesSettings } from './dashboard/ObjectivesSettings';
import { Settings } from 'lucide-react';

export default function DashboardManager() {
    const { t } = useTranslation(['dashboard', 'common']);
    const {
        stats,
        statsLoading,
        currentObj,
        isModalOpen,
        setIsModalOpen,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
        exporting,
        editingObjectif,
        setEditingObjectif,
        actions
    } = useManagerDashboard();

    if (statsLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
                <div className="size-10 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-gray-400 uppercase tracking-widest animate-pulse">
                    {t('manager_dashboard.loading', 'Chargement du tableau de bord...')}
                </p>
            </div>
        );
    }

    const kpis = stats?.kpis || {
        jour: { actual: 0, target: 0, rate: 0 },
        semaine: { actual: 0, target: 0, rate: 0 },
        mois: { actual: 0, target: 0, rate: 0 }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 space-y-5 font-sans">
            <Toaster position="top-right" />

            <div className="max-w-[1600px] mx-auto space-y-5">
                {/* Header Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                                {t('manager_dashboard.title', 'Tableau de Bord')}
                                <span className="text-indigo-600 ml-2 uppercase text-lg font-black">{t('manager_dashboard.manager', 'Manager')}</span>
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">
                                {t('manager_dashboard.subtitle', 'Suivi de la Marge Brute et couverture des charges')}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsSettingsModalOpen(true)}
                                className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                                title={t('manager_dashboard.settings_tooltip')}
                            >
                                <Settings className="size-5" />
                            </button>
                            <button
                                onClick={() => actions.openObjectiveModal()}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                <PlusCircle className="size-5" />
                                <span className="hidden sm:inline">
                                    {t('manager_dashboard.set_objective', 'Fixer un Objectif')}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* KPI Progression Cards */}
                <ManagerKPIs kpis={kpis} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Alerts Section */}
                    <ManagerAlerts alerts={stats?.alerts} />

                    {/* Objectives Overview */}
                    <ManagerObjectives 
                        currentObj={currentObj} 
                        onEdit={actions.openObjectiveModal}
                        onRefresh={actions.refetchStats}
                    />
                </div>

                {/* Financial Exports Section */}
                <FinancialReports 
                    onExport={actions.handleExport} 
                    exporting={exporting} 
                />
            </div>

            {/* Objective Modal */}
            <ObjectiveModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                objective={editingObjectif}
                onChange={setEditingObjectif}
                onSave={actions.handleSaveObjectif}
            />

            <ObjectivesSettings 
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
            />
        </div>
    );
}
