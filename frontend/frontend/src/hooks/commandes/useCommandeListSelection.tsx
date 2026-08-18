import { useCallback } from 'react';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { Commande } from '../../types';
import { useCommandesStore } from '../../stores/useCommandesStore';
import { Handshake } from 'lucide-react';

export interface UseCommandeListSelectionResult {
    selectedOrderIds: Set<number>;
    setSelectedOrderIds: (ids: Set<number>) => void;
    toggleOrderSelection: (orderId: number) => void;
    toggleAllOrdersSelection: () => void;
    canMergeSelectedOrders: () => { canMerge: boolean; reason?: string; status?: string };
    openMergeModal: () => void;
    handleMergeSuccess: (mergedCount: number, targetOrderId: number) => Promise<void>;
}

export function useCommandeListSelection(commandes: Commande[]): UseCommandeListSelectionResult {
    const { t } = useTranslation(['orders']);
    const queryClient = useQueryClient();

    const selectedOrderIds = useCommandesStore((s) => s.selectedOrderIds);
    const setSelectedOrderIds = useCommandesStore((s) => s.setSelectedOrderIds);
    const setIsMergeModalOpen = useCommandesStore((s) => s.setIsMergeModalOpen);
    const setViewMode = useCommandesStore((s) => s.setViewMode);

    const toggleOrderSelection = useCallback((orderId: number) => {
        setSelectedOrderIds(prev => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    }, [setSelectedOrderIds]);

    const toggleAllOrdersSelection = useCallback(() => {
        if (selectedOrderIds.size === commandes.length && commandes.length > 0) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(commandes.map(c => c.id)));
        }
    }, [commandes, selectedOrderIds.size, setSelectedOrderIds]);

    const canMergeSelectedOrders = useCallback((): { canMerge: boolean; reason?: string; status?: string } => {
        if (selectedOrderIds.size < 2) return { canMerge: false, reason: t('orders:messages.merge_select_two') };

        const selectedOrders = commandes.filter(c => selectedOrderIds.has(c.id));
        const statuses = new Set(selectedOrders.map(c => c.status));

        if (statuses.size > 1) return { canMerge: false, reason: t('orders:messages.merge_same_status') };

        const status = selectedOrders[0]?.status;
        if (status !== 'PREP') return { canMerge: false, reason: t('orders:messages.merge_only_prep') };

        return { canMerge: true, status };
    }, [commandes, selectedOrderIds, t]);

    const openMergeModal = useCallback(() => {
        const { canMerge, reason } = canMergeSelectedOrders();
        if (!canMerge) {
            gooeyToast.error(reason || t('orders:messages.merge_impossible'));
            return;
        }
        setIsMergeModalOpen(true);
    }, [canMergeSelectedOrders, setIsMergeModalOpen, t]);

    const handleMergeSuccess = useCallback(async (mergedCount: number, targetOrderId: number) => {
        setIsMergeModalOpen(false);
        setSelectedOrderIds(new Set());
        gooeyToast.success(t('orders:messages.merge_success_detailed', { count: mergedCount, id: targetOrderId }), { icon: <Handshake className="h-4 w-4 text-emerald-600" /> });
        await queryClient.refetchQueries({ queryKey: ['commandes'] });
        await queryClient.refetchQueries({ queryKey: ['commande'] });
        setViewMode('LIST');
    }, [queryClient, setIsMergeModalOpen, setSelectedOrderIds, setViewMode, t]);

    return {
        selectedOrderIds,
        setSelectedOrderIds,
        toggleOrderSelection,
        toggleAllOrdersSelection,
        canMergeSelectedOrders,
        openMergeModal,
        handleMergeSuccess,
    };
}
