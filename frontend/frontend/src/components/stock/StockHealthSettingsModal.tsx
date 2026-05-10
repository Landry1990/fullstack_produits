import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Check, RotateCcw, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { usePharmacySettings } from '../../hooks/usePharmacySettings';
import { stockHealthSettingsSchema } from '../../schemas/stockSchema';

interface StockHealthSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved?: () => void;
}

const StockHealthSettingsModal: React.FC<StockHealthSettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
    const { t } = useTranslation(['stock', 'common']);
    const { settings, updateSettings } = usePharmacySettings();
    
    const [availWeight, setAvailWeight] = useState(60);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && settings.availability_weight !== undefined) {
            setAvailWeight(settings.availability_weight);
        }
    }, [isOpen, settings.availability_weight]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setSaving(true);
        try {
            const validation = stockHealthSettingsSchema.safeParse({
                availability_weight: availWeight,
                rotation_weight: 100 - availWeight,
            });

            if (!validation.success) {
                const message = validation.error.issues[0]?.message ?? t('common:validation_error', { defaultValue: 'Erreur de validation' });
                toast.error(message);
                return;
            }

            await updateSettings(validation.data);
            if (onSaved) onSaved();
            onClose();
        } catch (error) {
            console.error('Failed to save settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setAvailWeight(60);
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-xl p-0 overflow-hidden rounded-[40px] border border-base-200 shadow-2xl">
                {/* Header */}
                <div className="bg-base-200/50 p-8 border-bottom border-base-200">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <Settings className="size-6 animate-spin-slow" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black tracking-tighter">Configuration Expert IA</h3>
                            <p className="text-sm text-base-content/50 font-medium">Ajustez la pondération de votre score de santé</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 space-y-8">
                    {/* Explanation Alert */}
                    <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex gap-4">
                        <Info className="size-6 text-primary shrink-0" />
                        <p className="text-sm font-medium leading-relaxed">
                            Définissez l'importance de chaque critère. Par défaut (60/40), nous privilégions la 
                            disponibilité pour éviter de perdre des clients.
                        </p>
                    </div>

                    {/* Weight Slider */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Disponibilité</span>
                                <div className="text-3xl font-black text-emerald-600">{availWeight}%</div>
                            </div>
                            <div className="space-y-1 text-right">
                                <span className="text-xs font-black uppercase tracking-widest text-indigo-600">Rotation</span>
                                <div className="text-3xl font-black text-indigo-600">{100 - availWeight}%</div>
                            </div>
                        </div>

                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={availWeight} 
                            onChange={(e) => setAvailWeight(parseInt(e.target.value, 10))}
                            className="range range-primary range-lg" 
                            step="5"
                        />
                        
                        <div className="flex justify-between text-xs px-2 font-bold opacity-30">
                            <span>Priorité Trésorerie</span>
                            <span>Équilibré</span>
                            <span>Priorité Service Client</span>
                        </div>
                    </div>

                    {/* Logic Preview Card */}
                    <div className="bg-base-200 p-6 rounded-3xl space-y-3">
                        <div className="text-xs font-black uppercase tracking-widest text-base-content/40">Logique de calcul actuelle</div>
                        <div className="flex items-center gap-2 font-mono text-sm">
                            <span className="text-emerald-600 font-bold">({availWeight}% × Dispo)</span>
                            <span className="text-base-content/20">+</span>
                            <span className="text-indigo-600 font-bold">({100 - availWeight}% × Rotation)</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 bg-base-50 flex items-center justify-between">
                    <button 
                        onClick={handleReset}
                        className="btn btn-ghost rounded-2xl gap-2 font-bold"
                        disabled={saving}
                    >
                        <RotateCcw className="size-4" />
                        Réinitialiser
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="btn btn-ghost rounded-2xl font-bold" disabled={saving}>
                            Annuler
                        </button>
                        <button 
                            onClick={handleSave} 
                            className="btn btn-primary rounded-2xl gap-2 px-8 shadow-lg shadow-primary/20"
                            disabled={saving}
                        >
                            {saving ? (
                                <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                                <>
                                    <Check className="size-5" />
                                    Appliquer
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop bg-base-content/20 backdrop-blur-sm" onClick={onClose}></div>
        </div>
    );
};

export default StockHealthSettingsModal;
