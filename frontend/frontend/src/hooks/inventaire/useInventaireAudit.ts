import { useState, useEffect } from 'react';
import axios from 'axios';
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
    const { t } = useTranslation();
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const auditEndpoint = `${String(apiBaseUrl).replace(/\/$/, '')}/inventaires/audit_discrepancies/`;

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AuditData | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchAudit = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);

            const url = params.toString() ? `${auditEndpoint}?${params.toString()}` : auditEndpoint;
            const response = await axios.get(url);
            setData(response.data);
        } catch (error) {
            console.error("Erreur audit", error);
            toast.error(t('common.messages.error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAudit();
    }, [startDate, endDate]);

    return {
        data,
        loading,
        startDate, setStartDate,
        endDate, setEndDate,
        fetchAudit
    };
};
