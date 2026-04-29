import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export interface AuditData {
    top_pertes: Array<{ 
        produit__name: string; 
        produit__cip1: string; 
        total_quantite: number; 
        total_valeur: number; 
        occurrence: number;
    }>;
    top_surplus: Array<{ 
        produit__name: string; 
        produit__cip1: string; 
        total_quantite: number; 
        total_valeur: number; 
        occurrence: number;
    }>;
    par_rayon: Array<{ 
        produit__rayon__name: string; 
        total_valeur: number; 
        nombre_lignes: number;
    }>;
    par_groupe: Array<{ 
        produit__groupe__name: string; 
        total_valeur: number; 
        nombre_lignes: number;
    }>;
    stats_globales: {
        total_perte: number;
        total_gain: number;
        net: number;
        nombre_inventaires: number;
        nombre_lignes: number;
    };
}

export const useInventaireAudit = () => {
    const { t } = useTranslation(['stock', 'common']);

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AuditData | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const controllerRef = useRef<AbortController | null>(null);

    const fetchAudit = useCallback(async () => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (startDate) params['start_date'] = startDate;
            if (endDate) params['end_date'] = endDate;

            const response = await api.get('inventaires/audit_discrepancies/', { params, signal: controller.signal });
            setData(response.data);
        } catch (error: any) {
            if (error?.code === 'ERR_CANCELED') return;
            console.error("Erreur audit", error);
            toast.error(t('common:messages.error_loading'));
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, t]);

    useEffect(() => {
        fetchAudit();
        return () => controllerRef.current?.abort();
    }, [fetchAudit]);

    return {
        data,
        loading,
        startDate, setStartDate,
        endDate, setEndDate,
        fetchAudit
    };
};

