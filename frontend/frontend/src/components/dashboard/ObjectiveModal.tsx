import React from 'react';
import { useTranslation } from 'react-i18next';
import { Target, X, Save } from 'lucide-react';
import type { EditingObjectif } from '../../hooks/useManagerDashboard';

interface ObjectiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    objective: EditingObjectif;
    onChange: (objective: EditingObjectif) => void;
    onSave: () => void;
}

export const ObjectiveModal: React.FC<ObjectiveModalProps> = ({
    isOpen,
    onClose,
    objective,
    onChange,
    onSave
}) => {
    const { t } = useTranslation(['dashboard', 'common']);

    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box rounded-xl border border-gray-200 shadow-sm p-0 overflow-hidden max-w-lg">
                <div className="bg-base-100 p-6 border-b border-gray-100 relative">
                    <button 
                        onClick={onClose}
                        className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4"
                    >
                        <X className="size-4" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <Target className="size-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-xl text-gray-900">
                                {t('manager_dashboard.modal_title', 'Fixer un Objectif')}
                            </h3>
                            <p className="text-gray-500 text-xs">
                                {t('manager_dashboard.modal_subtitle', "Définissez vos cibles de Marge Brute")}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 space-y-4 bg-base-100">
                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text font-bold text-xs uppercase tracking-widest text-gray-500">
                                {t('manager_dashboard.period_label', 'Période')}
                            </span>
                        </label>
                        <select 
                            className="select select-bordered rounded-xl font-bold bg-gray-50"
                            value={objective.periode}
                            onChange={(e) => onChange({...objective, periode: e.target.value})}
                        >
                            <option value="JOUR">{t('manager_dashboard.periods.daily', 'Journalier')}</option>
                            <option value="SEMAINE">{t('manager_dashboard.periods.weekly', 'Hebdomadaire')}</option>
                            <option value="MOIS">{t('manager_dashboard.periods.monthly', 'Mensuel')}</option>
                        </select>
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text font-bold text-xs uppercase tracking-widest text-gray-500">
                                {t('manager_dashboard.ca_target_label', "Marge Brute Cible (F)")}
                            </span>
                        </label>
                        <input 
                            type="number" 
                            placeholder={t('manager_dashboard.ca_target_placeholder', 'Ex: 500000')} 
                            className="input input-bordered rounded-xl font-black text-2xl bg-gray-50 h-16"
                            value={objective.ca_objectif}
                            onChange={(e) => onChange({...objective, ca_objectif: e.target.value})}
                        />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text font-bold text-xs uppercase tracking-widest text-gray-500">
                                {t('manager_dashboard.start_date_label', 'Date de Début')}
                            </span>
                        </label>
                        <input 
                            type="date" 
                            className="input input-bordered rounded-xl font-bold bg-gray-50 h-12"
                            value={objective.date_debut}
                            onChange={(e) => onChange({...objective, date_debut: e.target.value})}
                        />
                        <label className="label">
                            <span className="label-text-alt text-gray-400 font-medium">
                                 {t('manager_dashboard.date_help', 'Ex: Lundi pour hebdomadaire, 1er du mois pour mensuel')}
                            </span>
                        </label>
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-gray-100">
                        <button 
                            onClick={onClose} 
                            className="btn btn-ghost flex-1 rounded-xl font-bold uppercase text-xs"
                        >
                            {t('common:cancel')}
                        </button>
                        <button 
                            onClick={onSave} 
                            className="btn btn-primary flex-1 rounded-xl font-bold uppercase text-xs gap-2"
                        >
                            <Save className="size-4" />
                            {t('common:save')}
                        </button>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop bg-base-content/20 backdrop-blur-sm" onClick={onClose}></div>
        </div>
    );
};

