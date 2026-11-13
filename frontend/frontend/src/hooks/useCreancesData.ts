import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Creance, Client } from '../types';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import creanceService, { type CreanceAging } from '../services/creanceService';
import clientService from '../services/clientService';
import { logger } from '../utils/logger'

interface SyntheseClient {
    id: number;
    client: string;
    plafond?: string | null;
    delai_paiement_jours?: number | null;
    phone?: string | null;
    total_facture: string;
    montant_paye: string;
    solde_du: string;
    nb_factures: number;
    plus_ancienne?: string | null;
    dernier_paiement?: string | null;
    derniere_relance?: string | null;
}

export interface GroupedClient {
    client: Client;
    total: number;
    paye: number;
    reste: number;
    count: number;
    plafond: number | null;
    delaiPaiementJours: number;
    dernierPaiement: string | null;
    derniereRelance: string | null;
    plusAncienne: string | null;
}

export interface UseCreancesDataReturn {
    creances: Creance[];
    clients: Client[];
    selectableClients: Client[];
    loading: boolean;
    error: string | null;
    filters: {
        selectedClient: string;
        dateDebut: string;
        dateFin: string;
        showHistory: boolean;
        debtorSearch: string;
        showOverdueOnly: boolean;
        sortConfig: { key: keyof Creance | 'client_name' | 'age', direction: 'asc' | 'desc' };
    };
    setFilters: {
        setSelectedClient: (id: string) => void;
        setDateDebut: (date: string) => void;
        setDateFin: (date: string) => void;
        setShowHistory: (show: boolean) => void;
        setDebtorSearch: (search: string) => void;
        setShowOverdueOnly: (show: boolean) => void;
        handleSort: (key: keyof Creance | 'client_name' | 'age') => void;
    };
    groupedClients: GroupedClient[];
    visibleClients: GroupedClient[];
    filteredCreances: Creance[];
    totals: {
        total: number;
        paye: number;
        reste: number;
    };
    aging: CreanceAging | null;
    selectedClientDelai: number;
    refresh: () => void;
    selectedIds: number[];
    setSelectedIds: (ids: number[] | ((prev: number[]) => number[])) => void;
    updateLocalCreance: (id: number, data: unknown) => void;
    updateLocalSynthese: (clientId: number, data: unknown) => void;
}

export const useCreancesData = (): UseCreancesDataReturn => {
    const { t } = useTranslation(['creances', 'common']);
    
    // States
    const [creances, setCreances] = useState<Creance[]>([]);
    const [synthese, setSynthese] = useState<SyntheseClient[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Filters state
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [dateDebut, setDateDebut] = useState('');
    const [dateFin, setDateFin] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [debtorSearch, setDebtorSearch] = useState('');
    const [showOverdueOnly, setShowOverdueOnly] = useState(false);
    const [aging, setAging] = useState<CreanceAging | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Creance | 'client_name' | 'age', direction: 'asc' | 'desc' }>({
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
            logger.error('Erreur chargement clients:', err);
        }
    }, [clients]);

    const fetchCreances = useCallback(async () => {
        // Plage de dates invalide : bloquer la requête plutôt que d'envoyer au backend
        if (dateDebut && dateFin && dateDebut > dateFin) {
            gooeyToast.error(t('creances:toasts.invalid_date_range'));
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // Mode: Debtor List (Synthesis) - Only when not in history mode
            if (!selectedClient && !showHistory) {
                const [synData, agingData] = await Promise.all([
                    creanceService.getSynthese({
                        date_debut: dateDebut || undefined,
                        date_fin: dateFin || undefined
                    }),
                    creanceService.getAging({
                        date_debut: dateDebut || undefined,
                        date_fin: dateFin || undefined
                    })
                ]);
                setSynthese(synData as SyntheseClient[]);
                setAging(agingData);
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
            logger.error('Erreur:', err);
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

    const handleSort = (key: keyof Creance | 'client_name' | 'age') => {
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
                const plafondRaw = s?.plafond ?? (clientObj as Client).plafond;
                return {
                    client: clientObj as Client,
                    total: parseFloat(s?.total_facture || '0'),
                    paye: parseFloat(s?.montant_paye || '0'),
                    reste: parseFloat(s?.solde_du || '0'),
                    count: s?.nb_factures || 0,
                    plafond: plafondRaw != null ? parseFloat(plafondRaw) : null,
                    delaiPaiementJours: s?.delai_paiement_jours ?? (clientObj as Client).delai_paiement_jours ?? 0,
                    dernierPaiement: s?.dernier_paiement ?? null,
                    derniereRelance: s?.derniere_relance ?? null,
                    plusAncienne: s?.plus_ancienne ?? null
                };
            });
        }

        const groupes: { [key: number]: GroupedClient } = {};

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
                        count: 0,
                        plafond: (clientObj as Client).plafond != null ? parseFloat((clientObj as Client).plafond!) : null,
                        delaiPaiementJours: (clientObj as Client).delai_paiement_jours ?? 0,
                        dernierPaiement: null,
                        derniereRelance: null,
                        plusAncienne: null
                    };
                }

                const groupe = groupes[creance.client];
                groupe.total += parseFloat(creance.total_ttc || '0');
                groupe.paye += parseFloat(creance.montant_paye || '0');
                groupe.reste += parseFloat(creance.reste_a_payer || '0');
                groupe.count += 1;
                if (creance.date && (!groupe.plusAncienne || creance.date < groupe.plusAncienne)) {
                    groupe.plusAncienne = creance.date;
                }
                (creance.paiements || []).forEach(p => {
                    if (p.mode_paiement === 'en_compte') return;
                    const d = p.date_paiement || p.created_at || p.date;
                    if (d && (!groupe.dernierPaiement || d > groupe.dernierPaiement)) {
                        groupe.dernierPaiement = d;
                    }
                });
            });
        }

        return Object.values(groupes).sort((a, b) => b.reste - a.reste);
    }, [creances, clients, showHistory, synthese, selectedClient]);

    // Recherche texte + filtre « en retard » sur la liste des débiteurs
    const visibleClients = useMemo(() => {
        const q = debtorSearch.trim().toLowerCase();
        const now = Date.now();
        return groupedClients.filter(g => {
            if (q && !g.client.name?.toLowerCase().includes(q)) return false;
            if (showOverdueOnly) {
                // En retard = échéance définie (>0) et dette la + ancienne au-delà
                if (!g.delaiPaiementJours || !g.plusAncienne) return false;
                const age = Math.floor((now - new Date(g.plusAncienne).getTime()) / 86400000);
                if (age <= g.delaiPaiementJours) return false;
            }
            return true;
        });
    }, [groupedClients, debtorSearch, showOverdueOnly]);

    // Délai de règlement du client sélectionné (badge « En retard » par facture)
    const selectedClientDelai = useMemo(() => {
        if (!selectedClient) return 0;
        const id = parseInt(selectedClient);
        const fromClients = clients.find(c => c.id === id)?.delai_paiement_jours;
        if (fromClients != null) return fromClients;
        const fromSynthese = synthese.find(s => s.id === id)?.delai_paiement_jours;
        return fromSynthese ?? 0;
    }, [selectedClient, clients, synthese]);

    // Options du sélecteur : les débiteurs déjà connus + clients chargés
    const selectableClients = useMemo(() => {
        const map = new Map<number, Client>();
        groupedClients.forEach(g => map.set(g.client.id, g.client));
        clients.forEach(c => map.set(c.id, c));
        return [...map.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [groupedClients, clients]);

    const filteredCreances = useMemo(() => {
        if (!selectedClient || !Array.isArray(creances)) return [];
        let result = [...creances].filter(c => c && c.client && c.client.toString() === selectedClient.toString());

        if (showHistory) {
            result = result.filter(c => parseFloat(c.reste_a_payer || '0') <= 0);
        } else {
            result = result.filter(c => parseFloat(c.reste_a_payer || '0') > 0);
        }

        if (sortConfig.key === 'age') {
            // Âge croissant = facture la plus récente d'abord (tri date inversé)
            result.sort((a, b) => {
                const cmp = (a.date || '').localeCompare(b.date || '');
                return sortConfig.direction === 'asc' ? -cmp : cmp;
            });
        } else if (sortConfig.key) {
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
        selectableClients,
        loading,
        error,
        filters: {
            selectedClient,
            dateDebut,
            dateFin,
            showHistory,
            debtorSearch,
            showOverdueOnly,
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
            setDebtorSearch,
            setShowOverdueOnly,
            handleSort
        },
        groupedClients,
        visibleClients,
        aging,
        selectedClientDelai,
        filteredCreances,
        totals,
        refresh: fetchCreances,
        selectedIds,
        setSelectedIds,
        updateLocalCreance: (id: number, data: unknown) => {
            setCreances(prev => prev.map(c => c.id === id ? { ...c, ...(data as Partial<Creance>) } : c));
        },
        updateLocalSynthese: (clientId: number, data: unknown) => {
            setSynthese(prev => prev.map(s => s.id === clientId ? { ...s, ...(data as Partial<SyntheseClient>) } : s));
        }
    };
};
