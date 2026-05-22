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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="bg-base-100 w-full max-w-xl p-0 overflow-hidden rounded-[40px] border border-base-300 shadow-2xl">
                {/* Header */}
                <div className="bg-base-200 p-8 border-bottom border-base-300">
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
                    <div className="bg-primary/10 p-4 rounded-2xl border border-indigo-200 flex gap-4">
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
                                <span className="text-xs font-black uppercase tracking-widest text-success">Disponibilité</span>
                                <div className="text-3xl font-black text-success">{availWeight}%</div>
                            </div>
                            <div className="space-y-1 text-right">
                                <span className="text-xs font-black uppercase tracking-widest text-primary">Rotation</span>
                                <div className="text-3xl font-black text-primary">{100 - availWeight}%</div>
                            </div>
                        </div>

                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={availWeight} 
                            onChange={(e) => setAvailWeight(parseInt(e.target.value, 10))}
                            className="w-full h-2 bg-base-300 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                            step="5"
                        />
                        
                        <div className="flex justify-between text-xs px-2 font-bold text-base-content/30">
                            <span>Priorité Trésorerie</span>
                            <span>Équilibré</span>
                            <span>Priorité Service Client</span>
                        </div>
                    </div>

                    {/* Logic Preview Card */}
                    <div className="bg-base-200 p-6 rounded-3xl space-y-3">
                        <div className="text-xs font-black uppercase tracking-widest text-base-content/50">Logique de calcul actuelle</div>
                        <div className="flex items-center gap-2 font-mono text-sm">
                            <span className="text-success font-bold">({availWeight}% × Dispo)</span>
                            <span className="text-base-content/40">+</span>
                            <span className="text-primary font-bold">({100 - availWeight}% × Rotation)</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 bg-base-200 flex items-center justify-between">
                    <button 
                        onClick={handleReset}
                        className="inline-flex items-center justify-center px-3 py-1.5 text-sm bg-transparent text-base-content hover:bg-base-200 rounded-2xl gap-2 font-bold transition-all"
                        disabled={saving}
                    >
                        <RotateCcw className="size-4" />
                        Réinitialiser
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="inline-flex items-center justify-center px-3 py-1.5 text-sm bg-transparent text-base-content hover:bg-base-200 rounded-2xl font-bold transition-all" disabled={saving}>
                            Annuler
                        </button>
                        <button 
                            onClick={handleSave} 
                            className="inline-flex items-center justify-center px-3 py-1.5 text-sm bg-primary text-white hover:bg-primary-focus rounded-2xl gap-2 px-8 shadow-lg shadow-indigo-500/20 transition-all"
                            disabled={saving}
                        >
                            {saving ? (
                                <span className="animate-spin rounded-full size-4 border-b-2 border-white"></span>
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
            <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm -z-10" onClick={onClose}></div>
        </div>
    );
};

export default StockHealthSettingsModal;
