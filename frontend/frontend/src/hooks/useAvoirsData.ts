import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useDebounce } from 'use-debounce';
import { useLocation } from 'react-router-dom';
import type { Fournisseur, ProduitModel, Avoir, LigneAvoir, StockLot, SudoState, SudoOptions, PaginatedResponse } from '../types';
import { useSudo } from './useSudo';
import avoirService from '../services/avoirService';
import fournisseurService from '../services/fournisseurService';
import produitService from '../services/produitService';

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
    sudoState: SudoState;
    requireSudo: (onSuccess: (validatorId: number, password: string) => void | Promise<void>, options?: SudoOptions) => void;
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
    updateLine: (index: number, field: keyof LigneAvoir, value: string | number | boolean | ProduitModel | undefined) => void;
    removeLine: (index: number) => void;

    // Lot Modal Specific
    lotModal: { open: boolean; lineIndex: number | null; produitId: number | null };
    setLotModal: React.Dispatch<React.SetStateAction<{ open: boolean; lineIndex: number | null; produitId: number | null }>>;
    availableLots: StockLot[];
    loadingLots: boolean;
    handleOpenLotModal: (lineIndex: number) => Promise<void>;
    handleSelectLot: (lot: StockLot) => void;

    // Selection & Bulk Actions
    selectedIds: Set<number>;
    onToggleSelection: (id: number) => void;
    onToggleSelectAll: () => void;
    onClearSelection: () => void;
    handleBulkDelete: () => Promise<void>;
    handleBulkValidate: () => Promise<void>;
    bulkLoading: boolean;
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

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);

    // --- Fetch Avoirs ---
    const fetchAvoirs = useCallback(async (search = '') => {
        setLoading(true);
        try {
            const results = await avoirService.getAll(search);
            setAvoirs(results);
            setSelectedIds(new Set());
        } catch (err: unknown) {
            console.error('Error fetching avoirs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAvoirs(debouncedListSearch);
    }, [fetchAvoirs, debouncedListSearch]);

    // --- Supplier Search ---
    useEffect(() => {
        if (!fournisseurSearch && viewMode !== 'CREATE') return;

        const searchFournisseurs = async () => {
            setIsSearchingFournisseur(true);
            try {
                const data = await fournisseurService.getAll({ search: debouncedFournisseurSearch });
                setFilteredFournisseurs(Array.isArray(data) ? data : (data as PaginatedResponse<Fournisseur>).results || []);
            } catch (error) {
                console.error("Erreur recherche fournisseur", error);
            } finally {
                setIsSearchingFournisseur(false);
            }
        };

        searchFournisseurs();
    }, [debouncedFournisseurSearch, viewMode]);

    const selectFournisseur = (f: Fournisseur) => {
        setSelectedFournisseurId(f.id.toString());
        setFournisseurSearch(f.name);
        setShowFournisseurList(false);
    };

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

    // --- Direct Navigation Setup (From Commandes) ---
    useEffect(() => {
        interface CommandeSource {
            createFromCommande?: {
                fournisseur?: number;
                fournisseur_nom?: string;
                source_commande?: number;
                produits?: Array<{
                    id: number;
                    name: string;
                    cip: string;
                    quantity: number;
                    purchase_price: string;
                    lot: string;
                    expiration: string;
                }>;
            };
        }
        const state = location.state as CommandeSource;
        if (state && state.createFromCommande) {
            const data = state.createFromCommande;

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
                const newLignes: LigneAvoir[] = data.produits.map((p, idx: number) => ({
                    id: Date.now() + idx,
                    avoir: 0,
                    produit: { id: p.id, name: p.name, cip1: p.cip, stock: 0 } as ProduitModel,
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
                type_avoir: typeAvoir as Avoir['type_avoir'],
                observations
            };

            let avoirId: number;

            if (editingAvoirId) {
                await avoirService.update(editingAvoirId, avoirPayload);
                avoirId = editingAvoirId;
                const existingLignes = selectedAvoir?.produits || [];
                await Promise.all(
                    existingLignes.map(l => avoirService.deleteLigne(l.id).catch(() => { }))
                );
            } else {
                const newAvoir = await avoirService.create(avoirPayload);
                avoirId = newAvoir.id;
            }

            const linePromises = lignes.map(ligne => {
                const produitId = typeof ligne.produit === 'object' ? ligne.produit.id : ligne.produit;
                return avoirService.createLigne({
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
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } }; message?: string };
            toast.error('Erreur lors de la sauvegarde: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (avoir: Avoir) => {
        if (!confirm(`Voulez-vous vraiment supprimer l'avoir brouillon ${avoir.numero} ?`)) return;
        try {
            setLoading(true);
            await avoirService.delete(avoir.id);
            toast.success('Avoir supprimé avec succès');
            fetchAvoirs();
            if (viewMode === 'DETAILS') setViewMode('LIST');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } }; message?: string };
            toast.error('Erreur: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleValidate = async (avoir: Avoir) => {
        requireSudo(async (validatorId, password) => {
            try {
                setSavingValidation(true);
                await avoirService.valider(avoir.id, {
                    validated_by_id: validatorId,
                    password: password
                });
                toast.success('Avoir validé et stock mis à jour');
                fetchAvoirs();
                if (viewMode === 'DETAILS') setViewMode('LIST');
            } catch (err: unknown) {
                const error = err as { response?: { data?: { error?: string } }; message?: string };
                toast.error('Erreur: ' + (error.response?.data?.error || error.message || 'Erreur inconnue'));
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
            await avoirService.updateLigne(ligneId, { est_cloture: newStatus });
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
                .map(p => avoirService.updateLigne(p.id, { est_cloture: targetStatus }));
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

    const updateLine = (index: number, field: keyof LigneAvoir, value: string | number | boolean | ProduitModel | undefined) => {
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
            const lots = await produitService.getLots(produitId);
            setAvailableLots(lots.filter((l: StockLot) => l.quantity_remaining > 0));
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

    // --- Bulk Handlers ---
    const onToggleSelection = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const onToggleSelectAll = () => {
        const draftIds = avoirs.filter(a => a.status === 'BROUILLON').map(a => a.id);
        if (selectedIds.size === draftIds.length && draftIds.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(draftIds));
        }
    };

    const onClearSelection = () => setSelectedIds(new Set());

    const handleBulkDelete = async () => {
        const count = selectedIds.size;
        if (count === 0) return;
        if (!confirm(`Supprimer ces ${count} avoirs brouillons ?`)) return;

        setBulkLoading(true);
        try {
            await Promise.all(Array.from(selectedIds).map(id => avoirService.delete(id)));
            toast.success(`${count} avoirs supprimés`);
            setSelectedIds(new Set());
            fetchAvoirs();
        } catch (err) {
            toast.error("Erreur lors de la suppression groupée");
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkValidate = async () => {
        const count = selectedIds.size;
        if (count === 0) return;

        requireSudo(async (validatorId, password) => {
            setBulkLoading(true);
            try {
                await Promise.all(Array.from(selectedIds).map(id =>
                    avoirService.valider(id, {
                        validated_by_id: validatorId,
                        password: password
                    })
                ));
                toast.success(`${count} avoirs validés`);
                setSelectedIds(new Set());
                fetchAvoirs();
            } catch (err) {
                toast.error("Erreur lors de la validation groupée");
            } finally {
                setBulkLoading(false);
            }
        }, {
            title: `Validation groupée - ${count} avoirs`,
            message: `Confirmer la validation de <strong>${count} avoirs</strong> fournisseurs ?<br/>Le stock sera réintégré pour tous.`
        });
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
        handleSelectLot,
        selectedIds,
        onToggleSelection,
        onToggleSelectAll,
        onClearSelection,
        handleBulkDelete,
        handleBulkValidate,
        bulkLoading
    };
}
