import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Creance, Client } from '../types';
import { useTranslation } from 'react-i18next';
import creanceService from '../services/creanceService';
import clientService from '../services/clientService';

export interface UseCreancesDataReturn {
    creances: Creance[];
    clients: Client[];
    loading: boolean;
    error: string | null;
    filters: {
        selectedClient: string;
        dateDebut: string;
        dateFin: string;
        showHistory: boolean;
        sortConfig: { key: keyof Creance | 'client_name', direction: 'asc' | 'desc' };
    };
    setFilters: {
        setSelectedClient: (id: string) => void;
        setDateDebut: (date: string) => void;
        setDateFin: (date: string) => void;
        setShowHistory: (show: boolean) => void;
        handleSort: (key: keyof Creance | 'client_name') => void;
    };
    groupedClients: {
        client: Client;
        total: number;
        paye: number;
        reste: number;
        count: number;
    }[];
    filteredCreances: Creance[];
    totals: {
        total: number;
        paye: number;
        reste: number;
    };
    refresh: () => void;
    selectedIds: number[];
    setSelectedIds: (ids: number[] | ((prev: number[]) => number[])) => void;
    updateLocalCreance: (id: number, data: any) => void;
    updateLocalSynthese: (clientId: number, data: any) => void;
}

export const useCreancesData = (): UseCreancesDataReturn => {
    const { t } = useTranslation(['creances', 'common']);
    
    // States
    const [creances, setCreances] = useState<Creance[]>([]);
    const [synthese, setSynthese] = useState<any[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Filters state
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [dateDebut, setDateDebut] = useState('');
    const [dateFin, setDateFin] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Creance | 'client_name', direction: 'asc' | 'desc' }>({
        key: 'date',
        direction: 'desc'
    });

    const fetchClients = useCallback(async (id?: number) => {
        try {
            if (id) {
                // Fetch single client if not already in state
                if (clients.some(c => c.id === id)) return;
                const client = await clientService.getById(id);
                setClients(prev => [...prev, client]);
            } else {
                // Only fetch list if really needed (e.g. for a selector if we add it)
                const results = await clientService.getAll({ page_size: 1000 });
                const allClients = Array.isArray(results) ? results : (results as { results: Client[] }).results || [];
                setClients(allClients); 
            }
        } catch (err) {
            console.error('Erreur chargement clients:', err);
        }
    }, [clients]);

    const fetchCreances = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Mode: Debtor List (Synthesis) - Only when not in history mode
            if (!selectedClient && !showHistory) {
                const synData = await creanceService.getSynthese({
                    date_debut: dateDebut || undefined,
                    date_fin: dateFin || undefined
                });
                setSynthese(synData);
                setCreances([]);
            } 
            // Mode: Invoice List (History or Specific Client)
            else {
                const results = await creanceService.getAll({
                    client_id: selectedClient || undefined,
                    date_debut: dateDebut || undefined,
                    date_fin: dateFin || undefined,
                    history: showHistory
                });
                setCreances(results);
                setSynthese([]);
                
                // Lazy fetch client details if a specific one is selected
                if (selectedClient) {
                    fetchClients(parseInt(selectedClient));
                }
            }
        } catch (err) {
            setError(t('creances:toasts.error_loading'));
            console.error('Erreur:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedClient, dateDebut, dateFin, showHistory, t, fetchClients]);

    useEffect(() => {
        // No longer fetching 1000 clients on mount for better performance
    }, []);

    useEffect(() => {
        fetchCreances();
    }, [fetchCreances]);

    const handleSort = (key: keyof Creance | 'client_name') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const groupedClients = useMemo(() => {
        if (!selectedClient && !showHistory) {
            if (!Array.isArray(synthese)) return [];
            return synthese.map(s => {
                const clientObj = clients?.find(c => c?.id === s?.id) || {
                    id: s?.id,
                    name: s?.client || 'Client inconnu',
                    client_type: 'PARTICULIER' as const,
                    email: '',
                    phone: '',
                    address: ''
                };
                return {
                    client: clientObj as Client,
                    total: parseFloat(s?.total_facture || '0'),
                    paye: parseFloat(s?.montant_paye || '0'),
                    reste: parseFloat(s?.solde_du || '0'),
                    count: s?.nb_factures || 0
                };
            });
        }

        const groupes: { [key: number]: { client: Client, total: number, paye: number, reste: number, count: number } } = {};

        if (Array.isArray(creances)) {
            creances.forEach(creance => {
                if (!creance || creance.client === undefined || creance.client === null) return;
                
                const resteVal = parseFloat(creance.reste_a_payer || '0');
                const isPaid = resteVal <= 0;

                if (!showHistory && isPaid) return;
                if (showHistory && !isPaid) return;

                if (!groupes[creance.client]) {
                    const clientObj = clients?.find(c => c?.id === creance.client) || {
                        id: creance.client,
                        name: creance.client_name || 'Client inconnu',
                        client_type: 'PARTICULIER' as const,
                        email: '',
                        phone: '',
                        address: ''
                    };

                    groupes[creance.client] = {
                        client: clientObj as Client,
                        total: 0,
                        paye: 0,
                        reste: 0,
                        count: 0
                    };
                }

                groupes[creance.client].total += parseFloat(creance.total_ttc || '0');
                groupes[creance.client].paye += parseFloat(creance.montant_paye || '0');
                groupes[creance.client].reste += parseFloat(creance.reste_a_payer || '0');
                groupes[creance.client].count += 1;
            });
        }

        return Object.values(groupes).sort((a, b) => b.reste - a.reste);
    }, [creances, clients, showHistory, synthese, selectedClient]);

    const filteredCreances = useMemo(() => {
        if (!selectedClient || !Array.isArray(creances)) return [];
        let result = [...creances].filter(c => c && c.client && c.client.toString() === selectedClient.toString());

        if (showHistory) {
            result = result.filter(c => parseFloat(c.reste_a_payer || '0') <= 0);
        } else {
            result = result.filter(c => parseFloat(c.reste_a_payer || '0') > 0);
        }

        if (sortConfig.key) {
            result.sort((a, b) => {
                let aValue: string | number = (a[sortConfig.key as keyof Creance] as string | number) || '';
                let bValue: string | number = (b[sortConfig.key as keyof Creance] as string | number) || '';

                if (sortConfig.key === 'client_name') {
                    aValue = a.client_name || '';
                    bValue = b.client_name || '';
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [creances, selectedClient, sortConfig, showHistory]);

    const totals = useMemo(() => {
        if (!selectedClient && !showHistory) {
            if (!Array.isArray(synthese)) return { total: 0, paye: 0, reste: 0 };
            return synthese.reduce((acc, s) => {
                acc.total += parseFloat(s?.total_facture || '0');
                acc.paye += parseFloat(s?.montant_paye || '0');
                acc.reste += parseFloat(s?.solde_du || '0');
                return acc;
            }, { total: 0, paye: 0, reste: 0 });
        }
        const source = (selectedClient ? filteredCreances : creances) || [];
        if (!Array.isArray(source)) return { total: 0, paye: 0, reste: 0 };
        
        return source.reduce((acc, c) => {
            acc.total += parseFloat(c?.total_ttc || '0');
            acc.paye += parseFloat(c?.montant_paye || '0');
            acc.reste += parseFloat(c?.reste_a_payer || '0');
            return acc;
        }, { total: 0, paye: 0, reste: 0 });
    }, [creances, filteredCreances, selectedClient, synthese, showHistory]);

    return {
        creances,
        clients,
        loading,
        error,
        filters: {
            selectedClient,
            dateDebut,
            dateFin,
            showHistory,
            sortConfig
        },
        setFilters: {
            setSelectedClient: (id: string) => {
                setSelectedClient(id);
                setSelectedIds([]);
            },
            setDateDebut,
            setDateFin,
            setShowHistory: (show) => {
                setShowHistory(show);
                setSelectedIds([]);
            },
            handleSort
        },
        groupedClients,
        filteredCreances,
        totals,
        refresh: fetchCreances,
        selectedIds,
        setSelectedIds,
        updateLocalCreance: (id: number, data: any) => {
            setCreances(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
        },
        updateLocalSynthese: (clientId: number, data: any) => {
            setSynthese(prev => prev.map(s => s.id === clientId ? { ...s, ...data } : s));
        }
    };
};
