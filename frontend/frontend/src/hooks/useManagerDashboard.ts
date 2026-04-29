import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useManagerStats, useCurrentObjectifs } from './useDashboard';
import { usePharmacySettings } from './usePharmacySettings';
import { exportToExcel } from '../utils/excelExport';

export interface EditingObjectif {
    periode: string;
    ca_objectif: string;
    date_debut: string;
}

export const useManagerDashboard = () => {
    const { t } = useTranslation(['dashboard', 'common']);
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [editingObjectif, setEditingObjectif] = useState<EditingObjectif>({
        periode: 'JOUR',
        ca_objectif: '',
        date_debut: new Date().toISOString().split('T')[0]
    });

    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useManagerStats();
    const { data: currentObj } = useCurrentObjectifs();
    const { settings: pharmacySettings } = usePharmacySettings();

    const handleExport = useCallback(async (type: 'csv' | 'pdf' | 'dead_stock') => {
        setExporting(true);
        try {
            let url = '';
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const lastDay = now.toISOString();

            if (type === 'csv') {
                url = `rapports/export_comptable_csv/?date_debut=${firstDay}&date_fin=${lastDay}`;
            } else if (type === 'pdf') {
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                url = `rapports/rapport_mensuel_pdf/?mois=${year}-${month}`;
            } else if (type === 'dead_stock') {
                const response = await api.get('rapports/stocks_morts/', { params: { min_value: 100000, months: 6 } });
                const data = response.data;

                if (Array.isArray(data) && data.length > 0) {
                    const excelData = data.map(item => ({
                        'Nom': item.name,
                        'CIP': item.cip || '-',
                        'Stock': item.stock,
                        'Valeur': item.valeur,
                        'PMP': item.pmp,
                        'Dernière Vente': item.dernier_vente || 'Jamais vendu',
                        'Rayon': item.rayon || '-',
                        'Fournisseur': item.fournisseur || '-'
                    }));

                    const filename = `stocks_morts_${now.toISOString().split('T')[0]}.xlsx`;
                    exportToExcel(excelData, pharmacySettings, {
                        sheetName: 'Stocks Morts',
                        filename,
                        title: 'Rapport Stocks Morts',
                    });
                    toast.success(t('common:export_success', 'Export réussi'));
                } else {
                    toast(t('manager_dashboard.no_dead_stock', 'Aucun stock mort trouvé.'));
                }
                return;
            }

            const response = await api.get(url, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;

            const filename = type === 'csv' ? `export_comptable_${now.toISOString().split('T')[0]}.csv` :
                `rapport_mensuel_${now.getMonth() + 1}.pdf`;

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(t('common:export_success', 'Export réussi'));
        } catch (error: unknown) {
            console.error('Export error:', error);
            toast.error(t('common:export_error', 'Erreur lors de l\'export'));
        } finally {
            setExporting(false);
        }
    }, [t]);

    const handleSaveObjectif = async () => {
        try {
            await api.post('objectifs-commerciaux/', editingObjectif);
            toast.success(t('manager_dashboard.messages.save_success'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['objectifs'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'managerStats'] });
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err.response?.data?.error || t('manager_dashboard.messages.save_error'));
        }
    };

    const openObjectiveModal = (periode?: string, objective?: EditingObjectif) => {
        if (periode) {
            setEditingObjectif({
                periode: periode,
                ca_objectif: objective ? objective.ca_objectif : '',
                date_debut: objective ? objective.date_debut : new Date().toISOString().split('T')[0]
            });
        } else {
            setEditingObjectif({
                periode: 'JOUR',
                ca_objectif: '',
                date_debut: new Date().toISOString().split('T')[0]
            });
        }
        setIsModalOpen(true);
    };

    return {
        stats,
        statsLoading,
        currentObj,
        isModalOpen,
        setIsModalOpen,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
        exporting,
        editingObjectif,
        setEditingObjectif,
        actions: {
            handleExport,
            handleSaveObjectif,
            refetchStats,
            openObjectiveModal
        }
    };
};
