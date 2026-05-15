import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { useDebounce } from 'use-debounce';
import { useLocation } from 'react-router-dom';
import type { Fournisseur, ProduitModel, Avoir, LigneAvoir, StockLot, SudoState, SudoOptions, PaginatedResponse } from '../types';
import { useSudo } from './useSudo';
import avoirService from '../services/avoirService';
import fournisseurService from '../services/fournisseurService';
import produitService from '../services/produitService';
import { useAvoirsStore, type ViewMode } from '../stores/useAvoirsStore';

export interface UseAvoirsDataReturn {
    // Navigation State
    viewMode: ViewMode;
    setViewMode: (value: ViewMode) => void;

    // Data State
    avoirs: Avoir[];
    loading: boolean;
    selectedAvoir: Avoir | null;
    setSelectedAvoir: React.Dispatch<React.SetStateAction<Avoir | null>>;

    // Search State (List View)
    listSearchQuery: string;
    setListSearchQuery: (value: string) => void;

    // Sudo State
    sudoState: SudoState;
    requireSudo: (onSuccess: (validatorId: number, password: string) => void | Promise<void>, options?: SudoOptions) => void;
    closeSudo: () => void;
    savingValidation: boolean;

    // Form State (Create/Edit View)
    editingAvoirId: number | null;
    selectedFournisseurId: string;
    setSelectedFournisseurId: (value: string) => void;
    typeAvoir: string;
    setTypeAvoir: (value: string) => void;
    observations: string;
    setObservations: (value: string) => void;
    lignes: LigneAvoir[];
    setLignes: React.Dispatch<React.SetStateAction<LigneAvoir[]>>;

    // Fournisseur Search State
    fournisseurSearch: string;
    setFournisseurSearch: (value: string) => void;
    filteredFournisseurs: Fournisseur[];
    isSearchingFournisseur: boolean;
    showFournisseurList: boolean;
    setShowFournisseurList: (value: boolean) => void;
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
    const { t } = useTranslation(['stock', 'common']);
    const location = useLocation();

    const viewMode = useAvoirsStore((s) => s.viewMode);
    const setViewMode = useAvoirsStore((s) => s.setViewMode);
    const avoirs = useAvoirsStore((s) => s.avoirs);
    const setAvoirs = useAvoirsStore((s) => s.setAvoirs);
    const loading = useAvoirsStore((s) => s.loading);
    const setLoading = useAvoirsStore((s) => s.setLoading);
    const selectedAvoir = useAvoirsStore((s) => s.selectedAvoir);
    const setSelectedAvoir = useAvoirsStore((s) => s.setSelectedAvoir);
    const listSearchQuery = useAvoirsStore((s) => s.listSearchQuery);
    const setListSearchQuery = useAvoirsStore((s) => s.setListSearchQuery);
    const [debouncedListSearch] = useDebounce(listSearchQuery, 500);

    const editingAvoirId = useAvoirsStore((s) => s.editingAvoirId);
    const setEditingAvoirId = useAvoirsStore((s) => s.setEditingAvoirId);
    const selectedFournisseurId = useAvoirsStore((s) => s.selectedFournisseurId);
    const setSelectedFournisseurId = useAvoirsStore((s) => s.setSelectedFournisseurId);
    const typeAvoir = useAvoirsStore((s) => s.typeAvoir);
    const setTypeAvoir = useAvoirsStore((s) => s.setTypeAvoir);
    const observations = useAvoirsStore((s) => s.observations);
    const setObservations = useAvoirsStore((s) => s.setObservations);
    const lignes = useAvoirsStore((s) => s.lignes);
    const setLignes = useAvoirsStore((s) => s.setLignes);

    const fournisseurSearch = useAvoirsStore((s) => s.fournisseurSearch);
    const setFournisseurSearch = useAvoirsStore((s) => s.setFournisseurSearch);
    const [debouncedFournisseurSearch] = useDebounce(fournisseurSearch, 300);
    const filteredFournisseurs = useAvoirsStore((s) => s.filteredFournisseurs);
    const setFilteredFournisseurs = useAvoirsStore((s) => s.setFilteredFournisseurs);
    const isSearchingFournisseur = useAvoirsStore((s) => s.isSearchingFournisseur);
    const setIsSearchingFournisseur = useAvoirsStore((s) => s.setIsSearchingFournisseur);
    const showFournisseurList = useAvoirsStore((s) => s.showFournisseurList);
    const setShowFournisseurList = useAvoirsStore((s) => s.setShowFournisseurList);

    const lotModal = useAvoirsStore((s) => s.lotModal);
    const setLotModal = useAvoirsStore((s) => s.setLotModal);
    const availableLots = useAvoirsStore((s) => s.availableLots);
    const setAvailableLots = useAvoirsStore((s) => s.setAvailableLots);
    const loadingLots = useAvoirsStore((s) => s.loadingLots);
    const setLoadingLots = useAvoirsStore((s) => s.setLoadingLots);

    // Sudo State
    const { sudoState, requireSudo, closeSudo } = useSudo();
    const savingValidation = useAvoirsStore((s) => s.savingValidation);
    const setSavingValidation = useAvoirsStore((s) => s.setSavingValidation);
    const selectedIds = useAvoirsStore((s) => s.selectedIds);
    const setSelectedIds = useAvoirsStore((s) => s.setSelectedIds);
    const bulkLoading = useAvoirsStore((s) => s.bulkLoading);
    const setBulkLoading = useAvoirsStore((s) => s.setBulkLoading);

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
    }, []);

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

        if (confirm(t('avoirs.confirms.back_to_list'))) {
            setViewMode('LIST');
            setSelectedAvoir(null);
        }
    };

    const handleSave = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!selectedFournisseurId) {
            toast(t('avoirs.toasts.select_supplier'), { icon: '⚠️' });
            return;
        }
        if (lignes.length === 0) {
            toast(t('avoirs.toasts.add_product'), { icon: '⚠️' });
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
                    date_expiration: ligne.date_expiration || undefined
                });
            });

            await Promise.all(linePromises);
            toast.success(editingAvoirId ? 'Avoir modifié avec succès' : 'Avoir créé avec succès (Brouillon)');
            setEditingAvoirId(null);
            setViewMode('LIST');
            fetchAvoirs();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } }; message?: string };
            toast.error(t('avoirs.toasts.save_error') + ': ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (avoir: Avoir) => {
        if (!confirm(t('avoirs.confirms.delete_avoir', { numero: avoir.numero }))) return;
        try {
            setLoading(true);
            await avoirService.delete(avoir.id);
            toast.success(t('avoirs.toasts.delete_success'));
            setAvoirs(avoirs.filter(a => a.id !== avoir.id));
            if (viewMode === 'DETAILS') setViewMode('LIST');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } }; message?: string };
            toast.error(t('avoirs.toasts.delete_error') + ': ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleValidate = async (avoir: Avoir) => {
        requireSudo(async (validatorId, password) => {
            try {
                const updated = await avoirService.valider(avoir.id, {
                    validated_by_id: validatorId,
                    password: password
                });
                toast.success(t('avoirs.toasts.validate_success'));
                setAvoirs(avoirs.map(a => a.id === avoir.id ? updated : a));
                if (viewMode === 'DETAILS') setViewMode('LIST');
            } catch (err: unknown) {
                const error = err as { response?: { data?: { error?: string } }; message?: string };
                toast.error(t('avoirs.toasts.validate_error') + ': ' + (error.response?.data?.error || error.message || 'Erreur inconnue'));
            } finally {
                setSavingValidation(false);
            }
        }, {
            title: t('avoirs.modals.sudo_validate_title', { numero: avoir.numero }),
            message: t('avoirs.modals.sudo_validate_message', { numero: avoir.numero })
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
            toast.success(newStatus ? t('avoirs.toasts.line_closed') : t('avoirs.toasts.line_reopened'));
        } catch (err) {
            toast.error(t('avoirs.toasts.update_line_error'));
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
            toast.success(targetStatus ? t('avoirs.toasts.bulk_lines_closed') : t('avoirs.toasts.bulk_lines_reopened'));
        } catch (err) {
            toast.error(t('avoirs.toasts.bulk_update_error'));
            // Rollback
            setSelectedAvoir(prev => prev ? { ...prev, produits: originalProduits } : null);
        }
    };

    // --- Line Building functions ---
    const selectProduct = (product: ProduitModel) => {
        const existing = lignes.find(l => (typeof l.produit === 'object' ? l.produit.id : l.produit) === product.id);
        if (existing) {
            toast.error(t('avoirs.toasts.product_exists'));
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
            toast.error(t('avoirs.toasts.load_lots_error'));
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
        if (!confirm(t('avoirs.confirms.bulk_delete', { count }))) return;

        setBulkLoading(true);
        try {
            const idsToDelete = Array.from(selectedIds);
            await Promise.all(idsToDelete.map(id => avoirService.delete(id)));
            toast.success(t('avoirs.toasts.bulk_delete_success', { count }));
            setAvoirs(avoirs.filter(a => !selectedIds.has(a.id)));
            setSelectedIds(new Set());
        } catch (err) {
            toast.error(t('avoirs.toasts.bulk_delete_error'));
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
                toast.success(t('avoirs.toasts.bulk_validate_success', { count }));
                setSelectedIds(new Set());
                fetchAvoirs();
            } catch (err) {
                toast.error(t('avoirs.toasts.bulk_validate_error'));
            } finally {
                setBulkLoading(false);
            }
        }, {
            title: t('avoirs.modals.sudo_bulk_validate_title', { count }),
            message: t('avoirs.modals.sudo_bulk_validate_message', { count })
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
