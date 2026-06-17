import React, { useState, useEffect } from 'react';
import PremiumModal from '../common/PremiumModal';
import api from '../../services/api';
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
            const endpoint = target.type === 'product' ? `produits/${target.id}/` : `clients/${target.id}/`;
            await api.patch(endpoint, { message_alerte: message.trim() || null });
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
            icon={<span className="text-amber-500">⚠️</span>}
            gradientFrom="amber-100"
            gradientTo="red-50"
        >
            <div className="p-6 space-y-4">
                <p className="text-sm text-slate-500">
                    Définissez un message d'alerte qui apparaîtra en plein écran dès que {target?.type === 'product' ? 'ce produit sera scanné' : 'ce client sera sélectionné'}.
                </p>
                <div>
                    <textarea
                        className="w-full h-32 rounded-xl border border-amber-300 bg-white px-3 py-2 text-base text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                        placeholder="Ex: Changement de conditionnement, attention au code barre..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-3 mt-4">
                    <button className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors" onClick={onClose} disabled={loading}>
                        Annuler
                    </button>
                    <button className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-semibold bg-amber-500 text-white shadow-sm hover:bg-amber-600 transition-colors" onClick={handleSave} disabled={loading}>
                        {loading ? <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div> : "💾 Enregistrer (Ctrl+S)"}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
}
