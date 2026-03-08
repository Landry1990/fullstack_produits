import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import type { Commande, Fournisseur } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface MergeCommandesModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedOrderIds: Set<number>;
    fournisseurs: Fournisseur[];
    commandesEndpoint: string;
    apiBaseUrl: string;
    onMergeSuccess: (mergedCount: number, targetOrderId: number) => void;
}

export default function MergeCommandesModal({
    isOpen,
    onClose,
    selectedOrderIds,
    fournisseurs,
    commandesEndpoint,
    onMergeSuccess
}: MergeCommandesModalProps) {
    const [mergeTargetOrderId, setMergeTargetOrderId] = useState<number | null>(null);
    const [mergeOrdersDetails, setMergeOrdersDetails] = useState<Commande[]>([]);
    const [loadingMergeDetails, setLoadingMergeDetails] = useState(false);

    // Charger les détails des commandes à l'ouverture
    useEffect(() => {
        if (isOpen && selectedOrderIds.size > 0) {
            fetchMergeDetails();
            setMergeTargetOrderId(null);
        }
    }, [isOpen, selectedOrderIds]);

    const fetchMergeDetails = async () => {
        setLoadingMergeDetails(true);
        try {
            // Charger les détails complets de chaque commande sélectionnée
            const orderIds = Array.from(selectedOrderIds);
            const detailsPromises = orderIds.map(id => 
                axios.get<Commande>(`${commandesEndpoint}${id}/`)
            );
            const responses = await Promise.all(detailsPromises);
            setMergeOrdersDetails(responses.map(r => r.data));
        } catch (err) {
            console.error('Erreur chargement détails commandes:', err);
            toast.error('Erreur lors du chargement des détails des commandes');
            onClose(); // Fermer si erreur critique
        } finally {
            setLoadingMergeDetails(false);
        }
    };

    const handleMergeOrders = async () => {
        if (!mergeTargetOrderId) {
            toast.error('Veuillez sélectionner la commande principale.');
            return;
        }

        const orderIdsToMerge = Array.from(selectedOrderIds).filter(id => id !== mergeTargetOrderId);
        if (orderIdsToMerge.length === 0) {
            toast.error('Aucune commande à fusionner.');
            return;
        }

        try {
            // Utiliser l'action backend 'merge' pour chaque commande source
            for (const sourceOrderId of orderIdsToMerge) {
                await axios.post(`${commandesEndpoint}${mergeTargetOrderId}/merge/`, {
                    source_commande_id: sourceOrderId
                });
            }

            // Notifier succès
            onMergeSuccess(orderIdsToMerge.length, mergeTargetOrderId);
            onClose();

        } catch (err: any) {
            console.error('Erreur lors de la fusion:', err);
            const msg = err.response?.data?.error || 'Erreur lors de la fusion des commandes.';
            toast.error(msg);
        }
    };

    if (!isOpen) return null;

    const totalProduits = mergeOrdersDetails.reduce((sum, c) => sum + (c.produits?.length || 0), 0);
    const uniqueSuppliers = [...new Set(mergeOrdersDetails.map(c => c.fournisseur))];

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                {loadingMergeDetails ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <span className="loading loading-spinner loading-lg mb-4"></span>
                        <p>Chargement des détails des commandes...</p>
                    </div>
                ) : (
                    <>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            🔀 Fusionner {selectedOrderIds.size} commandes
                        </h3>
                        
                        <p className="text-sm text-base-content/70 mb-4">
                            Tous les produits des commandes sélectionnées seront regroupés dans <strong>une seule commande</strong>. 
                            Les autres commandes seront supprimées.
                        </p>

                        {/* Sélection du fournisseur final */}
                        <div className="form-control mb-4">
                            <label className="label">
                                <span className="label-text font-semibold">Fournisseur de la commande fusionnée</span>
                            </label>
                            <select
                                className="select select-bordered w-full"
                                value={mergeTargetOrderId ?? ''}
                                onChange={(e) => setMergeTargetOrderId(e.target.value ? parseInt(e.target.value) : null)}
                            >
                                <option value="">Choisir une commande principale...</option>
                                {mergeOrdersDetails.map(order => (
                                    <option key={order.id} value={order.id}>
                                        #{order.id} - {fournisseurs.find(f => f.id === order.fournisseur)?.name} 
                                        ({order.produits?.length || 0} produits, {formatCurrency(Number(order.total))} F)
                                    </option>
                                ))}
                            </select>
                            {uniqueSuppliers.length > 1 && (
                                <p className="text-xs text-warning mt-1">
                                    ⚠️ Les commandes proviennent de {uniqueSuppliers.length} fournisseurs différents. 
                                    Les produits seront tous regroupés dans la commande sélectionnée.
                                </p>
                            )}
                        </div>

                        {/* Liste des commandes à fusionner */}
                        <div className="bg-base-200 rounded-lg p-4 mb-4 max-h-60 overflow-y-auto">
                            <h4 className="font-semibold text-sm mb-2">Commandes à fusionner</h4>
                            <div className="space-y-2">
                                {mergeOrdersDetails.map(order => {
                                    const isTarget = order.id === mergeTargetOrderId;
                                    return (
                                        <div 
                                            key={order.id} 
                                            className={`flex justify-between items-center text-sm p-2 rounded ${isTarget ? 'bg-primary/20 border border-primary' : 'bg-white'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isTarget && <span className="badge badge-primary badge-xs">Principal</span>}
                                                <span className="font-medium">Commande #{order.id}</span>
                                                <span className="text-base-content/50">
                                                    ({fournisseurs.find(f => f.id === order.fournisseur)?.name})
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="badge badge-ghost">{order.produits?.length || 0} produits</span>
                                                <span className="font-bold">{formatCurrency(Number(order.total))} F</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Résumé */}
                        <div className="bg-base-100 border border-base-300 rounded-lg p-4 mb-4">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <div className="text-xs text-base-content/50 uppercase">Total produits</div>
                                    <div className="font-bold text-lg">{totalProduits}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-base-content/50 uppercase">Montant total</div>
                                    <div className="font-bold text-lg text-primary">
                                        {formatCurrency(mergeOrdersDetails.reduce((sum, c) => sum + parseFloat(c.total || '0'), 0))} F
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="modal-action">
                            <button 
                                type="button" 
                                className="btn btn-ghost" 
                                onClick={onClose}
                            >
                                Annuler
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-secondary"
                                onClick={handleMergeOrders}
                                disabled={!mergeTargetOrderId}
                            >
                                Fusionner les commandes
                            </button>
                        </div>
                    </>
                )}
            </div>
            <div className="modal-backdrop" onClick={onClose}></div>
        </div>
    );
}
