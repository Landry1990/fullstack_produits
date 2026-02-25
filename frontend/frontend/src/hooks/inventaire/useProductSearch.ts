import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { ProduitModel } from '../../types';

export const useProductSearch = (
    _lignesEndpoint: string,
    activeInventaireId: number | undefined,
    setLignes: React.Dispatch<React.SetStateAction<any[]>>,
    lignes: any[]
) => {
    const { t } = useTranslation();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ProduitModel[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Lot selection modal state
    const [showLotModal, setShowLotModal] = useState(false);
    const [selectedProductForLot, setSelectedProductForLot] = useState<ProduitModel | null>(null);
    const [availableLots, setAvailableLots] = useState<any[]>([]);
    const [loadingLots, setLoadingLots] = useState(false);
    const [selectedLotIndex, setSelectedLotIndex] = useState(-1);

    // Fetch products based on search query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const fetchProducts = async () => {
            setLoadingSearch(true);
            try {
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
                const response = await axios.get(`${String(apiBaseUrl).replace(/\/$/, '')}/produits/?search=${searchQuery}`);
                const productsList = Array.isArray(response.data) ? response.data : response.data.results;
                setSearchResults(productsList || []);
                setSelectedItemIndex(productsList?.length > 0 ? 0 : -1);
            } catch (err) {
                console.error("Erreur recherche produits", err);
                toast.error(t('common.messages.error_loading', { defaultValue: 'Erreur recherche' }));
            } finally {
                setLoadingSearch(false);
            }
        };

        const timeoutId = setTimeout(fetchProducts, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, t]);

    const focusInput = () => {
        if (searchInputRef.current) searchInputRef.current.focus();
    };

    const focusFirstQty = (id?: number) => {
        // Wait a bit for the DOM to update since the line was just added
        setTimeout(() => {
            const targetId = id !== undefined ? `qty-input-${id}` : 'qty-input-0';
            const input = document.getElementById(targetId);
            if (input) {
                (input as HTMLInputElement).focus();
                (input as HTMLInputElement).select(); // Pre-select for quick typing
            }
        }, 150);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedItemIndex(prev => Math.min(prev + 1, searchResults.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedItemIndex(prev => Math.max(prev - 1, -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedItemIndex >= 0 && selectedItemIndex < searchResults.length) {
                handleProductSelect(searchResults[selectedItemIndex]);
            } else if (searchResults.length === 1) {
                handleProductSelect(searchResults[0]);
            }
        } else if (e.key === 'Escape') {
            setSearchQuery('');
            setSearchResults([]);
            setSelectedItemIndex(-1);
        }
    };

    const fetchAvailableLots = async (productId: number) => {
        setLoadingLots(true);
        try {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
            const res = await axios.get(`${String(apiBaseUrl).replace(/\/$/, '')}/stock-lots/?produit=${productId}&quantity_remaining_gt=0`);
            const lots = Array.isArray(res.data) ? res.data : res.data.results;
            setAvailableLots(lots || []);
            setSelectedLotIndex(lots?.length > 0 ? 0 : -1);
        } catch (err) {
            console.error("Erreur chargement lots", err);
            toast.error(t('common.messages.error_loading', { defaultValue: 'Erreur lors du chargement' }));
        } finally {
            setLoadingLots(false);
        }
    };

    const handleProductSelect = (product: ProduitModel) => {
        if (product.use_lot_management) {
            setSelectedProductForLot(product);
            setShowLotModal(true);
            setSelectedLotIndex(0); // <-- Auto-select the first lot option
            fetchAvailableLots(product.id);
            setSearchQuery('');
            setSearchResults([]);
        } else {
            handleAddProduct(product);
        }
    };

    const handleLotSelection = (lotId: number | 'NEW' | 'GLOBAL') => {
        if (!selectedProductForLot) return;
        const tempId = Date.now();

        // Default values (GLOBAL or product fallback)
        let lotStock = selectedProductForLot.stock;
        let lotNum = undefined;
        let lotExp = undefined;

        if (lotId !== 'NEW' && lotId !== 'GLOBAL') {
            const lot = availableLots.find(l => l.id === lotId);
            if (lot) {
                lotStock = lot.quantity_remaining;
                lotNum = lot.lot;
                lotExp = lot.date_expiration;
            }
        } else if (lotId === 'NEW') {
            lotStock = 0;
            // For NEW, we will let the user enter lot info later or handle it as is
            // but the theoretical stock is definitely 0
        }

        handleAddProduct(
            selectedProductForLot,
            lotId === 'NEW' || lotId === 'GLOBAL' ? undefined : lotId,
            tempId,
            lotStock,
            lotNum,
            lotExp
        );
        setShowLotModal(false);
        setSelectedProductForLot(null);
    };

    const handleLotModalKeyDown = (e: React.KeyboardEvent) => {
        const totalOptions = availableLots.length + 2;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedLotIndex(prev => Math.min(prev + 1, totalOptions - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedLotIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedLotIndex < availableLots.length) {
                handleLotSelection(availableLots[selectedLotIndex].id);
            } else if (selectedLotIndex === availableLots.length) {
                handleLotSelection('GLOBAL');
            } else {
                handleLotSelection('NEW');
            }
        } else if (e.key === 'Escape') {
            setShowLotModal(false);
            setSelectedProductForLot(null);
            focusInput();
        }
    };

    const handleAddProduct = async (
        product: ProduitModel,
        stockLotId?: number,
        forcedId?: number,
        initialStock?: number,
        lotNum?: string,
        lotExp?: string
    ) => {
        if (!activeInventaireId) return;

        // Optimistic UI checks: verify if line already exists
        const existsLocally = lignes.some(l =>
            l.produit === product.id &&
            (stockLotId ? l.stock_lot === stockLotId : !l.stock_lot)
        );

        if (existsLocally) {
            toast.error(t('stock.inventaire.detail.already_added'));
            setSearchQuery('');
            setSearchResults([]);
            setSelectedItemIndex(-1);
            focusInput();
            return;
        }

        const fallbackId = forcedId || Date.now();
        const temporaryLine = {
            id: fallbackId,
            inventaire: activeInventaireId,
            produit: product.id,
            produit_nom: product.name,
            produit_cip: product.cip1,
            produit_rayon: product.rayon_name,
            stock_lot: stockLotId,
            stock_theorique: initialStock ?? (product.stock || 0),
            quantite_physique: initialStock ?? (product.stock || 0),
            ecart: 0,
            isLocalOnly: true,
            pmp_snapshot: product.cost_price || '0',
            produit_cost_price: product.cost_price || '0',
            lot_numero: lotNum,
            lot_expiration: lotExp
        };

        // Optimistic add
        setLignes(prev => [temporaryLine, ...prev]);
        setSearchQuery('');
        setSearchResults([]);
        setSelectedItemIndex(-1);
        focusFirstQty(fallbackId);
    };

    return {
        searchQuery, setSearchQuery,
        searchResults, setSearchResults,
        loadingSearch, setLoadingSearch,
        selectedItemIndex, setSelectedItemIndex,
        searchInputRef, focusInput, focusFirstQty,
        handleSearchKeyDown, handleProductSelect,

        // Lot Modal
        showLotModal, setShowLotModal,
        selectedProductForLot, setSelectedProductForLot,
        availableLots, loadingLots,
        selectedLotIndex, setSelectedLotIndex,
        handleLotSelection, handleLotModalKeyDown
    };
};
