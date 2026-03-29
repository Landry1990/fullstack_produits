import React, { useState, useEffect } from 'react';
import PremiumModal from '../common/PremiumModal';
import axios from '../../config/axios';
import { toast } from 'react-hot-toast';

export type AlertTarget = {
    type: 'product' | 'client';
    id: number;
    name: string;
    currentMessage: string;
} | null;

interface AlertMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    target: AlertTarget;
    onSuccess: (updatedTarget: AlertTarget) => void;
}

export default function AlertMessageModal({ isOpen, onClose, target, onSuccess }: AlertMessageModalProps) {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && target) {
            setMessage(target.currentMessage || '');
        }
    }, [isOpen, target]);

    const handleSave = async () => {
        if (!target) return;
        setLoading(true);
        try {
            const endpoint = target.type === 'product' ? `/api/produits/${target.id}/` : `/api/clients/${target.id}/`;
            await axios.patch(endpoint, { message_alerte: message.trim() || null });
            toast.success(`Message d'alerte mis à jour pour ${target.name}`);
            onSuccess({ ...target, currentMessage: message.trim() });
            onClose();
        } catch (error) {
            toast.error("Erreur lors de l'enregistrement du message d'alerte");
        } finally {
            setLoading(false);
        }
    };

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={`⚠️ Alerte pour ${target?.name}`}
            icon={<span className="text-warning">⚠️</span>}
            gradientFrom="warning/20"
            gradientTo="error/10"
        >
            <div className="p-6 space-y-4">
                <p className="text-sm text-base-content/70">
                    Définissez un message d'alerte qui apparaîtra en plein écran dès que {target?.type === 'product' ? 'ce produit sera scanné' : 'ce client sera sélectionné'}.
                </p>
                <div className="form-control">
                    <textarea 
                        className="textarea textarea-bordered textarea-warning w-full h-32 text-base"
                        placeholder="Ex: Changement de conditionnement, attention au code barre..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-3 mt-4">
                    <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
                        Annuler
                    </button>
                    <button className="btn btn-warning shadow-lg text-warning-content" onClick={handleSave} disabled={loading}>
                        {loading ? <span className="loading loading-spinner" /> : "💾 Enregistrer (Ctrl+S)"}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
}
