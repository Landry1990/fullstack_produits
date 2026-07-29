import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { normalizeNumberInput } from '../../utils/formatters';
import { X, Save, TrendingUp, Target, Hand, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shadcn/button';

interface ObjectivesConfig {
    id?: number;
    mode: 'MANUEL' | 'FIXE' | 'DYNAMIQUE';
    seuil_rentabilite_mensuel: number;
    marge_objectif_mensuel: number;
    coefficient_marge: number;
    pourcentage_croissance: number;
    jours_ouverts_semaine: number;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const fetchConfig = async (): Promise<ObjectivesConfig> => {
    const response = await api.get('configuration-objectifs/1/');
    return response.data;
};

const updateConfig = async (data: ObjectivesConfig): Promise<ObjectivesConfig> => {
    const response = await api.patch('configuration-objectifs/1/', data);
    return response.data;
};

export function ObjectivesSettings({ isOpen, onClose }: Props) {
    const { t } = useTranslation(['dashboard', 'common']);
    const currentLocale = t('common:locale', { defaultValue: 'fr-FR' });
    const currencySymbol = t('common:currency_symbol', { defaultValue: 'F' });
    const formatCurrencyLocal = (val: number) => formatCurrency(val, currentLocale, currencySymbol);
    const queryClient = useQueryClient();
    const [config, setConfig] = useState<ObjectivesConfig>({
        mode: 'MANUEL',
        seuil_rentabilite_mensuel: 0,
        marge_objectif_mensuel: 0,
        coefficient_marge: 1.40,
        pourcentage_croissance: 5,
        jours_ouverts_semaine: 6
    });

    const { data, isLoading } = useQuery({
        queryKey: ['objectives-config'],
        queryFn: fetchConfig,
        enabled: isOpen,
    });

    useEffect(() => {
        if (data) {
            setConfig({
                mode: data.mode,
                seuil_rentabilite_mensuel: normalizeNumberInput(data.seuil_rentabilite_mensuel),
                marge_objectif_mensuel: normalizeNumberInput(data.marge_objectif_mensuel),
                coefficient_marge: normalizeNumberInput(data.coefficient_marge),
                pourcentage_croissance: normalizeNumberInput(data.pourcentage_croissance),
                jours_ouverts_semaine: normalizeNumberInput(data.jours_ouverts_semaine)
            });
        }
    }, [data, isOpen]);

    const mutation = useMutation({
        mutationFn: updateConfig,
        onSuccess: () => {
            toast.success(t('manager_dashboard.settings.save_success', 'Configuration enregistrée'));
            queryClient.invalidateQueries({ queryKey: ['objectives-config'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'managerStats'] });
            queryClient.invalidateQueries({ queryKey: ['objectifs'] });
            onClose();
        },
        onError: () => {
            toast.error(t('manager_dashboard.settings.save_error', 'Erreur lors de l\'enregistrement'));
        }
    });

    if (!isOpen) return null;

    const handleSave = () => {
        mutation.mutate(config);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-base-300/60 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative bg-base-100 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 fade-in duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 sm:p-8 border-b border-base-200 bg-base-100">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-base-content flex items-center gap-3">
                            <Target className="size-6 text-primary" />
                            {t('manager_dashboard.settings.title', 'Configuration des Objectifs')}
                        </h2>
                        <p className="text-sm font-medium text-base-content/60 mt-1">
                            {t('manager_dashboard.settings.subtitle', 'Automatisez et personnalisez le calcul de vos cibles de vente.')}
                        </p>
                    </div>
                    <Button 
                        onClick={onClose}
                        variant="ghost" size="icon" className="rounded-full hover:rotate-90 transition-transform text-base-content/60 hover:text-base-content"
                    >
                        <X className="size-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-6 sm:p-8 overflow-y-auto bg-base-50/50 flex-1 space-y-8">
                    {isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="size-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            {/* Mode Selection */}
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-base-content/60 uppercase tracking-wider block">
                                    {t('manager_dashboard.settings.mode_label')}
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setConfig({ ...config, mode: 'MANUEL' })}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                                            config.mode === 'MANUEL' 
                                            ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' 
                                            : 'border-base-200 hover:border-base-300 hover:bg-base-200 cursor-pointer text-base-content/60'
                                        }`}
                                    >
                                        <Hand className={`size-6 mb-3 ${config.mode === 'MANUEL' ? 'text-primary' : 'text-base-content/60'}`} />
                                        <h3 className={`font-bold ${config.mode === 'MANUEL' ? 'text-primary' : ''}`}>{t('manager_dashboard.settings.modes.manual_title')}</h3>
                                        <p className="text-xs mt-1 leading-relaxed opacity-80">{t('manager_dashboard.settings.modes.manual_desc')}</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setConfig({ ...config, mode: 'FIXE' })}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                                            config.mode === 'FIXE' 
                                            ? 'border-secondary bg-secondary/5 shadow-md shadow-secondary/10' 
                                            : 'border-base-200 hover:border-base-300 hover:bg-base-200 cursor-pointer text-base-content/60'
                                        }`}
                                    >
                                        <Target className={`size-6 mb-3 ${config.mode === 'FIXE' ? 'text-purple-600' : 'text-base-content/60'}`} />
                                        <h3 className={`font-bold ${config.mode === 'FIXE' ? 'text-purple-600' : ''}`}>{t('manager_dashboard.settings.modes.fixed_title')}</h3>
                                        <p className="text-xs mt-1 leading-relaxed opacity-80">{t('manager_dashboard.settings.modes.fixed_desc')}</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setConfig({ ...config, mode: 'DYNAMIQUE' })}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                                            config.mode === 'DYNAMIQUE' 
                                            ? 'border-accent bg-accent/5 shadow-md shadow-accent/10' 
                                            : 'border-base-200 hover:border-base-300 hover:bg-base-200 cursor-pointer text-base-content/60'
                                        }`}
                                    >
                                        <TrendingUp className={`size-6 mb-3 ${config.mode === 'DYNAMIQUE' ? 'text-warning' : 'text-base-content/60'}`} />
                                        <h3 className={`font-bold ${config.mode === 'DYNAMIQUE' ? 'text-warning' : ''}`}>{t('manager_dashboard.settings.modes.dynamic_title')}</h3>
                                        <p className="text-xs mt-1 leading-relaxed opacity-80">{t('manager_dashboard.settings.modes.dynamic_desc')}</p>
                                    </button>
                                </div>
                            </div>

                            {/* Conditional Settings */}
                            <div className="space-y-6 pt-6 border-t border-base-200">
                                {config.mode === 'FIXE' && (
                                    <div className="space-y-6 animate-in slide-in-from-top-2 fade-in">
                                        {/* Objectif de marge mensuelle */}
                                        <div className="flex flex-col gap-1">
                                            <label className="flex flex-col">
                                                <span className="text-sm font-bold">{t('manager_dashboard.settings.fixed.monthly_margin_label')}</span>
                                            </label>
                                            <div className="join">
                                                <input 
                                                    type="number" 
                                                    className="w-full bg-base-100 rounded-lg border border-base-300 h-10 text-sm px-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                    value={config.marge_objectif_mensuel}
                                                    onChange={e => setConfig({...config, marge_objectif_mensuel: normalizeNumberInput(e.target.value)})}
                                                />
                                                <span className="inline-flex items-center px-3 h-10 rounded-l-xl bg-base-200 border border-base-200 text-sm pointer-events-none">{t('common:currency_symbol', 'F')}</span>
                                            </div>
                                            <label className="flex flex-col">
                                                <span className="text-xs text-base-content/60">{t('manager_dashboard.settings.fixed.ca_auto_calculated')}</span>
                                            </label>
                                        </div>

                                        {/* Coefficient multiplicateur */}
                                        <div className="grid sm:grid-cols-2 gap-6">
                                            <div className="flex flex-col gap-1">
                                                <label className="flex flex-col">
                                                    <span className="text-sm font-bold">{t('manager_dashboard.settings.fixed.coefficient_label')}</span>
                                                </label>
                                                <div className="join">
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        min="1.01"
                                                        max="10"
                                                        className="w-full bg-base-100 rounded-lg border border-base-300 h-10 text-sm px-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                        value={config.coefficient_marge}
                                                        onChange={e => setConfig({...config, coefficient_marge: normalizeNumberInput(e.target.value)})}
                                                    />
                                                    <span className="inline-flex items-center px-3 h-10 rounded-l-xl bg-base-200 border border-base-200 text-sm pointer-events-none">×</span>
                                                </div>
                                                <label className="flex flex-col">
                                                    <span className="text-xs text-base-content/60">{t('manager_dashboard.settings.fixed.coefficient_help')}</span>
                                                </label>
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <label className="flex flex-col">
                                                    <span className="text-sm font-bold">{t('manager_dashboard.settings.fixed.days_per_week')}</span>
                                                </label>
                                                <select 
                                                    className="w-full bg-base-100 rounded-lg border border-base-300 h-10 text-sm px-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                    value={config.jours_ouverts_semaine}
                                                    onChange={e => setConfig({...config, jours_ouverts_semaine: normalizeNumberInput(e.target.value)})}
                                                >
                                                    {[1,2,3,4,5,6,7].map(d => (
                                                        <option key={d} value={d}>{t('manager_dashboard.settings.fixed.days_count', { count: d })}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Aperçu CA déduit */}
                                        {config.marge_objectif_mensuel > 0 && config.coefficient_marge > 1 && (
                                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                                                <div className="flex items-center gap-2 text-emerald-700 font-bold mb-1">
                                                    <TrendingUp className="size-4" />
                                                    {t('manager_dashboard.settings.fixed.preview_title')}
                                                </div>
                                                <div className="text-emerald-600">
                                                    {t('manager_dashboard.settings.fixed.preview_ca', { value: formatCurrencyLocal(Math.round(config.marge_objectif_mensuel / ((config.coefficient_marge - 1) / config.coefficient_marge))) })}
                                                    <span className="text-emerald-400 ml-2">{t('manager_dashboard.settings.fixed.preview_breakdown', { week: formatCurrencyLocal(Math.round(config.marge_objectif_mensuel / 4.33 / ((config.coefficient_marge - 1) / config.coefficient_marge))), day: formatCurrencyLocal(Math.round(config.marge_objectif_mensuel / (config.jours_ouverts_semaine * 4.33) / ((config.coefficient_marge - 1) / config.coefficient_marge))) })}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {config.mode === 'DYNAMIQUE' && (
                                    <div className="flex flex-col gap-1 max-w-xs animate-in slide-in-from-top-2 fade-in">
                                        <label className="flex flex-col">
                                            <span className="text-sm font-bold">{t('manager_dashboard.settings.dynamic.growth_label')}</span>
                                        </label>
                                        <div className="join">
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                className="w-full bg-base-100 rounded-lg border border-base-300 h-10 text-sm px-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                value={config.pourcentage_croissance}
                                                onChange={e => setConfig({...config, pourcentage_croissance: normalizeNumberInput(e.target.value)})}
                                            />
                                            <span className="inline-flex items-center px-3 h-10 rounded-l-xl bg-base-200 border border-base-200 text-sm pointer-events-none">%</span>
                                        </div>
                                        <label className="flex flex-col">
                                            <span className="text-xs text-base-content/60">{t('manager_dashboard.settings.dynamic.growth_help')}</span>
                                        </label>
                                    </div>
                                )}

                                {config.mode === 'MANUEL' && (
                                    <div className="p-4 bg-info/10 text-info rounded-xl text-sm leading-relaxed flex items-start gap-3 animate-in slide-in-from-top-2 fade-in">
                                        <Hand className="size-5 shrink-0 mt-0.5" />
                                        <p>{t('manager_dashboard.settings.modes.manual_notice')}</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 sm:p-8 border-t border-base-200 bg-base-50 flex justify-end gap-3 mt-auto">
                    <Button 
                        onClick={onClose}
                        variant="ghost" className="rounded-xl font-bold"
                        disabled={mutation.isPending}
                    >
                        {t('common:cancel')}
                    </Button>
                    <Button 
                        onClick={handleSave}
                        variant="default" className="rounded-xl font-bold gap-2 min-w-[140px]"
                        disabled={mutation.isPending || isLoading}
                    >
                        {mutation.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <>
                                <Save className="size-4" />
                                {t('common:save')}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

