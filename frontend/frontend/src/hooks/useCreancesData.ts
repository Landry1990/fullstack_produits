import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Creance, Client } from '../types';
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
}

export const useCreancesData = (): UseCreancesDataReturn => {
    const [creances, setCreances] = useState<Creance[]>([]);
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

    const fetchClients = useCallback(async () => {
        try {
            const results = await clientService.getAll({ page_size: 1000 });
            const allClients = Array.isArray(results) ? results : (results as { results: Client[] }).results || [];
            const professionnels = allClients.filter((c: Client) => c.client_type === 'PROFESSIONNEL');
            setClients(professionnels);
        } catch (err) {
            console.error('Erreur chargement clients:', err);
        }
    }, []);

    const fetchCreances = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const results = await creanceService.getAll({
                client_id: selectedClient || undefined,
                date_debut: dateDebut || undefined,
                date_fin: dateFin || undefined,
                history: showHistory
            });
            setCreances(results);
        } catch (err) {
            setError('Erreur lors du chargement des créances');
            console.error('Erreur:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedClient, dateDebut, dateFin, showHistory]);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

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
        const groupes: { [key: number]: { client: Client, total: number, paye: number, reste: number, count: number } } = {};

        creances.forEach(creance => {
            const reste = parseFloat(creance.reste_a_payer);
            const isPaid = reste <= 0;

            if (!showHistory && isPaid) return;
            if (showHistory && !isPaid) return;

            if (!groupes[creance.client]) {
                const clientObj = clients.find(c => c.id === creance.client) || {
                    id: creance.client,
                    name: creance.client_name,
                    client_type: 'PROFESSIONNEL' as const,
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

            groupes[creance.client].total += parseFloat(creance.total_ttc);
            groupes[creance.client].paye += parseFloat(creance.montant_paye);
            groupes[creance.client].reste += parseFloat(creance.reste_a_payer);
            groupes[creance.client].count += 1;
        });

        return Object.values(groupes).sort((a, b) => b.reste - a.reste);
    }, [creances, clients, showHistory]);

    const filteredCreances = useMemo(() => {
        if (!selectedClient) return [];
        let result = [...creances].filter(c => c.client.toString() === selectedClient.toString());

        if (showHistory) {
            result = result.filter(c => parseFloat(c.reste_a_payer) <= 0);
        } else {
            result = result.filter(c => parseFloat(c.reste_a_payer) > 0);
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
        const source = selectedClient ? filteredCreances : creances;
        return source.reduce((acc, c) => {
            acc.total += parseFloat(c.total_ttc);
            acc.paye += parseFloat(c.montant_paye);
            acc.reste += parseFloat(c.reste_a_payer);
            return acc;
        }, { total: 0, paye: 0, reste: 0 });
    }, [creances, filteredCreances, selectedClient]);

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
            setSelectedClient: (id) => {
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
        setSelectedIds
    };
};
