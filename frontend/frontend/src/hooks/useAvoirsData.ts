import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useDebounce } from 'use-debounce';
import { useLocation } from 'react-router-dom';
import type { Fournisseur, ProduitModel, Avoir, LigneAvoir, StockLot } from '../types';
import { useSudo } from './useSudo';

export type ViewMode = 'LIST' | 'CREATE' | 'EDIT' | 'DETAILS';

export interface UseAvoirsDataReturn {
    // Navigation State
    viewMode: ViewMode;
    setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;

    // Data State
    avoirs: Avoir[];
    loading: boolean;
    selectedAvoir: Avoir | null;
    setSelectedAvoir: React.Dispatch<React.SetStateAction<Avoir | null>>;

    // Search State (List View)
    listSearchQuery: string;
    setListSearchQuery: React.Dispatch<React.SetStateAction<string>>;

    // Sudo State
    sudoState: any; // We use any or import SudoState if exported from useSudo.
    requireSudo: (onSuccess: (validatorId: number, password: string) => void | Promise<void>, options?: any) => void;
    closeSudo: () => void;
    savingValidation: boolean;

    // Form State (Create/Edit View)
    editingAvoirId: number | null;
    selectedFournisseurId: string;
    setSelectedFournisseurId: React.Dispatch<React.SetStateAction<string>>;
    typeAvoir: string;
    setTypeAvoir: React.Dispatch<React.SetStateAction<string>>;
    observations: string;
    setObservations: React.Dispatch<React.SetStateAction<string>>;
    lignes: LigneAvoir[];
    setLignes: React.Dispatch<React.SetStateAction<LigneAvoir[]>>;

    // Fournisseur Search State
    fournisseurSearch: string;
    setFournisseurSearch: React.Dispatch<React.SetStateAction<string>>;
    filteredFournisseurs: Fournisseur[];
    isSearchingFournisseur: boolean;
    showFournisseurList: boolean;
    setShowFournisseurList: React.Dispatch<React.SetStateAction<boolean>>;
    selectFournisseur: (f: Fournisseur) => void;

    // Actions
    fetchAvoirs: (search?: string) => Promise<void>;
    handleCreateNew: () => void;
    handleEdit: (avoir: Avoir) => void;
    handleBackToList: () => void;
    handleSave: (e: React.FormEvent) => Promise<void>;
    handleDelete: (avoir: Avoir) => Promise<void>;
    handleValidate: (avoir: Avoir) => Promise<void>;
    handleToggleCloture: (ligneId: number, currentStatus: boolean | undefined) => Promise<void>;
    handleToggleAllCloture: () => Promise<void>;

    // Products & Lots Management (Form View)
    selectProduct: (product: ProduitModel) => void;
    updateLine: (index: number, field: keyof LigneAvoir, value: any) => void;
    removeLine: (index: number) => void;

    // Lot Modal Specific
    lotModal: { open: boolean; lineIndex: number | null; produitId: number | null };
    setLotModal: React.Dispatch<React.SetStateAction<{ open: boolean; lineIndex: number | null; produitId: number | null }>>;
    availableLots: StockLot[];
    loadingLots: boolean;
    handleOpenLotModal: (lineIndex: number) => Promise<void>;
    handleSelectLot: (lot: StockLot) => void;
}

export function useAvoirsData(): UseAvoirsDataReturn {
    // Navigation
    const [viewMode, setViewMode] = useState<ViewMode>('LIST');
    const location = useLocation();

    // Basic State
    const [avoirs, setAvoirs] = useState<Avoir[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [selectedAvoir, setSelectedAvoir] = useState<Avoir | null>(null);

    // Search List
    const [listSearchQuery, setListSearchQuery] = useState('');
    const [debouncedListSearch] = useDebounce(listSearchQuery, 500);

    // Form State
    const [editingAvoirId, setEditingAvoirId] = useState<number | null>(null);
    const [selectedFournisseurId, setSelectedFournisseurId] = useState<string>('');
    const [typeAvoir, setTypeAvoir] = useState<string>('PERIME');
    const [observations, setObservations] = useState<string>('');
    const [lignes, setLignes] = useState<LigneAvoir[]>([]);

    // Fournisseur Search State
    const [fournisseurSearch, setFournisseurSearch] = useState('');
    const [debouncedFournisseurSearch] = useDebounce(fournisseurSearch, 300);
    const [filteredFournisseurs, setFilteredFournisseurs] = useState<Fournisseur[]>([]);
    const [isSearchingFournisseur, setIsSearchingFournisseur] = useState(false);
    const [showFournisseurList, setShowFournisseurList] = useState(false);

    // Lot Modal State
    const [lotModal, setLotModal] = useState<{ open: boolean; lineIndex: number | null; produitId: number | null }>({ open: false, lineIndex: null, produitId: null });
    const [availableLots, setAvailableLots] = useState<StockLot[]>([]);
    const [loadingLots, setLoadingLots] = useState(false);

    // Sudo State
    const { sudoState, requireSudo, closeSudo } = useSudo();
    const [savingValidation, setSavingValidation] = useState(false);

    // Endpoints
    const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL ?? '', []);
    const endpoints = useMemo(() => ({
        avoirs: `${apiBaseUrl.replace(/\/$/, '')}/api/avoirs/`,
        fournisseurs: `${apiBaseUrl.replace(/\/$/, '')}/api/fournisseurs/`,
        ligneAvoirs: `${apiBaseUrl.replace(/\/$/, '')}/api/ligne-avoirs/`,
        stockLots: `${apiBaseUrl.replace(/\/$/, '')}/api/stock-lots/`
    }), [apiBaseUrl]);

    // --- Fetch Avoirs ---
    const fetchAvoirs = useCallback(async (search = '') => {
        setLoading(true);
        try {
            const url = search
                ? `${endpoints.avoirs}?search=${encodeURIComponent(search)}`
                : endpoints.avoirs;

            const res = await axios.get(url);
            const avoirsData = res.data;
            setAvoirs(Array.isArray(avoirsData) ? avoirsData : (avoirsData.results || []));
        } catch (err: unknown) {
            console.error('Error fetching avoirs:', err);
        } finally {
            setLoading(false);
        }
    }, [endpoints.avoirs]);

    useEffect(() => {
        fetchAvoirs(debouncedListSearch);
    }, [fetchAvoirs, debouncedListSearch]);

    // --- Supplier Search ---
    useEffect(() => {
        if (!fournisseurSearch && viewMode !== 'CREATE') return;

        const searchFournisseurs = async () => {
            setIsSearchingFournisseur(true);
            try {
                const url = `${endpoints.fournisseurs}?search=${encodeURIComponent(debouncedFournisseurSearch)}`;
                const res = await axios.get(url);
                const data = res.data;
                setFilteredFournisseurs(Array.isArray(data) ? data : (data.results || []));
            } catch (error) {
                console.error("Erreur recherche fournisseur", error);
            } finally {
                setIsSearchingFournisseur(false);
            }
        };

        searchFournisseurs();
    }, [debouncedFournisseurSearch, endpoints.fournisseurs, viewMode]);

    const selectFournisseur = (f: Fournisseur) => {
        setSelectedFournisseurId(f.id.toString());
        setFournisseurSearch(f.name);
        setShowFournisseurList(false);
    };

    // --- Direct Navigation Setup (From Commandes) ---
    useEffect(() => {
        if (location.state && (location.state as any).createFromCommande) {
            const data = (location.state as any).createFromCommande;

            setViewMode('CREATE');
            setSelectedAvoir(null);
            setEditingAvoirId(null);
            setLignes([]);

            if (data.fournisseur) {
                setSelectedFournisseurId(String(data.fournisseur));
                setFournisseurSearch(data.fournisseur_nom || '');
            }

            setTypeAvoir('PERIME');
            setObservations(`Retour suite à commande #${data.source_commande}`);

            if (Array.isArray(data.produits)) {
                const newLignes: LigneAvoir[] = data.produits.map((p: any, idx: number) => ({
                    id: Date.now() + idx,
                    avoir: 0,
                    produit: { id: p.id, name: p.name, cip1: p.cip, stock: 0 } as any,
                    quantity: p.quantity || 0,
                    price: p.purchase_price || '0',
                    lot: p.lot || '',
                    date_expiration: p.expiration || '',
                    total: '0'
                }));
                setLignes(newLignes);
            }

            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // --- Handlers ---
    const handleCreateNew = () => {
        setViewMode('CREATE');
        setSelectedAvoir(null);
        setEditingAvoirId(null);
        setSelectedFournisseurId('');
        setFournisseurSearch('');
        setTypeAvoir('PERIME');
        setObservations('');
        setLignes([]);
    };

    const handleEdit = (avoir: Avoir) => {
        setEditingAvoirId(avoir.id);
        setSelectedAvoir(avoir);
        setSelectedFournisseurId(avoir.fournisseur.toString());
        setFournisseurSearch(avoir.fournisseur_name || '');
        setTypeAvoir(avoir.type_avoir);
        setObservations(avoir.observations || '');

        const existingLignes: LigneAvoir[] = (avoir.produits || []).map(p => ({
            id: p.id,
            avoir: avoir.id,
            produit: {
                id: p.produit,
                name: p.produit_nom,
                cip1: p.produit_cip || '',
                stock: 0,
                selling_price: p.price,
                cost_price: p.price
            } as ProduitModel,
            quantity: p.quantity,
            price: p.price,
            lot: p.lot || '',
            stock_lot: p.stock_lot || undefined,
            date_expiration: p.date_expiration || '',
            total: p.total || (Number(p.quantity) * Number(p.price)).toString()
        }));

        setLignes(existingLignes);
        setViewMode('EDIT');
    };

    const handleBackToList = () => {
        if (viewMode === 'DETAILS') {
            setViewMode('LIST');
            setSelectedAvoir(null);
            return;
        }

        if (confirm('Voulez-vous vraiment quitter ? Les modifications non enregistrées seront perdues.')) {
            setViewMode('LIST');
            setSelectedAvoir(null);
        }
    };

    const handleSave = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!selectedFournisseurId) {
            toast('Veuillez sélectionner un fournisseur', { icon: '⚠️' });
            return;
        }
        if (lignes.length === 0) {
            toast('Veuillez ajouter au moins un produit', { icon: '⚠️' });
            return;
        }

        try {
            setLoading(true);
            const avoirPayload = {
                fournisseur: parseInt(selectedFournisseurId),
                type_avoir: typeAvoir,
                observations
            };

            let avoirId: number;

            if (editingAvoirId) {
                await axios.patch(`${endpoints.avoirs}${editingAvoirId}/`, avoirPayload);
                avoirId = editingAvoirId;
                const existingLignes = selectedAvoir?.produits || [];
                await Promise.all(
                    existingLignes.map(l => axios.delete(`${endpoints.ligneAvoirs}${l.id}/`).catch(() => { }))
                );
            } else {
                const { data: newAvoir } = await axios.post(endpoints.avoirs, avoirPayload);
                avoirId = newAvoir.id;
            }

            const linePromises = lignes.map(ligne => {
                const produitId = typeof ligne.produit === 'object' ? ligne.produit.id : ligne.produit;
                return axios.post(endpoints.ligneAvoirs, {
                    avoir: avoirId,
                    produit: produitId,
                    stock_lot: ligne.stock_lot || null,
                    quantity: ligne.quantity,
                    price: ligne.price,
                    lot: ligne.lot,
                    date_expiration: ligne.date_expiration || null
                });
            });

            await Promise.all(linePromises);
            toast.success(editingAvoirId ? 'Avoir modifié avec succès' : 'Avoir créé avec succès (Brouillon)');
            setEditingAvoirId(null);
            setViewMode('LIST');
            fetchAvoirs();
        } catch (err: any) {
            toast.error('Erreur lors de la sauvegarde: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (avoir: Avoir) => {
        if (!confirm(`Voulez-vous vraiment supprimer l'avoir brouillon ${avoir.numero} ?`)) return;
        try {
            setLoading(true);
            await axios.delete(`${endpoints.avoirs}${avoir.id}/`);
            toast.success('Avoir supprimé avec succès');
            fetchAvoirs();
            if (viewMode === 'DETAILS') setViewMode('LIST');
        } catch (err: any) {
            toast.error('Erreur: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleValidate = async (avoir: Avoir) => {
        requireSudo(async (validatorId, password) => {
            try {
                setSavingValidation(true);
                await axios.post(`${endpoints.avoirs}${avoir.id}/valider/`, {
                    validated_by_id: validatorId,
                    password: password
                });
                toast.success('Avoir validé et stock mis à jour');
                fetchAvoirs();
                if (viewMode === 'DETAILS') setViewMode('LIST');
            } catch (err: any) {
                toast.error('Erreur: ' + (err.response?.data?.error || err.message || 'Erreur inconnue'));
            } finally {
                setSavingValidation(false);
            }
        }, {
            title: `Validation Avoir - ${avoir.numero}`,
            message: `Confirmer la validation de l'avoir fournisseur <strong>${avoir.numero}</strong> ?<br/>Cela réintégrera les produits en stock (ou ajustera selon le type).`
        });
    };

    const handleToggleCloture = async (ligneId: number, currentStatus: boolean | undefined) => {
        const newStatus = !currentStatus;
        const updateState = (status: boolean) => {
            setSelectedAvoir(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    produits: prev.produits?.map(p => p.id === ligneId ? { ...p, est_cloture: status } : p) || []
                };
            });
            setAvoirs(prev => prev.map(a => {
                if (a.id === selectedAvoir?.id) {
                    return {
                        ...a,
                        produits: a.produits?.map(p => p.id === ligneId ? { ...p, est_cloture: status } : p)
                    };
                }
                return a;
            }));
        };

        updateState(newStatus);
        try {
            await axios.patch(`${endpoints.ligneAvoirs}${ligneId}/`, { est_cloture: newStatus });
            toast.success(newStatus ? 'Ligne clôturée' : 'Ligne réouverte');
        } catch (err) {
            toast.error("Erreur lors de la mise à jour");
            updateState(!newStatus);
        }
    };

    const handleToggleAllCloture = async () => {
        if (!selectedAvoir || !selectedAvoir.produits) return;
        const allClosed = selectedAvoir.produits.every(p => p.est_cloture);
        const targetStatus = !allClosed;

        // Optimistic Update
        const originalProduits = [...selectedAvoir.produits];
        const updateState = (status: boolean) => {
            setSelectedAvoir(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    produits: prev.produits?.map(p => ({ ...p, est_cloture: status })) || []
                };
            });
            setAvoirs(prev => prev.map(a => {
                if (a.id === selectedAvoir?.id) {
                    return {
                        ...a,
                        produits: a.produits?.map(p => ({ ...p, est_cloture: status }))
                    };
                }
                return a;
            }));
        };

        updateState(targetStatus);

        try {
            const promises = selectedAvoir.produits
                .filter(p => !!p.id)
                .map(p => axios.patch(`${endpoints.ligneAvoirs}${p.id}/`, { est_cloture: targetStatus }));
            await Promise.all(promises);
            toast.success(targetStatus ? 'Toutes les lignes clôturées' : 'Toutes les lignes réouvertes');
        } catch (err) {
            toast.error("Erreur lors de la mise en masse");
            // Rollback
            setSelectedAvoir(prev => prev ? { ...prev, produits: originalProduits } : null);
        }
    };

    // --- Line Building functions ---
    const selectProduct = (product: ProduitModel) => {
        const existing = lignes.find(l => (typeof l.produit === 'object' ? l.produit.id : l.produit) === product.id);
        if (existing) {
            toast.error('Ce produit est déjà dans la liste');
            return;
        }
        const newLine: LigneAvoir = {
            id: Date.now(),
            avoir: 0,
            produit: product,
            quantity: 1,
            price: product.cost_price || '0',
            lot: '',
            date_expiration: '',
            total: product.cost_price || '0'
        };
        setLignes(prev => [newLine, ...prev]);
    };

    const updateLine = (index: number, field: keyof LigneAvoir, value: any) => {
        setLignes(prev => {
            const newLignes = [...prev];
            const line = { ...newLignes[index] };
            // @ts-ignore
            line[field] = value;
            if (field === 'quantity' || field === 'price') {
                const qty = field === 'quantity' ? Number(value) : Number(line.quantity);
                const price = field === 'price' ? Number(value) : Number(line.price);
                line.total = (qty * price).toString();
            }
            newLignes[index] = line;
            return newLignes;
        });
    };

    const removeLine = (index: number) => {
        setLignes(prev => prev.filter((_, i) => i !== index));
    };

    // --- Lots Modal Functions ---
    const handleOpenLotModal = async (lineIndex: number) => {
        const line = lignes[lineIndex];
        if (!line) return;
        const produitId = typeof line.produit === 'object' ? line.produit.id : line.produit;

        setLotModal({ open: true, lineIndex, produitId });
        setLoadingLots(true);

        try {
            const params = new URLSearchParams({ produit: produitId.toString(), ordering: 'date_expiration' });
            const response = await axios.get(`${endpoints.stockLots}?${params}`);
            const lots: StockLot[] = Array.isArray(response.data) ? response.data : (response.data.results || []);
            setAvailableLots(lots.filter(l => l.quantity_remaining > 0));
        } catch (err) {
            toast.error('Erreur lors du chargement des lots');
        } finally {
            setLoadingLots(false);
        }
    };

    const handleSelectLot = (lot: StockLot) => {
        if (lotModal.lineIndex === null) return;
        setLignes(prev => {
            const newLignes = [...prev];
            const line = { ...newLignes[lotModal.lineIndex!] };

            line.stock_lot = lot.id;
            line.lot = lot.lot || '';
            line.date_expiration = lot.date_expiration || '';
            line.price = lot.price_cost?.toString() || line.price;
            line.total = (Number(line.quantity) * Number(line.price)).toString();

            newLignes[lotModal.lineIndex!] = line;
            return newLignes;
        });
        setLotModal({ open: false, lineIndex: null, produitId: null });
    };

    return {
        viewMode,
        setViewMode,
        avoirs,
        loading,
        selectedAvoir,
        setSelectedAvoir,
        listSearchQuery,
        setListSearchQuery,
        sudoState,
        requireSudo,
        closeSudo,
        savingValidation,
        editingAvoirId,
        selectedFournisseurId,
        setSelectedFournisseurId,
        typeAvoir,
        setTypeAvoir,
        observations,
        setObservations,
        lignes,
        setLignes,
        fournisseurSearch,
        setFournisseurSearch,
        filteredFournisseurs,
        isSearchingFournisseur,
        showFournisseurList,
        setShowFournisseurList,
        selectFournisseur,
        fetchAvoirs,
        handleCreateNew,
        handleEdit,
        handleBackToList,
        handleSave,
        handleDelete,
        handleValidate,
        handleToggleCloture,
        handleToggleAllCloture,
        selectProduct,
        updateLine,
        removeLine,
        lotModal,
        setLotModal,
        availableLots,
        loadingLots,
        handleOpenLotModal,
        handleSelectLot
    };
}
