import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import axios from '../config/axios';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { formatCurrency, formatNumber } from '../utils/formatters';

// Types
export type ParamType = 'month' | 'date' | 'datetime' | 'select' | 'number' | 'text' | 'client_id';

export interface QueryParam {
    key: string;
    label: string;
    type: ParamType;
    default?: string | number;
    options?: { value: string; label: string }[];
    required?: boolean;
}

export interface QueryDefinition {
    id: string;
    name: string;
    description?: string;
    endpoint: string;
    method?: 'GET' | 'POST';
    params: QueryParam[];
    resultType: 'table' | 'cards' | 'raw';
}

export interface Client {
    id: number;
    name: string;
    phone?: string;
}

export interface PaginationData {
    count: number;
    next: string | null;
    previous: string | null;
}

// Constants extracted from component
export const QUERIES: QueryDefinition[] = [
    {
        id: 'rapport_mensuel',
        name: 'Rapport Mensuel',
        description: 'CA, marges, créances pour un mois donné',
        endpoint: '/api/rapports/rapport_mensuel/',
        params: [
            { key: 'mois', label: 'Mois', type: 'month', required: true }
        ],
        resultType: 'cards'
    },
    {
        id: 'ca_periode',
        name: 'CA par Période',
        description: 'Chiffre d\'affaires sur une période',
        endpoint: '/api/factures/caisse_par_tranche_horaire/',
        params: [
            { key: 'date_debut', label: 'Date début', type: 'datetime', required: true },
            { key: 'date_fin', label: 'Date fin', type: 'datetime', required: true }
        ],
        resultType: 'cards'
    },
    {
        id: 'alertes_stock',
        name: 'Alertes Stock',
        description: 'Stock < Rotation Moyenne OU Stock <= Seuil Minimum',
        endpoint: '/api/produits/stock_alerts/',
        params: [],
        resultType: 'table'
    },
    {
        id: 'produits_perimes',
        name: 'Produits Périmés / Proches',
        description: 'Produits périmés ou proches de la péremption',
        endpoint: '/api/stock-lots/',
        params: [
            { key: 'expiring_within_days', label: 'Jours avant péremption', type: 'number', default: 90 }
        ],
        resultType: 'table'
    },
    {
        id: 'creances',
        name: 'Créances en Cours',
        description: 'Factures avec solde restant à payer',
        endpoint: '/api/creances/',
        params: [],
        resultType: 'table'
    },
    {
        id: 'historique_ventes',
        name: 'Ventes par Tranche Horaire',
        description: 'Produits vendus sur une période donnée',
        endpoint: '/api/historique-ventes/ventes_par_tranche/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'datetime', required: true },
            { key: 'date_fin', label: 'Fin', type: 'datetime', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'produits_non_vendus',
        name: 'Produits Non Vendus',
        description: 'Produits sans vente depuis X jours',
        endpoint: '/api/produits/',
        params: [
            { key: 'jours_sans_vente', label: 'Jours sans vente', type: 'number', default: 90 }
        ],
        resultType: 'table'
    },
    {
        id: 'stock_negatif',
        name: 'Stock Négatif',
        description: 'Produits avec stock négatif ou faible, triés par quantité',
        endpoint: '/api/produits/',
        params: [
            { key: 'stock_lt', label: 'Stock inférieur à', type: 'number', default: 0 },
            { key: 'ordering', label: 'Tri', type: 'text', default: 'stock' }
        ],
        resultType: 'table'
    },
    {
        id: 'valeur_stock_journalier',
        name: 'Valeur Stock Journalier',
        description: 'Reconstitution historique de la valeur du stock, achats et ventes',
        endpoint: '/api/rapports/valeur_stock_journalier/',
        params: [
            { key: 'date_debut', label: 'Date début', type: 'date', required: true },
            { key: 'date_fin', label: 'Date fin', type: 'date', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'produits_tva',
        name: 'Produits avec TVA',
        description: 'Liste des produits soumis à la TVA (> 0%)',
        endpoint: '/api/produits/',
        params: [
            { key: 'tva_gt', label: 'TVA supérieure à (%)', type: 'number', default: 0 },
            { key: 'ordering', label: 'Tri', type: 'text', default: '-tva' }
        ],
        resultType: 'table'
    },
    {
        id: 'stocks_morts',
        name: 'Stocks Dormants (Dead Stock)',
        description: 'Produits à forte valeur (Argent qui dort) sans vente',
        endpoint: '/api/rapports/stocks_morts/',
        params: [
            { key: 'min_value', label: 'Valeur Min (F)', type: 'number', default: 100000 },
            { key: 'months', label: 'Mois sans vente', type: 'number', default: 6 }
        ],
        resultType: 'table'
    },
    {
        id: 'alertes_annulations',
        name: 'Alertes Annulations Suspectes',
        description: 'Utilisateurs avec un taux d\'annulation élevé (> seuil)',
        endpoint: '/api/statistiques/cancel_alerts/',
        params: [
            { key: 'threshold', label: 'Seuil annulations', type: 'number', default: 5 },
            { key: 'days', label: 'Sur les derniers (jours)', type: 'number', default: 30 }
        ],
        resultType: 'table'
    },
    {
        id: 'stats_vendeurs',
        name: 'Stats par Vendeurs',
        description: 'Classement des vendeurs par CA (hors caissiers)',
        endpoint: '/api/rapports/stats_vendeurs/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'datetime', required: true },
            { key: 'date_fin', label: 'Fin', type: 'datetime', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'produits_vendus_tva',
        name: 'Produits Vendus (Soumis à TVA)',
        description: 'Produits avec TVA > 0 vendus sur la période',
        endpoint: '/api/rapports/rapport_tva_vendus/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'date', required: true },
            { key: 'date_fin', label: 'Fin', type: 'date', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'meilleurs_clients',
        name: 'Meilleurs Clients',
        description: 'Classement clients par CA et nombre de ventes',
        endpoint: '/api/rapports/meilleurs_clients/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'date', required: true },
            { key: 'date_fin', label: 'Fin', type: 'date', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'recap_paiements_fournisseurs',
        name: 'Récapitulatif Paiements Fournisseurs',
        description: 'Somme des paiements par date et fournisseur',
        endpoint: '/api/paiements-fournisseurs/recap_journalier/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'date', required: true },
            { key: 'date_fin', label: 'Fin', type: 'date', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'produits_annules',
        name: 'Produits Annulés',
        description: 'Liste des produits issus de factures annulées avec quantités et lots',
        endpoint: '/api/rapports/produits_annules/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'date', required: false },
            { key: 'date_fin', label: 'Fin', type: 'date', required: false }
        ],
        resultType: 'table'
    }
];

export const COLUMN_LABELS: Record<string, string> = {
    rang: '#',
    client_id: 'ID',
    client_name: 'Client',
    client_type: 'Type',
    nb_ventes: 'Nb Ventes',
    chiffre_affaires: 'CA TTC',
    panier_moyen: 'Panier Moy.',
    name: 'Nom',
    nom_produit: 'Produit',
    cip: 'CIP',
    total_montant: 'Montant Total',
    stock: 'Stock',
    rayon: 'Rayon',
    fournisseur: 'Fournisseur',
    mode_paiement: 'Mode Règl.',
    reference: 'Référence',
    valeur: 'Valeur',
    pmp: 'PMP',
    vendeur: 'Vendeur',
    nbre_ventes: 'Nb Ventes',
    total: 'Total',
    status: 'Statut',
    dernier_vente: 'Dernière Vente',
    date_annulation: 'Date Annulation',
    numero_facture: 'Facture',
    quantite_annulee: 'Qté Annulée',
    lot: 'Lot',
    stock_actuel: 'Stock Actuel',
    annule_par: 'Annulé Par',
    motif: 'Motif',
    source: 'Source'
};

export const formatColumnHeader = (col: string): string => {
    return COLUMN_LABELS[col] || col.replace(/_/g, ' ');
};

export const isNumericColumn = (col: string): boolean => {
    const c = col.toLowerCase();
    return c.includes('montant') || 
           c.includes('total') || 
           c.includes('ca') || 
           c.includes('price') || 
           c.includes('cout') || 
           c.includes('marge') || 
           c.includes('chiffre_affaires') ||
           c.includes('solde') ||
           c.includes('quantite') ||
           c.includes('nbre_ventes') ||
           c.includes('nb_ventes') ||
           c.includes('panier_moyen');
};

export const formatValue = (key: string, value: unknown, t?: any): string => {
    if (value === null || value === undefined) return '-';
    
    if (key === 'source' && t) {
        return t(`reports.results.sources.${value}`, { defaultValue: String(value) });
    }

    if (key === 'status' && t) {
        // Handle common status translations if needed
        return t(`common.status.${String(value).toLowerCase()}`, { defaultValue: String(value) });
    }

    if (typeof value === 'number') {
        if (key.includes('taux') || key.includes('percent')) {
            return formatNumber(value, 1) + ' %';
        }
        if (key.includes('montant') || key.includes('total') || key.includes('ca') || key.includes('price') || key.includes('cout') || key.includes('marge')) {
            return formatCurrency(value);
        }
        return formatNumber(value);
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        if (obj.name) return String(obj.name);
        if (obj.numero_facture) return String(obj.numero_facture);
        return JSON.stringify(value);
    }
    return String(value);
};

// Hook Implementation
export function useCentreRapports() {
    const { t } = useTranslation(['reports', 'common']);
    const [searchParams] = useSearchParams();

    const [selectedQuery, setSelectedQuery] = useState<QueryDefinition | null>(null);
    const [params, setParams] = useState<Record<string, string | number | boolean>>({});
    const [results, setResults] = useState<unknown>(null);
    const [pagination, setPagination] = useState<PaginationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Client search states
    const [clients, setClients] = useState<Client[]>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [filteredClients, setFilteredClients] = useState<Client[]>([]);
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [selectedClientName, setSelectedClientName] = useState('');

    const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL ?? '', []);

    // Helpers
    const getCurrentMonth = useCallback(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }, []);

    const getCurrentDateTime = useCallback(() => {
        const now = new Date();
        return now.toISOString().slice(0, 16);
    }, []);

    const getTodayDate = useCallback(() => {
        return new Date().toISOString().slice(0, 10);
    }, []);

    const safeDate = useCallback((dateStr: unknown): Date | null => {
        if (!dateStr || typeof dateStr !== 'string') return null;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    }, []);

    const extractPath = useCallback((url: string | null): string | null => {
        if (!url) return null;
        try {
            const parsed = new URL(url);
            return parsed.pathname + parsed.search;
        } catch {
            return url;
        }
    }, []);

    // Load clients
    useEffect(() => {
        const loadClients = async () => {
            try {
                const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/clients/` : '/api/clients/';
                const { data } = await axios.get(endpoint);
                const clientList = data.results || data;
                setClients(clientList);
            } catch (err) {
                console.error('Erreur chargement clients:', err);
            }
        };
        loadClients();
    }, [apiBaseUrl]);

    // Filter clients
    useEffect(() => {
        if (clientSearch.length > 0) {
            const filtered = clients.filter(c =>
                c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                (c.phone && c.phone.includes(clientSearch))
            );
            setFilteredClients(filtered.slice(0, 10));
            setShowClientDropdown(true);
        } else {
            setFilteredClients([]);
            setShowClientDropdown(false);
        }
    }, [clientSearch, clients]);

    const handleSelectQuery = useCallback((query: QueryDefinition) => {
        setSelectedQuery(query);
        setResults(null);
        setPagination(null);
        setError(null);
        setClientSearch('');
        setSelectedClientName('');

        const defaultParams: Record<string, string | number | boolean> = {};
        query.params.forEach(p => {
            if (p.default !== undefined) {
                defaultParams[p.key] = p.default;
            } else if (p.type === 'month') {
                defaultParams[p.key] = getCurrentMonth();
            } else if (p.type === 'datetime') {
                defaultParams[p.key] = getCurrentDateTime();
            } else if (p.type === 'date') {
                defaultParams[p.key] = getTodayDate();
            }
        });
        setParams(defaultParams);
    }, [getCurrentMonth, getCurrentDateTime, getTodayDate]);

    const executeQuery = useCallback(async (urlOverride?: string) => {
        if (!selectedQuery) return;

        setLoading(true);
        setError(null);

        try {
            let endpoint = urlOverride;
            if (!endpoint) {
                endpoint = apiBaseUrl
                    ? `${apiBaseUrl.replace(/\/$/, '')}${selectedQuery.endpoint}`
                    : selectedQuery.endpoint;
            }

            const config = urlOverride ? {} : { params };
            const response = await axios.get(endpoint, config);

            let data = response.data;
            if (data.results && Array.isArray(data.results)) {
                setResults(data.results);
                setPagination({
                    count: data.count,
                    next: extractPath(data.next),
                    previous: extractPath(data.previous)
                });
            } else {
                setResults(data);
                setPagination(null);
            }

            if (!urlOverride) toast.success(`Requête "${selectedQuery.name}" exécutée`);
        } catch (err) {
            console.error('Erreur requête:', err);
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.detail || err.message);
            } else {
                setError('Erreur lors de l\'exécution de la requête');
            }
            toast.error('Erreur lors de l\'exécution');
        } finally {
            setLoading(false);
        }
    }, [selectedQuery, params, apiBaseUrl, extractPath]);

    const handlePageChange = useCallback((url: string | null) => {
        if (url) executeQuery(url);
    }, [executeQuery]);

    const downloadExcel = useCallback(() => {
        if (!results || !selectedQuery) {
            toast.error(t('results.export_no_result'));
            return;
        }

        let data: Record<string, string | number | boolean>[] = [];

        if (Array.isArray(results) && results.length > 0) {
            const columns = Object.keys(results[0]).filter(k => !k.startsWith('_') && k !== 'id').slice(0, 8);
            data = (results as Record<string, unknown>[]).map(row => {
                const obj: Record<string, string | number | boolean> = {};
                columns.forEach(col => {
                    const header = formatColumnHeader(col);
                    const val = row[col];
                    if (val === null || val === undefined) {
                        obj[header] = '';
                    } else if (typeof val === 'object' && val !== null) {
                        obj[header] = (val as { name?: string }).name || JSON.stringify(val);
                    } else {
                        obj[header] = val as string | number | boolean;
                    }
                });
                return obj;
            });
        } else if (typeof results === 'object' && results !== null && !Array.isArray(results)) {
            Object.entries(results).forEach(([key, value]) => {
                const formattedKey = formatColumnHeader(key);
                let formattedValue = '';
                if (typeof value === 'object' && value !== null) {
                    formattedValue = Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(', ');
                } else {
                    formattedValue = String(value ?? '');
                }
                const row: Record<string, string | number | boolean> = { 'Indicateur': formattedKey, 'Valeur': formattedValue };
                data.push(row);
            });
        } else {
            toast.error(t('results.export_unsupported'));
            return;
        }

        const ws = XLSX.utils.json_to_sheet(data);

        // Auto-adjust column widths
        const colWidths = Object.keys(data[0] || {}).map(key => {
            const headerLen = key.length;
            const maxContentLen = data.reduce((max, row) => {
                const val = String(row[key] || "");
                return Math.max(max, val.length);
            }, 0);
            return { wch: Math.max(headerLen, maxContentLen) + 2 };
        });
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Rapport');
        const today = new Date().toISOString().slice(0, 10);
        const filename = `${selectedQuery.id}_${today}.xlsx`;
        XLSX.writeFile(wb, filename);
        toast.success(t('results.export_success', { filename }));
    }, [results, selectedQuery, t]);

    // Auto-select from URL
    useEffect(() => {
        const reportId = searchParams.get('report');
        if (reportId && !selectedQuery) {
            const query = QUERIES.find(q => q.id === reportId);
            if (query) {
                handleSelectQuery(query);
            }
        }
    }, [searchParams, handleSelectQuery, selectedQuery]);

    return {
        state: {
            selectedQuery,
            params,
            results,
            pagination,
            loading,
            error,
            clientSearch,
            filteredClients,
            showClientDropdown,
            selectedClientName
        },
        actions: {
            handleSelectQuery,
            executeQuery,
            handlePageChange,
            downloadExcel,
            setParams,
            setClientSearch,
            setShowClientDropdown,
            setSelectedClientName,
            safeDate
        }
    };
}
