import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import type { Commande, Fournisseur } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface MergeCommandesModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedOrderIds: Set<number>;
    fournisseurs: Fournisseur[];
    commandesEndpoint: string;
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
    const { t } = useTranslation(['orders', 'common']);
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
                api.get<Commande>(`${commandesEndpoint}${id}/`)
            );
            const responses = await Promise.all(detailsPromises);
            setMergeOrdersDetails(responses.map(r => r.data));
        } catch (err) {
            console.error('Erreur chargement détails commandes:', err);
            toast.error(t('orders:merge_modal.load_error'));
            onClose(); // Fermer si erreur critique
        } finally {
            setLoadingMergeDetails(false);
        }
    };

    const handleMergeOrders = async () => {
        if (!mergeTargetOrderId) {
            toast.error(t('orders:merge_modal.select_main_error'));
            return;
        }

        const orderIdsToMerge = Array.from(selectedOrderIds).filter(id => id !== mergeTargetOrderId);
        if (orderIdsToMerge.length === 0) {
            toast.error(t('orders:merge_modal.no_orders_error'));
            return;
        }

        try {
            // Utiliser l'action backend 'merge' pour chaque commande source
            for (const sourceOrderId of orderIdsToMerge) {
                await api.post(`${commandesEndpoint}${mergeTargetOrderId}/merge/`, {
                    source_commande_id: sourceOrderId
                });
            }

            // Notifier succès
            onMergeSuccess(orderIdsToMerge.length, mergeTargetOrderId);
            onClose();

        } catch (err: any) {
            console.error('Erreur lors de la fusion:', err);
            const msg = err.response?.data?.error || t('orders:merge_modal.merge_error');
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
                        <p>{t('orders:merge_modal.loading')}</p>
                    </div>
                ) : (
                    <>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            {t('orders:merge_modal.title', { count: selectedOrderIds.size })}
                        </h3>
                        
                        <p className="text-sm text-base-content/70 mb-4"
                           dangerouslySetInnerHTML={{ __html: t('orders:merge_modal.description') }}
                        />

                        {/* Sélection du fournisseur final */}
                        <div className="form-control mb-4">
                            <label className="label">
                                <span className="label-text font-semibold">{t('orders:merge_modal.supplier_label')}</span>
                            </label>
                            <select
                                className="select select-bordered w-full"
                                value={mergeTargetOrderId ?? ''}
                                onChange={(e) => setMergeTargetOrderId(e.target.value ? parseInt(e.target.value) : null)}
                            >
                                <option value="">{t('orders:merge_modal.select_main')}</option>
                                {mergeOrdersDetails.map(order => (
                                    <option key={order.id} value={order.id}>
                                        #{order.id} - {fournisseurs.find(f => f.id === order.fournisseur)?.name} 
                                        ({order.produits?.length || 0} {t('orders:merge_modal.products_badge', { count: order.produits?.length || 0 }).split(' ').slice(1).join(' ')}, {formatCurrency(Number(order.total))})
                                    </option>
                                ))}
                            </select>
                            {uniqueSuppliers.length > 1 && (
                                <p className="text-xs text-warning mt-1">
                                    {t('orders:merge_modal.multi_supplier_warning', { count: uniqueSuppliers.length })}
                                </p>
                            )}
                        </div>

                        {/* Liste des commandes à fusionner */}
                        <div className="bg-base-200 rounded-lg p-4 mb-4 max-h-60 overflow-y-auto">
                            <h4 className="font-semibold text-sm mb-2">{t('orders:merge_modal.orders_to_merge')}</h4>
                            <div className="space-y-2">
                                {mergeOrdersDetails.map(order => {
                                    const isTarget = order.id === mergeTargetOrderId;
                                    return (
                                        <div 
                                            key={order.id} 
                                            className={`flex justify-between items-center text-sm p-2 rounded ${isTarget ? 'bg-primary/20 border border-primary' : 'bg-base-100'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isTarget && <span className="badge badge-primary badge-xs">{t('orders:merge_modal.main_badge')}</span>}
                                                <span className="font-medium">{t('orders:merge_modal.order_label', { id: order.id })}</span>
                                                <span className="text-base-content/50">
                                                    ({fournisseurs.find(f => f.id === order.fournisseur)?.name})
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="badge badge-ghost">{t('orders:merge_modal.products_badge', { count: order.produits?.length || 0 })}</span>
                                                <span className="font-bold">{formatCurrency(Number(order.total))}</span>
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
                                    <div className="text-xs text-base-content/50 uppercase">{t('orders:merge_modal.total_products')}</div>
                                    <div className="font-bold text-lg">{totalProduits}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-base-content/50 uppercase">{t('orders:merge_modal.total_amount')}</div>
                                    <div className="font-bold text-lg text-primary">
                                        {formatCurrency(mergeOrdersDetails.reduce((sum, c) => sum + parseFloat(c.total || '0'), 0))}
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
                                {t('orders:merge_modal.cancel')}
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-secondary"
                                onClick={handleMergeOrders}
                                disabled={!mergeTargetOrderId}
                            >
                                {t('orders:merge_modal.merge_btn')}
                            </button>
                        </div>
                    </>
                )}
            </div>
            <div className="modal-backdrop" onClick={onClose}></div>
        </div>
    );
}
