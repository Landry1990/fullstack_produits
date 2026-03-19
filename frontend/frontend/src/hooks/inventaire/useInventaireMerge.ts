import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Inventaire } from '../../types';

interface UseInventaireMergeProps {
    viewMode: 'LIST' | 'CREATE' | 'EDIT' | 'AUDIT';
    selectedInventaireIds: Set<number>;
    inventaires: Inventaire[];
    setSelectedInventaireIds: (ids: Set<number>) => void;
    fetchInventaires: () => void;
    activeInventaire: Inventaire | null;
    handleEdit: (inv: Inventaire) => void;
}

export const useInventaireMerge = ({
    viewMode,
    selectedInventaireIds,
    inventaires,
    setSelectedInventaireIds,
    fetchInventaires,
    activeInventaire,
    handleEdit
}: UseInventaireMergeProps) => {
    const { t } = useTranslation(['stock', 'common']);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [mergeCandidates, setMergeCandidates] = useState<Inventaire[]>([]);
    const [loadingMergeCandidates, setLoadingMergeCandidates] = useState(false);
    const [selectedMergeSource, setSelectedMergeSource] = useState<number | null>(null);
    const [merging, setMerging] = useState(false);

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';
    const inventairesEndpoint = `${String(apiBaseUrl).replace(/\/$/, '')}/inventaires/`;

    const canMergeSelectedInventaires = () => {
        if (selectedInventaireIds.size < 2) return { canMerge: false, reason: t('inventaire.merge.need_two', { defaultValue: 'Sélectionnez au moins 2 inventaires.' }) };

        const selectedDocs = inventaires.filter(i => selectedInventaireIds.has(i.id));
        if (selectedDocs.length === 0) return { canMerge: false, reason: t('inventaire.merge.error', { defaultValue: 'Erreur lors de la sélection.' }) };

        const firstStatus = selectedDocs[0].status;
        const allSameStatus = selectedDocs.every((i: Inventaire) => i.status === firstStatus);
        if (!allSameStatus) return { canMerge: false, reason: t('inventaire.merge.same_status_required', { defaultValue: 'Les inventaires sélectionnés doivent avoir le même état (tous en préparation ou tous clôturés).' }) };

        return { canMerge: true, reason: null };
    };

    const fetchMergeCandidates = async () => {
        if (!activeInventaire) return;
        setLoadingMergeCandidates(true);
        try {
            const res = await axios.get(`${inventairesEndpoint}?status=${activeInventaire.status}`);
            const candidates = (Array.isArray(res.data) ? res.data : res.data.results)
                .filter((inv: Inventaire) => inv.id !== activeInventaire.id);
            setMergeCandidates(candidates);
        } catch (err) {
            console.error("Erreur candidats fusion", err);
        } finally {
            setLoadingMergeCandidates(false);
        }
    };

    useEffect(() => {
        if (showMergeModal && viewMode !== 'LIST') {
            fetchMergeCandidates();
        }
    }, [showMergeModal]);

    const handleMerge = async () => {
        const isListMode = viewMode === 'LIST';
        const targetId = isListMode ? selectedMergeSource : activeInventaire?.id;

        if (!targetId) return;

        // Confirmation is currently mocked, ideally use useConfirm from hook
        const confirmed = window.confirm(
            isListMode
                ? t('inventaire.modals.merge_warning_list_plain', { defaultValue: 'Les inventaires sélectionnés seront fusionnés DANS l\'inventaire cible. Êtes-vous sûr ?' })
                : t('inventaire.merge.confirm_msg', { defaultValue: 'L\'inventaire source sera fusionné dans l\'inventaire actuel. Confirmer ?' })
        );
        if (!confirmed) return;

        setMerging(true);
        try {
            if (isListMode) {
                // List Mode: Merge multiple sources into selected target
                const sources = Array.from(selectedInventaireIds).filter(id => id !== targetId);
                let successCount = 0;

                for (const sourceId of sources) {
                    await axios.post(`${inventairesEndpoint}${targetId}/merge/`, {
                        source_inventaire_id: sourceId
                    });
                    successCount++;
                }

                toast.success(t('inventaire.merge.success_count', { count: successCount }));
                setSelectedInventaireIds(new Set());
                fetchInventaires();
            } else {
                // Detail Mode: Merge single external source into active inventory
                await axios.post(`${inventairesEndpoint}${activeInventaire?.id}/merge/`, {
                    source_inventaire_id: selectedMergeSource
                });
                toast.success(t('inventaire.merge.success'));
                if (activeInventaire) handleEdit(activeInventaire);
            }

            setShowMergeModal(false);
            setSelectedMergeSource(null);
        } catch (err: unknown) {
            console.error("Erreur fusion", err);
            const error = err as { response?: { data?: { error?: string } } };
            toast.error(error.response?.data?.error || t('inventaire.merge.error', { defaultValue: 'Erreur lors de la fusion' }));
        } finally {
            setMerging(false);
        }
    };

    return {
        showMergeModal, setShowMergeModal,
        mergeCandidates,
        loadingMergeCandidates,
        selectedMergeSource, setSelectedMergeSource,
        merging,
        canMergeSelectedInventaires,
        handleMerge
    };
};
