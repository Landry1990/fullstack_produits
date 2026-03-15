import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import axios from '../config/axios';
import * as XLSX from 'xlsx';
import { useManagerStats, useCurrentObjectifs } from './useDashboard';

export interface EditingObjectif {
    periode: string;
    ca_objectif: string;
    date_debut: string;
}

export const useManagerDashboard = () => {
    const { t } = useTranslation();
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

    const handleExport = useCallback(async (type: 'csv' | 'pdf' | 'dead_stock') => {
        setExporting(true);
        try {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
            const rapportsEndpoint = apiBaseUrl
                ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/rapports/`
                : '/api/rapports/';

            let url = '';
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const lastDay = now.toISOString();

            if (type === 'csv') {
                url = `${rapportsEndpoint}export_comptable_csv/?date_debut=${firstDay}&date_fin=${lastDay}`;
            } else if (type === 'pdf') {
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                url = `${rapportsEndpoint}rapport_mensuel_pdf/?mois=${year}-${month}`;
            } else if (type === 'dead_stock') {
                const dsUrl = `${rapportsEndpoint}stocks_morts/?min_value=100000&months=6`;
                const response = await axios.get(dsUrl);
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

                    const ws = XLSX.utils.json_to_sheet(excelData);

                    // Auto-adjust column widths
                    const colWidths = Object.keys(excelData[0] || {}).map(key => {
                        const headerLen = key.length;
                        const maxContentLen = excelData.reduce((max, row) => {
                            const val = String(row[key as keyof typeof row] || "");
                            return Math.max(max, val.length);
                        }, 0);
                        return { wch: Math.max(headerLen, maxContentLen) + 2 };
                    });
                    ws['!cols'] = colWidths;

                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Stocks Morts');

                    const filename = `stocks_morts_${now.toISOString().split('T')[0]}.xlsx`;
                    XLSX.writeFile(wb, filename);
                    toast.success(t('common.export_success', 'Export réussi'));
                } else {
                    toast(t('manager_dashboard.no_dead_stock', 'Aucun stock mort trouvé.'));
                }
                return;
            }

            const response = await axios.get(url, { responseType: 'blob' });
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
            toast.success(t('common.export_success', 'Export réussi'));
        } catch (error: unknown) {
            console.error('Export error:', error);
            toast.error(t('common.export_error', 'Erreur lors de l\'export'));
        } finally {
            setExporting(false);
        }
    }, [t]);

    const handleSaveObjectif = async () => {
        try {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
            const endpoint = apiBaseUrl
                ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/objectifs-commerciaux/`
                : '/api/objectifs-commerciaux/';

            await axios.post(endpoint, editingObjectif);
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
