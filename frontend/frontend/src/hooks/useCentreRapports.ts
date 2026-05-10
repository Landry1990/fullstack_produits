import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { usePharmacySettings } from './usePharmacySettings';
import { exportToExcel } from '../utils/excelExport';

// Re-export types and constants from modular files
export type { QueryDefinition, QueryParam, ParamType, PaginationData, Client, Supplier, User, Famille } from './reports/types';
export * from './reports/utils';
export { QUERIES } from './reports/queries';

import { QUERIES } from './reports/queries';
import { 
    formatColumnHeader, 
    isSummableColumn,
    isAverageColumn,
    isPercentageColumn 
} from './reports/utils';
import type { 
    QueryDefinition, 
    PaginationData, 
    Client, 
    Supplier,
    User,
    Famille
} from './reports/types';

export function useCentreRapports() {
    const { t, i18n } = useTranslation(['reports', 'common']);
    const [searchParams] = useSearchParams();
    const { settings: pharmacySettings } = usePharmacySettings();

    const [selectedQuery, setSelectedQuery] = useState<QueryDefinition | null>(null);
    const [params, setParams] = useState<Record<string, string | number | boolean>>({});
    const [results, setResults] = useState<unknown>(null);
    const [pagination, setPagination] = useState<PaginationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [clients, setClients] = useState<Client[]>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [filteredClients, setFilteredClients] = useState<Client[]>([]);
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [selectedClientName, setSelectedClientName] = useState('');

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [selectedSupplierName, setSelectedSupplierName] = useState('');

    const [users, setUsers] = useState<User[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [selectedUserName, setSelectedUserName] = useState('');

    const [familles, setFamilles] = useState<Famille[]>([]);
    const [familleSearch, setFamilleSearch] = useState('');
    const [filteredFamilles, setFilteredFamilles] = useState<Famille[]>([]);
    const [showFamilleDropdown, setShowFamilleDropdown] = useState(false);
    const [selectedFamilleName, setSelectedFamilleName] = useState('');

    const [presets, setPresets] = useState<Record<string, any>[]>([]);

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

    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        const loadClients = async () => {
            try {
                const { data } = await api.get('clients/', { signal });
                const clientList = data.results || data;
                setClients(clientList);
            } catch (err: any) {
                if (err?.name !== 'CanceledError') console.error('Erreur chargement clients:', err);
            }
        };
        loadClients();

        const loadSuppliers = async () => {
            try {
                const { data } = await api.get('rapports/suppliers_with_stock/', { signal });
                setSuppliers(data);
            } catch (err: any) {
                if (err?.name !== 'CanceledError') console.error('Erreur chargement fournisseurs:', err);
            }
        };
        loadSuppliers();

        const loadUsers = async () => {
            try {
                const { data } = await api.get('users/', { signal });
                setUsers(data.results || data);
            } catch (err: any) {
                if (err?.name !== 'CanceledError') console.error('Erreur chargement utilisateurs:', err);
            }
        };
        loadUsers();

        const loadFamilles = async () => {
            try {
                const { data } = await api.get('familles/', { signal });
                setFamilles(data.results || data);
            } catch (err: any) {
                if (err?.name !== 'CanceledError') console.error('Erreur chargement familles:', err);
            }
        };
        loadFamilles();
        
        // Load Presets from LocalStorage
        const savedPresets = localStorage.getItem('report_presets:v1');
        if (savedPresets) setPresets(JSON.parse(savedPresets));

        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (supplierSearch.length > 0) {
            const filtered = suppliers.filter(s =>
                s.name.toLowerCase().includes(supplierSearch.toLowerCase())
            );
            setFilteredSuppliers(filtered.slice(0, 10));
            setShowSupplierDropdown(true);
        } else {
            setFilteredSuppliers([]);
            setShowSupplierDropdown(false);
        }
    }, [supplierSearch, suppliers]);

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

    useEffect(() => {
        if (userSearch.length > 0) {
            const filtered = users.filter(u =>
                u.username.toLowerCase().includes(userSearch.toLowerCase())
            );
            setFilteredUsers(filtered.slice(0, 10));
            setShowUserDropdown(true);
        } else {
            setFilteredUsers([]);
            setShowUserDropdown(false);
        }
    }, [userSearch, users]);

    useEffect(() => {
        if (familleSearch.length > 0) {
            const filtered = familles.filter(f =>
                f.nom.toLowerCase().includes(familleSearch.toLowerCase())
            );
            setFilteredFamilles(filtered.slice(0, 10));
            setShowFamilleDropdown(true);
        } else {
            setFilteredFamilles([]);
            setShowFamilleDropdown(false);
        }
    }, [familleSearch, familles]);

    const savePreset = useCallback((name: string) => {
        if (!selectedQuery) return;
        const newPreset = {
            id: Date.now().toString(),
            name,
            queryId: selectedQuery.id,
            params: { ...params }
        };
        const updated = [...presets, newPreset];
        setPresets(updated);
        localStorage.setItem('report_presets:v1', JSON.stringify(updated));
        toast.success('Configuration enregistrée !');
    }, [selectedQuery, params, presets]);

    const deletePreset = useCallback((id: string) => {
        const updated = presets.filter(p => p.id !== id);
        setPresets(updated);
        localStorage.setItem('report_presets:v1', JSON.stringify(updated));
    }, [presets]);

    const applyPreset = useCallback((preset: any) => {
        const query = QUERIES.find(q => q.id === preset.queryId);
        if (query) {
            setSelectedQuery(query);
            setParams(preset.params);
            toast.success(`Chargement de : ${preset.name}`);
        }
    }, []);

    const handleSelectQuery = useCallback((query: QueryDefinition) => {
        setSelectedQuery(query);
        setResults(null);
        setPagination(null);
        setError(null);
        setClientSearch('');
        setSelectedClientName('');
        setSupplierSearch('');
        setSelectedSupplierName('');

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

    const executeQuery = useCallback(async (urlOverride?: string, extraParams?: Record<string, any>) => {
        if (!selectedQuery) return;

        setLoading(true);
        setError(null);

        try {
            const relPath = (p: string) => p.replace(/^\/api\//, '');
            const endpoint = urlOverride ? urlOverride : relPath(selectedQuery.endpoint);

            const mergedParams = extraParams ? { ...params, ...extraParams } : params;
            
            if (selectedQuery.id === 'balance_stock' && !urlOverride) {
                const response = await api.get(endpoint, {
                    params: { ...params, lang: i18n.language },
                    responseType: 'blob'
                });
                
                const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                const link = document.createElement('a');
                link.href = url;
                const filename = `Balance_Stocks_${params.date_debut}_${params.date_fin}.xlsx`;
                
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                
                toast.success(t('results.export_success', { filename }));
                setResults({ status: 'success', filename });
                setLoading(false);
                return;
            }

            if (selectedQuery.id === 'export_sage' && !urlOverride) {
                const response = await api.get(endpoint, {
                    params: mergedParams,
                    responseType: 'blob'
                });
                
                const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
                const link = document.createElement('a');
                link.href = url;
                const filename = `Export_Sage_i7_${params.date_debut}_${params.date_fin}.csv`;
                
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                
                toast.success(t('results.export_success', { filename }));
                setResults({ status: 'success', filename });
                setLoading(false);
                return;
            }

            if (selectedQuery.id === 'recap_valeur_stock_pdf' && !urlOverride) {
                const valorisation = params.valorisation || 'ACHAT';
                const groupBy = params.group_by || '';
                const printUrl = `/app/printing/0?type=STOCK_VALUATION&valorisation=${valorisation}&group_by=${groupBy}`;
                window.open(printUrl, '_blank');
                setResults({ status: 'success', filename: 'Impression lancée' });
                setLoading(false);
                return;
            }

            const response = urlOverride
                ? await api.get(urlOverride)
                : await api.get(endpoint, { params: mergedParams });

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
        } catch (err: any) {
            console.error('Erreur requête:', err);
            setError(err.response?.data?.detail || err.message || 'Erreur lors de l\'exécution de la requête');
            toast.error('Erreur lors de l\'exécution');
        } finally {
            setLoading(false);
        }
    }, [selectedQuery, params, extractPath, i18n.language, t]);

    const handlePageChange = useCallback((url: string | null) => {
        if (url) executeQuery(url);
    }, [executeQuery]);

    const downloadExcel = useCallback(async () => {
        if (!results || !selectedQuery) {
            toast.error(t('results.export_no_result'));
            return;
        }

        if (selectedQuery.id === 'rapport_remises' || selectedQuery.id === 'rapport_remises_details') {
            const { date_debut, date_fin } = params;
            const isDetails = selectedQuery.id === 'rapport_remises_details';
            const action = isDetails ? 'rapport_remises_details_excel' : 'rapport_remises_excel';
            const filename = isDetails ? `Details_Remises_${date_debut}.xlsx` : `Rapport_Remises_${date_debut}.xlsx`;
            
            try {
                const response = await api.get(`rapports/${action}/`, {
                    params: { date_debut, date_fin },
                    responseType: 'blob'
                });
                
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                toast.success(t('results.export_success', { filename }));
            } catch (err) {
                console.error('Excel download error:', err);
                toast.error("Erreur lors du téléchargement Excel");
            }
            return;
        }

        let data: Record<string, string | number | boolean>[] = [];

        if (Array.isArray(results) && results.length > 0) {
            const columns = Object.keys(results[0]).filter(k => !k.startsWith('_') && k !== 'id').slice(0, 20);
            data = (results as Record<string, unknown>[]).map(row => {
                const obj: Record<string, string | number | boolean> = {};
                columns.forEach(col => {
                    const header = formatColumnHeader(col, t);
                    const val = row[col];
                    if (val === null || val === undefined) {
                        obj[header] = '';
                    } else if (typeof val === 'object' && val !== null) {
                        obj[header] = (val as { name?: string }).name || JSON.stringify(val);
                    } else if (typeof val === 'number') {
                        obj[header] = Math.round(val);
                    } else {
                        if (col === 'Mois') {
                            obj[header] = t(`common:months.${val}`, { defaultValue: String(val) });
                        } else {
                            obj[header] = val as string | boolean;
                        }
                    }
                });
                return obj;
            });

            // Summary Footer Logic
            const footerRow: Record<string, string | number | boolean> = {};
            columns.forEach((col, idx) => {
                const header = formatColumnHeader(col, t);
                if (idx === 0) {
                    footerRow[header] = 'TOTAL / MOYENNE';
                } else if (isAverageColumn(col)) {
                    const total = results.reduce((sum: number, r: any) => sum + (Number(r[col]) || 0), 0);
                    const avg = results.length > 0 ? total / results.length : 0;
                    footerRow[header] = `${Math.round(avg)} (Moy)`;
                } else if (isSummableColumn(col)) {
                    const total = results.reduce((sum: number, r: any) => sum + (Number(r[col]) || 0), 0);
                    footerRow[header] = Math.round(total);
                } else if (isPercentageColumn(col)) {
                    let finalVal: string | number = '';
                    if (col === 'taux_marge') {
                        const totalMtVente = results.reduce((sum: number, r: any) => sum + (Number(r['mt_vente']) || 0), 0);
                        const totalMarge   = results.reduce((sum: number, r: any) => sum + (Number(r['marge']) || 0), 0);
                        if (totalMtVente > 0) {
                            finalVal = ((totalMarge / totalMtVente) * 100).toFixed(1) + ' % (Global)';
                        }
                    }
                    if (!finalVal) {
                        const total = results.reduce((sum: number, r: any) => sum + (Number(r[col]) || 0), 0);
                        const avg = results.length > 0 ? (total / results.length) : 0;
                        finalVal = avg.toFixed(1) + ' % (Moy)';
                    }
                    footerRow[header] = finalVal;
                } else {
                    footerRow[header] = '';
                }
            });
            data.push(footerRow);
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

        const today = new Date().toISOString().slice(0, 10);
        const filename = `${selectedQuery.id}_${today}.xlsx`;
        exportToExcel(data, pharmacySettings, {
            sheetName: 'Rapport',
            filename,
            title: selectedQuery.name,
        });
        toast.success(t('results.export_success', { filename }));
    }, [results, selectedQuery, t, params, pharmacySettings]);

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
            selectedClientName,
            supplierSearch,
            filteredSuppliers,
            showSupplierDropdown,
            selectedSupplierName,
            userSearch,
            filteredUsers,
            showUserDropdown,
            selectedUserName,
            familleSearch,
            filteredFamilles,
            showFamilleDropdown,
            selectedFamilleName,
            presets
        },
        actions: {
            handleSelectQuery,
            setParams,
            executeQuery,
            handlePageChange,
            downloadExcel,
            clientActions: {
                setQuery: setClientSearch,
                setShowDropdown: setShowClientDropdown,
                setSelectedName: setSelectedClientName
            },
            supplierActions: {
                setQuery: setSupplierSearch,
                setShowDropdown: setShowSupplierDropdown,
                setSelectedName: setSelectedSupplierName
            },
            userActions: {
                setQuery: setUserSearch,
                setShowDropdown: setShowUserDropdown,
                setSelectedName: setSelectedUserName
            },
            familleActions: {
                setQuery: setFamilleSearch,
                setShowDropdown: setShowFamilleDropdown,
                setSelectedName: setSelectedFamilleName
            },
            presets: {
                save: savePreset,
                delete: deletePreset,
                apply: applyPreset
            },
            safeDate
        }
    };
}
