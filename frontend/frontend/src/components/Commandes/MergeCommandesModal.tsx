import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import type { Commande, Fournisseur } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shadcn/button';
import { logger } from '../../utils/logger';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '../shadcn/dialog';
import { Select } from '../shadcn/select';

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

    useEffect(() => {
        if (isOpen && selectedOrderIds.size > 0) {
            fetchMergeDetails();
            setMergeTargetOrderId(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, selectedOrderIds]);

    const fetchMergeDetails = async () => {
        setLoadingMergeDetails(true);
        try {
            const orderIds = Array.from(selectedOrderIds);
            const detailsPromises = orderIds.map(id => 
                api.get<Commande>(`${commandesEndpoint}${id}/`)
            );
            const responses = await Promise.all(detailsPromises);
            setMergeOrdersDetails(responses.map(r => r.data));
        } catch (err) {
            logger.error('Erreur chargement détails commandes:', err);
            gooeyToast.error(t('orders:merge_modal.load_error'));
            onClose();
        } finally {
            setLoadingMergeDetails(false);
        }
    };

    const handleMergeOrders = async () => {
        if (!mergeTargetOrderId) {
            gooeyToast.error(t('orders:merge_modal.select_main_error'));
            return;
        }

        const orderIdsToMerge = Array.from(selectedOrderIds).filter(id => id !== mergeTargetOrderId);
        if (orderIdsToMerge.length === 0) {
            gooeyToast.error(t('orders:merge_modal.no_orders_error'));
            return;
        }

        try {
            await Promise.all(orderIdsToMerge.map(async (sourceOrderId) => {
                await api.post(`${commandesEndpoint}${mergeTargetOrderId}/merge/`, {
                    source_commande_id: sourceOrderId
                });
            }));

            onMergeSuccess(orderIdsToMerge.length, mergeTargetOrderId);
            onClose();

        } catch (err: unknown) {
            logger.error('Erreur lors de la fusion:', err);
            const errObj = err as { response?: { data?: { error?: string } } };
            const msg = errObj?.response?.data?.error || t('orders:merge_modal.merge_error');
            gooeyToast.error(msg);
        }
    };

    const totalProduits = mergeOrdersDetails.reduce((sum, c) => sum + (c.produits?.length || 0), 0);
    const uniqueSuppliers = [...new Set(mergeOrdersDetails.map(c => c.fournisseur))];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                {loadingMergeDetails ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="size-8 animate-spin text-indigo-600 mb-4" />
                        <p>{t('orders:merge_modal.loading')}</p>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>{t('orders:merge_modal.title', { count: selectedOrderIds.size })}</DialogTitle>
                            <DialogDescription>
                                <span dangerouslySetInnerHTML={{ __html: t('orders:merge_modal.description') }} />
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    {t('orders:merge_modal.supplier_label')}
                                </label>
                                <Select
                                    value={mergeTargetOrderId?.toString() ?? ''}
                                    onChange={(e) => setMergeTargetOrderId(e.target.value ? parseInt(e.target.value, 10) : null)}
                                    className="w-full h-10 text-sm"
                                >
                                    <option value="">{t('orders:merge_modal.select_main')}</option>
                                    {mergeOrdersDetails.map(order => (
                                        <option key={order.id} value={String(order.id)}>
                                            #{order.id} - {fournisseurs.find(f => f.id === order.fournisseur)?.name} 
                                            ({t('orders:merge_modal.products_badge', { count: order.produits?.length || 0 })}, {formatCurrency(Number(order.total))})
                                        </option>
                                    ))}
                                </Select>
                                {uniqueSuppliers.length > 1 && (
                                    <p className="text-xs text-amber-600">
                                        {t('orders:merge_modal.multi_supplier_warning', { count: uniqueSuppliers.length })}
                                    </p>
                                )}
                            </div>

                            <div className="bg-slate-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                                <h4 className="font-semibold text-sm mb-2">{t('orders:merge_modal.orders_to_merge')}</h4>
                                <div className="space-y-2">
                                    {mergeOrdersDetails.map(order => {
                                        const isTarget = order.id === mergeTargetOrderId;
                                        return (
                                            <div 
                                                key={order.id} 
                                                onClick={() => setMergeTargetOrderId(order.id)}
                                                className={`
                                                    flex justify-between items-center text-sm p-2 rounded cursor-pointer
                                                    ${isTarget ? 'bg-indigo-100 border border-indigo-500' : 'bg-white border border-slate-200'}
                                                `}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {isTarget && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">{t('orders:merge_modal.main_badge')}</span>}
                                                    <span className="font-medium">{t('orders:merge_modal.order_label', { id: order.id })}</span>
                                                    <span className="text-slate-500">
                                                        ({fournisseurs.find(f => f.id === order.fournisseur)?.name})
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">{t('orders:merge_modal.products_badge', { count: order.produits?.length || 0 })}</span>
                                                    <span className="font-bold">{formatCurrency(Number(order.total))}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase">{t('orders:merge_modal.total_products')}</div>
                                        <div className="font-bold text-lg">{totalProduits}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase">{t('orders:merge_modal.total_amount')}</div>
                                        <div className="font-bold text-lg text-indigo-600">
                                            {formatCurrency(mergeOrdersDetails.reduce((sum, c) => sum + parseFloat(c.total || '0'), 0))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={onClose}
                                >
                                    {t('orders:merge_modal.cancel')}
                                </Button>
                                <Button 
                                    type="button" 
                                    onClick={handleMergeOrders}
                                    disabled={!mergeTargetOrderId}
                                >
                                    {t('orders:merge_modal.merge_btn')}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
